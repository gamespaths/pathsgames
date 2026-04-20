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

# 4. Initialize Controllers
echo_controller = EchoController(echo_service)
guest_auth_controller = GuestAuthController(guest_auth_service, jwt_adapter, token_persistence)
guest_admin_controller = GuestAdminController(guest_admin_service)
session_controller = SessionController(session_service)
story_controller = StoryController(story_query_service)
story_admin_controller = StoryAdminController(story_query_service, story_import_service)
content_controller = ContentController(content_query_service)

from fastapi import Request
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException

# 5. Setup FastAPI App
app = FastAPI(title=settings.app_name, version=settings.version)

@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    if isinstance(exc.detail, dict) and "error" in exc.detail:
        return JSONResponse(status_code=exc.status_code, content=exc.detail)
    return JSONResponse(status_code=exc.status_code, content={"error": "HTTP_EXCEPTION", "message": str(exc.detail)})

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=400,
        content={"error": "VALIDATION_ERROR", "message": "Request validation failed"}
    )

# Auth Middleware (Step 13)
public_paths = [
    "/api/stories",
    "/api/stories/**",
    "/api/content/**",
    "/api/echo/status",
    "/api/auth/guest",
    "/api/auth/guest/resume",
    "/api/auth/refresh"
]
app.add_middleware(JwtMiddleware, session_service=session_service, public_paths=public_paths)

# CORS (Added LAST to be OUTERMOST)
if settings.cors_allowed_origins == "*":
    app.add_middleware(
        CORSMiddleware,
        allow_origin_regex=r"https?://.*",
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
else:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

# Include Routers
app.include_router(echo_controller.router)
app.include_router(guest_auth_controller.router)
app.include_router(guest_admin_controller.router)
app.include_router(session_controller.router, prefix="/api/auth")
app.include_router(story_controller.router)
app.include_router(story_admin_controller.router)
app.include_router(content_controller.router)

if __name__ == "__main__":
    import uvicorn
    #uvicorn.run("app.launcher:app", host="0.0.0.0", port=settings.port, reload=(settings.env == "development"))
    uvicorn.run("app.launcher:app", host="127.0.0.1", port=settings.port, reload=(settings.env == "development"))
 