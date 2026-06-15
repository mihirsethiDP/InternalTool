import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Link from '@tiptap/extension-link';
import { supabase } from '../lib/supabase';
import { useAuth, isAdmin } from '../lib/auth';
import PageHeader from '../components/PageHeader';
import {
  SECTION_LABEL, SECTION_ORDER, parseSections, renderSections,
} from '../lib/consolidated';
import { writeConsolidated } from '../lib/consolidatedWrite';
import type { SubmissionSection } from '../lib/types';

/**
 * Admin-only WYSIWYG editor for a consolidated reference.
 * Each section (Manual / Install / Troubleshooting / Datasheet / Other) is
 * edited in its own TipTap editor instance. The five sections are concatenated
 * back into the `## section\n\nbody\n` markdown shape on save, and the
 * consolidated_doc_chunks table is regenerated for search.
 */
export default function ConsolidatedEditor() {
  const { id } = useParams();
  const { profile } = useAuth();
  const nav = useNavigate();
  const qc = useQueryClient();

  const [sections, setSections] = useState<Record<SubmissionSection, string>>(
    () => Object.fromEntries(SECTION_ORDER.map((s) => [s, ''])) as Record<SubmissionSection, string>
  );
  const [busy, setBusy] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const cdoc = useQuery({
    queryKey: ['consolidated-doc', id],
    queryFn: async () => {
      const { data } = await supabase
        .from('consolidated_docs')
        .select('*, sensor_models(model_no, sensor_makes(name), sensor_categories(name))')
        .eq('id', id)
        .maybeSingle();
      return data;
    },
  });

  useEffect(() => {
    if (cdoc.data?.content_markdown != null) {
      setSections(parseSections(cdoc.data.content_markdown));
    }
  }, [cdoc.data?.content_markdown]);

  async function save() {
    if (!cdoc.data) return;
    setBusy(true);
    try {
      const merged = renderSections(sections);
      await writeConsolidated({
        docId: id!,
        sensorModelId: cdoc.data.sensor_model_id,
        markdown: merged,
        changeKind: 'edit',
        note: 'Manual edit',
      });
      qc.invalidateQueries({ queryKey: ['consolidated-doc', id] });
      qc.invalidateQueries({ queryKey: ['recent-consolidated'] });
      setSavedAt(new Date().toLocaleTimeString());
    } catch (e: any) {
      alert('Save failed: ' + e.message);
    } finally {
      setBusy(false);
    }
  }

  if (cdoc.isLoading) return <div className="muted p-6">Loading…</div>;
  if (!isAdmin(profile)) return <div className="card text-sm">Admins only.</div>;
  if (!cdoc.data) return <div className="card text-sm">Consolidated document not found.</div>;

  const sm = cdoc.data.sensor_models;
  const title = `${sm?.sensor_makes?.name ?? ''} ${sm?.model_no ?? ''}`.trim();

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Consolidated reference · editing"
        icon="✎"
        title={title}
        subtitle="Edit any section, then Save to update the consolidated reference and rebuild search."
        action={
          <button onClick={() => nav(`/consolidated/${id}`)}
            className="bg-white text-brand-700 hover:bg-slate-100 rounded-lg px-3 py-2 text-sm shadow-sm">
            ← Done editing
          </button>
        }
      />

      {savedAt && (
        <div className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">
          ✓ Saved at {savedAt}
        </div>
      )}

      <div className="space-y-5">
        {SECTION_ORDER.map((s) => (
          <SectionEditor
            key={s}
            section={s}
            initialBody={sections[s]}
            onChange={(body) => setSections((prev) => ({ ...prev, [s]: body }))}
            onSave={save}
            busy={busy}
          />
        ))}
      </div>

      <div className="card-tight bg-amber-50/40 border-amber-200 text-sm text-amber-900">
        <strong>Tip:</strong> deleting a section means clearing its body completely.
        On save, empty sections are dropped from the rendered document.
      </div>
    </div>
  );
}

