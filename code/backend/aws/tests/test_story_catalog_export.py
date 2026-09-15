"""v0.37.6 — POST /api/admin/stories/catalog writes data/stories-{lang}.json to the
website bucket and (optionally) invalidates CloudFront."""
import json
import os
from unittest.mock import patch, MagicMock

from helpers import make_event, admin_event

ADMIN = {'uuid': 'admin-uuid-001', 'role': 'ADMIN'}
FORBIDDEN = {'statusCode': 403, 'headers': {}, 'body': json.dumps({'error': 'FORBIDDEN'})}

PUBLIC = {'PK': 'STORY#p', 'SK': 'METADATA', 'uuid': 'p', 'visibility': 'PUBLIC', 'priority': 1,
          'category': 'Fantasy', 'texts': {'en': {'title': 'Pub', 'description': 'd'},
                                           'it': {'title': 'Pubblica', 'description': 'd'}}}
PRIVATE = {'PK': 'STORY#h', 'SK': 'METADATA', 'uuid': 'h', 'visibility': 'PRIVATE', 'priority': 9,
           'category': 'Fantasy', 'texts': {'en': {'title': 'Hidden', 'description': 'd'}}}


def _body(r):
    return json.loads(r['body'])


def _call(env, boto_client=None):
    from story import handler
    ev = admin_event('POST', '/api/admin/stories/catalog')
    fake_boto = MagicMock()
    fake_boto.client.side_effect = boto_client or (lambda name: MagicMock())
    with patch.dict(os.environ, env, clear=False), \
         patch.object(handler, '_require_admin', return_value=(ADMIN, None)), \
         patch('story.handler.db_utils.query_gsi', return_value=[PUBLIC, PRIVATE]), \
         patch.dict('sys.modules', {'boto3': fake_boto}):
        return handler.lambda_handler(ev, {}), fake_boto


def test_requires_admin():
    from story import handler
    with patch.object(handler, '_require_admin', return_value=(None, FORBIDDEN)):
        assert handler.export_catalog(make_event('POST', '/api/admin/stories/catalog'))['statusCode'] == 403


def test_503_without_bucket():
    r, boto = _call({'WEBSITE_BUCKET': '', 'WEBSITE_CLOUDFRONT_ID': ''})
    assert r['statusCode'] == 503
    assert _body(r)['error'] == 'CATALOG_TARGET_NOT_CONFIGURED'
    boto.client.assert_not_called()


def test_writes_one_file_per_language_public_only():
    clients = {'s3': MagicMock(), 'cloudfront': MagicMock()}
    r, boto = _call({'WEBSITE_BUCKET': 'site-bucket', 'WEBSITE_CLOUDFRONT_ID': '',
                     'CATALOG_LANGS': 'en, it'}, lambda n: clients[n])
    assert r['statusCode'] == 200
    body = _body(r)
    assert body['status'] == 'WRITTEN'
    assert body['target'] == 's3://site-bucket'
    assert [f['lang'] for f in body['files']] == ['en', 'it']
    assert body['files'][0]['path'] == 'data/stories-en.json'
    assert body['files'][0]['count'] == 1  # the PRIVATE story is left out

    puts = clients['s3'].put_object.call_args_list
    assert len(puts) == 2
    kw = puts[1].kwargs
    assert kw['Bucket'] == 'site-bucket' and kw['Key'] == 'data/stories-it.json'
    assert kw['ContentType'] == 'application/json'
    assert kw['CacheControl'] == 'public, max-age=300'
    written = json.loads(kw['Body'].decode('utf-8'))
    assert written[0]['uuid'] == 'p' and written[0]['title'] == 'Pubblica'
    assert body['files'][1]['bytes'] == len(kw['Body'])
    clients['cloudfront'].create_invalidation.assert_not_called()


def test_invalidates_cloudfront_when_configured():
    clients = {'s3': MagicMock(), 'cloudfront': MagicMock()}
    r, _ = _call({'WEBSITE_BUCKET': 'b', 'WEBSITE_CLOUDFRONT_ID': 'E123', 'CATALOG_LANGS': 'en'},
                 lambda n: clients[n])
    assert r['statusCode'] == 200
    inv = clients['cloudfront'].create_invalidation.call_args.kwargs
    assert inv['DistributionId'] == 'E123'
    assert inv['InvalidationBatch']['Paths'] == {'Quantity': 1, 'Items': ['/data/stories-en.json']}
    assert inv['InvalidationBatch']['CallerReference'].startswith('catalog-')


def test_blank_langs_fall_back_to_english():
    clients = {'s3': MagicMock()}
    r, _ = _call({'WEBSITE_BUCKET': 'b', 'WEBSITE_CLOUDFRONT_ID': '', 'CATALOG_LANGS': ' , '},
                 lambda n: clients[n])
    assert [f['lang'] for f in _body(r)['files']] == ['en']


def test_public_list_still_matches_get_stories():
    """The static file must be the GET /api/stories body: same helper, same order."""
    from story import handler
    with patch('story.handler.db_utils.query_gsi', return_value=[PUBLIC, PRIVATE]):
        r = handler.lambda_handler(make_event('GET', '/api/stories', qs={'lang': 'en'}), {})
    assert [s['uuid'] for s in _body(r)] == ['p']
