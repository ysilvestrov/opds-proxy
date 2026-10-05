"""Offline checks for read-only verification of an existing installation."""
import contextlib
import importlib.util
import io
import json
from pathlib import Path
import unittest
from types import SimpleNamespace

ROOT = Path(__file__).resolve().parents[1]
SHA = 'a' * 40


class ResumeTests(unittest.TestCase):
    def setUp(self):
        spec = importlib.util.spec_from_file_location('resume', ROOT / 'scripts/verify-existing-prototype.py')
        self.module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(self.module)
        self.calls = []
        self.config = dict(PUBLIC_BASE_URL='https://opds.example', PORT='8787',
                           OPDS_USERNAME='private-user', OPDS_PASSWORD='private-password',
                           OPDS_SOURCE_PROXY_URL='http://secret-proxy:secret-password@proxy.example:80')

    def fetch(self, url, authorization):
        self.calls.append((url, authorization))
        if url.endswith('/health'):
            return 200, {'content-type': 'application/json'}, json.dumps({'ready': True, 'sha': SHA}).encode()
        if authorization is None:
            return 401, {'www-authenticate': 'Basic realm="OPDS"'}, b'Unauthorized'
        if url.endswith('opensearch.xml'):
            return 200, {'content-type': 'application/opensearchdescription+xml'}, b'<OpenSearchDescription xmlns="http://a9.com/-/spec/opensearch/1.1/"/>'
        return 200, {'content-type': 'application/atom+xml'}, b'<feed xmlns="http://www.w3.org/2005/Atom"/>'

    def run_checks(self, fetch=None, live=False, sha=SHA):
        output = io.StringIO()
        with contextlib.redirect_stdout(output):
            try:
                self.module.verify(self.config, sha, live=live, fetch=fetch or self.fetch)
                error = None
            except self.module.VerificationError as exc:
                error = exc
        self.assertNotIn('private-user', output.getvalue())
        self.assertNotIn('private-password', output.getvalue())
        self.assertNotIn('secret-proxy', output.getvalue())
        self.assertNotIn('secret-password', output.getvalue())
        self.assertNotIn('?q=', output.getvalue())
        return error, [json.loads(line) for line in output.getvalue().splitlines()]

    def test_static_success_does_not_call_source(self):
        error, rows = self.run_checks()
        self.assertIsNone(error)
        self.assertGreater(len(rows), 5)
        self.assertFalse(any(auth and ('/completed' in u or '/search?' in u) for u, auth in self.calls))

    def test_systemd_credentials_preserve_quotes_escapes_and_comments(self):
        text = """; comment=ignored
# comment
not an assignment
OPDS_PASSWORD=abc'
DOUBLE="a\\\"b\\$c\\qd"
SINGLE=' a\\b
c '
UNQUOTED= a\\ b  'literal' 
CONTINUED=first\\
second
OPDS_PASSWORD=final'
"""
        config = self.module.parse_systemd_env(text)
        self.assertEqual(config['OPDS_PASSWORD'], "final'")
        self.assertEqual(config['DOUBLE'], 'a"b$c\\qd')
        self.assertEqual(config['SINGLE'], ' a\\b\nc ')
        self.assertEqual(config['UNQUOTED'], "a b  'literal'")
        self.assertEqual(config['CONTINUED'], 'firstsecond')
        self.assertNotIn('; comment', config)

    def test_private_config_keeps_unquoted_trailing_quote(self):
        class PrivateFixture:
            def lstat(self): return SimpleNamespace(st_mode=0o100600, st_uid=0)
            def read_text(self, **_): return "OPDS_PASSWORD=abc'\n"
            def read_bytes(self): return b"OPDS_PASSWORD=abc'\n"
        self.assertEqual(self.module.load_private_config(PrivateFixture())['OPDS_PASSWORD'], "abc'")

    def test_wrong_sha_stops_before_authenticated_checks(self):
        error, rows = self.run_checks(sha='b'*40)
        self.assertIsNotNone(error)
        self.assertEqual(len(rows), 1)
        self.assertEqual(len(self.calls), 1)

    def test_401_mime_and_xml_failures_keep_prior_rows(self):
        for kind in ('401', 'mime', 'xml'):
            with self.subTest(kind=kind):
                def broken(url, auth):
                    status, headers, body = self.fetch(url, auth)
                    if auth:
                        if kind == '401': status = 401
                        elif kind == 'mime': headers = {'content-type': 'text/html'}
                        else: body = b'<html>challenge</html>'
                    return status, headers, body
                error, rows = self.run_checks(fetch=broken)
                self.assertIsNotNone(error)
                self.assertGreater(len(rows), 1)

    def test_live503_keeps_static_evidence_and_excludes_query(self):
        def broken(url, auth):
            if '/completed?' in url: return 503, {'content-type':'text/plain'}, b'Source unavailable'
            return self.fetch(url, auth)
        error, rows = self.run_checks(fetch=broken, live=True)
        self.assertIsNotNone(error)
        self.assertEqual(rows[-1]['status'], 503)
        self.assertEqual(rows[-1]['path'], '/opds/searchfloor/completed')
        self.assertGreater(len(rows), 5)


if __name__ == '__main__': unittest.main()
