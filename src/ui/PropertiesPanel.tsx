import { useEffect, useRef, useState } from 'react';
import { linkedCount } from '../model/ops';
import type { ImageElement, SealDesign, SealElement, SealInstance, TextAlign, TextElement } from '../model/types';
import { addImageFile, addText, duplicateSelected, unlinkSelected } from '../store/actions';
import { useDocStore } from '../store/docStore';
import { useUiStore } from '../store/uiStore';
import { linkColor } from '../utils/color';
import { round2 } from '../utils/geometry';
import { loadImageFile } from '../utils/image';
import { FONTS } from './fonts';

export function PropertiesPanel() {
  const doc = useDocStore((s) => s.doc);
  const { selectedInstanceId, editingInstanceId, selectedElementId } = useUiStore();
  const instance = doc.instances.find((i) => i.id === selectedInstanceId);
  const design = instance ? doc.designs[instance.designId] : undefined;

  if (!instance || !design) {
    return (
      <aside className="panel">
        <h2>Properties</h2>
        <p className="muted">Select a seal to edit it, or click “New seal”.</p>
        <Shortcuts />
      </aside>
    );
  }

  const editing = editingInstanceId === instance.id;
  const element = editing ? design.elements.find((e) => e.id === selectedElementId) : undefined;

  return (
    <aside className="panel">
      {element ? (
        <ElementSection design={design} element={element} />
      ) : (
        <SealSection instance={instance} design={design} links={linkedCount(doc, design.id)} editing={editing} />
      )}
      <Shortcuts />
    </aside>
  );
}

