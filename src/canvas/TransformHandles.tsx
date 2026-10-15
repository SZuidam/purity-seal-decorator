import { useMemo } from 'react';
import type React from 'react';
import type { SealDesign, SealElement, SealInstance } from '../model/types';
import { useDocStore } from '../store/docStore';
import { angleFromUp, normalizeAngle, rotateVec, round2, snapAngle } from '../utils/geometry';
import { sealTransform } from './SealView';
import { layoutText } from '../utils/textLayout';
import { useFontsVersion } from './ElementView';
import { pagePoint, sealPoint, startPointerDrag } from './useDragTransform';

const SELECT_COLOR = '#1e88e5';
const EDIT_COLOR = '#f57c00';
const OVERFLOW_COLOR = '#d32f2f';
const ROTATE_SNAP_DEG = 15;

interface SealOverlayProps {
  instance: SealInstance;
  design: SealDesign;
  editing: boolean;
  selectedElementId: string | null;
  ui: number;
}

/** Selection chrome for a seal (and its selected element in edit mode). Never printed. */
export function SealOverlay({ instance, design, editing, selectedElementId, ui }: SealOverlayProps) {
  const { widthMm: w, heightMm: h } = design;
  const color = editing ? EDIT_COLOR : SELECT_COLOR;
  const selectedElement = editing ? design.elements.find((e) => e.id === selectedElementId) : undefined;

  const onRotateDown = (e: React.PointerEvent) => {
    const center = { x: instance.x + w / 2, y: instance.y + h / 2 };
    startPointerDrag(e, (ev) => {
      let angle = angleFromUp(center, pagePoint(ev));
      angle = ev.shiftKey ? snapAngle(angle, ROTATE_SNAP_DEG) : round2(angle);
      useDocStore.getState().updateInstance(instance.id, { rotation: normalizeAngle(angle) });
    });
  };

  return (
    <g className="ui-only" transform={sealTransform(instance, design)}>
      <rect
        x={-2 * ui}
        y={-2 * ui}
        width={w + 4 * ui}
        height={h + 4 * ui}
        fill="none"
        stroke={color}
        strokeWidth={1.5 * ui}
        strokeDasharray={editing ? `${6 * ui} ${3 * ui}` : undefined}
        pointerEvents="none"
      />
      {!editing && <RotateHandle cx={w / 2} top={-2 * ui} ui={ui} color={color} onPointerDown={onRotateDown} />}
      {editing && (
        <text x={0} y={-5 * ui} fontSize={11 * ui} fill={EDIT_COLOR} fontFamily="sans-serif" pointerEvents="none">
          Editing seal — Esc to finish
        </text>
      )}
      {selectedElement && (
        <ElementOverlay instanceId={instance.id} designId={design.id} element={selectedElement} ui={ui} />
      )}
    </g>
  );
}

function RotateHandle({
  cx,
  top,
  ui,
  color,
  onPointerDown,
}: {
  cx: number;
  top: number;
  ui: number;
  color: string;
  onPointerDown: (e: React.PointerEvent) => void;
}) {
  const hy = top - 22 * ui;
  return (
    <>
      <line x1={cx} y1={top} x2={cx} y2={hy} stroke={color} strokeWidth={1.5 * ui} pointerEvents="none" />
      <circle
        cx={cx}
        cy={hy}
        r={6 * ui}
        fill="white"
        stroke={color}
        strokeWidth={1.5 * ui}
        style={{ cursor: 'grab' }}
        onPointerDown={onPointerDown}
      >
        <title>Rotate (Shift snaps to 15°)</title>
      </circle>
    </>
  );
}

/** Resize handle positions as unit offsets from the box centre: corners and edge midpoints. */
const RESIZE_HANDLES: { hx: -1 | 0 | 1; hy: -1 | 0 | 1; cursor: string }[] = [
  { hx: -1, hy: -1, cursor: 'nwse-resize' },
  { hx: 0, hy: -1, cursor: 'ns-resize' },
  { hx: 1, hy: -1, cursor: 'nesw-resize' },
  { hx: 1, hy: 0, cursor: 'ew-resize' },
  { hx: 1, hy: 1, cursor: 'nwse-resize' },
  { hx: 0, hy: 1, cursor: 'ns-resize' },
  { hx: -1, hy: 1, cursor: 'nesw-resize' },
  { hx: -1, hy: 0, cursor: 'ew-resize' },
];
const MIN_SIZE_MM = 1;

