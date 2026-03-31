"""Database helper utilities."""
from typing import TypeVar

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.db.session import Base

T = TypeVar("T", bound=Base)


def get_or_404(db: Session, model: type[T], id: int, detail: str | None = None) -> T:
    """Fetch a record by primary key or raise HTTP 404."""
    obj = db.get(model, id)
    if not obj:
        raise HTTPException(
            status_code=404,
            detail=detail or f"{model.__name__} not found",
        )
    return obj
