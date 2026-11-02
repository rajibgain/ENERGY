import pytest
from datetime import date
from fastapi import HTTPException
from rate_limiter import RateLimiter, init_redis_client
import models


def test_production_redis_mandatory_enforcement(monkeypatch):
    # In production mode without REDIS_URL -> must raise RuntimeError
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.setenv("REDIS_URL", "")
    with pytest.raises(RuntimeError) as exc_info:
        init_redis_client(app_env="production", redis_url="")
    assert "mandatory in production mode" in str(exc_info.value)

    # In production mode with unreachable REDIS_URL -> must raise RuntimeError
    with pytest.raises(RuntimeError) as exc_info2:
        init_redis_client(app_env="production", redis_url="redis://127.0.0.1:63999/0")
    assert "Failed to connect to mandatory production Redis" in str(exc_info2.value)


def test_in_memory_ratelimit_sliding_window(monkeypatch):
    monkeypatch.setenv("APP_ENV", "development")
    limiter = RateLimiter(max_attempts=3, window_seconds=60, prefix="test:dev:rl")
    test_key = "user_test_123"

    # 1. First 3 attempts must pass
    limiter.check(test_key)
    limiter.check(test_key)
    limiter.check(test_key)

    # 2. 4th attempt within window must raise 429
    with pytest.raises(HTTPException) as exc:
        limiter.check(test_key)
    assert exc.value.status_code == 429

    # 3. Clearing key allows subsequent attempts
    limiter.clear(test_key)
    limiter.check(test_key)  # Should succeed


def test_forecasting_edge_cases(auth_client, db_session, test_organization, test_user):
    # Case 1: 0 bills -> returns default modeled baseline without dividing by zero
    res0 = auth_client.get("/api/v1/analytics/forecast/")
    assert res0.status_code == 200
    data0 = res0.json()
    assert data0["predicted_amount"] > 0
    assert data0["predicted_kwh"] > 0
    assert data0["trend"] == "stable"

    # Case 2: 1 single bill -> baseline projection with stable trend
    bill1 = models.BillRecord(
        organization_id=test_organization.id,
        biller="Utility",
        state="MH",
        site="S1",
        amount=13500.0,
        due_date=date(2026, 1, 15),
        status="paid",
        created_by_id=test_user.id,
    )
    db_session.add(bill1)
    db_session.commit()

    res1 = auth_client.get("/api/v1/analytics/forecast/")
    assert res1.status_code == 200
    data1 = res1.json()
    assert len(data1["historical_months"]) == 1
    assert data1["trend"] == "stable"

    # Case 3: 4 decreasing monthly bills -> regression detects decreasing trend
    db_session.add_all([
        models.BillRecord(organization_id=test_organization.id, biller="U", state="MH", amount=12000.0, due_date=date(2026, 2, 15), status="paid", created_by_id=test_user.id),
        models.BillRecord(organization_id=test_organization.id, biller="U", state="MH", amount=10500.0, due_date=date(2026, 3, 15), status="paid", created_by_id=test_user.id),
        models.BillRecord(organization_id=test_organization.id, biller="U", state="MH", amount=9000.0, due_date=date(2026, 4, 15), status="paid", created_by_id=test_user.id),
    ])
    db_session.commit()

    res_dec = auth_client.get("/api/v1/analytics/forecast/")
    assert res_dec.status_code == 200
    data_dec = res_dec.json()
    assert len(data_dec["historical_months"]) == 4
    assert data_dec["trend"] == "decreasing"
    assert data_dec["confidence_r2"] > 0.8
