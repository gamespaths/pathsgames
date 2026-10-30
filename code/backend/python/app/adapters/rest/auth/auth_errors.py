"""v1.2.0 the JSON error of an AuthError: {error, message, timestamp} with its HTTP status."""
from fastapi.responses import JSONResponse

from app.core.models.auth.auth_error import AuthError


def auth_error_response(error: AuthError) -> JSONResponse:
    return JSONResponse(status_code=error.http_status, content=error.body())
