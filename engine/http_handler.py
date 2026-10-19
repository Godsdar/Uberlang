"""Private HTTP boundary for the Node gateway. Never expose its credential to JS."""
import hmac
from http.server import BaseHTTPRequestHandler
import json
import os
import uuid
from engine.analyzer import AnalysisError, analyze


class EngineHandler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        # BaseHTTPRequestHandler logs raw paths by default. User data stays private.
        pass

    def _send(self, status, body):
        data = json.dumps(body, ensure_ascii=True, separators=(',', ':')).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(data)))
        self.send_header('Cache-Control', 'no-store')
        self.send_header('X-Content-Type-Options', 'nosniff')
        if status == 503:
            self.send_header('Retry-After', '2')
        if status == 401:
            self.send_header('WWW-Authenticate', 'Bearer')
        if status == 405:
            self.send_header('Allow', 'POST')
        self.end_headers()
        if self.command != 'HEAD':
            self.wfile.write(data)

    def _error(self, status, code, message):
        self._send(status, {'requestId': str(uuid.uuid4()), 'error': {'code': code, 'message': message}})

    def do_POST(self):
        key = os.environ.get('LINGUA_API_KEY', '')
        if len(key) < 32:
            self._error(503, 'ENGINE_UNAVAILABLE', 'The grammar engine is not configured.')
            return
        authorization = self.headers.get('Authorization', '')
        if not hmac.compare_digest(authorization.encode('utf-8'), ('Bearer ' + key).encode('utf-8')):
            self._error(401, 'UNAUTHORIZED', 'Authentication is required.')
            return
        if self.headers.get('Content-Type', '').split(';')[0].strip().lower() != 'application/json':
            self._error(415, 'UNSUPPORTED_MEDIA_TYPE', 'Use application/json.')
            return
        lengths = self.headers.get_all('Content-Length', [])
        if len(lengths) != 1 or not lengths[0].isascii() or not lengths[0].isdigit() or self.headers.get('Transfer-Encoding'):
            self._error(400, 'INVALID_REQUEST', 'A single Content-Length is required.')
            return
        if len(lengths[0]) > 6:
            self._error(413, 'BODY_LIMIT', 'The request is too large.')
            return
        length = int(lengths[0])
        if length > 16384:
            self._error(413, 'BODY_LIMIT', 'The request is too large.')
            return
        try:
            # Hosted runtime terminates request deadlines; local HTTP has a read timeout.
            self.connection.settimeout(10)
            raw = self.rfile.read(length)
            if len(raw) != length:
                raise ValueError('incomplete body')
            body = json.loads(raw)
            if not isinstance(body, dict) or set(body) != {'text', 'language'}:
                raise ValueError('invalid fields')
        except (ValueError, UnicodeDecodeError, TimeoutError):
            self._error(400, 'INVALID_REQUEST', 'Provide a JSON object with text and language fields.')
            return
        try:
            result = analyze(body['text'], body['language'])
            self._send(200, result)
        except AnalysisError as error:
            self._error(error.status, error.code, str(error))
        except Exception:
            # Do not serialize model exceptions: they may contain the submitted text.
            self._error(503, 'ENGINE_UNAVAILABLE', 'The grammar engine is temporarily unavailable.')

    def do_GET(self):
        self._error(405, 'METHOD_NOT_ALLOWED', 'Use POST.')

    do_HEAD = do_GET
    do_PUT = do_GET
    do_PATCH = do_GET
    do_DELETE = do_GET
    do_OPTIONS = do_GET
