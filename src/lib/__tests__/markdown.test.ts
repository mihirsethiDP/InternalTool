import { describe, it, expect } from 'vitest';
import { renderMarkdown, inline, applyHighlight, normalizeAnswerSteps } from '../markdown';

describe('renderMarkdown', () => {
  it('wraps plain text in a paragraph', () => {
    expect(renderMarkdown('Hello world')).toContain('<p>Hello world</p>');
  });

  it('renders bold and italic', () => {
    expect(renderMarkdown('**bold**')).toContain('<strong>bold</strong>');
    expect(renderMarkdown('a *it* b')).toContain('<em>it</em>');
  });

  it('renders headings', () => {
    expect(renderMarkdown('## Title')).toContain('<h2>Title</h2>');
    expect(renderMarkdown('### Sub')).toContain('<h3>Sub</h3>');
  });

  it('renders unordered and ordered lists', () => {
    const ul = renderMarkdown('- one\n- two');
    expect(ul).toContain('<ul>');
    expect(ul).toContain('<li>one</li>');
    expect(ul).toContain('<li>two</li>');
    const ol = renderMarkdown('1. first\n2. second');
    expect(ol).toContain('<ol>');
    expect(ol).toContain('<li>first</li>');
    expect(ol).toContain('<li>second</li>');
  });

  it('renders blockquote, hr and doc-note', () => {
    expect(renderMarkdown('> quoted')).toContain('<blockquote>quoted</blockquote>');
    expect(renderMarkdown('---')).toContain('<hr/>');
    expect(renderMarkdown('_a side note_')).toContain('class="doc-note"');
  });

  it('escapes HTML to prevent injection', () => {
    const out = renderMarkdown('a < b & "c" <script>x</script>');
    expect(out).toContain('&lt;');
    expect(out).toContain('&amp;');
    expect(out).not.toContain('<script>');
  });
});

describe('inline', () => {
  it('escapes angle brackets and ampersands', () => {
    expect(inline('1 < 2 & 3 > 0')).toBe('1 &lt; 2 &amp; 3 &gt; 0');
  });
});

describe('applyHighlight', () => {
  it('wraps matching terms in <mark>', () => {
    const out = applyHighlight('<p>leak detected here</p>', 'leak');
    expect(out).toContain('<mark>leak</mark>');
  });
  it('does not corrupt HTML tags when a term matches tag-like text', () => {
    const out = applyHighlight('<strong>important</strong>', 'important');
    expect(out).toContain('<strong>');
    expect(out).toContain('</strong>');
    expect(out).toContain('<mark>important</mark>');
  });
  it('ignores very short terms', () => {
    const out = applyHighlight('<p>a b c</p>', 'a');
    expect(out).not.toContain('<mark>');
  });
});

describe('normalizeAnswerSteps', () => {
  it('splits inline numbered steps onto separate lines', () => {
    const out = normalizeAnswerSteps('Likely causes. 1. Clean the probe. 2. Calibrate. 3. Verify.');
    expect(out).toContain('\n1.');
    expect(out).toContain('\n2.');
    expect(out).toContain('\n3.');
  });
  it('splits after a citation bracket', () => {
    const out = normalizeAnswerSteps('Run calibration [2]. 3. If drift persists, replace.');
    expect(out).toContain('[2].\n3.');
  });
  it('does NOT split decimal numbers', () => {
    const out = normalizeAnswerSteps('Use pH 4.0 and 7.0 buffers.');
    expect(out).toBe('Use pH 4.0 and 7.0 buffers.');
    expect(out).not.toContain('\n');
  });
  it('is a no-op on empty input', () => {
    expect(normalizeAnswerSteps('')).toBe('');
  });
});
