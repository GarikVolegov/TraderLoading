#!/usr/bin/env python3
"""Materialize seven- and ten-feature golden artifacts from SYNTHETIC data only.

This test entrypoint intentionally bypasses the real macro collector. It refuses
real dataset provenance; none of its reports can authorize deployment.
"""
import argparse
from pathlib import Path

from directional import CLASSES, canonical_bytes, load_dataset, sha_bytes, train_pair, write_json


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", required=True)
    parser.add_argument("--output", required=True)
    args = parser.parse_args()
    metadata, source_rows, _ = load_dataset(args.input)
    if metadata["provenance"] != "synthetic":
        parser.error("Golden fixture generator only accepts explicitly synthetic inputs")
    base_hash = sha_bytes(Path(args.input).read_bytes())
    for profile in ("price", "macro"):
        rows = []
        for index, row in enumerate(source_rows):
            if row["pair"] != "EURUSD":
                continue
            features = list(row["features"])
            if profile == "macro":
                sign = {"up": 1, "flat": 0, "down": -1}[row["outcome"]]
                # Artificial label-correlated values prove serialization only.
                features += [index % 5, sign * 0.1, int(index % 7 == 0)]
            rows.append(dict(row, features=features))
        dataset_hash = sha_bytes((base_hash + ":synthetic-" + profile).encode())
        artifact, report, vectors = train_pair(rows, "EURUSD", dataset_hash, "synthetic", "2026-10-10T00:00:00.000Z")
        report["purpose"] = "synthetic software integration; no market evidence"
        report["passed"] = False
        directory = Path(args.output) / profile
        report_hash = write_json(directory / "EURUSD.validation.json", report)
        artifact["version"] = "synthetic-" + artifact["version"]
        artifact["historicalValidation"] = {"passed": False, "datasetHash": dataset_hash,
                                             "reportHash": report_hash, "provenance": "historical_research"}
        if "priceOnlyModel" in artifact:
            artifact["priceOnlyModel"]["version"] = "synthetic-" + artifact["priceOnlyModel"]["version"]
            artifact["priceOnlyModel"]["historicalValidation"] = dict(artifact["historicalValidation"])
        model_hash = write_json(directory / "EURUSD.json", artifact)
        write_json(directory / "EURUSD.parity.json", {"schema": "directional-parity-v1", "purpose": report["purpose"],
            "modelSha256": model_hash, "classes": list(CLASSES), "featureOrder": artifact["features"], "vectors": vectors})
        print(canonical_bytes({"profile": profile, "modelSha256": model_hash, "reportSha256": report_hash,
                              "liveApproved": False, "directory": str(directory)}).decode())


if __name__ == "__main__":
    main()
