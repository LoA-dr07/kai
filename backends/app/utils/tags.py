"""Shared tag lookup-or-create helper (used by recipes and users routers)."""
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.recipe import Tag


def get_or_create_tag(
    db: Session,
    name: str,
    *,
    category: str | None = None,
    is_predefined: bool = False,
    case_sensitive: bool = True,
) -> Tag:
    """Find a tag by name (optionally scoped to `category`) or create it.

    `case_sensitive=False` matches the import/recipe-tag flows, which treat
    "Vegan" and "vegan" as the same tag. `case_sensitive=True` (default)
    preserves the exact-match behaviour used for per-user family tags.
    """
    query = db.query(Tag)
    if category is not None:
        query = query.filter(Tag.category == category)
    if case_sensitive:
        query = query.filter(Tag.name == name)
    else:
        query = query.filter(func.lower(Tag.name) == name.lower())
    tag = query.first()
    if tag:
        return tag
    tag = Tag(name=name, is_predefined=is_predefined, category=category)
    db.add(tag)
    db.flush()
    return tag
