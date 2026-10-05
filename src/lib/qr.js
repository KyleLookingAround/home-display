/* QR codes, made here so nothing has to be loaded: byte mode, medium error correction, the smallest version that fits. */
// Shared ES module. The display's build (build.py) also concatenates it for TV browsers, removing the
// import lines and export keywords, so keep imports on one line each and the syntax Chromium 63 can parse.
// Follows ISO/IEC 18004; the structure is after Project Nayuki's QR Code generator (MIT licence).

// Medium error correction: codewords per block and the number of blocks, by version (1 to 40).
const QR_ECC = [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28];
const QR_BLOCKS = [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49];

function qrRawModules(v){
  let r = (16 * v + 128) * v + 64;
  if (v >= 2){ const n = Math.floor(v / 7) + 2; r -= (25 * n - 10) * n - 55; if (v >= 7) r -= 36; }
  return r;
}
const qrDataCodewords = v => Math.floor(qrRawModules(v) / 8) - QR_ECC[v] * QR_BLOCKS[v];
function qrAlignment(v){
  if (v === 1) return [];
  const n = Math.floor(v / 7) + 2, step = v === 32 ? 26 : Math.ceil((v * 4 + 4) / (n * 2 - 2)) * 2, out = [6];
  for (let pos = v * 4 + 10; out.length < n; pos -= step) out.splice(1, 0, pos);
  return out;
}
// Reed-Solomon over GF(2^8) with the polynomial 0x11D
function gfMul(x, y){ let z = 0; for (let i = 7; i >= 0; i--){ z = (z << 1) ^ ((z >>> 7) * 0x11D); z ^= ((y >>> i) & 1) * x; } return z; }
function rsDivisor(degree){
  const r = []; for (let i = 0; i < degree; i++) r.push(0);
  r[degree - 1] = 1; let root = 1;
  for (let i = 0; i < degree; i++){
    for (let j = 0; j < r.length; j++){ r[j] = gfMul(r[j], root); if (j + 1 < r.length) r[j] ^= r[j + 1]; }
    root = gfMul(root, 2);
  }
  return r;
}
function rsRemainder(data, div){
  const r = div.map(() => 0);
  data.forEach(b => { const f = b ^ r.shift(); r.push(0); div.forEach((c, i) => { r[i] ^= gfMul(c, f); }); });
  return r;
}

