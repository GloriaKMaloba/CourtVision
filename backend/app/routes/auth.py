from datetime import datetime
from flask import Blueprint, request, jsonify, g
from app.models.user import db, User, AthleteProfile, ScoutProfile
from app.utils.auth_middleware import generate_token, jwt_required

auth_bp = Blueprint("auth", __name__, url_prefix="/api/auth")

@auth_bp.route("/register", methods=["POST"])
def register():
    data = request.get_json() or {}
    email = data.get("email", "").strip().lower()
    password = data.get("password", "")
    full_name = data.get("full_name", "").strip()
    role = data.get("role", "athlete").strip().lower()

    if not email or "@" not in email:
        return jsonify({"error": "A valid email address is required"}), 400

    if not password or len(password) < 6:
        return jsonify({"error": "Password must be at least 6 characters long"}), 400

    if not full_name:
        return jsonify({"error": "Full name is required"}), 400

    if role not in ["athlete", "scout", "admin"]:
        return jsonify({"error": "Role must be athlete, scout, or admin"}), 400

    if User.query.filter_by(email=email).first():
        return jsonify({"error": "An account with this email already exists"}), 409

    try:
        user = User(
            email=email,
            full_name=full_name,
            role=role,
        )
        user.set_password(password)
        db.session.add(user)
        db.session.flush() # get user.id

        if role == "athlete":
            dob = None
            if data.get("date_of_birth"):
                try:
                    dob = datetime.strptime(data.get("date_of_birth"), "%Y-%m-%d").date()
                except ValueError:
                    dob = None

            athlete_profile = AthleteProfile(
                user_id=user.id,
                county=data.get("county"),
                school_or_club=data.get("school_or_club"),
                date_of_birth=dob,
                height_cm=float(data.get("height_cm")) if data.get("height_cm") else None,
                position=data.get("position"),
                dominant_hand=data.get("dominant_hand"),
                bio=data.get("bio"),
            )
            db.session.add(athlete_profile)
        elif role == "scout":
            scout_profile = ScoutProfile(
                user_id=user.id,
                organization=data.get("organization") or "Jr. NBA / Independent",
                title=data.get("title") or "Talent Scout",
                phone=data.get("phone"),
            )
            db.session.add(scout_profile)

        db.session.commit()
        token = generate_token(user)

        return jsonify({
            "message": "Registration successful",
            "token": token,
            "user": user.to_dict()
        }), 201

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": f"Failed to register user: {str(e)}"}), 500


@auth_bp.route("/login", methods=["POST"])
def login():
    data = request.get_json() or {}
    email = data.get("email", "").strip().lower()
    password = data.get("password", "")

    if not email or not password:
        return jsonify({"error": "Email and password are required"}), 400

    user = User.query.filter_by(email=email).first()
    if not user or not user.check_password(password):
        return jsonify({"error": "Invalid email or password"}), 401

    token = generate_token(user)
    return jsonify({
        "message": "Login successful",
        "token": token,
        "user": user.to_dict()
    }), 200


@auth_bp.route("/me", methods=["GET"])
@jwt_required
def get_current_user():
    return jsonify({"user": g.current_user.to_dict()}), 200


@auth_bp.route("/profile", methods=["PUT"])
@jwt_required
def update_profile():
    user = g.current_user
    data = request.get_json() or {}

    if "full_name" in data and data["full_name"].strip():
        user.full_name = data["full_name"].strip()

    if user.role == "athlete":
        if not user.athlete_profile:
            user.athlete_profile = AthleteProfile(user_id=user.id)

        profile = user.athlete_profile
        if "county" in data:
            profile.county = data["county"]
        if "school_or_club" in data:
            profile.school_or_club = data["school_or_club"]
        if "height_cm" in data and data["height_cm"]:
            try:
                profile.height_cm = float(data["height_cm"])
            except ValueError:
                pass
        if "position" in data:
            profile.position = data["position"]
        if "dominant_hand" in data:
            profile.dominant_hand = data["dominant_hand"]
        if "bio" in data:
            profile.bio = data["bio"]

    elif user.role == "scout":
        if not user.scout_profile:
            user.scout_profile = ScoutProfile(user_id=user.id)
        profile = user.scout_profile
        if "organization" in data:
            profile.organization = data["organization"]
        if "title" in data:
            profile.title = data["title"]
        if "phone" in data:
            profile.phone = data["phone"]

    try:
        db.session.commit()
        return jsonify({
            "message": "Profile updated successfully",
            "user": user.to_dict()
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": f"Failed to update profile: {str(e)}"}), 500
