#!/usr/bin/env python3
"""FUSION KB: offline 2D layout of the citation corpus for the web/paper map.

Paradigm (see fusion-web/README.md): the citation graph is a *layout constraint*
only -- no edges are drawn. Output is a density map of papers, following the
Paperscape / WizMap precedent, which is what actually works at 10^4-10^5 scale.

Pipeline, deliberately dependency-light (numpy/scipy/sklearn only, all present
in the heliumx `pinn` env -- no UMAP, no Leiden, no node2vec):

  citations.tsv -> symmetric sparse adjacency
                -> association-strength normalisation  (2m*c_ij / (c_i*c_j))
                -> TruncatedSVD to d dims             (spectral embedding)
                -> t-SNE to 2D                        (barnes_hut)
                -> coords.json

Topic labels are NOT computed here: the corpus already carries PhySH tags in
kb-wiki/classification.json, so community detection is unnecessary.

Run on heliumx:
    conda run -n pinn python scripts/kb_citemap.py --out fusion-web/data/coords.json
"""

import argparse
import json
import os
import time
from pathlib import Path

import numpy as np
import scipy.sparse as sp
from sklearn.decomposition import TruncatedSVD
from sklearn.manifold import TSNE

PROJECT_ROOT = Path(__file__).resolve().parent.parent
# The corpus lives in the FUSION repo; this one only holds the web output.
CORPUS = Path(os.environ.get("FUSION_ROOT", PROJECT_ROOT.parent / "FUSION"))
KB_WIKI = CORPUS / "kb-wiki"
CITATIONS_TSV = KB_WIKI / "citations.tsv"


def load_graph(path, min_degree):
    """Read citations.tsv into a symmetric CSR adjacency over the kept nodes."""
    edges = []
    degree = {}
    with open(path) as f:
        next(f)
        for line in f:
            citing, _, cited = line.rstrip("\n").partition("\t")
            if not cited:
                continue
            edges.append((citing, cited))
            degree[citing] = degree.get(citing, 0) + 1
            degree[cited] = degree.get(cited, 0) + 1

    # Degree-1 leaves sit at a well-defined spot (next to their single
    # neighbour) but contribute nothing to the density structure, and after
    # association-strength normalisation their lone edge carries an outsized
    # weight 2m/(1*c_j). Dropping them costs 5.7% of nodes on the 2026-07
    # corpus and removes that distortion.
    keep = {p for p, d in degree.items() if d >= min_degree}
    ids = sorted(keep)
    idx = {p: i for i, p in enumerate(ids)}
    print(f"nodes: {len(degree)} total, {len(ids)} with degree >= {min_degree}")

    rows, cols = [], []
    for a, b in edges:
        if a in idx and b in idx:
            rows.append(idx[a]); cols.append(idx[b])
    n = len(ids)
    data = np.ones(len(rows), dtype=np.float32)
    A = sp.csr_matrix((data, (rows, cols)), shape=(n, n))
    A = A + A.T                      # citation direction is not a similarity
    A.data[:] = 1.0                  # collapse reciprocal pairs to a single tie
    print(f"edges kept: {A.nnz // 2}")
    return ids, A


def association_strength(A):
    """s_ij = 2m * c_ij / (c_i * c_j).

    Without this, highly-cited hub papers dominate both position and cluster
    assignment -- the standard normalisation in the VOSviewer literature.
    """
    deg = np.asarray(A.sum(axis=1)).ravel()
    deg[deg == 0] = 1.0
    two_m = A.sum()
    Dinv = sp.diags(1.0 / deg)
    S = (Dinv @ A @ Dinv) * two_m
    return S.tocsr()


