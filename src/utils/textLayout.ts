// SVG <text> doesn't wrap, so text boxes are laid out into lines here.
import { LINE_HEIGHT, type TextElement } from '../model/types';
import { fontStack } from '../ui/fonts';

/** Returns the advance width of `text` in the same units as the font size. */
export type Measure = (text: string) => number;

/**
 * Greedy word wrap. Explicit newlines always break; a word wider than the box
 * is broken between characters so nothing sticks out sideways.
 */
export function wrapText(text: string, maxWidth: number, measure: Measure): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split('\n')) {
    const words = paragraph.split(/ +/).filter((w, _, all) => w !== '' || all.length === 1);
    let line = '';
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (measure(candidate) <= maxWidth) {
        line = candidate;
        continue;
      }
      if (line) lines.push(line);
      line = '';
      if (measure(word) <= maxWidth) {
        line = word;
        continue;
      }
      // Break an over-long word into box-wide chunks (always at least one character).
      let chunk = '';
      for (const ch of word) {
        if (chunk && measure(chunk + ch) > maxWidth) {
          lines.push(chunk);
          chunk = ch;
        } else {
          chunk += ch;
        }
      }
      line = chunk;
    }
    lines.push(line);
  }
  return lines;
}

const MEASURE_SIZE_PX = 100;
let ctx: CanvasRenderingContext2D | null | undefined;

function canvasMeasure(el: Pick<TextElement, 'fontFamily' | 'fontSizeMm' | 'bold' | 'italic'>): Measure {
  if (ctx === undefined) ctx = document.createElement('canvas').getContext('2d');
  const context = ctx;
  if (!context) return (t) => t.length * el.fontSizeMm * 0.5;
  const font = `${el.italic ? 'italic ' : ''}${el.bold ? 'bold ' : ''}${MEASURE_SIZE_PX}px ${fontStack(el.fontFamily)}`;
  const scale = el.fontSizeMm / MEASURE_SIZE_PX;
  return (t) => {
    context.font = font;
    return context.measureText(t).width * scale;
  };
}

export interface TextLayout {
  lines: string[];
  lineHeight: number;
  /** True when the wrapped lines are taller than the box. */
  overflows: boolean;
}

/** Wrap a text element into its box using the browser's font metrics. */
export function layoutText(el: TextElement): TextLayout {
  const lines = wrapText(el.text, el.width, canvasMeasure(el));
  const lineHeight = el.fontSizeMm * LINE_HEIGHT;
  return { lines, lineHeight, overflows: lines.length * lineHeight > el.height + 1e-6 };
}
