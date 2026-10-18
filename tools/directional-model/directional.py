#!/usr/bin/env python3
"""Reproducible offline price research. Never authorizes live probabilities.

build-dataset reads chronological Dukascopy bid M1 JSONL, without fabricating
historical receipt times. train reads the same resolved snapshot shape exported
by the API. Scientific reports and golden inference vectors accompany each model.
"""
import argparse
import calendar as month_calendar
from collections import Counter, defaultdict, deque
from datetime import datetime, timedelta, timezone
import hashlib
import json
import math
from pathlib import Path
import random
import statistics
import sys
from zoneinfo import ZoneInfo

PAIRS = ("EURUSD", "GBPUSD", "USDJPY", "USDCHF", "AUDUSD", "USDCAD", "NZDUSD", "XAUUSD")
CLASSES = ("up", "flat", "down")
FEATURES = ("return1h", "return4h", "return24h", "volatility120h", "range20h", "hourSin", "hourCos")
MACRO_FEATURES = FEATURES + ("macroEvents4h", "macroSurprise4h", "macroConflict4h")
SCHEMA = "directional-dataset-v1"
SPLIT_POLICY = "train24m-cal3m-test3m-walkforward-purge4h-final6m-min183d-v1"
HORIZON = 4 * 3600
SOURCE = "dukascopy_bid"
UTC = timezone.utc
NY = ZoneInfo("America/New_York")


def stamp(value):
    if not isinstance(value, str):
        raise ValueError("UTC timestamp must be a string")
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if parsed.tzinfo is None:
        raise ValueError("Timestamp must carry an explicit timezone")
    return parsed.astimezone(UTC)


def iso(value):
    if isinstance(value, (int, float)):
        value = datetime.fromtimestamp(value, UTC)
    return value.astimezone(UTC).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def finite(value):
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value)


def sha_bytes(data):
    return hashlib.sha256(data).hexdigest()


def sha_file(path):
    digest = hashlib.sha256()
    with Path(path).open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def canonical_bytes(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"), allow_nan=False).encode()


def write_json(path, value):
    data = canonical_bytes(value) + b"\n"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)
    return sha_bytes(data)


def months_before(value, count):
    year, month = divmod(value.year * 12 + value.month - 1 - count, 12)
    month += 1
    return value.replace(year=year, month=month,
                         day=min(value.day, month_calendar.monthrange(year, month)[1]))


def validated_calendar(path, expected_hash):
    raw = Path(path).read_bytes()
    if sha_bytes(raw) != expected_hash:
        raise ValueError("Calendar hash does not match the explicitly reviewed manifest")
    data = json.loads(raw)
    if not any(str(url).startswith("https://www.dukascopy.com/") for url in data.get("sourceUrls", [])):
        raise ValueError("Calendar must cite the verified Dukascopy trading-hours source")
    if stamp(data["verifiedFrom"]) >= stamp(data["verifiedUntil"]):
        raise ValueError("Invalid verified calendar coverage")
    for interval in data["closedIntervals"]:
        if interval["pair"] not in PAIRS + ("*",) or stamp(interval["start"]) >= stamp(interval["end"]):
            raise ValueError("Invalid closed interval")
    return data


def trading_window_open(pair, start, end, manifest):
    """Mirrors the runtime calendar: NY DST, gold maintenance, reviewed exceptions.

    A historical manifest needs verified exceptions for its historical coverage.
    A current calendar is not silently reused for an earlier research period.
    """
    if not manifest or end <= start or start < stamp(manifest["verifiedFrom"]) or end > stamp(manifest["verifiedUntil"]):
        return False
    if any(item["pair"] in (pair, "*") and stamp(item["start"]) < end and stamp(item["end"]) > start
           for item in manifest["closedIntervals"]):
        return False
    current = start
    while current <= end:
        local = current.astimezone(NY)
        day, hour = local.weekday(), local.hour
        if day == 5 or (day == 6 and hour < 17) or (day == 4 and hour >= 17) or (pair == "XAUUSD" and hour == 17):
            return False
        current += timedelta(minutes=1)
    return True


def outcome(return_log, delta):
    if not finite(return_log) or not finite(delta) or delta <= 0:
        raise ValueError("A target requires finite log return and positive volatility band")
    return "up" if return_log > delta else "down" if return_log < -delta else "flat"


def technical_features(hours, cutoff):
    """Seven runtime features; full H1 bars only, no return across a closed session."""
    if len(hours) < 25:
        return None
    history = list(hours)
    returns = [math.log(right["close"] / left["close"])
               for left, right in zip(history, history[1:]) if right["time"] - left["time"] == 3600][-120:]
    if len(returns) != 120:
        return None
    sigma = statistics.stdev(returns)
    if not finite(sigma) or sigma <= 0:
        return None
    last = history[-1]
    by_time = {bar["time"]: bar for bar in history}
    previous = [by_time.get(last["time"] - count * 3600) for count in (1, 4, 24)]
    if any(bar is None for bar in previous):
        return None
    hour_angle = (cutoff.timestamp() / 3600 % 24) * math.pi / 12
    features = [math.log(last["close"] / bar["close"]) for bar in previous]
    features += [sigma, sum((bar["high"] - bar["low"]) / bar["close"] for bar in history[-20:]) / 20,
                 math.sin(hour_angle), math.cos(hour_angle)]
    return features, 0.5 * sigma


