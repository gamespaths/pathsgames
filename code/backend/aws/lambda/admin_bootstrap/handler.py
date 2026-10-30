"""v1.2.0 admin bootstrap Lambda: no API route, invoked by hand (console or code/scripts/prod/aws_create_admin.sh)
with {"nickname": "..."}; answers the admin user and its signed token, which is never written to a log."""
from common import jwt_utils
from common import log_utils
from common import sso

log_utils.quiet_botocore()


def lambda_handler(event, context):
    if jwt_utils.misconfigured():
        return {'error': 'MISCONFIGURED', 'message': 'JWT secret not set for this environment'}
    nickname = (event or {}).get('nickname') if isinstance(event, dict) else None
    try:
        return sso.create_admin(nickname)
    except sso.AuthError as e:
        return {'error': e.code, 'message': e.message}
