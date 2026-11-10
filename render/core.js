// Bloops Studio renderer - core: utils, Bloop characters, costumes, items.
const W = 1920, H = 1080;
const cv = document.getElementById('c');
const ctx = cv.getContext('2d');
let TL = null;

const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const lerp = (a, b, t) => a + (b - a) * t;
const easeOut = t => 1 - Math.pow(1 - clamp(t, 0, 1), 3);
const easeIn = t => Math.pow(clamp(t, 0, 1), 2);
const easeInOut = t => { t = clamp(t, 0, 1); return t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; };
const easeOutBack = t => { t = clamp(t, 0, 1); const c1 = 1.9, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };
function hex2rgb(h) { if (Array.isArray(h)) return h; if (h.startsWith('rgb')) return h.match(/[\d.]+/g).slice(0, 3).map(Number); h = h.replace('#', ''); return [0, 2, 4].map(i => parseInt(h.substr(i, 2), 16)); }
const rgb = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
function mixc(a, b, t) { a = hex2rgb(a); b = hex2rgb(b); return [0, 1, 2].map(i => lerp(a[i], b[i], t)); }
function shade(h, amt, a = 1) { return amt > 0 ? rgb(mixc(h, [255, 255, 255], amt), a) : rgb(mixc(h, [0, 0, 0], -amt), a); }
function rnd(i) { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }
function rr(x, y, w, h, r) { r = Math.min(r, w / 2, h / 2); ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
function circle(x, y, r) { ctx.beginPath(); ctx.arc(x, y, Math.max(0, r), 0, Math.PI * 2); }
function ell(x, y, rx, ry, rot = 0) { ctx.beginPath(); ctx.ellipse(x, y, Math.max(0, rx), Math.max(0, ry), rot, 0, Math.PI * 2); }
const FONT = '"Inter", "DejaVu Sans", sans-serif';
const RAINBOW = ['#FF4B4B', '#FF9F43', '#FFC928', '#3DD66B', '#3D8BFF', '#9B6BFF', '#FF7AB8'];
const COLOR_HEX = { red: '#FF4B4B', blue: '#3D8BFF', yellow: '#FFC928', green: '#3DD66B', orange: '#FF9F43', purple: '#9B6BFF', pink: '#FF7AB8' };
const HOST = '#2EC4B6';  // Bloopy, the host
const beatPhase = (t, B) => (t / B) % 1;
const blinkAt = (t, seed) => ((t + seed * 1.37) % 3.4) < 0.12;

function glossyFill(c, r) {
  const g = ctx.createRadialGradient(-r * .35, -r * .42, r * .06, 0, 0, r * 1.05);
  g.addColorStop(0, shade(c, .6)); g.addColorStop(.45, c); g.addColorStop(1, shade(c, -.32));
  return g;
}
function gloss(r) {
  ctx.fillStyle = 'rgba(255,255,255,0.72)'; ell(-r * .4, -r * .52, r * .22, r * .11, -.6); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.5)'; circle(-r * .12, -r * .7, r * .055); ctx.fill();
}
function face(r, o, ey = -r * .1, scale = 1) {
  const lx = (o.look || [0, 0])[0], ly = (o.look || [0, 0])[1];
  const ex = r * .27 * scale, ew = r * .17 * scale, eh = r * .22 * scale;
  if (o.cheeks !== false) {
    ctx.fillStyle = 'rgba(255,110,150,0.38)';
    for (const s of [-1, 1]) { ell(s * r * .47 * scale, ey + r * .3 * scale, r * .14 * scale, r * .085 * scale); ctx.fill(); }
  }
  for (const s of [-1, 1]) {
    if (o.blink || o.happyEyes || o.sleepy) {
      ctx.strokeStyle = '#2B2238'; ctx.lineWidth = r * .06 * scale; ctx.lineCap = 'round'; ctx.beginPath();
      if (o.happyEyes) ctx.arc(s * ex, ey + eh * .25, ew * .8, Math.PI * 1.1, Math.PI * 1.9);
      else { ctx.moveTo(s * ex - ew * .8, ey + eh * .1); ctx.quadraticCurveTo(s * ex, ey + eh * .55, s * ex + ew * .8, ey + eh * .1); }
      ctx.stroke();
    } else {
      ctx.fillStyle = '#FFFFFF'; ell(s * ex, ey, ew, eh); ctx.fill();
      ctx.lineWidth = r * .025; ctx.strokeStyle = 'rgba(40,30,60,0.35)'; ctx.stroke();
      const pr = ew * .66, px = s * ex + lx * ew * .35, py = ey + ly * eh * .35 + eh * .08;
      ctx.fillStyle = '#251C33'; circle(px, py, pr); ctx.fill();
      ctx.fillStyle = '#FFFFFF'; circle(px - pr * .32, py - pr * .38, pr * .34); ctx.fill(); circle(px + pr * .3, py + pr * .3, pr * .13); ctx.fill();
    }
  }
  const my = ey + r * .24 * scale, mw = scale;
  ctx.lineCap = 'round';
  const mo = o.mouthOpen !== undefined ? o.mouthOpen : (o.mouth === 'open' ? 1 : 0);
  if (o.mouth === 'o') { ctx.fillStyle = '#7A1F3D'; ell(0, my + r * .06, r * .1 * mw, r * .13 * mw); ctx.fill(); }
  else if (mo > 0.08) {
    ctx.fillStyle = '#7A1F3D'; ctx.beginPath(); ctx.ellipse(0, my, r * .2 * mw, r * .2 * mw * (0.35 + 0.65 * mo), 0, 0, Math.PI); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#FF7A9C'; ell(0, my + r * .12 * mw * (0.35 + .65 * mo), r * .1 * mw, r * .05 * mw * mo); ctx.fill();
  } else {
    ctx.strokeStyle = '#3A2234'; ctx.lineWidth = r * .065 * mw;
    ctx.beginPath(); ctx.arc(0, my - r * .06 * mw, r * .2 * mw, Math.PI * .18, Math.PI * .82); ctx.stroke();
  }
}
function hands(r, c, hs) {
  for (const h of hs) {
    const hx = h[0] * r, hy = h[1] * r, hr = r * (h[2] || .21);
    const hg = ctx.createRadialGradient(hx - hr * .3, hy - hr * .4, hr * .1, hx, hy, hr);
    hg.addColorStop(0, shade(c, .5)); hg.addColorStop(1, shade(c, -.15));
    ctx.fillStyle = hg; circle(hx, hy, hr); ctx.fill();
    ctx.lineWidth = Math.max(1.5, r * .035); ctx.strokeStyle = shade(c, -.4); ctx.stroke();
  }
}