/* ============== Per-section editor ============== */
function SectionEditor({ section, initialBody, onChange, onSave, busy }: {
  section: SubmissionSection;
  initialBody: string;
  onChange: (b: string) => void;
  onSave: () => void;
  busy: boolean;
}) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: `Start typing the ${SECTION_LABEL[section]} content…` }),
      Link.configure({ openOnClick: false, autolink: true, HTMLAttributes: { rel: 'noreferrer', class: 'text-brand-700 underline' } }),
    ],
    content: bodyToHtml(initialBody),
    editorProps: {
      attributes: { class: 'tiptap-editor focus:outline-none min-h-32 text-slate-800' },
    },
    onUpdate: ({ editor }) => onChange(htmlToBody(editor.getHTML())),
  });

  // Sync external initialBody changes (e.g. after a remote refresh) once
  useEffect(() => {
    if (!editor) return;
    const current = htmlToBody(editor.getHTML());
    if (current !== initialBody) editor.commands.setContent(bodyToHtml(initialBody), { emitUpdate: false });
    // eslint-disable-next-line
  }, [editor]);

  if (!editor) return null;

  function setLink() {
    const url = window.prompt('URL');
    if (!url) return;
    editor!.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs uppercase tracking-wider font-semibold text-slate-500">{SECTION_LABEL[section]}</h2>
        <div className="flex items-center gap-1 flex-wrap">
          <TbBtn active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}><strong>B</strong></TbBtn>
          <TbBtn active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}><em>I</em></TbBtn>
          <TbBtn active={editor.isActive('strike')} onClick={() => editor.chain().focus().toggleStrike().run()}><span style={{ textDecoration: 'line-through' }}>S</span></TbBtn>
          <span className="w-px h-5 bg-slate-200 mx-1" />
          <TbBtn active={editor.isActive('heading', { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>H2</TbBtn>
          <TbBtn active={editor.isActive('heading', { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>H3</TbBtn>
          <span className="w-px h-5 bg-slate-200 mx-1" />
          <TbBtn active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()}>• List</TbBtn>
          <TbBtn active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()}>1. List</TbBtn>
          <TbBtn active={editor.isActive('blockquote')} onClick={() => editor.chain().focus().toggleBlockquote().run()}>❝</TbBtn>
          <TbBtn active={editor.isActive('code')} onClick={() => editor.chain().focus().toggleCode().run()}>{'</>'}</TbBtn>
          <span className="w-px h-5 bg-slate-200 mx-1" />
          <TbBtn active={editor.isActive('link')} onClick={setLink}>🔗</TbBtn>
          <TbBtn onClick={() => editor.chain().focus().undo().run()}>↶</TbBtn>
          <TbBtn onClick={() => editor.chain().focus().redo().run()}>↷</TbBtn>
        </div>
      </div>
      <div className="rounded-lg border border-slate-200 p-3 focus-within:border-brand-700 focus-within:ring-2 focus-within:ring-brand-700/15 transition">
        <EditorContent editor={editor} />
      </div>
      <div className="flex justify-end mt-3">
        <button
          type="button"
          onClick={onSave}
          disabled={busy}
          className="btn-primary disabled:opacity-60"
        >
          {busy ? 'Saving…' : 'Save'}
        </button>
      </div>
      <style>{`
        .tiptap-editor { outline: none; }
        .tiptap-editor h2 { font-size: 1.15rem; font-weight: 600; color: #193458; margin-top: 0.6rem; margin-bottom: 0.4rem; }
        .tiptap-editor h3 { font-size: 1.05rem; font-weight: 600; color: #1f3556; margin-top: 0.4rem; margin-bottom: 0.3rem; }
        .tiptap-editor p { margin: 0.5rem 0; }
        .tiptap-editor ul { list-style: disc; padding-left: 1.4rem; margin: 0.5rem 0; }
        .tiptap-editor ol { list-style: decimal; padding-left: 1.4rem; margin: 0.5rem 0; }
        .tiptap-editor blockquote { border-left: 3px solid #cbd5e1; padding-left: 0.8rem; color: #475569; margin: 0.6rem 0; }
        .tiptap-editor code { background: #f1f5f9; padding: 0 4px; border-radius: 3px; font-size: 0.9em; }
        .tiptap-editor a { color: #193458; text-decoration: underline; }
        .tiptap-editor p.is-editor-empty:first-child::before {
          content: attr(data-placeholder); color: #94a3b8; float: left; height: 0; pointer-events: none;
        }
      `}</style>
    </div>
  );
}

function TbBtn({ onClick, active, children }: { onClick: () => void; active?: boolean; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick}
      className={`rounded-md px-2 py-1 text-xs border transition ${
        active ? 'bg-brand-700 text-white border-brand-700' : 'bg-white text-slate-700 border-slate-200 hover:border-brand-700 hover:text-brand-700'
      }`}>
      {children}
    </button>
  );
}

// ---- Markdown ↔ HTML conversion (very lightweight) ----
// We persist sections as plain markdown-ish text. TipTap edits as HTML.
// Round-trip is intentionally minimal so we don't introduce a heavy markdown
// dependency. Bold/italic, headings (## ###), lists, and links survive.
function bodyToHtml(body: string): string {
  if (!body) return '';
  // If body already looks like HTML (starts with a tag), use as-is
  if (/^\s*</.test(body)) return body;
  // Convert lines to paragraphs and simple lists / headings
  const lines = body.split(/\r?\n/);
  const out: string[] = [];
  let inList: 'ul' | 'ol' | null = null;
  function closeList() { if (inList) { out.push(`</${inList}>`); inList = null; } }
  for (const raw of lines) {
    const line = raw;
    if (/^\s*$/.test(line)) { closeList(); continue; }
    const h3 = line.match(/^###\s+(.*)$/);
    if (h3) { closeList(); out.push(`<h3>${escapeHtml(h3[1])}</h3>`); continue; }
    const h2 = line.match(/^##\s+(.*)$/);
    if (h2) { closeList(); out.push(`<h2>${escapeHtml(h2[1])}</h2>`); continue; }
    const ol = line.match(/^\s*\d+\.\s+(.*)$/);
    if (ol) { if (inList !== 'ol') { closeList(); out.push('<ol>'); inList = 'ol'; } out.push(`<li>${escapeHtml(ol[1])}</li>`); continue; }
    const ul = line.match(/^\s*[-*]\s+(.*)$/);
    if (ul) { if (inList !== 'ul') { closeList(); out.push('<ul>'); inList = 'ul'; } out.push(`<li>${escapeHtml(ul[1])}</li>`); continue; }
    closeList();
    out.push(`<p>${escapeHtml(line)}</p>`);
  }
  closeList();
  return out.join('');
}

function htmlToBody(html: string): string {
  if (!html) return '';
  // Very light HTML → text round-trip. We mostly preserve structure: paragraphs
  // become blank-line-separated, lists become "- " / "1. " lines, headings
  // become "## " / "### ", and bold/italic just become text. Good enough for
  // search indexing and for re-loading into TipTap on next edit.
  return html
    .replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, (_, t) => `\n\n## ${stripTags(t)}\n`)
    .replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, (_, t) => `\n\n### ${stripTags(t)}\n`)
    .replace(/<ul[^>]*>([\s\S]*?)<\/ul>/gi, (_, inner) => '\n' + inner.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_: any, x: string) => `- ${stripTags(x)}\n`) + '\n')
    .replace(/<ol[^>]*>([\s\S]*?)<\/ol>/gi, (_, inner) => {
      let n = 0;
      return '\n' + inner.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_: any, x: string) => { n++; return `${n}. ${stripTags(x)}\n`; }) + '\n';
    })
    .replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, (_, t) => `\n> ${stripTags(t).replace(/\n+/g, '\n> ')}\n`)
    .replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, (_, t) => `\n${stripTags(t)}\n`)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function stripTags(s: string): string {
  return s
    .replace(/<strong[^>]*>([\s\S]*?)<\/strong>/gi, '$1')
    .replace(/<em[^>]*>([\s\S]*?)<\/em>/gi, '$1')
    .replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, '$1')
    .replace(/<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, '$2 ($1)')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .trim();
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
}
