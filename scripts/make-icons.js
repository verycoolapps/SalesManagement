/**
 * =============================================================================
 * © 2026 VeryCoolApps — PT. Agra Karya Digital
 * ALL RIGHTS RESERVED — PROPRIETARY & CONFIDENTIAL
 * =============================================================================
 * SalesDesk Pro v1.0.0 — Icon generator (pure Node: zlib PNG + ICO wrapper)
 * Output: renderer/assets/icon.png, renderer/assets/tray.png, build/icon.ico
 * =============================================================================
 */
'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// --- Mini bitmap font 5x7 ---
const FONT = {
  S: ['01110', '10001', '10000', '01110', '00001', '10001', '01110'],
  D: ['11110', '10001', '10001', '10001', '10001', '10001', '11110'],
  P: ['11110', '10001', '10001', '11110', '10000', '10000', '10000'],
  '1': ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
  '0': ['01110', '10001', '10011', '10101', '11001', '10001', '01110'],
  '2': ['01110', '10001', '00001', '00010', '00100', '01000', '11111']
};

function drawText(glyphs, scale, color) {
  // glyphs: array of chars; returns array of [x, y] pixels at scale
  const pixels = [];
  const gw = 5, gh = 7;
  let cursorX = 0;
  for (const ch of glyphs) {
    const g = FONT[ch];
    if (!g) { cursorX += gw + 1; continue; }
    for (let r = 0; r < gh; r++) {
      for (let c = 0; c < gw; c++) {
        if (g[r][c] === '1') {
          for (let dy = 0; dy < scale; dy++) for (let dx = 0; dx < scale; dx++) {
            pixels.push([cursorX + c * scale + dx, r * scale + dy, color]);
          }
        }
      }
    }
    cursorX += (gw + 1) * scale;
  }
  return pixels;
}

function crc32(buf) {
  let table = crc32.table;
  if (!table) {
    table = crc32.table = [];
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const t = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, crc]);
}

function encodePNG(width, height, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8-bit RGBA
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0; // filter none
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

/** Buat icon brand: navy rounded bg + gradien + 4 dot pipeline + teks */
function makeIcon(size) {
  const px = Buffer.alloc(size * size * 4);
  const set = (x, y, r, g, b, a) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    const i = (y * size + x) * 4;
    const na = a / 255;
    px[i] = Math.round(r * na + px[i] * (1 - na));
    px[i + 1] = Math.round(g * na + px[i + 1] * (1 - na));
    px[i + 2] = Math.round(b * na + px[i + 2] * (1 - na));
    px[i + 3] = Math.max(px[i + 3], a);
  };
  const navy1 = hexToRgb('#0E76D6'), navy2 = hexToRgb('#15233B');
  const radius = size * 0.22;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const cx = Math.min(Math.max(x, radius), size - radius);
    const cy = Math.min(Math.max(y, radius), size - radius);
    const dx = x - cx, dy = y - cy;
    const inside = (dx * dx + dy * dy) <= radius * radius;
    if (inside) {
      const t = (x + y) / (2 * size);
      set(x, y, Math.round(navy2[0] + (navy1[0] - navy2[0]) * t), Math.round(navy2[1] + (navy1[1] - navy2[1]) * t), Math.round(navy2[2] + (navy1[2] - navy2[2]) * t), 255);
    } else {
      set(x, y, 0, 0, 0, 0);
    }
  }
  // 4 dot pipeline (kiri atas)
  const dotColors = ['#059669', '#0E76D6', '#D97706', '#DC2626'];
  const dotR = size * 0.045;
  for (let i = 0; i < 4; i++) {
    const [r, g, b] = hexToRgb(dotColors[i]);
    const cx = size * 0.20 + i * size * 0.06;
    const cy = size * 0.22;
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const d = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
      if (d <= dotR) set(x, y, r, g, b, 255);
    }
  }
  // Teks "SDP" putih
  const textScale = Math.max(1, Math.round(size / 90));
  const textColor = [255, 255, 255];
  const glyphPixels = drawText(['S', 'D', 'P'], textScale, textColor);
  const textW = 17 * textScale, textH = 7 * textScale;
  const tx = Math.round((size - textW) / 2), ty = Math.round(size * 0.52);
  for (const [x, y] of glyphPixels) set(tx + x, ty + y, textColor[0], textColor[1], textColor[2], 255);
  // sub badge "VCA"
  const subScale = Math.max(1, Math.round(size / 140));
  const subPix = drawText(['V', 'C', 'A'], subScale, textColor);
  const subW = 17 * subScale;
  const stx = Math.round((size - subW) / 2), sty = Math.round(size * 0.78);
  for (const [x, y] of subPix) set(stx + x, sty + y, 200, 220, 255, 200);
  return px;
}

function makeTray(size) {
  const px = Buffer.alloc(size * size * 4);
  const set = (x, y, r, g, b, a) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    const i = (y * size + x) * 4;
    const na = a / 255;
    px[i] = Math.round(r * na); px[i + 1] = Math.round(g * na); px[i + 2] = Math.round(b * na);
    px[i + 3] = Math.max(px[i + 3], a);
  };
  // "S" mini
  const [r, g, b] = hexToRgb('#0E76D6');
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const cx = x - size / 2, cy = y - size / 2;
    if (cx * cx + cy * cy <= (size / 2) ** 2) set(x, y, r, g, b, 255);
  }
  return px;
}

function writeIco(entries) {
  // entries: [{size, png}]
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); header.writeUInt16LE(1, 2); header.writeUInt16LE(entries.length, 4);
  let offset = 6 + entries.length * 16;
  const dirs = [];
  for (const e of entries) {
    const d = Buffer.alloc(16);
    d[0] = e.size >= 256 ? 0 : e.size; d[1] = e.size >= 256 ? 0 : e.size;
    d[2] = 0; d[3] = 0;
    d.writeUInt16LE(1, 4); d.writeUInt16LE(32, 6);
    d.writeUInt32LE(e.png.length, 8);
    d.writeUInt32LE(offset, 12);
    offset += e.png.length;
    dirs.push(d);
  }
  return Buffer.concat([header, ...dirs, ...entries.map(e => e.png)]);
}

function main() {
  const root = path.join(__dirname, '..');
  const outIcon = path.join(root, 'renderer', 'assets');
  const outBuild = path.join(root, 'build');
  fs.mkdirSync(outIcon, { recursive: true });
  fs.mkdirSync(outBuild, { recursive: true });

  // renderer assets
  fs.writeFileSync(path.join(outIcon, 'icon.png'), encodePNG(256, 256, makeIcon(256)));
  fs.writeFileSync(path.join(outIcon, 'icon-1024.png'), encodePNG(1024, 1024, makeIcon(1024)));
  fs.writeFileSync(path.join(outIcon, 'tray.png'), encodePNG(16, 16, makeTray(16)));

  // build/icon.ico — multi-size (16/32/48/256)
  const entries = [16, 32, 48, 256].map(s => ({ size: s, png: encodePNG(s, s, makeIcon(s)) }));
  fs.writeFileSync(path.join(outBuild, 'icon.ico'), writeIco(entries));

  console.log('Icons OK:', path.join(outIcon, 'icon.png'), path.join(outBuild, 'icon.ico'));
}

main();