// --------------------------------------------------------------- Bloop + costumes
const COSTUME_COLOR = { cow: '#FFFFFF', pig: '#FFA7C4', duck: '#FFD84D', sheep: '#F4F1EA', cat: '#FFA94D', dog: '#C68B59', hen: '#FFFFFF', frog: '#6BD45F',
  fish: '#FF8C42', crab: '#FF5A4E', whale: '#4A90E2', octopus: '#B36BFF', turtle: '#5CC46A', dolphin: '#7FB3D5', starfish: '#FF9F7A', jellyfish: '#FF9ED8' };

function drawBloop(o) {
  const r = o.r, c = o.color || (o.costume ? COSTUME_COLOR[o.costume] : HOST);
  ctx.save();
  ctx.translate(o.x, o.y); ctx.rotate(o.rot || 0); ctx.scale(o.sx || 1, o.sy || 1);
  if (o.alpha !== undefined) ctx.globalAlpha *= o.alpha;
  if (o.silhouette) { ctx.filter = 'brightness(0) opacity(0.85)'; }
  costumeBack(o.costume, r, c, o);
  if (o.costume === 'starfish') { starPath(0, 0, r * 1.15, r * .55, 5, -Math.PI / 2); ctx.fillStyle = glossyFill(c, r); ctx.fill(); ctx.lineWidth = r * .045; ctx.strokeStyle = shade(c, -.38); ctx.stroke(); }
  else {
    ctx.fillStyle = glossyFill(c, r); circle(0, 0, r); ctx.fill();
    ctx.lineWidth = Math.max(2, r * .045); ctx.strokeStyle = shade(c, -.38); ctx.stroke();
    if (o.costume !== 'sheep') gloss(r);
  }
  costumeMid(o.costume, r, c, o);
  face(r, o);
  costumeFront(o.costume, r, c, o);
  if (o.cap) { ctx.fillStyle = o.cap; ctx.beginPath(); ctx.arc(0, -r * .55, r * .62, Math.PI * 1.05, Math.PI * 1.95); ctx.closePath(); ctx.fill(); rr(-r * .1, -r * .66, r * .9, r * .16, r * .08); ctx.fill(); ctx.fillStyle = '#FFD84D'; circle(0, -r * .9, r * .09); ctx.fill(); }
  if (o.nightcap) { ctx.fillStyle = '#6C7BFF'; ctx.beginPath(); ctx.moveTo(-r * .75, -r * .55); ctx.quadraticCurveTo(-r * .1, -r * 1.6, r * .9, -r * 1.25); ctx.quadraticCurveTo(r * .3, -r * 1.0, r * .75, -r * .55); ctx.closePath(); ctx.fill(); ctx.fillStyle = '#FFFFFF'; circle(r * .95, -r * 1.25, r * .16); ctx.fill(); rr(-r * .8, -r * .66, r * 1.6, r * .2, r * .1); ctx.fill(); }
  if (o.strawhat) { ctx.fillStyle = '#F2C14E'; ell(0, -r * .72, r * 1.05, r * .2); ctx.fill(); ctx.beginPath(); ctx.arc(0, -r * .72, r * .55, Math.PI, 0); ctx.fill(); ctx.fillStyle = '#E2574C'; ctx.fillRect(-r * .55, -r * .86, r * 1.1, r * .12); }
  if (o.antenna) { ctx.strokeStyle = shade(c, -.3); ctx.lineWidth = r * .06; ctx.beginPath(); ctx.moveTo(0, -r); ctx.quadraticCurveTo(r * .15, -r * 1.25, r * .05, -r * 1.42); ctx.stroke(); star(r * .05, -r * 1.48, r * .2, (o.t || 0) * 2, '#FFD84D', 1); }
  hands(r, c, o.hands || [[-1.02, .3], [1.02, .3]]);
  ctx.restore();
}

