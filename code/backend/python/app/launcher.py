from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.adapters.persistence.database import init_db, SessionLocal
from app.adapters.persistence.auth.guest_persistence_adapter import GuestPersistenceAdapter
from app.adapters.auth.jwt_adapter import JwtAdapter
from app.core.services.auth.guest_auth_service import GuestAuthService
from app.core.services.auth.guest_admin_service import GuestAdminService
from app.core.services.echo_service import EchoService
from app.adapters.rest.echo_controller import EchoController
from app.adapters.rest.auth.guest_auth_controller import GuestAuthController
from app.adapters.rest.auth.guest_admin_controller import GuestAdminController
from app.adapters.persistence.auth.token_persistence_adapter import TokenPersistenceAdapter
from app.core.services.auth.session_service import SessionService
from app.adapters.rest.auth.session_controller import SessionController
from app.adapters.rest.middleware.jwt_middleware import JwtMiddleware

from app.adapters.persistence.story.story_read_adapter import StoryReadAdapter
from app.adapters.persistence.story.story_persistence_adapter import StoryPersistenceAdapter
from app.core.services.story.story_query_service import StoryQueryService
from app.core.services.story.story_import_service import StoryImportService
from app.adapters.rest.story.story_controller import StoryController
from app.adapters.rest.story.story_admin_controller import StoryAdminController

from app.core.services.story.content_query_service import ContentQueryService
from app.adapters.rest.story.content_controller import ContentController

from app.core.services.story.story_crud_service import StoryCrudService
from app.adapters.rest.story.story_crud_admin_controller import StoryCrudAdminController

# Step 19 — single-player match creation
from app.adapters.persistence.match.match_persistence_adapter import MatchPersistenceAdapter
from app.adapters.persistence.match.story_match_read_adapter import StoryMatchReadAdapter
from app.adapters.persistence.match.user_access_adapter import UserAccessAdapter
from app.adapters.persistence.match.character_persistence_adapter import CharacterPersistenceAdapter
from app.core.services.match.match_command_service import MatchCommandService
from app.core.services.match.match_query_service import MatchQueryService
from app.core.services.match.character_command_service import CharacterCommandService
from app.core.services.match.character_query_service import CharacterQueryService
from app.core.services.match.property_system_mode_service import PropertySystemModeService
from app.adapters.rest.match.match_controller import MatchController
from app.adapters.rest.match.match_admin_controller import MatchAdminController
from app.adapters.rest.match.character_controller import CharacterController
from app.adapters.turnstile.turnstile_adapter import TurnstileVerificationAdapter
import app.adapters.persistence.match.models  # noqa: F401  - registers ORM tables

# Dev-only test-data cleanup
from app.core.services.dev.test_data_cleanup_service import TestDataCleanupService
from app.adapters.rest.dev.dev_controller import DevController

# 1. Initialize Database
init_db()

# 2. Initialize Adapters
persistence_adapter = GuestPersistenceAdapter(SessionLocal)
token_persistence = TokenPersistenceAdapter(SessionLocal)
jwt_adapter = JwtAdapter(
    secret=settings.jwt_secret,
    access_token_minutes=settings.access_token_minutes,
    refresh_token_days=settings.refresh_token_days
)
story_read_adapter = StoryReadAdapter(SessionLocal)
story_persistence_adapter = StoryPersistenceAdapter(SessionLocal)

# 3. Initialize Domain Services (DI)
echo_service = EchoService(
    server_status="OK",
    server_properties={
        "env": settings.env,
        "version": settings.version,
        "applicationName": settings.app_name,
        "port": str(settings.port),
    }
)
session_service = SessionService(jwt_adapter, token_persistence, 5)
guest_auth_service = GuestAuthService(jwt_adapter, persistence_adapter)
guest_admin_service = GuestAdminService(persistence_adapter)
story_query_service = StoryQueryService(story_read_adapter)
story_import_service = StoryImportService(story_persistence_adapter)
content_query_service = ContentQueryService(story_read_adapter)
story_crud_service = StoryCrudService(story_read_adapter, story_persistence_adapter)

# Step 19 — match adapters and services
match_persistence_adapter = MatchPersistenceAdapter(SessionLocal)
story_match_read_adapter = StoryMatchReadAdapter(SessionLocal)
user_access_adapter = UserAccessAdapter(SessionLocal)
system_mode_service = PropertySystemModeService(server_status="OK")
turnstile_adapter = TurnstileVerificationAdapter(
    settings.turnstile_secret_key,
    bypass_token=settings.turnstile_bypass_token,
    env=settings.env,
)
match_command_service = MatchCommandService(
    story_match_read_adapter,
    match_persistence_adapter,
    user_access_adapter,
    system_mode_service,
    turnstile_adapter,
)
# Step 21 — character join adapters and services
character_persistence_adapter = CharacterPersistenceAdapter(SessionLocal)
character_command_service = CharacterCommandService(
    story_match_read_adapter,
    match_persistence_adapter,
    user_access_adapter,
    character_persistence_adapter,
)
character_query_service = CharacterQueryService(
    match_persistence_adapter,
    character_persistence_adapter,
    story_match_read_adapter,
    user_access_adapter,
)
match_query_service = MatchQueryService(
    match_persistence_adapter,
    story_match_read_adapter,
    user_access_adapter,
    character_persistence_adapter,
)

