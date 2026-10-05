"""Offline integrity guard tests for the manual immutable-code staging helper."""
import os
from pathlib import Path
import pty
import subprocess
import tempfile
import unittest
from unittest.mock import patch
from types import SimpleNamespace

ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / 'deploy/stage-proxy-prototype.sh'


class ProxyStageTests(unittest.TestCase):
    def test_reviewed_deploy_owned_parent_is_accepted_but_writable_parent_refused(self):
        source = SCRIPT.read_text()
        start = source.index('\n', source.index("<<'PY'")) + 1
        scope = {'__name__': 'offline_test'}
        exec(compile(source[start:source.index('\nPY\n', start)], str(SCRIPT), 'exec'), scope)
        for mode in [0o40755, 0o40777]:
            with patch('pathlib.Path.lstat', return_value=SimpleNamespace(st_uid=993, st_gid=984, st_mode=mode)), patch('pathlib.Path.is_dir', return_value=True), patch('pathlib.Path.is_symlink', return_value=False):
                if mode == 0o40755:
                    scope['validate_parent'](Path('/opt/searchfloor-opds'), (0, 993))
                else:
                    with self.assertRaises(ValueError):
                        scope['validate_parent'](Path('/opt/searchfloor-opds'), (0, 993))

    def test_parent_guard_reports_actual_owner_without_weakening_check(self):
        source = SCRIPT.read_text()
        start = source.index('\n', source.index("<<'PY'")) + 1
        scope = {'__name__': 'offline_test'}
        exec(compile(source[start:source.index('\nPY\n', start)], str(SCRIPT), 'exec'), scope)
        with patch('pathlib.Path.lstat', return_value=SimpleNamespace(st_uid=1000, st_gid=1000, st_mode=0o40755)), patch('pathlib.Path.is_dir', return_value=True), patch('pathlib.Path.is_symlink', return_value=False):
            with self.assertRaises(ValueError) as caught:
                scope['validate_parent'](Path('/opt'))
        self.assertEqual(caught.exception.details['uid'], 1000)
        self.assertEqual(caught.exception.details['path'], '/opt')

    def test_bad_digest_prevents_artifact_processing(self):
        self.assertTrue(SCRIPT.exists(), 'Operator staging helper is missing')
        source = SCRIPT.read_text()
        start = source.index('\n', source.index("<<'PY'")) + 1
        code = source[start:source.index('\nPY\n', start)]
        scope = {'__name__': 'offline_test'}
        exec(compile(code, str(SCRIPT), 'exec'), scope)
        with tempfile.TemporaryDirectory() as tmp:
            artifact = Path(tmp) / 'artifact.zip'
            artifact.write_bytes(b'untrusted archive')
            with self.assertRaises(ValueError):
                scope['verify_digest'](artifact, '0'*64)
            self.assertEqual(list(Path(tmp).iterdir()), [artifact])

    def test_bare_filename_refuses_active_units_before_privilege(self):
        self.assertTrue(SCRIPT.exists(), 'Operator staging helper is missing')
        with tempfile.TemporaryDirectory() as tmp:
            command = Path(tmp) / 'systemctl'
            command.write_text('#!/bin/sh\necho active\n')
            command.chmod(0o755)
            master, slave = pty.openpty()
            try:
                result = subprocess.run(['bash', SCRIPT.name], cwd=SCRIPT.parent,
                                        env=dict(os.environ, PATH=f'{tmp}:/usr/bin:/bin'),
                                        stdin=slave, stdout=slave, stderr=subprocess.PIPE, text=True)
            finally:
                os.close(master); os.close(slave)
            self.assertNotEqual(result.returncode, 0)
            self.assertIn('must be inactive', result.stderr)


if __name__ == '__main__':
    unittest.main()