function costumeBack(k, r, c, o) {
  if (!k) return;
  if (k === 'cat') { for (const s of [-1, 1]) { ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(s * r * .85, -r * .35); ctx.lineTo(s * r * .65, -r * 1.15); ctx.lineTo(s * r * .15, -r * .8); ctx.closePath(); ctx.fill(); ctx.fillStyle = '#FFB3C7'; ctx.beginPath(); ctx.moveTo(s * r * .7, -r * .5); ctx.lineTo(s * r * .62, -r * .98); ctx.lineTo(s * r * .3, -r * .78); ctx.closePath(); ctx.fill(); } }
  if (k === 'pig') { for (const s of [-1, 1]) { ctx.fillStyle = shade(c, -.1); ctx.beginPath(); ctx.moveTo(s * r * .8, -r * .4); ctx.lineTo(s * r * .85, -r * 1.05); ctx.lineTo(s * r * .3, -r * .82); ctx.closePath(); ctx.fill(); } }
  if (k === 'dog') { for (const s of [-1, 1]) { ctx.fillStyle = shade(c, -.35); ell(s * r * .92, r * .05, r * .26, r * .55, s * .25); ctx.fill(); } }
  if (k === 'cow') { ctx.fillStyle = '#F2D9A0'; for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(s * r * .45, -r * .8); ctx.quadraticCurveTo(s * r * .75, -r * 1.25, s * r * .55, -r * 1.3); ctx.quadraticCurveTo(s * r * .45, -r * 1.05, s * r * .25, -r * .9); ctx.fill(); } ctx.fillStyle = '#E8E0D5'; for (const s of [-1, 1]) { ell(s * r * 1.0, -r * .35, r * .3, r * .14, s * .4); ctx.fill(); } }
  if (k === 'sheep') { ctx.fillStyle = '#FFFFFF'; for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; circle(Math.cos(a) * r * .92, Math.sin(a) * r * .92, r * .32); ctx.fill(); } }
  if (k === 'frog') { for (const s of [-1, 1]) { ctx.fillStyle = c; circle(s * r * .45, -r * .85, r * .34); ctx.fill(); } }
  if (k === 'fish') { ctx.fillStyle = shade(c, -.1); ctx.beginPath(); ctx.moveTo(-r * .85, 0); ctx.lineTo(-r * 1.6, -r * .6); ctx.lineTo(-r * 1.45, 0); ctx.lineTo(-r * 1.6, r * .6); ctx.closePath(); ctx.fill(); }
  if (k === 'whale') { ctx.fillStyle = shade(c, -.1); ctx.beginPath(); ctx.moveTo(-r * .8, r * .1); ctx.quadraticCurveTo(-r * 1.4, -r * .1, -r * 1.7, -r * .7); ctx.quadraticCurveTo(-r * 1.4, -r * .2, -r * 1.75, r * .2); ctx.closePath(); ctx.fill(); }
  if (k === 'dolphin') { ctx.fillStyle = shade(c, -.15); ctx.beginPath(); ctx.moveTo(-r * .2, -r * .9); ctx.quadraticCurveTo(r * .1, -r * 1.5, r * .45, -r * 1.35); ctx.quadraticCurveTo(r * .2, -r * 1.1, r * .3, -r * .85); ctx.closePath(); ctx.fill(); }
  if (k === 'octopus') { ctx.strokeStyle = c; ctx.lineCap = 'round'; ctx.lineWidth = r * .2; for (let i = 0; i < 6; i++) { const x0 = (-0.75 + i * .3) * r; ctx.beginPath(); ctx.moveTo(x0, r * .5); ctx.quadraticCurveTo(x0 + Math.sin((o.t || 0) * 4 + i) * r * .3, r * 1.1, x0 + Math.sin((o.t || 0) * 4 + i + 1) * r * .25, r * 1.45); ctx.stroke(); } }
  if (k === 'jellyfish') { ctx.strokeStyle = shade(c, -.1); ctx.lineCap = 'round'; ctx.lineWidth = r * .08; for (let i = 0; i < 5; i++) { const x0 = (-0.6 + i * .3) * r; ctx.beginPath(); ctx.moveTo(x0, r * .6); for (let q = 1; q <= 4; q++) ctx.lineTo(x0 + Math.sin((o.t || 0) * 5 + i + q) * r * .12, r * (.6 + q * .25)); ctx.stroke(); } }
  if (k === 'crab') { ctx.fillStyle = c; for (const s of [-1, 1]) { ctx.strokeStyle = shade(c, -.2); ctx.lineWidth = r * .1; ctx.beginPath(); ctx.moveTo(s * r * .3, -r * .8); ctx.lineTo(s * r * .35, -r * 1.2); ctx.stroke(); ctx.fillStyle = '#FFFFFF'; circle(s * r * .35, -r * 1.25, r * .18); ctx.fill(); ctx.fillStyle = '#251C33'; circle(s * r * .37, -r * 1.25, r * .09); ctx.fill(); } }
  if (k === 'hen') { ctx.fillStyle = '#FF4B4B'; for (let i = 0; i < 3; i++) { circle((-0.2 + i * .2) * r, -r * (1.0 - Math.abs(i - 1) * .08), r * .17); ctx.fill(); } }
  if (k === 'duck') { ctx.fillStyle = shade(c, -.1); for (let i = 0; i < 3; i++) { ell((-0.1 + i * .1) * r, -r * 1.02, r * .07, r * .2, -0.4 + i * .4); ctx.fill(); } }
}
function costumeMid(k, r, c, o) {
  if (k === 'cow') { ctx.fillStyle = '#2B2B2B'; ell(-r * .5, -r * .5, r * .25, r * .2, .3); ctx.fill(); ell(r * .55, r * .45, r * .22, r * .17, -.4); ctx.fill(); ell(r * .65, -r * .35, r * .12, r * .1); ctx.fill(); }
  if (k === 'sheep') { ctx.fillStyle = '#D9CBB6'; ell(0, r * .02, r * .72, r * .78); ctx.fill(); }
  if (k === 'turtle') { ctx.fillStyle = shade(c, -.25); for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; polygon(Math.cos(a) * r * .55, Math.sin(a) * r * .55, r * .2, 6); ctx.fill(); } }
  if (k === 'frog') { for (const s of [-1, 1]) { ctx.fillStyle = '#FFFFFF'; circle(s * r * .45, -r * .85, r * .22); ctx.fill(); ctx.fillStyle = '#251C33'; circle(s * r * .45, -r * .83, r * .11); ctx.fill(); } }
  if (k === 'fish') { ctx.strokeStyle = shade(c, -.2); ctx.lineWidth = r * .05; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(-r * (.3 + i * .18), 0, r * .5, -0.6, 0.6); ctx.stroke(); } }
  if (k === 'whale' && o.spout) { ctx.fillStyle = 'rgba(180,225,255,0.85)'; for (let i = 0; i < 5; i++) { circle((i - 2) * r * .18, -r * (1.15 + Math.abs(i - 2) * -.08) - o.spout * r * .4, r * .12 * o.spout); ctx.fill(); } }
}
function costumeFront(k, r, c, o) {
  if (k === 'cow' || k === 'pig') { const sc = k === 'cow' ? '#FFB8C6' : shade(c, -.12); ctx.fillStyle = sc; ell(0, r * .32, r * .36, r * .22); ctx.fill(); ctx.fillStyle = shade(sc, -.4); ell(-r * .12, r * .32, r * .06, r * .08); ctx.fill(); ell(r * .12, r * .32, r * .06, r * .08); ctx.fill(); }
  if (k === 'duck' || k === 'hen') { ctx.fillStyle = '#FF9F1C'; ell(0, r * .2, r * .3, r * .13); ctx.fill(); ctx.fillStyle = shade('#FF9F1C', -.15); ell(0, r * .28, r * .24, r * .07); ctx.fill(); if (k === 'hen') { ctx.fillStyle = '#FF4B4B'; ell(0, r * .42, r * .08, r * .12); ctx.fill(); } }
  if (k === 'cat') { ctx.fillStyle = '#FF7A9C'; ctx.beginPath(); ctx.moveTo(-r * .07, r * .12); ctx.lineTo(r * .07, r * .12); ctx.lineTo(0, r * .2); ctx.closePath(); ctx.fill(); ctx.strokeStyle = 'rgba(60,40,40,0.7)'; ctx.lineWidth = r * .025; for (const s of [-1, 1]) for (const dy of [-.04, .06]) { ctx.beginPath(); ctx.moveTo(s * r * .3, r * (.18 + dy)); ctx.lineTo(s * r * .78, r * (.12 + dy * 2)); ctx.stroke(); } }
  if (k === 'dog') { ctx.fillStyle = '#2B2238'; ell(0, r * .13, r * .12, r * .08); ctx.fill(); }
  if (k === 'dolphin') { ctx.fillStyle = shade(c, .2); ell(r * .75, r * .2, r * .3, r * .14); ctx.fill(); }
}
function polygon(x, y, r, n, rot = 0) { ctx.beginPath(); for (let i = 0; i < n; i++) { const a = rot + i / n * Math.PI * 2; ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); } ctx.closePath(); }
function starPath(x, y, R, r, n = 5, rot = -Math.PI / 2) { ctx.beginPath(); for (let i = 0; i < n * 2; i++) { const a = rot + i * Math.PI / n, rad = i % 2 ? r : R; ctx.lineTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad); } ctx.closePath(); }
function star(x, y, r, rot, color, a) { ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.globalAlpha *= a; ctx.fillStyle = color; ctx.beginPath(); for (let i = 0; i < 8; i++) { const rad = i % 2 ? r * .38 : r; const an = i * Math.PI / 4; ctx.lineTo(Math.cos(an) * rad, Math.sin(an) * rad); } ctx.closePath(); ctx.fill(); ctx.restore(); }
function heartPath(x, y, s) { ctx.beginPath(); ctx.moveTo(x, y + s * .35); ctx.bezierCurveTo(x - s * 1.1, y - s * .35, x - s * .55, y - s * 1.05, x, y - s * .5); ctx.bezierCurveTo(x + s * .55, y - s * 1.05, x + s * 1.1, y - s * .35, x, y + s * .35); ctx.closePath(); }
function sparkles(x, y, R, u, seed, n = 10) { for (let i = 0; i < n; i++) { const a = rnd(i + seed) * Math.PI * 2, d = R * (1 + u * 1.2 + rnd(i + 3) * .4); star(x + Math.cos(a) * d, y + Math.sin(a) * d, 16 * (1 - u * .7), u * 3 + i, RAINBOW[i % 7], clamp(1.2 - u, 0, 1)); } }

