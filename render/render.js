// Bloops Studio - renders an episode (timeline.json + audio.wav) to MP4.
//   node render/render.js <episode_dir> [--workers 3] [--crf 22]
//   node render/render.js <episode_dir> --stills 12.5,40,100
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const dir = process.argv[2];
const JS = ['core.js', 'world.js', 'segments.js'].map(f => fs.readFileSync(path.join(__dirname, f), 'utf8')).join('\n');
const tl = JSON.parse(fs.readFileSync(path.join(dir, 'timeline.json'), 'utf8'));

async function newPage(browser) {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  page.on('pageerror', e => { console.error('PAGE ERROR', e.message); process.exitCode = 1; });
  await page.setContent(`<html><body style="margin:0;background:#000"><canvas id="c" width="1920" height="1080"></canvas><script>${JS}</script></body></html>`);
  await page.evaluate(t => setTimeline(t), tl);
  await page.evaluate(async () => { document.fonts.load('800 50px Inter'); await document.fonts.ready; });
  return page;
}

function run(cmd, args) {
  return new Promise((res, rej) => { const p = spawn(cmd, args, { stdio: ['ignore', 'inherit', 'inherit'] }); p.on('close', c => c === 0 ? res() : rej(new Error(cmd + ' exited ' + c))); });
}

// Resumable rendering: the video is cut into 60 s pieces; finished pieces are kept,
// so an interrupted render picks up where it stopped.
const PIECE = 1800;
async function worker(queue, crf, progress) {
  const browser = await chromium.launch();
  const page = await newPage(browser);
  while (queue.length) {
    const { k, f0, f1 } = queue.shift();
    const out = path.join(dir, `piece_${String(k).padStart(3, '0')}.mp4`), part = out.replace('.mp4', '.part.mp4');
    const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(tl.fps), '-c:v', 'mjpeg', '-i', '-',
      '-c:v', 'libx264', '-preset', 'medium', '-crf', String(crf), '-pix_fmt', 'yuv420p', '-g', '60', part], { stdio: ['pipe', 'inherit', 'inherit'] });
    for (let f = f0; f < f1; f++) {
      const b64 = await page.evaluate(t => renderFrame(t), f / tl.fps);
      if (!ff.stdin.write(Buffer.from(b64, 'base64'))) await new Promise(r => ff.stdin.once('drain', r));
      progress.done++;
    }
    ff.stdin.end();
    const code = await new Promise(r => ff.on('close', r));
    if (code !== 0) throw new Error('ffmpeg failed on piece ' + k);
    fs.renameSync(part, out);
  }
  await browser.close();
}

(async () => {
  if (process.argv.includes('--thumb')) {
    const browser = await chromium.launch();
    const page = await newPage(browser);
    fs.writeFileSync(path.join(dir, 'thumb_src.png'), Buffer.from(await page.evaluate(v => renderThumb(v), tl.seed % 4), 'base64'));
    await browser.close();
    return;
  }
  const stills = arg('--stills');
  if (stills) {
    const browser = await chromium.launch();
    const page = await newPage(browser);
    for (const t of stills.split(',').map(Number)) {
      const b64 = await page.evaluate(t => renderPNG(t), t);
      const f = path.join(dir, `still_${String(t).replace('.', '_')}.png`);
      fs.writeFileSync(f, Buffer.from(b64, 'base64'));
      console.log(f);
    }
    await browser.close();
    return;
  }
  const workers = parseInt(arg('--workers', '3'));
  const crf = parseInt(arg('--crf', '22'));
  const total = Math.round(tl.duration * tl.fps);
  const pieces = [];
  for (let k = 0, f = 0; f < total; k++, f += PIECE) pieces.push({ k, f0: f, f1: Math.min(total, f + PIECE) });
  const name = p => path.join(dir, `piece_${String(p.k).padStart(3, '0')}.mp4`);
  const todo = pieces.filter(p => !fs.existsSync(name(p)));
  const progress = { done: total - todo.reduce((s, p) => s + p.f1 - p.f0, 0) };
  if (todo.length < pieces.length) console.log(`  resuming: ${pieces.length - todo.length}/${pieces.length} pieces already rendered`);
  const t0 = Date.now(), start = progress.done;
  const timer = setInterval(() => {
    const el = (Date.now() - t0) / 1000, rate = (progress.done - start) / Math.max(el, 1);
    console.log(`  render ${progress.done}/${total} frames  ${(100 * progress.done / total).toFixed(1)}%  ${el.toFixed(0)}s elapsed, ~${((total - progress.done) / Math.max(rate, .1)).toFixed(0)}s left`);
  }, 30000);
  await Promise.all(Array.from({ length: Math.min(workers, todo.length) }, () => worker(todo, crf, progress)));
  clearInterval(timer);
  const chunks = pieces.map(name);
  const list = path.join(dir, 'chunks.txt');
  fs.writeFileSync(list, chunks.map(c => `file '${path.basename(c)}'`).join('\n'));
  const out = path.join(dir, 'episode.mp4');
  await run('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-i', path.join(dir, 'audio.wav'),
    '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', out]);
  for (const c of chunks) fs.unlinkSync(c);
  fs.unlinkSync(list);
  // thumbnail source frame: first verse of the first song
  const browser = await chromium.launch();
  const page = await newPage(browser);
  fs.writeFileSync(path.join(dir, 'thumb_src.png'), Buffer.from(await page.evaluate(v => renderThumb(v), tl.seed % 4), 'base64'));
  await browser.close();
  console.log(`done ${out} in ${((Date.now() - t0) / 1000).toFixed(0)}s`);
})();
