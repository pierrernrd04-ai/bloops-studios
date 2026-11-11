// Bloops Studio renderer - segment renderers, karaoke, transitions, frame entry point.
function setTimeline(t) {
  TL = t;
  for (const s of TL.segments) if (s.type === 'song') {
    s._lines = s.verses.map(() => []);
    for (const w of s.words) { const L = s._lines[w.verse]; (L[w.line] = L[w.line] || []).push(w); }
  }
}
function activeWord(seg, t) { if (!seg.words) return null; for (const w of seg.words) if (t >= w.t && t < w.t + w.d) return w; return null; }
function singMouth(seg, t) { const w = activeWord(seg, t); if (!w) return 0; return .35 + .65 * Math.sin(Math.PI * clamp((t - w.t) / Math.min(w.d, .35), 0, 1)); }
function envAt(arr, t0, t) { if (!arr) return 0; const i = Math.floor((t - t0) * 30); return i >= 0 && i < arr.length ? arr[i] : 0; }
function verseAt(seg, t) { let vi = 0; seg.verses.forEach((v, i) => { if (t >= v.start - 1.6) vi = i; }); return vi; }
function actionAt(seg, t) { return seg.actions.find(a => t >= a.t && t < a.t + a.d); }
const B_ = seg => seg.beat || 0.5;
const bobOf = (t, B) => 5 * (0.5 + 0.5 * Math.cos(2 * Math.PI * t / B));

// generic "do the action" pose modifier
function applyAction(p, key, u, d, t, seed = 0) {
  const r = p.r, base = p.y;
  p.blink = false;
  switch (key) {
    case 'bounce': case 'jump': {
      const hgt = (key === 'jump' ? 1.4 : 1) * (d > .6 ? 2.6 : 1.9) * r * Math.sin(Math.PI * u);
      const k = Math.exp(-Math.pow(u / .09, 2)) + Math.exp(-Math.pow((1 - u) / .09, 2));
      p.sy = 1 - .22 * k + (key === 'jump' ? .12 * Math.sin(Math.PI * u) : 0); p.sx = 1 + .18 * k;
      p.y = base - hgt + r * (1 - p.sy); p.rot = 0;
      p.hands = [[-1.0, -.1 - .5 * Math.sin(Math.PI * u)], [1.0, -.1 - .5 * Math.sin(Math.PI * u)]];
      p.mouth = u > .15 && u < .85 ? 'open' : 'smile'; if (u > .15 && u < .85) p.happyEyes = true; break;
    }
    case 'spin': p.rot = Math.PI * 2 * easeInOut(u) * (d > .6 ? 2 : 1); p.y = base - .5 * r * Math.sin(Math.PI * u); p.mouth = 'open'; p.hands = [[-1.15, -.2], [1.15, -.2]];
      p.fx = () => { ctx.save(); ctx.translate(p.x, p.y); ctx.strokeStyle = `rgba(255,255,255,${.8 * Math.sin(Math.PI * u)})`; ctx.lineWidth = r * .13; ctx.lineCap = 'round'; for (let i = 0; i < 3; i++) { const a0 = p.rot + i * 2.1; ctx.beginPath(); ctx.arc(0, 0, r * 1.35, a0, a0 + 1.1); ctx.stroke(); } ctx.restore(); }; break;
    case 'clap': { const close = u < .3 ? easeIn(u / .3) : 1 - easeOut((u - .3) / .7), hx = lerp(1.05, .2, close); p.hands = [[-hx, lerp(.3, .05, close), .24], [hx, lerp(.3, .05, close), .24]]; p.mouth = 'open';
      if (u > .28 && u < .6) { const q = (u - .28) / .32; p.fx = () => { for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, dd = r * (.5 + q * .9); star(p.x + Math.cos(a) * dd, p.y + r * .05 + Math.sin(a) * dd * .8, r * .19 * (1 - q) + 6, a, i % 2 ? '#FFFFFF' : '#FFE066', 1 - q); } }; } break; }
    case 'peek': {
      if (u < .55) { const c = easeOut(u / .3); p.hands = [[lerp(-1.02, -.28, c), lerp(.3, -.1, c), lerp(.21, .27, c)], [lerp(1.02, .28, c), lerp(.3, -.1, c), lerp(.21, .27, c)]]; p.mouth = 'o'; p.rot = Math.sin(u * 30) * .03; }
      else { const v = (u - .55) / .45, o = easeOutBack(v / .4); p.hands = [[lerp(-.28, -1.2, o), lerp(-.1, -.65, o), .24], [lerp(.28, 1.2, o), lerp(-.1, -.65, o), .24]]; const pop = 1 + .22 * Math.sin(Math.PI * clamp(v / .5, 0, 1)); p.sx = pop; p.sy = pop; p.mouth = 'open'; p.fx = () => sparkles(p.x, p.y, r, v, seed); }
      break;
    }
    case 'wiggle': p.rot = .35 * Math.sin(u * Math.PI * 6); p.x += r * .25 * Math.sin(u * Math.PI * 6); p.mouth = 'open'; p.hands = [[-1.05, -.4 + .3 * Math.sin(u * 20)], [1.05, -.4 - .3 * Math.sin(u * 20)]]; break;
    case 'wave': p.mouth = 'open'; p.hands = [[-1.0, .3], [1.05 + .2 * Math.sin(u * Math.PI * 6), -.65]]; p.rot = .08 * Math.sin(u * Math.PI * 3); break;
    case 'nod': { const q = Math.abs(Math.sin(u * Math.PI * 2)); p.sy = 1 - .15 * q; p.sx = 1 + .1 * q; p.y = base + r * .15 * q; p.mouth = 'open'; p.happyEyes = q > .5; break; }
    default: p.mouth = 'open'; p.y = base - .6 * r * Math.sin(Math.PI * u);
  }
  return p;
}

