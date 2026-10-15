import { useLayoutEffect, useRef, useState } from 'react';
import type React from 'react';
import { linkedCount } from '../model/ops';
import { pageDimensions } from '../model/types';
import { addImageFile } from '../store/actions';
import { useDocStore } from '../store/docStore';
import { useUiStore } from '../store/uiStore';
import { firstImageFile } from '../utils/image';
import { SealView } from './SealView';
import { SealOverlay } from './TransformHandles';
import { sealPoint } from './useDragTransform';

/** CSS pixels per millimetre at 100% zoom. */
export const PX_PER_MM = 96 / 25.4;
const FIT_PADDING_PX = 48;
const SAFE_MARGIN_MM = 5;

export function Page() {
  const doc = useDocStore((s) => s.doc);
  const { selectedInstanceId, editingInstanceId, selectedElementId, zoom, clearSelection } = useUiStore();
  const containerRef = useRef<HTMLDivElement>(null);
  const [fitZoom, setFitZoom] = useState(1);
  const { width, height } = pageDimensions(doc.page);

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => {
      const z = Math.min(
        (el.clientWidth - FIT_PADDING_PX) / (width * PX_PER_MM),
        (el.clientHeight - FIT_PADDING_PX) / (height * PX_PER_MM),
      );
      setFitZoom(Math.max(0.1, z));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [width, height]);

  const scale = zoom === 'fit' ? fitZoom : zoom;
  const ui = 1 / (scale * PX_PER_MM);

  const onDrop = (e: React.DragEvent) => {
    const file = firstImageFile(e.dataTransfer.files);
    if (!file) return;
    e.preventDefault();
    const hit = (document.elementFromPoint(e.clientX, e.clientY) as Element | null)?.closest('[data-instance-id]');
    const instanceId = hit?.getAttribute('data-instance-id') ?? useUiStore.getState().editingInstanceId ?? undefined;
    const at = instanceId && hit ? sealPoint(instanceId, e) : undefined;
    void addImageFile(file, instanceId, at);
  };

  const selected = doc.instances.find((i) => i.id === selectedInstanceId);
  const selectedDesign = selected ? doc.designs[selected.designId] : undefined;

  return (
    <div className="canvas-area" ref={containerRef} onPointerDown={() => clearSelection()}>
      <svg
        id="sheet"
        xmlns="http://www.w3.org/2000/svg"
        viewBox={`0 0 ${width} ${height}`}
        width={`${width}mm`}
        height={`${height}mm`}
        style={
          {
            width: width * PX_PER_MM * scale,
            height: height * PX_PER_MM * scale,
            '--page-w': `${width}mm`,
            '--page-h': `${height}mm`,
          } as React.CSSProperties
        }
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
      >
        <rect
          width={width}
          height={height}
          fill="white"
          onPointerDown={(e) => {
            e.stopPropagation();
            clearSelection();
          }}
        />
        <rect
          className="ui-only"
          x={SAFE_MARGIN_MM}
          y={SAFE_MARGIN_MM}
          width={width - 2 * SAFE_MARGIN_MM}
          height={height - 2 * SAFE_MARGIN_MM}
          fill="none"
          stroke="#c8d6e5"
          strokeWidth={ui}
          strokeDasharray={`${4 * ui} ${4 * ui}`}
          pointerEvents="none"
        >
          <title>Most printers cannot print outside this area</title>
        </rect>
        {doc.instances.map((inst) => {
          const design = doc.designs[inst.designId];
          if (!design) return null;
          return (
            <SealView
              key={inst.id}
              instance={inst}
              design={design}
              assets={doc.assets}
              linkCount={linkedCount(doc, inst.designId)}
              editing={inst.id === editingInstanceId}
              ui={ui}
            />
          );
        })}
        {selected && selectedDesign && (
          <SealOverlay
            instance={selected}
            design={selectedDesign}
            editing={selected.id === editingInstanceId}
            selectedElementId={selectedElementId}
            ui={ui}
          />
        )}
      </svg>
    </div>
  );
}
