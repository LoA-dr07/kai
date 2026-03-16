from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.models.user import User
from app.schemas.user import UserOut, UserPreferences, UserPreferencesUpdate

router = APIRouter(prefix="/users", tags=["users"])


@router.get("", response_model=list[UserOut])
def list_users(db: Session = Depends(get_db)):
    return db.query(User).order_by(User.id).all()


@router.put("/{user_id}/preferences", response_model=UserOut)
def update_user_preferences(
    user_id: int,
    payload: UserPreferencesUpdate,
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.preferences = payload.preferences.model_dump()
    db.commit()
    db.refresh(user)
    return UserOut.model_validate(user)
