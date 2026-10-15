import type React from 'react';
import { beginGesture } from '../store/docStore';
import { clientToSvg, type Point } from '../utils/geometry';

const DRAG_THRESHOLD_PX = 2;

/**
 * Track a pointer drag on window until release. All moves of one drag form a single undo step.
 * Moves below a small threshold are ignored so a plain click doesn't touch the document.
 */
export function startPointerDrag(e: React.PointerEvent, move: (ev: PointerEvent) => void, end?: () => void) {
  e.stopPropagation();
  e.preventDefault();
  (document.activeElement as HTMLElement | null)?.blur?.();
  const gesture = beginGesture();
  const startX = e.clientX;
  const startY = e.clientY;
  let active = false;
  const onMove = (ev: PointerEvent) => {
    if (!active && Math.hypot(ev.clientX - startX, ev.clientY - startY) < DRAG_THRESHOLD_PX) return;
    active = true;
    gesture.step(() => move(ev));
  };
  const onUp = () => {
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('pointercancel', onUp);
    gesture.end();
    end?.();
  };
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
  window.addEventListener('pointercancel', onUp);
}

export const sealGroupId = (instanceId: string) => `seal-${instanceId}`;
export const elementNodeId = (instanceId: string, elementId: string) => `el-${instanceId}-${elementId}`;

/** Pointer position in page millimetres. */
export function pagePoint(ev: { clientX: number; clientY: number }): Point {
  const sheet = document.getElementById('sheet') as SVGSVGElement | null;
  return sheet ? clientToSvg(sheet, ev.clientX, ev.clientY) : { x: 0, y: 0 };
}

/** Pointer position in a seal's local millimetres (origin = seal top-left, unrotated). */
export function sealPoint(instanceId: string, ev: { clientX: number; clientY: number }): Point {
  const g = document.getElementById(sealGroupId(instanceId)) as SVGGElement | null;
  return g ? clientToSvg(g, ev.clientX, ev.clientY) : { x: 0, y: 0 };
}
