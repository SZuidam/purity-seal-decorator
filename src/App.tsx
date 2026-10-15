import { useEffect, useState } from 'react';
import { Page } from './canvas/Page';
import { useShortcuts } from './hooks/useShortcuts';
import { useDocStore } from './store/docStore';
import { startAutosave } from './store/persistence';
import { PropertiesPanel } from './ui/PropertiesPanel';
import { Toolbar } from './ui/Toolbar';

/** Keeps the @page rule in sync with the chosen paper, so the sheet prints at true size. */
function usePageStyle() {
  const page = useDocStore((s) => s.doc.page);
  useEffect(() => {
    let style = document.getElementById('page-style') as HTMLStyleElement | null;
    if (!style) {
      style = document.createElement('style');
      style.id = 'page-style';
      document.head.appendChild(style);
    }
    style.textContent = `@page { size: ${page.size === 'A4' ? 'A4' : 'letter'} ${page.orientation}; margin: 0; }`;
  }, [page.size, page.orientation]);
}

export function App() {
  const [ready, setReady] = useState(false);
  useShortcuts();
  usePageStyle();

  useEffect(() => {
    let stop: (() => void) | undefined;
    let cancelled = false;
    startAutosave().then((unsubscribe) => {
      if (cancelled) unsubscribe();
      else stop = unsubscribe;
      setReady(true);
    });
    return () => {
      cancelled = true;
      stop?.();
    };
  }, []);

  if (!ready) return <div className="loading">Consecrating seals…</div>;

  return (
    <div className="app">
      <Toolbar />
      <main className="workspace">
        <Page />
        <PropertiesPanel />
      </main>
    </div>
  );
}
