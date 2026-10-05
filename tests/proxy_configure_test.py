"""Offline tests for private operator configuration; never touch real /etc."""
from pathlib import Path
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
