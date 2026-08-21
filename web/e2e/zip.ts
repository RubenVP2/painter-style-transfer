/**
 * Reader for the archives produced by src/lib/zip.ts — enough of the format to
 * assert what a batch export actually contains. Only the "stored" method is
 * supported, which is the only one the app writes.
 */
export type ZipEntry = { name: string; data: Buffer };

export function readZip(buffer: Buffer): ZipEntry[] {
  const eocd = buffer.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (eocd < 0) throw new Error("archive ZIP invalide : pas d'End Of Central Directory");

  const count = buffer.readUInt16LE(eocd + 10);
  let cursor = buffer.readUInt32LE(eocd + 16);
  const entries: ZipEntry[] = [];

  for (let index = 0; index < count; index += 1) {
    if (buffer.readUInt32LE(cursor) !== 0x02014b50) throw new Error("en-tête central invalide");
    const method = buffer.readUInt16LE(cursor + 10);
    if (method !== 0) throw new Error(`méthode ${method} non supportée`);
    const size = buffer.readUInt32LE(cursor + 24);
    const nameLength = buffer.readUInt16LE(cursor + 28);
    const extraLength = buffer.readUInt16LE(cursor + 30);
    const commentLength = buffer.readUInt16LE(cursor + 32);
    const offset = buffer.readUInt32LE(cursor + 42);
    const name = buffer.toString("utf8", cursor + 46, cursor + 46 + nameLength);

    // The local header repeats the name and may carry its own extra field.
    const localNameLength = buffer.readUInt16LE(offset + 26);
    const localExtraLength = buffer.readUInt16LE(offset + 28);
    const start = offset + 30 + localNameLength + localExtraLength;
    entries.push({ name, data: buffer.subarray(start, start + size) });

    cursor += 46 + nameLength + extraLength + commentLength;
  }

  return entries;
}
