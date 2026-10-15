// All lengths are millimetres, all angles are degrees.

export type TextAlign = 'start' | 'middle' | 'end';

export interface TextElement {
  id: string;
  type: 'text';
  /** Centre of the element, relative to the seal's top-left corner. */
  x: number;
  y: number;
  rotation: number;
  text: string;
  fontFamily: string;
  fontSizeMm: number;
  color: string;
  bold: boolean;
  italic: boolean;
  align: TextAlign;
}

export interface ImageElement {
  id: string;
  type: 'image';
  /** Centre of the element, relative to the seal's top-left corner. */
  x: number;
  y: number;
  rotation: number;
  width: number;
  height: number;
  assetId: string;
  opacity: number;
}

export type SealElement = TextElement | ImageElement;

export interface SealOutline {
  color: string;
  dashed: boolean;
  widthMm: number;
}

export interface SealDesign {
  id: string;
  widthMm: number;
  heightMm: number;
  outline: SealOutline;
  background: string | null;
  elements: SealElement[];
}

export interface SealInstance {
  id: string;
  designId: string;
  /** Top-left corner on the page (before rotation, which is about the seal centre). */
  x: number;
  y: number;
  rotation: number;
}

export type PageSize = 'A4' | 'Letter';
export type Orientation = 'portrait' | 'landscape';

export interface PageSettings {
  size: PageSize;
  orientation: Orientation;
}

export interface Asset {
  dataUrl: string;
  /** Natural pixel size, used for the initial aspect ratio. */
  width: number;
  height: number;
}

export interface Doc {
  page: PageSettings;
  designs: Record<string, SealDesign>;
  instances: SealInstance[];
  assets: Record<string, Asset>;
}

export const DOC_VERSION = 1;

export interface DocFile extends Doc {
  version: typeof DOC_VERSION;
}

export const PAGE_DIMENSIONS: Record<PageSize, { width: number; height: number }> = {
  A4: { width: 210, height: 297 },
  Letter: { width: 215.9, height: 279.4 },
};

export function pageDimensions(page: PageSettings) {
  const d = PAGE_DIMENSIONS[page.size];
  return page.orientation === 'portrait' ? d : { width: d.height, height: d.width };
}
