"""Real private files/lock; systemd and HTTP are mocked, no host mutation."""
import importlib.util
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]

def helper():
    spec = importlib.util.spec_from_file_location('credentials', ROOT/'scripts/change-opds-credentials.py')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module

class RotationTests(unittest.TestCase):
    def setup_rotation(self, directory):
        module = helper()
        module.ENV = Path(directory)
        module.LOCK = module.ENV/'lock'
        module.LOCK.touch()
        module.OWNER = os.getuid()
        values = {'OPDS_USERNAME':'fixture-old','OPDS_PASSWORD':'fixture-old-password',
                  'PUBLIC_BASE_URL':'https://opds.invalid','CACHE_PATH':'fixture-cache',
                  'OPDS_SOURCE_PROXY_URL':'http://fixture:fixture@proxy.invalid:8080'}
        deploy = {'OPDS_USERNAME':values['OPDS_USERNAME'],'OPDS_PASSWORD':values['OPDS_PASSWORD'],
                  'OPDS_GITHUB_TOKEN':'fixture-token','OPDS_WORKFLOW_ID':'374905819'}
        for name, data in [('runtime.env',values),('deploy.env',deploy)]:
            path = module.ENV/name
            path.write_bytes(module.infra.encode_env(data))
            path.chmod(0o600)
        module.preflight = lambda: ('a'*40, {'ActiveState':'active','UnitFileState':'enabled'})
        module.check_health = lambda config, sha: None
        module.check_revoked = lambda config: None
        module.control = lambda *args: None
        return module, values, deploy

    def test_changes_only_basic_pair_preserving_other_configuration(self):
        with tempfile.TemporaryDirectory() as directory:
            m, runtime, deploy = self.setup_rotation(directory)
            result = m.rotate('my-reader', 'fixture words $ quote" slash\\')
            for name, expected in [('runtime.env',runtime),('deploy.env',deploy)]:
                expected.update(OPDS_USERNAME='my-reader',OPDS_PASSWORD='fixture words $ quote" slash\\')
                self.assertEqual(m.infra.verifier.parse_systemd_env((m.ENV/name).read_text()), expected)
                self.assertEqual((m.ENV/name).stat().st_mode & 0o777, 0o600)
            self.assertTrue(result['changed'])
            self.assertFalse((m.ENV/'credentials-rotation-pending').exists())

    def test_failure_restores_original_bytes_and_timer(self):
        with tempfile.TemporaryDirectory() as directory:
            m, _, _ = self.setup_rotation(directory)
            before = {name:(m.ENV/name).read_bytes() for name in ['runtime.env','deploy.env']}
            calls = []
            m.control = lambda *args: calls.append(args)
            attempts = []
            def health(config, sha):
                attempts.append(config['OPDS_USERNAME'])
                if config['OPDS_USERNAME'] == 'new': raise ValueError('fixture failure')
            m.check_health = health
            with self.assertRaises(m.RotationError): m.rotate('new','fixture-new-password')
            for name, data in before.items(): self.assertEqual((m.ENV/name).read_bytes(), data)
            self.assertEqual(attempts, ['new','fixture-old'])
            self.assertIn(('enable',m.TIMER),calls)
            self.assertEqual(calls[-1], ('start',m.TIMER))

    def test_partial_write_rolls_back_both_files(self):
        with tempfile.TemporaryDirectory() as directory:
            m, _, _ = self.setup_rotation(directory)
            before = {name:(m.ENV/name).read_bytes() for name in ['runtime.env','deploy.env']}
            original = m.atomic_file
            failed = False
            def write(path, data, mode):
                nonlocal failed
                if path == m.ENV/'deploy.env' and b'fixture-new-password' in data and not failed:
                    failed = True
                    raise OSError('fixture write failure')
                original(path,data,mode)
            m.atomic_file = write
            with self.assertRaises(m.RotationError): m.rotate('new','fixture-new-password')
            for name, data in before.items(): self.assertEqual((m.ENV/name).read_bytes(), data)

    def test_busy_lock_refuses_before_service_changes(self):
        import fcntl
        with tempfile.TemporaryDirectory() as directory:
            m, _, _ = self.setup_rotation(directory)
            with m.LOCK.open('r+') as held:
                fcntl.flock(held,fcntl.LOCK_EX | fcntl.LOCK_NB)
                with patch.object(m, 'control') as control:
                    with self.assertRaises(m.RotationError): m.rotate('new','fixture-new-password')
                control.assert_not_called()

    def test_invalid_username_and_control_characters_are_refused(self):
        m = helper()
        for username,password in [('a:b','fixture'),('a',''),('a','fixture\nsecret')]:
            with self.assertRaises(m.RotationError): m.validate_credentials(username,password)

    def test_inactive_disabled_timer_is_not_started(self):
        with tempfile.TemporaryDirectory() as directory:
            m, _, _ = self.setup_rotation(directory)
            m.preflight = lambda: ('a'*40,{'ActiveState':'inactive','UnitFileState':'disabled'})
            with patch.object(m,'control') as control: m.rotate('new','fixture-new-password')
            self.assertNotIn(('start',m.TIMER),[call.args for call in control.call_args_list])
            self.assertNotIn(('enable',m.TIMER),[call.args for call in control.call_args_list])

    def test_backup_records_previous_timer_state_for_hard_crash_recovery(self):
        import json
        with tempfile.TemporaryDirectory() as directory:
            m, _, _ = self.setup_rotation(directory)
            m.rotate('new','fixture-new-password')
            backups = list(m.ENV.glob('.credentials-backup-*'))
            self.assertEqual(len(backups),1)
            metadata = json.loads((backups[0]/'recovery.json').read_text())
            self.assertEqual(metadata['timer'],{'ActiveState':'active','UnitFileState':'enabled'})
            self.assertNotIn('fixture-new-password',json.dumps(metadata))

    def test_failed_rollback_retains_pending_and_disabled_timer(self):
        with tempfile.TemporaryDirectory() as directory:
            m, _, _ = self.setup_rotation(directory)
            m.check_health = lambda *args: (_ for _ in ()).throw(ValueError('fixture'))
            with patch.object(m,'control') as control:
                with self.assertRaises(m.RotationError): m.rotate('new','fixture-new-password')
            self.assertTrue((m.ENV/'credentials-rotation-pending').is_file())
            self.assertNotIn(('start',m.TIMER),[call.args for call in control.call_args_list])
            self.assertEqual(control.call_args_list[-1].args,('disable',m.TIMER))

    def test_timer_restore_failure_and_failed_rollback_keep_pending(self):
        with tempfile.TemporaryDirectory() as directory:
            m, _, _ = self.setup_rotation(directory)
            def control(action,unit):
                if (action,unit) == ('enable',m.TIMER): raise OSError('fixture timer failure')
            def health(config,sha):
                if config['OPDS_USERNAME'] == 'fixture-old': raise ValueError('fixture rollback failure')
            m.control = control
            m.check_health = health
            with self.assertRaises(m.RotationError): m.rotate('new','fixture-new-password')
            self.assertTrue((m.ENV/'credentials-rotation-pending').is_file())

    def test_pending_marker_is_checked_after_lock_acquisition(self):
        with tempfile.TemporaryDirectory() as directory:
            m, _, _ = self.setup_rotation(directory)
            original = m.fcntl.flock
            def competing_failure(file,operation):
                if operation == m.fcntl.LOCK_EX | m.fcntl.LOCK_NB:
                    (m.ENV/'credentials-rotation-pending').write_text('fixture pending')
                return original(file,operation)
            with patch.object(m.fcntl,'flock',side_effect=competing_failure), patch.object(m,'control') as control:
                with self.assertRaises(m.RotationError): m.rotate('new','fixture-new-password')
            control.assert_not_called()

if __name__ == '__main__': unittest.main()
