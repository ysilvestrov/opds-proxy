"""Offline production operator guards: secrets, effective privileges and recovery."""
import importlib.util
import fcntl
import os
import json
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
    def test_timer_schedules_initial_check_after_every_activation(self):
        timer = (ROOT/'deploy/searchfloor-opds-deploy.timer').read_text()
        self.assertIn('\nOnActiveSec=2min\n', timer)
        self.assertIn('\nOnUnitInactiveSec=5min\n', timer)
        self.assertNotIn('\nOnBootSec=', timer)

    def test_timer_repair_rejects_unknown_installed_drift_before_write(self):
        module = helper()
        with tempfile.TemporaryDirectory() as directory:
            target = Path(directory)/module.TIMER
            target.write_bytes(b'unreviewed drift')
            with patch.object(module, 'safe_file'), patch.object(module, 'atomic_file') as write:
                with self.assertRaises(ValueError):
                    module.repair_timer(target)
                write.assert_not_called()

    def test_timer_repair_backs_up_only_reviewed_timer_and_is_idempotent(self):
        module = helper()
        wanted = (ROOT/'deploy'/module.TIMER).read_bytes()
        old = wanted.replace(b'OnActiveSec=2min', b'OnBootSec=2min')
        with tempfile.TemporaryDirectory() as directory:
            module.ENV = Path(directory)/'private'
            module.ENV.mkdir()
            untouched = module.ENV/'runtime.env'
            untouched.write_bytes(b'fixture private config')
            target = Path(directory)/module.TIMER
            target.write_bytes(old)
            calls = []
            with patch.object(module, 'safe_file'), patch.object(module, 'emit'), patch.object(module, 'run', side_effect=lambda args: calls.append(args)):
                module.repair_timer(target)
                module.repair_timer(target)
            self.assertEqual(target.read_bytes(), wanted)
            self.assertEqual(untouched.read_bytes(), b'fixture private config')
            backups = list(module.ENV.glob('.timer-backup-*/'+module.TIMER))
            self.assertEqual(len(backups), 1)
            self.assertEqual(backups[0].read_bytes(), old)
            self.assertEqual(backups[0].stat().st_mode & 0o777, 0o600)
            self.assertEqual(target.stat().st_mode & 0o777, 0o644)
            self.assertEqual(calls, [['/usr/bin/systemd-analyze','verify',str(ROOT/'deploy'/module.TIMER)],
                                     ['/usr/bin/systemctl','daemon-reload']])

    def test_elapsed_timer_without_future_event_fails_without_waiting(self):
        module = helper()
        module.show = lambda *args: {'LastTriggerUSecMonotonic':'0','NextElapseUSecMonotonic':'infinity','SubState':'elapsed'}
        module.control = lambda *args: None
        module.run = lambda *args, **kwargs: None
        module.emit = lambda *args, **kwargs: None
        with patch.object(module.time, 'sleep') as sleep:
            with self.assertRaises(ValueError):
                module.timer_tick({'MainPID':'123','NRestarts':'0'})
        sleep.assert_not_called()

    def test_timer_accepts_systemd_formatted_monotonic_duration(self):
        module = helper()
        calls = []
        def show(unit, fields=None):
            if unit == module.TIMER:
                if fields == ('LastTriggerUSecMonotonic',):
                    return {'LastTriggerUSecMonotonic':'0'}
                return {'LastTriggerUSecMonotonic':'5month 2w 8h 58min 59.115944s',
                        'NextElapseUSecMonotonic':'5month 2w 9h', 'ActiveState':'active', 'UnitFileState':'enabled'}
            if unit == module.DEPLOY:
                return {'ActiveState':'inactive'}
            return {'MainPID':'123','NRestarts':'0','UnitFileState':'enabled'}
        module.show = show
        module.control = lambda *args: calls.append(args)
        module.run = lambda *args, **kwargs: SimpleNamespace(returncode=0)
        module.journal_results = lambda *args: ['noop']
        module.state = lambda: {'phase':'idle','settledSHA':module.MAIN}
        module.emit = lambda *args, **kwargs: None
        module.timer_tick({'MainPID':'123','NRestarts':'0'})
        self.assertEqual(calls, [('enable',module.UNIT)])

    def test_timer_does_not_accept_an_unchanged_formatted_trigger(self):
        module = helper()
        triggers = iter(['1h 2min', '1h 2min', '1h 7min'])
        def show(unit, fields=None):
            if unit == module.TIMER:
                return {'LastTriggerUSecMonotonic':next(triggers), 'NextElapseUSecMonotonic':'1h 12min', 'ActiveState':'active', 'UnitFileState':'enabled'}
            return {'ActiveState':'inactive','MainPID':'123','NRestarts':'0','UnitFileState':'enabled'}
        module.show = show
        module.control = lambda *args: None
        module.run = lambda *args, **kwargs: None
        module.journal_results = lambda *args: ['noop']
        module.state = lambda: {'phase':'idle','settledSHA':module.MAIN}
        module.emit = lambda *args, **kwargs: None
        with patch.object(module.time, 'sleep') as sleep:
            module.timer_tick({'MainPID':'123','NRestarts':'0'})
        sleep.assert_called_once_with(2)

    def test_timer_resume_rejects_pending_state_without_touching_units(self):
        module = helper()
        rows = [{'check':'fixed-unit-deployment','valid':True,'result':result,
                 'state':{'settledSHA':module.MAIN}} for result in ['deployed','noop']]
        rows += [{'check':check,'valid':True} for check in
                 ['fixed-unit-lock-contention','isolated-verifier','one-completed-feed']]
        rows += [{'check':'resources','label':'production', 'units':{module.UNIT:{'MainPID':'123','NRestarts':'0'}}},
                 {'check':'production-summary','valid':False,'phase':'timer-tick'}]
        module.show = lambda unit, fields=None: ({'ActiveState':'active','UnitFileState':'enabled','MainPID':'123','NRestarts':'0','MemoryPeak':'1024'}
                                                if unit == module.UNIT else {'ActiveState':'inactive','UnitFileState':'disabled'})
        module.state = lambda: {'phase':'activating','settledSHA':module.MAIN}
        with tempfile.TemporaryDirectory() as directory:
            evidence = Path(directory)/'checks.jsonl'
            evidence.write_text('\n'.join(json.dumps(row) for row in rows))
            with patch.object(module.os, 'geteuid', return_value=0), patch.object(module, 'control') as control:
                with self.assertRaises(ValueError):
                    module.finish_timer(evidence)
            control.assert_not_called()

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
