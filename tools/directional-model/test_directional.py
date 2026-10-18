"""Deterministic research checks. Synthetic tests cannot qualify a live model."""
import argparse
from datetime import datetime, timedelta, timezone
import hashlib
import importlib.util
import json
import math
from pathlib import Path
import random
import tempfile
import unittest

import directional as d


class ProtocolTests(unittest.TestCase):
    def test_target_band_and_timezone(self):
        self.assertEqual(d.outcome(0.01, 0.01), "flat")
        self.assertEqual(d.outcome(-0.01, 0.01), "flat")
        self.assertEqual(d.outcome(0.010001, 0.01), "up")
        self.assertEqual(d.outcome(-0.010001, 0.01), "down")
        with self.assertRaises(ValueError):
            d.stamp("2026-10-10T10:00:00")

    def test_features_exclude_hour_gaps(self):
        start = d.stamp("2026-01-05T00:00:00Z")
        hours = [{"time": int(start.timestamp()) + index * 3600,
                  "close": 1.1 * math.exp(0.001 * math.sin(index)), "high": 1.11, "low": 1.09}
                 for index in range(121)]
        self.assertIsNotNone(d.technical_features(hours, start + timedelta(hours=121)))
        # Removing one H1 invalidates two 1-hour returns; the gap is never an H1 return.
        self.assertIsNone(d.technical_features(hours[:70] + hours[71:], start + timedelta(hours=121)))

    def test_calendar_dst_and_gold_maintenance(self):
        manifest = {"verifiedFrom": "2026-01-01T00:00:00Z", "verifiedUntil": "2027-01-01T00:00:00Z",
                    "sourceUrls": ["https://www.dukascopy.com/swiss/english/forex/forex-trading-accounts/link/"], "closedIntervals": []}
        winter = d.stamp("2026-01-06T22:00:00Z")
        summer = d.stamp("2026-07-06T21:00:00Z")
        self.assertFalse(d.trading_window_open("XAUUSD", winter, winter + timedelta(hours=1), manifest))
        self.assertFalse(d.trading_window_open("XAUUSD", summer, summer + timedelta(hours=1), manifest))
        self.assertTrue(d.trading_window_open("EURUSD", winter, winter + timedelta(hours=1), manifest))
        self.assertFalse(d.trading_window_open("EURUSD", d.stamp("2026-01-10T10:00:00Z"), d.stamp("2026-01-10T14:00:00Z"), manifest))
        self.assertFalse(d.trading_window_open("EURUSD", winter, winter + timedelta(hours=1), None))

    def test_purged_temporal_boundaries(self):
        boundary = d.stamp("2026-01-01T00:00:00Z")
        rows = [{"_cutoff": boundary - timedelta(hours=8), "_end": boundary - timedelta(hours=4)},
                {"_cutoff": boundary - timedelta(hours=4), "_end": boundary},
                {"_cutoff": boundary - timedelta(hours=3), "_end": boundary + timedelta(hours=1)}]
        selected = d.select_interval(rows, boundary - timedelta(days=1), boundary)
        self.assertEqual(selected, rows[:1])

    def test_adaptive_calibration_counts(self):
        start = d.stamp("2025-01-01T00:00:00Z")
        rows = [{"outcome": d.CLASSES[index % 3], "_cutoff": start + timedelta(hours=4 * index)} for index in range(501)]
        values, bins = d.calibration(rows, [[0.34, 0.33, 0.33]] * 501)
        self.assertEqual(len(bins["up"]), 10)
        self.assertTrue(all(item["samples"] >= 50 for item in bins["up"]))
        self.assertLess(values["up"], 0.02)

    def test_synthetic_cannot_pass_even_perfect_metrics(self):
        report = {"provenance": "synthetic", "walkForward": [{}, {}], "holdout": {
            "samples": 1000, "spanDays": 190, "classCounts": dict.fromkeys(d.CLASSES, 300),
            "calibration": dict.fromkeys(d.CLASSES, 0), "brierImprovementCI95": [0.2, 0.3],
            "pValue": 0.001, "brier": 0.1, "baselineBrier": 0.5, "logLoss": 0.1, "baselineLogLoss": 1.0}}
        self.assertFalse(d.statistical_pass(report))

    def test_loader_rejects_lookahead_and_duplicate(self):
        header = {"type": "metadata", "schema": d.SCHEMA, "source": d.SOURCE,
                  "featureOrder": list(d.FEATURES), "provenance": "prospective"}
        row = {"pair": "EURUSD", "source": d.SOURCE, "provenance": "prospective", "inputHash": "a" * 64,
               "cutoffAt": "2026-01-05T00:00:00Z", "targetEnd": "2026-01-05T04:00:00Z",
               "issuedAt": "2026-01-05T00:00:10Z", "resolvedAt": "2026-01-05T04:01:00Z",
               "features": [0.0] * 7, "outcome": "flat", "availableAt": "2026-01-05T00:01:00Z"}
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "data.jsonl"
            path.write_text(json.dumps(header) + "\n" + json.dumps(row) + "\n")
            with self.assertRaisesRegex(ValueError, "unavailable"):
                d.load_dataset(path)
            row["availableAt"] = "2026-01-04T23:59:59Z"
            path.write_text(json.dumps(header) + "\n" + json.dumps(row) + "\n" + json.dumps(row) + "\n")
            with self.assertRaisesRegex(ValueError, "Duplicate"):
                d.load_dataset(path)

    def test_macro_join_requires_real_coverage_and_never_fills_missing(self):
        cutoff = d.stamp("2026-01-05T00:00:00Z")
        price = {"pair": "EURUSD", "features": [0.0] * 7, "_cutoff": cutoff}
        valid = {"pair": "EURUSD", "cutoffAt": d.iso(cutoff), "availableAt": d.iso(cutoff),
                 "coverageFrom": d.iso(cutoff - timedelta(hours=4)), "coverageUntil": d.iso(cutoff),
                 "provenance": "prospective", "features": [0, 0.0, 0], "inputHash": "a" * 64, "maxGapMinutes": 15}
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "macro.jsonl"
            path.write_text(json.dumps(valid) + "\n")
            merged, metadata = d.merge_macro([price, dict(price, _cutoff=cutoff + timedelta(hours=4))], path, "prospective")
            self.assertEqual(len(merged[0]["features"]), 10)
            self.assertEqual(metadata["excludedWithoutCoveredMacro"], 1)
            with self.assertRaisesRegex(ValueError, "prospective"):
                d.merge_macro([price], path, "historical_research")
            valid["availableAt"] = d.iso(cutoff + timedelta(seconds=1))
            path.write_text(json.dumps(valid) + "\n")
            with self.assertRaisesRegex(ValueError, "after"):
                d.merge_macro([price], path, "prospective")

    def test_stream_backfill_never_fabricates_receipt_times(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            start = d.stamp("2026-01-05T00:00:00Z")
            manifest = {"verifiedFrom": d.iso(start), "verifiedUntil": d.iso(start + timedelta(days=20)),
                        "sourceUrls": ["https://www.dukascopy.com/"], "closedIntervals": []}
            raw = d.canonical_bytes(manifest)
            (root / "calendar.json").write_bytes(raw)
            with (root / "raw.jsonl").open("w") as stream:
                for index in range(12 * 24 * 60):
                    ts = int(start.timestamp()) + index * 60
                    price = 1.1 * math.exp(0.001 * math.sin(index / 80))
                    stream.write(json.dumps({"pair": "EURUSD", "time": ts, "open": price, "high": price + 0.0001,
                        "low": price - 0.0001, "close": price, "source": d.SOURCE, "provenance": "synthetic"}) + "\n")
            args = argparse.Namespace(input=str(root / "raw.jsonl"), output=str(root / "data.jsonl"),
                calendar=str(root / "calendar.json"), calendar_sha256=hashlib.sha256(raw).hexdigest(), pairs="EURUSD", provenance="synthetic")
            d.build_dataset(args)
            metadata, rows, _ = d.load_dataset(root / "data.jsonl")
            self.assertEqual(metadata["availability"], "historical_receipt_unknown")
            self.assertGreater(len(rows), 0)
            self.assertTrue(all("availableAt" not in row and "issuedAt" not in row for row in rows))


@unittest.skipUnless(importlib.util.find_spec("sklearn"), "Offline scikit environment is not installed")
class ModelIntegrationTests(unittest.TestCase):
    def test_sklearn_export_parity_and_calibration_cutoff(self):
        rng = random.Random(147)
        start = d.stamp("2020-01-01T00:00:00Z")
        rows = []
        for index in range(1800):
            y = d.CLASSES[index % 3]
            sign = {"up": 1, "flat": 0, "down": -1}[y]
            values = [sign * 0.001 + rng.gauss(0, 0.0001), sign * 0.002 + rng.gauss(0, 0.0001),
                      rng.gauss(0, 0.01), 0.001 + rng.random() * 0.001, 0.003 + rng.random() * 0.001,
                      math.sin(index), math.cos(index)]
            cutoff = start + timedelta(hours=4 * index)
            rows.append({"features": values, "outcome": y, "_cutoff": cutoff, "_end": cutoff + timedelta(hours=4)})
        artifact, _, _ = d.fit_model(rows[:1200], rows[1200:1500], "EURUSD", 1)
        self.assertEqual(artifact["trainedThrough"], d.iso(rows[1499]["_end"]))
        self.assertEqual(artifact["classes"], ["up", "flat", "down"])
        self.assertTrue(all(abs(sum(d.infer(artifact, row["features"])) - 1) < 1e-12 for row in rows[1500:]))
        self.assertGreater(sum(d.CLASSES[max(range(3), key=lambda k: d.infer(artifact, row["features"])[k])] == row["outcome"] for row in rows[1500:]), 290)


if __name__ == "__main__":
    unittest.main()
