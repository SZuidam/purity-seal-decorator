export interface Point {
  x: number;
  y: number;
}

export const toRad = (deg: number) => (deg * Math.PI) / 180;
export const toDeg = (rad: number) => (rad * 180) / Math.PI;

/** Rotate a vector by `deg` degrees (SVG convention: positive = clockwise on screen). */
export function rotateVec(v: Point, deg: number): Point {
  const r = toRad(deg);
  const c = Math.cos(r);
  const s = Math.sin(r);
  return { x: v.x * c - v.y * s, y: v.x * s + v.y * c };
}

/** Angle in degrees of the vector from `center` to `p`, 0 = pointing up. */
export function angleFromUp(center: Point, p: Point): number {
  return toDeg(Math.atan2(p.x - center.x, -(p.y - center.y)));
}

export function normalizeAngle(deg: number): number {
  let a = deg % 360;
  if (a > 180) a -= 360;
  if (a <= -180) a += 360;
  return a;
}

export function snapAngle(deg: number, step: number): number {
  return Math.round(deg / step) * step;
}

export const round2 = (n: number) => Math.round(n * 100) / 100;

/** Convert client (screen) coordinates to the user space of an SVG element. */
export function clientToSvg(el: SVGGraphicsElement, clientX: number, clientY: number): Point {
  const svg = el.ownerSVGElement ?? (el as unknown as SVGSVGElement);
  const pt = svg.createSVGPoint();
  pt.x = clientX;
  pt.y = clientY;
  const ctm = el.getScreenCTM();
  if (!ctm) return { x: 0, y: 0 };
  const r = pt.matrixTransform(ctm.inverse());
  return { x: r.x, y: r.y };
}
