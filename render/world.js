// Bloops Studio renderer - backgrounds (scenes) and vehicles.
const SCENE_PAL = {
  trees:   { skyTop: '#62C1FF', skyBot: '#E3F6FF', far: '#A7E08B', mid: '#74CC5A', grass: '#5DBB46', sun: '#FFD84D', sunY: 175, cloud: '#FFFFFF' },
  houses:  { skyTop: '#4AAEFF', skyBot: '#D2F0FF', far: '#B9E6A3', mid: '#86D167', grass: '#63C24C', sun: '#FFE066', sunY: 140, cloud: '#FFFFFF' },
  flowers: { skyTop: '#86D6FF', skyBot: '#F6FCFF', far: '#CDEE8E', mid: '#9AD85A', grass: '#78C94A', sun: '#FFE45C', sunY: 150, cloud: '#FFFFFF' },
  pines:   { skyTop: '#FF8FB0', skyBot: '#FFDCA6', far: '#A3C97E', mid: '#73B155', grass: '#5FA347', sun: '#FFA54D', sunY: 300, cloud: '#FFE6EE' },
  farm:    { skyTop: '#7CCBFF', skyBot: '#FFF4D6', far: '#B8E07A', mid: '#8CCF52', grass: '#7BC043', sun: '#FFD84D', sunY: 160, cloud: '#FFFFFF' },
  sea:     { skyTop: '#55BFFF', skyBot: '#DDF5FF', far: '#7DD87A', mid: '#5CC46A', grass: '#F7DFA0', sun: '#FFE066', sunY: 150, cloud: '#FFFFFF' },
  snow:    { skyTop: '#9FD8FF', skyBot: '#EEF8FF', far: '#E4F1FB', mid: '#F4FAFF', grass: '#FFFFFF', sun: '#FFF1A8', sunY: 170, cloud: '#FFFFFF' },
  night:   { skyTop: '#141A4A', skyBot: '#3B3F8F', far: '#2D4A6B', mid: '#22405A', grass: '#1F4A3A', sun: '#FFF3B0', sunY: 190, cloud: '#5A5FA8' },
  stage:   { skyTop: '#6A3FD8', skyBot: '#C77DFF', far: '#7B4FE0', mid: '#5E35B1', grass: '#C88A4B', sun: '#FFFFFF', sunY: 0, cloud: '#FFFFFF' },
};

function drawScene(scene, t, speed = 60, opts = {}) {
  const P = SCENE_PAL[scene] || SCENE_PAL.trees;
  if (scene === 'stage') return drawStage(t, P);
  const g = ctx.createLinearGradient(0, 0, 0, 830);
  g.addColorStop(0, P.skyTop); g.addColorStop(1, P.skyBot);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, 830);
  if (scene === 'night') { nightSky(t, P); }
  else { sun(t, P); clouds(t, P, speed); }
  const cam = speed * t;
  if (scene === 'sea') { seaWorld(t, P, cam); return; }
  hills(cam, P, scene);
  if (scene === 'farm') farmProps(cam, t, P);
  else if (scene === 'night') nightProps(cam, t, P);
  else props(cam, t, scene === 'snow' ? 'snowpines' : scene);
  if (opts.road) road(cam, P, t); else ground(cam, P, t, scene);
  if (scene === 'snow') snowfall(t);
  if (scene === 'night') fireflies(t);
}

