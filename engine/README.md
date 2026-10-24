# News Anek render engine

Turns a storyboard JSON + ElevenLabs voiceover + word timings into a finished 1080×1920, 30 fps, H.264/AAC MP4 with
News Anek branding, motion graphics, burned-in Hindi captions (word-highlighted), SFX accents, an optional ducked
music bed and loudness at −14 LUFS. Everything is drawn in code (HTML/CSS/SVG in headless Chromium → ffmpeg), so
graphics are original and rights-clean.

```
# from the repo root, in a cloud session (Chromium + Playwright + ffmpeg are pre-installed)
node engine/render.js work/NA-20261025-04/storyboard.json --preview auto   # one still per scene, for a quick look
node engine/render.js work/NA-20261025-04/storyboard.json --out work/NA-20261025-04/NA-20261025-04_v1.mp4
python3 engine/qa.py work/NA-20261025-04/NA-20261025-04_v1.mp4 --storyboard work/NA-20261025-04/storyboard.json
```
A 60 s video renders in about 2 minutes. Outputs next to the MP4: `_timing.txt` (resolved scene times + warnings),
`_QA.json`, `_contact.jpg` (12-frame contact sheet; look at it before asking for approval).

## Storyboard JSON

```json
{
  "content_id": "NA-20261025-04", "version": "v1",
  "theme": "data",                       // explainer | opinion | textfirst | data | satire | behind
  "voice": "NA-20261025-04_A1_voice.mp3", // paths relative to this JSON
  "words": "NA-20261025-04_A1_words.json",// ElevenLabs Scribe words (list, or the transcript object)
  "music": "auto",                       // auto = engine/music/<theme>.mp3 if present; or a path; omit for none
  "music_gain": -20, "sfx_gain": -10,
  "tags": ["AI-GENERATED VISUALS"],      // top-right labels; workflow 05 must include "व्यंग्य · SATIRE"
  "scenes": [ { "id": "s1", "type": "bignumber", "cue": "तीन गुना", "value": 3, "suffix": "x", ... }, ... ]
}
```

**Timing.** Give each scene a `cue`: the first 1–4 spoken words where the scene should begin, exactly as in the
script (punctuation ignored). Cues are matched in order against the real word timings, so scenes snap to the
voice. The first scene starts at 0; each scene ends where the next begins. `start` (seconds) overrides a cue.
Unmatched cues are reported in `_timing.txt` and spread evenly — fix them before QA. Make the last scene an
`endcard` (`hold` seconds after the voice ends, default 2.2). Captions hide during the end card.

**Common scene keys:** `sfx` (`whoosh swish click tick pop impact riser ding paper type pulse boing`, or a list),
`sfx_at` (offset s), `source` (small "स्रोत: …" line), `badge` (top-left label, e.g. `ILLUSTRATIVE · AI-GENERATED`),
`flash` (white flash on entry), `bg` (CSS background), `y` (fixed top instead of auto-centring).
Text fields accept `*yellow highlight*` and `_red highlight_`.

| type | keys | use for |
|---|---|---|
| `headline` | `text` (string or list of lines), `kicker`, `sub`, `size` (104), `anim` up/left/right/pop/zoom, `stagger` | kinetic typography, hooks, oversized words |
| `bignumber` | `value`, `prefix`, `suffix`, `decimals`, `unit`, `label`, `kicker`, `count_secs` | counters that stop at a verified value (Indian digit grouping) |
| `bars` | `title`, `items:[{label,value,color}]`, `max`, `prefix/suffix/decimals`, `unit`, `focus` (index) | comparisons; always from a zero baseline, scale = largest value unless `max` |
| `compare` | `left/right:{title,value,note,color}`, `vs` | before/after, A vs B |
| `split` | `claim:{label,text}`, `evidence:{label,text}`, `second_at` | claim vs evidence (opinion) |
| `list` | `title`, `items:[{text,icon}]` (✓ ✗ →), `step` | key points |
| `timeline` | `title`, `events:[{date,text}]`, `step` | sequences, history |
| `map` | `region` india/world, `highlight` (India: state ids like `mh`,`dl` or names; world: country names), `pins:[{lon,lat,label}]` (world) or `{x,y,label}`, `fit` (world country names to frame), `title`, `zoom` | locations. India map uses India's official outline (SVG Maps, CC BY 4.0, pre-2019 states: Ladakh is inside J&K). World map is Natural Earth: don't use it to show India's northern borders |
| `quote` | `header`, `text` with `[[highlighted part]]`, `source` | document / source excerpt reveal |
| `icons` | `total`, `n`, `cols`, `label` | proportions ("4 in 10") |
| `image` | `src`, `move` in/out/left/right, `text`, `text_y`, `badge` | AI illustrations or licensed stills with Ken Burns |
| `video` | `src`, `clip_start`, `rate`, `text` | short AI clips (label them) |
| `panel` | `src`, `bubbles:[{text,x,y,w,at,tail}]`, `caption` | comic panels for satire |
| `endcard` | `text` (question/takeaway), `cta`, `hold` | final 2–3 s |

**Pace.** Aim for one scene per sentence and extra scenes inside long sentences (25–45 per minute depending on
the workflow). `qa.py` flags any non-endcard scene longer than 4.5 s.

**Safe areas.** Content is kept between y 220 and 1260; captions sit at y 1312–1480; nothing important goes below
1500 or within 150 px of the right edge (platform buttons cover those areas).

## Assets
- `fonts/`: Baloo 2 (display), Mukta (body/captions), Noto Sans Devanagari (numbers). SIL Open Font License.
- `assets/logo_white.png`, `logo_black.png`: News Anek logo.
- `sfx/*.wav`: synthesised in code by `sfx/make_sfx.py` (original, no licence needed).
- `music/<theme>.mp3`: optional instrumental beds (ElevenLabs Music, generated for News Anek). Record in ASSET LIBRARY.
- `maps/`: India states (SVG Maps, CC BY 4.0, credit drawn on screen), world (Natural Earth, public domain).