// ------------------------------------------------------------ karaoke + banners
function karaoke(seg, t) {
  const vi = seg.verses.findIndex(v => t >= v.start - .6 && t < v.end + .4);
  if (vi < 0) return;
  const v = seg.verses[vi];
  const li = v.lines.findIndex(l => t >= l.start && t < l.end + .15);
  if (li < 0) return;
  const L = v.lines[li], words = (seg._lines[vi] || [])[li];
  if (!words || !words.length) return;
  const a = clamp((t - L.start) / .2, 0, 1) * clamp((L.end + .15 - t) / .2, 0, 1);
  const col = v.hex || RAINBOW[vi % 7];
  let size = 54;
  ctx.save(); ctx.font = `800 ${size}px ${FONT}`;
  const sp = size * .38;
  let parts = words.map(w => ({ ...w, w: ctx.measureText(w.text).width }));
  let total = parts.reduce((s, p) => s + p.w + sp, 0) - sp;
  if (total > W - 220) { size = size * (W - 220) / total; ctx.font = `800 ${size}px ${FONT}`; parts = words.map(w => ({ ...w, w: ctx.measureText(w.text).width })); total = parts.reduce((s, p) => s + p.w + size * .38, 0) - size * .38; }
  const gap = size * .38;
  ctx.globalAlpha = a;
  const bx = W / 2 - total / 2 - 50, bw = total + 100, by = 978, bh = 88;
  ctx.fillStyle = 'rgba(255,255,255,0.9)'; rr(bx, by, bw, bh, 44); ctx.fill(); ctx.lineWidth = 6; ctx.strokeStyle = shade(col, 0, .8); ctx.stroke();
  const sung = col.toUpperCase() === '#FFC928' ? '#E2A100' : col;
  let x = W / 2 - total / 2; const centers = [];
  for (const p of parts) {
    const on = t >= p.t, cur = on && t < p.t + p.d, sc = cur ? 1 + .07 * Math.sin(Math.PI * clamp((t - p.t) / Math.min(p.d, .4), 0, 1)) : 1;
    ctx.save(); ctx.translate(x + p.w / 2, by + bh / 2 + 2); ctx.scale(sc, sc); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = on ? sung : '#5A5670'; ctx.fillText(p.text, 0, 0); ctx.restore();
    centers.push(x + p.w / 2); x += p.w + gap;
  }
  const i = parts.findIndex((p, k) => t >= p.t && (k === parts.length - 1 || t < parts[k + 1].t));
  let gx, gy;
  if (i < 0) { gx = centers[0]; gy = by - 22; }
  else if (i === parts.length - 1) { gx = centers[i]; gy = by - 22 - 30 * Math.sin(Math.PI * clamp((t - parts[i].t) / .4, 0, 1)); }
  else { const u = (t - parts[i].t) / (parts[i + 1].t - parts[i].t); gx = lerp(centers[i], centers[i + 1], u); gy = by - 22 - 46 * Math.sin(Math.PI * u); }
  drawBloop({ x: gx, y: gy, r: 20, color: col, hands: [], blink: false });
  ctx.restore();
}
function songBanner(seg, t) {
  const t0 = seg.start, t1 = seg.t0 - .3;
  if (t < t0 || t > t1 + .4) return;
  const k = easeOutBack((t - t0) / .5) * (1 - easeIn((t - t1) / .4));
  if (k <= 0) return;
  ctx.save(); ctx.translate(W / 2, 200); ctx.scale(k, k); ctx.rotate(Math.sin(t * 2) * .02);
  const size = fitSize(seg.title, 92, 1500);
  ctx.font = `800 ${size}px ${FONT}`; const w = ctx.measureText(seg.title).width + 140;
  ctx.fillStyle = '#FFFFFF'; ctx.shadowColor = 'rgba(40,20,80,0.25)'; ctx.shadowBlur = 20; ctx.shadowOffsetY = 10; rr(-w / 2, -80, w, 160, 80); ctx.fill(); ctx.shadowColor = 'transparent';
  ctx.lineWidth = 10; ctx.strokeStyle = RAINBOW[Math.floor(seg.start) % 7]; ctx.stroke();
  outlinedText(seg.title, 0, 4, size, '#9B6BFF', { stroke: .1 });
  ctx.restore();
}
function verseWord(seg, t, y = 165, size = 150) {
  for (const v of seg.verses) {
    if (!v.word) continue;
    const t0 = v.start - .2, t1 = v.end - .9;
    if (t < t0 || t > t1 + .4) continue;
    const s = easeOutBack((t - t0) / .5) * (1 - easeIn((t - t1) / .4));
    const act = actionAt(seg, t), pulse = 1 + .04 * Math.sin(Math.PI * t / B_(seg)) ** 2 + (act ? .05 * Math.sin(Math.PI * (t - act.t) / act.d) : 0);
    ctx.save(); ctx.translate(W / 2, y); ctx.rotate(.03 * Math.sin(t * 2.5)); ctx.scale(s * pulse, s * pulse);
    outlinedText(v.word, 0, 0, fitSize(v.word, size, 1100), v.hex || RAINBOW[seg.verses.indexOf(v) % 7], { stroke: .14 }); ctx.restore();
  }
}

