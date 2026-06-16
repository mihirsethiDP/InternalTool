// Lightweight markdown -> HTML renderer shared by the consolidated viewer and
// the chat assistant. Kept deliberately small (no external dependency): handles
// the subset of markdown our consolidated content uses — headings, ordered /
// unordered lists, blockquotes, horizontal rules, bold/italic, and the
// italic-line "doc note" convention. Optionally highlights query terms.

export function renderMarkdown(body: string, q?: string): string {
  const lines = (body ?? '').split(/\r?\n/);
  const out: string[] = [];
  let inList: 'ul' | 'ol' | null = null;
  let para: string[] = [];

  function closeList() { if (inList) { out.push(`</${inList}>`); inList = null; } }
  function flushPara() {
    if (para.length) {
      out.push(`<p>${inline(para.join(' '))}</p>`);
      para = [];
    }
  }

  for (const raw of lines) {
    const line = raw.trimEnd();

    if (/^\s*$/.test(line)) { flushPara(); closeList(); continue; }

    const h3 = line.match(/^###\s+(.*)$/);
    if (h3) { flushPara(); closeList(); out.push(`<h3>${inline(h3[1])}</h3>`); continue; }
    const h2 = line.match(/^##\s+(.*)$/);
    if (h2) { flushPara(); closeList(); out.push(`<h2>${inline(h2[1])}</h2>`); continue; }

    if (/^---+\s*$/.test(line)) { flushPara(); closeList(); out.push('<hr/>'); continue; }

    const note = line.match(/^_(.+)_$/);
    if (note) { flushPara(); closeList(); out.push(`<span class="doc-note">${inline(note[1])}</span>`); continue; }

    const ol = line.match(/^\s*(\d+)[.)]\s+(.*)$/);
    if (ol) {
      flushPara();
      if (inList !== 'ol') { closeList(); out.push('<ol>'); inList = 'ol'; }
      out.push(`<li>${inline(ol[2])}</li>`);
      continue;
    }
    const ul = line.match(/^\s*[-*•]\s+(.*)$/);
    if (ul) {
      flushPara();
      if (inList !== 'ul') { closeList(); out.push('<ul>'); inList = 'ul'; }
      out.push(`<li>${inline(ul[1])}</li>`);
      continue;
    }

    const bq = line.match(/^>\s?(.*)$/);
    if (bq) { flushPara(); closeList(); out.push(`<blockquote>${inline(bq[1])}</blockquote>`); continue; }

    closeList();
    para.push(line);
  }
  flushPara();
  closeList();

  let html = out.join('\n');
  html = html.replace(/(Issue \d+)(\s*[—-])/g, '<strong>$1</strong>$2');
  if (q?.trim()) html = applyHighlight(html, q);
  return html;
}

export function inline(s: string): string {
  let t = s
    .replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]!));
  t = t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  t = t.replace(/(?<![\w*])\*([^*]+)\*(?![\w*])/g, '<em>$1</em>');
  return t;
}

export function applyHighlight(html: string, q: string): string {
  const terms = q.split(/\s+/).map((t) => t.replace(/[^a-zA-Z0-9]/g, '')).filter((t) => t.length > 1);
  if (terms.length === 0) return html;
  const pattern = terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  const re = new RegExp(`\\b(?:${pattern})\\w*`, 'gi');
  return html.split(/(<[^>]+>)/).map((seg) => {
    if (seg.startsWith('<')) return seg;
    return seg.replace(re, '<mark>$&</mark>');
  }).join('');
}
