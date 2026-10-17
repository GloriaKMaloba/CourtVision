import jwt
from functools import wraps
from datetime import datetime, timedelta, timezone
from flask import request, jsonify, current_app, g
from app.models.user import db, User

def generate_token(user: User) -> str:
    expiration = datetime.now(timezone.utc) + timedelta(hours=current_app.config["JWT_EXPIRATION_HOURS"])
    payload = {
        "sub": str(user.id),
        "email": user.email,
        "role": user.role,
        "exp": expiration,
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, current_app.config["JWT_SECRET_KEY"], algorithm="HS256")

def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, current_app.config["JWT_SECRET_KEY"], algorithms=["HS256"])
    except jwt.ExpiredSignatureError:
        raise ValueError("Token has expired")
    except jwt.InvalidTokenError:
        raise ValueError("Invalid authentication token")

def get_auth_token_from_header() -> str:
    auth_header = request.headers.get("Authorization")
    if auth_header:
        parts = auth_header.split()
        if len(parts) == 2 and parts[0].lower() == "bearer":
            return parts[1]
    # Fallback for HTML5 media elements (e.g. <video src="...?token=...">)
    return request.args.get("token")

def jwt_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        token = get_auth_token_from_header()
        if not token:
            return jsonify({"error": "Authentication token missing"}), 401

        try:
            payload = decode_token(token)
            user_id = int(payload["sub"])
            user = db.session.get(User, user_id)
            if not user:
                return jsonify({"error": "User no longer exists"}), 401
            g.current_user = user
        except ValueError as err:
            return jsonify({"error": str(err)}), 401
        except Exception as e:
            return jsonify({"error": f"Failed to authenticate: {str(e)}"}), 401

        return f(*args, **kwargs)
    return decorated_function

def role_required(allowed_roles):
    """
    Decorator to restrict endpoints by role.
    Example: @role_required(['admin', 'scout'])
    """
    if isinstance(allowed_roles, str):
        allowed_roles = [allowed_roles]

    def decorator(f):
        @wraps(f)
        @jwt_required
        def decorated_function(*args, **kwargs):
            if g.current_user.role not in allowed_roles:
                return jsonify({
                    "error": f"Access denied. Requires one of the following roles: {', '.join(allowed_roles)}"
                }), 403
            return f(*args, **kwargs)
        return decorated_function
    return decorator
