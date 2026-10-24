/** Small binary helpers for the in-memory mock; the PHP service remains authoritative. */
const crcTable = Uint32Array.from({ length: 256 }, (_, value) => {
  for (let i = 0; i < 8; i++) value = (value & 1) ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  return value >>> 0;
});
export function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of data) crc = crcTable[(crc ^ byte) & 255] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
const bytes = (...values: number[]) => Uint8Array.from(values);
function join(parts: Uint8Array[]): Uint8Array<ArrayBuffer> {
  const result = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) { result.set(part, offset); offset += part.length; }
  return result;
}
function word(value: number, size: number, little = false): Uint8Array<ArrayBuffer> {
  const result = new Uint8Array(size); const view = new DataView(result.buffer);
  size === 2 ? view.setUint16(0, value, little) : view.setUint32(0, value, little);
  return result;
}
const text = (value: string) => new TextEncoder().encode(value);
const decode = (value: Uint8Array) => new TextDecoder().decode(value);
const invalid = (): never => { throw new Error('invalid_file'); };

/** Uncompressed ZIP32, UTF-8 names, no directory traversal; no client ZIP dependency. */
export function storedZip(entries: { name: string; content: Uint8Array }[]): Uint8Array<ArrayBuffer> {
  if (entries.length < 1 || entries.length > 65535) return invalid();
  const local: Uint8Array[] = [], central: Uint8Array[] = []; let offset = 0;
  for (const entry of entries) {
    if (!/^[a-zA-Z0-9_.-]+$/.test(entry.name) || entry.name === '.' || entry.name === '..') return invalid();
    const name = text(entry.name), crc = crc32(entry.content);
    if (name.length > 65535 || entry.content.length > 0xffffffff) return invalid();
    const fields = join([word(20, 2, true), word(0x800, 2, true), word(0, 2, true), word(0, 2, true), word(0x21, 2, true),
      word(crc, 4, true), word(entry.content.length, 4, true), word(entry.content.length, 4, true), word(name.length, 2, true), word(0, 2, true)]);
    const header = join([word(0x04034b50, 4, true), fields, name]);
    local.push(header, entry.content);
    central.push(join([word(0x02014b50, 4, true), word(20, 2, true), fields, word(0, 2, true), word(0, 2, true), word(0, 2, true),
      word(0, 4, true), word(offset, 4, true), name]));
    offset += header.length + entry.content.length;
    if (offset > 0xffffffff) return invalid();
  }
  const directory = join(central);
  return join([...local, directory, word(0x06054b50, 4, true), word(0, 2, true), word(0, 2, true), word(entries.length, 2, true),
    word(entries.length, 2, true), word(directory.length, 4, true), word(offset, 4, true), word(0, 2, true)]);
}

