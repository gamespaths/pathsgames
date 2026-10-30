"""v1.7.0 step 12 why a refresh token was revoked (users_tokens.revoked_reason, mirror of RevokeReasons.java):
ROTATED and LOGOUT rows are deleted after 7 days, the others kept until expiry; LIMIT answers SESSION_LIMIT."""
ROTATED = "ROTATED"
LOGOUT = "LOGOUT"
LOGOUT_ALL = "LOGOUT_ALL"
LIMIT = "LIMIT"
ADMIN = "ADMIN"
SHORT_LIVED = (ROTATED, LOGOUT)
SHORT_RETENTION_DAYS = 7
