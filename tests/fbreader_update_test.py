"""Offline MIME/URL validation and proxy-preserving update rollback."""
import io
from pathlib import Path
import unittest
import tempfile
import os
import json
import contextlib
from types import SimpleNamespace
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / 'deploy/validate-fbreader-prototype.sh'


def helper():
    assert SCRIPT.exists(), 'Manual acceptance helper missing'
    source = SCRIPT.read_text()
    start = source.index('\n', source.index("<<'PY'")) + 1
    scope = {'__name__': 'offline_test'}
    exec(compile(source[start:source.index('\nPY\n', start)], str(SCRIPT), 'exec'), scope)
    return scope



class FbreaderUpdateTests(unittest.TestCase):
    def test_live_verification_failure_stops_and_restores_pointer_and_config(self):
        scope = helper()
        original_lstat = Path.lstat
        def root_metadata(path, *args, **kwargs):
            values = list(original_lstat(path, *args, **kwargs))
            values[4] = values[5] = 0
            return os.stat_result(values)
        with tempfile.TemporaryDirectory() as tmp:
            directory = Path(tmp)
            for sha in [scope['OLD'], scope['SHA']]:
                (directory / sha).mkdir()
                (directory / sha / 'release.json').write_text(json.dumps({'sha': sha}))
            (directory / 'current').symlink_to(directory / scope['OLD'])
            env = directory / 'prototype.env'
            backup = directory / '.prototype.env.before-proxy-fixture'
            prior = {'PUBLIC_BASE_URL':'https://opds.invalid','OPDS_USERNAME':'fixture','OPDS_PASSWORD':'private'}
            configured = dict(prior, OPDS_SOURCE_PROXY_URL='http://private@proxy.invalid')
            env.write_text(json.dumps(configured)); backup.write_text(json.dumps(prior))
            original_config=env.read_bytes()
            scope.update(ROOT=directory, ENV=env)
            state = {'ActiveState':'inactive','UnitFileState':'disabled'}
            scope['show'] = lambda *args: dict(state)
            scope['resources'] = lambda *args: None
            scope['bot_health'] = lambda: {'ActiveState':'active','NRestarts':'0'}
            def failed_verify(*args, **kwargs): raise ValueError('live503 fixture')
            verifier = SimpleNamespace(load_private_config=lambda path=env: json.loads(path.read_text()), verify=failed_verify, request_curl=lambda *args: None)
            spec = SimpleNamespace(loader=SimpleNamespace(exec_module=lambda module: None))
            def systemctl(args, **kwargs):
                state['ActiveState'] = 'active' if args[-2] == 'start' else 'inactive'
                return SimpleNamespace(returncode=0)
            class Response:
                status = 200
                def __enter__(self): return self
                def __exit__(self, *args): pass
                def read(self, *args): return json.dumps({'ready':True,'sha':scope['SHA']}).encode()
            evidence = json.dumps({'check':'dedicated-source-get','status':200,'valid':True})
            read_text = Path.read_text
            def fixture_read(path, *args, **kwargs):
                if str(path) == 'docs/proxy-prototype-dedicated-source.jsonl': return evidence
                return read_text(path, *args, **kwargs)
            with patch('os.geteuid',return_value=0), patch.object(Path,'lstat',root_metadata), patch.object(Path,'read_text',fixture_read), patch('importlib.util.spec_from_file_location',return_value=spec), patch('importlib.util.module_from_spec',return_value=verifier), patch('subprocess.run',side_effect=systemctl), patch('subprocess.check_output',side_effect=lambda args,**kwargs: '' if 'journalctl' in args[0] else 'header\n'), patch('urllib.request.build_opener',return_value=SimpleNamespace(open=lambda *args,**kwargs:Response())), contextlib.redirect_stdout(io.StringIO()):
                with self.assertRaisesRegex(ValueError, 'live503'):
                    scope['main']()
            self.assertEqual((directory / 'current').resolve(), directory / scope['OLD'])
            self.assertEqual(env.read_bytes(), original_config)
            self.assertIn("OPDS_SOURCE_PROXY_URL", json.loads(env.read_text()))
            self.assertEqual(state['ActiveState'], 'inactive')

    def test_acquisition_mime_and_origin_are_validated(self):
        inspect=helper()['inspect_acquisition_links']
        feed=b'<feed xmlns="http://www.w3.org/2005/Atom"><entry><link rel="http://opds-spec.org/acquisition" href="https://opds.invalid/opds/searchfloor/books/7/download.fb2.zip" type="application/fb2+zip"/></entry></feed>'
        self.assertEqual(inspect(feed, 'https://opds.invalid'), 1)
        for invalid in [feed.replace(b'application/fb2+zip', b'application/zip'), feed.replace(b'opds.invalid/opds', b'external.invalid/opds'), b'<feed xmlns="http://www.w3.org/2005/Atom"/>', feed.replace(b'/7/download', b'/unsafe/download')]:
            with self.assertRaises(ValueError):inspect(invalid, 'https://opds.invalid')

    def test_stage_checksum_blocks_untrusted_artifact(self):
        script=ROOT/'deploy/stage-fbreader-prototype.sh'
        source=script.read_text();start=source.index('\n',source.index("<<'PY'"))+1
        scope={'__name__':'offline_test'}
        exec(compile(source[start:source.index('\nPY\n',start)],str(script),'exec'),scope)
        self.assertEqual(scope['BASELINE'],'e57f0a6d33799593afc594a8adefabfa46ee6341')
        self.assertEqual(scope['SHA'],'c22ac2e6edafeba1563d88363326b2bd19cbb097')
        with tempfile.TemporaryDirectory() as tmp:
            path=Path(tmp)/'artifact.zip';path.write_bytes(b'untrusted')
            with self.assertRaises(ValueError):scope['verify_digest'](path,scope['WRAPPER'])
            self.assertEqual(list(Path(tmp).iterdir()),[path])


if __name__ == '__main__':
    unittest.main()
