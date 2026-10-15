import { round2 } from '../utils/geometry';
import { newId } from '../utils/id';
import { LINE_HEIGHT, type Doc, type ImageElement, type SealDesign, type SealElement, type SealInstance, type TextElement } from './types';

export const DEFAULT_SEAL_WIDTH = 30;
export const DEFAULT_SEAL_HEIGHT = 80;

export function createDesign(widthMm = DEFAULT_SEAL_WIDTH, heightMm = DEFAULT_SEAL_HEIGHT): SealDesign {
  return {
    id: newId('design'),
    widthMm,
    heightMm,
    outline: { color: '#000000', dashed: true, widthMm: 0.3 },
    background: null,
    elements: [],
  };
}

export function createInstance(designId: string, x: number, y: number, rotation = 0): SealInstance {
  return { id: newId('seal'), designId, x, y, rotation };
}

export function createText(design: SealDesign, partial: Partial<TextElement> = {}): TextElement {
  const fontSizeMm = partial.fontSizeMm ?? 6;
  return {
    id: newId('text'),
    type: 'text',
    x: design.widthMm / 2,
    y: design.heightMm / 2,
    rotation: 0,
    width: round2(design.widthMm * 0.8),
    // Room for two lines.
    height: round2(fontSizeMm * LINE_HEIGHT * 2),
    text: 'Purity',
    fontFamily: 'UnifrakturMaguntia',
    fontSizeMm,
    color: '#5a0f0f',
    bold: false,
    italic: false,
    align: 'middle',
    ...partial,
  };
}

export function createImage(
  design: SealDesign,
  assetId: string,
  naturalWidth: number,
  naturalHeight: number,
  partial: Partial<ImageElement> = {},
): ImageElement {
  // Fit inside 80% of the seal while preserving the aspect ratio.
  const aspect = naturalWidth > 0 && naturalHeight > 0 ? naturalWidth / naturalHeight : 1;
  const maxW = design.widthMm * 0.8;
  const maxH = design.heightMm * 0.8;
  let width = maxW;
  let height = width / aspect;
  if (height > maxH) {
    height = maxH;
    width = height * aspect;
  }
  return {
    id: newId('image'),
    type: 'image',
    x: design.widthMm / 2,
    y: design.heightMm / 2,
    rotation: 0,
    width,
    height,
    assetId,
    opacity: 1,
    ...partial,
  };
}

export function cloneElement<T extends SealElement>(el: T): T {
  return { ...el, id: newId(el.type) };
}

/** Deep copy of a design with fresh ids for the design and all its elements. */
export function cloneDesign(design: SealDesign): SealDesign {
  return {
    ...design,
    id: newId('design'),
    outline: { ...design.outline },
    elements: design.elements.map(cloneElement),
  };
}

export function createEmptyDoc(): Doc {
  return {
    page: { size: 'A4', orientation: 'portrait' },
    designs: {},
    instances: [],
    assets: {},
  };
}