// --------------------------------------------------------------- items
function miniFace(r, t, seed) { ctx.save(); face(r, { blink: blinkAt(t, seed), cheeks: true }, r * .02, .8); ctx.restore(); }

function drawFruit(k, x, y, s, t, seed = 0, bite = 0) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  const r = 100;
  if (k === 'apple' || k === 'orange' || k === 'cherry' || k === 'pear') {
    const c = { apple: '#FF4B4B', orange: '#FF9F43', cherry: '#E8344E', pear: '#B5D94B' }[k];
    if (k === 'cherry') {
      ctx.strokeStyle = '#4E8F3A'; ctx.lineWidth = 9; ctx.beginPath(); ctx.moveTo(-50, 10); ctx.quadraticCurveTo(-10, -110, 20, -140); ctx.moveTo(55, 20); ctx.quadraticCurveTo(40, -90, 20, -140); ctx.stroke();
      for (const [cx, cy] of [[-55, 40], [55, 50]]) { ctx.save(); ctx.translate(cx, cy); ctx.fillStyle = glossyFill(c, 62); circle(0, 0, 62); ctx.fill(); gloss(62); ctx.restore(); }
      ctx.translate(-55, 40); miniFace(55, t, seed); ctx.restore(); return;
    }
    ctx.fillStyle = glossyFill(c, r);
    if (k === 'pear') { ctx.beginPath(); ctx.arc(0, 25, r * .95, 0, Math.PI * 2); ctx.fill(); circle(0, -55, r * .62); ctx.fill(); }
    else if (k === 'apple') { ctx.beginPath(); ctx.moveTo(0, -r * .7); ctx.bezierCurveTo(r * .9, -r * 1.2, r * 1.4, r * .2, r * .3, r); ctx.quadraticCurveTo(0, r * .85, -r * .3, r); ctx.bezierCurveTo(-r * 1.4, r * .2, -r * .9, -r * 1.2, 0, -r * .7); ctx.fill(); }
    else { circle(0, 0, r); ctx.fill(); ctx.fillStyle = 'rgba(200,100,0,0.25)'; for (let i = 0; i < 14; i++) { circle((rnd(i) - .5) * 150, (rnd(i + 5) - .5) * 150, 3); ctx.fill(); } }
    ctx.lineWidth = 5; ctx.strokeStyle = shade(c, -.35); ctx.stroke();
    gloss(r);
    ctx.strokeStyle = '#7A4E2D'; ctx.lineWidth = 10; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(0, -r * .7 - (k === 'pear' ? 40 : 0)); ctx.lineTo(8, -r - 25 - (k === 'pear' ? 40 : 0)); ctx.stroke();
    ctx.fillStyle = '#4FC15A'; ell(38, -r - 15 - (k === 'pear' ? 40 : 0), 34, 16, -.5); ctx.fill();
    miniFace(r * .8, t, seed);
  } else if (k === 'banana') {
    ctx.rotate(-.3);
    const g = ctx.createLinearGradient(0, -80, 0, 80); g.addColorStop(0, '#FFE37A'); g.addColorStop(1, '#F2B705');
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(-150, -40); ctx.quadraticCurveTo(0, 150, 150, -40); ctx.quadraticCurveTo(0, 60, -150, -40); ctx.fill();
    ctx.lineWidth = 5; ctx.strokeStyle = '#C79100'; ctx.stroke(); ctx.fillStyle = '#6B4E16'; circle(-150, -40, 9); ctx.fill(); circle(150, -40, 7); ctx.fill();
    ctx.translate(0, 45); miniFace(55, t, seed);
  } else if (k === 'strawberry') {
    ctx.fillStyle = glossyFill('#FF4B6B', r); ctx.beginPath(); ctx.moveTo(-r, -r * .45); ctx.quadraticCurveTo(-r * 1.05, r * .6, 0, r * 1.1); ctx.quadraticCurveTo(r * 1.05, r * .6, r, -r * .45); ctx.quadraticCurveTo(0, -r * .85, -r, -r * .45); ctx.fill();
    ctx.lineWidth = 5; ctx.strokeStyle = '#B5213C'; ctx.stroke();
    ctx.fillStyle = '#FFE680'; for (let i = 0; i < 16; i++) { ell((rnd(i) - .5) * 150, (rnd(i + 9) - .3) * 140, 4, 7); ctx.fill(); }
    ctx.fillStyle = '#3FB25A'; for (let i = 0; i < 5; i++) { ctx.save(); ctx.translate(0, -r * .6); ctx.rotate(-1 + i * .5); ell(0, -25, 18, 40); ctx.fill(); ctx.restore(); }
    miniFace(r * .75, t, seed);
  } else if (k === 'grapes') {
    ctx.strokeStyle = '#7A4E2D'; ctx.lineWidth = 10; ctx.beginPath(); ctx.moveTo(0, -110); ctx.lineTo(10, -150); ctx.stroke();
    const pos = [[-45, -70], [0, -75], [45, -70], [-65, -20], [-20, -25], [25, -25], [65, -20], [-40, 30], [5, 25], [45, 30], [-15, 75], [25, 75], [5, 115]];
    for (const [px, py] of pos) { ctx.save(); ctx.translate(px, py); ctx.fillStyle = glossyFill('#9B6BFF', 30); circle(0, 0, 30); ctx.fill(); ctx.restore(); }
    ctx.translate(0, 0); miniFace(55, t, seed);
  } else if (k === 'watermelon') {
    ctx.fillStyle = '#3FAF4A'; ctx.beginPath(); ctx.arc(0, -20, 150, 0, Math.PI); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#E8FFD8'; ctx.beginPath(); ctx.arc(0, -20, 132, 0, Math.PI); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#FF5A6E'; ctx.beginPath(); ctx.arc(0, -20, 120, 0, Math.PI); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#2B2238'; for (let i = 0; i < 9; i++) { ell(-80 + i * 20, 20 + Math.sin(i * 1.7) * 25 + 20, 5, 9, .3); ctx.fill(); }
    ctx.translate(0, 20); miniFace(60, t, seed);
  }
  ctx.restore();
}

