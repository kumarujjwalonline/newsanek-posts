"""Synthesises the News Anek SFX pack (original, royalty-free) into engine/sfx/*.wav. Run once: python3 engine/sfx/make_sfx.py"""
import numpy as np, wave, os
SR = 48000
OUT = os.path.dirname(os.path.abspath(__file__))
rng = np.random.default_rng(7)

def save(name, x):
    x = x / (np.max(np.abs(x)) + 1e-9) * 0.9
    st = np.stack([x, x], 1)
    with wave.open(os.path.join(OUT, name + '.wav'), 'wb') as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((st * 32767).astype('<i2').tobytes())

def t(d): return np.arange(int(SR * d)) / SR
def env(n, a, r):  # attack/release in samples-fraction
    e = np.ones(n); ai = max(1, int(n * a)); ri = max(1, int(n * r))
    e[:ai] = np.linspace(0, 1, ai); e[-ri:] = np.linspace(1, 0, ri) ** 2; return e
def lowpass(x, k):
    k = max(1, int(k)); return np.convolve(x, np.ones(k) / k, 'same')

# whoosh: band-swept noise
n = rng.standard_normal(int(SR * .55)); tt = t(.55)
sweep = np.concatenate([lowpass(n[i:i + 2400], 2 + 40 * (1 - i / len(n))) for i in range(0, len(n), 2400)])[:len(n)]
save('whoosh', sweep * np.sin(np.pi * tt / .55) ** 2)
# swish: shorter, brighter
n = rng.standard_normal(int(SR * .28)); save('swish', (n - lowpass(n, 6)) * np.sin(np.pi * t(.28) / .28) ** 3)
# click: UI tick
tt = t(.05); save('click', np.sin(2 * np.pi * 2200 * tt) * np.exp(-tt * 140))
# tick: counter tick (softer, lower)
tt = t(.04); save('tick', np.sin(2 * np.pi * 1400 * tt) * np.exp(-tt * 180))
# pop: bubble pop
tt = t(.12); f = 900 - 500 * tt / .12; save('pop', np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt * 40))
# impact: low thump + noise transient
tt = t(.9); f = 110 * np.exp(-tt * 3) + 38
body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt * 5)
tr = lowpass(rng.standard_normal(len(tt)), 3) * np.exp(-tt * 60) * .5
save('impact', body + tr)
# riser: noise + rising tone, 1.2 s
tt = t(1.2); f = 200 + 900 * (tt / 1.2) ** 2
save('riser', (0.5 * np.sin(2 * np.pi * np.cumsum(f) / SR) + 0.5 * lowpass(rng.standard_normal(len(tt)), 4)) * (tt / 1.2) ** 2 * env(len(tt), 0.05, 0.04))
# ding: soft bell for reveals
tt = t(1.0); save('ding', (np.sin(2 * np.pi * 1320 * tt) + .4 * np.sin(2 * np.pi * 2640 * tt) + .2 * np.sin(2 * np.pi * 3960 * tt)) * np.exp(-tt * 4))
# paper: rustle for document reveals
n = rng.standard_normal(int(SR * .5)); g = (rng.random(len(n)) < .02).astype(float); g = lowpass(g, 400) * 30
save('paper', (n - lowpass(n, 3)) * np.clip(g, 0, 1) * env(len(n), .1, .3))
# typewriter key
tt = t(.06); save('type', (lowpass(rng.standard_normal(len(tt)), 2) * np.exp(-tt * 120)) + .3 * np.sin(2 * np.pi * 3000 * tt) * np.exp(-tt * 200))
# low pulse (documentary)
tt = t(1.0); save('pulse', np.sin(2 * np.pi * 55 * tt) * np.exp(-tt * 3) * (1 - np.exp(-tt * 60)))
# boing (satire)
tt = t(.5); f = 300 + 120 * np.sin(2 * np.pi * 9 * tt) * np.exp(-tt * 4); save('boing', np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt * 5))
print('ok', sorted(os.listdir(OUT)))
