const SOCIAL_PATTERNS = [
  'instagram.com',
  'tiktok.com',
  'youtube.com',
  'facebook.com',
  'shopee.co.id',
  'tokopedia.com',
];

function isSocialMediaUrl(url) {
  if (!url || !url.startsWith('http')) return false;
  const lower = url.toLowerCase();
  return SOCIAL_PATTERNS.some((domain) => lower.includes(domain));
}

// Injected inside the target social media tab to extract video titles, captions, views & live comments
function extractDeepSocialPageData() {
  const title = document.title || location.href;
  const url = location.href;
  const metaDesc =
    document.querySelector('meta[name="description"]')?.getAttribute('content') || '';
  const headings = Array.from(document.querySelectorAll('h1, h2, h3'))
    .map((el) => (el.textContent || '').trim().replace(/\s+/g, ' '))
    .filter(Boolean)
    .slice(0, 16);

  // 1. Extract Post / Video Titles, Captions & Views
  const postSnippets = [];
  const postSeen = new Set();
  const addPost = (txt) => {
    const clean = (txt || '').trim().replace(/\s+/g, ' ');
    if (clean.length > 5 && !postSeen.has(clean) && postSnippets.length < 25) {
      postSeen.add(clean);
      postSnippets.push(clean.slice(0, 260));
    }
  };

  document
    .querySelectorAll(
      '[data-e2e="user-post-item-desc"], [data-e2e="user-post-item"], [data-e2e="browse-video-desc"], [data-e2e="video-desc"], ytcp-video-row, #video-title, article a[href*="/p/"], article a[href*="/reel/"], [class*="DivItemContainer"]'
    )
    .forEach((el) => {
      const txt = (el.innerText || el.textContent || '').trim();
      const imgAlt = el.querySelector?.('img')?.getAttribute('alt') || '';
      const aria = el.getAttribute?.('aria-label') || el.getAttribute?.('title') || '';
      addPost([txt, imgAlt, aria].filter(Boolean).join(' — '));
    });

  document.querySelectorAll('article img[alt], main img[alt]').forEach((img) => {
    const alt = img.getAttribute('alt') || '';
    if (alt.length > 15 && !alt.toLowerCase().includes('profile picture')) {
      addPost('[Visual/Caption]: ' + alt);
    }
  });

  // 2. Extract Live Comments & Replies
  const commentSnippets = [];
  const commentSeen = new Set();
  const addComment = (txt) => {
    const clean = (txt || '').trim().replace(/\s+/g, ' ');
    if (clean.length > 3 && !commentSeen.has(clean) && commentSnippets.length < 40) {
      commentSeen.add(clean);
      commentSnippets.push(clean.slice(0, 280));
    }
  };

  document
    .querySelectorAll(
      '[data-e2e="comment-level-1"], [data-e2e="comment-level-2"], [data-e2e*="comment"], [class*="DivCommentItemContainer"], [class*="CommentItem"], [class*="CommentText"], ytcp-comment, ytd-comment-renderer, #content-text, [role="dialog"] ul li, article ul li'
    )
    .forEach((el) => {
      const txt = (el.innerText || el.textContent || '').trim();
      if (txt.length > 3) addComment(txt);
    });

  const rawBody = (document.body?.innerText || '')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 1)
    .slice(0, 320)
    .join('\n')
    .slice(0, 7500);

  const hasPassword = Boolean(document.querySelector('input[type="password"]'));
  const sections = [];
  if (metaDesc) sections.push('[Meta]: ' + metaDesc);
  if (postSnippets.length > 0) {
    sections.push(
      '[📌 DAFTAR KONTEN / JUDUL VIDEO / CAPTION TERBARU]:\n- ' + postSnippets.join('\n- ')
    );
  }
  if (commentSnippets.length > 0) {
    sections.push(
      '[💬 KOMENTAR & INTERAKSI AUDIENS TERBARU]:\n- ' + commentSnippets.join('\n- ')
    );
  }
  sections.push('[📊 TEKS & METRIK LENGKAP HALAMAN]:\n' + rawBody);

  return {
    title,
    url,
    headings,
    extractedText: sections.join('\n\n'),
    loginWallDetected: hasPassword,
  };
}

let isSyncing = false;
let lastHandledRequestTime = 0;

async function syncSingleTab(tab) {
  if (!tab || !tab.id || !isSocialMediaUrl(tab.url)) return false;
  try {
    const injected = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: extractDeepSocialPageData,
    });
    const pageData = injected?.[0]?.result;
    if (!pageData || !pageData.extractedText) return false;

    await fetch('http://127.0.0.1:3001/api/social-browser/ingest-tab', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...pageData,
        screenshotDataUrl: null,
      }),
    });
    return true;
  } catch {
    return false;
  }
}

async function syncAllOpenSocialTabs() {
  if (isSyncing) return;
  isSyncing = true;
  try {
    const tabs = await chrome.tabs.query({});
    const socialTabs = tabs.filter((t) => isSocialMediaUrl(t.url));
    for (const tab of socialTabs) {
      await syncSingleTab(tab);
    }
  } catch {
    // ignore if browser busy
  } finally {
    isSyncing = false;
  }
}

// 1. Auto-sync whenever any Social Media tab or Villa HQ app tab finishes loading
chrome.tabs.onUpdated.addListener((_tabId, changeInfo, tab) => {
  if (changeInfo.status !== 'complete' || !tab.url) return;
  if (tab.url.includes('localhost:5173') || tab.url.includes('127.0.0.1:5173')) {
    // User just opened or refreshed Villa HQ app -> immediately sync all open social tabs!
    setTimeout(() => {
      void syncAllOpenSocialTabs();
    }, 1000);
    return;
  }
  if (isSocialMediaUrl(tab.url)) {
    // Wait 2.2s for SPA (IG/TikTok/YT Studio) to finish rendering metrics & comments
    setTimeout(() => {
      void syncSingleTab(tab);
    }, 2200);
  }
});

// 2. Poll Villa HQ Backend sync signal so right before an Agent answers a prompt, all open social tabs are refreshed live!
async function checkBackendSyncSignal() {
  try {
    const res = await fetch('http://127.0.0.1:3001/api/social-browser/sync-signal');
    if (!res.ok) return;
    const data = await res.json();
    if (data.syncRequestedAt && data.syncRequestedAt > lastHandledRequestTime) {
      lastHandledRequestTime = data.syncRequestedAt;
      await syncAllOpenSocialTabs();
    }
  } catch {
    // Backend not running yet
  }
}

setInterval(() => {
  void checkBackendSyncSignal();
}, 3500);

chrome.alarms.create('villaHqPeriodicSocialSync', { periodInMinutes: 1 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'villaHqPeriodicSocialSync') {
    void syncAllOpenSocialTabs();
  }
});

// Run initial sync on service worker startup
void syncAllOpenSocialTabs();