/** The modules of a QR code for some text: { size, dark(x, y) }. Null if it's too long (about 2,300 bytes). */
export function qrEncode(text){
  const bytes = [], utf8 = unescape(encodeURIComponent(String(text)));
  for (let i = 0; i < utf8.length; i++) bytes.push(utf8.charCodeAt(i));
  let v = 1;
  for (; v <= 40; v++) if (4 + (v < 10 ? 8 : 16) + 8 * bytes.length <= qrDataCodewords(v) * 8) break;
  if (v > 40) return null;
  // the data: byte mode, its length, the bytes, a terminator, then padding
  const bits = [], put = (val, n) => { for (let i = n - 1; i >= 0; i--) bits.push((val >>> i) & 1); };
  put(4, 4); put(bytes.length, v < 10 ? 8 : 16); bytes.forEach(b => put(b, 8));
  const cap = qrDataCodewords(v) * 8;
  put(0, Math.min(4, cap - bits.length)); put(0, (8 - bits.length % 8) % 8);
  for (let pad = 0xEC; bits.length < cap; pad ^= 0xEC ^ 0x11) put(pad, 8);
  const data = []; for (let i = 0; i < bits.length; i += 8){ let b = 0; for (let j = 0; j < 8; j++) b = (b << 1) | bits[i + j]; data.push(b); }
  // error correction, in blocks, interleaved
  const nb = QR_BLOCKS[v], ecl = QR_ECC[v], raw = Math.floor(qrRawModules(v) / 8), nShort = nb - raw % nb, shortLen = Math.floor(raw / nb), div = rsDivisor(ecl), blocks = [];
  for (let i = 0, k = 0; i < nb; i++){
    const d = data.slice(k, k + shortLen - ecl + (i < nShort ? 0 : 1)); k += d.length;
    const e = rsRemainder(d, div); if (i < nShort) d.push(0);
    blocks.push(d.concat(e));
  }
  const words = [];
  for (let i = 0; i < blocks[0].length; i++) blocks.forEach((b, j) => { if (i !== shortLen - ecl || j >= nShort) words.push(b[i]); });
  // the patterns every code has
  const size = v * 4 + 17, mod = [], fn = [];
  for (let y = 0; y < size; y++){ mod.push([]); fn.push([]); for (let x = 0; x < size; x++){ mod[y].push(false); fn[y].push(false); } }
  const set = (x, y, d) => { mod[y][x] = d; fn[y][x] = true; };
  for (let i = 0; i < size; i++){ set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0); }
  [[3, 3], [size - 4, 3], [3, size - 4]].forEach(c => {
    for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++){
      const d = Math.max(Math.abs(dx), Math.abs(dy)), x = c[0] + dx, y = c[1] + dy;
      if (x >= 0 && x < size && y >= 0 && y < size) set(x, y, d !== 2 && d !== 4);
    }
  });
  const al = qrAlignment(v), n = al.length;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++){
    if ((i === 0 && j === 0) || (i === 0 && j === n - 1) || (i === n - 1 && j === 0)) continue;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) set(al[i] + dx, al[j] + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
  }
  const format = mask => {
    const d = mask;   // medium error correction's format bits are 00
    let r = d; for (let i = 0; i < 10; i++) r = (r << 1) ^ ((r >>> 9) * 0x537);
    const b = ((d << 10) | r) ^ 0x5412, bit = i => ((b >>> i) & 1) !== 0;
    for (let i = 0; i <= 5; i++) set(8, i, bit(i));
    set(8, 7, bit(6)); set(8, 8, bit(7)); set(7, 8, bit(8));
    for (let i = 9; i < 15; i++) set(14 - i, 8, bit(i));
    for (let i = 0; i < 8; i++) set(size - 1 - i, 8, bit(i));
    for (let i = 8; i < 15; i++) set(8, size - 15 + i, bit(i));
    set(8, size - 8, true);
  };
  format(0);
  if (v >= 7){
    let r = v; for (let i = 0; i < 12; i++) r = (r << 1) ^ ((r >>> 11) * 0x1F25);
    const b = (v << 12) | r;
    for (let i = 0; i < 18; i++){ const d = ((b >>> i) & 1) !== 0, a = size - 11 + i % 3, c = Math.floor(i / 3); set(a, c, d); set(c, a, d); }
  }
  // the codewords, in a zigzag up and down from the right
  let bi = 0;
  for (let right = size - 1; right >= 1; right -= 2){
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert++) for (let j = 0; j < 2; j++){
      const x = right - j, up = ((right + 1) & 2) === 0, y = up ? size - 1 - vert : vert;
      if (!fn[y][x] && bi < words.length * 8){ mod[y][x] = ((words[bi >>> 3] >>> (7 - (bi & 7))) & 1) !== 0; bi++; }
    }
  }
  // the mask that leaves the fewest runs, blocks and imbalance
  const masked = (m, x, y) => [(x + y) % 2, y % 2, x % 3, (x + y) % 3, (Math.floor(x / 3) + Math.floor(y / 2)) % 2, x * y % 2 + x * y % 3, (x * y % 2 + x * y % 3) % 2, ((x + y) % 2 + x * y % 3) % 2][m] === 0;
  const flip = m => { for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (!fn[y][x] && masked(m, x, y)) mod[y][x] = !mod[y][x]; };
  const penalty = () => {
    let p = 0, dark = 0;
    for (let a = 0; a < 2; a++) for (let i = 0; i < size; i++){
      let run = 1;
      for (let j = 1; j <= size; j++){
        const same = j < size && (a ? mod[j][i] === mod[j - 1][i] : mod[i][j] === mod[i][j - 1]);
        if (same) run++; else { if (run >= 5) p += run - 2; run = 1; }
      }
    }
    for (let y = 0; y < size - 1; y++) for (let x = 0; x < size - 1; x++){ const c = mod[y][x]; if (c === mod[y][x + 1] && c === mod[y + 1][x] && c === mod[y + 1][x + 1]) p += 3; }
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (mod[y][x]) dark++;
    return p + Math.floor(Math.abs(dark * 20 - size * size * 10) / (size * size)) * 10;
  };
  let best = 0, bestP = Infinity;
  for (let m = 0; m < 8; m++){ flip(m); format(m); const p = penalty(); if (p < bestP){ bestP = p; best = m; } flip(m); }
  flip(best); format(best);
  return { size, version: v, dark: (x, y) => x >= 0 && y >= 0 && x < size && y < size && mod[y][x] };
}

/** A QR code as an SVG, with the four-module quiet zone scanners need. */
export function qrSvg(text, opts){
  const q = qrEncode(text), o = opts || {};
  if (!q) return '';
  const n = q.size + 8;
  let d = '';
  for (let y = 0; y < q.size; y++) for (let x = 0; x < q.size; x++) if (q.dark(x, y)) d += `M${x + 4} ${y + 4}h1v1h-1z`;
  return `<svg viewBox="0 0 ${n} ${n}" shape-rendering="crispEdges" role="img" aria-label="${o.label || 'QR code'}"${o.size ? ` width="${o.size}" height="${o.size}"` : ''}><rect width="${n}" height="${n}" fill="#fff"/><path d="${d}" fill="#000"/></svg>`;
}

/** What a phone's camera reads to join a Wi-Fi network. */
export function wifiCode(w){
  if (!w || !w.ssid) return null;
  const esc = s => String(s).replace(/([\\;,:"])/g, '\\$1');
  const t = w.security === 'nopass' || !w.password ? 'nopass' : w.security === 'WEP' ? 'WEP' : 'WPA';
  return `WIFI:T:${t};S:${esc(w.ssid)};${t === 'nopass' ? '' : `P:${esc(w.password)};`}${w.hidden ? 'H:true;' : ''};`;
}
