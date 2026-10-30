"""v1.2.0 admin bootstrap tool: ``python -m app.scripts.create_admin <nickname>`` creates (or finds again)
a real admin user and prints user and token on stdout only, never to a file or a log."""
import sys


def main(argv=None, out=None) -> int:
    argv = sys.argv[1:] if argv is None else argv
    out = out or sys.stdout
    if len(argv) != 1:
        print("Usage: python -m app.scripts.create_admin <nickname>", file=sys.stderr)
        return 2
    from app.core.models.auth.auth_error import AuthError
    from app.launcher import admin_bootstrap_service
    try:
        admin = admin_bootstrap_service.create_admin(argv[0])
    except AuthError as e:
        print(f"Error: {e.code} {e.message}", file=sys.stderr)
        return 1
    from datetime import datetime, timezone
    print(f"ADMIN_USER_UUID={admin.user_uuid}", file=out)
    print(f"ADMIN_USERNAME={admin.username}", file=out)
    print(f"ADMIN_NICKNAME={admin.nickname}", file=out)
    print(f"ADMIN_CREATED={str(admin.created).lower()}", file=out)
    print(f"ADMIN_TOKEN_EXPIRES_AT={datetime.fromtimestamp(admin.expires_at / 1000, tz=timezone.utc).isoformat()}",
          file=out)
    print(f"ADMIN_TOKEN={admin.access_token}", file=out)
    return 0


if __name__ == "__main__":  # pragma: no cover
    sys.exit(main())
