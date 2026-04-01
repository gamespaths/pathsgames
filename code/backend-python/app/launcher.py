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

# 1. Initialize Database
init_db()

# 2. Initialize Adapters
persistence_adapter = GuestPersistenceAdapter(SessionLocal)
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
guest_auth_service = GuestAuthService(jwt_adapter, persistence_adapter)
guest_admin_service = GuestAdminService(persistence_adapter)

# 4. Initialize Controllers
echo_controller = EchoController(echo_service)
guest_auth_controller = GuestAuthController(guest_auth_service)
guest_admin_controller = GuestAdminController(guest_admin_service)

# 5. Setup FastAPI App
app = FastAPI(title=settings.app_name, version=settings.version)

# CORS
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

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.launcher:app", host="0.0.0.0", port=settings.port, reload=(settings.env == "development"))
