const btnAnalyze = document.getElementById('btnAnalyze');
const btnSyncOnly = document.getElementById('btnSyncOnly');
const agentSelect = document.getElementById('agentSelect');
const statusBox = document.getElementById('status');

function showStatus(ok, text) {
  statusBox.style.display = 'block';
  statusBox.className = ok ? 'ok' : 'err';
  statusBox.textContent = text;
}

async function captureAndSend(triggerAnalysis) {
  btnAnalyze.disabled = true;
  btnSyncOnly.disabled = true;
  showStatus(true, 'Membaca tampilan, judul video & komentar tab aktif...');

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id || !tab.url || tab.url.startsWith('chrome://')) {
      throw new Error('Buka tab Instagram / TikTok / Dashboard terlebih dahulu (bukan halaman chrome://).');
    }

    let screenshotDataUrl = null;
    try {
      screenshotDataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' });
    } catch {
      // Optional if permission restricted
    }

    const injected = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        const metaDesc =
          document.querySelector('meta[name="description"]')?.getAttribute('content') || '';
        const headings = Array.from(document.querySelectorAll('h1, h2, h3'))
          .map((el) => (el.textContent || '').trim().replace(/\s+/g, ' '))
          .filter(Boolean)
          .slice(0, 16);

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
          title: document.title || location.href,
          url: location.href,
          headings,
          extractedText: sections.join('\n\n'),
          loginWallDetected: hasPassword,
        };
      },
    });

    const pageData = injected?.[0]?.result || {
      title: tab.title || tab.url,
      url: tab.url,
      headings: [],
      extractedText: '',
      loginWallDetected: false,
    };

    showStatus(
      true,
      triggerAnalysis
        ? 'Mengirim ke Villa HQ & menyusun laporan audit...'
        : 'Menyimpan snapshot & komentar terbaru ke Villa HQ...'
    );

    const res = await fetch('http://127.0.0.1:3001/api/social-browser/ingest-tab', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...pageData,
        screenshotDataUrl,
        agentId: triggerAnalysis ? agentSelect.value : undefined,
      }),
    });

    const data = await res.json();
    if (!res.ok || !data.ok) {
      throw new Error(data.error || 'Gagal mengirim ke server Villa HQ (pastikan localhost:3001 aktif).');
    }

    showStatus(
      true,
      triggerAnalysis
        ? '✅ Berhasil! Laporan audit live sudah masuk ke tab Villa HQ (http://localhost:5173).'
        : '✅ Snapshot, judul konten & komentar terbaru berhasil masuk ke memori Nadia & Tim!'
    );
  } catch (err) {
    showStatus(false, err.message || String(err));
  } finally {
    btnAnalyze.disabled = false;
    btnSyncOnly.disabled = false;
  }
}

btnAnalyze.addEventListener('click', () => captureAndSend(true));
btnSyncOnly.addEventListener('click', () => captureAndSend(false));