function sun(t, P) {
  const sx = 1660, sy = P.sunY, sr = 82;
  const glow = ctx.createRadialGradient(sx, sy, sr * .6, sx, sy, sr * 2.6);
  glow.addColorStop(0, rgb(hex2rgb(P.sun), .55)); glow.addColorStop(1, rgb(hex2rgb(P.sun), 0));
  ctx.fillStyle = glow; ctx.fillRect(sx - sr * 3, sy - sr * 3, sr * 6, sr * 6);
  ctx.save(); ctx.translate(sx, sy); ctx.rotate(t * .25); ctx.fillStyle = P.sun;
  for (let i = 0; i < 12; i++) { ctx.rotate(Math.PI / 6); ctx.beginPath(); ctx.moveTo(sr * 1.12, -11); ctx.lineTo(sr * 1.5 + 6 * Math.sin(t * 3 + i), 0); ctx.lineTo(sr * 1.12, 11); ctx.closePath(); ctx.fill(); }
  ctx.restore();
  const sg = ctx.createRadialGradient(sx - 25, sy - 30, 10, sx, sy, sr); sg.addColorStop(0, shade(P.sun, .5)); sg.addColorStop(1, P.sun);
  ctx.fillStyle = sg; circle(sx, sy, sr); ctx.fill();
  ctx.strokeStyle = 'rgba(120,70,20,0.75)'; ctx.lineWidth = 6; ctx.lineCap = 'round';
  for (const s of [-1, 1]) { ctx.beginPath(); ctx.arc(sx + s * 26, sy - 8, 11, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke(); }
  ctx.beginPath(); ctx.arc(sx, sy + 10, 26, Math.PI * .2, Math.PI * .8); ctx.stroke();
  ctx.fillStyle = 'rgba(255,120,120,0.35)'; for (const s of [-1, 1]) { circle(sx + s * 48, sy + 14, 12); ctx.fill(); }
}
function clouds(t, P, speed) {
  for (let i = 0; i < 6; i++) {
    const span = W + 700, x = ((rnd(i) * span - t * (14 + rnd(i + 9) * 10) - speed * t * .04) % span + span) % span - 350;
    const y = 80 + rnd(i + 3) * 250, s = .65 + rnd(i + 5) * .6;
    if (x > 1450 && x < 1900 && y < 300) continue;  // keep the sun visible
    drawCloud(x, y, s, P.cloud);
  }
}
function drawCloud(x, y, s, col) {
  const parts = [[0, 0, 60], [55, -25, 52], [105, 0, 58], [50, 18, 55], [-45, 12, 42], [150, 15, 40]];
  ctx.fillStyle = 'rgba(150,180,220,0.25)'; for (const p of parts) { circle(x + p[0] * s, y + p[1] * s + 12 * s, p[2] * s); ctx.fill(); }
  ctx.fillStyle = col; for (const p of parts) { circle(x + p[0] * s, y + p[1] * s, p[2] * s); ctx.fill(); }
}
function hills(cam, P, scene) {
  const layer = (par, base, a1, f1, a2, f2, ph, col) => {
    const off = cam * par; ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(0, 840);
    for (let x = 0; x <= W; x += 16) { const u = x + off; ctx.lineTo(x, base + a1 * Math.sin(u * f1 + ph) + a2 * Math.sin(u * f2 + ph * 2)); }
    ctx.lineTo(W, 840); ctx.closePath(); ctx.fill();
  };
  layer(.12, 600, 45, .0035, 22, .009, 1.1, P.far);
  layer(.3, 700, 38, .0055, 18, .013, 2.3, P.mid);
}
function props(cam, t, type) {
  const par = .62, spacing = 270, off = cam * par;
  for (let k = Math.floor((off - 300) / spacing); k <= Math.ceil((off + W + 300) / spacing); k++) {
    const x = k * spacing + rnd(k) * 90 - off; if (x < -250 || x > W + 250) continue;
    const kk = k + 1000, s = .8 + rnd(k + 40) * .45, base = 812;
    if (type === 'houses') house(x, base, s, kk); else if (type === 'flowers') bigFlower(x, base, s, kk, t);
    else if (type === 'pines') pine(x, base, s, kk, false); else if (type === 'snowpines') pine(x, base, s, kk, true); else tree(x, base, s, kk, t);
  }
}
function tree(x, b, s, k, t) {
  ctx.fillStyle = '#9A6A43'; rr(x - 13 * s, b - 130 * s, 26 * s, 132 * s, 8 * s); ctx.fill();
  const col = ['#4FC15A', '#3FB25A', '#66CC4E'][k % 3];
  const g = ctx.createRadialGradient(x - 30 * s, b - 230 * s, 10, x, b - 190 * s, 110 * s); g.addColorStop(0, shade(col, .35)); g.addColorStop(1, shade(col, -.15));
  ctx.fillStyle = g; for (const p of [[0, -195, 78], [-52, -160, 54], [52, -160, 54], [0, -250, 52]]) { circle(x + p[0] * s, b + p[1] * s, p[2] * s); ctx.fill(); }
  if (k % 2 === 0) for (let i = 0; i < 4; i++) { ctx.fillStyle = '#FF5A5A'; circle(x + (rnd(k * 7 + i) - .5) * 120 * s, b - (150 + rnd(k * 3 + i) * 100) * s, 9 * s); ctx.fill(); }
}
function house(x, b, s, k) {
  const cols = ['#FFB3C7', '#FFE29A', '#B8E1FF', '#C9F2B5', '#E3C8FF'], roofs = ['#FF6B6B', '#5B8DEF', '#FF9F43', '#9B6BFF', '#2EC4B6'];
  const w = 170 * s, h = 140 * s, x0 = x - w / 2;
  ctx.fillStyle = cols[k % 5]; rr(x0, b - h, w, h, 10 * s); ctx.fill();
  ctx.fillStyle = roofs[(k + 2) % 5]; ctx.beginPath(); ctx.moveTo(x0 - 18 * s, b - h + 6 * s); ctx.lineTo(x, b - h - 95 * s); ctx.lineTo(x0 + w + 18 * s, b - h + 6 * s); ctx.closePath(); ctx.fill();
  ctx.fillRect(x0 + w * .7, b - h - 75 * s, 22 * s, 50 * s);
  ctx.fillStyle = '#8E5A3C'; rr(x - 22 * s, b - 78 * s, 44 * s, 78 * s, 14 * s); ctx.fill();
  for (const dx of [-55, 55]) { ctx.fillStyle = '#DDF4FF'; rr(x + dx * s - 22 * s, b - 115 * s, 44 * s, 40 * s, 8 * s); ctx.fill(); ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 4 * s; ctx.stroke(); }
}
function bigFlower(x, b, s, k, t) {
  const hgt = (170 + rnd(k + 2) * 90) * s;
  ctx.save(); ctx.translate(x, b); ctx.rotate(Math.sin(t * 2 + k) * .06);
  ctx.strokeStyle = '#3FAF4A'; ctx.lineWidth = 12 * s; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(12 * s, -hgt / 2, 0, -hgt); ctx.stroke();
  ctx.fillStyle = '#55C25A'; ell(-26 * s, -hgt * .4, 30 * s, 13 * s, .5); ctx.fill(); ell(26 * s, -hgt * .55, 30 * s, 13 * s, -.5); ctx.fill();
  const pc = ['#FF7AA8', '#FFB347', '#B28DFF', '#FF6B6B', '#7FD3FF'][k % 5];
  ctx.translate(0, -hgt); ctx.rotate(t * .5 + k);
  for (let i = 0; i < 8; i++) { ctx.rotate(Math.PI / 4); ctx.fillStyle = i % 2 ? pc : shade(pc, .25); ell(36 * s, 0, 30 * s, 18 * s); ctx.fill(); }
  ctx.rotate(-(t * .5 + k)); ctx.fillStyle = '#FFD23D'; circle(0, 0, 28 * s); ctx.fill();
  ctx.strokeStyle = '#8A5A1E'; ctx.lineWidth = 4 * s; ctx.beginPath(); ctx.arc(0, 2 * s, 13 * s, .2 * Math.PI, .8 * Math.PI); ctx.stroke();
  ctx.fillStyle = '#8A5A1E'; for (const d of [-1, 1]) { circle(d * 9 * s, -6 * s, 3.5 * s); ctx.fill(); }
  ctx.restore();
}
function pine(x, b, s, k, snowy) {
  ctx.fillStyle = '#8A5A3C'; ctx.fillRect(x - 11 * s, b - 50 * s, 22 * s, 52 * s);
  const col = ['#2F9E5B', '#3BAA62', '#2A8F55'][k % 3];
  for (let i = 0; i < 3; i++) {
    const w = (110 - i * 22) * s, y = b - 40 * s - i * 62 * s;
    ctx.fillStyle = i % 2 ? shade(col, .12) : col; ctx.beginPath(); ctx.moveTo(x - w, y); ctx.lineTo(x, y - 110 * s); ctx.lineTo(x + w, y); ctx.closePath(); ctx.fill();
    if (snowy) { ctx.fillStyle = '#FFFFFF'; ctx.beginPath(); ctx.moveTo(x - w * .45, y - 60 * s); ctx.lineTo(x, y - 110 * s); ctx.lineTo(x + w * .45, y - 60 * s); ctx.quadraticCurveTo(x, y - 48 * s, x - w * .45, y - 60 * s); ctx.fill(); }
  }
}
function ground(cam, P, t, scene) {
  const gg = ctx.createLinearGradient(0, 800, 0, H); gg.addColorStop(0, P.grass); gg.addColorStop(1, shade(P.grass, -.15));
  ctx.fillStyle = gg; ctx.beginPath(); ctx.moveTo(0, 815);
  for (let x = 0; x <= W; x += 20) ctx.lineTo(x, 812 + 6 * Math.sin((x + cam) * .01));
  ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath(); ctx.fill();
  if (scene === 'snow') return;
  for (let k = Math.floor(cam / 95) - 1; k < Math.floor(cam / 95) + 22; k++) {
    const x = k * 95 - cam + rnd(k) * 40, y = 850 + rnd(k + 1) * 200;
    if (k % 3 === 0) { const c = RAINBOW[((k % 7) + 7) % 7]; for (let i = 0; i < 5; i++) { const a = i * Math.PI * 2 / 5; ctx.fillStyle = shade(c, .3); circle(x + Math.cos(a) * 9, y + Math.sin(a) * 9, 7); ctx.fill(); } ctx.fillStyle = '#FFF2A8'; circle(x, y, 6); ctx.fill(); }
    else { ctx.strokeStyle = shade(P.grass, -.25); ctx.lineWidth = 4; ctx.lineCap = 'round'; for (const d of [-8, 0, 8]) { ctx.beginPath(); ctx.moveTo(x, y + 10); ctx.lineTo(x + d * 1.4, y - 8 - Math.abs(d)); ctx.stroke(); } }
  }
}
function road(cam, P, t) {
  ctx.fillStyle = P.grass; ctx.fillRect(0, 800, W, 30);
  const g = ctx.createLinearGradient(0, 822, 0, 962); g.addColorStop(0, '#7C8194'); g.addColorStop(1, '#5E6375');
  ctx.fillStyle = g; ctx.fillRect(0, 822, W, 140);
  ctx.fillStyle = '#F2F2F2'; ctx.fillRect(0, 818, W, 8); ctx.fillRect(0, 958, W, 8);
  const off = cam % 180; ctx.fillStyle = '#FFE680'; for (let x = -off; x < W; x += 180) { rr(x, 902, 90, 12, 6); ctx.fill(); }
  const gg = ctx.createLinearGradient(0, 966, 0, H); gg.addColorStop(0, P.grass); gg.addColorStop(1, shade(P.grass, -.15));
  ctx.fillStyle = gg; ctx.fillRect(0, 966, W, H - 966);
}
function rails(cam, P) {
  ctx.fillStyle = P.grass; ctx.fillRect(0, 800, W, H - 800);
  ctx.fillStyle = '#B9A58A'; ctx.fillRect(0, 870, W, 40);
  const off = cam % 70; ctx.fillStyle = '#8A6A4A'; for (let x = -off; x < W; x += 70) ctx.fillRect(x, 872, 22, 36);
  ctx.fillStyle = '#8E95A8'; ctx.fillRect(0, 876, W, 7); ctx.fillRect(0, 898, W, 7);
}
function farmProps(cam, t, P) {
  const bx = 300 - (cam * .2) % (W + 900);
  for (const ox of [0, W + 900]) {
    const x = bx + ox; if (x < -500 || x > W + 300) continue;
    ctx.fillStyle = '#D9443B'; rr(x - 160, 560, 320, 250, 8); ctx.fill();
    ctx.fillStyle = '#B5332C'; ctx.beginPath(); ctx.moveTo(x - 190, 575); ctx.lineTo(x, 430); ctx.lineTo(x + 190, 575); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#FFFFFF'; ctx.fillRect(x - 60, 680, 120, 130); ctx.fillStyle = '#8E2A24'; ctx.fillRect(x - 52, 688, 104, 122);
    ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(x - 52, 688); ctx.lineTo(x + 52, 810); ctx.moveTo(x + 52, 688); ctx.lineTo(x - 52, 810); ctx.stroke();
    ctx.fillStyle = '#FFF2C4'; circle(x, 520, 30); ctx.fill(); ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 6; ctx.stroke();
  }
  // haystacks
  for (let k = 0; k < 3; k++) { const x = ((900 + k * 520 - cam * .45) % (W + 400) + W + 400) % (W + 400) - 200; ctx.fillStyle = '#F2C14E'; ctx.beginPath(); ctx.arc(x, 812, 70, Math.PI, 0); ctx.fill(); ctx.strokeStyle = '#D9A63A'; ctx.lineWidth = 4; for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(x + i * 20, 812); ctx.lineTo(x + i * 14, 760); ctx.stroke(); } }
  // fence
  const off = cam * .62 % 120;
  ctx.fillStyle = '#FFFFFF';
  for (let x = -off - 120; x < W + 120; x += 120) { rr(x - 10, 720, 20, 100, 6); ctx.fill(); }
  ctx.fillRect(0, 740, W, 14); ctx.fillRect(0, 780, W, 14);
}
function nightSky(t, P) {
  for (let i = 0; i < 90; i++) {
    const x = rnd(i) * W, y = rnd(i + 100) * 640, tw = .5 + .5 * Math.sin(t * (1.5 + rnd(i + 7) * 2) + i);
    ctx.fillStyle = `rgba(255,250,220,${.35 + .65 * tw})`;
    if (i % 9 === 0) star(x, y, 9 + 5 * tw, t * .3 + i, '#FFF6C2', .5 + .5 * tw); else { circle(x, y, 1.5 + 2 * tw); ctx.fill(); }
  }
  const mx = 1600, my = P.sunY;
  const glow = ctx.createRadialGradient(mx, my, 40, mx, my, 260); glow.addColorStop(0, 'rgba(255,245,190,0.45)'); glow.addColorStop(1, 'rgba(255,245,190,0)');
  ctx.fillStyle = glow; ctx.fillRect(mx - 300, my - 300, 600, 600);
  ctx.fillStyle = '#FFF3B0'; circle(mx, my, 95); ctx.fill();
  ctx.fillStyle = P.skyTop; circle(mx + 50, my - 30, 85); ctx.fill();
  ctx.save(); ctx.translate(mx - 45, my + 10); ctx.strokeStyle = 'rgba(120,90,30,0.7)'; ctx.lineWidth = 5; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.arc(-5, -15, 10, Math.PI * .1, Math.PI * .9); ctx.stroke(); ctx.beginPath(); ctx.arc(0, 18, 14, Math.PI * .15, Math.PI * .8); ctx.stroke(); ctx.restore();
}
function nightProps(cam, t, P) { props(cam, t, 'pines'); ctx.fillStyle = 'rgba(20,26,74,0.45)'; ctx.fillRect(0, 300, W, 540); }
function fireflies(t) { for (let i = 0; i < 18; i++) { const x = (rnd(i) * W + Math.sin(t * .5 + i) * 60), y = 650 + rnd(i + 3) * 300 + Math.sin(t * .8 + i * 2) * 30, a = .5 + .5 * Math.sin(t * 3 + i); const g = ctx.createRadialGradient(x, y, 1, x, y, 18); g.addColorStop(0, `rgba(255,250,150,${a})`); g.addColorStop(1, 'rgba(255,250,150,0)'); ctx.fillStyle = g; circle(x, y, 18); ctx.fill(); } }
function snowfall(t) { ctx.fillStyle = 'rgba(255,255,255,0.9)'; for (let i = 0; i < 80; i++) { const x = ((rnd(i) * W + Math.sin(t + i) * 30 - t * 20) % W + W) % W, y = ((rnd(i + 50) * H + t * (40 + rnd(i) * 40)) % H); circle(x, y, 3 + rnd(i + 9) * 4); ctx.fill(); } }
function seaWorld(t, P, cam) {
  // island
  ctx.fillStyle = P.far; ctx.beginPath(); ctx.ellipse(420 - (cam * .05) % 2600, 640, 260, 70, 0, Math.PI, 0); ctx.fill();
  const g = ctx.createLinearGradient(0, 620, 0, H); g.addColorStop(0, '#3DB4E8'); g.addColorStop(1, '#1D7FC4');
  ctx.fillStyle = g; ctx.fillRect(0, 630, W, H - 630);
  for (let L = 0; L < 4; L++) {
    const y = 660 + L * 110, sp = 30 + L * 25;
    ctx.fillStyle = `rgba(255,255,255,${0.12 + L * 0.05})`;
    ctx.beginPath(); ctx.moveTo(0, y + 30);
    for (let x = 0; x <= W; x += 20) ctx.lineTo(x, y + 12 * Math.sin((x + cam * (0.3 + L * .3) + t * sp) * .012 + L));
    ctx.lineTo(W, y + 30); ctx.closePath(); ctx.fill();
  }
  for (let i = 0; i < 4; i++) { const x = ((rnd(i) * W - t * 50) % W + W) % W, y = 200 + rnd(i + 4) * 180; ctx.strokeStyle = '#4A5A70'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(x - 22, y); ctx.quadraticCurveTo(x - 10, y - 12 - 6 * Math.sin(t * 6 + i), x, y); ctx.quadraticCurveTo(x + 10, y - 12 - 6 * Math.sin(t * 6 + i), x + 22, y); ctx.stroke(); }
}
function seaFront(t, cam) {
  ctx.fillStyle = 'rgba(29,127,196,0.55)';
  ctx.beginPath(); ctx.moveTo(0, H);
  for (let x = 0; x <= W; x += 20) ctx.lineTo(x, 870 + 14 * Math.sin((x + cam + t * 70) * .01));
  ctx.lineTo(W, H); ctx.closePath(); ctx.fill();
}
function drawStage(t, P) {
  const g = ctx.createLinearGradient(0, 0, 0, 820); g.addColorStop(0, '#2A1B6B'); g.addColorStop(1, '#6A3FD8');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 40; i++) { ctx.fillStyle = `rgba(255,255,255,${.2 + .3 * Math.sin(t * 2 + i)})`; circle(rnd(i) * W, rnd(i + 9) * 600, 2 + rnd(i + 2) * 3); ctx.fill(); }
  // spotlights
  for (let i = 0; i < 4; i++) {
    const a = Math.sin(t * .8 + i * 1.7) * .35, x0 = 300 + i * 440;
    ctx.save(); ctx.translate(x0, -20); ctx.rotate(a);
    const sg = ctx.createLinearGradient(0, 0, 0, 900); sg.addColorStop(0, rgb(hex2rgb(RAINBOW[i * 2 % 7]), .45)); sg.addColorStop(1, rgb(hex2rgb(RAINBOW[i * 2 % 7]), 0));
    ctx.fillStyle = sg; ctx.beginPath(); ctx.moveTo(-30, 0); ctx.lineTo(30, 0); ctx.lineTo(220, 900); ctx.lineTo(-220, 900); ctx.closePath(); ctx.fill(); ctx.restore();
  }
  // bunting
  for (let i = 0; i < 24; i++) { const x = i * 84 + 20, y = 60 + 25 * Math.sin(i / 23 * Math.PI); ctx.fillStyle = RAINBOW[i % 7]; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 60, y + 4); ctx.lineTo(x + 30, y + 60); ctx.closePath(); ctx.fill(); }
  ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 4; ctx.beginPath(); for (let i = 0; i <= 24; i++) ctx.lineTo(i * 84 + 20, 60 + 25 * Math.sin(i / 23 * Math.PI)); ctx.stroke();
  // floor
  const fg = ctx.createLinearGradient(0, 800, 0, H); fg.addColorStop(0, '#E0A458'); fg.addColorStop(1, '#A86B32');
  ctx.fillStyle = fg; ctx.fillRect(0, 800, W, H - 800);
  ctx.strokeStyle = 'rgba(120,70,30,0.35)'; ctx.lineWidth = 3; for (let x = -200; x < W + 200; x += 120) { ctx.beginPath(); ctx.moveTo(W / 2 + (x - W / 2) * .5, 800); ctx.lineTo(x, H); ctx.stroke(); }
  // curtains
  for (const s of [0, 1]) {
    const cg = ctx.createLinearGradient(s ? W - 220 : 0, 0, s ? W : 220, 0); cg.addColorStop(0, '#C62F4A'); cg.addColorStop(1, '#8E1B33');
    ctx.fillStyle = cg; ctx.beginPath();
    if (!s) { ctx.moveTo(0, 0); ctx.lineTo(230, 0); ctx.quadraticCurveTo(150, 500, 210, 900); ctx.lineTo(0, 900); }
    else { ctx.moveTo(W, 0); ctx.lineTo(W - 230, 0); ctx.quadraticCurveTo(W - 150, 500, W - 210, 900); ctx.lineTo(W, 900); }
    ctx.closePath(); ctx.fill();
  }
}

