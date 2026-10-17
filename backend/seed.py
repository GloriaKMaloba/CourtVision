"""
Database seed script to populate demo users for testing and supervisor demonstration.
"""
from datetime import date
from app import create_app
from app.models.user import db, User, AthleteProfile, ScoutProfile

def seed_database():
    app = create_app()
    with app.app_context():
        print("Ensuring database tables exist...")
        db.create_all()

        # Seed Athlete
        athlete_email = "athlete@courtvision.ke"
        if not User.query.filter_by(email=athlete_email).first():
            athlete = User(
                email=athlete_email,
                full_name="Kevin Otieno",
                role="athlete",
            )
            athlete.set_password("password123")
            db.session.add(athlete)
            db.session.flush()

            profile = AthleteProfile(
                user_id=athlete.id,
                county="Kisumu",
                school_or_club="Kisumu Boys High School",
                date_of_birth=date(2008, 4, 15),
                height_cm=188.0,
                position="Shooting Guard",
                dominant_hand="Right",
                bio="Aspiring grassroots basketball shooter from Kisumu county looking for Jr. NBA national recognition."
            )
            db.session.add(profile)
            print(f"Created demo athlete: {athlete_email} (password: password123)")

        # Seed Scout
        scout_email = "scout@courtvision.ke"
        if not User.query.filter_by(email=scout_email).first():
            scout = User(
                email=scout_email,
                full_name="Coach Achieng",
                role="scout",
            )
            scout.set_password("password123")
            db.session.add(scout)
            db.session.flush()

            scout_profile = ScoutProfile(
                user_id=scout.id,
                organization="M-PESA x Jr. NBA Kenya",
                title="Regional Talent Scout",
                phone="+254700000001",
            )
            db.session.add(scout_profile)
            print(f"Created demo scout: {scout_email} (password: password123)")

        # Seed Admin
        admin_email = "admin@courtvision.ke"
        if not User.query.filter_by(email=admin_email).first():
            admin = User(
                email=admin_email,
                full_name="Gloria Maloba",
                role="admin",
            )
            admin.set_password("adminpassword123")
            db.session.add(admin)
            print(f"Created demo admin: {admin_email} (password: adminpassword123)")

        db.session.commit()
        print("Database seeding completed successfully.")

if __name__ == "__main__":
    seed_database()
