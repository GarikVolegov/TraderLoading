"""Synthetic-only regressions for the retained Playwright ZIP redactor."""
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
import zipfile


SCRIPT = Path(__file__).with_name("redact-traces.py")
EC = {"kty": "EC", "crv": "P-256", "x": "PUBLIC_X", "y": "PUBLIC_Y", "d": "PRIVATE_EC_D"}
RSA = {
    "kty": "RSA", "n": "PUBLIC_N", "e": "AQAB", "d": "PRIVATE_RSA_D",
    "p": "PRIVATE_RSA_P", "q": "PRIVATE_RSA_Q", "dp": "PRIVATE_RSA_DP",
    "dq": "PRIVATE_RSA_DQ", "qi": "PRIVATE_RSA_QI",
    "oth": [{"r": "PRIVATE_RSA_R", "d": "PRIVATE_RSA_OTHER_D", "t": "PRIVATE_RSA_T"}],
}
OKP = {"kty": "OKP", "crv": "X25519", "x": "PUBLIC_OKP_X", "d": "PRIVATE_OKP_D"}
OCT = {"kty": "oct", "k": "PRIVATE_OCT_K"}
JWT = "syntheticHeaderPart.syntheticPayloadPart.syntheticSignaturePart"
SID = "ab" * 32


class TraceRedactionTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="tl-redaction-synthetic-")
        self.addCleanup(self.temp.cleanup)
        self.archive = Path(self.temp.name) / "trace.zip"

    def redact(self, members):
        with zipfile.ZipFile(self.archive, "w", zipfile.ZIP_DEFLATED) as archive:
            for name, data in members.items():
                archive.writestr(name, data)
        self.archive.chmod(0o600)
        result = subprocess.run([sys.executable, str(SCRIPT), str(self.archive)], capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stderr)
        with zipfile.ZipFile(self.archive) as archive:
            return {name: archive.read(name) for name in archive.namelist()}

    def test_pretty_extensionless_json_redacts_ec_without_destroying_public_fields(self):
        result = self.redact({"resources/opaque-body": json.dumps({"key": EC}, indent=2)})
        key = json.loads(result["resources/opaque-body"])["key"]
        self.assertEqual(key["d"], "[REDACTED_PRIVATE_KEY]")
        self.assertEqual({field: key[field] for field in ("kty", "crv", "x", "y")},
                         {field: EC[field] for field in ("kty", "crv", "x", "y")})

    def test_all_rsa_private_parameters_and_other_primes_are_removed(self):
        result = self.redact({"resources/rsa": json.dumps(RSA)})
        key = json.loads(result["resources/rsa"])
        for field in ("d", "p", "q", "dp", "dq", "qi", "oth"):
            self.assertEqual(key[field], "[REDACTED_PRIVATE_KEY]", field)
        self.assertEqual(key["n"], "PUBLIC_N")
        self.assertEqual(key["e"], "AQAB")

    def test_nested_encoded_json_and_private_key_field(self):
        inner = json.dumps({"keys": [RSA, EC, OKP, OCT]}, indent=2)
        result = self.redact({"resources/nested": json.dumps({
            "response": {"body": inner}, "privateKeyJwk": EC,
            "accessToken": "OPAQUE_ACCESS_TOKEN", "clientSecret": "OPAQUE_CLIENT_SECRET",
        }, indent=2)})
        outer = json.loads(result["resources/nested"])
        self.assertEqual(outer["privateKeyJwk"], "[REDACTED_PRIVATE_KEY]")
        self.assertEqual(outer["accessToken"], "[REDACTED_SECRET]")
        self.assertEqual(outer["clientSecret"], "[REDACTED_SECRET]")
        keys = json.loads(outer["response"]["body"])["keys"]
        for key in keys:
            for sentinel in ("PRIVATE_RSA_", "PRIVATE_EC_D", "PRIVATE_OKP_D", "PRIVATE_OCT_K"):
                self.assertNotIn(sentinel, json.dumps(key))
        self.assertEqual(keys[-1]["k"], "[REDACTED_PRIVATE_KEY]")
        self.assertEqual(result, self.redact(result))

    def test_jsonl_sessions_and_credentials_are_redacted(self):
        lines = [
            {"event": "call", "args": {"session": JWT, "sid": SID}},
            {"event": "response", "privateKeyJwk": EC, "password": "SYNTHETIC_PASSWORD"},
            {"event": "credential", "key": "sk_test_SYNTHETIC_SECRET", "webhook": "whsec_SYNTHETIC_SECRET"},
        ]
        result = self.redact({"trace.trace": "\n".join(json.dumps(line) for line in lines) + "\n"})
        redacted = [json.loads(line) for line in result["trace.trace"].splitlines()]
        self.assertEqual(redacted[0]["args"], {"session": "[REDACTED_SESSION]", "sid": "[REDACTED_SESSION_ID]"})
        self.assertEqual(redacted[1]["password"], "[REDACTED_SECRET]")
        self.assertEqual(redacted[2]["key"], "[REDACTED_SECRET]")
        self.assertEqual(redacted[2]["webhook"], "[REDACTED_SECRET]")

    def test_binary_and_non_secret_text_are_preserved_and_second_pass_is_idempotent(self):
        original = {"resources/screenshot": b"\x89PNG\r\n\x1a\n\xff\x80", "resources/text": b"A harmless UTF-8 observation.\n"}
        first = self.redact(original)
        self.assertEqual(first, original)
        second = self.redact(first)
        self.assertEqual(first, second)
        self.assertEqual(self.archive.stat().st_mode & 0o777, 0o600)

    def test_invalid_zip_is_not_replaced_and_temporary_file_is_removed(self):
        original = b"This is a deliberately invalid synthetic ZIP."
        self.archive.write_bytes(original)
        result = subprocess.run([sys.executable, str(SCRIPT), str(self.archive)], capture_output=True, text=True)
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(self.archive.read_bytes(), original)
        self.assertEqual(list(Path(self.temp.name).glob("*.redacted.zip")), [])


if __name__ == "__main__":
    unittest.main()