export interface PreparedMockFile { content: Uint8Array<ArrayBuffer>; mime: 'image/jpeg' | 'image/png' | 'application/pdf'; width?: number; height?: number }
export function sanitizeMockFile(data: Uint8Array): PreparedMockFile {
  if (data[0] === 255 && data[1] === 216) return jpeg(data);
  if (decode(data.subarray(1, 4)) === 'PNG') return png(data);
  if (/^%PDF-(1\.[0-9]|2\.0)/.test(decode(data.subarray(0, 12))) && /%%EOF\s*$/.test(decode(data.subarray(-32)))) return { content: Uint8Array.from(data), mime: 'application/pdf' };
  return invalid();
}
function orientationTiff(value: number): Uint8Array<ArrayBuffer> {
  return join([bytes(73, 73, 42, 0), word(8, 4, true), word(1, 2, true), word(0x112, 2, true), word(3, 2, true), word(1, 4, true), word(value, 2, true), bytes(0, 0), word(0, 4, true)]);
}
function orientation(tiff: Uint8Array, previous?: number): number | undefined {
  const little = tiff[0] === 73 && tiff[1] === 73;
  if (!little && !(tiff[0] === 77 && tiff[1] === 77)) return invalid();
  const view = new DataView(tiff.buffer, tiff.byteOffset, tiff.byteLength);
  const read = (offset: number, size: number) => {
    if (offset < 0 || offset + size > tiff.length) return invalid();
    return size === 2 ? view.getUint16(offset, little) : view.getUint32(offset, little);
  };
  if (read(2, 2) !== 42) return invalid();
  const start = read(4, 4); if (start < 8) return invalid();
  const count = read(start, 2); if (start + 2 + count * 12 + 4 > tiff.length) return invalid();
  for (let i = 0; i < count; i++) {
    const offset = start + 2 + i * 12;
    if (read(offset, 2) !== 0x112) continue;
    if (read(offset + 2, 2) !== 3 || read(offset + 4, 4) !== 1) return invalid();
    const value = read(offset + 8, 2);
    if (value < 1 || value > 8 || (previous !== undefined && previous !== value)) return invalid();
    previous = value;
  }
  return previous;
}
function dimensions(width: number, height: number): void { if (!width || !height || width * height > 24000000) invalid(); }
function jpeg(data: Uint8Array): PreparedMockFile {
  const output: Uint8Array[] = []; let offset = 2, seen: number | undefined, width = 0, height = 0, scan = false;
  while (offset < data.length) {
    if (data[offset] !== 255) return invalid();
    while (data[offset] === 255) offset++;
    if (offset >= data.length) return invalid();
    const marker = data[offset++];
    if (marker === 217) {
      if (!scan || offset !== data.length) return invalid(); dimensions(width, height);
      const exif = join([text('Exif\0\0'), orientationTiff(seen ?? 1)]);
      return { content: join([bytes(255, 216, 255, 225), word(exif.length + 2, 2), exif, ...output, bytes(255, 217)]), mime: 'image/jpeg', width, height };
    }
    if (!marker || marker === 216 || (marker >= 208 && marker <= 215) || offset + 2 > data.length) return invalid();
    const size = data[offset] * 256 + data[offset + 1];
    if (size < 2 || offset + size > data.length) return invalid();
    const payload = data.subarray(offset + 2, offset + size);
    if (marker === 225 && decode(payload.subarray(0, 6)) === 'Exif\0\0') seen = orientation(payload.subarray(6), seen);
    if (marker >= 192 && marker <= 207 && ![196, 200, 204].includes(marker)) {
      if (payload.length < 5) return invalid(); height = payload[1] * 256 + payload[2]; width = payload[3] * 256 + payload[4]; dimensions(width, height);
    }
    if (!(marker >= 225 && marker <= 239 && ![226, 238].includes(marker)) && marker !== 254) output.push(join([bytes(255, marker), data.subarray(offset, offset + size)]));
    offset += size;
    if (marker !== 218) continue;
    scan = true; const start = offset;
    while (offset < data.length) {
      if (data[offset] !== 255) { offset++; continue; }
      let next = offset + 1; while (data[next] === 255) next++;
      if (next >= data.length) return invalid();
      if (data[next] === 0 || (data[next] >= 208 && data[next] <= 215)) { offset = next + 1; continue; }
      break;
    }
    output.push(data.subarray(start, offset));
  }
  return invalid();
}
function chunk(type: string, data: Uint8Array): Uint8Array<ArrayBuffer> {
  const body = join([text(type), data]); return join([word(data.length, 4), body, word(crc32(body), 4)]);
}
function png(data: Uint8Array): PreparedMockFile {
  if (data.length < 33 || data[0] !== 137 || decode(data.subarray(1, 8)) !== 'PNG\r\n\x1a\n') return invalid();
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength); const output: Uint8Array[] = [];
  let offset = 8, seen: number | undefined, width = 0, height = 0, hasPixels = false;
  while (offset + 12 <= data.length) {
    const size = view.getUint32(offset); if (size > data.length - offset - 12) return invalid();
    const type = decode(data.subarray(offset + 4, offset + 8)), payload = data.subarray(offset + 8, offset + 8 + size);
    if (view.getUint32(offset + 8 + size) !== crc32(data.subarray(offset + 4, offset + 8 + size))) return invalid();
    if (offset === 8 && (type !== 'IHDR' || size !== 13)) return invalid();
    if (type === 'IHDR') { width = view.getUint32(offset + 8); height = view.getUint32(offset + 12); dimensions(width, height); }
    if (type === 'eXIf') seen = orientation(payload, seen);
    if (type === 'IDAT') hasPixels = true;
    if (!['eXIf', 'tEXt', 'zTXt', 'iTXt', 'IEND'].includes(type)) output.push(data.subarray(offset, offset + size + 12));
    offset += size + 12;
    if (type === 'IEND') {
      if (size || offset !== data.length || !hasPixels) return invalid();
      return { content: join([data.subarray(0, 8), output[0], chunk('eXIf', orientationTiff(seen ?? 1)), ...output.slice(1), chunk('IEND', bytes())]), mime: 'image/png', width, height };
    }
  }
  return invalid();
}
