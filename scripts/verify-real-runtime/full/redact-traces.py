"""Remove structured and recognizable session material from retained traces."""
import json
import os
from pathlib import Path
import re
import stat
import sys
import tempfile
import zipfile


JWT = re.compile(rb"[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}")
KEY = re.compile(rb"(?:sk_(?:test|live)_|whsec_)[A-Za-z0-9_-]+")
SID = re.compile(rb"(?i)(?<![a-f0-9])[a-f0-9]{64}(?![a-f0-9])")
SECRET_FIELDS = {
    "password", "accesstoken", "refreshtoken", "bridgetoken", "pairingtoken",
    "clientsecret", "authorization", "auth",
}
# RFC 7518 private parameters, including multi-prime RSA and symmetric JWKs.
# Preserve public coordinates and modulus so retained evidence remains useful.
PRIVATE_JWK_FIELDS = {
    "EC": {"d"}, "OKP": {"d"},
    "RSA": {"d", "p", "q", "dp", "dq", "qi", "oth"},
    "oct": {"k"},
}


def redact_json(value):
    if isinstance(value, dict):
        private_fields = PRIVATE_JWK_FIELDS.get(value.get("kty"), set()) if isinstance(value.get("kty"), str) else set()
        redacted = {}
        for field, item in value.items():
            if field.lower() == "privatekeyjwk" or field in private_fields:
                redacted[field] = "[REDACTED_PRIVATE_KEY]"
            elif field.lower() in SECRET_FIELDS and isinstance(item, str):
                redacted[field] = "[REDACTED_SECRET]"
            else:
                redacted[field] = redact_json(item)
        return redacted
    if isinstance(value, list):
        return [redact_json(item) for item in value]
    if isinstance(value, str) and value.lstrip().startswith(("{", "[")):
        try:
            parsed = json.loads(value)
            redacted = redact_json(parsed)
            return json.dumps(redacted, separators=(",", ":")) if redacted != parsed else value
        except (ValueError, TypeError):
            pass
    return value


def redact_structured(text):
    # Extensionless network resources may contain pretty-printed JSON. Parse
    # the complete member first; JSONL action streams require a separate path.
    try:
        parsed = json.loads(text)
    except (ValueError, TypeError):
        pass
    else:
        redacted = redact_json(parsed)
        if redacted != parsed:
            return json.dumps(redacted, separators=(",", ":")) + ("\n" if text.endswith("\n") else ""), 1
        return text, 0

    lines = []
    count = 0
    for line in text.splitlines(keepends=True):
        try:
            parsed = json.loads(line)
            redacted = redact_json(parsed)
            if parsed != redacted:
                count += 1
                line = json.dumps(redacted, separators=(",", ":")) + ("\n" if line.endswith("\n") else "")
        except (ValueError, TypeError):
            pass
        lines.append(line)
    return "".join(lines), count


def redact_member(data):
    # Binary screenshots and payloads must retain their original bytes.
    try:
        data.decode("utf-8")
    except UnicodeDecodeError:
        return data, 0
    count = 0
    for pattern, replacement in (
        (JWT, b"[REDACTED_SESSION]"),
        (KEY, b"[REDACTED_SECRET]"),
        # SIDs are random 32-byte hex strings. Conservatively mask matching
        # hashes too, including standalone evaluate arguments and cookies.
        (SID, b"[REDACTED_SESSION_ID]"),
    ):
        data, changed = pattern.subn(replacement, data)
        count += changed
    text, changed = redact_structured(data.decode("utf-8"))
    return text.encode("utf-8"), count + changed


def redact_archive(path):
    # A unique, private temporary file prevents concurrent-run collisions and
    # avoids exposing the intermediate ZIP. Preserve the input permissions.
    permissions = stat.S_IMODE(path.stat().st_mode)
    descriptor, temporary_name = tempfile.mkstemp(prefix=f".{path.name}.", suffix=".redacted.zip", dir=path.parent)
    os.close(descriptor)
    temporary = Path(temporary_name)
    count = 0
    try:
        with zipfile.ZipFile(path) as source, zipfile.ZipFile(temporary, "w", zipfile.ZIP_DEFLATED) as destination:
            for item in source.infolist():
                data, changed = redact_member(source.read(item))
                count += changed
                destination.writestr(item, data)
        temporary.chmod(permissions)
        os.replace(temporary, path)
    finally:
        temporary.unlink(missing_ok=True)
    return count


if __name__ == "__main__":
    for raw in sys.argv[1:]:
        path = Path(raw)
        print(path.name, "redacted", redact_archive(path), "session/secret transformations")
