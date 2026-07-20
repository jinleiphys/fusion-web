#!/usr/bin/env python3
"""FUSION KB: turn coords.json into the render bundle for web + paper figure.

Consumes the layout produced by kb_citemap.py and emits one JSON that both
renderers read, so the web map and the paper figure are literally the same
picture at two resolutions.

Three layers, per the design in fusion-web/README.md:
  1. density  -- binned + Gaussian-blurred field, the "continents"
  2. points   -- one mark per paper, area by citation degree
  3. labels   -- PhySH topic names placed on the territories that earn one

Layer 3 is where identity actually lives: a named region survives greyscale
printing and colour-vision deficiency, which colour alone does not. Topics are
only labelled if they are spatially concentrated -- a broad topic like
quantum-chromodynamics spans the whole corpus and is a language, not a place,
so labelling it would invent a territory that is not there.

No numpy: binning is O(N) and the blur is separable, so plain Python is fast
enough and the script runs anywhere (the local box has no scientific stack).

    python3 scripts/kb_citemap_render.py
"""

import argparse
import json
import os
import math
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
# The corpus lives in the FUSION repo; this one only holds the web output.
CORPUS = Path(os.environ.get("FUSION_ROOT", PROJECT_ROOT.parent / "FUSION"))
KB_WIKI = CORPUS / "kb-wiki"
FUSION_WEB = PROJECT_ROOT


def read_frontmatter_title(md_path):
    try:
        with open(md_path, encoding="utf-8", errors="replace") as f:
            if f.readline().strip() != "---":
                return None, None
            title = authors = None
            for line in f:
                s = line.rstrip("\n")
                if s.strip() == "---":
                    break
                if s.startswith("title:"):
                    title = s.partition(":")[2].strip().strip('"')
                elif s.startswith("authors:"):
                    authors = s.partition(":")[2].strip().strip('"')
            return title, authors
    except OSError:
        return None, None


def density_field(xs, ys, size, sigma_cells):
    """2D histogram on a size x size grid, then a separable Gaussian blur."""
    grid = [0.0] * (size * size)
    for x, y in zip(xs, ys):
        cx = int((x + 1) * 0.5 * (size - 1))
        cy = int((y + 1) * 0.5 * (size - 1))
        if 0 <= cx < size and 0 <= cy < size:
            grid[cy * size + cx] += 1.0

    radius = max(1, int(sigma_cells * 3))
    kernel = [math.exp(-(i * i) / (2 * sigma_cells * sigma_cells))
              for i in range(-radius, radius + 1)]
    ktot = sum(kernel)
    kernel = [k / ktot for k in kernel]

    tmp = [0.0] * (size * size)
    for r in range(size):                       # horizontal pass
        base = r * size
        for c in range(size):
            acc = 0.0
            for k, w in enumerate(kernel):
                cc = c + k - radius
                if 0 <= cc < size:
                    acc += grid[base + cc] * w
            tmp[base + c] = acc
    out = [0.0] * (size * size)
    for c in range(size):                       # vertical pass
        for r in range(size):
            acc = 0.0
            for k, w in enumerate(kernel):
                rr = r + k - radius
                if 0 <= rr < size:
                    acc += tmp[rr * size + c] * w
            out[r * size + c] = acc

    peak = max(out) or 1.0
    return [round(v / peak, 4) for v in out]


def blur(grid, size, sigma):
    radius = max(1, int(sigma * 3))
    kern = [math.exp(-(i * i) / (2 * sigma * sigma)) for i in range(-radius, radius + 1)]
    tot = sum(kern)
    kern = [k / tot for k in kern]
    tmp = [0.0] * (size * size)
    for r in range(size):
        base = r * size
        for c in range(size):
            acc = 0.0
            for k, w in enumerate(kern):
                cc = c + k - radius
                if 0 <= cc < size:
                    acc += grid[base + cc] * w
            tmp[base + c] = acc
    out = [0.0] * (size * size)
    for c in range(size):
        for r in range(size):
            acc = 0.0
            for k, w in enumerate(kern):
                rr = r + k - radius
                if 0 <= rr < size:
                    acc += tmp[rr * size + c] * w
            out[r * size + c] = acc
    return out


