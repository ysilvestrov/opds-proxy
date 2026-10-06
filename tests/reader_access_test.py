"""Synthetic journal validation: no capture, HTTP/source traffic or real secrets."""
import importlib.util
import json
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location('observer',Path(__file__).resolve().parents[1]/'scripts/diagnostics/reader-access.py')
observer = importlib.util.module_from_spec(spec)
spec.loader.exec_module(observer)


def event(**changes):
    result = dict(event='access',msg='OPDS request',level=30,time=1791290000000,method='GET',
                  route='cover',bookId='27223',status=200,durationMs=1.25,outcome='response_created')
    result.update(changes)
    return result


def envelope(value):
    return json.dumps({'_SYSTEMD_UNIT':observer.UNIT,'MESSAGE':json.dumps(value)})


class ReaderAccessTests(unittest.TestCase):
    def test_challenge_retry_and_unrelated_requests_keep_actual_statuses(self):
        rows=[event(route='entry'),event(status=401),event(route='root',bookId=None),event(status=200)]
        records,counters=observer.extract(map(envelope,rows))
        self.assertEqual([(r['route'],r['status']) for r in records],[('entry',200),('cover',401),('cover',200)])
        self.assertFalse(counters['truncated'])

    def test_no_credentials_headers_or_payloads_escape(self):
        record=event(authorization='Basic FAKE_SECRET',body='FAKE_IMAGE_BODY',username='FAKE_LOGIN',url='/private?FAKE_QUERY')
        result,counters=observer.extract([envelope(record),json.dumps({'_SYSTEMD_UNIT':observer.UNIT,'MESSAGE':'FAKE_NATIVE_ERROR_SECRET'})])
        output=json.dumps([result,counters])
        for value in ['FAKE_SECRET','FAKE_IMAGE_BODY','FAKE_LOGIN','FAKE_QUERY','FAKE_NATIVE_ERROR_SECRET']:
            self.assertNotIn(value,output)

    def test_malformed_access_is_rejected_and_counted(self):
        bad=[event(method={'secret':'x'}),event(status=True),event(durationMs=float('inf')),event(time=10**50),event(bookId='secret'),event(outcome='secret')]
        result,counters=observer.extract(map(envelope,bad))
        self.assertEqual(result,[])
        self.assertEqual(counters['invalidAccessEvents'],5)  # Non-allowlisted ID is filtered, not a target event.

    def test_event_cap_reports_truncation_without_growing_output(self):
        result,counters=observer.extract(envelope(event()) for _ in range(205))
        self.assertEqual(len(result),200)
        self.assertEqual(counters['matchedEvents'],205)
        self.assertTrue(counters['truncated'])

    def test_dropped_and_oversized_rows_prevent_absence_inference(self):
        notice=json.dumps({'_SYSTEMD_UNIT':'systemd-journald.service','MESSAGE':'Suppressed 10 messages from searchfloor-opds.service'})
        result,counters=observer.extract([notice,'x'*32769])
        self.assertEqual(result,[])
        self.assertEqual(counters['rateLimitNotices'],1)
        self.assertEqual(counters['oversizedRows'],1)

    def test_aborted_handler_is_not_successful_image_delivery(self):
        result,counters=observer.extract([envelope(event(outcome='aborted'))])
        self.assertEqual(result[0]['outcome'],'aborted')
        self.assertEqual(counters['abortedEvents'],1)
        self.assertNotIn('body',result[0])


if __name__ == '__main__':
    unittest.main()
