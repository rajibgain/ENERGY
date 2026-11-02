import os
import pytest
from alembic.config import Config
from alembic.script import ScriptDirectory
from sqlalchemy import inspect
from database import Base, engine


def test_alembic_configuration_and_head_revision():
    backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    alembic_ini_path = os.path.join(backend_dir, "alembic.ini")
    assert os.path.exists(alembic_ini_path), "alembic.ini must exist in backend directory"

    alembic_cfg = Config(alembic_ini_path)
    script = ScriptDirectory.from_config(alembic_cfg)
    heads = script.get_heads()

    assert len(heads) == 1, "There should be exactly one active head migration revision"
    assert heads[0] == "5d7c26b5329f"


def test_database_schema_and_constraints_integrity():
    # Verify metadata defines all necessary tables and constraints
    tables = Base.metadata.tables
    expected_tables = {
        "organizations",
        "users",
        "memberships",
        "invitations",
        "sites",
        "rooms",
        "appliances",
        "appliance_templates",
        "schedules",
        "bill_records",
        "meter_readings",
        "audit_tasks",
    }
    assert expected_tables.issubset(set(tables.keys()))

    # Verify unique constraint on schedules table
    sched_table = tables["schedules"]
    sched_unique_constraints = [c.name for c in sched_table.constraints if getattr(c, "name", None)]
    assert "uq_schedule_slot" in sched_unique_constraints

    # Verify columns on rooms table
    room_cols = [c.name for c in tables["rooms"].columns]
    assert "zone_type" in room_cols
    assert "area_sqm" in room_cols

    # Verify columns on audit_tasks table
    task_cols = [c.name for c in tables["audit_tasks"].columns]
    assert "verified_savings_kwh" in task_cols
    assert "verified_savings_inr" in task_cols
    assert "before_reading_kwh" in task_cols
    assert "after_reading_kwh" in task_cols