// ------------------------------------------------------------ song renderers
function renderRide(seg, t) {
  const B = B_(seg), veh = seg.vehicle || 'bus', n = seg.verses.length;
  const speed = veh === 'boat' ? 80 : 300;
  drawScene(veh === 'boat' ? 'sea' : seg.scene, t, speed, { road: veh === 'bus' });
  if (veh === 'train') rails(speed * t, SCENE_PAL[seg.scene] || SCENE_PAL.trees);
  const home = veh === 'train' ? 700 : 780;
  let x = home; const ts = t - seg.start, te = seg.end - t;
  if (ts < 3) x = lerp(-900, home, easeOut(ts / 3));
  if (te < 2.3) x = home + easeIn((2.3 - te) / 2.3) * 2200;
  const b = bobOf(t, B), gm = vehicleGeom(veh, x, n), seats = [], front = [];
  if (veh === 'train') { const cars = Math.max(1, Math.ceil(n / 2)); gm.roofX = x - gm.width / 2 + cars * 330 - 120; gm.roof = 585; }
  if (veh === 'boat') { gm.roofX = x + 200; gm.roof = 650; }
  const roofY = gm.roof - b, rx = gm.roofX;
  seg.verses.forEach((v, i) => {
    const [sx, sy] = gm.seats[i] || [x, 668];
    const seatPose = () => ({ x: sx, y: (veh === 'boat' ? sy : sy - (veh === 'train' ? -15 : 0)) - b - 4 * Math.abs(Math.sin(Math.PI * t / B + i)), r: veh === 'boat' ? 52 : 42, color: v.hex, look: [.5, 0], blink: blinkAt(t, i), rot: .05 * Math.sin(t * 2 + i), waving: te < 4 });
    const s = v.start, e = v.end;
    if (t >= e - .5) { const p = seatPose(); if (te < 4) { p.hands = [[-1, .3], [1.05 + .2 * Math.sin(t * 12 + i), -.6]]; p.mouth = 'open'; } seats[i] = p; return; }
    if (t >= s - 2 && t < s - .5) { const q = (t - (s - 2)) / 1.5, hop = 70 * Math.abs(Math.sin(Math.PI * (t - (s - 2)) / B)); front.push({ x: lerp(W + 120, Math.min(x + 440, W - 100), easeOut(q)), y: 890 - 60 - hop, r: 60, color: v.hex, look: [-.6, -.1], mouth: 'open', shadow: 890 }); }
    else if (t >= s - .5 && t < s + .25) { const u = (t - (s - .5)) / .75, x0 = Math.min(x + 440, W - 100); front.push({ x: lerp(x0, rx, u), y: lerp(830, roofY - 75, u) - 260 * Math.sin(Math.PI * u), r: lerp(60, 75, u), color: v.hex, rot: -Math.PI * 2 * easeInOut(u), mouth: 'open', happyEyes: true }); }
    else if (t >= s + .25 && t < e - 1.2) {
      const p = { x: rx, y: roofY - 75 - 10 * Math.abs(Math.sin(Math.PI * t / B)), r: 75, color: v.hex, look: [0, .1], blink: blinkAt(t, i + 4), rot: .05 * Math.sin(Math.PI * t / B), mouthOpen: singMouth(seg, t) * .5 };
      const a = actionAt(seg, t); if (a && a.verse === i) applyAction(p, v.action, (t - a.t) / a.d, a.d, t, i * 10);
      const land = t - (s + .25); if (land < .25) { const k = Math.exp(-Math.pow(land / .08, 2)); p.sy = (p.sy || 1) * (1 - .25 * k); p.sx = (p.sx || 1) * (1 + .2 * k); p.y += p.r * .25 * k; }
      front.push(p);
    } else if (t >= e - 1.2 && t < e - .5) { const u = (t - (e - 1.2)) / .7; front.push({ x: lerp(rx, sx, u), y: lerp(roofY - 75, sy - b, u) - 170 * Math.sin(Math.PI * u), r: lerp(75, 42, u), color: v.hex, mouth: 'open', happyEyes: u > .3, rot: .3 * Math.sin(Math.PI * u) }); }
  });
  drawVehicle(veh, x, t, { seats, n, bob: b, wheelAng: (300 * t + x) / 58, waving: te < 4 });
  if (veh === 'boat') seaFront(t, speed * t);
  for (const p of front) { if (p.shadow) { ctx.fillStyle = 'rgba(30,30,60,0.2)'; ell(p.x, p.shadow, p.r * .8, p.r * .15); ctx.fill(); } drawBloop(p); if (p.fx) p.fx(); }
  verseWord(seg, t);
}

function renderFarm(seg, t) {
  const B = B_(seg); drawScene('farm', t, 30);
  const vi = verseAt(seg, t), v = seg.verses[vi];
  // grandpa
  drawBloop({ x: 330, y: 740 - 8 * Math.abs(Math.sin(Math.PI * t / B)), r: 100, color: '#7BC96F', strawhat: true, look: [.6, 0], blink: blinkAt(t, 3), mouthOpen: singMouth(seg, t), hands: [[-1.0, .3], [1.05, -.2 + .2 * Math.sin(t * 4)]] });
  // previous animals
  seg.verses.forEach((w, i) => { if (i < vi || (i === vi && t > w.end + .2)) drawBloop({ x: 1380 + (i % 5) * 110, y: 930 - 6 * Math.abs(Math.sin(Math.PI * t / B + i)), r: 55, costume: w.animal, blink: blinkAt(t, i), t }); });
  // current animal
  if (t <= v.end + .2) {
    const q = clamp((t - (v.start - 1.6)) / 1.4, 0, 1), hop = q < 1 ? 80 * Math.abs(Math.sin(Math.PI * q * 3)) : 0;
    const p = { x: lerp(W + 200, 1050, easeOut(q)), y: 700 - hop - 10 * Math.abs(Math.sin(Math.PI * t / B)), r: 135, costume: v.animal, blink: blinkAt(t, vi + 7), look: [-.4, .1], t };
    const a = actionAt(seg, t);
    if (a && a.verse === vi) { const u = (t - a.t) / a.d; p.mouth = 'open'; p.sy = 1 + .12 * Math.sin(Math.PI * u); p.sx = 1 - .06 * Math.sin(Math.PI * u); p.y -= 40 * Math.sin(Math.PI * u); bubble(p.x + 150, p.y - 210, v.sound + '!', 64, '#FF6B6B', easeOutBack(u / .3)); }
    ctx.fillStyle = 'rgba(30,30,60,0.2)'; ell(p.x, 840, 110, 20); ctx.fill();
    drawBloop(p); if (a && a.verse === vi) {}
  }
  verseWord(seg, t);
}

