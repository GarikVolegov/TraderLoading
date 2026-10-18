#!/usr/bin/env python3
"""Explicitly synthetic integration fixture; never market-performance evidence."""
import argparse
from datetime import timedelta
import math
from pathlib import Path
import random

from directional import CLASSES, FEATURES, PAIRS, SCHEMA, SOURCE, canonical_bytes, iso, sha_bytes, stamp


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", required=True)
    parser.add_argument("--pair", choices=PAIRS, default="EURUSD")
    args = parser.parse_args()
    path = Path(args.output)
    path.parent.mkdir(parents=True, exist_ok=True)
    rng = random.Random(147)
    start = stamp("2020-01-01T00:00:00Z")
    with path.open("wb") as stream:
        stream.write(canonical_bytes({"type": "metadata", "schema": SCHEMA, "featureOrder": list(FEATURES),
                                     "source": SOURCE, "provenance": "synthetic", "purpose": "software integration only"}) + b"\n")
        for index in range(5 * 365 * 6):
            label = CLASSES[index % 3]
            sign = {"up": 1, "flat": 0, "down": -1}[label]
            cutoff = start + timedelta(hours=index * 4)
            features = [sign * 0.001 + rng.gauss(0, 0.0001), sign * 0.002 + rng.gauss(0, 0.0001),
                        rng.gauss(0, 0.01), 0.001 + rng.random() * 0.001, 0.003 + rng.random() * 0.001,
                        math.sin(cutoff.hour * math.pi / 12), math.cos(cutoff.hour * math.pi / 12)]
            row = {"pair": args.pair, "cutoffAt": iso(cutoff), "targetEnd": iso(cutoff + timedelta(hours=4)),
                   "features": features, "outcome": label, "source": SOURCE, "provenance": "synthetic",
                   "inputHash": sha_bytes(canonical_bytes({"synthetic": True, "index": index, "features": features}))}
            stream.write(canonical_bytes(row) + b"\n")
    print(path)


if __name__ == "__main__":
    main()
