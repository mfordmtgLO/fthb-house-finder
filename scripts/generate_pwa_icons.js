// Copyright (c) 2026 Mike Ford, NMLS #288455. All Rights Reserved.
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

function createPng(width, height, r, g, b, accentR, accentG, accentB) {
  const bytesPerPixel = 4;
  const stride = width * bytesPerPixel;
  const rawData = Buffer.alloc((stride + 1) * height);

  for (let y = 0; y < height; y++) {
    const rowOffset = y * (stride + 1);
    rawData[rowOffset] = 0; // Filter byte 0 (None)

    for (let x = 0; x < width; x++) {
      const pixelOffset = rowOffset + 1 + x * bytesPerPixel;
      // Draw a house silhouette in the center
      const cx = width / 2;
      const cy = height / 2;
      const dx = Math.abs(x - cx);
      const dy = y - cy;

      const size = width * 0.28;
      const isRoof = y >= cy - size && y <= cy && dx <= (y - (cy - size)) * 1.05;
      const isBody = y > cy && y <= cy + size * 0.9 && dx <= size * 0.85;
      const isDoor = y > cy + size * 0.2 && y <= cy + size * 0.9 && dx <= size * 0.28;

      if ((isRoof || isBody) && !isDoor) {
        rawData[pixelOffset] = accentR;
        rawData[pixelOffset + 1] = accentG;
        rawData[pixelOffset + 2] = accentB;
        rawData[pixelOffset + 3] = 255;
      } else {
        // Gradient background
        const t = y / height;
        rawData[pixelOffset] = Math.round(r * (1 - t * 0.3));
        rawData[pixelOffset + 1] = Math.round(g * (1 - t * 0.3));
        rawData[pixelOffset + 2] = Math.round(b * (1 - t * 0.2));
        rawData[pixelOffset + 3] = 255;
      }
    }
  }

  const compressed = zlib.deflateSync(rawData);

  function crc32(buf) {
    let c = 0xffffffff;
    for (let i = 0; i < buf.length; i++) {
      c ^= buf[i];
      for (let j = 0; j < 8; j++) {
        c = (c >>> 1) ^ ((c & 1) ? 0xedb88320 : 0);
      }
    }
    return (c ^ 0xffffffff) >>> 0;
  }

  function makeChunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const typeBuf = Buffer.from(type, 'ascii');
    const crcBuf = Buffer.alloc(4);
    const crcVal = crc32(Buffer.concat([typeBuf, data]));
    crcBuf.writeUInt32BE(crcVal, 0);
    return Buffer.concat([len, typeBuf, data, crcBuf]);
  }

  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // bit depth
  ihdrData[9] = 6; // RGBA
  ihdrData[10] = 0; // compression
  ihdrData[11] = 0; // filter
  ihdrData[12] = 0; // interlace

  const ihdr = makeChunk('IHDR', ihdrData);
  const idat = makeChunk('IDAT', compressed);
  const iend = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([sig, ihdr, idat, iend]);
}

const outDir = path.resolve('./public');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

// 192x192
const icon192 = createPng(192, 192, 15, 23, 42, 56, 189, 248);
fs.writeFileSync(path.join(outDir, 'icon-192.png'), icon192);

// 512x512
const icon512 = createPng(512, 512, 15, 23, 42, 56, 189, 248);
fs.writeFileSync(path.join(outDir, 'icon-512.png'), icon512);

// Maskable 512x512
const maskable512 = createPng(512, 512, 15, 23, 42, 56, 189, 248);
fs.writeFileSync(path.join(outDir, 'icon-maskable-512.png'), maskable512);

// Apple touch icon 180x180
const appleIcon = createPng(180, 180, 15, 23, 42, 56, 189, 248);
fs.writeFileSync(path.join(outDir, 'apple-touch-icon.png'), appleIcon);

// OG Image 1200x630
const ogImage = createPng(1200, 630, 15, 23, 42, 56, 189, 248);
fs.writeFileSync(path.join(outDir, 'og-image.png'), ogImage);

console.log('Successfully generated PWA and OG icons.');
