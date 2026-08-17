import fs from 'fs';
import zlib from 'zlib';

/**
 * Pure Node.js PNG generator with CRC32 and DEFLATE
 */
function createPNG(width, height, drawFn) {
  // RGBA buffer: height rows, each starting with filter byte 0
  const rowSize = width * 4 + 1;
  const rawData = Buffer.alloc(height * rowSize, 0);

  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowSize;
    rawData[rowOffset] = 0; // Filter: None
    for (let x = 0; x < width; x++) {
      const pixelOffset = rowOffset + 1 + x * 4;
      const [r, g, b, a] = drawFn(x, y, width, height);
      rawData[pixelOffset] = r;
      rawData[pixelOffset + 1] = g;
      rawData[pixelOffset + 2] = b;
      rawData[pixelOffset + 3] = a;
    }
  }

  const compressed = zlib.deflateSync(rawData);

  // PNG Signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR chunk
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA color type
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace
  const ihdrChunk = createChunk('IHDR', ihdr);

  // IDAT chunk
  const idatChunk = createChunk('IDAT', compressed);

  // IEND chunk
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function createChunk(type, data) {
  const len = data.length;
  const chunk = Buffer.alloc(4 + 4 + len + 4);
  chunk.writeUInt32BE(len, 0);
  chunk.write(type, 4, 4, 'ascii');
  data.copy(chunk, 8);
  const crc = crc32(chunk.subarray(4, 8 + len));
  chunk.writeUInt32BE(crc, 8 + len);
  return chunk;
}

function crc32(buf) {
  let crc = 0 ^ (-1);
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xff];
  }
  return (crc ^ (-1)) >>> 0;
}

const table = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let k = 0; k < 8; k++) {
    c = ((c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1));
  }
  table[i] = c;
}

// Draw DineExpress Shield & Checkmark
function drawIcon(x, y, w, h) {
  const nx = x / w;
  const ny = y / h;

  // Background rounded rectangle
  const cx = nx - 0.5;
  const cy = ny - 0.5;
  const distSq = cx * cx + cy * cy;

  // Rounded square border radius ~ 0.25
  const cornerRadius = 0.22;
  const insideRoundedBox = Math.abs(cx) < 0.44 && Math.abs(cy) < 0.44;
  
  if (distSq > 0.23 && !insideRoundedBox) {
    return [0, 0, 0, 0]; // Transparent outside
  }

  // Emerald Green gradient background
  const greenR = Math.round(16 + (4 - 16) * ny);
  const greenG = Math.round(185 + (120 - 185) * ny);
  const greenB = Math.round(129 + (87 - 129) * ny);

  // White shield in center
  const shieldTop = 0.22;
  const shieldBottom = 0.82;
  const isInsideShield = (ny >= shieldTop && ny <= shieldBottom && Math.abs(cx) <= (0.35 * (1 - Math.max(0, (ny - 0.45) / 0.45))));

  if (isInsideShield) {
    // Checkmark coordinates
    // Line 1: (0.42, 0.55) to (0.50, 0.64)
    // Line 2: (0.50, 0.64) to (0.64, 0.44)
    const distToLine1 = distToSegment(nx, ny, 0.38, 0.54, 0.48, 0.64);
    const distToLine2 = distToSegment(nx, ny, 0.48, 0.64, 0.65, 0.42);
    const isCheck = Math.min(distToLine1, distToLine2) < 0.045;

    if (isCheck) {
      return [5, 150, 105, 255]; // Dark emerald checkmark
    }

    return [255, 255, 255, 250]; // White shield
  }

  return [greenR, greenG, greenB, 255];
}

function distToSegment(px, py, x1, y1, x2, y2) {
  const l2 = (x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1);
  if (l2 === 0) return Math.hypot(px - x1, py - y1);
  let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * (x2 - x1)), py - (y1 + t * (y2 - y1)));
}

// Generate all sizes
const sizes = [16, 32, 48, 128];
for (const size of sizes) {
  const buffer = createPNG(size, size, drawIcon);
  fs.writeFileSync(`/Users/yuxuanzhu/dev/dine_express/icons/icon${size}.png`, buffer);
  console.log(`✅ Generated icons/icon${size}.png (${buffer.length} bytes)`);
}
