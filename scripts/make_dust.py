#!/usr/bin/env python3
"""Render every laid-out paper into assets/corpus-dust.png.

Why this exists: the glass panels on the home page refract their backdrop,
and refraction is only visible if the backdrop has detail at the scale the
rim displaces it (tens of pixels). A blurred density field has none, and a
few thousand animated points have detail but almost no coverage, so a card
edge crosses two or three of them and nothing reads.

The honest fix is more real data, not a procedural texture: one dot per
paper for all 55,850 of them, baked once into an RGBA PNG whose colour is
constant and whose alpha carries the dot intensity. Constant RGB is nearly
free after PNG filtering, so the file stays small.

    python3 scripts/make_dust.py [--size 1400]
"""
import argparse, json, os, struct, zlib

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TINT = (124, 196, 255)          # plasma, matches the page accent


def write_png(path, w, h, rgba):
    raw = bytearray()
    stride = w * 4
    for y in range(h):
        raw.append(1)                                    # Sub filter
        row = rgba[y * stride:(y + 1) * stride]
        raw.append(row[0]); raw.append(row[1]); raw.append(row[2]); raw.append(row[3])
        for x in range(4, stride):
            raw.append((row[x] - row[x - 4]) & 255)

    def chunk(tag, data):
        return (struct.pack('>I', len(data)) + tag + data
                + struct.pack('>I', zlib.crc32(tag + data) & 0xffffffff))

    png = b'\x89PNG\r\n\x1a\n'
    png += chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 6, 0, 0, 0))
    png += chunk(b'IDAT', zlib.compress(bytes(raw), 9))
    png += chunk(b'IEND', b'')
    open(path, 'wb').write(png)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--size', type=int, default=1200)
    args = ap.parse_args()

    d = json.load(open(os.path.join(HERE, 'data', 'coords.json')))
    xs, ys, deg = d['x'], d['y'], d['degree']
    x0, x1 = min(xs), max(xs)
    y0, y1 = min(ys), max(ys)
    n = args.size
    acc = [0] * (n * n)

    for i in range(len(xs)):
        px = int((xs[i] - x0) / (x1 - x0) * (n - 3)) + 1
        py = int((ys[i] - y0) / (y1 - y0) * (n - 3)) + 1
        # Cited papers get a slightly brighter core, same rule the animated
        # point layer uses, so the two layers agree about what stands out.
        # One pixel per paper, nothing else. A splat around each dot
        # survives downscaling better but resamples into a grey smear, and
        # a grey smear over the dense continents is exactly what makes a
        # star field look dirty instead of deep.
        acc[py * n + px] += 96 if deg[i] > 40 else 46

    rgba = bytearray(n * n * 4)
    for i in range(n * n):
        a = acc[i]
        rgba[i * 4]     = TINT[0]
        rgba[i * 4 + 1] = TINT[1]
        rgba[i * 4 + 2] = TINT[2]
        rgba[i * 4 + 3] = 255 if a > 255 else a

    out = os.path.join(HERE, 'assets', 'corpus-dust.png')
    write_png(out, n, n, rgba)
    print('%s: %d papers, %dx%d, %.0f kB'
          % (out, len(xs), n, n, os.path.getsize(out) / 1024))


if __name__ == '__main__':
    main()
