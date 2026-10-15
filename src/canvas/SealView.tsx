import type React from 'react';
import type { Doc, SealDesign, SealElement, SealInstance } from '../model/types';
import { useDocStore } from '../store/docStore';
import { useUiStore } from '../store/uiStore';
import { linkColor } from '../utils/color';
import { ElementView } from './ElementView';
import { pagePoint, sealGroupId, sealPoint, startPointerDrag } from './useDragTransform';

interface Props {
  instance: SealInstance;
  design: SealDesign;
  assets: Doc['assets'];
  linkCount: number;
  editing: boolean;
  /** Millimetres per screen pixel, for zoom-independent UI sizes. */
  ui: number;
}

export function sealTransform(instance: SealInstance, design: SealDesign) {
  return `translate(${instance.x} ${instance.y}) rotate(${instance.rotation} ${design.widthMm / 2} ${design.heightMm / 2})`;
}

export function SealView({ instance, design, assets, linkCount, editing, ui }: Props) {
  const { widthMm: w, heightMm: h, outline } = design;
  const clipId = `clip-${instance.id}`;

  const onSealPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    const uiState = useUiStore.getState();
    if (editing) {
      // Clicking empty seal space while editing deselects the element.
      e.stopPropagation();
      uiState.selectElement(null);
      return;
    }
    uiState.selectInstance(instance.id);
    const start = pagePoint(e);
    const { x: x0, y: y0 } = instance;
    startPointerDrag(e, (ev) => {
      const p = pagePoint(ev);
      useDocStore.getState().updateInstance(instance.id, { x: x0 + p.x - start.x, y: y0 + p.y - start.y });
    });
  };

  const onElementPointerDown = (e: React.PointerEvent, el: SealElement) => {
    if (e.button !== 0) return;
    useUiStore.getState().selectElement(el.id);
    const start = sealPoint(instance.id, e);
    const { x: x0, y: y0 } = el;
    startPointerDrag(e, (ev) => {
      const p = sealPoint(instance.id, ev);
      useDocStore.getState().updateElement(design.id, el.id, { x: x0 + p.x - start.x, y: y0 + p.y - start.y });
    });
  };

  const dash = outline.dashed ? `${Math.max(outline.widthMm * 6, 1.5)} ${Math.max(outline.widthMm * 4, 1)}` : undefined;

  return (
    <g
      id={sealGroupId(instance.id)}
      data-instance-id={instance.id}
      transform={sealTransform(instance, design)}
      onPointerDown={onSealPointerDown}
      onDoubleClick={(e) => {
        e.stopPropagation();
        useUiStore.getState().enterEdit(instance.id);
      }}
      style={{ cursor: editing ? 'default' : 'move' }}
    >
      <clipPath id={clipId}>
        <rect width={w} height={h} />
      </clipPath>
      {/* Transparent fill so the whole seal area is clickable. */}
      <rect width={w} height={h} fill={design.background ?? 'transparent'} />
      <g clipPath={`url(#${clipId})`}>
        {design.elements.map((el) => (
          <ElementView
            key={el.id}
            instanceId={instance.id}
            element={el}
            asset={el.type === 'image' ? assets[el.assetId] : undefined}
            interactive={editing}
            onPointerDown={onElementPointerDown}
          />
        ))}
      </g>
      {outline.widthMm > 0 && (
        <rect
          width={w}
          height={h}
          fill="none"
          stroke={outline.color}
          strokeWidth={outline.widthMm}
          strokeDasharray={dash}
          pointerEvents="none"
        />
      )}
      {linkCount > 1 && <LinkBadge x={w} y={0} color={linkColor(design.id)} count={linkCount} ui={ui} />}
    </g>
  );
}

function LinkBadge({ x, y, color, count, ui }: { x: number; y: number; color: string; count: number; ui: number }) {
  const r = 9 * ui;
  return (
    <g className="ui-only" transform={`translate(${x} ${y})`} pointerEvents="none">
      <title>{`Linked seal (${count} instances)`}</title>
      <circle r={r} fill={color} stroke="white" strokeWidth={1.5 * ui} />
      {/* Two interlocking chain links */}
      <g fill="none" stroke="white" strokeWidth={1.6 * ui} strokeLinecap="round">
        <rect x={-6 * ui} y={-2.5 * ui} width={6.5 * ui} height={5 * ui} rx={2.5 * ui} />
        <rect x={-0.5 * ui} y={-2.5 * ui} width={6.5 * ui} height={5 * ui} rx={2.5 * ui} />
      </g>
    </g>
  );
}
