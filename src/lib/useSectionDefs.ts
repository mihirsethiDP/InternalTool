import { useQuery } from '@tanstack/react-query';
import { supabase } from './supabase';
import { setSectionRegistry, sectionDefs, type SectionDef } from './consolidated';

// The approval sections ARE the document types (migration 040's one-taxonomy
// rule). Loading them from the database is what makes a type added in Admin —
// "Technical Data Sheet", say — show up in the approve dropdowns and get
// offered to the AI splitter, instead of existing only on the upload form.
//
// The result also seeds the module-level registry, so the pure helpers in
// consolidated.ts (parseSections / renderSections / labels) agree with the UI.
export function useSectionDefs() {
  return useQuery({
    queryKey: ['section-defs'],
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<SectionDef[]> => {
      const { data, error } = await supabase
        .from('document_types')
        .select('key, label, sort_order')
        .eq('scope', 'general')
        .order('sort_order');
      if (error || !data?.length) return sectionDefs(); // keep the built-in nine
      const defs = data.map((t: { key: string; label: string }) => ({ key: t.key, label: t.label }));
      setSectionRegistry(defs);
      return defs;
    },
  });
}