def topic_coherence(ids, Y, classification_path):
    """Mean per-topic spatial spread relative to the global spread.

    1.0 means topics are scattered exactly like random points; lower is better.
    This is the metric the layout is tuned against -- the map only works if
    papers sharing a PhySH topic land near each other.
    """
    with open(classification_path) as f:
        cls = json.load(f)
    pos = {p: i for i, p in enumerate(ids)}
    by_topic = {}
    for p, entries in cls.items():
        i = pos.get(p)
        if i is None or not entries:
            continue
        slug = min(entries, key=lambda e: e["tier"])["slug"]
        by_topic.setdefault(slug, []).append(i)

    g = np.sqrt(((Y - Y.mean(axis=0)) ** 2).sum(axis=1).mean())
    ratios = []
    for slug, idxs in by_topic.items():
        if len(idxs) < 40:
            continue
        P = Y[idxs]
        s = np.sqrt(((P - P.mean(axis=0)) ** 2).sum(axis=1).mean())
        ratios.append(s / g)
    ratios.sort()
    return float(np.median(ratios)), len(ratios)


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--min-degree", type=int, default=2,
                    help="drop nodes below this citation degree (default 2)")
    ap.add_argument("--svd-dims", type=int, default=64)
    ap.add_argument("--perplexity", type=float, default=25,
                    help="lowered from the default 30 to preserve local detail")
    ap.add_argument("--seed", type=int, default=0)
    ap.add_argument("--out", default="fusion-web/data/coords.json")
    ap.add_argument("--citations", default=None,
                    help="path to citations.tsv (default: kb-wiki/, else ./)")
    ap.add_argument("--classification", default=None,
                    help="classification.json; enables the topic-coherence score")
    ap.add_argument("--no-assoc", action="store_true",
                    help="skip association-strength normalisation")
    ap.add_argument("--row-normalize", action="store_true",
                    help="L2-normalise the SVD embedding before t-SNE")
    ap.add_argument("--tag", default="", help="label for this sweep run")
    args = ap.parse_args()

    cites = Path(args.citations) if args.citations else (
        CITATIONS_TSV if CITATIONS_TSV.exists() else Path("citations.tsv"))
    if not cites.exists():
        raise SystemExit(f"citations.tsv not found at {cites}")
    print(f"reading {cites}")

    t0 = time.time()
    ids, A = load_graph(cites, args.min_degree)
    S = A.astype(np.float32) if args.no_assoc else association_strength(A)
    print(f"[{time.time()-t0:.0f}s] adjacency built (assoc={not args.no_assoc})")

    svd = TruncatedSVD(n_components=args.svd_dims, random_state=args.seed)
    X = svd.fit_transform(S)
    ev = svd.explained_variance_ratio_.sum()
    print(f"[{time.time()-t0:.0f}s] SVD -> {X.shape}, explained variance {ev:.3f}")

    if args.row_normalize:
        # Spectral embeddings are direction-carrying: without this the t-SNE
        # neighbourhood is dominated by node degree rather than by position.
        norms = np.linalg.norm(X, axis=1, keepdims=True)
        norms[norms == 0] = 1.0
        X = X / norms
        print(f"[{time.time()-t0:.0f}s] rows L2-normalised")

    tsne = TSNE(n_components=2, perplexity=args.perplexity, init="pca",
                method="barnes_hut", random_state=args.seed, verbose=2)
    Y = tsne.fit_transform(X.astype(np.float32))
    print(f"[{time.time()-t0:.0f}s] t-SNE done, KL={tsne.kl_divergence_:.3f}")

    # Normalise to [-1, 1] so the renderers do not each invent their own scale.
    Y = Y - Y.mean(axis=0)
    Y = Y / np.abs(Y).max()

    coherence = None
    if args.classification:
        coherence, n_topics = topic_coherence(ids, Y, args.classification)
        print(f"[{time.time()-t0:.0f}s] RESULT tag={args.tag or 'default'} "
              f"dims={args.svd_dims} perp={args.perplexity} "
              f"assoc={not args.no_assoc} rownorm={args.row_normalize} "
              f"-> coherence={coherence:.3f} over {n_topics} topics "
              f"(1.0 = random, lower is better)")

    degree = np.asarray(A.sum(axis=1)).ravel().astype(int)
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    with open(out, "w") as f:
        json.dump({
            "params": {"min_degree": args.min_degree, "svd_dims": args.svd_dims,
                       "perplexity": args.perplexity, "seed": args.seed,
                       "explained_variance": round(float(ev), 4),
                       "kl_divergence": round(float(tsne.kl_divergence_), 4),
                       "assoc": not args.no_assoc,
                       "row_normalize": args.row_normalize,
                       "coherence": coherence},
            "ids": ids,
            "x": [round(float(v), 4) for v in Y[:, 0]],
            "y": [round(float(v), 4) for v in Y[:, 1]],
            "degree": degree.tolist(),
        }, f)
    print(f"[{time.time()-t0:.0f}s] wrote {out} ({out.stat().st_size/1e6:.1f} MB)")


if __name__ == "__main__":
    main()