def kmeans(points, k, iters=40, seed=1):
    """Tiny k-means over topic centroids. Deterministic: no RNG, the initial
    seeds are the k points farthest apart (greedy k-center)."""
    centres = [points[0]]
    while len(centres) < k:
        best, bestd = None, -1
        for p in points:
            d = min((p[0] - c[0]) ** 2 + (p[1] - c[1]) ** 2 for c in centres)
            if d > bestd:
                bestd, best = d, p
        centres.append(best)
    assign = [0] * len(points)
    for _ in range(iters):
        moved = False
        for i, p in enumerate(points):
            b = min(range(k), key=lambda j:
                    (p[0] - centres[j][0]) ** 2 + (p[1] - centres[j][1]) ** 2)
            if b != assign[i]:
                assign[i] = b; moved = True
        for j in range(k):
            mem = [points[i] for i in range(len(points)) if assign[i] == j]
            if mem:
                centres[j] = (sum(m[0] for m in mem) / len(mem),
                              sum(m[1] for m in mem) / len(mem))
        if not moved:
            break
    return assign, centres


def infer_topics(ids, xs, ys, topic_of, k=15, min_share=0.40, cells=200):
    """Fill in missing PhySH tags by spatial vote among labelled neighbours.

    kb_classify.py assigns tags by FTS5 keyword match, so a paper whose
    abstract does not use current PhySH vocabulary gets nothing -- that misses
    ~46% of the old-style nucl-th papers, a systematic age bias rather than
    random noise. But position here comes from the citation graph, not from
    words: if every neighbour of an untagged paper is beta-decay, the citation
    structure is already saying what it is.

    Inferred tags are flagged so the map can distinguish them from real ones.
    A vote below min_share stays unclassified rather than guessing.
    """
    labelled = [(i, xs[i], ys[i]) for i, p in enumerate(ids) if topic_of.get(p)]
    missing = [i for i, p in enumerate(ids) if not topic_of.get(p)]
    if not missing:
        return {}, 0

    # bucket the labelled papers so each lookup scans a local neighbourhood
    # instead of all 36k of them
    grid = {}
    def cell(x, y):
        return (int((x + 1) * 0.5 * (cells - 1)), int((y + 1) * 0.5 * (cells - 1)))
    for i, x, y in labelled:
        grid.setdefault(cell(x, y), []).append((i, x, y))

    inferred = {}
    for i in missing:
        cx, cy = cell(xs[i], ys[i])
        cand, ring = [], 0
        while len(cand) < k and ring < 6:
            for gx in range(cx - ring, cx + ring + 1):
                for gy in range(cy - ring, cy + ring + 1):
                    if ring and max(abs(gx - cx), abs(gy - cy)) != ring:
                        continue          # only the new outer ring
                    cand.extend(grid.get((gx, gy), ()))
            ring += 1
        if len(cand) < 3:
            continue
        cand.sort(key=lambda c: (c[1] - xs[i]) ** 2 + (c[2] - ys[i]) ** 2)
        votes = {}
        for j, _, _ in cand[:k]:
            t = topic_of[ids[j]]
            votes[t] = votes.get(t, 0) + 1
        best, cnt = max(votes.items(), key=lambda kv: kv[1])
        if cnt / min(k, len(cand)) >= min_share:
            inferred[i] = best
    return inferred, len(missing)


