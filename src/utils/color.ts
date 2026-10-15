/** Stable, distinguishable colour for a link group, derived from its design id. */
export function linkColor(designId: string): string {
  let hash = 0;
  for (let i = 0; i < designId.length; i++) {
    hash = (hash * 31 + designId.charCodeAt(i)) | 0;
  }
  // Golden-angle spacing keeps neighbouring hashes visually apart.
  const hue = Math.abs(hash * 137.508) % 360;
  return `hsl(${hue.toFixed(0)} 75% 45%)`;
}