// ---------------------------------------------------------------- vehicles
const BUSC = { body: '#9B6BFF', dark: '#6F45D9', glass: '#D6F3FF' };
function wheel(x, y, R, ang, hub = '#FFC928') {
  ctx.fillStyle = '#2D2B3A'; circle(x, y, R); ctx.fill(); ctx.fillStyle = '#3E3C50'; circle(x, y, R * .82); ctx.fill();
  const g = ctx.createRadialGradient(x - 8, y - 10, 4, x, y, R * .55); g.addColorStop(0, '#FFFFFF'); g.addColorStop(1, '#C8C8D8');
  ctx.fillStyle = g; circle(x, y, R * .55); ctx.fill();
  ctx.save(); ctx.translate(x, y); ctx.rotate(ang); for (let i = 0; i < 5; i++) { ctx.rotate(Math.PI * 2 / 5); ctx.fillStyle = hub; rr(-R * .09, -R * .5, R * .18, R * .38, R * .09); ctx.fill(); } ctx.restore();
  ctx.fillStyle = '#FF4B4B'; circle(x, y, R * .14); ctx.fill();
}
function windowSeat(wx, wy, ww, wh, seat) {
  ctx.fillStyle = BUSC.glass; rr(wx, wy, ww, wh, 18); ctx.fill();
  ctx.save(); rr(wx, wy, ww, wh, 18); ctx.clip();
  if (seat) drawBloop(seat);
  ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.beginPath(); ctx.moveTo(wx + 10, wy + wh); ctx.lineTo(wx + ww * .5, wy); ctx.lineTo(wx + ww * .75, wy); ctx.lineTo(wx + ww * .3, wy + wh); ctx.closePath(); ctx.fill();
  ctx.restore(); ctx.lineWidth = 6; ctx.strokeStyle = '#FFFFFF'; rr(wx, wy, ww, wh, 18); ctx.stroke();
}
function puffs(x, y, t, dir = -1, col = '235,235,245', rate = .28, sp = 160, up = 40) {
  for (let j = 0; j < 6; j++) { const spawn = Math.floor(t / rate) * rate - j * rate, a = t - spawn; if (spawn < 0) continue; ctx.fillStyle = `rgba(${col},${clamp(.6 * (1 - a / 1.6), 0, 1)})`; circle(x + dir * a * sp, y - a * up, 10 + a * 30); ctx.fill(); }
}
function driverBloop(x, y, t, r = 42, waving = false) {
  const w = waving ? Math.sin(t * 14) * .25 : 0;
  drawBloop({ x, y, r, color: '#FF9F43', cap: '#3D8BFF', look: [.6, 0], blink: blinkAt(t, 9), hands: waving ? [[.9 + w, -.5, .22], [1.1, .55, .22]] : [[.8, .6, .22], [1.15, .55, .22]] });
}
// Returns geometry so callers can place characters (roof, seats).
function vehicleGeom(kind, x, n) {
  if (kind === 'train') { const cars = Math.max(1, Math.ceil(n / 2)); const width = 300 + cars * 330; return { roof: 560, seats: Array.from({ length: n }, (_, k) => [x - width / 2 + 330 * Math.floor(k / 2) + 95 + (k % 2) * 140, 690]), roofX: x + width / 2 - 250, width }; }
  if (kind === 'boat') return { roof: 610, seats: Array.from({ length: n }, (_, k) => [x - 300 + k * (560 / Math.max(1, n - 1 || 1)), 622]), roofX: x + 40 };
  const ww = Math.min(105, 520 / Math.max(4, n) - 20); return { roof: 545, seats: Array.from({ length: n }, (_, k) => [x - 300 + k * (520 / Math.max(4, n)) + ww / 2, 668]), roofX: x - 40, ww };
}
function drawVehicle(kind, x, t, opts = {}) {
  const seats = opts.seats || [], n = opts.n || seats.length || 4, b = opts.bob || 0, ang = opts.wheelAng || 0;
  if (kind === 'bus') {
    const top = 545 - b, bot = 835 - b, gm = vehicleGeom('bus', x, n);
    ctx.fillStyle = 'rgba(30,30,60,0.22)'; ell(x, 889, 360, 20); ctx.fill();
    puffs(x - 345, 812 - b, t);
    const g = ctx.createLinearGradient(0, top, 0, bot); g.addColorStop(0, shade(BUSC.body, .25)); g.addColorStop(.6, BUSC.body); g.addColorStop(1, BUSC.dark);
    ctx.fillStyle = g; rr(x - 335, top, 670, bot - top, 46); ctx.fill(); ctx.lineWidth = 5; ctx.strokeStyle = shade(BUSC.dark, -.25); ctx.stroke();
    ctx.fillStyle = shade(BUSC.dark, -.1); rr(x - 260, top - 14, 520, 16, 8); ctx.fill(); ctx.fillStyle = '#FFD84D'; rr(x + 230, top - 26, 40, 18, 8); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.fillRect(x - 333, 742 - b, 666, 14); ctx.fillStyle = '#FFC928'; ctx.fillRect(x - 333, 758 - b, 666, 7);
    for (let k = 0; k < n; k++) windowSeat(gm.seats[k][0] - gm.ww / 2, 582 - b, gm.ww, 122, seats[k]);
    const fx = x + 218, fy = 578 - b; ctx.fillStyle = BUSC.glass; rr(fx, fy, 100, 135, 24); ctx.fill();
    ctx.save(); rr(fx, fy, 100, 135, 24); ctx.clip(); driverBloop(fx + 50, fy + 85, t, 42, opts.waving); ctx.strokeStyle = '#3A3550'; ctx.lineWidth = 7; ctx.beginPath(); ctx.arc(fx + 82, fy + 132, 24, Math.PI, Math.PI * 1.8); ctx.stroke(); ctx.restore();
    ctx.lineWidth = 6; ctx.strokeStyle = '#FFFFFF'; rr(fx, fy, 100, 135, 24); ctx.stroke();
    const hl = ctx.createRadialGradient(x + 322, 790 - b, 4, x + 322, 790 - b, 40); hl.addColorStop(0, 'rgba(255,250,200,1)'); hl.addColorStop(1, 'rgba(255,230,120,0)'); ctx.fillStyle = hl; circle(x + 322, 790 - b, 40); ctx.fill();
    ctx.fillStyle = '#FF4B4B'; rr(x - 342, 776 - b, 16, 30, 6); ctx.fill(); ctx.fillStyle = '#4A4560'; rr(x + 290, 822 - b, 62, 22, 10); ctx.fill(); rr(x - 355, 822 - b, 62, 22, 10); ctx.fill();
    for (const wx of [x - 205, x + 200]) { ctx.fillStyle = shade(BUSC.dark, -.35); ctx.beginPath(); ctx.arc(wx, 835 - b, 74, Math.PI, 0); ctx.fill(); wheel(wx, 827, 58, ang); }
    return gm;
  }
  if (kind === 'train') {
    const gm = vehicleGeom('train', x, n), cars = Math.max(1, Math.ceil(n / 2)), x0 = x - gm.width / 2;
    ctx.fillStyle = 'rgba(30,30,60,0.22)'; ell(x, 905, gm.width / 2 + 20, 18); ctx.fill();
    for (let c = 0; c < cars; c++) {
      const cx = x0 + c * 330, col = RAINBOW[(c * 2 + 1) % 7];
      ctx.fillStyle = col; rr(cx + 10, 600 - b, 310, 240, 26); ctx.fill(); ctx.lineWidth = 5; ctx.strokeStyle = shade(col, -.3); ctx.stroke();
      ctx.fillStyle = shade(col, -.2); rr(cx, 585 - b, 330, 26, 12); ctx.fill();
      for (let q = 0; q < 2; q++) { const k = c * 2 + q; if (k < n) windowSeat(gm.seats[k][0] - 55, 625 - b, 110, 115, seats[k]); }
      ctx.fillStyle = '#4A4560'; rr(cx + 320, 780 - b, 20, 14, 6); ctx.fill();
      for (const wx of [cx + 85, cx + 245]) wheel(wx, 850, 42, ang, '#FFFFFF');
    }
    const lx = x0 + cars * 330 + 10;
    ctx.fillStyle = '#E8473D'; rr(lx, 640 - b, 300, 200, 24); ctx.fill(); ctx.fillStyle = '#C23A31'; rr(lx - 10, 520 - b, 150, 170, 20); ctx.fill();
    ctx.fillStyle = '#3D3A50'; rr(lx + 190, 540 - b, 50, 110, 10); ctx.fill(); ctx.fillStyle = '#FFC928'; rr(lx + 180, 525 - b, 70, 22, 10); ctx.fill();
    ctx.fillStyle = BUSC.glass; rr(lx + 15, 545 - b, 105, 100, 18); ctx.fill(); ctx.save(); rr(lx + 15, 545 - b, 105, 100, 18); ctx.clip(); driverBloop(lx + 68, 615 - b, t, 40, opts.waving); ctx.restore();
    ctx.lineWidth = 6; ctx.strokeStyle = '#FFFFFF'; rr(lx + 15, 545 - b, 105, 100, 18); ctx.stroke();
    ctx.fillStyle = '#FFD84D'; circle(lx + 295, 740 - b, 22); ctx.fill(); ctx.fillStyle = '#5A5670'; ctx.beginPath(); ctx.moveTo(lx + 300, 830 - b); ctx.lineTo(lx + 360, 870); ctx.lineTo(lx + 300, 870); ctx.closePath(); ctx.fill();
    for (const wx of [lx + 70, lx + 230]) wheel(wx, 840, 52, ang, '#FFC928');
    puffs(lx + 215, 510 - b, t, -1, '250,250,255', .22, 120, 120);
    gm.roofX = lx - 120; gm.roof = 585;
    return gm;
  }
  if (kind === 'boat') {
    const gm = vehicleGeom('boat', x, n), rock = Math.sin(t * 2.2) * .025;
    ctx.save(); ctx.translate(x, 760); ctx.rotate(rock); ctx.translate(-x, -760);
    for (let k = 0; k < n; k++) if (seats[k]) drawBloop(seats[k]);
    ctx.fillStyle = '#FFFFFF'; ctx.fillRect(x + 20, 360, 12, 330);
    ctx.fillStyle = '#FF6B6B'; ctx.beginPath(); ctx.moveTo(x + 40, 370); ctx.lineTo(x + 300, 600); ctx.lineTo(x + 40, 620); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#FFE066'; ctx.beginPath(); ctx.moveTo(x + 10, 390); ctx.lineTo(x - 200, 610); ctx.lineTo(x + 10, 620); ctx.closePath(); ctx.fill();
    const hg = ctx.createLinearGradient(0, 680, 0, 860); hg.addColorStop(0, '#FF9F43'); hg.addColorStop(1, '#D9661F');
    ctx.fillStyle = hg; ctx.beginPath(); ctx.moveTo(x - 420, 680); ctx.lineTo(x + 440, 680); ctx.quadraticCurveTo(x + 380, 860, x + 250, 860); ctx.lineTo(x - 300, 860); ctx.quadraticCurveTo(x - 400, 830, x - 420, 680); ctx.fill();
    ctx.fillStyle = '#FFFFFF'; ctx.fillRect(x - 410, 700, 845, 16);
    for (let i = 0; i < 5; i++) { ctx.fillStyle = '#FFF6E0'; circle(x - 280 + i * 140, 770, 22); ctx.fill(); ctx.strokeStyle = '#B5561A'; ctx.lineWidth = 5; ctx.stroke(); }
    ctx.restore();
    gm.roof = 650; gm.roofX = x + 200;
    return gm;
  }
  return vehicleSmall(kind, x, 840, t, opts);
}
// small vehicles for the parade song
function vehicleSmall(kind, x, y, t, opts = {}) {
  const b = opts.bob || 0, ang = opts.wheelAng || 0;
  ctx.save(); ctx.translate(x, y - b);
  ctx.fillStyle = 'rgba(30,30,60,0.2)'; ell(0, 48 + b, 260, 16); ctx.fill();
  if (kind === 'car') {
    ctx.fillStyle = '#FF4B4B'; rr(-240, -110, 480, 140, 50); ctx.fill(); ctx.fillStyle = '#E03A3A'; ctx.beginPath(); ctx.moveTo(-150, -110); ctx.quadraticCurveTo(-110, -230, 0, -230); ctx.quadraticCurveTo(110, -230, 160, -110); ctx.closePath(); ctx.fill();
    ctx.fillStyle = BUSC.glass; ctx.beginPath(); ctx.moveTo(-125, -115); ctx.quadraticCurveTo(-95, -210, -10, -210); ctx.lineTo(-10, -115); ctx.closePath(); ctx.fill(); ctx.beginPath(); ctx.moveTo(10, -115); ctx.lineTo(10, -210); ctx.quadraticCurveTo(100, -210, 135, -115); ctx.closePath(); ctx.fill();
    ctx.save(); ctx.beginPath(); ctx.moveTo(10, -115); ctx.lineTo(10, -210); ctx.quadraticCurveTo(100, -210, 135, -115); ctx.closePath(); ctx.clip(); driverBloop(70, -140, t, 46, opts.waving); ctx.restore();
    ctx.fillStyle = '#FFF6C2'; circle(228, -40, 16); ctx.fill(); wheel(-140, 28, 52, ang); wheel(150, 28, 52, ang);
  } else if (kind === 'plane') {
    ctx.translate(0, -120 + Math.sin(t * 2) * 15);
    ctx.fillStyle = '#3D8BFF'; ctx.beginPath(); ctx.moveTo(-60, 10); ctx.lineTo(60, 10); ctx.lineTo(-20, 150); ctx.lineTo(-90, 150); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#F4F7FF'; rr(-300, -60, 560, 120, 60); ctx.fill(); ctx.fillStyle = '#3D8BFF'; ctx.beginPath(); ctx.moveTo(-280, -40); ctx.lineTo(-330, -170); ctx.lineTo(-240, -170); ctx.lineTo(-180, -50); ctx.closePath(); ctx.fill();
    for (let i = 0; i < 4; i++) { ctx.fillStyle = BUSC.glass; circle(-150 + i * 80, -10, 22); ctx.fill(); }
    ctx.save(); circle(200, -10, 48); ctx.clip(); ctx.fillStyle = BUSC.glass; ctx.fill(); driverBloop(205, 10, t, 40, opts.waving); ctx.restore();
    ctx.fillStyle = '#FFC928'; circle(262, 0, 18); ctx.fill(); ctx.save(); ctx.translate(268, 0); ctx.scale(1, Math.abs(Math.sin(t * 40))); ctx.fillStyle = '#5A5670'; rr(-6, -70, 12, 140, 6); ctx.fill(); ctx.restore();
  } else if (kind === 'rocket') {
    ctx.translate(0, -160 + Math.sin(t * 3) * 10); ctx.rotate(Math.PI / 2 * .0);
    const fl = 60 + 25 * Math.sin(t * 30);
    ctx.fillStyle = '#FF9F43'; ctx.beginPath(); ctx.moveTo(-40, 170); ctx.quadraticCurveTo(0, 170 + fl * 2, 40, 170); ctx.fill(); ctx.fillStyle = '#FFE066'; ctx.beginPath(); ctx.moveTo(-22, 170); ctx.quadraticCurveTo(0, 170 + fl * 1.2, 22, 170); ctx.fill();
    ctx.fillStyle = '#FF4B4B'; ctx.beginPath(); ctx.moveTo(-70, 120); ctx.lineTo(-130, 190); ctx.lineTo(-70, 170); ctx.moveTo(70, 120); ctx.lineTo(130, 190); ctx.lineTo(70, 170); ctx.fill();
    ctx.fillStyle = '#F4F7FF'; ctx.beginPath(); ctx.moveTo(0, -230); ctx.quadraticCurveTo(100, -100, 75, 175); ctx.lineTo(-75, 175); ctx.quadraticCurveTo(-100, -100, 0, -230); ctx.fill();
    ctx.fillStyle = '#FF4B4B'; ctx.beginPath(); ctx.moveTo(0, -230); ctx.quadraticCurveTo(55, -170, 64, -130); ctx.lineTo(-64, -130); ctx.quadraticCurveTo(-55, -170, 0, -230); ctx.fill();
    ctx.save(); circle(0, -30, 55); ctx.clip(); ctx.fillStyle = BUSC.glass; ctx.fill(); driverBloop(0, -10, t, 44, opts.waving); ctx.restore(); ctx.lineWidth = 10; ctx.strokeStyle = '#9AA3B8'; circle(0, -30, 55); ctx.stroke();
  } else if (kind === 'tractor') {
    ctx.fillStyle = '#3DD66B'; rr(-200, -120, 300, 130, 22); ctx.fill(); ctx.fillStyle = '#2FB359'; rr(-60, -280, 170, 180, 18); ctx.fill();
    ctx.fillStyle = BUSC.glass; rr(-40, -260, 130, 120, 14); ctx.fill(); ctx.save(); rr(-40, -260, 130, 120, 14); ctx.clip(); driverBloop(25, -180, t, 46, opts.waving); ctx.restore();
    ctx.fillStyle = '#5A5670'; rr(-180, -200, 26, 90, 8); ctx.fill(); puffs(-167, -210, t, -1, '210,210,220', .3, 60, 90);
    wheel(70, -10, 95, ang, '#FFC928'); wheel(-150, 20, 55, ang, '#FFC928');
  } else if (kind === 'boat') {
    ctx.scale(.55, .55); ctx.translate(0, -700); drawVehicle('boat', 0, t, { seats: [] });
  } else if (kind === 'train') {
    ctx.scale(.72, .72); ctx.translate(-150, -760); drawVehicle('train', 0, t, { n: 2, seats: [], wheelAng: ang });
  } else {
    ctx.scale(.8, .8); ctx.translate(0, -790); drawVehicle('bus', 0, t, { n: 4, seats: [], wheelAng: ang });
  }
  ctx.restore();
}
