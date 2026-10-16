import { create } from 'zustand';
import type { ClipboardEntry } from '../model/ops';

export const PASTE_OFFSET_MM = 5;

const SPLIT_KEY = 'psd.inspectorSplit';
export const SPLIT_MIN = 0.15;
export const SPLIT_MAX = 0.85;

const clampSplit = (v: number) => Math.min(SPLIT_MAX, Math.max(SPLIT_MIN, v));

function loadSplit(): number {
  try {
    const v = parseFloat(localStorage.getItem(SPLIT_KEY) ?? '');
    return Number.isFinite(v) ? clampSplit(v) : 0.5;
  } catch {
    return 0.5;
  }
}

interface Clipboard {
  entry: ClipboardEntry;
  /** Whether Left Shift was held while copying. */
  linked: boolean;
  /** Number of pastes since the copy, used to cascade the offset. */
  pasteCount: number;
}

interface UiState {
  selectedInstanceId: string | null;
  /** Instance whose content is being edited (seal edit mode). */
  editingInstanceId: string | null;
  selectedElementId: string | null;
  zoom: number | 'fit';
  clipboard: Clipboard | null;
  /** Text element whose content box should grab focus once shown (set when text is added). */
  focusTextId: string | null;
  /** Fraction of the inspector height given to the seal pane (view preference, persisted per browser). */
  inspectorSplit: number;
  setInspectorSplit: (v: number) => void;
  setFocusText: (id: string | null) => void;
  selectInstance: (id: string | null) => void;
  enterEdit: (instanceId: string) => void;
  exitEdit: () => void;
  selectElement: (id: string | null) => void;
  setZoom: (z: number | 'fit') => void;
  setClipboard: (entry: ClipboardEntry, linked: boolean) => void;
  /** Returns the offset for the next paste and bumps the cascade counter. */
  nextPasteOffset: () => number;
  clearSelection: () => void;
}

export const useUiStore = create<UiState>()((set, get) => ({
  selectedInstanceId: null,
  editingInstanceId: null,
  selectedElementId: null,
  zoom: 'fit',
  clipboard: null,
  focusTextId: null,
  inspectorSplit: loadSplit(),
  setInspectorSplit: (v) => {
    const inspectorSplit = clampSplit(v);
    set({ inspectorSplit });
    try {
      localStorage.setItem(SPLIT_KEY, String(inspectorSplit));
    } catch {
      // Storage unavailable (private mode etc.); keep the in-memory value.
    }
  },
  setFocusText: (focusTextId) => set({ focusTextId }),
  selectInstance: (id) =>
    set((s) => ({
      selectedInstanceId: id,
      editingInstanceId: s.editingInstanceId === id ? s.editingInstanceId : null,
      selectedElementId: s.editingInstanceId === id ? s.selectedElementId : null,
    })),
  enterEdit: (instanceId) => set({ selectedInstanceId: instanceId, editingInstanceId: instanceId, selectedElementId: null }),
  exitEdit: () => set({ editingInstanceId: null, selectedElementId: null }),
  selectElement: (id) => set({ selectedElementId: id }),
  setZoom: (zoom) => set({ zoom }),
  setClipboard: (entry, linked) => set({ clipboard: { entry, linked, pasteCount: 0 } }),
  nextPasteOffset: () => {
    const cb = get().clipboard;
    if (!cb) return 0;
    const count = cb.pasteCount + 1;
    set({ clipboard: { ...cb, pasteCount: count } });
    return PASTE_OFFSET_MM * count;
  },
  clearSelection: () => set({ selectedInstanceId: null, editingInstanceId: null, selectedElementId: null }),
}));