function SealSection({
  instance,
  design,
  links,
  editing,
}: {
  instance: SealInstance;
  design: SealDesign;
  links: number;
  editing: boolean;
}) {
  const { updateDesign, updateInstance, bringToFront } = useDocStore.getState();
  const { enterEdit, exitEdit, selectElement } = useUiStore.getState();
  const setOutline = (patch: Partial<SealDesign['outline']>) =>
    updateDesign(design.id, { outline: { ...design.outline, ...patch } });

  return (
    <>
      <h2>Seal</h2>
      <div className="row">
        {editing ? (
          <button onClick={exitEdit}>Finish editing (Esc)</button>
        ) : (
          <button onClick={() => enterEdit(instance.id)}>Edit content (double-click)</button>
        )}
      </div>

      <h3>Template (cut outline)</h3>
      <div className="grid2">
        <NumberField label="Width (mm)" value={design.widthMm} min={1} step={1} onChange={(v) => updateDesign(design.id, { widthMm: v })} />
        <NumberField label="Height (mm)" value={design.heightMm} min={1} step={1} onChange={(v) => updateDesign(design.id, { heightMm: v })} />
      </div>
      <div className="grid2">
        <label>
          Outline colour
          <input type="color" value={design.outline.color} onChange={(e) => setOutline({ color: e.target.value })} />
        </label>
        <NumberField label="Outline (mm)" value={design.outline.widthMm} min={0} step={0.1} onChange={(v) => setOutline({ widthMm: v })} />
      </div>
      <label className="check">
        <input type="checkbox" checked={design.outline.dashed} onChange={(e) => setOutline({ dashed: e.target.checked })} />
        Dashed outline
      </label>
      <div className="grid2">
        <label className="check">
          <input
            type="checkbox"
            checked={design.background !== null}
            onChange={(e) => updateDesign(design.id, { background: e.target.checked ? '#f3e7c9' : null })}
          />
          Background
        </label>
        {design.background !== null && (
          <input type="color" value={design.background} onChange={(e) => updateDesign(design.id, { background: e.target.value })} />
        )}
      </div>

      <h3>Placement</h3>
      <div className="grid3">
        <NumberField label="X (mm)" value={round2(instance.x)} step={1} onChange={(x) => updateInstance(instance.id, { x })} />
        <NumberField label="Y (mm)" value={round2(instance.y)} step={1} onChange={(y) => updateInstance(instance.id, { y })} />
        <NumberField label="Rotation °" value={round2(instance.rotation)} step={1} onChange={(rotation) => updateInstance(instance.id, { rotation })} />
      </div>
      <div className="row">
        <button onClick={() => bringToFront(instance.id)}>Bring to front</button>
        <button onClick={() => duplicateSelected(false)} title="Ctrl+D">Duplicate</button>
      </div>

      <h3>Linking</h3>
      {links > 1 ? (
        <>
          <p>
            <span className="swatch" style={{ background: linkColor(design.id) }} /> Linked with {links - 1} other seal
            {links > 2 ? 's' : ''}. Content edits apply to all of them.
          </p>
          <button onClick={unlinkSelected}>Unlink this seal</button>
        </>
      ) : (
        <p className="muted">Not linked. Paste with Ctrl+Left Shift+V to create a linked instance.</p>
      )}

      <h3>Content</h3>
      <div className="row">
        <button onClick={() => addText()}>Add text</button>
        <ImagePickerButton label="Add image" onFile={(f) => void addImageFile(f, instance.id)} />
      </div>
      {design.elements.length > 0 && (
        <ul className="element-list">
          {[...design.elements].reverse().map((el) => (
            <li key={el.id}>
              <button
                className="link"
                onClick={() => {
                  enterEdit(instance.id);
                  selectElement(el.id);
                }}
              >
                {el.type === 'text' ? `“${el.text.split('\n')[0] || '(empty)'}”` : 'Image'}
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function ElementSection({ design, element }: { design: SealDesign; element: SealElement }) {
  const { updateElement, removeElement, reorderElement } = useDocStore.getState();
  const { selectElement } = useUiStore.getState();
  const update = (patch: Partial<SealElement>) => updateElement(design.id, element.id, patch);

  return (
    <>
      <h2>{element.type === 'text' ? 'Text' : 'Image'}</h2>
      <div className="row">
        <button onClick={() => selectElement(null)}>← Seal</button>
        <button onClick={() => reorderElement(design.id, element.id, 1)}>Forward</button>
        <button onClick={() => reorderElement(design.id, element.id, -1)}>Backward</button>
        <button
          className="danger"
          onClick={() => {
            removeElement(design.id, element.id);
            selectElement(null);
          }}
        >
          Delete
        </button>
      </div>
      {element.type === 'text' ? (
        <TextFields el={element} update={update} />
      ) : (
        <ImageFields el={element} update={update} />
      )}
      <h3>Position</h3>
      <div className="grid3">
        <NumberField label="X (mm)" value={round2(element.x)} step={0.5} onChange={(x) => update({ x })} />
        <NumberField label="Y (mm)" value={round2(element.y)} step={0.5} onChange={(y) => update({ y })} />
        <NumberField label="Rotation °" value={round2(element.rotation)} step={1} onChange={(rotation) => update({ rotation })} />
      </div>
      <div className="row">
        <button onClick={() => update({ x: design.widthMm / 2 })}>Centre horizontally</button>
        <button onClick={() => update({ y: design.heightMm / 2 })}>Centre vertically</button>
      </div>
    </>
  );
}

function TextFields({ el, update }: { el: TextElement; update: (p: Partial<TextElement>) => void }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const focusTextId = useUiStore((s) => s.focusTextId);
  // Focus the text box for newly added text, so typing replaces the placeholder.
  useEffect(() => {
    if (focusTextId !== el.id) return;
    ref.current?.focus();
    ref.current?.select();
    useUiStore.getState().setFocusText(null);
  }, [focusTextId, el.id]);

  return (
    <>
      <label>
        Text
        <textarea ref={ref} rows={3} value={el.text} onChange={(e) => update({ text: e.target.value })} />
      </label>
      <label>
        Font
        <select value={el.fontFamily} onChange={(e) => update({ fontFamily: e.target.value })}>
          {FONTS.map((f) => (
            <option key={f.family} value={f.family} style={{ fontFamily: f.family }}>
              {f.label}
            </option>
          ))}
        </select>
      </label>
      <div className="grid2">
        <NumberField label="Size (mm)" value={el.fontSizeMm} min={0.5} step={0.5} onChange={(fontSizeMm) => update({ fontSizeMm })} />
        <label>
          Colour
          <input type="color" value={el.color} onChange={(e) => update({ color: e.target.value })} />
        </label>
      </div>
      <div className="row">
        <label className="check">
          <input type="checkbox" checked={el.bold} onChange={(e) => update({ bold: e.target.checked })} /> Bold
        </label>
        <label className="check">
          <input type="checkbox" checked={el.italic} onChange={(e) => update({ italic: e.target.checked })} /> Italic
        </label>
      </div>
      <div className="row segmented">
        {(['start', 'middle', 'end'] as TextAlign[]).map((a) => (
          <button key={a} className={el.align === a ? 'active' : ''} onClick={() => update({ align: a })}>
            {{ start: 'Left', middle: 'Centre', end: 'Right' }[a]}
          </button>
        ))}
      </div>
    </>
  );
}

function ImageFields({ el, update }: { el: ImageElement; update: (p: Partial<ImageElement>) => void }) {
  const [keepAspect, setKeepAspect] = useState(true);
  const aspect = el.width / el.height;
  const { addAsset } = useDocStore.getState();

  return (
    <>
      <div className="grid2">
        <NumberField
          label="Width (mm)"
          value={round2(el.width)}
          min={1}
          step={0.5}
          onChange={(width) => update(keepAspect ? { width, height: width / aspect } : { width })}
        />
        <NumberField
          label="Height (mm)"
          value={round2(el.height)}
          min={1}
          step={0.5}
          onChange={(height) => update(keepAspect ? { height, width: height * aspect } : { height })}
        />
      </div>
      <label className="check">
        <input type="checkbox" checked={keepAspect} onChange={(e) => setKeepAspect(e.target.checked)} /> Keep aspect ratio
      </label>
      <label>
        Opacity {Math.round(el.opacity * 100)}%
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={el.opacity}
          onChange={(e) => update({ opacity: Number(e.target.value) })}
        />
      </label>
      <ImagePickerButton
        label="Replace image…"
        onFile={async (file) => {
          const img = await loadImageFile(file);
          const assetId = addAsset(img.dataUrl, img.width, img.height);
          update({ assetId, height: el.width / (img.width / img.height) });
        }}
      />
    </>
  );
}

function ImagePickerButton({ label, onFile }: { label: string; onFile: (f: File) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <button onClick={() => ref.current?.click()}>{label}</button>
      <input
        ref={ref}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.target.value = '';
        }}
      />
    </>
  );
}

/** Number input that lets the user type freely and commits valid values as they go. */
function NumberField({
  label,
  value,
  onChange,
  min,
  step,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  step?: number;
}) {
  const [draft, setDraft] = useState(String(value));
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    if (!focused) setDraft(String(value));
  }, [value, focused]);

  return (
    <label>
      {label}
      <input
        type="number"
        value={focused ? draft : String(value)}
        min={min}
        step={step}
        onFocus={() => {
          setDraft(String(value));
          setFocused(true);
        }}
        onBlur={() => setFocused(false)}
        onChange={(e) => {
          setDraft(e.target.value);
          const v = parseFloat(e.target.value);
          if (Number.isFinite(v) && (min === undefined || v >= min)) onChange(v);
        }}
      />
    </label>
  );
}

function Shortcuts() {
  return (
    <details className="shortcuts">
      <summary>Keyboard shortcuts</summary>
      <dl>
        <dt>Ctrl+C / Ctrl+V</dt>
        <dd>Copy / paste an independent seal</dd>
        <dt>Ctrl+Left Shift+V</dt>
        <dd>Paste a linked instance (also: copy with Left Shift held)</dd>
        <dt>Ctrl+D</dt>
        <dd>Duplicate (Left Shift: linked)</dd>
        <dt>Double-click / Enter</dt>
        <dd>Edit seal content</dd>
        <dt>Esc</dt>
        <dd>Deselect / finish editing</dd>
        <dt>Del</dt>
        <dd>Delete selection</dd>
        <dt>Arrows</dt>
        <dd>Nudge 1 mm (Shift: 10 mm)</dd>
        <dt>Shift while rotating</dt>
        <dd>Snap to 15°</dd>
        <dt>Ctrl+Z / Ctrl+Y</dt>
        <dd>Undo / redo</dd>
        <dt>Ctrl+P</dt>
        <dd>Print</dd>
      </dl>
    </details>
  );
}
