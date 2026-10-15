import type React from 'react';
import type { Asset, ImageElement, SealElement, TextElement } from '../model/types';
import { fontStack } from '../ui/fonts';
import { elementNodeId, useMeasuredBox } from './useDragTransform';

export const LINE_HEIGHT = 1.15;

interface Props {
  instanceId: string;
  element: SealElement;
  asset?: Asset;
  interactive: boolean;
  onPointerDown?: (e: React.PointerEvent, el: SealElement) => void;
}

export function ElementView({ instanceId, element, asset, interactive, onPointerDown }: Props) {
  const transform = `translate(${element.x} ${element.y}) rotate(${element.rotation})`;
  const handleDown = interactive && onPointerDown ? (e: React.PointerEvent) => onPointerDown(e, element) : undefined;
  return (
    <g transform={transform} onPointerDown={handleDown} style={interactive ? { cursor: 'move' } : undefined}>
      {element.type === 'text' ? (
        <TextNode instanceId={instanceId} el={element} interactive={interactive} />
      ) : (
        <ImageNode instanceId={instanceId} el={element} asset={asset} />
      )}
    </g>
  );
}

function TextNode({ instanceId, el, interactive }: { instanceId: string; el: TextElement; interactive: boolean }) {
  const nodeId = elementNodeId(instanceId, el.id);
  const box = useMeasuredBox(nodeId);
  const lines = el.text.split('\n');
  const lh = el.fontSizeMm * LINE_HEIGHT;
  const firstY = (-(lines.length - 1) / 2) * lh;
  return (
    <>
      {interactive && (
        // Glyphs alone are a poor hit target; this invisible box makes the whole block grabbable.
        <rect className="ui-only" x={box.x} y={box.y} width={box.width} height={box.height} fill="transparent" />
      )}
      <text
        id={nodeId}
        fontFamily={fontStack(el.fontFamily)}
        fontSize={el.fontSizeMm}
        fontWeight={el.bold ? 'bold' : 'normal'}
        fontStyle={el.italic ? 'italic' : 'normal'}
        fill={el.color}
        textAnchor={el.align}
        dominantBaseline="central"
        style={{ whiteSpace: 'pre', userSelect: 'none' }}
      >
        {lines.map((line, i) => (
          <tspan key={i} x={0} y={firstY + i * lh}>
            {/* A zero-width space keeps empty lines from collapsing. */}
            {line || '​'}
          </tspan>
        ))}
      </text>
    </>
  );
}

function ImageNode({ instanceId, el, asset }: { instanceId: string; el: ImageElement; asset?: Asset }) {
  const nodeId = elementNodeId(instanceId, el.id);
  if (!asset) {
    return (
      <rect id={nodeId} x={-el.width / 2} y={-el.height / 2} width={el.width} height={el.height} fill="#ccc" />
    );
  }
  return (
    <image
      id={nodeId}
      href={asset.dataUrl}
      x={-el.width / 2}
      y={-el.height / 2}
      width={el.width}
      height={el.height}
      opacity={el.opacity}
      preserveAspectRatio="none"
    />
  );
}
