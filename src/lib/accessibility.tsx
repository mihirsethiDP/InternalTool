import { createContext, useContext, useEffect, useState } from 'react';

// App-wide accessibility preferences: text scaling and a high-contrast mode.
// Persisted to localStorage and applied as data attributes on <html>, so the
// global CSS in index.css can react (text scale = root font-size; high contrast
// = darker text / stronger borders). Useful for technicians reading in bright
// field conditions on a phone.

export type TextScale = 'normal' | 'large' | 'xlarge';

interface A11yState {
  textScale: TextScale;
  highContrast: boolean;
  setTextScale: (s: TextScale) => void;
  incScale: () => void;
  decScale: () => void;
  toggleContrast: () => void;
}

const SCALES: TextScale[] = ['normal', 'large', 'xlarge'];
const KEY = 'dp.a11y';

const A11yContext = createContext<A11yState | null>(null);

function load(): { textScale: TextScale; highContrast: boolean } {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw);
      return {
        textScale: SCALES.includes(p.textScale) ? p.textScale : 'normal',
        highContrast: Boolean(p.highContrast),
      };
    }
  } catch { /* ignore */ }
  return { textScale: 'normal', highContrast: false };
}

export function AccessibilityProvider({ children }: { children: React.ReactNode }) {
  const initial = load();
  const [textScale, setTextScale] = useState<TextScale>(initial.textScale);
  const [highContrast, setHighContrast] = useState<boolean>(initial.highContrast);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.textScale = textScale;
    root.dataset.contrast = highContrast ? 'high' : 'normal';
    try {
      localStorage.setItem(KEY, JSON.stringify({ textScale, highContrast }));
    } catch { /* ignore */ }
  }, [textScale, highContrast]);

  const incScale = () => setTextScale((s) => SCALES[Math.min(SCALES.length - 1, SCALES.indexOf(s) + 1)]);
  const decScale = () => setTextScale((s) => SCALES[Math.max(0, SCALES.indexOf(s) - 1)]);
  const toggleContrast = () => setHighContrast((v) => !v);

  return (
    <A11yContext.Provider value={{ textScale, highContrast, setTextScale, incScale, decScale, toggleContrast }}>
      {children}
    </A11yContext.Provider>
  );
}

export function useA11y(): A11yState {
  const ctx = useContext(A11yContext);
  if (!ctx) throw new Error('useA11y must be used within AccessibilityProvider');
  return ctx;
}
