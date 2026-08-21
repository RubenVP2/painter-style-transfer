/**
 * Minimal ZIP writer, "stored" (uncompressed) only.
 *
 * The archive only ever holds JPG/PNG exports, which are already compressed —
 * deflating them again would cost CPU for a fraction of a percent. Storing them
 * keeps this to a few header structures and avoids pulling a zip dependency
 * into a bundle that currently has none, in the same spirit as the hand-rolled
 * PNG encoder the test suite uses.
 *
 * The classic (non-Zip64) format is used, so an archive is capped at 65 535
 * entries and 4 GB — far beyond the 24 mockups a batch can hold.
 */

const CRC_TABLE = /* @__PURE__ */ (() =>
  Int32Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c;
  }))();

function crc32(bytes: Bytes) {
  let crc = -1;
  for (let i = 0; i < bytes.length; i += 1) crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ -1) >>> 0;
}

/** MS-DOS packed date/time, the only timestamp the base format carries. */
function dosStamp(date: Date) {
  const time =
    (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
  const day =
    ((Math.max(1980, date.getFullYear()) - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return { time, day };
}

/** Explicitly backed by an ArrayBuffer, which is what `Blob` accepts as a part. */
export type Bytes = Uint8Array<ArrayBuffer>;

type Writer = { view: DataView; bytes: Bytes; offset: number };

function writer(size: number): Writer {
  const bytes = new Uint8Array(size);
  return { bytes, view: new DataView(bytes.buffer), offset: 0 };
}

function u16(w: Writer, value: number) {
  w.view.setUint16(w.offset, value, true);
  w.offset += 2;
}

function u32(w: Writer, value: number) {
  w.view.setUint32(w.offset, value >>> 0, true);
  w.offset += 4;
}

function raw(w: Writer, value: Bytes) {
  w.bytes.set(value, w.offset);
  w.offset += value.length;
}

export type ZipEntry = { name: string; data: Bytes };

/**
 * Packs `entries` into a ZIP blob. Names are written as UTF-8 with the language
 * encoding flag set, so accented filenames survive the round trip.
 */
export function createZip(entries: ZipEntry[], now = new Date()): Blob {
  const { time, day } = dosStamp(now);
  const encoder = new TextEncoder();
  const parts: BlobPart[] = [];
  const central: Bytes[] = [];
  let offset = 0;

  for (const entry of entries) {
    const name = encoder.encode(entry.name);
    const crc = crc32(entry.data);

    const local = writer(30 + name.length);
    u32(local, 0x04034b50);
    u16(local, 20); // version needed
    u16(local, 0x0800); // UTF-8 filename
    u16(local, 0); // stored
    u16(local, time);
    u16(local, day);
    u32(local, crc);
    u32(local, entry.data.length);
    u32(local, entry.data.length);
    u16(local, name.length);
    u16(local, 0); // extra field length
    raw(local, name);

    parts.push(local.bytes, entry.data);

    const header = writer(46 + name.length);
    u32(header, 0x02014b50);
    u16(header, 20); // version made by
    u16(header, 20); // version needed
    u16(header, 0x0800);
    u16(header, 0); // stored
    u16(header, time);
    u16(header, day);
    u32(header, crc);
    u32(header, entry.data.length);
    u32(header, entry.data.length);
    u16(header, name.length);
    u16(header, 0); // extra
    u16(header, 0); // comment
    u16(header, 0); // disk number
    u16(header, 0); // internal attributes
    u32(header, 0); // external attributes
    u32(header, offset);
    raw(header, name);
    central.push(header.bytes);

    offset += local.bytes.length + entry.data.length;
  }

  const centralSize = central.reduce((total, header) => total + header.length, 0);
  const end = writer(22);
  u32(end, 0x06054b50);
  u16(end, 0); // this disk
  u16(end, 0); // disk with the central directory
  u16(end, entries.length);
  u16(end, entries.length);
  u32(end, centralSize);
  u32(end, offset);
  u16(end, 0); // comment length

  return new Blob([...parts, ...central, end.bytes], { type: "application/zip" });
}
