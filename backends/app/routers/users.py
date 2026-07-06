from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.models.user import User
from app.models.household import HouseholdMember
from app.models.recipe import Tag
from app.schemas.user import UserOut, UserPreferences, UserPreferencesUpdate, UserCreate, UserUpdate
from app.utils.household import get_household
from app.utils.tags import get_or_create_tag

router = APIRouter(prefix="/users", tags=["users"])


@router.get("", response_model=list[UserOut])
def list_users(db: Session = Depends(get_db)):
    return db.query(User).order_by(User.id).all()


@router.post("", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def create_user(payload: UserCreate, db: Session = Depends(get_db)):
    user = User(
        name=payload.name,
        avatar_color=payload.avatar_color,
        short_name=payload.short_name,
        preferences={},
    )
    db.add(user)
    db.flush()  # get user.id before commit

    household = get_household(db)
    if household:
        db.add(HouseholdMember(household_id=household.id, user_id=user.id))

    get_or_create_tag(db, payload.name, category="family", is_predefined=True)

    db.commit()
    db.refresh(user)
    return UserOut.model_validate(user)


@router.patch("/{user_id}", response_model=UserOut)
def update_user(user_id: int, payload: UserUpdate, db: Session = Depends(get_db)):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail=f"User {user_id} not found")

    if payload.name is not None:
        new_name = payload.name.strip()
        old_name = user.name
        user.name = new_name
        # Rename matching family tag
        tag = db.query(Tag).filter(
            func.lower(Tag.name) == old_name.lower(), Tag.category == "family"
        ).first()
        if tag:
            # Check for any existing tag with the new name (including non-family import tags)
            conflict = db.query(Tag).filter(
                func.lower(Tag.name) == new_name.lower(), Tag.id != tag.id
            ).first()
            if conflict:
                # Merge: carry over recipes from the old family tag to the conflict tag,
                # then promote the conflict tag to predefined family status
                for recipe in list(tag.recipes):
                    if conflict not in recipe.tags:
                        recipe.tags.append(conflict)
                conflict.is_predefined = True
                conflict.category = "family"
                conflict.name = new_name  # normalize casing
                db.flush()
                db.delete(tag)
            else:
                tag.name = new_name

    if payload.avatar_color is not None:
        user.avatar_color = payload.avatar_color

    if payload.short_name is not None:
        user.short_name = payload.short_name

    db.commit()
    db.refresh(user)
    return UserOut.model_validate(user)


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(user_id: int, db: Session = Depends(get_db)):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail=f"User {user_id} not found")

    # Delete family tag – recipe_tags rows are removed via DB CASCADE
    tag = (
        db.query(Tag).filter(Tag.name == user.name, Tag.category == "family").first()
    )
    if tag:
        db.delete(tag)

    # Delete user – household_members, meal_plan_entry_users, recipe_ratings via CASCADE
    db.delete(user)
    db.commit()


@router.put("/{user_id}/preferences", response_model=UserOut)
def update_user_preferences(
    user_id: int,
    payload: UserPreferencesUpdate,
    db: Session = Depends(get_db),
):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail=f"User {user_id} not found")
    user.preferences = payload.preferences.model_dump()
    db.commit()
    db.refresh(user)
    return UserOut.model_validate(user)
