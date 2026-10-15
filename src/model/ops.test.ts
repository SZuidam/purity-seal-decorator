import { describe, expect, it } from 'vitest';
import { createEmptyDoc, createImage, createText } from './factory';
import * as ops from './ops';
import { parseDoc, serializeDoc } from '../store/persistence';

function docWithSeal() {
  const { doc, instanceId } = ops.addSeal(createEmptyDoc(), 10, 10, 30, 80);
  const design = ops.getDesignFor(doc, instanceId)!;
  const withText = ops.addElement(doc, design.id, createText(design, { text: 'Hail' }));
  return { doc: withText, instanceId, designId: design.id };
}

describe('paste', () => {
  it('independent paste creates a new design with new element ids', () => {
    const { doc, instanceId, designId } = docWithSeal();
    const entry = ops.snapshot(doc, instanceId)!;
    const r = ops.paste(doc, entry, false, 5);
    const pasted = ops.getInstance(r.doc, r.instanceId)!;

    expect(pasted.designId).not.toBe(designId);
    expect(pasted.x).toBe(15);
    expect(pasted.y).toBe(15);
    const original = r.doc.designs[designId];
    const copy = r.doc.designs[pasted.designId];
    expect(copy.elements).toHaveLength(1);
    expect(copy.elements[0].id).not.toBe(original.elements[0].id);
    expect(copy.elements[0]).toMatchObject({ text: 'Hail' });
  });

  it('linked paste shares the design', () => {
    const { doc, instanceId, designId } = docWithSeal();
    const r = ops.paste(doc, ops.snapshot(doc, instanceId)!, true, 5);
    expect(ops.getInstance(r.doc, r.instanceId)!.designId).toBe(designId);
    expect(ops.linkedCount(r.doc, designId)).toBe(2);
  });

  it('editing a linked design changes every linked seal', () => {
    const { doc, instanceId, designId } = docWithSeal();
    const r = ops.paste(doc, ops.snapshot(doc, instanceId)!, true, 5);
    const elId = r.doc.designs[designId].elements[0].id;
    const edited = ops.updateElement(r.doc, designId, elId, { text: 'Purged' });

    for (const id of [instanceId, r.instanceId]) {
      expect(ops.getDesignFor(edited, id)!.elements[0]).toMatchObject({ text: 'Purged' });
    }
  });

  it('linked seals keep their own position and rotation', () => {
    const { doc, instanceId } = docWithSeal();
    const r = ops.paste(doc, ops.snapshot(doc, instanceId)!, true, 5);
    const moved = ops.updateInstance(r.doc, r.instanceId, { x: 100, rotation: 45 });
    expect(ops.getInstance(moved, instanceId)).toMatchObject({ x: 10, rotation: 0 });
    expect(ops.getInstance(moved, r.instanceId)).toMatchObject({ x: 100, rotation: 45 });
  });

  it('linked paste restores the design if the source was deleted', () => {
    const { doc, instanceId, designId } = docWithSeal();
    const entry = ops.snapshot(doc, instanceId)!;
    const emptied = ops.deleteInstance(doc, instanceId);
    expect(emptied.designs[designId]).toBeUndefined();
    const r = ops.paste(emptied, entry, true, 5);
    expect(r.doc.designs[designId].elements).toHaveLength(1);
  });
});

describe('unlink', () => {
  it('isolates the instance from the rest of its group', () => {
    const { doc, instanceId, designId } = docWithSeal();
    const r = ops.paste(doc, ops.snapshot(doc, instanceId)!, true, 5);
    const unlinked = ops.unlink(r.doc, r.instanceId);
    const newDesignId = ops.getInstance(unlinked, r.instanceId)!.designId;
    expect(newDesignId).not.toBe(designId);

    const elId = unlinked.designs[designId].elements[0].id;
    const edited = ops.updateElement(unlinked, designId, elId, { text: 'Changed' });
    expect(ops.getDesignFor(edited, r.instanceId)!.elements[0]).toMatchObject({ text: 'Hail' });
  });

  it('is a no-op for a seal that is not linked', () => {
    const { doc, instanceId } = docWithSeal();
    expect(ops.unlink(doc, instanceId)).toBe(doc);
  });
});

describe('delete and assets', () => {
  it('keeps a shared design while another instance uses it', () => {
    const { doc, instanceId, designId } = docWithSeal();
    const r = ops.paste(doc, ops.snapshot(doc, instanceId)!, true, 5);
    const after = ops.deleteInstance(r.doc, instanceId);
    expect(after.designs[designId]).toBeDefined();
  });

  it('dedupes identical images and drops unused ones', () => {
    const { doc, designId } = docWithSeal();
    const a = ops.addAsset(doc, 'data:image/png;base64,AAA', 10, 20);
    const b = ops.addAsset(a.doc, 'data:image/png;base64,AAA', 10, 20);
    expect(b.assetId).toBe(a.assetId);
    expect(Object.keys(b.doc.assets)).toHaveLength(1);

    const img = createImage(b.doc.designs[designId], a.assetId, 10, 20);
    const withImg = ops.addElement(b.doc, designId, img);
    const removed = ops.removeElement(withImg, designId, img.id);
    expect(Object.keys(removed.assets)).toHaveLength(0);
  });
});

describe('createImage', () => {
  it('fits the image inside the seal preserving aspect ratio', () => {
    const { doc, designId } = docWithSeal();
    const img = createImage(doc.designs[designId], 'a', 1000, 500);
    expect(img.width).toBeCloseTo(24);
    expect(img.height).toBeCloseTo(12);
  });
});

describe('JSON export/import', () => {
  it('round-trips the document', () => {
    const { doc, instanceId } = docWithSeal();
    const a = ops.addAsset(doc, 'data:image/png;base64,AAA', 10, 20);
    const r = ops.paste(a.doc, ops.snapshot(a.doc, instanceId)!, true, 5);
    expect(parseDoc(serializeDoc(r.doc))).toEqual(r.doc);
  });

  it('migrates v1 text elements to a seal-sized text box', () => {
    const { doc, designId } = docWithSeal();
    const v1 = JSON.parse(serializeDoc(doc));
    v1.version = 1;
    delete v1.designs[designId].elements[0].width;
    delete v1.designs[designId].elements[0].height;
    const migrated = parseDoc(JSON.stringify(v1));
    expect(migrated.designs[designId].elements[0]).toMatchObject({ width: 30, height: 80 });
  });

  it('rejects unknown versions and broken references', () => {
    expect(() => parseDoc('{"version":99}')).toThrow(/version/);
    expect(() => parseDoc('not json')).toThrow(/JSON/);
    const bad = { version: 2, page: {}, designs: {}, assets: {}, instances: [{ id: 's', designId: 'missing' }] };
    expect(() => parseDoc(JSON.stringify(bad))).toThrow(/missing design/);
  });
});
