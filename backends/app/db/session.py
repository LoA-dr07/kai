from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import NullPool
import os
from dotenv import load_dotenv

load_dotenv()

# NullPool: keine idle Verbindungen – jede Anfrage öffnet/schließt selbst.
# Pflicht mit Neons gepooltem Endpoint (PgBouncer), damit Neon zwischen
# Anfragen auf 0 skalieren kann und das Free-Compute-Limit nicht ausgeschöpft wird.
engine = create_engine(os.getenv("DATABASE_URL"), poolclass=NullPool)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
