import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

/**
 * Privacy notice for the internal tool. TEMPLATE — the bracketed
 * placeholders and the policy itself should be reviewed by DigitalPaani's
 * legal / compliance owner before being relied upon.
 */
export default function Privacy() {
  const nav = useNavigate();
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-3xl mx-auto px-5 py-10">
        <button onClick={() => nav(-1)} className="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-brand-700 mb-6">
          <ArrowLeft size={15} /> Back
        </button>

        <div className="bg-white rounded-2xl border border-slate-200 p-8 prose-policy">
          <div className="text-xs uppercase tracking-wider text-brand-700 font-semibold mb-2">DigitalPaani</div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Privacy Notice — Sensor Troubleshooting Tool</h1>
          <p className="text-sm text-slate-500 mt-1">Last updated: 16 June 2026 · Applies to the internal Sensor Troubleshooting Hub</p>

          <Section title="1. Who this applies to">
            This tool is an internal application of <strong>Digital Ecoinnovision Pvt. Ltd.</strong> (“DigitalPaani”,
            “we”, “us”), available only to authorised employees and personnel. It is not a public or customer-facing
            service.
          </Section>

          <Section title="2. Information we collect">
            <ul>
              <li><strong>Account information</strong> — your work email, display name (if you set one), and assigned role (viewer, uploader, admin).</li>
              <li><strong>Authentication metadata</strong> — sign-in events handled by our authentication provider.</li>
              <li><strong>Content you submit</strong> — documents you upload, their metadata, and any edits you make.</li>
              <li><strong>Usage information</strong> — searches and assistant questions you enter, feedback you give on answers (e.g. “solved” / “didn’t help”), and which documents you open.</li>
              <li><strong>Technical information</strong> — basic session and device/browser data needed to operate the tool.</li>
            </ul>
          </Section>

          <Section title="3. Why we use it">
            <ul>
              <li>To provide and secure the tool and route document submissions for review.</li>
              <li>To measure how useful answers are (e.g. solve rate) and identify documentation gaps so we can improve coverage.</li>
              <li>To maintain a history of changes to documentation for accuracy and accountability.</li>
            </ul>
            We do <strong>not</strong> sell your personal data or use it for advertising.
          </Section>

          <Section title="4. Who can see it">
            Access is controlled by role. Administrators and uploaders may see document submissions, feedback, and
            query data relevant to maintaining the library. Your individual feedback and searches are visible to
            administrators in aggregate and for quality improvement.
          </Section>

          <Section title="5. Where it is stored">
            Data is stored using our backend provider (Supabase) and the application is served via static hosting
            (GitHub Pages). These providers process data on our behalf under their respective terms. Uploaded files
            are kept in private storage and accessed only through short-lived, signed links.
          </Section>

          <Section title="6. Retention">
            <ul>
              <li><strong>Account data</strong> (email, name, role) is retained while you remain an authorised user and removed when your access ends.</li>
              <li><strong>Feedback and search activity</strong> linked to you are retained for up to <strong>12 months</strong>, after which they are anonymised (the link to you is removed while aggregate, non-identifying statistics may be kept).</li>
              <li><strong>Documents and library content</strong> are retained as business records for as long as they remain useful to the tool.</li>
            </ul>
          </Section>

          <Section title="7. Security">
            Access is authenticated and enforced at the database level (row-level security). Files are private and
            retrieved only via expiring links. No system is perfectly secure, but we apply reasonable safeguards.
          </Section>

          <Section title="8. Your rights">
            Subject to applicable law (including India’s Digital Personal Data Protection Act, 2023), you may request
            access to, correction of, or erasure of your personal data, and may raise a grievance. To do so, contact
            our Grievance Officer, <strong>Mansi Jain (mansi.jain@digitalpaani.com)</strong>.
          </Section>

          <Section title="9. Changes">
            We may update this notice. Material changes will be reflected by the “Last updated” date above.
          </Section>

          <Section title="10. Contact">
            Questions about this notice or your data: <strong>support@digitalpaani.com</strong>.
          </Section>

          <p className="text-xs text-slate-400 mt-8 border-t border-slate-100 pt-4">
            This notice is provided for internal use and should be reviewed by DigitalPaani’s legal/compliance owner
            before being treated as final.
          </p>
        </div>
      </div>

      <style>{`
        .prose-policy h2 { font-size: 1rem; font-weight: 600; color: #193458; margin-top: 1.5rem; margin-bottom: 0.4rem; }
        .prose-policy p, .prose-policy li { color: #334155; font-size: 0.925rem; line-height: 1.65; }
        .prose-policy ul { list-style: disc; padding-left: 1.4rem; margin: 0.3rem 0; }
        .prose-policy li { margin: 0.2rem 0; }
        .prose-policy strong { color: #0f2747; }
      `}</style>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2>{title}</h2>
      <div>{children}</div>
    </div>
  );
}
