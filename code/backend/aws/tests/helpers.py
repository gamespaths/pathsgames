"""Shared test helpers for building Lambda event dicts."""
import json


def make_event(method, path, body=None, headers=None, cookies=None, path_params=None, qs=None):
    """Build a minimal API Gateway HTTP v2 event dict."""
    event = {
        'rawPath': path,
        'requestContext': {'http': {'method': method}},
        'headers': headers or {},
        'pathParameters': path_params or {},
        'queryStringParameters': qs or {},
    }
    if body is not None:
        event['body'] = json.dumps(body) if isinstance(body, dict) else body
    if cookies:
        event['cookies'] = cookies
    return event


def admin_event(method, path, **kwargs):
    """Build an event with a MOCK_ACCESS_ admin Bearer token."""
    headers = kwargs.pop('headers', {})
    headers['Authorization'] = 'Bearer MOCK_ACCESS_admin-uuid-001'
    return make_event(method, path, headers=headers, **kwargs)
