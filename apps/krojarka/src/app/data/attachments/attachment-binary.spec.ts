import { crc32, sanitizeMockFile, storedZip } from './attachment-binary';

export const TEST_PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAIAAAABCAIAAAB7QOjdAAAACXBIWXMAAA7EAAAOxAGVKw4bAAAAD0lEQVQImWNgYGBgYGAAAAAHAAHV3tbYAAAAAElFTkSuQmCC';
const png = () => Uint8Array.from(atob(TEST_PNG), (c) => c.charCodeAt(0));
const TEST_JPEG = '/9j/4AAQSkZJRgABAQEAYABgAAD//gA+Q1JFQVRPUjogZ2QtanBlZyB2MS4wICh1c2luZyBJSkcgSlBFRyB2NjIpLCBkZWZhdWx0IHF1YWxpdHkK/9sAQwAIBgYHBgUIBwcHCQkICgwUDQwLCwwZEhMPFB0aHx4dGhwcICQuJyAiLCMcHCg3KSwwMTQ0NB8nOT04MjwuMzQy/9sAQwEJCQkMCwwYDQ0YMiEcITIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIy/8AAEQgAAQACAwEiAAIRAQMRAf/EAB8AAAEFAQEBAQEBAAAAAAAAAAABAgMEBQYHCAkKC//EALUQAAIBAwMCBAMFBQQEAAABfQECAwAEEQUSITFBBhNRYQcicRQygZGhCCNCscEVUtHwJDNicoIJChYXGBkaJSYnKCkqNDU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6g4SFhoeIiYqSk5SVlpeYmZqio6Slpqeoqaqys7S1tre4ubrCw8TFxsfIycrS09TV1tfY2drh4uPk5ebn6Onq8fLz9PX29/j5+v/EAB8BAAMBAQEBAQEBAQEAAAAAAAABAgMEBQYHCAkKC//EALURAAIBAgQEAwQHBQQEAAECdwABAgMRBAUhMQYSQVEHYXETIjKBCBRCkaGxwQkjM1LwFWJy0QoWJDThJfEXGBkaJicoKSo1Njc4OTpDREVGR0hJSlNUVVZXWFlaY2RlZmdoaWpzdHV2d3h5eoKDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uLj5OXm5+jp6vLz9PX29/j5+v/aAAwDAQACEQMRAD8A+f6KKKAP/9k=';
const text = (value: string) => new TextEncoder().encode(value);
const joined = (...parts: Uint8Array[]) => { const result = new Uint8Array(parts.reduce((sum, p) => sum + p.length, 0)); let offset = 0; for (const part of parts) { result.set(part, offset); offset += part.length; } return result; };
function chunk(type: string, data: Uint8Array) {
  const result = new Uint8Array(data.length + 12); const view = new DataView(result.buffer);
  view.setUint32(0, data.length); result.set(text(type), 4); result.set(data, 8); view.setUint32(result.length - 4, crc32(result.subarray(4, -4))); return result;
}
function exif() {
  const tiff = new Uint8Array(48); const view = new DataView(tiff.buffer);
  tiff.set([73, 73, 42, 0]); view.setUint32(4, 8, true); view.setUint16(8, 2, true);
  view.setUint16(10, 0x112, true); view.setUint16(12, 3, true); view.setUint32(14, 1, true); view.setUint16(18, 6, true);
  view.setUint16(22, 0x8825, true); view.setUint16(24, 4, true); view.setUint32(26, 1, true); view.setUint32(30, 38, true); tiff.set(text('GPS-SECRET'), 38);
  return tiff;
}

describe('attachment mock binary formats', () => {
  it('uses the standard CRC32 check value and a real ZIP central directory', () => {
    expect(crc32(text('123456789')).toString(16)).toBe('cbf43926');
    const archive = storedZip([{ name: 'scan.pdf', content: text('%PDF-1.7\n%%EOF') }, { name: 'manifest.json', content: text('[]') }]);
    const view = new DataView(archive.buffer); expect(view.getUint32(0, true)).toBe(0x04034b50);
    const end = archive.length - 22; expect(view.getUint32(end, true)).toBe(0x06054b50); expect(view.getUint16(end + 10, true)).toBe(2);
    const directory = view.getUint32(end + 16, true); expect(view.getUint32(directory, true)).toBe(0x02014b50);
    expect(new TextDecoder().decode(archive)).toContain('%PDF-1.7\n%%EOF');
    expect(() => storedZip([{ name: '../escape', content: text('x') }])).toThrow();
  });
  it('removes PNG text/GPS payloads without changing its compressed image data', () => {
    const original = png(); const tagged = joined(original.subarray(0, 33), chunk('tEXt', text('Location\0GPS-SECRET')), original.subarray(33));
    const result = sanitizeMockFile(tagged); expect(result.mime).toBe('image/png'); expect(result.width).toBe(2); expect(result.height).toBe(1);
    expect(new TextDecoder().decode(result.content)).not.toContain('GPS-SECRET');
    const idat = text('IDAT');
    const find = (data: Uint8Array) => data.findIndex((v, i) => v === idat[0] && idat.every((b, j) => data[i + j] === b));
    const before = find(original), after = find(result.content);
    expect(result.content.slice(after, after + 19)).toEqual(original.slice(before, before + 19));
  });
  it('preserves orientation while replacing PNG EXIF with a minimal orientation-only record', () => {
    const original = png(); const tiff = exif();
    const result = sanitizeMockFile(joined(original.subarray(0, 33), chunk('eXIf', tiff), original.subarray(33)));
    expect(new TextDecoder().decode(result.content)).not.toContain('GPS-SECRET');
    const record = new DataView(result.content.buffer, 41, 26); expect(record.getUint16(8, true)).toBe(1); expect(record.getUint16(18, true)).toBe(6);
  });
  it('keeps JPEG scan bytes and orientation while removing GPS and embedded metadata', () => {
    const original = Uint8Array.from(atob(TEST_JPEG), (c) => c.charCodeAt(0)); const payload = joined(text('Exif\0\0'), exif());
    const source = joined(original.subarray(0, 2), Uint8Array.from([255, 225, 0, payload.length + 2]), payload, original.subarray(2));
    const result = sanitizeMockFile(source); expect(result.mime).toBe('image/jpeg'); expect([result.width, result.height]).toEqual([2, 1]);
    expect(new TextDecoder().decode(result.content)).not.toContain('GPS-SECRET'); expect(new DataView(result.content.buffer).getUint16(30, true)).toBe(6);
    const scan = (data: Uint8Array) => data.findIndex((b, i) => b === 255 && data[i + 1] === 218);
    expect(Array.from(result.content.slice(scan(result.content)))).toEqual(Array.from(original.slice(scan(original))));
  });
  it('rejects malformed content and preserves complete PDFs byte for byte', () => {
    const pdf = text('%PDF-1.7\nOriginal\n%%EOF\n'); const result = sanitizeMockFile(pdf);
    expect(result.mime).toBe('application/pdf'); expect(Array.from(result.content)).toEqual(Array.from(pdf));
    expect(() => sanitizeMockFile(text('%PDF-1.7\nTruncated'))).toThrow(); expect(() => sanitizeMockFile(text('<svg/>'))).toThrow();
    const invalid = png(); invalid[50] ^= 1; expect(() => sanitizeMockFile(invalid)).toThrow();
  });
});
