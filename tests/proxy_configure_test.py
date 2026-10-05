"""Offline tests for private operator configuration; never touch real /etc."""
from pathlib import Path
import os
import pty
import select
import time
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / 'deploy/configure-prototype-proxy.sh'


def helpers():
    assert SCRIPT.exists(), 'Private proxy setup script is missing'
    source = SCRIPT.read_text()
    code = source.split("<<'PY'\n", 1)[1].split('\nPY\n', 1)[0]
    scope = {'__name__': 'offline_test', '__file__': str(SCRIPT)}
    exec(compile(code, str(SCRIPT), 'exec'), scope)
    return scope


class ProxyConfigurationTests(unittest.TestCase):
    def test_hidden_input_works_with_a_real_controlling_terminal(self):
        # A read/write text open of /dev/tty requires seeking and fails on Linux.
        code = SCRIPT.read_text().split("<<'PY'\n", 1)[1].split('\nPY\n', 1)[0]
        program = "scope={'__name__':'offline_test'}\nexec("+repr(code)+",scope)\nprint('MATCH', scope['read_proxy']() == 'http://fixture-secret@proxy.invalid')"
        pid, terminal = pty.fork()
        if pid == 0:
            os.chdir(ROOT)
            os.execv('/usr/bin/python3', ['python3', '-c', program])
        output = b''
        prompts = [b'Independent OPDS proxy URL (hidden): ', b'Repeat proxy URL (hidden): ']
        deadline = time.monotonic() + 5
        try:
            while b'MATCH True' not in output and time.monotonic() < deadline:
                if select.select([terminal], [], [], 0.1)[0]:
                    try: chunk = os.read(terminal, 4096)
                    except OSError: break
                    if not chunk: break
                    output += chunk
                    if prompts and prompts[0] in output:
                        prompts.pop(0)
                        os.write(terminal, b'http://fixture-secret@proxy.invalid\n')
            self.assertIn(b'MATCH True', output)
            self.assertNotIn(b'fixture-secret', output)
        finally:
            os.close(terminal)
            os.waitpid(pid, 0)

    def test_bare_filename_from_deploy_reaches_service_guard(self):
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
                os.close(slave)
                os.close(master)
            self.assertNotEqual(result.returncode, 0)
            self.assertIn('searchfloor-opds.service must be inactive', result.stderr)
            self.assertNotIn('Not a directory', result.stderr)

    def test_noninteractive_run_stops_before_sudo(self):
        result = subprocess.run(['bash', str(SCRIPT)], capture_output=True, text=True)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('private interactive terminal', result.stderr)

    def test_adds_only_proxy_and_preserves_existing_config(self):
        setup = helpers()
        original = '# private\nPUBLIC_BASE_URL=https://opds.example\nPORT=8787\nCACHE_PATH=/tmp/cache\nOPDS_USERNAME=reader\nOPDS_PASSWORD="keep\\$password"\n'
        proxy = 'http://fixture-user:fixture-password@proxy.invalid:8080/'
        updated = setup['with_proxy'](original, proxy)
        self.assertTrue(updated.startswith(original))
        parser = setup['parse_systemd_env']
        self.assertEqual(parser(updated)['OPDS_SOURCE_PROXY_URL'], proxy)
        for key, value in parser(original).items():
            self.assertEqual(parser(updated)[key], value)

    def test_invalid_proxy_or_existing_proxy_is_refused(self):
        setup = helpers()
        for proxy in ['socks5://proxy.invalid', 'http://proxy.invalid/path', 'http://proxy.invalid/?q=x', 'http://proxy.invalid/#x', 'http://user:password@', 'http://proxy.invalid\nPORT=9999']:
            with self.subTest(proxy=proxy), self.assertRaises(ValueError):
                setup['with_proxy']('OPDS_USERNAME=reader\n', proxy)
        with self.assertRaises(ValueError):
            setup['with_proxy']('OPDS_SOURCE_PROXY_URL=http://old.invalid\n', 'http://new.invalid')

    def test_atomic_save_retains_private_original_backup(self):
        setup = helpers()
        with tempfile.TemporaryDirectory() as tmp:
            env = Path(tmp) / 'prototype.env'
            original = 'OPDS_PASSWORD="do-not-change"\n'
            env.write_text(original)
            env.chmod(0o600)
            backup = setup['save_private'](env, original, original+'OPDS_SOURCE_PROXY_URL="http://fixture.invalid"\n')
            self.assertEqual(backup.read_text(), original)
            self.assertEqual(backup.stat().st_mode & 0o777, 0o600)
            self.assertEqual(env.stat().st_mode & 0o777, 0o600)
            self.assertIn('OPDS_SOURCE_PROXY_URL=', env.read_text())


if __name__ == '__main__':
    unittest.main()
