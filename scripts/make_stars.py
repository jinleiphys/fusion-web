#!/usr/bin/env python3
"""Regenerate assets/stars.js from data/coords.json.

Two products, both derived from the same layout:

  CORPUS_POINTS   a sample of individual papers, [x, y, weight]
  CORPUS_DENSITY  a coarse density field over ALL papers in the layout

The density field is what the page background needs. A sparse point cloud on
black is almost pure background, and a glass surface over an almost uniform
background refracts nothing visible. The field gives the backdrop the
low-frequency structure the glass can actually bend, and it is real data:
every cell counts the papers that landed there.

    python3 scripts/make_stars.py [--points 8000] [--grid 80] [--sigma 1.7]
"""
import argparse, json, math, os, random

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def gaussian_blur(grid, n, sigma):
    """Separable Gaussian, reflect at the edges."""
    radius = max(1, int(math.ceil(sigma * 3)))
    kern = [math.exp(-0.5 * (i / sigma) ** 2) for i in range(-radius, radius + 1)]
    s = sum(kern)
    kern = [k / s for k in kern]

    def pass1d(src, horizontal):
        out = [0.0] * (n * n)
        for y in range(n):
            for x in range(n):
                acc = 0.0
                for k, w in enumerate(kern):
                    d = k - radius
                    if horizontal:
                        i = min(n - 1, max(0, x + d)); j = y
                    else:
                        i = x; j = min(n - 1, max(0, y + d))
                    acc += src[j * n + i] * w
                out[y * n + x] = acc
        return out

    return pass1d(pass1d(grid, True), False)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--points', type=int, default=8000)
    ap.add_argument('--grid', type=int, default=80)
    ap.add_argument('--sigma', type=float, default=1.7)
    ap.add_argument('--cap', type=int, default=400, help='weight cap, matches the renderer')
    ap.add_argument('--seed', type=int, default=0)
    args = ap.parse_args()

    d = json.load(open(os.path.join(HERE, 'data', 'coords.json')))
    xs, ys, deg = d['x'], d['y'], d['degree']
    n = len(xs)
    x0, x1 = min(xs), max(xs)
    y0, y1 = min(ys), max(ys)
    nx = [(v - x0) / (x1 - x0) for v in xs]
    ny = [(v - y0) / (y1 - y0) for v in ys]

    # ---- density over every paper ----
    g = args.grid
    grid = [0.0] * (g * g)
    for i in range(n):
        cx = min(g - 1, int(nx[i] * g))
        cy = min(g - 1, int(ny[i] * g))
        grid[cy * g + cx] += 1.0
    grid = gaussian_blur(grid, g, args.sigma)
    peak = max(grid)
    # sqrt keeps the low-density fringe visible; a linear ramp collapses
    # everything outside the two big continents to zero.
    dens = [min(255, int(round(255 * math.sqrt(v / peak)))) for v in grid]

    # ---- point sample ----
    order = sorted(range(n), key=lambda i: -deg[i])
    keep_top = min(args.points // 8, n)
    chosen = order[:keep_top]
    rest = order[keep_top:]
    random.Random(args.seed).shuffle(rest)
    chosen += rest[:max(0, args.points - keep_top)]
    chosen.sort(key=lambda i: -deg[i])

    pts = ','.join(
        '[%s,%s,%d]' % (round(nx[i], 3), round(ny[i], 3), min(deg[i], args.cap))
        for i in chosen)

    out = os.path.join(HERE, 'assets', 'stars.js')
    with open(out, 'w') as f:
        f.write('const CORPUS_POINTS=[%s];\n' % pts)
        f.write('const CORPUS_DENSITY={n:%d,d:[%s]};\n' % (g, ','.join(map(str, dens))))

    print('%s: %d points, %dx%d density field, %.0f kB'
          % (out, len(chosen), g, g, os.path.getsize(out) / 1024))


if __name__ == '__main__':
    main()
