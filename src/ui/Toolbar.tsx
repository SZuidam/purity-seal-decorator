import { useRef } from 'react';
import { useStore } from 'zustand';
import { linkedCount } from '../model/ops';
import type { Orientation, PageSize } from '../model/types';
import {
  addImageFile,
  addText,
  copySelected,
  deleteSelection,
  newSeal,
  pasteClipboard,
  printPage,
  unlinkSelected,
} from '../store/actions';
import { redo, undo, useDocStore } from '../store/docStore';
import { exportDoc, importDocFile } from '../store/persistence';
import { useUiStore } from '../store/uiStore';
import { markOsClipboard } from '../hooks/useShortcuts';

const ZOOMS = [0.5, 0.75, 1, 1.5, 2, 3];

export function Toolbar() {
  const doc = useDocStore((s) => s.doc);
  const { setPage, replaceDoc } = useDocStore.getState();
  const canUndo = useStore(useDocStore.temporal, (s) => s.pastStates.length > 0);
  const canRedo = useStore(useDocStore.temporal, (s) => s.futureStates.length > 0);
  const { selectedInstanceId, clipboard, zoom, setZoom, clearSelection } = useUiStore();
  const imageInput = useRef<HTMLInputElement>(null);
  const jsonInput = useRef<HTMLInputElement>(null);

  const selected = doc.instances.find((i) => i.id === selectedInstanceId);
  const isLinked = selected ? linkedCount(doc, selected.designId) > 1 : false;

  const onImport = async (file: File) => {
    try {
      const imported = await importDocFile(file);
      if (doc.instances.length && !confirm('Replace the current page with the imported file?')) return;
      clearSelection();
      replaceDoc(imported);
    } catch (err) {
      alert(`Import failed: ${(err as Error).message}`);
    }
  };

  return (
    <header className="toolbar">
      <div className="group">
        <span className="brand">✠ Purity Seals</span>
      </div>
      <div className="group">
        <button onClick={() => newSeal()} title="Add a new blank seal">New seal</button>
        <button onClick={() => addText()} title="Add text to the selected seal">Add text</button>
        <button onClick={() => imageInput.current?.click()} title="Add an image (or drop / paste one onto a seal)">
          Add image
        </button>
        <input
          ref={imageInput}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void addImageFile(file);
            e.target.value = '';
          }}
        />
      </div>
      <div className="group">
        <button
          disabled={!selected}
          onClick={() => copySelected(false) && markOsClipboard()}
          title="Copy seal (Ctrl+C). Copy with Left Shift held to paste linked."
        >
          Copy
        </button>
        <button disabled={!clipboard} onClick={() => pasteClipboard(false)} title="Paste an independent copy (Ctrl+V)">
          Paste
        </button>
        <button
          disabled={!clipboard}
          onClick={() => pasteClipboard(true)}
          title="Paste a linked instance that shares content (Ctrl+Left Shift+V)"
        >
          Paste linked
        </button>
        <button disabled={!isLinked} onClick={unlinkSelected} title="Detach this seal from its linked group">
          Unlink
        </button>
        <button disabled={!selected} onClick={deleteSelection} title="Delete (Del)">
          Delete
        </button>
      </div>
      <div className="group">
        <button disabled={!canUndo} onClick={undo} title="Undo (Ctrl+Z)">Undo</button>
        <button disabled={!canRedo} onClick={redo} title="Redo (Ctrl+Y)">Redo</button>
      </div>
      <div className="group">
        <select value={doc.page.size} onChange={(e) => setPage({ size: e.target.value as PageSize })} title="Paper size">
          <option value="A4">A4</option>
          <option value="Letter">Letter</option>
        </select>
        <select
          value={doc.page.orientation}
          onChange={(e) => setPage({ orientation: e.target.value as Orientation })}
          title="Orientation"
        >
          <option value="portrait">Portrait</option>
          <option value="landscape">Landscape</option>
        </select>
        <select
          value={String(zoom)}
          onChange={(e) => setZoom(e.target.value === 'fit' ? 'fit' : Number(e.target.value))}
          title="Zoom"
        >
          <option value="fit">Fit</option>
          {ZOOMS.map((z) => (
            <option key={z} value={z}>{`${z * 100}%`}</option>
          ))}
        </select>
      </div>
      <div className="group">
        <button onClick={() => exportDoc(doc)} title="Download the page as JSON">Export</button>
        <button onClick={() => jsonInput.current?.click()} title="Load a page from JSON">Import</button>
        <input
          ref={jsonInput}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void onImport(file);
            e.target.value = '';
          }}
        />
      </div>
      <div className="group">
        <button className="primary" onClick={() => void printPage()} title="Print (Ctrl+P)">Print</button>
        <span className="hint">Print at 100% / “Actual size”, margins none</span>
      </div>
    </header>
  );
}
