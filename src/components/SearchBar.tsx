import { useState } from 'react';

interface Props {
  initial?: string;
  onSubmit: (q: string) => void;
  placeholder?: string;
}
export default function SearchBar({ initial = '', onSubmit, placeholder }: Props) {
  const [q, setQ] = useState(initial);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(q.trim());
      }}
      className="flex gap-2"
    >
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={placeholder || 'Search documents, sensors, plants…'}
        className="input flex-1"
      />
      <button className="btn-primary px-5">Search</button>
    </form>
  );
}

export const EXAMPLE_QUERIES = [
  'Warranty certificate Plant Aurangabad',
  'Brotek UT-116 manual',
  'troubleshooting steps Brotek UT-116',
  'All level transmitters Plant Aurangabad',
  'I/O list Plant XYZ',
  'DO sensor calibration',
];
