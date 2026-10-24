"""Generates original paper/cardboard/tape textures for the Vox-style layer (no licence needed). Run once."""
import numpy as np
from PIL import Image, ImageFilter
rng = np.random.default_rng(11)
W, H = 1080, 1920
def noise(w, h, scale):
    small = rng.random((h // scale + 2, w // scale + 2))
    return np.array(Image.fromarray((small * 255).astype('uint8')).resize((w, h), Image.BICUBIC)) / 255.0
def paper(base, out, fib=0.05, grain=0.06, blot=0.06):
    n = 0.5 * noise(W, H, 4) + 0.3 * noise(W, H, 40) + 0.2 * noise(W, H, 200)
    g = rng.normal(0, 1, (H, W))
    fibers = np.zeros((H, W))
    for _ in range(1400):  # thin fibres
        x, y, L, a = rng.integers(0, W), rng.integers(0, H), rng.integers(10, 60), rng.random() * np.pi
        xs = (x + np.cos(a) * np.arange(L)).astype(int).clip(0, W - 1); ys = (y + np.sin(a) * np.arange(L)).astype(int).clip(0, H - 1)
        fibers[ys, xs] += rng.random() * 0.8
    fibers = np.array(Image.fromarray((fibers.clip(0, 1) * 255).astype('uint8')).filter(ImageFilter.GaussianBlur(0.7))) / 255
    yy, xx = np.mgrid[0:H, 0:W]; vig = 1 - 0.18 * (((xx - W / 2) / (W / 2)) ** 2 + ((yy - H / 2) / (H / 2)) ** 2)
    img = np.array(base, float)[None, None, :] * (1 + blot * (n - .5)[..., None] + grain * 0.15 * g[..., None] - fib * fibers[..., None]) * vig[..., None]
    Image.fromarray(img.clip(0, 255).astype('uint8')).save(out, quality=90)
paper((238, 230, 212), 'paper_light.jpg')
paper((34, 32, 30), 'paper_dark.jpg', fib=-0.6, grain=0.3, blot=0.25)
paper((205, 182, 140), 'cardboard.jpg', fib=0.12, grain=0.12, blot=0.12)
# masking tape strip
w, h = 260, 70; t = np.zeros((h, w, 4)); t[..., :3] = (236, 226, 196); t[..., 3] = 200
edge = (rng.random(h) * 10).astype(int)
for y in range(h): t[y, :edge[y], 3] = 0; t[y, w - int(rng.random() * 10) - 1:, 3] = 0
t[..., :3] *= (1 + 0.06 * (noise(w, h, 6)[..., None] - .5))
Image.fromarray(t.clip(0, 255).astype('uint8'), 'RGBA').save('tape.png')
print('ok')
