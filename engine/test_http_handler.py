from email.message import Message
from io import BytesIO
import json
import unittest
from unittest.mock import Mock, patch
from engine.analyzer import AnalysisError
from engine.http_handler import EngineHandler

KEY = 'local-unit-test-only-credential-123456789'


def request(body=b'{"text":"She reads.","language":"en"}', headers=None, key=KEY):
    handler = object.__new__(EngineHandler)
    handler.headers = Message()
    defaults = {'Authorization': 'Bearer ' + KEY, 'Content-Type': 'application/json', 'Content-Length': str(len(body))}
    defaults.update(headers or {})
    for name, value in defaults.items():
        if value is not None:
            handler.headers[name] = value
    handler.rfile = BytesIO(body)
    handler.connection = Mock()
    handler._send = Mock()
    with patch.dict('os.environ', {'LINGUA_API_KEY': key}):
        handler.do_POST()
    return handler._send.call_args.args


class HttpTests(unittest.TestCase):
    def test_authentication_before_parsing_and_service_fails_closed(self):
        for authorization in ['', 'Bearer bad']:
            status, body = request(b'not JSON', {'Authorization': authorization})
            self.assertEqual(status, 401)
            self.assertNotIn(KEY, json.dumps(body))
        self.assertEqual(request(key='')[0], 503)

    def test_limits_media_type_shape_and_json(self):
        cases = [
            (b'{}', {}, 400), (b'[]', {}, 400), (b'not-json', {}, 400),
            (b'{"text":"She reads.","extra":1}', {}, 400),
            (b'{}', {'Content-Type': 'text/plain'}, 415),
            (b'{}', {'Content-Length': None}, 400),
            (b'{}', {'Content-Length': '16385'}, 413),
            (b'{}', {'Content-Length': '9' * 5000}, 413),
            (b'{}', {'Transfer-Encoding': 'chunked'}, 400),
        ]
        for raw, headers, expected in cases:
            with self.subTest(headers=headers): self.assertEqual(request(raw, headers)[0], expected)

    def test_explicit_language_required_and_wrong_script_rejected(self):
        self.assertEqual(request(b'{"text":"She reads."}')[0], 400)
        for language, expected in [('ru', 'UNSUPPORTED_LANGUAGE'), ('en', 'UNSUPPORTED_SCRIPT')]:
            status, body = request(json.dumps({'text': 'Мама читает книгу.', 'language': language}).encode())
            self.assertEqual(status, 422)
            self.assertEqual(body['error']['code'], expected)

    def test_real_model_success(self):
        status, body = request()
        self.assertEqual(status, 200)
        self.assertEqual(body['model'], 'en_core_web_sm')
        self.assertEqual(body['tokens'][1]['lemma'], 'read')

    def test_multi_sentence_error_and_sensitive_exception_sanitized(self):
        self.assertEqual(request(b'{"text":"She reads. He listens.","language":"en"}')[0], 422)
        with patch('engine.http_handler.analyze', side_effect=RuntimeError('private-user-text')):
            status, body = request()
        self.assertEqual(status, 503)
        self.assertNotIn('private-user-text', json.dumps(body))
        with patch('engine.http_handler.analyze', side_effect=AnalysisError('BUSY', 'Try again.', 503)):
            self.assertEqual(request()[1]['error']['code'], 'BUSY')

    def test_method_and_no_store_headers(self):
        handler = object.__new__(EngineHandler)
        handler.command = 'GET'
        handler.send_response = Mock()
        handler.send_header = Mock()
        handler.end_headers = Mock()
        handler.wfile = BytesIO()
        handler.do_GET()
        handler.send_response.assert_called_once_with(405)
        handler.send_header.assert_any_call('Cache-Control', 'no-store')
        handler.send_header.assert_any_call('Allow', 'POST')


if __name__ == '__main__': unittest.main()
