"""Offline curl transcripts must distinguish proxy CONNECT from source status."""
import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest
import importlib.util
import contextlib
import io

ROOT = Path(__file__).resolve().parents[1]


class CurlDiagnosticTests(unittest.TestCase):
    def test_multiple_connect_preambles_do_not_hide_source_denial(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            body = b'<title>Just a moment</title>'
            transcript = (b'HTTP/1.1 200 Connection established\r\n\r\n'
                          b'HTTP/1.0 200 Connection established\r\nProxy-Agent: fixture\r\n\r\n'
                          b'HTTP/2 403\r\nserver: cloudflare\r\ncf-mitigated: challenge\r\n\r\n' + body)
            (root / 'response').write_bytes(transcript)
            curl = root / 'curl'
            curl.write_text('#!/bin/sh\nif [ "$1" = "--version" ]; then echo "curl offline fixture"; else cat "'+str(root / 'response')+'"; fi\n')
            curl.chmod(0o755)
            env = dict(os.environ, PATH=f'{root}:/usr/bin:/bin')
            result = subprocess.run(['/usr/bin/python3', str(ROOT / 'scripts/diagnostics/source-python.py'), 'curl-h1-proxy'],
                                    env=env, capture_output=True, text=True, check=True)
            row = json.loads(result.stdout)
            self.assertEqual(row.get('status'), 403)
            self.assertEqual(row.get('protocol'), 'HTTP/2')
            self.assertEqual(row.get('headers', {}).get('cf-mitigated'), 'challenge')
            self.assertEqual(row.get('bytes'), len(body))
            self.assertTrue(row.get('challengeTitle'))

    def test_recorder_keeps_prior_rows_when_producer_fails(self):
        spec = importlib.util.spec_from_file_location('recorder', ROOT / 'scripts/diagnostics/record-jsonl.py')
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        def rows():
            yield '{"status":200}\n'
            yield '{"status":503}\n'
            raise RuntimeError('producer failed')
        with tempfile.TemporaryDirectory() as tmp, contextlib.redirect_stdout(io.StringIO()):
            output = Path(tmp) / 'evidence.jsonl'
            with self.assertRaisesRegex(RuntimeError, 'producer failed'):
                module.record(rows(), output)
            self.assertEqual([json.loads(x)['status'] for x in output.read_text().splitlines()], [200, 503])
            self.assertEqual(output.stat().st_mode & 0o777, 0o600)
            with self.assertRaises(FileExistsError):
                module.record(iter([]), output)


if __name__ == '__main__':
    unittest.main()
