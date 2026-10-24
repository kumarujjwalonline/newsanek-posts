#!/usr/bin/env node
// News Anek render engine: storyboard JSON + voice + word timings -> 1080x1920 MP4.
// Usage: node engine/render.js <storyboard.json> [--out out.mp4] [--preview t1,t2,...] [--fps 30] [--from s --to s]
const fs = require('fs');
const path = require('path');
const { spawn, execFileSync } = require('child_process');
const { chromium } = require('playwright');

const ENGINE = __dirname;
const args = process.argv.slice(2);
const sbPath = path.resolve(args[0]);
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const sb = JSON.parse(fs.readFileSync(sbPath, 'utf8'));
const base = path.dirname(sbPath);
const rel = p => (p && !/^(https?:|file:|data:)/.test(p)) ? path.resolve(base, p) : p;
const fps = Number(opt('fps', sb.fps || 30));
const out = path.resolve(opt('out', path.join(base, `${sb.content_id || 'render'}_${sb.version || 'v1'}.mp4`)));

function probeDuration(f) {
  return Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).toString().trim());
}
const norm = s => String(s).toLowerCase().replace(/[.,!?।॥"'“”‘’:;()\-–—…]/g, '').trim();

// ---- words: ElevenLabs Scribe output (list or {words:[...]}) ; drop audio tags like [curious]
let words = [];
if (sb.words) {
  const raw = JSON.parse(fs.readFileSync(rel(sb.words), 'utf8'));
  const list = Array.isArray(raw) ? raw : (raw.words || (raw.transcripts && raw.transcripts[0].words) || []);
  words = list.filter(w => (w.type || 'word') === 'word' && !/^\[.*\]$/.test(w.text.trim()) && !/^[—–\-…।,.!?]+$/.test(w.text.trim()))
              .map(w => ({ text: w.text.trim(), start: Number(w.start), end: Number(w.end) }));
}
const voicePath = sb.voice ? rel(sb.voice) : null;
const voiceDur = voicePath ? probeDuration(voicePath) : (words.length ? words[words.length - 1].end : 10);
const speechEnd = words.length ? words[words.length - 1].end : voiceDur;

// ---- resolve scene times from cues
let cursor = 0;
const warnings = [];
function findCue(cue) {
  const toks = norm(cue).split(/\s+/).filter(Boolean).slice(0, 4);
  for (let i = cursor; i < words.length; i++) {
    let ok = true;
    for (let k = 0; k < toks.length; k++) { if (!words[i + k] || norm(words[i + k].text) !== toks[k]) { ok = false; break; } }
    if (ok) { cursor = i + 1; return words[i].start; }
  }
  return null;
}
sb.scenes.forEach((sc, i) => {
  if (typeof sc.start === 'number') return;
  if (sc.cue) {
    const t = findCue(sc.cue);
    if (t === null) warnings.push(`scene ${sc.id || i}: cue not found "${sc.cue}"`);
    else sc.start = Math.max(0, t - (sb.lead ?? 0.1));
  }
});
// fill gaps: first scene at 0, unresolved scenes split time evenly between neighbours
sb.scenes[0].start = 0;
for (let i = 1; i < sb.scenes.length; i++) {
  if (typeof sb.scenes[i].start !== 'number') {
    let j = i; while (j < sb.scenes.length && typeof sb.scenes[j].start !== 'number') j++;
    const a = sb.scenes[i - 1].start, b = j < sb.scenes.length ? sb.scenes[j].start : speechEnd;
    for (let k = i; k < j; k++) sb.scenes[k].start = a + (b - a) * (k - i + 1) / (j - i + 1);
  }
}
const last = sb.scenes[sb.scenes.length - 1];
const tail = last.type === 'endcard' ? (last.hold ?? 2.2) : (sb.tail ?? 0.8);
const duration = sb.duration || Math.max(voiceDur, speechEnd + tail);
sb.scenes.forEach((sc, i) => { sc.end = i < sb.scenes.length - 1 ? sb.scenes[i + 1].start : duration; });
sb.scenes.forEach((sc, i) => { if (sc.end - sc.start < 0.4) warnings.push(`scene ${sc.id || i} is only ${(sc.end - sc.start).toFixed(2)}s`); });
sb.duration = duration;

// ---- captions: chunks of <=4 words / <=26 chars, break after punctuation
const caps = []; let cur = [];
const flush = () => { if (cur.length) { caps.push({ start: cur[0].start, words: cur }); cur = []; } };
for (const w of words) {
  const len = cur.reduce((n, x) => n + x.text.length + 1, 0) + w.text.length;
  if (cur.length && (cur.length >= (sb.caption_words || 4) || len > (sb.caption_chars || 26))) flush();
  cur.push(w);
  if (/[,।?!.]$/.test(w.text)) flush();
}
flush();
caps.forEach((c, i) => { const lastW = c.words[c.words.length - 1]; const next = caps[i + 1]; c.end = next ? Math.min(next.start, lastW.end + 0.6) : lastW.end + 0.5; });
sb.captions = sb.captions_off ? [] : caps;
sb.captions_off_at = last.type === 'endcard' ? last.start : null;

// ---- media paths
for (const sc of sb.scenes) if (sc.src) sc.src = 'file://' + rel(sc.src);

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  page.on('console', m => { if (m.type() === 'error') console.error('[page]', m.text()); });
  page.on('pageerror', e => console.error('[pageerror]', e.message));
  await page.goto('file://' + path.join(ENGINE, 'stage.html'));
  await page.evaluate(([india, world]) => { window.__INDIA = india; window.__WORLD = world; },
    [JSON.parse(fs.readFileSync(path.join(ENGINE, 'maps/india_states.json'))), JSON.parse(fs.readFileSync(path.join(ENGINE, 'maps/world_countries_50m.json')))]);
  const info = await page.evaluate(s => window.setup(s), sb);
  if (!info.fontsOk) warnings.push('fonts did not load');
  const timing = sb.scenes.map(s => `${(s.id || s.type).padEnd(10)} ${s.start.toFixed(2)}–${s.end.toFixed(2)}`).join('\n');
  fs.writeFileSync(out.replace(/\.mp4$/, '_timing.txt'), timing + '\n' + (warnings.length ? '\nWARNINGS\n' + warnings.join('\n') : '') + '\n');
  if (warnings.length) console.error('WARNINGS:\n' + warnings.join('\n'));

  const preview = opt('preview', null);
  if (preview) {
    const ts = preview === 'auto' ? sb.scenes.map(s => (s.start + Math.min(s.end, s.start + 1.6)) / 2 + 0.4) : preview.split(',').map(Number);
    const dir = out.replace(/\.mp4$/, '_frames'); fs.mkdirSync(dir, { recursive: true });
    for (const t of ts) { await page.evaluate(x => window.renderAt(x), t); await page.screenshot({ path: path.join(dir, `t${t.toFixed(2).padStart(6, '0')}.jpg`), type: 'jpeg', quality: 85 }); }
    console.log('preview frames in', dir); await browser.close(); return;
  }

  const t0 = Number(opt('from', 0)), t1 = Number(opt('to', duration));
  const silent = out.replace(/\.mp4$/, '_silent.mp4');
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '19', '-pix_fmt', 'yuv420p', '-r', String(fps), silent], { stdio: ['pipe', 'inherit', 'inherit'] });
  const N = Math.round((t1 - t0) * fps); const tStart = Date.now();
  for (let f = 0; f < N; f++) {
    const t = t0 + f / fps;
    await page.evaluate(x => window.renderAt(x), t);
    const buf = await page.screenshot({ type: 'jpeg', quality: 92 });
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
    if (f % 150 === 0) console.log(`frame ${f}/${N} (${((Date.now() - tStart) / 1000).toFixed(0)}s)`);
  }
  ff.stdin.end(); await new Promise(r => ff.on('close', r)); await browser.close();

  // ---- audio: voice + optional music bed (ducked) + SFX accents, loudness-normalised
  const inputs = [], filters = [], mix = [];
  let idx = 0;
  if (voicePath) { inputs.push('-i', voicePath); filters.push(`[${idx}:a]aresample=48000,adelay=${Math.round(((sb.voice_offset || 0) - t0) * 1000)}|${Math.round(((sb.voice_offset || 0) - t0) * 1000)},apad[v]`); idx++; }
  const sfxList = [];
  for (const sc of sb.scenes) if (sc.sfx) for (const name of [].concat(sc.sfx)) {
    const f = path.join(ENGINE, 'sfx', name + '.wav'); if (fs.existsSync(f)) sfxList.push({ f, at: sc.start + (sc.sfx_at || 0), gain: sc.sfx_gain ?? sb.sfx_gain ?? -10 });
    else warnings.push('missing sfx ' + name);
  }
  sfxList.filter(s => s.at >= t0 && s.at < t1).forEach(s => {
    inputs.push('-i', s.f); const ms = Math.round((s.at - t0) * 1000);
    filters.push(`[${idx}:a]aresample=48000,volume=${s.gain}dB,adelay=${ms}|${ms}[s${idx}]`); mix.push(`[s${idx}]`); idx++;
  });
  let musicLabel = null;
  const music = sb.music === 'auto' ? path.join(ENGINE, 'music', (sb.theme || 'explainer') + '.mp3') : (sb.music ? rel(sb.music) : null);
  if (music && fs.existsSync(music)) {
    inputs.push('-stream_loop', '-1', '-i', music);
    filters.push(`[${idx}:a]aresample=48000,volume=${sb.music_gain ?? -20}dB,afade=t=out:st=${Math.max(0, duration - t0 - 1.5)}:d=1.5[m0]`); musicLabel = '[m0]'; idx++;
  }
  let chain;
  if (voicePath) {
    if (musicLabel) { filters.push('[v]asplit=2[v1][vk]', `${musicLabel}[vk]sidechaincompress=threshold=0.03:ratio=8:attack=20:release=400[mduck]`); chain = ['[v1]', '[mduck]', ...mix]; }
    else chain = ['[v]', ...mix];
  } else chain = [...(musicLabel ? [musicLabel] : []), ...mix];
  const audio = out.replace(/\.mp4$/, '_mix.m4a');
  if (chain.length) {
    filters.push(`${chain.join('')}amix=inputs=${chain.length}:normalize=0:duration=first,atrim=0:${(t1 - t0).toFixed(3)},loudnorm=I=-14:TP=-1.5:LRA=11[aout]`);
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...inputs, '-filter_complex', filters.join(';'), '-map', '[aout]', '-ar', '48000', '-c:a', 'aac', '-b:a', '192k', audio], { stdio: 'inherit' });
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', silent, '-i', audio, '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'copy', '-shortest', '-movflags', '+faststart', out], { stdio: 'inherit' });
    fs.unlinkSync(audio);
  } else fs.renameSync(silent, out);
  if (fs.existsSync(silent)) fs.unlinkSync(silent);
  if (warnings.length) fs.appendFileSync(out.replace(/\.mp4$/, '_timing.txt'), warnings.join('\n') + '\n');
  console.log('rendered', out, duration.toFixed(2) + 's', `in ${((Date.now() - tStart) / 1000).toFixed(0)}s`);
})().catch(e => { console.error(e); process.exit(1); });
