import type React from 'react';
import type { SealDesign, SealElement, SealInstance } from '../model/types';
import { useDocStore } from '../store/docStore';
import { angleFromUp, normalizeAngle, rotateVec, round2, snapAngle } from '../utils/geometry';
import { sealTransform } from './SealView';
import { elementNodeId, pagePoint, sealPoint, startPointerDrag, useMeasuredBox, type Box } from './useDragTransform';

const SELECT_COLOR = '#1e88e5';
const EDIT_COLOR = '#f57c00';
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
  const textBox = useMeasuredBox(elementNodeId(instanceId, element.id));
  const box: Box =
    element.type === 'image'
      ? { x: -element.width / 2, y: -element.height / 2, width: element.width, height: element.height }
      : textBox;
  const pad = 1.5 * ui;
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

  const onResizeDown = (e: React.PointerEvent) => {
    if (element.type === 'image') {
      const { width: w0, height: h0 } = element;
      startPointerDrag(e, (ev) => {
        const l = localPoint(ev);
        let width = Math.max(1, 2 * Math.abs(l.x));
        let height = Math.max(1, 2 * Math.abs(l.y));
        if (ev.shiftKey) {
          const s = Math.max(width / w0, height / h0);
          width = w0 * s;
          height = h0 * s;
        }
        update({ width: round2(width), height: round2(height) });
      });
    } else {
      // Scale the font size by how far the corner is dragged from the centre.
      const fs0 = element.fontSizeMm;
      const corner = { x: box.x + box.width, y: box.y + box.height };
      const d0 = Math.hypot(corner.x, corner.y) || 1;
      startPointerDrag(e, (ev) => {
        const l = localPoint(ev);
        const d = Math.hypot(l.x, l.y);
        update({ fontSizeMm: Math.max(0.5, round2((fs0 * d) / d0)) });
      });
    }
  };

  return (
    <g transform={`translate(${element.x} ${element.y}) rotate(${element.rotation})`}>
      <rect
        x={box.x - pad}
        y={box.y - pad}
        width={box.width + 2 * pad}
        height={box.height + 2 * pad}
        fill="none"
        stroke={SELECT_COLOR}
        strokeWidth={1.2 * ui}
        pointerEvents="none"
      />
      <RotateHandle cx={box.x + box.width / 2} top={box.y - pad} ui={ui} color={SELECT_COLOR} onPointerDown={onRotateDown} />
      <rect
        x={box.x + box.width + pad - 4 * ui}
        y={box.y + box.height + pad - 4 * ui}
        width={8 * ui}
        height={8 * ui}
        fill="white"
        stroke={SELECT_COLOR}
        strokeWidth={1.5 * ui}
        style={{ cursor: 'nwse-resize' }}
        onPointerDown={onResizeDown}
      >
        <title>{element.type === 'image' ? 'Resize (Shift keeps aspect ratio)' : 'Scale text'}</title>
      </rect>
    </g>
  );
}
