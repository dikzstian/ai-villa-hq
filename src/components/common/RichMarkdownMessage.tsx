import React from 'react';

interface RichMarkdownMessageProps {
  content: string;
  isUser?: boolean;
  compact?: boolean;
}

function renderInline(text: string, isUser = false): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  // Match inline code `...`, links [label](url), bold **...**, or italic *...*
  const tokenRegex =
    /(`[^`]+`)|(\[[^\]]+\]\(https?:\/\/[^\s)]+\))|(\*\*[^*]+\*\*)|(\*[^*\n]+\*)/g;

  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let keyIdx = 0;

  while ((match = tokenRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }

    const token = match[0];
    if (token.startsWith('`') && token.endsWith('`')) {
      nodes.push(
        <code
          key={`c-${keyIdx++}`}
          className={
            isUser
              ? 'px-1.5 py-0.5 rounded bg-indigo-800/80 text-amber-200 font-mono text-[11.5px]'
              : 'px-1.5 py-0.5 rounded bg-slate-800/95 border border-slate-700/80 text-amber-300 font-mono text-[11.5px]'
          }
        >
          {token.slice(1, -1)}
        </code>
      );
    } else if (token.startsWith('[')) {
      const linkMatch = /^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/.exec(token);
      if (linkMatch) {
        nodes.push(
          <a
            key={`l-${keyIdx++}`}
            href={linkMatch[2]}
            target="_blank"
            rel="noopener noreferrer"
            className="text-cyan-300 underline underline-offset-2 hover:text-cyan-200 font-semibold"
          >
            {linkMatch[1]}
          </a>
        );
      } else {
        nodes.push(token);
      }
    } else if (token.startsWith('**') && token.endsWith('**')) {
      nodes.push(
        <strong
          key={`b-${keyIdx++}`}
          className={isUser ? 'font-extrabold text-white' : 'font-bold text-white'}
        >
          {renderInline(token.slice(2, -2), isUser)}
        </strong>
      );
    } else if (token.startsWith('*') && token.endsWith('*')) {
      nodes.push(
        <em
          key={`i-${keyIdx++}`}
          className={isUser ? 'italic text-indigo-100' : 'italic text-cyan-200/95'}
        >
          {token.slice(1, -1)}
        </em>
      );
    } else {
      nodes.push(token);
    }

    lastIndex = tokenRegex.lastIndex;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes;
}

function splitTableRow(row: string): string[] {
  const trimmed = row.trim().replace(/^\|/, '').replace(/\|$/, '');
  return trimmed.split('|').map((c) => c.trim());
}

function isTableSeparator(row: string): boolean {
  return /^\|?[\s:-]+\|[\s|:-]+\|?$/.test(row.trim());
}

export const RichMarkdownMessage: React.FC<RichMarkdownMessageProps> = ({
  content,
  isUser = false,
  compact = false,
}) => {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [selectedSnippet, setSelectedSnippet] = React.useState('');
  const [copiedPartial, setCopiedPartial] = React.useState(false);

  const checkTextSelection = () => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) {
      if (selectedSnippet && !copiedPartial) setSelectedSnippet('');
      return;
    }
    const text = sel.toString().trim();
    if (
      text &&
      containerRef.current &&
      (containerRef.current.contains(sel.anchorNode) ||
        containerRef.current.contains(sel.focusNode))
    ) {
      setSelectedSnippet(text);
    } else if (!copiedPartial) {
      setSelectedSnippet('');
    }
  };

  const handleCopyPartial = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!selectedSnippet) return;
    try {
      await navigator.clipboard.writeText(selectedSnippet);
      setCopiedPartial(true);
      setTimeout(() => {
        setCopiedPartial(false);
        setSelectedSnippet('');
      }, 1800);
    } catch {
      // ignore
    }
  };

  if (isUser) {
    return (
      <div
        ref={containerRef}
        onMouseUp={checkTextSelection}
        onKeyUp={checkTextSelection}
        className="whitespace-pre-wrap text-[13.5px] leading-relaxed select-text cursor-text"
      >
        {selectedSnippet && (
          <div className="mb-2 flex items-center justify-between gap-2 px-2.5 py-1 rounded-lg bg-slate-950/90 border border-cyan-400/60 text-[11px] text-cyan-200 select-none">
            <span className="truncate">
              ✂️ Teks diblok ({selectedSnippet.length} karakter)
            </span>
            <button
              type="button"
              onClick={handleCopyPartial}
              className="px-2 py-0.5 rounded bg-cyan-600 hover:bg-cyan-500 text-white font-bold shrink-0 cursor-pointer"
            >
              {copiedPartial ? '✅ Tersalin!' : 'Salin Bagian Ini'}
            </button>
          </div>
        )}
        {renderInline(content, true)}
      </div>
    );
  }

  const lines = (content || '').replace(/\r\n/g, '\n').split('\n');
  const blocks: React.ReactNode[] = [];
  let i = 0;
  let blockKey = 0;

  const bodyTextClass = compact
    ? 'text-xs leading-[1.65] text-slate-200'
    : 'text-[13.5px] leading-[1.72] text-slate-200';

  while (i < lines.length) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    // Skip empty lines
    if (!trimmed) {
      i++;
      continue;
    }

    // 1. Fenced code block ```
    if (trimmed.startsWith('```')) {
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      if (i < lines.length) i++; // skip closing ```
      blocks.push(
        <pre
          key={`code-${blockKey++}`}
          className="my-2.5 p-3 rounded-xl bg-slate-950/95 border border-slate-800 font-mono text-[12px] leading-relaxed text-emerald-200 overflow-x-auto"
        >
          {codeLines.join('\n')}
        </pre>
      );
      continue;
    }

    // 2. Horizontal rule --- / ***
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      blocks.push(<hr key={`hr-${blockKey++}`} className="my-3 border-slate-800/90" />);
      i++;
      continue;
    }

    // 3. Markdown Table | Col | Col |
    if (
      trimmed.includes('|') &&
      i + 1 < lines.length &&
      isTableSeparator(lines[i + 1])
    ) {
      const headers = splitTableRow(trimmed);
      i += 2; // skip header + separator
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trim().includes('|') && lines[i].trim() !== '') {
        if (!isTableSeparator(lines[i])) {
          rows.push(splitTableRow(lines[i]));
        }
        i++;
      }
      blocks.push(
        <div
          key={`tbl-${blockKey++}`}
          className="my-3 overflow-x-auto rounded-xl border border-slate-700/80 bg-slate-950/70 shadow-inner"
        >
          <table className="w-full text-left border-collapse text-[12.5px]">
            <thead>
              <tr className="bg-slate-800/90 border-b border-slate-700 text-cyan-200">
                {headers.map((h, hIdx) => (
                  <th key={hIdx} className="px-3 py-2 font-extrabold whitespace-nowrap">
                    {renderInline(h)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {rows.map((r, rIdx) => (
                <tr
                  key={rIdx}
                  className={rIdx % 2 === 0 ? 'bg-slate-900/40' : 'bg-slate-950/40'}
                >
                  {headers.map((_, cIdx) => (
                    <td key={cIdx} className="px-3 py-2 text-slate-200 align-top leading-relaxed">
                      {renderInline(r[cIdx] || '')}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      continue;
    }

    // 4. Headings (#, ##, ###, ####)
    const headingMatch = /^(#{1,4})\s+(.+)$/.exec(trimmed);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const headingText = headingMatch[2];
      if (level === 1) {
        blocks.push(
          <h3
            key={`h1-${blockKey++}`}
            className="text-[15.5px] font-extrabold text-white pb-2 mb-2.5 border-b border-slate-700/80 leading-snug"
          >
            {renderInline(headingText)}
          </h3>
        );
      } else if (level === 2) {
        blocks.push(
          <h4
            key={`h2-${blockKey++}`}
            className="mt-4 mb-2 px-2.5 py-1.5 rounded-lg bg-indigo-500/12 border-l-4 border-cyan-400 text-[12.5px] font-extrabold uppercase tracking-wide text-cyan-200"
          >
            {renderInline(headingText)}
          </h4>
        );
      } else {
        blocks.push(
          <h5
            key={`h3-${blockKey++}`}
            className="mt-3 mb-1 text-[13px] font-bold text-indigo-200"
          >
            {renderInline(headingText)}
          </h5>
        );
      }
      i++;
      continue;
    }

    // 5. Blockquote > ...
    if (trimmed.startsWith('>')) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('>')) {
        quoteLines.push(lines[i].trim().replace(/^>\s?/, ''));
        i++;
      }
      blocks.push(
        <div
          key={`q-${blockKey++}`}
          className="my-2.5 pl-3.5 pr-3 py-2 border-l-3 border-amber-400 bg-amber-500/10 rounded-r-xl text-[13px] leading-relaxed text-amber-100"
        >
          {renderInline(quoteLines.join(' '))}
        </div>
      );
      continue;
    }

    // 6. Numbered List Item (1. ...) + optional indented sub-bullets (- ...)
    const orderedMatch = /^(\d+)[.)]\s+(.+)$/.exec(trimmed);
    if (orderedMatch) {
      const numLabel = orderedMatch[1];
      const mainText = orderedMatch[2];
      i++;

      const subBullets: string[] = [];
      while (i < lines.length) {
        const nextRaw = lines[i];
        const nextTrim = nextRaw.trim();
        if (!nextTrim) {
          i++;
          break;
        }
        // Indented bullet or sub-line under this numbered item
        const subMatch = /^[-*•]\s+(.+)$/.exec(nextTrim);
        if (subMatch && (/^\s+/.test(nextRaw) || !/^\d+[.)]\s+/.test(nextTrim))) {
          subBullets.push(subMatch[1]);
          i++;
        } else if (
          !/^(#{1,4}\s|\d+[.)]\s|[-*•]\s|```|>|\|)/.test(nextTrim) &&
          subBullets.length === 0
        ) {
          // Continuation sentence of the numbered item
          subBullets.push(`__CONT__${nextTrim}`);
          i++;
        } else {
          break;
        }
      }

      const contParts = subBullets
        .filter((s) => s.startsWith('__CONT__'))
        .map((s) => s.slice(8));
      const realBullets = subBullets.filter((s) => !s.startsWith('__CONT__'));
      const fullMain = contParts.length > 0 ? `${mainText} ${contParts.join(' ')}` : mainText;

      blocks.push(
        <div
          key={`ol-${blockKey++}`}
          className="my-2 p-2.5 rounded-xl bg-slate-900/60 border border-slate-800/80 space-y-2"
        >
          <div className={`flex items-start gap-2.5 ${bodyTextClass}`}>
            <span className="w-5 h-5 rounded-md bg-indigo-500/20 border border-indigo-500/40 text-indigo-300 text-[11px] font-extrabold flex items-center justify-center shrink-0 mt-0.5">
              {numLabel}
            </span>
            <div className="flex-1 min-w-0">{renderInline(fullMain)}</div>
          </div>

          {realBullets.length > 0 && (
            <ul className="pl-7 space-y-1.5 pt-0.5">
              {realBullets.map((sb, sbIdx) => (
                <li
                  key={sbIdx}
                  className={`flex items-start gap-2 ${bodyTextClass} text-slate-300`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 mt-2.5 shrink-0" />
                  <div className="flex-1 min-w-0">{renderInline(sb)}</div>
                </li>
              ))}
            </ul>
          )}
        </div>
      );
      continue;
    }

    // 7. Unordered Bullet List (- / * / •)
    if (/^[-*•]\s+/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*•]\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^[-*•]\s+/, ''));
        i++;
      }
      blocks.push(
        <ul key={`ul-${blockKey++}`} className="my-2 space-y-1.5 pl-1">
          {items.map((it, idx) => (
            <li key={idx} className={`flex items-start gap-2.5 ${bodyTextClass}`}>
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 mt-2.5 shrink-0" />
              <div className="flex-1 min-w-0">{renderInline(it)}</div>
            </li>
          ))}
        </ul>
      );
      continue;
    }

    // 8. Normal Paragraph (merge consecutive plain lines for natural flow)
    const paraLines: string[] = [trimmed];
    i++;
    while (i < lines.length) {
      const nextTrim = lines[i].trim();
      if (
        !nextTrim ||
        /^(#{1,4}\s|\d+[.)]\s|[-*•]\s|```|>|---|\*\*\*|\|)/.test(nextTrim)
      ) {
        break;
      }
      paraLines.push(nextTrim);
      i++;
    }

    blocks.push(
      <p key={`p-${blockKey++}`} className={`my-2 ${bodyTextClass}`}>
        {paraLines.map((pl, plIdx) => (
          <React.Fragment key={plIdx}>
            {plIdx > 0 && <br />}
            {renderInline(pl)}
          </React.Fragment>
        ))}
      </p>
    );
  }

  return (
    <div
      ref={containerRef}
      onMouseUp={checkTextSelection}
      onKeyUp={checkTextSelection}
      className="space-y-1 select-text cursor-text relative"
    >
      {(selectedSnippet || copiedPartial) && (
        <div className="sticky top-0 z-20 mb-2 flex items-center justify-between gap-2 px-3 py-1.5 rounded-xl bg-slate-950/95 border border-cyan-400/70 shadow-lg text-[11px] text-cyan-200 select-none">
          <span className="truncate font-medium">
            ✂️ Diblok:{' '}
            <span className="text-white italic">
              "{selectedSnippet.slice(0, 48)}
              {selectedSnippet.length > 48 ? '...' : ''}"
            </span>{' '}
            ({selectedSnippet.length} kar)
          </span>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={handleCopyPartial}
              className="px-2.5 py-1 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-extrabold cursor-pointer transition"
            >
              {copiedPartial ? '✅ Bagian Tersalin!' : '📋 Copy Bagian yang Diblok'}
            </button>
            <button
              type="button"
              onClick={() => setSelectedSnippet('')}
              className="px-1.5 py-0.5 text-slate-400 hover:text-white cursor-pointer"
            >
              ✕
            </button>
          </div>
        </div>
      )}
      {blocks}
    </div>
  );
};
