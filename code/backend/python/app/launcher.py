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

# 4. Initialize Controllers
echo_controller = EchoController(echo_service)
guest_auth_controller = GuestAuthController(guest_auth_service, jwt_adapter, token_persistence)
guest_admin_controller = GuestAdminController(guest_admin_service)
session_controller = SessionController(session_service)

# 5. Setup FastAPI App
app = FastAPI(title=settings.app_name, version=settings.version)

# CORS
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

# Auth Middleware (Step 13)
public_paths = [
    "/api/echo/status",
    "/api/auth/guest",
    "/api/auth/guest/resume",
    "/api/auth/refresh"
]
app.add_middleware(JwtMiddleware, session_service=session_service, public_paths=public_paths)

# Include Routers
app.include_router(echo_controller.router)
app.include_router(guest_auth_controller.router)
app.include_router(guest_admin_controller.router)
app.include_router(session_controller.router, prefix="/api/auth")

if __name__ == "__main__":
    import uvicorn
    #uvicorn.run("app.launcher:app", host="0.0.0.0", port=settings.port, reload=(settings.env == "development"))
    uvicorn.run("app.launcher:app", host="127.0.0.1", port=settings.port, reload=(settings.env == "development"))
 