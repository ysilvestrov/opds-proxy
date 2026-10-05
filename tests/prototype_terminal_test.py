"""The operator runner must refuse collisions before network or sudo actions."""
import os
import json
from pathlib import Path
import subprocess
import tempfile
import unittest
import contextlib
import io
from unittest.mock import patch

SCRIPT = Path(__file__).resolve().parents[1] / "deploy/start-prototype.sh"


class TerminalSafetyTests(unittest.TestCase):
    def test_success_summary_does_not_persist_search_queries(self):
        source = SCRIPT.read_text()
        start = source.index('\n', source.index("sudo /usr/bin/python3 - <<'PY' |")) + 1
        code = source[start:source.index('\nPY\n', start)]
        def fetch(argv, **kwargs):
            url = argv[argv.index('--url') + 1]
            if url.endswith('/health'):
                status, mime, body = 200, 'application/json', json.dumps({'ready': True, 'sha': '16cc521448bbb792aa74594cf7c1c1def5ae16f9'})
            elif not kwargs.get('input'):
                status, mime, body = 401, 'text/plain', 'Unauthorized'
            else:
                status, mime, body = 200, 'application/opensearchdescription+xml' if url.endswith('opensearch.xml') else 'application/atom+xml', '<feed/>'
            raw = f'HTTP/1.1 {status}\r\nContent-Type: {mime}\r\nWWW-Authenticate: Basic\r\n\r\n{body}'.encode()
            return subprocess.CompletedProcess(argv, 0, raw, b'')
        output = io.StringIO()
        with patch('pathlib.Path.read_text', return_value='OPDS_USERNAME=fixture-user\nOPDS_PASSWORD=fixture-password\n'), patch('subprocess.run', side_effect=fetch), contextlib.redirect_stdout(output):
            exec(compile(code, str(SCRIPT), 'exec'), {})
        self.assertNotIn('?q=', output.getvalue())
        self.assertNotIn('?page=', output.getvalue())
        self.assertNotIn('fixture-password', output.getvalue())

    def test_live_failure_preserves_http_evidence_without_credentials(self):
        # Execute the real embedded verifier; replace only privileged config I/O
        # and network transport. Earlier checks must survive a live source 503.
        source = SCRIPT.read_text()
        marker = "sudo /usr/bin/python3 - <<'PY' |"
        start = source.index('\n', source.index(marker)) + 1
        end = source.index('\nPY\n', start)
        code = source[start:end]
        sha = '16cc521448bbb792aa74594cf7c1c1def5ae16f9'
        config = 'OPDS_USERNAME=fixture-user\nOPDS_PASSWORD=fixture-password\n'
        def fetch(argv, **kwargs):
            url = argv[argv.index('--url') + 1]
            authenticated = bool(kwargs.get('input'))
            if url.endswith('/health'):
                status, mime, body = 200, 'application/json', json.dumps({'ready': True, 'sha': sha})
            elif not authenticated:
                status, mime, body = 401, 'text/plain', 'Unauthorized'
            elif '/completed?' in url:
                status, mime, body = 503, 'text/plain', 'Source unavailable'
            elif url.endswith('opensearch.xml'):
                status, mime, body = 200, 'application/opensearchdescription+xml', '<OpenSearchDescription/>'
            else:
                status, mime, body = 200, 'application/atom+xml', '<feed/>'
            raw = f'HTTP/1.1 {status}\r\nContent-Type: {mime}\r\nWWW-Authenticate: Basic realm="OPDS"\r\n\r\n{body}'.encode()
            return subprocess.CompletedProcess(argv, 0, raw, b'')
        output = io.StringIO()
        with patch('pathlib.Path.read_text', return_value=config), patch('subprocess.run', side_effect=fetch), contextlib.redirect_stdout(output):
            with self.assertRaisesRegex(AssertionError, 'Live catalog failed: HTTP 503'):
                exec(compile(code, str(SCRIPT), 'exec'), {})
        rows = [json.loads(line) for line in output.getvalue().splitlines()]
        self.assertEqual(len(rows), 20)  # health + 12 Basic + 6 XML + failed live request
        self.assertEqual(rows[-1]['status'], 503)
        self.assertEqual(rows[-1]['path'], '/opds/searchfloor/completed')
        self.assertNotIn('fixture-password', output.getvalue())
        self.assertNotIn('fixture-user', output.getvalue())

    def test_help_is_available_without_privileges(self):
        result = subprocess.run(["bash", str(SCRIPT), "--help"], capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("--apply", result.stdout)

    def test_collisions_stop_before_network_or_sudo(self):
        cases = [
            ("searchfloor-opds.service", "active", "disabled", False),
            ("searchfloor-opds-deploy.service", "activating", "disabled", False),
            ("searchfloor-opds-deploy.timer", "inactive", "enabled", False),
            ("searchfloor-opds-prototype.service", "active", "disabled", False),
            ("", "inactive", "disabled", True),
        ]
        for unit, state, enabled, busy_port in cases:
            with self.subTest(unit=unit, busy_port=busy_port), tempfile.TemporaryDirectory() as tmp:
                root = Path(tmp)
                marker = root / "forbidden"
                scripts = {
                    "systemctl": '#!/bin/bash\nif [[ "$*" == *UnitFileState* ]]; then echo "$TEST_ENABLED"; elif [[ "$*" == *"$TEST_UNIT"* && -n "$TEST_UNIT" ]]; then echo "$TEST_STATE"; else echo inactive; fi\n',
                    "ss": '#!/bin/bash\necho "State Recv-Q Send-Q Local Address:Port Peer Address:Port"\nif [[ "$TEST_BUSY" == yes ]]; then echo "LISTEN 0 10 127.0.0.1:8787 0.0.0.0:*"; fi\n',
                    "sudo": f'#!/bin/bash\ntouch "{marker}"\nexit 99\n',
                    "gh": f'#!/bin/bash\ntouch "{marker}"\nexit 99\n',
                    "curl": f'#!/bin/bash\ntouch "{marker}"\nexit 99\n',
                }
                for name, source in scripts.items():
                    path = root / name
                    path.write_text(source)
                    path.chmod(0o755)
                env = dict(os.environ, PATH=f"{root}:/usr/bin:/bin", TEST_UNIT=unit,
                           TEST_STATE=state, TEST_ENABLED=enabled,
                           TEST_BUSY="yes" if busy_port else "no")
                result = subprocess.run(["bash", str(SCRIPT), "--check"], env=env,
                                        capture_output=True, text=True)
                self.assertNotEqual(result.returncode, 0)
                self.assertIn("STOP:", result.stderr)
                self.assertFalse(marker.exists(), "A collision reached a privileged/network action")


if __name__ == "__main__":
    unittest.main()
