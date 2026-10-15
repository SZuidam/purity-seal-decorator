import '@fontsource/unifrakturmaguntia/400.css';
import '@fontsource/pirata-one/400.css';
import '@fontsource/grenze-gotisch/400.css';
import '@fontsource/grenze-gotisch/700.css';
import '@fontsource/im-fell-english/400.css';
import '@fontsource/im-fell-english/400-italic.css';
import '@fontsource/cinzel/400.css';
import '@fontsource/cinzel/700.css';

export interface FontOption {
  family: string;
  label: string;
  fallback: string;
}

export const FONTS: FontOption[] = [
  { family: 'UnifrakturMaguntia', label: 'UnifrakturMaguntia (blackletter)', fallback: 'serif' },
  { family: 'Grenze Gotisch', label: 'Grenze Gotisch (gothic)', fallback: 'serif' },
  { family: 'Pirata One', label: 'Pirata One (gothic)', fallback: 'serif' },
  { family: 'IM Fell English', label: 'IM Fell English (old print)', fallback: 'serif' },
  { family: 'Cinzel', label: 'Cinzel (imperial capitals)', fallback: 'serif' },
  { family: 'Georgia', label: 'Georgia (system)', fallback: 'serif' },
  { family: 'Times New Roman', label: 'Times New Roman (system)', fallback: 'serif' },
  { family: 'serif', label: 'Serif (system)', fallback: 'serif' },
  { family: 'sans-serif', label: 'Sans-serif (system)', fallback: 'sans-serif' },
];

const GENERIC = new Set(['serif', 'sans-serif', 'monospace', 'cursive', 'fantasy']);

export function fontStack(family: string): string {
  if (GENERIC.has(family)) return family;
  const fallback = FONTS.find((f) => f.family === family)?.fallback ?? 'serif';
  return `'${family}', ${fallback}`;
}

/** Make sure every bundled font face is loaded (fonts load lazily on first use). */
export async function loadAllFonts() {
  if (!document.fonts) return;
  await Promise.all(
    FONTS.filter((f) => !GENERIC.has(f.family)).flatMap((f) => [
      document.fonts.load(`16px '${f.family}'`),
      document.fonts.load(`bold 16px '${f.family}'`),
      document.fonts.load(`italic 16px '${f.family}'`),
    ]),
  ).catch(() => undefined);
  await document.fonts.ready;
}