def spread(pts):
    n = len(pts)
    cx = sum(p[0] for p in pts) / n
    cy = sum(p[1] for p in pts) / n
    return cx, cy, math.sqrt(sum((p[0] - cx) ** 2 + (p[1] - cy) ** 2 for p in pts) / n)


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--coords", default=str(FUSION_WEB / "data" / "coords.json"))
    ap.add_argument("--grid", type=int, default=280, help="density grid resolution")
    ap.add_argument("--sigma", type=float, default=3.5, help="blur sigma in cells")
    ap.add_argument("--label-max-ratio", type=float, default=0.78,
                    help="a topic earns a label only below this spread ratio")
    ap.add_argument("--label-min-papers", type=int, default=60)
    ap.add_argument("--titles", type=int, default=4000,
                    help="ship titles for the N most-cited papers only "
                         "(all 55k would add ~6 MB to a single-file page)")
    ap.add_argument("--infer-k", type=int, default=15,
                    help="neighbours polled when inferring a missing tag")
    ap.add_argument("--infer-share", type=float, default=0.40,
                    help="winning share required, else left unclassified")
    ap.add_argument("--regions", type=int, default=5,
                    help="number of colour regions (5 is the largest set that "
                         "clears the all-pairs colour checks)")
    ap.add_argument("--out", default=str(FUSION_WEB / "data" / "map.json"))
    args = ap.parse_args()

    d = json.load(open(args.coords))
    ids, xs, ys, deg = d["ids"], d["x"], d["y"], d["degree"]
    n = len(ids)
    print(f"{n} papers from {args.coords}")

    cls = json.load(open(KB_WIKI / "classification.json"))
    topic_of = {p: min(e, key=lambda z: z["tier"])["slug"]
                for p, e in cls.items() if e}

    inferred, n_missing = infer_topics(ids, xs, ys, topic_of,
                                       k=args.infer_k, min_share=args.infer_share)
    print(f"未匹配 PhySH 词表: {n_missing} 篇 "
          f"({n_missing/n*100:.1f}%) -> 近邻推断补上 {len(inferred)} 篇 "
          f"({len(inferred)/max(n_missing,1)*100:.0f}%), "
          f"仍未分类 {n_missing-len(inferred)} 篇")

    # effective tag per index: real tag first, inferred second
    tag_at = {}
    for i, pid in enumerate(ids):
        t = topic_of.get(pid) or inferred.get(i)
        if t:
            tag_at[i] = t

    by_topic = {}
    for i in range(n):
        t = tag_at.get(i)
        if t:
            by_topic.setdefault(t, []).append((xs[i], ys[i]))

    _, _, g = spread(list(zip(xs, ys)))
    labels = []
    for t, pts in by_topic.items():
        if len(pts) < args.label_min_papers:
            continue
        cx, cy, s = spread(pts)
        ratio = s / g
        if ratio <= args.label_max_ratio:
            # One step of mode seeking: a topic with a home plus a diaspora has
            # its mean pulled into empty space between the two, which is how a
            # label ends up sitting in a neighbouring region. Re-centring on the
            # papers near the mean puts the name on the actual dense core.
            core = [q for q in pts
                    if (q[0] - cx) ** 2 + (q[1] - cy) ** 2 <= (0.6 * s) ** 2]
            if len(core) >= max(8, len(pts) // 8):
                cx, cy, _ = spread(core)
            labels.append({"slug": t, "n": len(pts), "x": round(cx, 4),
                           "y": round(cy, 4), "ratio": round(ratio, 3)})
    labels.sort(key=lambda L: L["ratio"])
    print(f"\n{len(labels)} topics earned a territory label "
          f"(ratio <= {args.label_max_ratio}, n >= {args.label_min_papers}):")
    for L in labels[:15]:
        print(f"   {L['ratio']:.2f}  {L['slug']:38s} {L['n']:5d}")
    rejected = sorted(((spread(p)[2] / g, t, len(p)) for t, p in by_topic.items()
                       if len(p) >= args.label_min_papers), reverse=True)[:5]
    print("以下主题过于弥散，不给区域标注（它们是通用语言，不是地点）:")
    for r, t, cnt in rejected:
        print(f"   {r:.2f}  {t:38s} {cnt:5d}")

    print(f"\nbuilding {args.grid}x{args.grid} density field...")
    dens = density_field(xs, ys, args.grid, args.sigma)

    # ---- regions ------------------------------------------------------------
    # Colour belongs to areas, not to marks: 39 per-point hues is confetti, and
    # no 39-colour palette can pass the contrast gates anyway. So topics are
    # grouped into K spatial families by clustering their centroids, and the
    # terrain is tinted by whichever family actually owns each cell. Families
    # are derived, not curated, so the colour blocks are contiguous by
    # construction. K=5 is the largest set that clears the all-pairs colour
    # checks on this paper surface.
    named = [L for L in labels]
    assign, centres = kmeans([(L["x"], L["y"]) for L in named], args.regions)
    fam_of_topic = {named[i]["slug"]: assign[i] for i in range(len(named))}
    for i, L in enumerate(named):
        L["region"] = assign[i]

    fam_counts = [[0.0] * (args.grid * args.grid) for _ in range(args.regions)]
    for i in range(n):
        f = fam_of_topic.get(tag_at.get(i, ""))
        if f is None:
            continue
        cx = int((xs[i] + 1) * 0.5 * (args.grid - 1))
        cy = int((ys[i] + 1) * 0.5 * (args.grid - 1))
        if 0 <= cx < args.grid and 0 <= cy < args.grid:
            fam_counts[f][cy * args.grid + cx] += 1.0
    print(f"tinting {args.regions} regions...")
    fam_fields = [blur(g, args.grid, args.sigma * 1.6) for g in fam_counts]

    # per cell: which family dominates, and how decisively (0 = contested)
    region_id, region_w = [], []
    for c in range(args.grid * args.grid):
        vals = [f[c] for f in fam_fields]
        tot = sum(vals)
        if tot <= 1e-9:
            region_id.append(-1); region_w.append(0.0); continue
        best = max(range(args.regions), key=lambda j: vals[j])
        region_id.append(best)
        region_w.append(round(vals[best] / tot, 3))

    # A label's region must be read off the terrain it actually sits on.
    # Assigning it by k-means over centroids instead lets a name be filed under
    # one region while being drawn on top of another's colour.
    for L in named:
        gx = int((L["x"] + 1) * 0.5 * (args.grid - 1))
        gy = int((L["y"] + 1) * 0.5 * (args.grid - 1))
        if 0 <= gx < args.grid and 0 <= gy < args.grid:
            owner = region_id[gy * args.grid + gx]
            if owner >= 0:
                L["region"] = owner

    region_names = []
    for j in range(args.regions):
        mem = sorted((L for L in named if L["region"] == j),
                     key=lambda L: -L["n"])
        region_names.append([m["slug"] for m in mem[:3]])
        print(f"   区 {j}: {', '.join(m['slug'] for m in mem[:4])}"
              f"  ({len(mem)} 个主题)")

    order = sorted(range(n), key=lambda i: -deg[i])[:args.titles]
    titled = {}
    for i in order:
        t, a = read_frontmatter_title(KB_WIKI / "papers" / f"{ids[i].replace('/', '_')}.md")
        if t:
            titled[i] = [t, a or ""]
    print(f"titles attached for {len(titled)}/{args.titles} top-cited papers")

    topics_used = sorted(set(tag_at.values()))
    tindex = {t: i for i, t in enumerate(topics_used)}
    out = {
        "meta": {"n": n, "grid": args.grid, "layout": d.get("params", {}),
                 "tagged_real": sum(1 for p in ids if topic_of.get(p)),
                 "tagged_inferred": len(inferred),
                 "untagged": n - len(tag_at)},
        "topics": topics_used,
        "x": [round(v, 4) for v in xs],
        "y": [round(v, 4) for v in ys],
        "d": deg,
        "t": [tindex.get(tag_at.get(i, ""), -1) for i in range(n)],
        "inf": [1 if i in inferred else 0 for i in range(n)],
        "ids": ids,
        "density": dens,
        "region": region_id,
        "regionW": region_w,
        "regionNames": region_names,
        "labels": labels,
        "titles": {str(k): v for k, v in titled.items()},
    }
    outp = Path(args.out)
    outp.parent.mkdir(parents=True, exist_ok=True)
    json.dump(out, open(outp, "w"), ensure_ascii=False)
    print(f"wrote {outp} ({outp.stat().st_size/1e6:.1f} MB)")


if __name__ == "__main__":
    main()
