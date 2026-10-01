export const ICON_SIZES = [16, 32, 48, 128] as const;
export const ICON_COLORS = { enabled: '#20c997', disabled: '#636b75', foreground: '#ffffff' } as const;

function roundedRect(x: number, y: number, left: number, top: number, w: number, h: number, r: number): boolean {
  const dx = x - Math.max(left + r, Math.min(x, left + w - r));
  const dy = y - Math.max(top + r, Math.min(y, top + h - r));
  return x >= left && x <= left + w && y >= top && y <= top + h && dx * dx + dy * dy <= r * r;
}
function distance(x: number, y: number, ax: number, ay: number, bx: number, by: number): number {
  const t = Math.max(0, Math.min(1, ((x - ax) * (bx - ax) + (y - ay) * (by - ay)) / ((bx - ax) ** 2 + (by - ay) ** 2)));
  return Math.hypot(x - ax - t * (bx - ax), y - ay - t * (by - ay));
}
/** One supersampled renderer for packaged icons, toolbar states and favicons. */
export function renderVideoTrackerIcon(size: number, enabled: boolean): Uint8ClampedArray {
  const pixels = new Uint8ClampedArray(size * size * 4);
  const samples = 4;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const sum = [0, 0, 0, 0];
    for (let sy = 0; sy < samples; sy++) for (let sx = 0; sx < samples; sx++) {
      // Fill the icon with the player tile, leaving an 8/128 transparent margin.
      const px = ((x + (sx + 0.5) / samples) * 128 / size - 64) * 60 / 112 + 64;
      const py = ((y + (sy + 0.5) / samples) * 128 / size - 64) * 60 / 112 + 64;
      let color = [0, 0, 0, 0];
      if (roundedRect(px, py, 34, 34, 60, 60, 14)) {
        const light = 1 - (py - 34) / 60;
        color = enabled ? [20 + 20 * light, 166 + 35 * light, 125 + 26 * light, 255] : [76 + 40 * light, 84 + 40 * light, 94 + 40 * light, 255];
      }
      const insidePlay = px >= 56 && px <= 75 && Math.abs(py - 60) <= (75 - px) * 11 / 19;
      const playEdge = Math.min(distance(px, py, 56, 49, 56, 71), distance(px, py, 56, 71, 75, 60), distance(px, py, 75, 60, 56, 49));
      if (insidePlay || playEdge <= 2.5 || roundedRect(px, py, 44, 80, 40, 5, 2.5)) color = [255, 255, 255, 255];
      for (let c = 0; c < 4; c++) sum[c] += color[c];
    }
    const i = (y * size + x) * 4;
    for (let c = 0; c < 3; c++) pixels[i + c] = sum[3] ? Math.round(sum[c] * 255 / sum[3]) : 0;
    pixels[i + 3] = Math.round(sum[3] / (samples * samples));
  }
  return pixels;
}
type IconContext = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
export function drawVideoTrackerIcon(ctx: IconContext, size: number, enabled: boolean): void {
  const image = ctx.createImageData(size, size);
  image.data.set(renderVideoTrackerIcon(size, enabled));
  ctx.putImageData(image, 0, 0);
}
