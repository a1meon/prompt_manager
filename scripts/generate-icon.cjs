const fs = require('fs');
const path = require('path');

function writeUInt16LE(buf, value, offset) {
  buf.writeUInt16LE(value & 0xffff, offset);
}

function writeUInt32LE(buf, value, offset) {
  buf.writeUInt32LE(value >>> 0, offset);
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function rgba(r, g, b, a = 255) {
  return { r, g, b, a };
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function mix(c1, c2, t) {
  return rgba(
    Math.round(lerp(c1.r, c2.r, t)),
    Math.round(lerp(c1.g, c2.g, t)),
    Math.round(lerp(c1.b, c2.b, t)),
    Math.round(lerp(c1.a, c2.a, t))
  );
}

function blendPixel(pixels, w, x, y, color) {
  if (color.a <= 0) return;
  const idx = (y * w + x) * 4;

  if (color.a >= 255) {
    pixels[idx + 0] = color.b;
    pixels[idx + 1] = color.g;
    pixels[idx + 2] = color.r;
    pixels[idx + 3] = 255;
    return;
  }

  const a = color.a / 255;
  const inv = 1 - a;
  pixels[idx + 0] = Math.round(color.b * a + pixels[idx + 0] * inv);
  pixels[idx + 1] = Math.round(color.g * a + pixels[idx + 1] * inv);
  pixels[idx + 2] = Math.round(color.r * a + pixels[idx + 2] * inv);
  pixels[idx + 3] = Math.round(color.a + pixels[idx + 3] * inv);
}

function drawRoundedRect(pixels, w, h, radius, color) {
  const r2 = radius * radius;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const inCorner =
        (x < radius && y < radius) ||
        (x >= w - radius && y < radius) ||
        (x < radius && y >= h - radius) ||
        (x >= w - radius && y >= h - radius);

      if (inCorner) {
        const cx = x < radius ? radius - 1 : w - radius;
        const cy = y < radius ? radius - 1 : h - radius;
        const dx = x - cx;
        const dy = y - cy;
        if (dx * dx + dy * dy > r2) continue;
      }

      blendPixel(pixels, w, x, y, color);
    }
  }
}

function drawRect(pixels, w, h, x0, y0, x1, y1, color) {
  const minX = clamp(Math.floor(Math.min(x0, x1)), 0, w - 1);
  const maxX = clamp(Math.ceil(Math.max(x0, x1)), 0, w - 1);
  const minY = clamp(Math.floor(Math.min(y0, y1)), 0, h - 1);
  const maxY = clamp(Math.ceil(Math.max(y0, y1)), 0, h - 1);

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      blendPixel(pixels, w, x, y, color);
    }
  }
}

function drawLine(pixels, w, h, x0, y0, x1, y1, thickness, color) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const half = thickness / 2;

  const minX = clamp(Math.floor(Math.min(x0, x1) - thickness), 0, w - 1);
  const maxX = clamp(Math.ceil(Math.max(x0, x1) + thickness), 0, w - 1);
  const minY = clamp(Math.floor(Math.min(y0, y1) - thickness), 0, h - 1);
  const maxY = clamp(Math.ceil(Math.max(y0, y1) + thickness), 0, h - 1);

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const px = x - x0;
      const py = y - y0;
      const proj = (px * dx + py * dy) / (len * len);
      if (proj < 0 || proj > 1) continue;
      const closestX = x0 + proj * dx;
      const closestY = y0 + proj * dy;
      const distX = x - closestX;
      const distY = y - closestY;
      const dist = Math.sqrt(distX * distX + distY * distY);
      if (dist > half) continue;

      blendPixel(pixels, w, x, y, color);
    }
  }
}

function drawCircle(pixels, w, h, cx, cy, radius, color) {
  const r2 = radius * radius;
  const minX = clamp(Math.floor(cx - radius), 0, w - 1);
  const maxX = clamp(Math.ceil(cx + radius), 0, w - 1);
  const minY = clamp(Math.floor(cy - radius), 0, h - 1);
  const maxY = clamp(Math.ceil(cy + radius), 0, h - 1);

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy > r2) continue;
      blendPixel(pixels, w, x, y, color);
    }
  }
}

function drawBackground(pixels, size) {
  const w = size;
  const h = size;

  const bg0 = rgba(11, 18, 32, 255);
  const bg1 = rgba(79, 70, 229, 255);
  const bg2 = rgba(34, 211, 238, 255);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const t = (x + y) / (w + h - 2);
      const t2 = Math.max(0, Math.min(1, (t - 0.15) / 0.85));
      const base = mix(bg0, bg1, t2);
      const glowT = Math.max(0, 1 - Math.hypot(x - w * 0.25, y - h * 0.25) / (w * 0.6));
      const glow = mix(base, bg2, glowT * 0.25);
      blendPixel(pixels, w, x, y, glow);
    }
  }

  drawRoundedRect(pixels, w, h, Math.round(size * 0.22), rgba(255, 255, 255, 18));
}

