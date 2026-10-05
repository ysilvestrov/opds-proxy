"""Offline production operator guards: secrets, effective privileges and recovery."""
import importlib.util
import fcntl
import os
from pathlib import Path
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]


def helper():
    path = ROOT / 'scripts/production-rollout.py'
    spec = importlib.util.spec_from_file_location('rollout', path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class ProductionRolloutTests(unittest.TestCase):
    def test_private_environment_round_trip_has_no_shell_interpolation(self):
        module = helper()
        values = {'OPDS_USERNAME': 'fixture', 'OPDS_PASSWORD': 'quote" $literal # \\ кирилиця'}
        self.assertEqual(module.verifier.parse_systemd_env(module.encode_env(values).decode()), values)
        with self.assertRaises(ValueError):
            module.encode_env({'OPDS_PASSWORD': 'unsafe\nline'})

    def test_proxy_rejects_placeholder_and_non_origin_urls(self):
        module = helper()
        module.validate_proxy('http://fixture:secret@proxy.invalid:8080')
        for value in ['', 'http://REPLACE:password@proxy.invalid', 'ftp://proxy.invalid', 'http://proxy.invalid/path', 'http://proxy.invalid?query=x']:
            with self.assertRaises(ValueError):
                module.validate_proxy(value)

    def test_effective_privileges_reject_broad_or_extra_commands(self):
        module = helper()
        exact = '(root) NOPASSWD: ' + ', '.join('/usr/local/sbin/searchfloor-opds-control ' + action for action in ['restart', 'stop', 'reset-cache'])
        module.validate_privileges(exact)
        for invalid in ['(ALL) NOPASSWD: ALL', exact + ', /bin/bash', exact.replace('(root)', '(ALL)')]:
            with self.assertRaises(ValueError):
                module.validate_privileges(invalid)

    def test_pending_or_settled_production_never_restores_prototype(self):
        module = helper()
        self.assertEqual(module.recovery_action({'phase':'activating','settledSHA':None}), 'preserve-pending')
        self.assertEqual(module.recovery_action({'phase':'rollback','settledSHA':None}), 'preserve-pending')
        self.assertEqual(module.recovery_action({'phase':'idle','settledSHA':'a'*40}), 'preserve-production')
        self.assertEqual(module.recovery_action({'phase':'idle','settledSHA':None}), 'restore-prototype-after-stop')

    def test_lock_contention_holds_real_fixed_lock_during_unit_attempt(self):
        module = helper()
        with tempfile.TemporaryDirectory() as directory:
            module.LOCK = Path(directory)/'lock'
            module.LOCK.touch()
            module.state = lambda: {'phase':'idle','settledSHA':'a'*40}
            module.show = lambda *args: {'MainPID':'fixture','NRestarts':'0'}
            calls = []
            def denied(args, **kwargs):
                self.assertEqual(args, ['/usr/bin/systemctl','start',module.DEPLOY])
                with module.LOCK.open('r+') as competing:
                    with self.assertRaises(BlockingIOError):
                        fcntl.flock(competing.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
                return SimpleNamespace(returncode=1)
            module.run = denied
            module.control = lambda action, unit: calls.append((action, unit))
            module.emit = lambda *args, **kwargs: None
            with patch.object(module.pwd, 'getpwnam', return_value=SimpleNamespace(pw_uid=os.getuid())):
                module.lock_check()
            self.assertEqual(calls, [('reset-failed',module.DEPLOY)])
            with module.LOCK.open('r+') as competing:
                fcntl.flock(competing.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)


if __name__ == '__main__':
    unittest.main()
