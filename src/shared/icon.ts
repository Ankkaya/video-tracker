export const ICON_SIZES = [16, 32, 48, 128] as const;

export const ICON_COLORS = {
  enabled: '#20c997',
  disabled: '#8a9099',
  foreground: '#ffffff',
} as const;

type IconContext = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

export function drawVideoTrackerIcon(ctx: IconContext, size: number, enabled: boolean): void {
  const scale = size / 128;
  const bg = enabled ? ICON_COLORS.enabled : ICON_COLORS.disabled;

  ctx.clearRect(0, 0, size, size);
  ctx.fillStyle = bg;
  ctx.beginPath();

  const x = 8 * scale;
  const y = 8 * scale;
  const w = 112 * scale;
  const h = 112 * scale;
  const r = 26 * scale;
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = ICON_COLORS.foreground;
  ctx.beginPath();
  ctx.moveTo(50 * scale, 38 * scale);
  ctx.lineTo(50 * scale, 90 * scale);
  ctx.lineTo(88 * scale, 64 * scale);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = ICON_COLORS.foreground;
  ctx.lineWidth = Math.max(3, 8 * scale);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(30 * scale, 96 * scale);
  ctx.lineTo(98 * scale, 96 * scale);
  ctx.stroke();
}
