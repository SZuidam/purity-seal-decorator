import { get as idbGet, set as idbSet } from 'idb-keyval';
import { DOC_VERSION, type Doc, type DocFile } from '../model/types';
import { useDocStore } from './docStore';

const STORAGE_KEY = 'purity-seal-doc';
const AUTOSAVE_DELAY_MS = 500;

export function serializeDoc(doc: Doc): string {
  const file: DocFile = { version: DOC_VERSION, ...doc };
  return JSON.stringify(file, null, 2);
}

export class ImportError extends Error {}

export function parseDoc(json: string): Doc {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    throw new ImportError('The file is not valid JSON.');
  }
  if (!data || typeof data !== 'object') throw new ImportError('The file does not contain a seal document.');
  const file = data as Partial<DocFile>;
  if ((file.version as number) === 1) migrateV1(file);
  else if (file.version !== DOC_VERSION) {
    throw new ImportError(`Unsupported file version ${String(file.version)} (expected ${DOC_VERSION}).`);
  }
  if (!file.page || !file.designs || !Array.isArray(file.instances) || !file.assets) {
    throw new ImportError('The file is missing required fields.');
  }
  for (const inst of file.instances) {
    if (!file.designs[inst.designId]) throw new ImportError(`Seal ${inst.id} references a missing design.`);
  }
  return { page: file.page, designs: file.designs, instances: file.instances, assets: file.assets };
}

/**
 * v1 text had no box and never wrapped. Give it a box the size of its seal: the seal
 * already clipped anything beyond that, so wrapping there keeps old seals readable.
 */
function migrateV1(file: Partial<DocFile>) {
  for (const design of Object.values(file.designs ?? {})) {
    for (const el of design.elements) {
      if (el.type === 'text' && el.width === undefined) {
        el.width = design.widthMm;
        el.height = design.heightMm;
      }
    }
  }
}

/** Restore the last autosaved document, then keep saving changes. Returns an unsubscribe function. */
export async function startAutosave(): Promise<() => void> {
  try {
    const saved = await idbGet<string>(STORAGE_KEY);
    if (saved) {
      useDocStore.getState().replaceDoc(parseDoc(saved));
      useDocStore.temporal.getState().clear();
    }
  } catch (err) {
    console.warn('Could not restore autosaved document', err);
  }

  let timer: ReturnType<typeof setTimeout> | undefined;
  const save = (doc: Doc) => {
    idbSet(STORAGE_KEY, serializeDoc(doc)).catch((err) => console.warn('Autosave failed', err));
  };
  const unsubscribe = useDocStore.subscribe((state, prev) => {
    if (state.doc === prev.doc) return;
    clearTimeout(timer);
    timer = setTimeout(() => save(state.doc), AUTOSAVE_DELAY_MS);
  });
  const flush = () => {
    if (timer !== undefined) {
      clearTimeout(timer);
      save(useDocStore.getState().doc);
    }
  };
  window.addEventListener('beforeunload', flush);
  return () => {
    unsubscribe();
    window.removeEventListener('beforeunload', flush);
    clearTimeout(timer);
  };
}

export function exportDoc(doc: Doc, filename = 'purity-seals.json') {
  const blob = new Blob([serializeDoc(doc)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function importDocFile(file: File): Promise<Doc> {
  return parseDoc(await file.text());
}
