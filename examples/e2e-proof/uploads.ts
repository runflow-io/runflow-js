/**
 * R2 upload helpers — used by the e2e proof to push the masks /
 * references that file-modality runs need.
 *
 * This is a TypeScript port of the prototype's `lib/r2.mjs` (AWS Sig V4
 * S3-compatible upload + presign). The chain it exercises is the same
 * one `/demos/api/upload` runs in production.
 */

import { createHash, createHmac } from "node:crypto";

function endpoint(): string {
  if (process.env.R2_ENDPOINT) return process.env.R2_ENDPOINT;
  const accountId = process.env.R2_ACCOUNT_ID;
  if (!accountId) return "";
  const raw = process.env.R2_JURISDICTION || "eu";
  const jur = raw && raw !== "default" ? `${raw}.` : "";
  return `https://${accountId}.${jur}r2.cloudflarestorage.com`;
}

function bucket(): string {
  return process.env.R2_BUCKET_NAME || process.env.R2_BUCKET || "";
}

const REGION = "auto";

function hmacSha256(key: Buffer | string, data: string): Buffer {
  return createHmac("sha256", key).update(data).digest();
}

function sha256(data: Buffer | string): string {
  return createHash("sha256").update(data).digest("hex");
}

function awsUriEncode(s: string): string {
  return encodeURIComponent(s).replace(
    /[!'()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

function encodeKeyPath(key: string): string {
  return key.split("/").map(awsUriEncode).join("/");
}

/**
 * Upload a Buffer to R2 and return a 30-minute presigned GET URL.
 * Mirrors the prototype's `/demos/api/upload` contract.
 */
export async function uploadAndPresign(
  key: string,
  body: Buffer,
  contentType: string,
  expiresInSeconds = 30 * 60,
): Promise<string> {
  const accessKey = process.env.R2_ACCESS_KEY_ID || "";
  const secretKey = process.env.R2_SECRET_ACCESS_KEY || "";
  const ENDPOINT = endpoint();
  const BUCKET = bucket();
  if (!accessKey || !secretKey || !ENDPOINT || !BUCKET) {
    throw new Error("R2 not configured (missing R2_* env vars).");
  }

  const now = new Date();
  const dateStamp = `${now.toISOString().replace(/[-:]/g, "").split(".")[0]}Z`;
  const shortDate = dateStamp.slice(0, 8);
  const payloadHash = sha256(body);
  const host = ENDPOINT.replace("https://", "").replace(`/${BUCKET}`, "");
  const path = `/${BUCKET}/${key}`;

  // PUT
  const putHeaders: Record<string, string> = {
    host,
    "x-amz-date": dateStamp,
    "x-amz-content-sha256": payloadHash,
    "content-type": contentType,
    "content-length": String(body.length),
  };
  const signedHeaderKeys = Object.keys(putHeaders).sort();
  const signedHeaders = signedHeaderKeys.join(";");
  const canonicalHeaders = signedHeaderKeys.map((k) => `${k}:${putHeaders[k]}\n`).join("");
  const canonicalRequest = ["PUT", path, "", canonicalHeaders, signedHeaders, payloadHash].join(
    "\n",
  );
  const scope = `${shortDate}/${REGION}/s3/aws4_request`;
  const stringToSign = ["AWS4-HMAC-SHA256", dateStamp, scope, sha256(canonicalRequest)].join("\n");
  const kDate = hmacSha256(`AWS4${secretKey}`, shortDate);
  const kRegion = hmacSha256(kDate, REGION);
  const kService = hmacSha256(kRegion, "s3");
  const kSigning = hmacSha256(kService, "aws4_request");
  const signature = hmacSha256(kSigning, stringToSign).toString("hex");
  const authorization = `AWS4-HMAC-SHA256 Credential=${accessKey}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const url = `${ENDPOINT.replace(`/${BUCKET}`, "")}${path}`;
  const res = await fetch(url, {
    method: "PUT",
    headers: { ...putHeaders, authorization },
    body: new Uint8Array(body) as unknown as BodyInit,
  });
  if (!res.ok)
    throw new Error(`R2 upload ${res.status}: ${await res.text().then((s) => s.slice(0, 200))}`);

  // Presign GET
  const params: Array<[string, string]> = [
    ["X-Amz-Algorithm", "AWS4-HMAC-SHA256"],
    ["X-Amz-Credential", `${accessKey}/${scope}`],
    ["X-Amz-Date", dateStamp],
    ["X-Amz-Expires", String(expiresInSeconds)],
    ["X-Amz-SignedHeaders", "host"],
  ];
  params.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  const canonicalQs = params.map(([k, v]) => `${awsUriEncode(k)}=${awsUriEncode(v)}`).join("&");
  const ch = `host:${host}\n`;
  const cr = [
    "GET",
    `/${BUCKET}/${encodeKeyPath(key)}`,
    canonicalQs,
    ch,
    "host",
    "UNSIGNED-PAYLOAD",
  ].join("\n");
  const sts = ["AWS4-HMAC-SHA256", dateStamp, scope, sha256(cr)].join("\n");
  const sig = hmacSha256(kSigning, sts).toString("hex");
  return `${ENDPOINT.replace(`/${BUCKET}`, "")}/${BUCKET}/${encodeKeyPath(key)}?${canonicalQs}&X-Amz-Signature=${sig}`;
}

/**
 * Download `url` and return its bytes. Used to fetch sample images so we
 * can re-upload them to R2 (`runflow/reference-inpaint` requires URLs
 * served from a bucket the model worker can reach without auth headers).
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

  const idatRaw = data;
  const idat = zlibDeflate(idatRaw);

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

import { deflateSync } from "node:zlib";
function zlibDeflate(buf: Buffer): Buffer {
  return deflateSync(buf);
}