function shapePath(k, s) {
  switch (k) {
    case 'circle': circle(0, 0, s); break;
    case 'square': rr(-s * .9, -s * .9, s * 1.8, s * 1.8, s * .18); break;
    case 'triangle': ctx.beginPath(); ctx.moveTo(0, -s * 1.05); ctx.lineTo(s * 1.05, s * .8); ctx.lineTo(-s * 1.05, s * .8); ctx.closePath(); break;
    case 'star': starPath(0, s * .08, s * 1.15, s * .5); break;
    case 'heart': heartPath(0, s * .45, s * 1.25); break;
    case 'diamond': ctx.beginPath(); ctx.moveTo(0, -s * 1.15); ctx.lineTo(s * .8, 0); ctx.lineTo(0, s * 1.15); ctx.lineTo(-s * .8, 0); ctx.closePath(); break;
    case 'oval': ell(0, 0, s * 1.2, s * .78); break;
    case 'rectangle': rr(-s * 1.3, -s * .7, s * 2.6, s * 1.4, s * .14); break;
  }
}
function drawShape(k, x, y, s, color, t, seed = 0, o = {}) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(o.rot || 0); ctx.scale(o.sx || 1, o.sy || 1);
  if (o.silhouette) ctx.filter = 'brightness(0) opacity(0.8)';
  shapePath(k, s); ctx.fillStyle = glossyFill(color, s); ctx.fill(); ctx.lineWidth = s * .06; ctx.strokeStyle = shade(color, -.38); ctx.lineJoin = 'round'; ctx.stroke();
  ctx.save(); shapePath(k, s); ctx.clip(); gloss(s); ctx.restore();
  ctx.translate(0, k === 'triangle' ? s * .2 : 0); face(s * .8, { blink: blinkAt(t, seed), mouth: o.mouth, happyEyes: o.happy });
  ctx.restore();
}

