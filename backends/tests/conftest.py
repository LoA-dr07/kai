"""
Test fixtures: SQLite in-memory database + FastAPI TestClient.
"""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.db.session import Base, get_db
from app.main import app as fastapi_app

# Alle Modelle importieren, damit Base.metadata die Tabellen kennt
import app.models  # noqa: F401

SQLITE_URL = "sqlite://"  # in-memory


@pytest.fixture(scope="session")
def engine():
    # StaticPool: alle Verbindungen teilen dieselbe In-Memory-DB
    e = create_engine(
        SQLITE_URL,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=e)
    yield e
    Base.metadata.drop_all(bind=e)


@pytest.fixture
def db(engine):
    """Give each test its own connection wrapped in an outer transaction that is
    always rolled back at teardown. Endpoint code calling db.commit() only commits
    a SAVEPOINT nested inside that outer transaction (restarted after each commit),
    so committed data never leaks into the next test even though `engine` and its
    StaticPool connection are shared across the whole test session."""
    connection = engine.connect()
    outer_transaction = connection.begin()
    TestingSession = sessionmaker(bind=connection, autocommit=False, autoflush=False)
    session = TestingSession()

    nested = connection.begin_nested()

    @event.listens_for(session, "after_transaction_end")
    def _restart_savepoint(sess, trans):
        nonlocal nested
        if not nested.is_active:
            nested = connection.begin_nested()

    try:
        yield session
    finally:
        session.close()
        outer_transaction.rollback()
        connection.close()


@pytest.fixture
def client(db):
    def override_get_db():
        try:
            yield db
        finally:
            pass

    fastapi_app.dependency_overrides[get_db] = override_get_db
    with TestClient(fastapi_app) as c:
        yield c
    fastapi_app.dependency_overrides.clear()
