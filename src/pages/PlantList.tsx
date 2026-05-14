import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';

export default function PlantList() {
  const { data, isLoading } = useQuery({
    queryKey: ['plant-list'],
    queryFn: async () => (await supabase.from('plants').select('*').order('name')).data ?? [],
  });
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Plants</h1>
      {isLoading && <div className="text-slate-500">Loading…</div>}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {(data ?? []).map((p: any) => (
          <Link to={`/plants/${p.id}`} key={p.id} className="card hover:shadow-md">
            <div className="flex items-start gap-3">
              <span className="text-2xl">🏭</span>
              <div>
                <div className="font-semibold">{p.name}</div>
                <div className="text-xs text-slate-500">{p.location || '—'}</div>
              </div>
            </div>
          </Link>
        ))}
        {(data ?? []).length === 0 && !isLoading && (
          <div className="card text-sm text-slate-500 col-span-full">
            No plants yet. Ask an admin to add plants from the Admin page.
          </div>
        )}
      </div>
    </div>
  );
}
