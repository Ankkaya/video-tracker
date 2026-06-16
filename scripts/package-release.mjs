import { existsSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { readFile, readFile as readFileBuffer } from 'node:fs/promises';
import { basename, dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateRawSync } from 'node:zlib';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const packageJson = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'));
const version = packageJson.version;
const sourceDir = resolve(root, '.output/chrome-mv3');
const manifestPath = resolve(sourceDir, 'manifest.json');
const releasesDir = resolve(root, 'releases');
const zipPath = resolve(releasesDir, `video-tracker-${version}-chrome-mv3.zip`);

if (!existsSync(manifestPath)) {
  throw new Error('Missing .output/chrome-mv3/manifest.json. Run npm run build:prod first.');
}

const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
if (manifest.version !== version) {
  throw new Error(`Manifest version ${manifest.version} does not match package version ${version}.`);
}

mkdirSync(releasesDir, { recursive: true });
if (existsSync(zipPath)) {
  rmSync(zipPath, { force: true });
}

const crcTable = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let value = i;
  for (let j = 0; j < 8; j++) {
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }
  crcTable[i] = value >>> 0;
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function dosDateTime(date = new Date()) {
  const year = Math.max(date.getFullYear(), 1980);
  const dosTime = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
  const dosDate = ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return { dosDate, dosTime };
}

function uint16(value) {
  const buffer = Buffer.alloc(2);
  buffer.writeUInt16LE(value);
  return buffer;
}

function uint32(value) {
  const buffer = Buffer.alloc(4);
  buffer.writeUInt32LE(value >>> 0);
  return buffer;
}

function listFiles(dir) {
  return readdirSync(dir)
    .flatMap((name) => {
      const fullPath = join(dir, name);
      const stat = statSync(fullPath);
      if (stat.isDirectory()) return listFiles(fullPath);
      if (stat.isFile()) return [fullPath];
      return [];
    })
    .sort();
}

async function createZip(inputDir, outputPath) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  for (const filePath of listFiles(inputDir)) {
    const name = relative(inputDir, filePath).split(sep).join('/');
    const nameBuffer = Buffer.from(name, 'utf8');
    const content = await readFileBuffer(filePath);
    const compressed = deflateRawSync(content);
    const checksum = crc32(content);
    const { dosDate, dosTime } = dosDateTime(statSync(filePath).mtime);

    const localHeader = Buffer.concat([
      uint32(0x04034b50),
      uint16(20),
      uint16(0x0800),
      uint16(8),
      uint16(dosTime),
      uint16(dosDate),
      uint32(checksum),
      uint32(compressed.length),
      uint32(content.length),
      uint16(nameBuffer.length),
      uint16(0),
      nameBuffer,
    ]);

    localParts.push(localHeader, compressed);

    const centralHeader = Buffer.concat([
      uint32(0x02014b50),
      uint16(20),
      uint16(20),
      uint16(0x0800),
      uint16(8),
      uint16(dosTime),
      uint16(dosDate),
      uint32(checksum),
      uint32(compressed.length),
      uint32(content.length),
      uint16(nameBuffer.length),
      uint16(0),
      uint16(0),
      uint16(0),
      uint16(0),
      uint32(0),
      uint32(offset),
      nameBuffer,
    ]);

    centralParts.push(centralHeader);
    offset += localHeader.length + compressed.length;
  }

  const centralDirectory = Buffer.concat(centralParts);
  const endOfCentralDirectory = Buffer.concat([
    uint32(0x06054b50),
    uint16(0),
    uint16(0),
    uint16(centralParts.length),
    uint16(centralParts.length),
    uint32(centralDirectory.length),
    uint32(offset),
    uint16(0),
  ]);

  writeFileSync(outputPath, Buffer.concat([...localParts, centralDirectory, endOfCentralDirectory]));
}

await createZip(sourceDir, zipPath);

console.log(`Created ${zipPath}`);
console.log(`Packaged ${basename(sourceDir)} manifest v${manifest.version} into ${basename(zipPath)}`);
