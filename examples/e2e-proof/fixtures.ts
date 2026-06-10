/**
 * Proof fixtures — sample bytes the e2e run uploads through
 * `rf.assets.upload`. (The previous R2 Sig V4 side-channel lived here;
 * it's gone now that the SDK's presigned upload flow covers the same
 * need with only the Runflow API key.)
 */

import { deflateSync } from "node:zlib";

/**
 * Download `url` and return its bytes. Used to fetch sample images so
 * we can re-upload them as Runflow assets the model workers can reach.
 */
export async function fetchBytes(url: string): Promise<Buffer> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`fetch ${r.status} for ${url}`);
  return Buffer.from(await r.arrayBuffer());
}

/**
 * Build a 512×512 PNG mask: a white centered rectangle on black. Marks
 * the central ~45% of the image as the inpaint region, leaving the
 * borders preserved.
 */
export function buildSampleMask(): Buffer {
  // Minimal PNG encoder for an 8-bit greyscale 512×512 image. Built
  // inline to avoid a runtime dep — the proof script needs to stay
  // self-contained.
  const W = 512;
  const H = 512;
  const data = Buffer.alloc(H * (1 + W)); // each row: filter byte + W bytes
  for (let y = 0; y < H; y++) {
    data[y * (1 + W)] = 0; // filter: None
    const inner = y > H * 0.27 && y < H * 0.72;
    for (let x = 0; x < W; x++) {
      const px = inner && x > W * 0.27 && x < W * 0.72 ? 0xff : 0x00;
      data[y * (1 + W) + 1 + x] = px;
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 0; // grayscale
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const idat = deflateSync(data);

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (const b of buf) {
    c ^= b;
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return (c ^ 0xffffffff) >>> 0;
}
