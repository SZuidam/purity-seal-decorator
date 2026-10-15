import { useEffect } from 'react';
import {
  addImageFile,
  copySelected,
  deleteSelection,
  duplicateSelected,
  nudgeSelection,
  pasteClipboard,
  printPage,
} from '../store/actions';
import { redo, undo } from '../store/docStore';
import { useUiStore } from '../store/uiStore';
import { firstImageFile } from '../utils/image';

/** Text placed on the OS clipboard when a seal is copied, so a later paste knows the seal is newer than any image. */
const CLIPBOARD_MARKER = 'purity-seal-decorator:seal';

/** Best-effort marker write for copies that don't go through a copy event (toolbar, Ctrl+Shift+C). */
export function markOsClipboard() {
  navigator.clipboard?.writeText(CLIPBOARD_MARKER).catch(() => undefined);
}

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  if (tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (tag !== 'INPUT') return false;
  const type = (target as HTMLInputElement).type;
  return !['checkbox', 'radio', 'button', 'range', 'color', 'file'].includes(type);
}

export function useShortcuts() {
  useEffect(() => {
    const ui = () => useUiStore.getState();
    // Set on Ctrl+V keydown; the paste event (or a fallback timer) consumes it.
    let pendingPaste: { linked: boolean } | null = null;
    // Only Left Shift creates links. Track Right Shift rather than Left Shift so a Shift held
    // before the window got focus (no keydown seen) still counts as the left one.
    let rightShiftDown = false;
    const leftShift = (e: KeyboardEvent) => e.shiftKey && !rightShiftDown;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'ShiftRight') rightShiftDown = true;
      if (isTyping(e.target)) return;
      const ctrl = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();

      if (ctrl && key === 'v') {
        // Let the browser fire a paste event so OS clipboard images can be read.
        pendingPaste = { linked: leftShift(e) };
        setTimeout(() => {
          if (pendingPaste) {
            pasteClipboard(pendingPaste.linked);
            pendingPaste = null;
          }
        }, 0);
        return;
      }
      if (ctrl && key === 'c') {
        // Plain Ctrl+C is handled in the copy event, which can also mark the OS clipboard.
        // Ctrl+Shift+C fires no copy event (and is Chrome's "inspect element"), so handle it here.
        if (e.shiftKey && copySelected(leftShift(e))) {
          e.preventDefault();
          markOsClipboard();
        }
        return;
      }
      if (ctrl && key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if (ctrl && (key === 'y' || (key === 'z' && e.shiftKey))) {
        e.preventDefault();
        redo();
      } else if (ctrl && key === 'd') {
        e.preventDefault();
        duplicateSelected(leftShift(e));
      } else if (ctrl && key === 'p') {
        e.preventDefault();
        void printPage();
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        deleteSelection();
      } else if (e.key === 'Escape') {
        const s = ui();
        if (s.selectedElementId) s.selectElement(null);
        else if (s.editingInstanceId) s.exitEdit();
        else s.clearSelection();
      } else if (e.key === 'Enter') {
        const s = ui();
        if (s.selectedInstanceId && !s.editingInstanceId) {
          e.preventDefault();
          s.enterEdit(s.selectedInstanceId);
        }
      } else if (e.key.startsWith('Arrow') && !ctrl) {
        const step = e.shiftKey ? 10 : 1;
        const d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
        if (d) {
          e.preventDefault();
          nudgeSelection(d[0], d[1]);
        }
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'ShiftRight') rightShiftDown = false;
    };
    const onBlur = () => {
      rightShiftDown = false;
    };

    const onCopy = (e: ClipboardEvent) => {
      if (isTyping(e.target) || window.getSelection()?.toString()) return;
      if (copySelected(false)) {
        e.clipboardData?.setData('text/plain', CLIPBOARD_MARKER);
        e.preventDefault();
      }
    };

    const onPaste = (e: ClipboardEvent) => {
      if (isTyping(e.target)) return;
      const linked = pendingPaste?.linked ?? false;
      pendingPaste = null;
      e.preventDefault();
      const text = e.clipboardData?.getData('text/plain');
      const image = text === CLIPBOARD_MARKER ? null : firstImageFile(e.clipboardData?.items);
      if (image) {
        void addImageFile(image);
      } else {
        pasteClipboard(linked);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    document.addEventListener('copy', onCopy);
    document.addEventListener('paste', onPaste);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('copy', onCopy);
      document.removeEventListener('paste', onPaste);
    };
  }, []);
}
