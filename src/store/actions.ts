// User-level commands shared by the toolbar, keyboard shortcuts and drag/drop.
import { createImage, createText, DEFAULT_SEAL_HEIGHT, DEFAULT_SEAL_WIDTH } from '../model/factory';
import { getDesignFor, getInstance, snapshot } from '../model/ops';
import { pageDimensions, type Doc } from '../model/types';
import { loadAllFonts } from '../ui/fonts';
import type { Point } from '../utils/geometry';
import { loadImageFile } from '../utils/image';
import { useDocStore } from './docStore';
import { useUiStore } from './uiStore';

const GAP_MM = 5;
const MARGIN_MM = 10;

const docState = () => useDocStore.getState();
const uiState = () => useUiStore.getState();

/** Next free slot in a simple left-to-right, top-to-bottom flow after the last seal. */
function nextSealPosition(doc: Doc, w: number, h: number): Point {
  const page = pageDimensions(doc.page);
  const last = doc.instances[doc.instances.length - 1];
  if (!last) return { x: MARGIN_MM, y: MARGIN_MM };
  const lastDesign = doc.designs[last.designId];
  let x = last.x + lastDesign.widthMm + GAP_MM;
  let y = last.y;
  if (x + w > page.width - MARGIN_MM) {
    x = MARGIN_MM;
    y = last.y + lastDesign.heightMm + GAP_MM;
  }
  if (y + h > page.height - MARGIN_MM) y = MARGIN_MM;
  return { x, y };
}

export function newSeal(): string {
  const doc = docState().doc;
  // New seals inherit the template size of the selected seal, if any.
  const selected = uiState().selectedInstanceId;
  const ref = selected ? getDesignFor(doc, selected) : undefined;
  const w = ref?.widthMm ?? DEFAULT_SEAL_WIDTH;
  const h = ref?.heightMm ?? DEFAULT_SEAL_HEIGHT;
  const p = nextSealPosition(doc, w, h);
  const id = docState().addSeal(p.x, p.y, w, h);
  uiState().selectInstance(id);
  return id;
}

/** The seal content should be added to: the one being edited, else the selected one, else a new one. */
function targetInstanceId(): string {
  const ui = uiState();
  return ui.editingInstanceId ?? ui.selectedInstanceId ?? newSeal();
}

export function addText() {
  const instanceId = targetInstanceId();
  const design = getDesignFor(docState().doc, instanceId)!;
  const el = createText(design);
  docState().addElement(design.id, el);
  uiState().enterEdit(instanceId);
  uiState().selectElement(el.id);
  uiState().setFocusText(el.id);
}

export async function addImageFile(file: Blob, instanceId?: string, at?: Point) {
  const img = await loadImageFile(file);
  const target = instanceId ?? targetInstanceId();
  const design = getDesignFor(docState().doc, target);
  if (!design) return;
  const assetId = docState().addAsset(img.dataUrl, img.width, img.height);
  const el = createImage(design, assetId, img.width, img.height, at ? { x: at.x, y: at.y } : {});
  docState().addElement(design.id, el);
  uiState().enterEdit(target);
  uiState().selectElement(el.id);
}

export function copySelected(linked: boolean): boolean {
  const id = uiState().selectedInstanceId;
  if (!id) return false;
  const entry = snapshot(docState().doc, id);
  if (!entry) return false;
  uiState().setClipboard(entry, linked);
  return true;
}

/** Paste the copied seal. It is linked if requested now or if it was copied as linked. */
export function pasteClipboard(linked: boolean): boolean {
  const cb = uiState().clipboard;
  if (!cb) return false;
  const offset = uiState().nextPasteOffset();
  const id = docState().paste(cb.entry, linked || cb.linked, offset);
  uiState().selectInstance(id);
  return true;
}

export function duplicateSelected(linked: boolean) {
  const id = uiState().selectedInstanceId;
  if (!id) return;
  const entry = snapshot(docState().doc, id);
  if (!entry) return;
  const newId = docState().paste(entry, linked, GAP_MM);
  uiState().selectInstance(newId);
}

export function deleteSelection() {
  const ui = uiState();
  if (ui.editingInstanceId && ui.selectedElementId) {
    const design = getDesignFor(docState().doc, ui.editingInstanceId);
    if (design) docState().removeElement(design.id, ui.selectedElementId);
    ui.selectElement(null);
    return;
  }
  if (ui.selectedInstanceId) {
    docState().deleteInstance(ui.selectedInstanceId);
    ui.clearSelection();
  }
}

export function unlinkSelected() {
  const id = uiState().selectedInstanceId;
  if (id) docState().unlink(id);
}

export function nudgeSelection(dx: number, dy: number) {
  const ui = uiState();
  const doc = docState().doc;
  if (ui.editingInstanceId && ui.selectedElementId) {
    const design = getDesignFor(doc, ui.editingInstanceId);
    const el = design?.elements.find((e) => e.id === ui.selectedElementId);
    if (design && el) docState().updateElement(design.id, el.id, { x: el.x + dx, y: el.y + dy });
    return;
  }
  const inst = ui.selectedInstanceId ? getInstance(doc, ui.selectedInstanceId) : undefined;
  if (inst) docState().updateInstance(inst.id, { x: inst.x + dx, y: inst.y + dy });
}

export async function printPage() {
  uiState().clearSelection();
  await loadAllFonts();
  // Let React flush the deselection before the print snapshot is taken.
  await new Promise((r) => requestAnimationFrame(() => r(null)));
  window.print();
}