# Dev-only test-data cleanup service
test_data_cleanup_service = TestDataCleanupService(persistence_adapter, match_persistence_adapter)

# 4. Initialize Controllers
echo_controller = EchoController(echo_service)
guest_auth_controller = GuestAuthController(guest_auth_service, jwt_adapter, token_persistence, settings.dev_test_endpoints_enabled)
guest_admin_controller = GuestAdminController(guest_admin_service)
session_controller = SessionController(session_service)
story_controller = StoryController(story_query_service)
story_admin_controller = StoryAdminController(story_query_service, story_import_service)
content_controller = ContentController(content_query_service)
story_crud_admin_controller = StoryCrudAdminController(story_crud_service)
match_controller = MatchController(match_command_service, match_query_service)
match_admin_controller = MatchAdminController(match_command_service, match_query_service)
character_controller = CharacterController(character_command_service, character_query_service)
dev_controller = DevController(test_data_cleanup_service, settings.dev_test_endpoints_enabled)

from fastapi import Request
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException

# 5. Setup FastAPI Apps
#
# Two separate FastAPI apps share the same wiring but a different surface:
#   * `app`       — public/player API, served on settings.port (default 8042)
#   * `app_admin` — every /api/admin/** endpoint, served ONLY on settings.admin_port (8044)
# This is the "strict split": admin routers are never mounted on the public app, and the
# admin app mounts nothing but admin routers, so each port answers only its own surface.


async def _http_exception_handler(request: Request, exc: StarletteHTTPException):
    if isinstance(exc.detail, dict) and "error" in exc.detail:
        return JSONResponse(status_code=exc.status_code, content=exc.detail)
    return JSONResponse(status_code=exc.status_code, content={"error": "HTTP_EXCEPTION", "message": str(exc.detail)})


async def _validation_exception_handler(request: Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=400,
        content={"error": "VALIDATION_ERROR", "message": "Request validation failed"}
    )


# Auth Middleware (Step 13) — admin paths still require the ADMIN role (enforced by
# JwtMiddleware via admin_path_prefix), in addition to living on the admin port.
public_paths = [
    "/api/stories",
    "/api/stories/**",
    "/api/content/**",
    "/api/echo/status",
    "/api/auth/guest",
    "/api/auth/guest/resume",
    "/api/auth/refresh",
    "/api/dev/**"
]


def _cors_params():
    params = {
        "allow_credentials": True,
        "allow_methods": ["*"],
        "allow_headers": ["*"],
    }
    if settings.cors_allowed_origins == "*":
        # Use regex to allow all origins while supporting allow_credentials=True
        params["allow_origin_regex"] = r"https?://.*"
    else:
        params["allow_origins"] = settings.cors_origins_list
    return params


def _build_app(routers) -> FastAPI:
    """Build a FastAPI app with the shared error handlers, JWT + CORS middleware and the
    given routers. ``routers`` items are either a router or a ``(router, kwargs)`` tuple."""
    application = FastAPI(title=settings.app_name, version=settings.version)
    application.add_exception_handler(StarletteHTTPException, _http_exception_handler)
    application.add_exception_handler(RequestValidationError, _validation_exception_handler)
    application.add_middleware(JwtMiddleware, session_service=session_service, public_paths=public_paths)
    # CORS added LAST so it is OUTERMOST (per S8414).
    application.add_middleware(CORSMiddleware, **_cors_params())
    for entry in routers:
        if isinstance(entry, tuple):
            application.include_router(entry[0], **entry[1])
        else:
            application.include_router(entry)
    return application


# Public app (player/public surface) — served on settings.port.
app = _build_app([
    echo_controller.router,
    guest_auth_controller.router,
    (session_controller.router, {"prefix": "/api/auth"}),
    story_controller.router,
    content_controller.router,
    match_controller.router,
    character_controller.router,
])

# Admin app — served ONLY on settings.admin_port. Hosts every /api/admin/** endpoint,
# the dev-only maintenance endpoints /api/dev/** (test-data cleanup), and the
# /api/echo/status health check (same EchoService). All sit behind the admin IP boundary.
app_admin = _build_app([
    echo_controller.router,
    guest_admin_controller.router,
    story_admin_controller.router,
    story_crud_admin_controller.router,
    match_admin_controller.router,
    dev_controller.router,
])


if __name__ == "__main__":
    import asyncio
    import uvicorn

    async def _serve():
        public = uvicorn.Server(uvicorn.Config(app, host="127.0.0.1", port=settings.port))
        admin = uvicorn.Server(uvicorn.Config(app_admin, host="127.0.0.1", port=settings.admin_port))
        await asyncio.gather(public.serve(), admin.serve())

    asyncio.run(_serve())
