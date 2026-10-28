import os

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from dotenv import load_dotenv

load_dotenv()

SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./syncspace.db")
if SQLALCHEMY_DATABASE_URL.startswith("postgresql://"):
    SQLALCHEMY_DATABASE_URL = SQLALCHEMY_DATABASE_URL.replace("postgresql://", "postgresql+psycopg://", 1)

engine_options = {"pool_pre_ping": True}
if SQLALCHEMY_DATABASE_URL.startswith("sqlite"):
    engine_options["connect_args"] = {"check_same_thread": False}
    if SQLALCHEMY_DATABASE_URL.endswith(":memory:"):
        from sqlalchemy.pool import StaticPool
        engine_options["poolclass"] = StaticPool

engine = create_engine(SQLALCHEMY_DATABASE_URL, **engine_options)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def initialize_database():
    import models
    from sqlalchemy import inspect

    models.Base.metadata.create_all(bind=engine)
    inspector = inspect(engine)
    if "organizations" in inspector.get_table_names():
        organization_columns = {column["name"] for column in inspector.get_columns("organizations")}
        with engine.begin() as connection:
            if "bbps_partner" not in organization_columns:
                connection.exec_driver_sql("ALTER TABLE organizations ADD COLUMN bbps_partner VARCHAR(80) NOT NULL DEFAULT 'Setu'")
            if "payment_portal_url" not in organization_columns:
                connection.exec_driver_sql("ALTER TABLE organizations ADD COLUMN payment_portal_url VARCHAR(500) NOT NULL DEFAULT ''")
    if "rooms" in inspector.get_table_names():
        room_columns = {column["name"] for column in inspector.get_columns("rooms")}
        with engine.begin() as connection:
            if "organization_id" not in room_columns:
                # Existing facility data is assigned to the first organization that registers.
                # Until then it remains inaccessible through the tenant-scoped API.
                connection.exec_driver_sql(
                    "ALTER TABLE rooms ADD COLUMN organization_id INTEGER REFERENCES organizations(id)"
                )
            if "site_id" not in room_columns:
                connection.exec_driver_sql(
                    "ALTER TABLE rooms ADD COLUMN site_id INTEGER REFERENCES sites(id)"
                )

        # Give each existing organization a primary site and attach its old rooms.
        with SessionLocal() as db:
            for organization in db.query(models.Organization).all():
                site = (
                    db.query(models.Site)
                    .filter(models.Site.organization_id == organization.id)
                    .order_by(models.Site.id)
                    .first()
                )
                if not site:
                    site = models.Site(
                        organization_id=organization.id,
                        name="Main site",
                        state=organization.state,
                    )
                    db.add(site)
                    db.flush()
                db.query(models.Room).filter(
                    models.Room.organization_id == organization.id,
                    models.Room.site_id.is_(None),
                ).update({models.Room.site_id: site.id}, synchronize_session=False)
            db.commit()
