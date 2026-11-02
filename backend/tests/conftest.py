import os
import sys

# Ensure backend root is on sys.path
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import models
from auth_security import hash_password, create_session_token, COOKIE_NAME
from database import Base, get_db
from main import app

TEST_DATABASE_URL = "sqlite:///:memory:"

test_engine = create_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)


@pytest.fixture(scope="session", autouse=True)
def setup_test_db():
    Base.metadata.create_all(bind=test_engine)
    from seed_appliances import seed_default_appliances
    with TestingSessionLocal() as db:
        seed_default_appliances(db)
    yield
    Base.metadata.drop_all(bind=test_engine)


@pytest.fixture
def db_session():
    connection = test_engine.connect()
    transaction = connection.begin()
    session = TestingSessionLocal(bind=connection)

    yield session

    session.close()
    transaction.rollback()
    connection.close()


@pytest.fixture
def client(db_session):
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture
def test_organization(db_session):
    org = models.Organization(
        name="Test Campus Org",
        organization_type="Education",
        state="Maharashtra",
        tariff_rate=8.0,
        tariff_mode="flat",
        carbon_factor=0.82,
        operating_hours=8.0,
    )
    db_session.add(org)
    db_session.commit()
    db_session.refresh(org)
    return org


@pytest.fixture
def test_user(db_session, test_organization):
    user = models.User(
        email="owner@testcampus.ac.in",
        full_name="Facility Director",
        password_hash=hash_password("StrongPass1234!"),
        is_active=True,
    )
    db_session.add(user)
    db_session.flush()

    membership = models.Membership(
        user_id=user.id,
        organization_id=test_organization.id,
        role="owner",
        is_active=True,
    )
    db_session.add(membership)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture
def auth_client(client, test_user, test_organization):
    token = create_session_token(test_user.id, test_organization.id)
    client.cookies.set(COOKIE_NAME, token)
    return client


@pytest.fixture
def make_authenticated_client(client, db_session):
    def _make(email: str, org_name: str, role: str = "staff"):
        org = models.Organization(
            name=org_name,
            organization_type="Education",
            state="Maharashtra",
            tariff_rate=8.0,
            carbon_factor=0.82,
            operating_hours=8.0,
        )
        db_session.add(org)
        db_session.flush()

        user = models.User(
            email=email,
            full_name=f"User {role}",
            password_hash=hash_password("StrongPass1234!"),
            is_active=True,
        )
        db_session.add(user)
        db_session.flush()

        membership = models.Membership(
            user_id=user.id,
            organization_id=org.id,
            role=role,
            is_active=True,
        )
        db_session.add(membership)
        db_session.commit()

        token = create_session_token(user.id, org.id)
        # Create a fresh test client
        fresh_client = TestClient(app)
        fresh_client.cookies.set(COOKIE_NAME, token)
        return fresh_client, user, org

    return _make

