from app.db.session import SessionLocal
from app.models.household import Household
from app.models.user import User


def seed_household():
    db = SessionLocal()
    try:
        if db.query(Household).count() > 0:
            return  # already seeded

        household = Household(name="Unser Haushalt")
        db.add(household)
        db.flush()

        users = [
            User(name="Anna", abbreviation="An", avatar_color="#FF6B6B", household_id=household.id),
            User(name="Ben", abbreviation="Be", avatar_color="#4ECDC4", household_id=household.id),
            User(name="Clara", abbreviation="Cl", avatar_color="#45B7D1", household_id=household.id),
        ]
        db.add_all(users)
        db.commit()
        print("Seed: 1 Haushalt und 3 User angelegt.")
    finally:
        db.close()


if __name__ == "__main__":
    seed_household()
