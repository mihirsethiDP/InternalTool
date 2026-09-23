// <option>s for a category <select>, grouped by domain. Every category picker
// in the app (Browse, Devices, Upload, Add device) renders through this so a
// UPS never sits alphabetically between "Turbidity" and "VFD".
export interface CategoryLike { id: string; name: string; domain?: string | null }

export default function CategoryOptions({ categories }: { categories: CategoryLike[] | undefined }) {
  const list = categories ?? [];
  const sensors = list.filter((c) => c.domain !== 'electronics');
  const electronics = list.filter((c) => c.domain === 'electronics');
  if (electronics.length === 0) return <>{sensors.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</>;
  return (
    <>
      <optgroup label="Sensors">{sensors.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</optgroup>
      <optgroup label="Electronics">{electronics.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</optgroup>
    </>
  );
}