function drawCountObj(k, x, y, s, t, seed) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  if (k === 'balloon') {
    const c = RAINBOW[seed % 7];
    ctx.strokeStyle = 'rgba(80,80,100,0.6)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, 70); ctx.quadraticCurveTo(15 * Math.sin(t * 2 + seed), 120, 0, 170); ctx.stroke();
    ctx.fillStyle = glossyFill(c, 70); ell(0, 0, 58, 72); ctx.fill(); ctx.fillStyle = shade(c, -.2); ctx.beginPath(); ctx.moveTo(-8, 72); ctx.lineTo(8, 72); ctx.lineTo(0, 82); ctx.closePath(); ctx.fill();
    gloss(60); miniFace(45, t, seed);
  } else if (k === 'star') { ctx.rotate(Math.sin(t * 2 + seed) * .1); starPath(0, 5, 70, 32); ctx.fillStyle = glossyFill('#FFD23D', 70); ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = '#E0A400'; ctx.stroke(); miniFace(38, t, seed); }
  else if (k === 'apple') drawFruit('apple', 0, 0, .55, t, seed);
  else if (k === 'duck') { ctx.fillStyle = glossyFill('#FFD84D', 55); ell(0, 20, 62, 42); ctx.fill(); circle(20, -30, 36); ctx.fill(); ctx.fillStyle = '#FF9F1C'; ell(58, -24, 20, 9); ctx.fill(); ctx.fillStyle = '#251C33'; circle(30, -38, 6); ctx.fill(); ctx.fillStyle = shade('#FFD84D', -.12); ell(-12, 18, 30, 16, -.3); ctx.fill(); }
  else if (k === 'bubble') { ctx.strokeStyle = 'rgba(120,190,255,0.9)'; ctx.lineWidth = 5; circle(0, 0, 55); ctx.stroke(); ctx.fillStyle = 'rgba(180,225,255,0.3)'; ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,0.8)'; ell(-20, -22, 14, 8, -.6); ctx.fill(); }
  else drawBloop({ x: 0, y: 0, r: 52, color: RAINBOW[seed % 7], blink: blinkAt(t, seed), t });
  ctx.restore();
}

