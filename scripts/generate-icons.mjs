import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'public');
const sizes = [16, 32, 48, 128];
const samples = 4;

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i += 1) {
    c ^= buf[i];
    for (let k = 0; k < 8; k += 1) {
      c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
    }
  }
  return (~c) >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

function insideRoundRect(px, py, x, y, w, h, r) {
  const ix = px < x + r ? x + r : px > x + w - r ? x + w - r : px;
  const iy = py < y + r ? y + r : py > y + h - r ? y + h - r : py;
  const dx = px - ix;
  const dy = py - iy;
  return px >= x && px <= x + w && py >= y && py <= y + h && dx * dx + dy * dy <= r * r;
}

function pointInTriangle(px, py, ax, ay, bx, by, cx, cy) {
  const d1 = (px - bx) * (ay - by) - (ax - bx) * (py - by);
  const d2 = (px - cx) * (by - cy) - (bx - cx) * (py - cy);
  const d3 = (px - ax) * (cy - ay) - (cx - ax) * (py - ay);
  const hasNeg = d1 < 0 || d2 < 0 || d3 < 0;
  const hasPos = d1 > 0 || d2 > 0 || d3 > 0;
  return !(hasNeg && hasPos);
}

function nearLine(px, py, ax, ay, bx, by, width) {
  const vx = bx - ax;
  const vy = by - ay;
  const wx = px - ax;
  const wy = py - ay;
  const len2 = vx * vx + vy * vy;
  const t = Math.max(0, Math.min(1, (wx * vx + wy * vy) / len2));
  const cx = ax + t * vx;
  const cy = ay + t * vy;
  const dx = px - cx;
  const dy = py - cy;
  return dx * dx + dy * dy <= (width / 2) * (width / 2);
}

function makePng(size) {
  const scale = size / 128;
  const bg = [138, 144, 153, 255];
  const fg = [255, 255, 255, 255];
  const raw = Buffer.alloc((size * 4 + 1) * size);

  for (let y = 0; y < size; y += 1) {
    const row = y * (size * 4 + 1);
    raw[row] = 0;
    for (let x = 0; x < size; x += 1) {
      const rgba = [0, 0, 0, 0];

      for (let sy = 0; sy < samples; sy += 1) {
        for (let sx = 0; sx < samples; sx += 1) {
          const px = x + (sx + 0.5) / samples;
          const py = y + (sy + 0.5) / samples;
          let color = [0, 0, 0, 0];

          if (insideRoundRect(px, py, 8 * scale, 8 * scale, 112 * scale, 112 * scale, 26 * scale)) {
            color = bg;
          }
          if (pointInTriangle(px, py, 50 * scale, 38 * scale, 50 * scale, 90 * scale, 88 * scale, 64 * scale)) {
            color = fg;
          }
          if (nearLine(px, py, 30 * scale, 96 * scale, 98 * scale, 96 * scale, Math.max(3, 8 * scale))) {
            color = fg;
          }

          rgba[0] += color[0];
          rgba[1] += color[1];
          rgba[2] += color[2];
          rgba[3] += color[3];
        }
      }

      const total = samples * samples;
      const i = row + 1 + x * 4;
      raw[i] = Math.round(rgba[0] / total);
      raw[i + 1] = Math.round(rgba[1] / total);
      raw[i + 2] = Math.round(rgba[2] / total);
      raw[i + 3] = Math.round(rgba[3] / total);
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

await mkdir(outDir, { recursive: true });
await Promise.all(sizes.map((size) => writeFile(join(outDir, `icon-${size}.png`), makePng(size))));
console.log(`Generated ${sizes.length} extension icons in ${outDir}`);