function ElementOverlay({
  instanceId,
  designId,
  element,
  ui,
}: {
  instanceId: string;
  designId: string;
  element: SealElement;
  ui: number;
}) {
  const fontsVersion = useFontsVersion();
  // fontsVersion: re-measure once web fonts arrive.
  const overflows = useMemo(() => element.type === 'text' && layoutText(element).overflows, [element, fontsVersion]);
  const { width: w, height: h } = element;
  const pad = 1.5 * ui;
  const color = overflows ? OVERFLOW_COLOR : SELECT_COLOR;
  const update = (patch: Partial<SealElement>) => useDocStore.getState().updateElement(designId, element.id, patch);

  /** Pointer in the element's own (rotated) frame, origin at its centre. */
  const localPoint = (ev: PointerEvent) => {
    const p = sealPoint(instanceId, ev);
    return rotateVec({ x: p.x - element.x, y: p.y - element.y }, -element.rotation);
  };

  const onRotateDown = (e: React.PointerEvent) => {
    startPointerDrag(e, (ev) => {
      let angle = angleFromUp(element, sealPoint(instanceId, ev));
      angle = ev.shiftKey ? snapAngle(angle, ROTATE_SNAP_DEG) : round2(angle);
      update({ rotation: normalizeAngle(angle) });
    });
  };

  /**
   * Resize from one handle while the opposite side stays put. Text keeps its font size
   * and re-wraps; on corner handles Shift keeps the aspect ratio.
   */
  const onResizeDown = (e: React.PointerEvent, hx: number, hy: number) => {
    const anchor = { x: (-hx * w) / 2, y: (-hy * h) / 2 };
    startPointerDrag(e, (ev) => {
      const l = localPoint(ev);
      let width = hx ? Math.max(MIN_SIZE_MM, hx * (l.x - anchor.x)) : w;
      let height = hy ? Math.max(MIN_SIZE_MM, hy * (l.y - anchor.y)) : h;
      if (ev.shiftKey && hx && hy) {
        const s = Math.max(width / w, height / h);
        width = w * s;
        height = h * s;
      }
      const centre = rotateVec(
        { x: hx ? anchor.x + (hx * width) / 2 : 0, y: hy ? anchor.y + (hy * height) / 2 : 0 },
        element.rotation,
      );
      update({ width: round2(width), height: round2(height), x: element.x + centre.x, y: element.y + centre.y });
    });
  };

  const hs = 7 * ui;
  return (
    <g transform={`translate(${element.x} ${element.y}) rotate(${element.rotation})`}>
      <rect
        x={-w / 2 - pad}
        y={-h / 2 - pad}
        width={w + 2 * pad}
        height={h + 2 * pad}
        fill="none"
        stroke={color}
        strokeWidth={1.2 * ui}
        strokeDasharray={overflows ? `${4 * ui} ${2 * ui}` : undefined}
        pointerEvents="none"
      >
        {overflows && <title>The text doesn't fit: make the box taller or the font smaller</title>}
      </rect>
      <RotateHandle cx={0} top={-h / 2 - pad} ui={ui} color={color} onPointerDown={onRotateDown} />
      {RESIZE_HANDLES.map(({ hx, hy, cursor }) => (
        <rect
          key={`${hx},${hy}`}
          x={hx * (w / 2 + pad) - hs / 2}
          y={hy * (h / 2 + pad) - hs / 2}
          width={hs}
          height={hs}
          fill="white"
          stroke={color}
          strokeWidth={1.5 * ui}
          style={{ cursor }}
          onPointerDown={(e) => onResizeDown(e, hx, hy)}
        >
          <title>
            {element.type === 'text'
              ? 'Resize the text box (text re-wraps, font size stays)'
              : hx && hy
                ? 'Resize (Shift keeps aspect ratio)'
                : 'Resize'}
          </title>
        </rect>
      ))}
    </g>
  );
}