const WORD_COLOR = { red: 'red', rouge: 'red', orange: 'orange', yellow: 'yellow', jaune: 'yellow', green: 'green', vert: 'green', blue: 'blue', bleu: 'blue', purple: 'purple', violet: 'purple', pink: 'pink', rose: 'pink' };
const WORD_SHAPE = { circle: 'circle', rond: 'circle', square: 'square', carré: 'square', triangle: 'triangle', star: 'star', étoile: 'star', heart: 'heart', cœur: 'heart' };
const norm = s => s.toLowerCase().replace(/[^a-zàâçéèêëîïôûùüÿœ]/g, '');
function renderTwinkle(seg, t) {
  const B = B_(seg), w = activeWord(seg, t), key = w ? norm(w.text) : '';
  if (seg.theme === 'rainbow') {
    drawScene('flowers', t, 25);
    const grow = clamp((t - seg.start) / 4, 0, 1);
    for (let i = 0; i < 7; i++) { ctx.strokeStyle = RAINBOW[i]; ctx.lineWidth = 34; ctx.beginPath(); ctx.arc(W / 2, 900, 640 - i * 34, Math.PI, Math.PI + Math.PI * grow); ctx.stroke(); }
    const cols = ['red', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink'];
    cols.forEach((c, i) => {
      const on = WORD_COLOR[key] === c, x = 330 + i * 210, y = 800 - (on ? 70 : 0) * (w ? Math.sin(Math.PI * clamp((t - w.t) / w.d, 0, 1)) : 0) - 8 * Math.abs(Math.sin(Math.PI * t / B + i));
      drawBloop({ x, y, r: on ? 82 : 62, color: COLOR_HEX[c], blink: blinkAt(t, i), mouth: on ? 'open' : 'smile', happyEyes: on, t });
      if (on) sparkles(x, y, 80, clamp((t - w.t) / w.d, 0, 1), i);
    });
  } else if (seg.theme === 'shapes') {
    drawStage(t, SCENE_PAL.stage);
    const ks = ['circle', 'square', 'triangle', 'star', 'heart'];
    ks.forEach((k, i) => { const on = WORD_SHAPE[key] === k, x = 340 + i * 310, y = 560 + 25 * Math.sin(t * 2 + i); drawShape(k, x, y - (on ? 60 : 0), on ? 125 : 95, RAINBOW[i], t, i, { mouth: on ? 'open' : null, happy: on, rot: on ? .1 * Math.sin(t * 8) : 0 }); });
    drawBloop({ x: 960, y: 900, r: 80, antenna: true, t, mouthOpen: singMouth(seg, t), blink: blinkAt(t, 1) });
  } else {
    drawScene('night', t, 15);
    const sw = Math.sin(t * 1.2) * .06;
    ctx.save(); ctx.translate(960, 620); ctx.rotate(sw); drawCloud(-170, 40, 1.5, '#E8EAFF');
    drawBloop({ x: 0, y: -40, r: 120, color: HOST, nightcap: true, sleepy: (t % 6) > 3, mouthOpen: singMouth(seg, t) * .6, look: [0, .2], t }); ctx.restore();
  }
}

function renderRowboat(seg, t) {
  const B = B_(seg), cam = 70 * t; drawScene('sea', t, 70);
  const vi = verseAt(seg, t), v = seg.verses[vi];
  const x = 700, rock = Math.sin(t * 2.2) * .025, row = Math.sin(2 * Math.PI * t / (B * 3));
  const seats = [{ x: x - 220, y: 650, r: 55, color: '#FF7AB8', blink: blinkAt(t, 1), mouthOpen: singMouth(seg, t), hands: [[.9, .2 + .3 * row], [1.1, .3 + .3 * row]] },
                 { x: x - 60, y: 650, r: 55, color: HOST, antenna: true, t, blink: blinkAt(t, 2), mouthOpen: singMouth(seg, t), hands: [[.9, .2 + .3 * row], [1.1, .3 + .3 * row]] }];
  ctx.save(); ctx.strokeStyle = '#9A6A43'; ctx.lineWidth = 12; ctx.lineCap = 'round';
  for (const s of seats) { ctx.beginPath(); ctx.moveTo(s.x + 60, 700); ctx.lineTo(s.x + 60 + 120 * Math.cos(row), 860 + 30 * Math.sin(row)); ctx.stroke(); }
  ctx.restore();
  drawVehicle('boat', x, t, { seats, n: 2 });
  // sea friend
  const up = clamp((t - (v.start + .3)) / .6, 0, 1) * (1 - clamp((t - (v.end - .3)) / .4, 0, 1));
  if (up > 0) {
    const a = actionAt(seg, t), ax = 1450, ay = 900 - up * 220 + 10 * Math.sin(t * 3);
    const p = { x: ax, y: ay, r: 100, costume: v.animal, blink: blinkAt(t, vi), look: [-.6, 0], t, spout: v.animal === 'whale' ? .5 + .5 * Math.sin(t * 4) : 0 };
    if (a && a.verse === vi) { p.mouth = 'open'; p.hands = [[-1.0, .3], [1.05 + .2 * Math.sin(t * 12), -.6]]; }
    drawBloop(p);
  }
  seaFront(t, cam);
  verseWord(seg, t);
}

const COUNT_POS = n => { const out = []; const rows = n > 5 ? 2 : 1, per = Math.ceil(n / rows); for (let i = 0; i < n; i++) { const r = Math.floor(i / per), c = i % per, cnt = Math.min(per, n - r * per); out.push([W / 2 + (c - (cnt - 1) / 2) * 250 + 150, (rows > 1 ? 330 : 470) + r * 300]); } return out; };
function renderCount(seg, t) {
  const B = B_(seg); drawScene(seg.scene, t, 25);
  const vi = verseAt(seg, t), v = seg.verses[vi], n = v.n || vi + 1, pos = COUNT_POS(n);
  pos.forEach(([x, y], i) => { const born = i === n - 1 ? v.start - .1 : -1, k = born > 0 ? easeOutBack((t - born) / .5) : 1; if (k <= 0) return; ctx.save(); ctx.translate(x, y - 12 * Math.abs(Math.sin(Math.PI * t / B + i * .5))); ctx.scale(k * 1.3, k * 1.3); drawCountObj(seg.obj, 0, 0, 1, t, i); ctx.restore(); outlinedText(String(i + 1), x, y + 135, 52, RAINBOW[i % 7], { stroke: .14 }); });
  drawBloop({ x: 230, y: 800 - 8 * Math.abs(Math.sin(Math.PI * t / B)), r: 110, antenna: true, t, mouthOpen: singMouth(seg, t), blink: blinkAt(t, 2), look: [.5, -.2], hands: [[-1.0, .3], [1.1, -.5]] });
  const k = easeOutBack((t - v.start + .2) / .5); if (k > 0) { ctx.save(); ctx.translate(230, 300); ctx.scale(k, k); outlinedText(String(n), 0, 0, 200, RAINBOW[(n - 1) % 7]); ctx.restore(); }
}

function bush(x, y, s) { ctx.fillStyle = '#3FAF4A'; for (const [dx, dy, r] of [[-90, 0, 80], [0, -40, 100], [95, 0, 82], [-40, 20, 80], [50, 25, 80]]) { circle(x + dx * s, y + dy * s, r * s); ctx.fill(); } ctx.fillStyle = '#55C25A'; for (const [dx, dy, r] of [[-60, -30, 40], [20, -80, 45], [90, -20, 35]]) { circle(x + dx * s, y + dy * s, r * s); ctx.fill(); } ctx.fillStyle = '#FF7AA8'; for (let i = 0; i < 5; i++) { circle(x + (rnd(i + x) - .5) * 220 * s, y - rnd(i + 3 + x) * 110 * s, 9 * s); ctx.fill(); } }
function renderHide(seg, t) {
  const B = B_(seg); drawScene(seg.scene, t, 20);
  const vi = verseAt(seg, t), v = seg.verses[vi], bushes = [700, 1150, 1600], bx = bushes[vi % 3];
  const L = v.lines, popT = L[2] ? L[2].start + .3 : v.start + 4, a = actionAt(seg, t);
  const looking = t < popT;
  drawBloop({ x: 280, y: 760 - 8 * Math.abs(Math.sin(Math.PI * t / B)), r: 110, antenna: true, t, look: looking ? [Math.sin(t * 2.5), 0] : [.7, 0], mouthOpen: singMouth(seg, t), blink: blinkAt(t, 5), hands: looking ? [[-.6, -.45], [1.05, .3]] : [[-1.0, .3], [1.05, .3]] });
  bushes.forEach((x, i) => { if (i !== vi % 3) bush(x, 810, 1); });
  let p;
  if (t < popT) { p = { x: bx + 30 * Math.sin(t * 1.5), y: 735 + 20 * Math.sin(t * 3), r: 85, color: v.hex, look: [Math.sin(t * 2), -.3], blink: blinkAt(t, vi) }; drawBloop(p); bush(bx, 810, 1); }
  else {
    const u = clamp((t - popT) / .6, 0, 1), leave = clamp((t - (v.end - .6)) / .6, 0, 1);
    p = { x: lerp(bx, bx - 180, easeOut(u)) + leave * 900, y: lerp(735, 640, easeOut(u)) - 200 * Math.sin(Math.PI * u) - 8 * Math.abs(Math.sin(Math.PI * t / B)), r: 95, color: v.hex, mouthOpen: singMouth(seg, t), blink: blinkAt(t, vi), look: [-.6, 0], hands: [[-1.0, .3], [1.05, -.4]] };
    if (a && a.verse === vi) applyAction(p, v.action, (t - a.t) / a.d, a.d, t, vi);
    bush(bx, 810, 1); drawBloop(p); if (p.fx) p.fx();
    if (u < 1) sparkles(bx - 100, 650, 70, u, vi);
  }
  verseWord(seg, t);
}

function renderFruits(seg, t) {
  const B = B_(seg); drawScene(seg.scene, t, 20);
  const vi = verseAt(seg, t), v = seg.verses[vi], a = actionAt(seg, t), chew = a && a.verse === vi;
  const k = easeOutBack((t - (v.start - .4)) / .6);
  if (k > 0) { ctx.save(); ctx.translate(1250, 560 - 15 * Math.abs(Math.sin(Math.PI * t / B))); ctx.scale(k * (chew ? 1 + .05 * Math.sin(t * 20) : 1), k); drawFruit(v.fruit, 0, 0, 1.6, t, vi); ctx.restore(); }
  const p = { x: 640, y: 740 - 10 * Math.abs(Math.sin(Math.PI * t / B)), r: 130, antenna: true, t, look: [.7, -.2], blink: blinkAt(t, 3), mouthOpen: chew ? Math.abs(Math.sin(t * 18)) : singMouth(seg, t), happyEyes: chew, hands: chew ? [[-.5, .3], [.9, .1]] : [[-1.0, .3], [1.0, .3]] };
  drawBloop(p);
  if (chew) { const u = (t - a.t) / a.d; for (let i = 0; i < 5; i++) { const hx = 640 + (i - 2) * 70, hy = 560 - u * 260 - i * 20; ctx.fillStyle = `rgba(255,90,140,${1 - u})`; heartPath(hx, hy, 26); ctx.fill(); } }
  verseWord(seg, t);
}

function renderVehicles(seg, t) {
  const B = B_(seg); drawScene(seg.scene, t, 120, { road: true });
  const vi = verseAt(seg, t), v = seg.verses[vi], a = actionAt(seg, t);
  const inq = clamp((t - (v.start - 1.2)) / 2, 0, 1), outq = clamp((t - (v.end - .8)) / 1.2, 0, 1);
  const x = lerp(-500, 940, easeOut(inq)) + easeIn(outq) * 1600;
  vehicleSmall(v.vehicle, x, 860, t, { bob: bobOf(t, B), wheelAng: t * 6, waving: a && a.verse === vi });
  if (a && a.verse === vi && a.word && norm(a.word) === norm(v.sound)) bubble(x + 260, 420, v.sound + '!', 70, '#FF6B6B', easeOutBack((t - a.t) / .25));
  drawBloop({ x: 220, y: 760 - 8 * Math.abs(Math.sin(Math.PI * t / B)), r: 95, antenna: true, t, mouthOpen: singMouth(seg, t), blink: blinkAt(t, 1), look: [.6, 0], hands: [[-1, .3], [1.05, -.2 + .3 * Math.sin(t * 5)]] });
  verseWord(seg, t);
}

function renderLullaby(seg, t) {
  const B = B_(seg); drawScene('night', t, 10);
  const sw = Math.sin(t * 1.1) * .12;
  ctx.save(); ctx.translate(900, 120); ctx.rotate(sw);
  ctx.strokeStyle = 'rgba(255,240,180,0.8)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(-60, 0); ctx.lineTo(-60, 330); ctx.moveTo(60, 0); ctx.lineTo(60, 330); ctx.stroke();
  ctx.fillStyle = '#FFE58A'; ctx.beginPath(); ctx.arc(0, 420, 170, Math.PI * .05, Math.PI * .95); ctx.arc(0, 330, 150, Math.PI * .9, Math.PI * .1, true); ctx.fill();
  drawBloop({ x: 0, y: 330, r: 95, color: HOST, nightcap: true, sleepy: (t % 7) > 4, mouthOpen: singMouth(seg, t) * .5, blink: blinkAt(t, 2), t, look: [0, .2] });
  ctx.restore();
  // fence + sleepy sheep jumping
  ctx.fillStyle = '#E8E0D5'; for (let x = 900; x <= 1300; x += 100) { rr(x - 8, 760, 16, 90, 5); ctx.fill(); } ctx.fillRect(880, 780, 440, 12); ctx.fillRect(880, 815, 440, 12);
  for (let k = 0; k < 3; k++) { const ph = ((t / 2.4 + k / 3) % 1), x = lerp(600, 1650, ph), y = 820 - 230 * Math.max(0, Math.sin(Math.PI * clamp((ph - .3) / .4, 0, 1))); drawBloop({ x, y, r: 55, costume: 'sheep', sleepy: true, t, hands: [] }); }
}

function renderDance(seg, t) {
  const B = B_(seg); drawStage(t, SCENE_PAL.stage);
  const vi = verseAt(seg, t), v = seg.verses[vi], a = actionAt(seg, t);
  for (let i = 0; i < 5; i++) {
    const x = 380 + i * 290, p = { x, y: 760 - 12 * Math.abs(Math.sin(Math.PI * t / B + i * .3)), r: 85, color: i === 2 ? HOST : RAINBOW[(i * 2) % 7], antenna: i === 2, t, blink: blinkAt(t, i), mouthOpen: singMouth(seg, t) * .7, rot: .06 * Math.sin(Math.PI * t / B + i) };
    if (a && a.verse === vi) applyAction(p, v.action, clamp((t - a.t - i * .03) / a.d, 0, 1), a.d, t, i);
    ctx.fillStyle = 'rgba(0,0,0,0.2)'; ell(x, 850, 70, 14); ctx.fill(); drawBloop(p); if (p.fx) p.fx();
  }
  if (a) for (let i = 0; i < 30; i++) { const u = (t - a.t) / a.d, cx = rnd(i + Math.floor(a.t * 10)) * W, cy = u * 900 - 100 + rnd(i + 5) * 200; ctx.fillStyle = RAINBOW[i % 7]; ctx.save(); ctx.translate(cx, cy); ctx.rotate(u * 10 + i); ctx.fillRect(-8, -4, 16, 8); ctx.restore(); }
  verseWord(seg, t);
}

// ------------------------------------------------------------ talk / lessons
function host(x, y, r, t, mouth, opts = {}) { drawBloop(Object.assign({ x, y: y - 8 * Math.abs(Math.sin(t * 3)), r, antenna: true, t, mouthOpen: mouth, blink: blinkAt(t, 2), look: [0, .1] }, opts)); }
function renderTalk(seg, t) {
  drawScene(seg.scene || 'trees', t, 30);
  const m = envAt(seg.env, seg.env_t0, t), u = t - seg.start;
  const k = easeOutBack(u / .5);
  if (seg.type === 'bye') {
    for (let i = 0; i < 4; i++) drawBloop({ x: 400 + i * 380 + (i > 1 ? 200 : -200) * 0, y: 860 - 10 * Math.abs(Math.sin(t * 4 + i)), r: 70, color: ['#FF4B4B', '#3D8BFF', '#FFC928', '#FF7AB8'][i], mouth: 'open', t, hands: [[-1, .3], [1.05 + .2 * Math.sin(t * 12 + i), -.6]] });
    host(960, 600, 170 * k, t, m, { hands: [[-1, .3], [1.05 + .2 * Math.sin(t * 12), -.6]] });
  } else host(960, 680, 170 * k, t, m, { hands: [[-1.02, .3 - .2 * m], [1.02, .3 - .2 * m]] });
  if (seg.type === 'announce' && seg.song_title) {
    const kk = easeOutBack((u - .2) / .5);
    if (kk > 0) { ctx.save(); ctx.translate(W / 2, 220); ctx.scale(kk, kk); const size = fitSize(seg.song_title, 96, 1500); ctx.font = `800 ${size}px ${FONT}`; const w = ctx.measureText(seg.song_title).width + 140; ctx.fillStyle = '#FFFFFF'; rr(-w / 2, -82, w, 164, 82); ctx.fill(); ctx.lineWidth = 10; ctx.strokeStyle = '#FFC928'; ctx.stroke(); outlinedText(seg.song_title, 0, 4, size, '#9B6BFF', { stroke: .1 }); ctx.restore(); }
  }
}
function lessonHost(seg, t) { host(260, 790, 110, t, envAt(seg.envs, seg.start, t), { look: [.6, -.1] }); }
function roundAt(seg, t) { let r = null; for (const x of seg.rounds || []) if (t >= x.t_q - .3) r = x; return r; }
function renderLesson(seg, t) {
  drawScene(seg.scene, t, 15);
  if (seg.kind === 'count') {
    const pos = COUNT_POS(seg.n);
    let shown = 0;
    seg.events.forEach((e, i) => { if (t < e.t) return; shown = e.i; const k = easeOutBack((t - e.t) / .45), [x, y] = pos[i]; ctx.save(); ctx.translate(x, y - 10 * Math.abs(Math.sin(t * 3 + i))); ctx.scale(k * 1.3, k * 1.3); drawCountObj(seg.obj, 0, 0, 1, t, i); ctx.restore(); outlinedText(String(e.i), x, y + 135, 50 * Math.min(1, k), RAINBOW[i % 7], { stroke: .14 }); });
    if (shown) { const e = seg.events[shown - 1], k = easeOutBack((t - e.t) / .4); ctx.save(); ctx.translate(260, 330); ctx.scale(k, k); outlinedText(String(shown), 0, 0, 220, RAINBOW[(shown - 1) % 7]); ctx.restore(); }
  } else if (seg.kind === 'find') {
    const r = roundAt(seg, t), revealed = r && t >= r.t_a;
    seg.balls.forEach((b, i) => {
      const x = 640 + i * 270, target = r && b.color === r.color, p = { x, y: 690 - 10 * Math.abs(Math.sin(t * 3 + i)), r: 95, color: b.hex, blink: blinkAt(t, i), t, look: [0, .1] };
      if (revealed) { if (target) { const u = clamp((t - r.t_a) / .8, 0, 1); p.y -= 120 * Math.sin(Math.PI * u); p.mouth = 'open'; p.happyEyes = true; p.r = 110; } else p.alpha = .45; }
      drawBloop(p); if (revealed && target) sparkles(p.x, p.y, 110, clamp((t - r.t_a) / 1.2, 0, 1), i);
    });
    if (r && !revealed) bubble(400, 470, '?', 90, '#9B6BFF', easeOutBack((t - r.t_q) / .3));
    if (revealed) { const k = easeOutBack((t - r.t_a) / .4); ctx.save(); ctx.translate(W / 2 + 160, 200); ctx.scale(k, k); outlinedText(r.word, 0, 0, 150, r.hex); ctx.restore(); }
  } else if (seg.kind === 'shape') {
    const r = roundAt(seg, t); if (r) {
      const revealed = t >= r.t_a, k = easeOutBack((t - r.t_q + .3) / .5), u = revealed ? clamp((t - r.t_a) / .6, 0, 1) : 0;
      if (k > 0) drawShape(r.shape, 1050, 560 - 60 * Math.sin(Math.PI * u), 210 * k, r.hex, t, 3, { mouth: revealed ? 'open' : null, happy: revealed, rot: revealed ? 0 : .06 * Math.sin(t * 3) });
      if (!revealed) bubble(1400, 300, '?', 100, '#9B6BFF', k);
      else { const kk = easeOutBack(u / .7); ctx.save(); ctx.translate(1050, 170); ctx.scale(kk, kk); outlinedText(r.word, 0, 0, 140, r.hex); ctx.restore(); sparkles(1050, 560, 220, u, 7); }
    }
  } else if (seg.kind === 'animal') {
    const r = roundAt(seg, t); if (r) {
      const revealed = t >= r.t_a, k = easeOutBack((t - r.t_q + .3) / .5), u = revealed ? clamp((t - r.t_a) / .6, 0, 1) : 0;
      if (k > 0) drawBloop({ x: 1050, y: 620 - 70 * Math.sin(Math.PI * u), r: 180 * k, costume: r.animal, silhouette: !revealed, blink: blinkAt(t, 4), mouth: revealed ? 'open' : null, t });
      if (!revealed) bubble(1350, 300, r.sound + '?', 80, '#9B6BFF', k);
      else { bubble(1380, 330, r.sound + '!', 70, '#FF6B6B', easeOutBack(u / .5)); const kk = easeOutBack(u / .7); ctx.save(); ctx.translate(1050, 170); ctx.scale(kk, kk); outlinedText(r.word, 0, 0, 140, '#FF9F43'); ctx.restore(); }
    }
  }
  lessonHost(seg, t);
}
function renderTitle(seg, t) {
  drawScene('trees', t, 40);
  const u = t - seg.start;
  popLetters(TL.brand, W / 2, 300, 200, .1, u, RAINBOW);
  if (TL.ep_title) { const k = easeOutBack((u - .8) / .5); if (k > 0) { ctx.save(); ctx.translate(W / 2, 470); ctx.scale(k, k); outlinedText(TL.ep_title, 0, 0, fitSize(TL.ep_title, 70, 1600), '#9B6BFF', { stroke: .14 }); ctx.restore(); } }
  host(960, 760, 150 * easeOutBack((u - .3) / .5), t, 0, { mouth: 'open', happyEyes: true, hands: [[-1, .3], [1.05 + .2 * Math.sin(t * 12), -.6]] });
}
function renderEnd(seg, t) {
  drawScene('night', t, 10);
  const u = t - seg.start;
  popLetters(TL.ui.bye, W / 2, 260, 190, .1, u, RAINBOW);
  for (let i = 0; i < 5; i++) drawBloop({ x: 480 + i * 240, y: 760 - 14 * Math.abs(Math.sin(t * 4 + i)), r: 80, color: i === 2 ? HOST : RAINBOW[i * 2 % 7], antenna: i === 2, t, mouth: 'open', hands: [[-1, .3], [1.05 + .2 * Math.sin(t * 12 + i), -.6]] });
  const f = clamp((t - (seg.end - .8)) / .8, 0, 1); if (f > 0) { ctx.fillStyle = `rgba(255,255,255,${f})`; ctx.fillRect(0, 0, W, H); }
}

const SONG_R = { ride: renderRide, farm: renderFarm, twinkle: renderTwinkle, rowboat: renderRowboat, count: renderCount, hide: renderHide, fruits: renderFruits, vehicles: renderVehicles, lullaby: renderLullaby, dance: renderDance };
function segAt(t) { let s = TL.segments[0], idx = 0; TL.segments.forEach((x, i) => { if (t >= x.start) { s = x; idx = i; } }); return [s, idx]; }
function transition(t) {
  for (let i = 1; i < TL.segments.length; i++) {
    const s = TL.segments[i];
    if (!(s.type === 'song' || s.type === 'lesson' || s.type === 'end' || s.type === 'announce')) continue;
    const d = t - s.start; if (Math.abs(d) > .4) continue;
    const cover = 1 - Math.abs(d) / .4, R = easeInOut(cover) * 1250, col = RAINBOW[i % 7];
    ctx.fillStyle = col; circle(W / 2, H / 2, R); ctx.fill();
    ctx.fillStyle = shade(col, .3); circle(W / 2, H / 2, R * .8); ctx.fill();
    if (cover > .6) drawBloop({ x: W / 2, y: H / 2, r: 120 * (cover - .6) / .4, antenna: true, t, happyEyes: true, mouth: 'open' });
  }
}
function drawFrame(t) {
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.filter = 'none';
  const [seg] = segAt(t);
  if (seg.type === 'song') { (SONG_R[seg.kind] || renderDance)(seg, t); songBanner(seg, t); karaoke(seg, t); }
  else if (seg.type === 'lesson') renderLesson(seg, t);
  else if (seg.type === 'title') renderTitle(seg, t);
  else if (seg.type === 'end') renderEnd(seg, t);
  else renderTalk(seg, t);
  ctx.globalAlpha = 1; ctx.filter = 'none';
  transition(t);
}
function renderFrame(t, q) { drawFrame(t); return cv.toDataURL('image/jpeg', q || 0.92).split(',')[1]; }
function renderPNG(t) { drawFrame(t); return cv.toDataURL('image/png').split(',')[1]; }

// ------------------------------------------------------------ thumbnail
function renderThumb(variant) {
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.filter = 'none';
  const v = TL.seed || variant, t = 2.0 + (v % 7);
  const scenes = ['flowers', 'trees', 'houses', 'farm', 'pines', 'snow'], sc = scenes[v % scenes.length];
  const veh = ['bus', 'train', 'bus', 'boat'][Math.floor(v / 6) % 4];
  drawScene(veh === 'boat' ? 'sea' : sc, t, 0, { road: veh === 'bus' });
  if (veh === 'train') rails(0, SCENE_PAL[sc] || SCENE_PAL.trees);
  const cols = [0, 1, 2, 3].map(k => RAINBOW[(k * 2 + v) % 7]);
  if (veh === 'boat') drawVehicle('boat', 600, t, { n: 4, seats: cols.map((c, k) => ({ x: 300 + k * 187, y: 622, r: 52, color: c, mouth: 'open', happyEyes: k % 2 === 0 })) });
  else { const gm = vehicleGeom(veh, veh === 'train' ? 560 : 520, 4); drawVehicle(veh, veh === 'train' ? 560 : 520, t, { n: 4, seats: cols.map((c, k) => ({ x: gm.seats[k][0], y: veh === 'train' ? 683 : 668, r: 44, color: c, mouth: 'open', happyEyes: k % 2 === 0, look: [.5, 0] })), wheelAng: 1 }); }
  const right = veh === 'train' ? 1700 : 1560;
  drawBloop({ x: right, y: 800, r: 170, antenna: true, t, mouth: 'open', happyEyes: v % 2 === 0, hands: [[-1, .3], [1.1, -.65]] });
  drawBloop({ x: right - 360, y: 870, r: 95, costume: ['cow', 'duck', 'pig', 'frog', 'cat', 'dog', 'sheep', 'hen'][v % 8], mouth: 'open', t });
  const words = (TL.ep_title || 'Fun Songs').toUpperCase().split(' ');
  const mid = Math.ceil(words.length / 2), l1 = words.slice(0, mid).join(' '), l2 = words.slice(mid).join(' ');
  const s1 = fitSize(l1, 150, 1750), s2 = fitSize(l2, 150, 1750);
  ctx.save(); ctx.translate(W / 2, 175); ctx.rotate(-.03); outlinedText(l1, 0, 0, s1, '#FF4B4B', { stroke: .2 }); ctx.restore();
  if (l2) { ctx.save(); ctx.translate(W / 2, 175 + s1 * .95); ctx.rotate(.02); outlinedText(l2, 0, 0, s2, '#3D8BFF', { stroke: .2 }); ctx.restore(); }
  ctx.save(); ctx.translate(230, 980); ctx.rotate(-.05); const bs = 64; ctx.font = `800 ${bs}px ${FONT}`; const bw = ctx.measureText(TL.brand).width + 70;
  ctx.fillStyle = '#9B6BFF'; rr(-bw / 2, -50, bw, 100, 50); ctx.fill(); outlinedText(TL.brand, 0, 4, bs, '#FFFFFF', { stroke: .08, strokeColor: '#5E35B1' }); ctx.restore();
  return cv.toDataURL('image/png').split(',')[1];
}
