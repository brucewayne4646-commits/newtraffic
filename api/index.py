import os
import sys

# Ensure repository root is in sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import app

# WSGI Middleware: Normalizes PATH_INFO if Vercel serverless passes /api/index
class VercelPathFixMiddleware:
    def __init__(self, wsgi_app):
        self.wsgi_app = wsgi_app

    def __call__(self, environ, start_response):
        matched_path = environ.get('HTTP_X_MATCHED_PATH')
        if matched_path and not matched_path.startswith('/api/index'):
            environ['PATH_INFO'] = matched_path
        else:
            path = environ.get('PATH_INFO', '')
            if path.startswith('/api/index'):
                new_path = path[len('/api/index'):]
                if not new_path or not new_path.startswith('/'):
                    new_path = '/' + new_path
                environ['PATH_INFO'] = new_path
        return self.wsgi_app(environ, start_response)

app.wsgi_app = VercelPathFixMiddleware(app.wsgi_app)