function isInRoundedRect(x, y, rx, ry, rw, rh, r) {
  if (x < rx || x >= rx + rw || y < ry || y >= ry + rh) return false;
  if (x >= rx + r && x < rx + rw - r) return true;
  if (y >= ry + r && y < ry + rh - r) return true;

  const cx = x < rx + r ? rx + r : rx + rw - r - 1;
  const cy = y < ry + r ? ry + r : ry + rh - r - 1;
  const dx = x - cx;
  const dy = y - cy;
  return dx * dx + dy * dy <= r * r;
}

function isInTriangle(x, y, ax, ay, bx, by, cx, cy) {
  const v0x = cx - ax;
  const v0y = cy - ay;
  const v1x = bx - ax;
  const v1y = by - ay;
  const v2x = x - ax;
  const v2y = y - ay;

  const dot00 = v0x * v0x + v0y * v0y;
  const dot01 = v0x * v1x + v0y * v1y;
  const dot02 = v0x * v2x + v0y * v2y;
  const dot11 = v1x * v1x + v1y * v1y;
  const dot12 = v1x * v2x + v1y * v2y;

  const invDenom = 1 / (dot00 * dot11 - dot01 * dot01);
  const u = (dot11 * dot02 - dot01 * dot12) * invDenom;
  const v = (dot00 * dot12 - dot01 * dot02) * invDenom;
  return u >= 0 && v >= 0 && u + v <= 1;
}

function drawPromptBubble(pixels, size) {
  const w = size;
  const h = size;

  const bubbleFill = rgba(255, 255, 255, 245);
  const bubbleStroke = rgba(255, 255, 255, 255);
  const ink = rgba(79, 70, 229, 255);
  const inkSoft = rgba(99, 102, 241, 200);

  const stroke = Math.max(2, Math.round(size * 0.04));
  const rOuter = Math.round(size * 0.14);
  const rInner = Math.max(2, rOuter - stroke);

  const rectX = Math.round(size * 0.16);
  const rectY = Math.round(size * 0.22);
  const rectW = Math.round(size * 0.68);
  const rectH = Math.round(size * 0.48);

  const tailAx = rectX + Math.round(rectW * 0.24);
  const tailAy = rectY + rectH - 1;
  const tailBx = tailAx - Math.round(size * 0.11);
  const tailBy = tailAy + Math.round(size * 0.16);
  const tailCx = tailAx + Math.round(size * 0.12);
  const tailCy = tailAy + Math.round(size * 0.06);

  const bboxMinX = clamp(rectX - stroke - 2, 0, w - 1);
  const bboxMaxX = clamp(rectX + rectW + stroke + 2, 0, w - 1);
  const bboxMinY = clamp(rectY - stroke - 2, 0, h - 1);
  const bboxMaxY = clamp(tailBy + stroke + 2, 0, h - 1);

  for (let y = bboxMinY; y <= bboxMaxY; y++) {
    for (let x = bboxMinX; x <= bboxMaxX; x++) {
      const inOuter =
        isInRoundedRect(x, y, rectX, rectY, rectW, rectH, rOuter) ||
        isInTriangle(x, y, tailAx, tailAy, tailBx, tailBy, tailCx, tailCy);
      if (!inOuter) continue;
      blendPixel(pixels, w, x, y, bubbleStroke);
    }
  }

  const innerX = rectX + stroke;
  const innerY = rectY + stroke;
  const innerW = rectW - stroke * 2;
  const innerH = rectH - stroke * 2;

  const itailAx = tailAx;
  const itailAy = tailAy - stroke;
  const itailBx = tailBx + stroke;
  const itailBy = tailBy - stroke;
  const itailCx = tailCx - stroke;
  const itailCy = tailCy - stroke;

  for (let y = bboxMinY; y <= bboxMaxY; y++) {
    for (let x = bboxMinX; x <= bboxMaxX; x++) {
      const inInner =
        isInRoundedRect(x, y, innerX, innerY, innerW, innerH, rInner) ||
        isInTriangle(x, y, itailAx, itailAy, itailBx, itailBy, itailCx, itailCy);
      if (!inInner) continue;
      blendPixel(pixels, w, x, y, bubbleFill);
    }
  }

  const lineH = Math.max(2, Math.round(size * 0.05));
  const padX = Math.round(size * 0.08);
  const startX = rectX + padX;
  const startY = rectY + Math.round(size * 0.14);
  const gapY = Math.round(size * 0.09);

  const line1W = Math.round(size * 0.44);
  const line2W = Math.round(size * 0.34);
  const line3W = Math.round(size * 0.28);

  drawRect(pixels, w, h, startX, startY, startX + line1W, startY + lineH, rgba(79, 70, 229, 210));
  drawRect(
    pixels,
    w,
    h,
    startX,
    startY + gapY,
    startX + line2W,
    startY + gapY + lineH,
    rgba(99, 102, 241, 185)
  );
  drawRect(
    pixels,
    w,
    h,
    startX,
    startY + gapY * 2,
    startX + line3W,
    startY + gapY * 2 + lineH,
    rgba(129, 140, 248, 165)
  );

  const sparkCx = rectX + rectW - Math.round(size * 0.16);
  const sparkCy = rectY + Math.round(size * 0.16);
  const sparkLen = Math.round(size * 0.11);
  const sparkTh = Math.max(2, Math.round(size * 0.04));
  drawLine(pixels, w, h, sparkCx - sparkLen, sparkCy, sparkCx + sparkLen, sparkCy, sparkTh, ink);
  drawLine(pixels, w, h, sparkCx, sparkCy - sparkLen, sparkCx, sparkCy + sparkLen, sparkTh, ink);
  drawLine(
    pixels,
    w,
    h,
    sparkCx - sparkLen * 0.7,
    sparkCy - sparkLen * 0.7,
    sparkCx + sparkLen * 0.7,
    sparkCy + sparkLen * 0.7,
    Math.max(1, sparkTh - 1),
    inkSoft
  );
  drawLine(
    pixels,
    w,
    h,
    sparkCx + sparkLen * 0.7,
    sparkCy - sparkLen * 0.7,
    sparkCx - sparkLen * 0.7,
    sparkCy + sparkLen * 0.7,
    Math.max(1, sparkTh - 1),
    inkSoft
  );
}

