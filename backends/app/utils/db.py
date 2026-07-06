"""Database helper utilities."""
from typing import Any, TypeVar

from fastapi import HTTPException
from pydantic import BaseModel
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


def apply_update(obj: Any, payload: BaseModel, *, exclude: set[str] = frozenset()) -> dict[str, Any]:
    """Apply the set fields of a Pydantic update payload onto an ORM object via setattr.

    Fields in `exclude` are skipped so the caller can handle them separately
    (e.g. relationship fields that need custom assignment logic).
    """
    data = payload.model_dump(exclude_unset=True, exclude=set(exclude))
    for field, value in data.items():
        setattr(obj, field, value)
    return data
