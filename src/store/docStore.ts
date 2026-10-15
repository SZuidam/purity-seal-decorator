import { create } from 'zustand';
import { temporal } from 'zundo';
import { createEmptyDoc } from '../model/factory';
import * as ops from '../model/ops';
import type { ClipboardEntry } from '../model/ops';
import type { Doc, PageSettings, SealDesign, SealElement, SealInstance } from '../model/types';

interface DocState {
  doc: Doc;
  setPage: (patch: Partial<PageSettings>) => void;
  addSeal: (x: number, y: number, widthMm?: number, heightMm?: number) => string;
  updateInstance: (id: string, patch: Partial<Omit<SealInstance, 'id' | 'designId'>>) => void;
  updateDesign: (designId: string, patch: Partial<Omit<SealDesign, 'id' | 'elements'>>) => void;
  addElement: (designId: string, el: SealElement) => void;
  updateElement: (designId: string, elementId: string, patch: Partial<SealElement>) => void;
  removeElement: (designId: string, elementId: string) => void;
  reorderElement: (designId: string, elementId: string, delta: number) => void;
  addAsset: (dataUrl: string, width: number, height: number) => string;
  deleteInstance: (id: string) => void;
  paste: (entry: ClipboardEntry, linked: boolean, offset: number) => string;
  unlink: (id: string) => void;
  bringToFront: (id: string) => void;
  replaceDoc: (doc: Doc) => void;
}

export const useDocStore = create<DocState>()(
  temporal(
    (set, get) => {
      const apply = (fn: (doc: Doc) => Doc) => set({ doc: fn(get().doc) });
      return {
        doc: createEmptyDoc(),
        setPage: (patch) => apply((d) => ({ ...d, page: { ...d.page, ...patch } })),
        addSeal: (x, y, w, h) => {
          const r = ops.addSeal(get().doc, x, y, w, h);
          set({ doc: r.doc });
          return r.instanceId;
        },
        updateInstance: (id, patch) => apply((d) => ops.updateInstance(d, id, patch)),
        updateDesign: (designId, patch) => apply((d) => ops.updateDesign(d, designId, patch)),
        addElement: (designId, el) => apply((d) => ops.addElement(d, designId, el)),
        updateElement: (designId, elementId, patch) => apply((d) => ops.updateElement(d, designId, elementId, patch)),
        removeElement: (designId, elementId) => apply((d) => ops.removeElement(d, designId, elementId)),
        reorderElement: (designId, elementId, delta) => apply((d) => ops.reorderElement(d, designId, elementId, delta)),
        addAsset: (dataUrl, width, height) => {
          const r = ops.addAsset(get().doc, dataUrl, width, height);
          if (r.doc !== get().doc) set({ doc: r.doc });
          return r.assetId;
        },
        deleteInstance: (id) => apply((d) => ops.deleteInstance(d, id)),
        paste: (entry, linked, offset) => {
          const r = ops.paste(get().doc, entry, linked, offset);
          set({ doc: r.doc });
          return r.instanceId;
        },
        unlink: (id) => apply((d) => ops.unlink(d, id)),
        bringToFront: (id) => apply((d) => ops.bringToFront(d, id)),
        replaceDoc: (doc) => set({ doc }),
      };
    },
    {
      partialize: (s) => ({ doc: s.doc }),
      equality: (a, b) => a.doc === b.doc,
      limit: 200,
    },
  ),
);

export const undo = () => useDocStore.temporal.getState().undo();
export const redo = () => useDocStore.temporal.getState().redo();

/**
 * Group a continuous interaction (drag, rotate, resize) into one undo step:
 * the first change is recorded normally, then history is paused until `end`.
 */
export function beginGesture() {
  let started = false;
  return {
    step(fn: () => void) {
      fn();
      if (!started) {
        started = true;
        useDocStore.temporal.getState().pause();
      }
    },
    end() {
      if (started) useDocStore.temporal.getState().resume();
    },
  };
}
