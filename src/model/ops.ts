// Pure, immutable operations on a Doc. The store wraps these; tests exercise them directly.
import { cloneDesign, createDesign, createInstance } from './factory';
import type { Doc, SealDesign, SealElement, SealInstance } from './types';
import { newId } from '../utils/id';

export interface ClipboardEntry {
  design: SealDesign;
  instance: SealInstance;
}

export function getInstance(doc: Doc, instanceId: string): SealInstance | undefined {
  return doc.instances.find((i) => i.id === instanceId);
}

export function getDesignFor(doc: Doc, instanceId: string): SealDesign | undefined {
  const inst = getInstance(doc, instanceId);
  return inst ? doc.designs[inst.designId] : undefined;
}

export function linkedCount(doc: Doc, designId: string): number {
  return doc.instances.filter((i) => i.designId === designId).length;
}

export function addSeal(doc: Doc, x: number, y: number, widthMm?: number, heightMm?: number) {
  const design = createDesign(widthMm, heightMm);
  const instance = createInstance(design.id, x, y);
  return {
    doc: { ...doc, designs: { ...doc.designs, [design.id]: design }, instances: [...doc.instances, instance] },
    instanceId: instance.id,
  };
}

export function updateInstance(doc: Doc, instanceId: string, patch: Partial<Omit<SealInstance, 'id' | 'designId'>>): Doc {
  return {
    ...doc,
    instances: doc.instances.map((i) => (i.id === instanceId ? { ...i, ...patch } : i)),
  };
}

export function updateDesign(doc: Doc, designId: string, patch: Partial<Omit<SealDesign, 'id' | 'elements'>>): Doc {
  const design = doc.designs[designId];
  if (!design) return doc;
  return { ...doc, designs: { ...doc.designs, [designId]: { ...design, ...patch } } };
}

function mapElements(doc: Doc, designId: string, fn: (els: SealElement[]) => SealElement[]): Doc {
  const design = doc.designs[designId];
  if (!design) return doc;
  return { ...doc, designs: { ...doc.designs, [designId]: { ...design, elements: fn(design.elements) } } };
}

export function addElement(doc: Doc, designId: string, el: SealElement): Doc {
  return mapElements(doc, designId, (els) => [...els, el]);
}

export function updateElement(doc: Doc, designId: string, elementId: string, patch: Partial<SealElement>): Doc {
  const next = mapElements(doc, designId, (els) =>
    els.map((e) => (e.id === elementId ? ({ ...e, ...patch } as SealElement) : e)),
  );
  // Replacing an image may orphan the previous asset.
  return 'assetId' in patch ? gcAssets(next) : next;
}

export function removeElement(doc: Doc, designId: string, elementId: string): Doc {
  return gcAssets(mapElements(doc, designId, (els) => els.filter((e) => e.id !== elementId)));
}

/** Move an element within the stacking order. `delta` > 0 brings it forward. */
export function reorderElement(doc: Doc, designId: string, elementId: string, delta: number): Doc {
  return mapElements(doc, designId, (els) => {
    const idx = els.findIndex((e) => e.id === elementId);
    if (idx < 0) return els;
    const target = Math.max(0, Math.min(els.length - 1, idx + delta));
    const copy = [...els];
    const [el] = copy.splice(idx, 1);
    copy.splice(target, 0, el);
    return copy;
  });
}

/** Store an image, reusing an existing asset when the same data is already present. */
export function addAsset(doc: Doc, dataUrl: string, width: number, height: number) {
  for (const [id, a] of Object.entries(doc.assets)) {
    if (a.dataUrl === dataUrl) return { doc, assetId: id };
  }
  const assetId = newId('asset');
  return { doc: { ...doc, assets: { ...doc.assets, [assetId]: { dataUrl, width, height } } }, assetId };
}

/** Drop assets no element references any more. */
export function gcAssets(doc: Doc): Doc {
  const used = new Set<string>();
  for (const d of Object.values(doc.designs)) {
    for (const e of d.elements) if (e.type === 'image') used.add(e.assetId);
  }
  const ids = Object.keys(doc.assets);
  if (ids.every((id) => used.has(id))) return doc;
  const assets: Doc['assets'] = {};
  for (const id of ids) if (used.has(id)) assets[id] = doc.assets[id];
  return { ...doc, assets };
}

/** Drop designs no instance references any more. */
function gcDesigns(doc: Doc): Doc {
  const used = new Set(doc.instances.map((i) => i.designId));
  const designs: Doc['designs'] = {};
  for (const [id, d] of Object.entries(doc.designs)) if (used.has(id)) designs[id] = d;
  return gcAssets({ ...doc, designs });
}

export function deleteInstance(doc: Doc, instanceId: string): Doc {
  return gcDesigns({ ...doc, instances: doc.instances.filter((i) => i.id !== instanceId) });
}

export function snapshot(doc: Doc, instanceId: string): ClipboardEntry | null {
  const instance = getInstance(doc, instanceId);
  if (!instance) return null;
  const design = doc.designs[instance.designId];
  if (!design) return null;
  return { design: structuredClone(design), instance: { ...instance } };
}

/**
 * Paste a clipboard entry.
 * - independent: a deep clone of the design with new ids.
 * - linked: shares the source design. If the source design was deleted meanwhile,
 *   it is restored from the clipboard snapshot so the link group continues.
 */
export function paste(doc: Doc, entry: ClipboardEntry, linked: boolean, offset: number) {
  let designs = doc.designs;
  let designId: string;
  if (linked) {
    designId = entry.design.id;
    if (!designs[designId]) designs = { ...designs, [designId]: structuredClone(entry.design) };
  } else {
    // Prefer the live design so edits made after copying are included.
    const source = designs[entry.design.id] ?? entry.design;
    const clone = cloneDesign(source);
    designId = clone.id;
    designs = { ...designs, [designId]: clone };
  }
  const instance = createInstance(designId, entry.instance.x + offset, entry.instance.y + offset, entry.instance.rotation);
  return { doc: { ...doc, designs, instances: [...doc.instances, instance] }, instanceId: instance.id };
}

/** Give an instance its own private copy of its design. No-op if it isn't linked. */
export function unlink(doc: Doc, instanceId: string): Doc {
  const inst = getInstance(doc, instanceId);
  if (!inst || linkedCount(doc, inst.designId) < 2) return doc;
  const clone = cloneDesign(doc.designs[inst.designId]);
  return {
    ...doc,
    designs: { ...doc.designs, [clone.id]: clone },
    instances: doc.instances.map((i) => (i.id === instanceId ? { ...i, designId: clone.id } : i)),
  };
}

/** Move an instance to the top of the page stacking order. */
export function bringToFront(doc: Doc, instanceId: string): Doc {
  const inst = getInstance(doc, instanceId);
  if (!inst || doc.instances[doc.instances.length - 1].id === instanceId) return doc;
  return { ...doc, instances: [...doc.instances.filter((i) => i.id !== instanceId), inst] };
}
