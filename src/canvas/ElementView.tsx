import { useEffect, useMemo, useState } from 'react';
import type React from 'react';
import type { Asset, ImageElement, SealElement, TextElement } from '../model/types';
import { fontStack } from '../ui/fonts';
import { layoutText } from '../utils/textLayout';
import { elementNodeId } from './useDragTransform';

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
  const clipId = `clip-${nodeId}`;
  const fontsVersion = useFontsVersion();
  // fontsVersion: re-measure once web fonts arrive.
  const { lines, lineHeight } = useMemo(() => layoutText(el), [el, fontsVersion]);
  const left = -el.width / 2;
  const top = -el.height / 2;
  const anchorX = { start: left, middle: 0, end: el.width / 2 }[el.align];
  // Centre the block of lines vertically in the box.
  const firstY = (-(lines.length - 1) / 2) * lineHeight;
  return (
    <>
      <clipPath id={clipId}>
        <rect x={left} y={top} width={el.width} height={el.height} />
      </clipPath>
      {interactive && (
        // Glyphs alone are a poor hit target; this invisible box makes the whole text box grabbable.
        <rect className="ui-only" x={left} y={top} width={el.width} height={el.height} fill="transparent" />
      )}
      <text
        id={nodeId}
        clipPath={`url(#${clipId})`}
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
          <tspan key={i} x={anchorX} y={firstY + i * lineHeight}>
            {/* A zero-width space keeps empty lines from collapsing. */}
            {line || '\u200b'}
          </tspan>
        ))}
      </text>
    </>
  );
}

/** Bumps whenever web fonts finish loading, so text can be re-measured with the real metrics. */
export function useFontsVersion(): number {
  const [version, setVersion] = useState(0);
  useEffect(() => {
    if (!document.fonts) return;
    const bump = () => setVersion((v) => v + 1);
    document.fonts.addEventListener('loadingdone', bump);
    document.fonts.ready.then(bump);
    return () => document.fonts.removeEventListener('loadingdone', bump);
  }, []);
  return version;
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