// --------------------------------------------------------------- text helpers
function outlinedText(txt, x, y, size, fill, opts = {}) {
  ctx.save();
  ctx.font = `800 ${size}px ${FONT}`; ctx.textAlign = opts.align || 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
  ctx.shadowColor = 'rgba(40,20,80,0.25)'; ctx.shadowOffsetY = size * .06; ctx.shadowBlur = size * .08;
  ctx.lineWidth = size * (opts.stroke || .16); ctx.strokeStyle = opts.strokeColor || '#FFFFFF'; ctx.strokeText(txt, x, y);
  ctx.shadowColor = 'transparent';
  const g = ctx.createLinearGradient(0, y - size / 2, 0, y + size / 2); g.addColorStop(0, shade(fill, .35)); g.addColorStop(1, fill);
  ctx.fillStyle = g; ctx.fillText(txt, x, y);
  ctx.restore();
}
function fitSize(txt, size, maxW) { ctx.save(); ctx.font = `800 ${size}px ${FONT}`; const w = ctx.measureText(txt).width; ctx.restore(); return w > maxW ? size * maxW / w : size; }
function popLetters(txt, cx, cy, size, t0, t, colors, outT) {
  size = fitSize(txt, size, W - 160);
  ctx.save(); ctx.font = `800 ${size}px ${FONT}`;
  const widths = [...txt].map(ch => ctx.measureText(ch).width + size * .02); ctx.restore();
  const total = widths.reduce((a, b) => a + b, 0);
  let x = cx - total / 2;
  [...txt].forEach((ch, i) => {
    const w = widths[i], k = easeOutBack((t - t0 - i * .05) / .45), out = outT ? 1 - easeIn((t - outT) / .4) : 1, s = Math.max(0, k * out);
    if (s > 0 && ch !== ' ') { ctx.save(); ctx.translate(x + w / 2, cy + 8 * Math.sin(t * 5 + i * .7)); ctx.rotate(.06 * Math.sin(t * 3 + i)); ctx.scale(s, s); outlinedText(ch, 0, 0, size, colors[i % colors.length]); ctx.restore(); }
    x += w;
  });
}
function bubble(x, y, txt, size, color, k = 1) {
  if (k <= 0) return;
  ctx.save(); ctx.translate(x, y); ctx.scale(k, k);
  ctx.font = `800 ${size}px ${FONT}`; const w = ctx.measureText(txt).width + size * 1.1, h = size * 1.6;
  ctx.fillStyle = '#FFFFFF'; ctx.shadowColor = 'rgba(0,0,0,0.15)'; ctx.shadowBlur = 12; ctx.shadowOffsetY = 6;
  rr(-w / 2, -h / 2, w, h, h / 2); ctx.fill(); ctx.beginPath(); ctx.moveTo(-size * .4, h / 2 - 4); ctx.lineTo(-size * .9, h / 2 + size * .6); ctx.lineTo(size * .1, h / 2 - 4); ctx.fill();
  ctx.shadowColor = 'transparent'; outlinedText(txt, 0, 0, size, color, { stroke: .08, strokeColor: '#FFFFFF' });
  ctx.restore();
}
