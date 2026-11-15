import os
import sys

# Ensure repository root is in sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import app

# WSGI Middleware: Normalizes PATH_INFO for Vercel Serverless environment
class VercelPathFixMiddleware:
    def __init__(self, wsgi_app):
        self.wsgi_app = wsgi_app

    def __call__(self, environ, start_response):
        # Prefer original client request URI sent by Vercel edge reverse proxy
        uri = (
            environ.get('HTTP_X_FORWARDED_URI')
            or environ.get('REQUEST_URI')
            or environ.get('PATH_INFO', '')
        )
        if uri:
            path = uri.split('?')[0]
            if path.startswith('/api/index'):
                path = path[len('/api/index'):]
            if not path or not path.startswith('/'):
                path = '/' + path
            environ['PATH_INFO'] = path
        return self.wsgi_app(environ, start_response)

app.wsgi_app = VercelPathFixMiddleware(app.wsgi_app)