def read_jsonl(path):
    with Path(path).open(encoding="utf-8") as stream:
        for line_number, line in enumerate(stream, 1):
            if not line.strip():
                continue
            try:
                row = json.loads(line)
                if not isinstance(row, dict):
                    raise ValueError("Expected an object")
                yield line_number, row
            except (ValueError, TypeError) as error:
                raise ValueError("{}:{}: {}".format(path, line_number, error)) from error


def build_dataset(args):
    manifest = validated_calendar(args.calendar, args.calendar_sha256)
    selected = set(args.pairs.split(","))
    if not selected.issubset(PAIRS):
        raise ValueError("Unsupported pair")
    if args.provenance not in ("historical_research", "synthetic"):
        raise ValueError("M1 backfills are research only; prospective snapshots come from the database exporter")
    states = {}
    counts = Counter()
    pending = defaultdict(dict)
    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    header = {"type": "metadata", "schema": SCHEMA, "provenance": args.provenance,
              "source": SOURCE, "featureOrder": list(FEATURES), "calendarHash": args.calendar_sha256,
              "availability": "historical_receipt_unknown", "target": "4h-wall-clock-log-return-band-0.5-std120h"}
    with output.open("w", encoding="utf-8") as target:
        target.write(canonical_bytes(header).decode() + "\n")
        for line_number, row in read_jsonl(args.input):
            if row.get("type") == "metadata":
                if row.get("source") not in (None, SOURCE):
                    raise ValueError("Source metadata does not describe Dukascopy bid")
                if row.get("provenance") == "synthetic" and args.provenance != "synthetic":
                    raise ValueError("Synthetic input cannot be relabelled historical research")
                continue
            pair = row.get("pair")
            if pair not in selected:
                continue
            if row.get("source") != SOURCE:
                raise ValueError("Line {} uses a noncanonical quote source".format(line_number))
            if row.get("provenance") == "synthetic" and args.provenance != "synthetic":
                raise ValueError("Synthetic candles cannot become historical evidence")
            ts = row.get("time")
            prices = [row.get(key) for key in ("open", "high", "low", "close")]
            if not isinstance(ts, int) or ts % 60 or not all(finite(p) and p > 0 for p in prices):
                raise ValueError("Invalid M1 candle at line {}".format(line_number))
            o, h, low, close = prices
            if h < max(o, low, close) or low > min(o, close):
                raise ValueError("Invalid OHLC at line {}".format(line_number))
            state = states.setdefault(pair, {"last": None, "hours": deque(maxlen=400), "minute": {},
                                             "bucket": ts // 3600 * 3600, "input": hashlib.sha256()})
            if state["last"] is not None and ts <= state["last"]:
                raise ValueError("Input must be strictly chronological per pair; duplicate or reversed M1")
            state["last"] = ts
            state["input"].update(canonical_bytes(row) + b"\n")
            bucket = ts // 3600 * 3600
            if bucket != state["bucket"]:
                state["minute"] = {}
                state["bucket"] = bucket
            state["minute"][ts] = row
            end = ts + 60
            for snapshot in pending[pair].values():
                if stamp(snapshot["cutoffAt"]).timestamp() <= ts < stamp(snapshot["targetEnd"]).timestamp():
                    snapshot["_targetMinuteCount"] += 1
            # Resolve only the exact final minute; a later bar is not a replacement.
            if end in pending[pair]:
                snapshot = pending[pair].pop(end)
                if snapshot.pop("_targetMinuteCount") != 240:
                    counts["unresolved_gapped_target"] += 1
                else:
                    r = math.log(close / snapshot["referencePrice"])
                    snapshot.update({"outcome": outcome(r, snapshot["delta"]), "returnLog": r,
                                     "finalPrice": close, "targetObservedAt": iso(end)})
                    target.write(canonical_bytes(snapshot).decode() + "\n")
                    counts["resolved"] += 1
            expired = [when for when in pending[pair] if when < end]
            for when in expired:
                del pending[pair][when]
                counts["unresolved_missing_endpoint"] += 1
            if end % 3600:
                continue
            minutes = state["minute"]
            if len(minutes) != 60 or any(bucket + index * 60 not in minutes for index in range(60)):
                counts["incomplete_h1"] += 1
                continue
            bars = [minutes[bucket + index * 60] for index in range(60)]
            state["hours"].append({"time": bucket, "close": bars[-1]["close"],
                                   "high": max(bar["high"] for bar in bars), "low": min(bar["low"] for bar in bars)})
            cutoff = datetime.fromtimestamp(end, UTC)
            # The shadow cohort is fixed to UTC hour % 4 == 0 before any outcome.
            if cutoff.hour % 4:
                continue
            features = technical_features(state["hours"], cutoff)
            if features is None:
                counts["short_or_gapped_history"] += 1
                continue
            target_end = cutoff + timedelta(seconds=HORIZON)
            if not trading_window_open(pair, cutoff, target_end, manifest):
                counts["closed_or_unverified_calendar"] += 1
                continue
            values, delta = features
            pending[pair][end + HORIZON] = {"pair": pair, "cutoffAt": iso(cutoff), "targetEnd": iso(target_end),
                "features": values, "delta": delta, "referencePrice": close, "referenceObservedAt": iso(end),
                "source": SOURCE, "provenance": args.provenance, "inputHash": state["input"].hexdigest(),
                "calendarHash": args.calendar_sha256, "_targetMinuteCount": 0}
            counts["snapshots"] += 1
        counts["unresolved_end_of_input"] += sum(len(rows) for rows in pending.values())
    result = {"schema": SCHEMA, "datasetHash": sha_file(output), "sourceHash": sha_file(args.input),
              "provenance": args.provenance, "counts": dict(counts), "output": str(output)}
    write_json(output.with_suffix(output.suffix + ".manifest.json"), result)
    print(json.dumps(result, sort_keys=True))


def load_dataset(path):
    metadata = None
    rows, rejected = [], Counter()
    seen = set()
    for line, row in read_jsonl(path):
        if row.get("type") == "metadata":
            if metadata is not None or rows:
                raise ValueError("A single metadata header must precede rows")
            metadata = row
            if row.get("schema") != SCHEMA or row.get("featureOrder") != list(FEATURES) or row.get("source") != SOURCE:
                raise ValueError("Unsupported dataset schema, feature order, or source")
            if row.get("provenance") not in ("historical_research", "prospective", "synthetic"):
                raise ValueError("Missing explicit dataset provenance")
            continue
        if metadata is None:
            raise ValueError("Dataset requires an explicit metadata header")
        if row.get("outcome") is None:
            rejected["unresolved"] += 1
            continue
        if row.get("pair") not in PAIRS or row.get("source") != SOURCE or row.get("provenance") != metadata["provenance"]:
            raise ValueError("Row {} contradicts dataset provenance/pair/source".format(line))
        if row["outcome"] not in CLASSES or not isinstance(row.get("features"), list) or len(row["features"]) != 7 or not all(finite(v) for v in row["features"]):
            raise ValueError("Invalid resolved feature row {}".format(line))
        cutoff, end = stamp(row["cutoffAt"]), stamp(row["targetEnd"])
        if end - cutoff != timedelta(seconds=HORIZON) or cutoff.minute or cutoff.second or cutoff.microsecond or cutoff.hour % 4:
            raise ValueError("Row {} is not the predefined nonoverlapping 4h cohort".format(line))
        if metadata["provenance"] != "synthetic" and end > datetime.now(UTC):
            raise ValueError("An actual resolved target cannot end in the future")
        if metadata["provenance"] == "prospective":
            issued = stamp(row["issuedAt"])
            if issued < cutoff or issued - cutoff > timedelta(minutes=1) or stamp(row["resolvedAt"]) < end:
                raise ValueError("Prospective row has impossible issuance or resolution timing")
            if stamp(row["resolvedAt"]) > datetime.now(UTC):
                raise ValueError("Prospective resolution timestamp is in the future")
            if row.get("availableAt") and stamp(row["availableAt"]) > cutoff:
                raise ValueError("Feature evidence was unavailable at the cutoff")
        if not isinstance(row.get("inputHash"), str) or len(row["inputHash"]) != 64 or any(c not in "0123456789abcdef" for c in row["inputHash"]):
            raise ValueError("Missing immutable input hash")
        if row.get("referenceObservedAt") and stamp(row["referenceObservedAt"]) > cutoff:
            raise ValueError("Price observation is after the cutoff")
        if row.get("featureObservedAt") and stamp(row["featureObservedAt"]) > cutoff:
            raise ValueError("Future feature observation")
        if row.get("delta") is not None and (not finite(row["delta"]) or row["delta"] <= 0):
            raise ValueError("Invalid neutral band")
        for key in ("referencePrice", "finalPrice"):
            if row.get(key) is not None and (not finite(row[key]) or row[key] <= 0):
                raise ValueError("Invalid target price")
        if row.get("referencePrice") is not None and row.get("finalPrice") is not None and row.get("delta") is not None:
            if outcome(math.log(row["finalPrice"] / row["referencePrice"]), row["delta"]) != row["outcome"]:
                raise ValueError("Outcome disagrees with the immutable prices and band")
        key = (row["pair"], row["cutoffAt"])
        if key in seen:
            raise ValueError("Duplicate decision cutoff")
        seen.add(key)
        row = dict(row, _cutoff=cutoff, _end=end)
        rows.append(row)
    return metadata, sorted(rows, key=lambda row: (row["pair"], row["_cutoff"])), dict(rejected)


def class_frequencies(rows):
    if not rows:
        raise ValueError("Cannot fit a baseline without past outcomes")
    counts = Counter(row["outcome"] for row in rows)
    # Add-one smoothing prevents impossible zero probabilities in a rare class.
    return [(counts[key] + 1) / (len(rows) + 3) for key in CLASSES]


def merge_macro(rows, path, provenance):
    """Only genuinely acquired, explicitly covered macro windows are joinable.

    No macro record, unknown surprise, or incomplete coverage means no training
    row. Zero is accepted only as an explicit feature in a covered observation.
    """
    if provenance != "prospective":
        raise ValueError("Macro candidates require prospective price and macro records; research backfills cannot supply point-in-time macro evidence")
    observations = {}
    for line, record in read_jsonl(path):
        if record.get("type") == "metadata":
            if record.get("schema") != "directional-macro-pit-v1" or record.get("provenance") != "prospective":
                raise ValueError("Invalid macro metadata")
            continue
        if record.get("pair") not in PAIRS or record.get("provenance") != "prospective":
            raise ValueError("Macro row {} has untrusted or synthetic provenance".format(line))
        cutoff, available = stamp(record["cutoffAt"]), stamp(record["availableAt"])
        if available > cutoff:
            raise ValueError("Macro evidence was acquired after the decision cutoff")
        coverage_until = stamp(record["coverageUntil"])
        max_gap = record.get("maxGapMinutes")
        if (stamp(record["coverageFrom"]) > cutoff - timedelta(seconds=HORIZON) or coverage_until > cutoff
                or cutoff - coverage_until > timedelta(minutes=15) or not finite(max_gap) or max_gap < 0 or max_gap > 15):
            raise ValueError("Macro sampled corpus coverage needs a full four-hour lookback, last acquisition within 15 minutes, and maximum gap 15 minutes")
        values = record.get("features")
        if not isinstance(values, list) or len(values) != 3 or not all(finite(value) for value in values):
            raise ValueError("Unknown macro values must not be fabricated as zero")
        if values[0] < 0 or int(values[0]) != values[0] or values[2] < 0:
            raise ValueError("Invalid macro event/conflict counts")
        evidence = record.get("inputHash")
        if not isinstance(evidence, str) or len(evidence) != 64 or any(c not in "0123456789abcdef" for c in evidence):
            raise ValueError("Macro record requires the immutable corpus input hash")
        key = (record["pair"], iso(cutoff))
        if key in observations:
            raise ValueError("Duplicate macro observation cutoff")
        observations[key] = record
    combined = []
    for row in rows:
        record = observations.get((row["pair"], iso(row["_cutoff"])))
        if record is not None:
            combined.append(dict(row, features=row["features"] + record["features"],
                                 macroInputHash=record["inputHash"], macroAvailableAt=record["availableAt"]))
    if not combined:
        raise ValueError("No complete, point-in-time macro observations matched the price dataset")
    return combined, {"matched": len(combined), "excludedWithoutCoveredMacro": len(rows) - len(combined),
                       "macroDatasetHash": sha_bytes(Path(path).read_bytes()), "profile": "price_macro_v1"}


def softmax(logits, temperature=1.0):
    values = [value / temperature for value in logits]
    largest = max(values)
    weights = [math.exp(value - largest) for value in values]
    total = sum(weights)
    return [value / total for value in weights]


def infer(artifact, features):
    standardized = [(value - average) / scale for value, average, scale in zip(features, artifact["mean"], artifact["scale"])]
    logits = [sum(weight * value for weight, value in zip(row, standardized)) + intercept
              for row, intercept in zip(artifact["coefficients"], artifact["intercepts"])]
    return softmax(logits, artifact["temperature"])


def brier(probabilities, label):
    return sum((value - int(label == key)) ** 2 for key, value in zip(CLASSES, probabilities))


def log_loss(probabilities, label):
    return -math.log(max(1e-12, probabilities[CLASSES.index(label)]))


def quantile(values, fraction):
    ordered = sorted(values)
    if not ordered:
        return None
    position = (len(ordered) - 1) * fraction
    index = int(position)
    return ordered[index] + (ordered[min(index + 1, len(ordered) - 1)] - ordered[index]) * (position - index)


def calibration(rows, probabilities):
    result, evidence = {}, {}
    for index, key in enumerate(CLASSES):
        ordered = sorted(zip(rows, probabilities), key=lambda item: item[1][index])
        count = min(10, len(ordered) // 50)
        if count == 0:
            result[key], evidence[key] = None, []
            continue
        error, bins = 0.0, []
        for part in range(count):
            block = ordered[part * len(ordered) // count:(part + 1) * len(ordered) // count]
            predicted = statistics.mean(item[1][index] for item in block)
            actual = sum(item[0]["outcome"] == key for item in block) / len(block)
            error += abs(predicted - actual) * len(block) / len(ordered)
            bins.append({"samples": len(block), "predicted": predicted, "observed": actual})
        result[key], evidence[key] = error, bins
    return result, evidence


def bootstrap_improvement(rows, probabilities, baselines, draws=2000):
    blocks = defaultdict(list)
    for row, probability, baseline in zip(rows, probabilities, baselines):
        # Same Monday-aligned UTC week as the TypeScript runtime.
        week = math.floor((row["_cutoff"].timestamp() / 86400 + 3) / 7)
        blocks[week].append(brier(baseline, row["outcome"]) - brier(probability, row["outcome"]))
    values = list(blocks.values())
    if len(values) < 20:
        return {"pValue": 1.0, "weeklyBlocks": len(values), "brierImprovementCI95": [None, None], "draws": draws}
    rng = random.Random(77123)
    improvements = []
    for _ in range(draws):
        selected = [values[rng.randrange(len(values))] for _ in values]
        improvements.append(sum(sum(block) for block in selected) / sum(len(block) for block in selected))
    return {"pValue": (sum(value <= 0 for value in improvements) + 1) / (draws + 1),
            "weeklyBlocks": len(values), "brierImprovementCI95": [quantile(improvements, 0.025), quantile(improvements, 0.975)],
            "draws": draws, "seed": 77123, "block": "UTC-week-Monday"}


def metrics(rows, probabilities, baseline):
    if len(rows) != len(probabilities) or not rows:
        raise ValueError("Metrics require matching nonempty predictions and outcomes")
    if any(len(p) != 3 or not all(finite(v) and 0 <= v <= 1 for v in p) or abs(sum(p) - 1) > 1e-8 for p in probabilities):
        raise ValueError("Invalid probability vector")
    baselines = [baseline] * len(rows)
    ece, bins = calibration(rows, probabilities)
    counts = Counter(row["outcome"] for row in rows)
    values = {"start": iso(rows[0]["_cutoff"]), "end": iso(rows[-1]["_cutoff"]), "samples": len(rows),
              "classCounts": {key: counts[key] for key in CLASSES}, "spanDays": (rows[-1]["_cutoff"] - rows[0]["_cutoff"]).total_seconds() / 86400,
              "brier": statistics.mean(brier(p, row["outcome"]) for p, row in zip(probabilities, rows)),
              "baselineBrier": statistics.mean(brier(baseline, row["outcome"]) for row in rows),
              "logLoss": statistics.mean(log_loss(p, row["outcome"]) for p, row in zip(probabilities, rows)),
              "baselineLogLoss": statistics.mean(log_loss(baseline, row["outcome"]) for row in rows),
              "baseline": dict(zip(CLASSES, baseline)), "calibration": ece, "calibrationBins": bins,
              "brierPerClass": {key: statistics.mean((p[index] - int(row["outcome"] == key)) ** 2 for p, row in zip(probabilities, rows))
                                for index, key in enumerate(CLASSES)}}
    values.update(bootstrap_improvement(rows, probabilities, baselines))
    return values


def price_only_comparison(rows, probabilities, price_probabilities):
    result = {"samples": len(rows), "brier": statistics.mean(brier(p, row["outcome"]) for p, row in zip(price_probabilities, rows)),
              "logLoss": statistics.mean(log_loss(p, row["outcome"]) for p, row in zip(price_probabilities, rows)),
              "comparison": "macro-minus-price-only-on-identical-cohort"}
    result.update(bootstrap_improvement(rows, probabilities, price_probabilities))
    return result


def statistical_pass(report):
    holdout = report.get("holdout", {})
    lower = holdout.get("brierImprovementCI95", [None])[0]
    passed = (report.get("provenance") in ("historical_research", "prospective") and len(report.get("walkForward", [])) >= 2
            and holdout.get("samples", 0) >= 500 and holdout.get("spanDays", 0) >= 183
            and all(holdout.get("classCounts", {}).get(key, 0) >= 75 for key in CLASSES)
            and all(finite(holdout.get("calibration", {}).get(key)) and holdout["calibration"][key] <= 0.05 for key in CLASSES)
            and finite(lower) and lower > 0 and holdout.get("pValue", 1) <= 0.05 / 8
            and holdout.get("brier", math.inf) < holdout.get("baselineBrier", -math.inf)
            and holdout.get("logLoss", math.inf) <= holdout.get("baselineLogLoss", -math.inf))
    if report.get("profile") == "price_macro_v1":
        comparison = holdout.get("priceOnly", {})
        lower = comparison.get("brierImprovementCI95", [None])[0]
        passed = (passed and finite(lower) and lower > 0 and comparison.get("pValue", 1) <= 0.05 / 8
                  and holdout.get("brier", math.inf) < comparison.get("brier", -math.inf)
                  and holdout.get("logLoss", math.inf) <= comparison.get("logLoss", -math.inf))
    return passed


def select_interval(rows, start, end):
    # Every outcome must be resolved before the next segment begins.
    return [row for row in rows if start <= row["_cutoff"] < end and row["_end"] < end
            and (not row.get("resolvedAt") or stamp(row["resolvedAt"]) < end)]


def fit_model(train, cal, pair, c_value):
    import numpy as np
    from scipy.optimize import minimize_scalar
    from sklearn.linear_model import LogisticRegression
    from sklearn.preprocessing import StandardScaler
    from threadpoolctl import threadpool_limits
    if set(row["outcome"] for row in train) != set(CLASSES):
        raise ValueError("All three classes are required in every training segment")
    if not cal:
        raise ValueError("Empty calibration segment")
    x = np.asarray([row["features"] for row in train], dtype=float)
    scaler = StandardScaler().fit(x)
    classifier = LogisticRegression(C=c_value, penalty="l2", solver="lbfgs", max_iter=3000, tol=1e-9, random_state=77123)
    with threadpool_limits(limits=1):
        classifier.fit(scaler.transform(x), [row["outcome"] for row in train])
    if int(classifier.n_iter_.max()) >= 3000:
        raise ValueError("Optimizer did not converge; do not distribute this candidate")
    order = [list(classifier.classes_).index(key) for key in CLASSES]
    feature_order = MACRO_FEATURES if len(train[0]["features"]) == 10 else FEATURES
    if len(train[0]["features"]) not in (7, 10):
        raise ValueError("Unsupported feature profile")
    artifact = {"version": "pending", "pair": pair, "classes": list(CLASSES), "features": list(feature_order),
                "sources": [SOURCE] + (["macro_pit_v1"] if len(feature_order) == 10 else []),
                "mean": scaler.mean_.tolist(), "scale": scaler.scale_.tolist(),
                "coefficients": classifier.coef_[order].tolist(), "intercepts": classifier.intercept_[order].tolist(),
                "temperature": 1.0,
                "trainedThrough": iso(max(max(row["_end"], stamp(row["resolvedAt"]) if row.get("resolvedAt") else row["_end"])
                                          for row in train + cal)),
                "baseline": dict(zip(CLASSES, class_frequencies(train)))}
    cal_x = scaler.transform(np.asarray([row["features"] for row in cal], dtype=float))
    logits = classifier.decision_function(cal_x)[:, order]
    labels = [CLASSES.index(row["outcome"]) for row in cal]
    def objective(log_temperature):
        temperature = math.exp(log_temperature)
        return statistics.mean(-math.log(max(1e-12, softmax(values.tolist(), temperature)[label])) for values, label in zip(logits, labels))
    optimized = minimize_scalar(objective, bounds=(math.log(0.25), math.log(4.0)), method="bounded", options={"xatol": 1e-8})
    if not optimized.success or not finite(float(optimized.fun)):
        raise ValueError("Temperature calibration failed")
    artifact["temperature"] = float(math.exp(optimized.x))
    return artifact, classifier, scaler


def choose_c(train, pair):
    # Inner validation lives inside the training interval, never cal/test/holdout.
    split = months_before(train[-1]["_end"], 3)
    fitting = [row for row in train if row["_end"] < split and (not row.get("resolvedAt") or stamp(row["resolvedAt"]) < split)]
    validation = [row for row in train if row["_cutoff"] >= split]
    if len(fitting) < 300 or len(validation) < 100:
        raise ValueError("Insufficient inner temporal validation for regularization selection")
    scored = []
    for c_value in (0.01, 0.1, 1.0, 10.0, 100.0):
        candidate, _, _ = fit_model(fitting, validation, pair, c_value)
        # This inner fit has a disjoint calibration block, not the final calibration.
        score = statistics.mean(log_loss(infer(candidate, row["features"]), row["outcome"]) for row in validation)
        scored.append((score, c_value))
    return min(scored)[1], [{"C": c_value, "logLoss": score} for score, c_value in scored]


def train_pair(rows, pair, dataset_hash, provenance, created_at):
    rows = sorted(rows, key=lambda row: row["_cutoff"])
    if not rows:
        raise ValueError("No resolved observations for {}".format(pair))
    end = rows[-1]["_end"]
    macro = len(rows[0]["features"]) == 10
    def price_rows(values):
        return [dict(row, features=row["features"][:7]) for row in values]
    # Six calendar months can be 181 days. A 185-day floor keeps the separately
    # preregistered 183-day observed-span gate achievable after endpoint purging.
    holdout_start = min(months_before(end, 6), end - timedelta(days=185))
    first_test_start = months_before(rows[0]["_cutoff"], -27)
    walk_forward = []
    test_start = first_test_start
    while months_before(test_start, -3) <= holdout_start:
        cal_start = months_before(test_start, 3)
        train_start = months_before(cal_start, 24)
        test_end = months_before(test_start, -3)
        training = select_interval(rows, train_start, cal_start)
        cal = select_interval(rows, cal_start, test_start)
        test = select_interval(rows, test_start, test_end)
        if len(training) < 1000 or len(cal) < 100 or len(test) < 100:
            raise ValueError("Incomplete train24/cal3/test3 walk-forward window for {}".format(pair))
        c_value, inner = choose_c(training, pair)
        artifact, _, _ = fit_model(training, cal, pair, c_value)
        probabilities = [infer(artifact, row["features"]) for row in test]
        window = metrics(test, probabilities, class_frequencies(training))
        if macro:
            price_train, price_cal, price_test = price_rows(training), price_rows(cal), price_rows(test)
            price_c, _ = choose_c(price_train, pair)
            price_artifact, _, _ = fit_model(price_train, price_cal, pair, price_c)
            window["priceOnly"] = price_only_comparison(test, probabilities, [infer(price_artifact, row["features"]) for row in price_test])
        window.update({"trainStart": iso(train_start), "trainEnd": iso(cal_start), "calibrationStart": iso(cal_start),
                       "calibrationEnd": iso(test_start), "testStart": iso(test_start), "testEnd": iso(test_end),
                       "trainSamples": len(training), "calibrationSamples": len(cal), "C": c_value, "innerValidation": inner})
        walk_forward.append(window)
        test_start = test_end
    if len(walk_forward) < 2:
        raise ValueError("At least two full walk-forward test windows before the untouched holdout are required")
    cal_start = months_before(holdout_start, 3)
    train_start = months_before(cal_start, 24)
    training = select_interval(rows, train_start, cal_start)
    cal = select_interval(rows, cal_start, holdout_start)
    holdout = select_interval(rows, holdout_start, end)
    if len(training) < 1000 or len(cal) < 100 or len(holdout) < 500:
        raise ValueError("Insufficient final training, calibration, or 500-observation holdout")
    c_value, inner = choose_c(training, pair)
    artifact, classifier, scaler = fit_model(training, cal, pair, c_value)
    artifact["version"] = "directional-{}-l2-v1-{}-{}".format("macro" if macro else "price", pair, dataset_hash[:12])
    probabilities = [infer(artifact, row["features"]) for row in holdout]
    holdout_metrics = metrics(holdout, probabilities, class_frequencies(training))
    if macro:
        price_train, price_cal, price_holdout = price_rows(training), price_rows(cal), price_rows(holdout)
        price_c, _ = choose_c(price_train, pair)
        price_artifact, _, _ = fit_model(price_train, price_cal, pair, price_c)
        price_artifact["version"] = "price-only-reference-" + artifact["version"]
        artifact["priceOnlyModel"] = price_artifact
        holdout_metrics["priceOnly"] = price_only_comparison(holdout, probabilities, [infer(price_artifact, row["features"]) for row in price_holdout])
    report = {"schema": "directional-validation-v1", "pair": pair, "classes": list(CLASSES), "featureOrder": artifact["features"],
              "profile": "price_macro_v1" if macro else "price_only_v1",
              "datasetHash": dataset_hash, "provenance": provenance, "createdAt": created_at, "splitPolicy": SPLIT_POLICY,
              "walkForward": walk_forward, "holdout": holdout_metrics, "holdoutStart": iso(holdout_start), "holdoutEnd": iso(end),
              "trainStart": iso(train_start), "trainEnd": iso(cal_start), "calibrationStart": iso(cal_start),
              "calibrationEnd": iso(holdout_start), "C": c_value, "innerValidation": inner,
              "method": "scikit-learn multinomial logistic L2; standard scaler train-only; temperature calibration-only",
              "logLossNoninferiorityMargin": 0.0,
              "multiplicity": "Bonferroni .05/8 conservative substitute for Holm until the full eight-pair family is available",
              "availability": "historical-research is not proof of intraday point-in-time collection",
              "deployment": "candidate-only; runtime also requires trusted artifact/report hashes and prospective validation"}
    if macro:
        comparison = holdout_metrics["priceOnly"]
        # Same ReportMetric shape as holdout, with the price-only reference in
        # the baseline fields. The nested diagnostic keeps price-model scores.
        report["priceOnly"] = dict(holdout_metrics, baselineBrier=comparison["brier"], baselineLogLoss=comparison["logLoss"],
                                   pValue=comparison["pValue"], weeklyBlocks=comparison["weeklyBlocks"],
                                   brierImprovementCI95=comparison["brierImprovementCI95"], comparison="price-only-reference")
        report["priceOnly"].pop("priceOnly", None)
    report["passed"] = statistical_pass(report)
    # Compare the exported inference with scikit logits, after explicit class reordering.
    import numpy as np
    order = [list(classifier.classes_).index(key) for key in CLASSES]
    vectors = []
    for index in sorted(set((0, len(holdout) // 3, len(holdout) // 2, len(holdout) - 1))):
        feature = holdout[index]["features"]
        logits = classifier.decision_function(scaler.transform(np.asarray([feature])))[0][order].tolist()
        expected = softmax(logits, artifact["temperature"])
        if max(abs(left - right) for left, right in zip(expected, infer(artifact, feature))) > 1e-12:
            raise ValueError("Exported inference disagrees with scikit-learn")
        vectors.append({"features": feature, "probabilities": dict(zip(CLASSES, expected))})
    return artifact, report, vectors


def train(args):
    metadata, rows, rejected = load_dataset(args.input)
    if not metadata or not rows:
        raise ValueError("No resolved dataset")
    macro_metadata = None
    if args.macro_input:
        rows, macro_metadata = merge_macro(rows, args.macro_input, metadata["provenance"])
    selected = args.pairs.split(",")
    if not set(selected).issubset(PAIRS):
        raise ValueError("Unsupported pair")
    price_bytes = Path(args.input).read_bytes()
    dataset_hash = sha_bytes(price_bytes + (b"\0" + Path(args.macro_input).read_bytes() if args.macro_input else b""))
    created_at = iso(stamp(args.created_at)) if args.created_at else iso(datetime.now(UTC))
    output = Path(args.output)
    output.mkdir(parents=True, exist_ok=True)
    results, failures = [], []
    for pair in selected:
        try:
            artifact, report, vectors = train_pair([row for row in rows if row["pair"] == pair], pair, dataset_hash,
                                                   metadata["provenance"], created_at)
            report["datasetRejected"] = rejected
            report["datasetSourceHashes"] = {"price": sha_bytes(price_bytes)}
            if macro_metadata:
                report["macroDataset"] = macro_metadata
                report["datasetSourceHashes"]["macro"] = macro_metadata["macroDatasetHash"]
            report_hash = write_json(output / (pair + ".validation.json"), report)
            artifact["historicalValidation"] = {"passed": report["passed"], "datasetHash": dataset_hash,
                                                 "reportHash": report_hash,
                                                 "provenance": metadata["provenance"] if metadata["provenance"] == "prospective" else "historical_research"}
            if "priceOnlyModel" in artifact:
                artifact["priceOnlyModel"]["historicalValidation"] = dict(artifact["historicalValidation"], passed=False)
            # Synthetic runs remain recognizable and can never satisfy provenance.
            if metadata["provenance"] == "synthetic":
                artifact["historicalValidation"]["passed"] = False
                artifact["version"] = "synthetic-" + artifact["version"]
            model_hash = write_json(output / (pair + ".json"), artifact)
            write_json(output / (pair + ".parity.json"), {"schema": "directional-parity-v1", "modelSha256": model_hash,
                        "classes": list(CLASSES), "featureOrder": artifact["features"], "vectors": vectors})
            result = {"pair": pair, "modelSha256": model_hash, "reportSha256": report_hash,
                      "historicalGatePassed": report["passed"], "provenance": metadata["provenance"],
                      "liveApproved": False, "holdoutSamples": report["holdout"]["samples"]}
            results.append(result)
        except ValueError as error:
            failures.append({"pair": pair, "error": str(error)})
    summary = {"schema": "directional-training-run-v1", "datasetHash": dataset_hash, "createdAt": created_at,
               "results": results, "failures": failures, "liveApproved": False}
    write_json(output / "training-run.json", summary)
    print(json.dumps(summary, sort_keys=True))
    if failures:
        raise ValueError("Some pairs could not produce a research candidate; see training-run.json")


def calendar_review(args):
    """Assemble reviewed exception input; no guessed holidays or silent approval."""
    raw = Path(args.exceptions).read_bytes()
    if sha_bytes(raw) != args.exceptions_sha256:
        raise ValueError("Official exception input does not match its explicitly reviewed hash")
    evidence = json.loads(raw)
    urls = evidence.get("sourceUrls", [])
    if not any(str(url).startswith("https://www.dukascopy.com/") for url in urls):
        raise ValueError("Reviewed exception evidence must cite the Dukascopy source")
    start, end = stamp(args.start), stamp(args.end)
    if start >= end:
        raise ValueError("Calendar end must follow start")
    if not evidence.get("reviewedAt") or stamp(evidence["reviewedAt"]) > datetime.now(UTC):
        raise ValueError("Exception evidence needs its real review timestamp")
    if stamp(evidence["verifiedFrom"]) > start or stamp(evidence["verifiedUntil"]) < end:
        raise ValueError("Exception evidence does not cover the requested calendar range")
    intervals = evidence.get("closedIntervals")
    if not isinstance(intervals, list):
        raise ValueError("Expected reviewed closedIntervals, including holidays and source-specific closures")
    for item in intervals:
        if item.get("pair") not in PAIRS + ("*",) or stamp(item["start"]) >= stamp(item["end"]):
            raise ValueError("Invalid reviewed closure")
    manifest = {"verifiedFrom": iso(start), "verifiedUntil": iso(end), "sourceUrls": urls,
                "closedIntervals": [item for item in intervals if stamp(item["start"]) < end and stamp(item["end"]) > start],
                "reviewedAt": evidence["reviewedAt"], "exceptionEvidenceHash": args.exceptions_sha256,
                "sessionTimezone": "America/New_York", "policy": "Dukascopy weekly Sun17-Fri17 NY; XAU daily17-18 NY; reviewed exceptions required"}
    digest = write_json(Path(args.output), manifest)
    print(json.dumps({"calendarSha256": digest, "output": args.output, "reviewed": True}))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)
    build = sub.add_parser("build-dataset", help="stream verified Dukascopy bid M1 into resolved research JSONL")
    build.add_argument("--input", required=True)
    build.add_argument("--output", required=True)
    build.add_argument("--calendar", required=True)
    build.add_argument("--calendar-sha256", required=True)
    build.add_argument("--pairs", default=",".join(PAIRS))
    build.add_argument("--provenance", choices=("historical_research", "synthetic"), default="historical_research")
    build.set_defaults(handler=build_dataset)
    fit = sub.add_parser("train", help="fit offline L2 candidates with purged temporal validation")
    fit.add_argument("--input", required=True)
    fit.add_argument("--output", required=True)
    fit.add_argument("--pairs", default=",".join(PAIRS))
    fit.add_argument("--created-at", help="UTC timestamp to make research reports byte-for-byte reproducible")
    fit.add_argument("--macro-input", help="covered prospective macro JSONL; trains price_macro_v1 and evaluates the same-cohort price-only reference")
    fit.set_defaults(handler=train)
    cal = sub.add_parser("calendar-review", help="build a hash-pinned calendar from reviewed official exception evidence")
    for key in ("exceptions", "exceptions-sha256", "start", "end", "output"):
        cal.add_argument("--" + key, required=True)
    cal.set_defaults(handler=calendar_review)
    args = parser.parse_args()
    try:
        args.handler(args)
    except (ValueError, KeyError, OSError, ImportError) as error:
        parser.exit(2, "directional research: {}\n".format(error))


if __name__ == "__main__":
    main()
