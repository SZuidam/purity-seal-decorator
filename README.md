# Purity Seal Decorator

Design Warhammer 40K–style purity seals in the browser, lay them out on a sheet of paper and print them at true size to cut out with scissors.

## Getting started

```sh
npm install
npm run dev      # start the app at http://localhost:5173
npm run test     # unit tests (Vitest)
npm run build    # type-check + production build into dist/
```

## Using it

1. **New seal** adds a blank seal (a dashed cut outline, 30 × 80 mm by default) to the page.
2. Drag a seal to move it, and use the round handle above it to rotate it (hold Shift to snap to 15°).
3. **Double-click** a seal (or press Enter) to edit its content. Then you can:
   - **Add text**: pick a font (bundled gothic fonts, or system fonts), size, colour, bold/italic and alignment. Multi-line text works.
   - **Add image**: use the button, drag a file onto the seal, or paste an image from the clipboard (Ctrl+V).
   - Drag elements to move them. Use the round handle to rotate and the square corner handle to resize (images: Shift keeps the aspect ratio; text: scales the font size).
   - Press Esc to finish editing.
4. Set the seal's **template size** (cut outline width/height in mm), outline colour/width/dashing and an optional background in the properties panel.

### Copies and linked seals

| Action | Result |
| --- | --- |
| Ctrl+C, then Ctrl+V | **Independent copy**: changing one doesn't affect the other. |
| Ctrl+C, then Ctrl+**Left Shift**+V | **Linked instance**: shares content with the original. |
| Ctrl+**Left Shift**+C, then Ctrl+V | Also pastes linked. |
| Ctrl+D | Duplicate (Left Shift: linked). |

Linked seals show a coloured chain badge on screen (one colour per group; it isn't printed). Editing the content or template of any seal in the group changes all of them, but each keeps its own position and rotation. **Unlink** gives a seal its own private copy again.

Repeated pastes cascade by 5 mm so they don't stack exactly on top of each other.

### Keyboard shortcuts

| Keys | Action |
| --- | --- |
| Ctrl+C / Ctrl+V | Copy / paste seal |
| Ctrl+Left Shift+V | Paste linked |
| Ctrl+D | Duplicate |
| Double-click / Enter | Edit seal content |
| Esc | Deselect element → finish editing → deselect seal |
| Delete / Backspace | Delete the selected element or seal |
| Arrow keys | Nudge 1 mm (Shift: 10 mm) |
| Ctrl+Z / Ctrl+Y (Ctrl+Shift+Z) | Undo / redo |
| Ctrl+P | Print |

Shortcuts are ignored while you're typing in a field.

## Printing

Choose the paper size (A4/Letter) and orientation in the toolbar, then click **Print** (or Ctrl+P). In the print dialog:

- set **Scale** to 100% / "Actual size" (not "Fit to page"),
- set **Margins** to "None",
- enable **Background graphics** if your seals use a background colour.

The page is laid out in millimetres, so a 30 × 80 mm seal prints at exactly 30 × 80 mm. Selection handles, link badges and the light dashed "printable area" guide (5 mm in from the edge, where most printers stop printing) never appear on paper.

## Saving

- Work is **autosaved** in your browser (IndexedDB) and restored when you reopen the page.
- **Export** downloads a `purity-seals.json` file with everything, including images; **Import** loads one back (replacing the current page).

## Tech

Vite + React + TypeScript. The page is a single SVG whose user units are millimetres. State lives in a Zustand store with undo/redo via `zundo`; linked seals are instances that share a design id. Fonts are bundled with `@fontsource` so printing works offline.
