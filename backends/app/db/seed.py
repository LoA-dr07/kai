"""
Seed-Daten: 3 Haushaltsmitglieder + 1 Haushalt.
Aufruf: python -m app.db.seed  (aus dem backends/-Verzeichnis)
"""
from app.db.session import SessionLocal
from app.models.user import User
from app.models.household import Household, HouseholdMember


USERS = [
    {"name": "Mama", "short_name": "MA", "avatar_color": "#1565C0"},
    {"name": "Papa", "short_name": "PA", "avatar_color": "#6A1B9A"},
    {"name": "Kind",  "short_name": "KI", "avatar_color": "#E65100"},
]

HOUSEHOLD_NAME = "Unser Haushalt"


def run_seed():
    db = SessionLocal()
    try:
        # Idempotent: nur anlegen wenn noch nicht vorhanden
        if db.query(Household).count() > 0:
            print("Seed already applied, skipping.")
            return

        users = []
        for u in USERS:
            user = User(**u)
            db.add(user)
            users.append(user)

        db.flush()

        household = Household(name=HOUSEHOLD_NAME)
        db.add(household)
        db.flush()

        for user in users:
            db.add(HouseholdMember(household_id=household.id, user_id=user.id))

        db.commit()
        print(f"Seed complete: {len(users)} users, 1 household '{HOUSEHOLD_NAME}'")
    finally:
        db.close()


if __name__ == "__main__":
    run_seed()
