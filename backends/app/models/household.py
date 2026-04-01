from sqlalchemy import Column, Integer, String, ForeignKey, JSON
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship
from app.db.session import Base


class Household(Base):
    __tablename__ = "households"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    settings = Column(JSONB().with_variant(JSON(), "sqlite"), nullable=True, default=dict)

    members = relationship("HouseholdMember", back_populates="household")


class HouseholdMember(Base):
    __tablename__ = "household_members"

    household_id = Column(Integer, ForeignKey("households.id", ondelete="CASCADE"), primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)

    household = relationship("Household", back_populates="members")
    user = relationship("User", back_populates="households")
