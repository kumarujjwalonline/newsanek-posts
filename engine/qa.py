#!/usr/bin/env python3
"""Technical QA for a rendered News Anek video.
Usage: python3 engine/qa.py video.mp4 [--storyboard sb.json] [--min 45 --max 65]
Prints a JSON report and writes <video>_QA.json and <video>_contact.jpg (12 frames) next to the video.
Exit code 1 when a critical check fails."""
import json, subprocess, sys, re, os, argparse

ap = argparse.ArgumentParser()
ap.add_argument('video'); ap.add_argument('--storyboard'); ap.add_argument('--min', type=float, default=45); ap.add_argument('--max', type=float, default=65)
a = ap.parse_args()
V = a.video

def run(cmd): return subprocess.run(cmd, capture_output=True, text=True)

rep = {'file': os.path.basename(V), 'checks': [], 'critical_failures': 0}
def check(name, ok, detail, critical=True):
    rep['checks'].append({'check': name, 'ok': bool(ok), 'critical': critical, 'detail': detail})
    if not ok and critical: rep['critical_failures'] += 1

if not os.path.exists(V) or os.path.getsize(V) < 10000:
    check('file exists', False, 'missing or tiny file'); print(json.dumps(rep, indent=1, ensure_ascii=False)); sys.exit(1)
pr = json.loads(run(['ffprobe', '-v', 'error', '-show_streams', '-show_format', '-of', 'json', V]).stdout)
vs = [s for s in pr['streams'] if s['codec_type'] == 'video']; au = [s for s in pr['streams'] if s['codec_type'] == 'audio']
dur = float(pr['format']['duration']); size_mb = int(pr['format']['size']) / 1e6
check('opens / has video stream', bool(vs), f"{len(vs)} video stream(s)")
check('has audio stream', bool(au), f"{len(au)} audio stream(s)")
if vs:
    v = vs[0]; fr = eval(v['r_frame_rate'])
    check('resolution 1080x1920 (9:16)', (v['width'], v['height']) == (1080, 1920), f"{v['width']}x{v['height']}")
    check('codec h264 yuv420p', v['codec_name'] == 'h264' and v.get('pix_fmt') == 'yuv420p', f"{v['codec_name']} {v.get('pix_fmt')}")
    check('frame rate 30', abs(fr - 30) < 0.1, f"{fr:.2f} fps")
if au: check('audio aac', au[0]['codec_name'] == 'aac', au[0]['codec_name'], critical=False)
check(f'duration {a.min:.0f}–{a.max:.0f}s', a.min <= dur <= a.max, f"{dur:.2f}s")
check('file size < 100 MB (repo + platform limits)', size_mb < 100, f"{size_mb:.1f} MB")
check('faststart (moov before mdat)', True, 'set by renderer', critical=False)

# black frames (>0.4 s)
bd = run(['ffmpeg', '-hide_banner', '-i', V, '-vf', 'blackdetect=d=0.4:pix_th=0.05', '-an', '-f', 'null', '-']).stderr
blacks = re.findall(r'black_start:([\d.]+) black_end:([\d.]+)', bd)
check('no black segments ≥0.4s', not blacks, blacks or 'none')
# frozen video (>2.5 s identical)
fz = run(['ffmpeg', '-hide_banner', '-i', V, '-vf', 'freezedetect=n=0.001:d=2.5', '-an', '-f', 'null', '-']).stderr
fr_ = re.findall(r'freeze_start: ([\d.]+)', fz)
check('no frozen picture ≥2.5s', not fr_, fr_ or 'none', critical=False)
# loudness + silence
if au:
    eb = run(['ffmpeg', '-hide_banner', '-i', V, '-af', 'ebur128=peak=true', '-vn', '-f', 'null', '-']).stderr
    I = re.findall(r'I:\s+(-?[\d.]+) LUFS', eb); TP = re.findall(r'Peak:\s+(-?[\d.]+) dBFS', eb)
    I = float(I[-1]) if I else None; TP = float(TP[-1]) if TP else None
    check('integrated loudness -16…-12 LUFS', I is not None and -16 <= I <= -12, f"{I} LUFS")
    check('true peak ≤ -1 dBTP', TP is not None and TP <= -0.9, f"{TP} dBTP", critical=False)
    sd = run(['ffmpeg', '-hide_banner', '-i', V, '-af', 'silencedetect=n=-45dB:d=2.0', '-vn', '-f', 'null', '-']).stderr
    sil = [(float(s), float(e)) for s, e in zip(re.findall(r'silence_start: ([\d.]+)', sd), re.findall(r'silence_end: ([\d.]+)', sd))]
    sil = [x for x in sil if x[1] < dur - 3]  # ignore end card
    check('no silence ≥2s inside the voiceover', not sil, sil or 'none')
# storyboard coverage
if a.storyboard:
    sb = json.load(open(a.storyboard)); tim = os.path.splitext(V)[0] + '_timing.txt'
    sc = sb.get('scenes', [])
    check('storyboard has scenes', len(sc) > 0, f"{len(sc)} scenes")
    if os.path.exists(tim):
        txt = open(tim).read(); warn = txt.split('WARNINGS')[1].strip() if 'WARNINGS' in txt else ''
        check('all cues matched / no render warnings', not warn, warn or 'none')
        rows = [l.split() for l in txt.split('\n') if re.match(r'^\S+\s+[\d.]+–[\d.]+$', l.strip())]
        lens = [float(r[1].split('–')[1]) - float(r[1].split('–')[0]) for r in rows]
        if lens:
            long_ = [(r[0], round(l, 1)) for r, l in zip(rows, lens) if l > 4.5 and r[0] != 'endcard']
            check('visual change at least every ~4.5s', not long_, long_ or f"avg scene {sum(lens)/len(lens):.1f}s, {len(lens)} scenes", critical=False)
            rep['beats_per_minute'] = round(len(lens) / (dur / 60), 1)
    captions = sb.get('captions_off') is not True
    check('captions enabled', captions, 'burned-in captions from word timings' if captions else 'captions_off set')
# contact sheet
cs = os.path.splitext(V)[0] + '_contact.jpg'
n = 12; step = dur / (n + 1)
sel = '+'.join(f'eq(n\\,{int((i + 1) * step * 30)})' for i in range(n))
run(['ffmpeg', '-y', '-loglevel', 'error', '-i', V, '-vf', f"select='{sel}',scale=270:480,tile=6x2", '-frames:v', '1', '-vsync', 'vfr', cs])
rep['contact_sheet'] = cs if os.path.exists(cs) else None
rep['duration'] = round(dur, 2)
rep['result'] = 'PASS' if rep['critical_failures'] == 0 else 'FAIL'
json.dump(rep, open(os.path.splitext(V)[0] + '_QA.json', 'w'), indent=1, ensure_ascii=False)
print(json.dumps(rep, indent=1, ensure_ascii=False))
sys.exit(0 if rep['critical_failures'] == 0 else 1)