function generateIcoImage(size) {
  const w = size;
  const h = size;
  const pixels = Buffer.alloc(w * h * 4, 0);

  drawBackground(pixels, size);
  drawPromptBubble(pixels, size);

  const andMaskRowBytes = Math.ceil(w / 32) * 4;
  const andMask = Buffer.alloc(andMaskRowBytes * h, 0);

  const header = Buffer.alloc(40);
  writeUInt32LE(header, 40, 0);
  writeUInt32LE(header, w, 4);
  writeUInt32LE(header, h * 2, 8);
  writeUInt16LE(header, 1, 12);
  writeUInt16LE(header, 32, 14);
  writeUInt32LE(header, 0, 16);
  writeUInt32LE(header, w * h * 4, 20);
  writeUInt32LE(header, 0, 24);
  writeUInt32LE(header, 0, 28);
  writeUInt32LE(header, 0, 32);
  writeUInt32LE(header, 0, 36);

  const pixelData = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++) {
    const srcRow = y * w * 4;
    const dstRow = (h - 1 - y) * w * 4;
    pixels.copy(pixelData, dstRow, srcRow, srcRow + w * 4);
  }

  return Buffer.concat([header, pixelData, andMask]);
}

function buildIco() {
  const sizes = [256, 64, 48, 32, 16];
  const images = sizes.map((s) => ({ size: s, data: generateIcoImage(s) }));

  const iconDir = Buffer.alloc(6);
  writeUInt16LE(iconDir, 0, 0);
  writeUInt16LE(iconDir, 1, 2);
  writeUInt16LE(iconDir, images.length, 4);

  const entries = [];
  let offset = 6 + 16 * images.length;
  for (const img of images) {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(img.size === 256 ? 0 : img.size, 0);
    entry.writeUInt8(img.size === 256 ? 0 : img.size, 1);
    entry.writeUInt8(0, 2);
    entry.writeUInt8(0, 3);
    writeUInt16LE(entry, 1, 4);
    writeUInt16LE(entry, 32, 6);
    writeUInt32LE(entry, img.data.length, 8);
    writeUInt32LE(entry, offset, 12);
    entries.push(entry);
    offset += img.data.length;
  }

  return Buffer.concat([iconDir, ...entries, ...images.map((i) => i.data)]);
}

function main() {
  const outDir = path.join(__dirname, '..', 'build');
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, 'icon.ico');
  fs.writeFileSync(outPath, buildIco());
  process.stdout.write(`Icon generated: ${outPath}\n`);
}

main();
