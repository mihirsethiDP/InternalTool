import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Globe, Mail, Building2, Camera, Search, BadgeCheck } from 'lucide-react';
import PageHeader from '../components/PageHeader';

/**
 * Step-by-step playbook for completing a sensor's documentation when
 * the documentation status checklist shows gaps.
 */
const STEPS = [
  {
    icon: <Globe size={18} strokeWidth={2} />,
    title: 'Check the OEM website',
    body: 'Search the manufacturer’s site for the exact model number (downloads / support / resources section). Most vendors publish datasheets and manuals publicly. Save the PDF and submit it through the Upload button with the right category.',
    tip: 'Search Google with: site:vendor.com "MODEL-NUMBER" filetype:pdf',
  },
  {
    icon: <Mail size={18} strokeWidth={2} />,
    title: 'Email the vendor / distributor',
    body: 'If the website doesn’t have it, email the vendor’s support or the distributor we bought from. Ask specifically for the missing categories — e.g. "calibration procedure and spares list for UPCS-MAG-110". Attach a photo of the sensor nameplate so they match the exact variant.',
    tip: 'Template: "We operate your [MODEL] at our wastewater treatment plants. Please share the [missing docs] for this model. Serial number: [from nameplate]."',
  },
  {
    icon: <Building2 size={18} strokeWidth={2} />,
    title: 'Ask the projects / procurement team',
    body: 'Documentation is usually handed over at purchase. Check with whoever raised the PO — the original quotation packet often includes datasheets, manuals, and test certificates that never made it out of email attachments.',
    tip: 'Search the procurement mailbox for the PO number or vendor name.',
  },
  {
    icon: <Camera size={18} strokeWidth={2} />,
    title: 'Capture what exists on site',
    body: 'Field engineers: photograph the sensor nameplate (make, model, serial, ratings) and scan any paper manual kept in the plant control room. Phone scans are fine — upload them as images or a PDF; an admin will clean up the extracted text during review.',
    tip: 'A nameplate photo alone is valuable — it pins down the exact variant for vendor requests.',
  },
  {
    icon: <Search size={18} strokeWidth={2} />,
    title: 'Compile from public sources',
    body: 'When the OEM has nothing (common for smaller Indian makes), compile troubleshooting steps from reputable public sources for the same sensor type, adapted to our operating conditions. Submit it as a Troubleshooting document — clearly noting sources — and let an admin review.',
    tip: 'The admin should verify against the vendor before approving anything safety-related.',
  },
  {
    icon: <BadgeCheck size={18} strokeWidth={2} />,
    title: 'Get it verified and approved',
    body: 'Everything you gather goes through the normal review flow: upload → admin checks accuracy and duplicates → approve into the sensor’s reference. Once all checklist categories are covered, the sensor’s documentation status turns complete.',
    tip: 'Prioritise Troubleshooting, Manual, and Calibration — these are what operators need on site.',
  },
];

export default function DocsGuide() {
  const nav = useNavigate();
  return (
    <div className="space-y-6 max-w-3xl">
      <PageHeader
        eyebrow="Playbook"
        title="Completing sensor documentation"
        subtitle="Follow these steps, in order, whenever a sensor's documentation status shows gaps."
        action={
          <button onClick={() => nav(-1)} className="inline-flex items-center gap-1.5 bg-white text-brand-700 hover:bg-slate-100 rounded-md px-3 py-2 text-sm transition">
            <ArrowLeft size={15} /> Back
          </button>
        }
      />

      <ol className="space-y-3">
        {STEPS.map((s, i) => (
          <li key={i} className="bg-white rounded-xl border border-slate-200 p-5 flex gap-4">
            <div className="shrink-0 flex flex-col items-center">
              <span className="bg-brand-700 text-white rounded-lg w-9 h-9 flex items-center justify-center">{s.icon}</span>
              <span className="text-[11px] font-semibold text-slate-400 mt-1.5">Step {i + 1}</span>
            </div>
            <div className="min-w-0">
              <h2 className="font-semibold text-slate-900">{s.title}</h2>
              <p className="text-sm text-slate-600 leading-relaxed mt-1">{s.body}</p>
              <div className="mt-2.5 text-xs bg-brand-50 text-brand-900 border-l-2 border-brand-700 rounded-r-md px-3 py-2">
                {s.tip}
              </div>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
