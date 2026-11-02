import pytest


def test_audit_task_crud_and_verified_savings(auth_client):
    # 1. Create a task
    create_res = auth_client.post(
        "/api/v1/tasks/",
        json={
            "title": "Install smart HVAC motion controller",
            "description": "Retrofit PIR sensors in main conference hall",
            "assigned_to": "Maintenance Engineer",
            "priority": "high",
            "due_date": "2026-12-15",
        },
    )
    assert create_res.status_code == 201
    task = create_res.json()
    task_id = task["id"]
    assert task["status"] == "open"
    assert task["title"] == "Install smart HVAC motion controller"

    # 2. Update task with before and after meter readings (e.g. 500 kWh before, 350 kWh after)
    # Savings = 150 kWh -> ₹1,200 at ₹8/kWh
    update_res = auth_client.patch(
        f"/api/v1/tasks/{task_id}",
        json={
            "status": "completed",
            "before_reading_kwh": 500.0,
            "after_reading_kwh": 350.0,
        },
    )
    assert update_res.status_code == 200
    updated_task = update_res.json()
    assert updated_task["status"] == "completed"
    assert updated_task["verified_savings_kwh"] == 150.0
    assert updated_task["verified_savings_inr"] == 1200.0
    assert updated_task["completed_at"] is not None

    # 3. List tasks
    list_res = auth_client.get("/api/v1/tasks/")
    assert list_res.status_code == 200
    assert len(list_res.json()) >= 1


def test_bill_trends_anomaly_detection(auth_client):
    # Create 4 consecutive monthly bills: 10,000, 10,000, 10,000, and then an anomaly of 15,000 (>20% above 10,000)
    bills = [
        {"biller": "Tata Power", "state": "Maharashtra", "amount": 10000.0, "dueDate": "2026-01-15"},
        {"biller": "Tata Power", "state": "Maharashtra", "amount": 10000.0, "dueDate": "2026-02-15"},
        {"biller": "Tata Power", "state": "Maharashtra", "amount": 10000.0, "dueDate": "2026-03-15"},
        {"biller": "Tata Power", "state": "Maharashtra", "amount": 15000.0, "dueDate": "2026-04-15"},
    ]
    for b in bills:
        auth_client.post(
            "/api/v1/bill-records/",
            json={
                "biller": b["biller"],
                "state": b["state"],
                "amount": b["amount"],
                "due_date": b["dueDate"],
            },
        )

    trend_res = auth_client.get("/api/v1/analytics/bill-trends/")
    assert trend_res.status_code == 200
    trends = trend_res.json()
    assert len(trends) >= 4

    # The 4th month (2026-04) should be flagged as an anomaly!
    apr_month = next((m for m in trends if m["month"] == "2026-04"), None)
    assert apr_month is not None
    assert apr_month["is_anomaly"] is True
    assert apr_month["rolling_avg"] == 10000.0


def test_bill_forecasting(auth_client):
    res = auth_client.get("/api/v1/analytics/forecast/")
    assert res.status_code == 200
    forecast = res.json()
    assert "predicted_month" in forecast
    assert forecast["predicted_amount"] > 0
    assert "trend" in forecast


def test_ecbc_bee_benchmarking(auth_client):
    # 1. Create a zone with known area and equipment
    create_room = auth_client.post(
        "/api/v1/rooms/",
        json={
            "name": "Faculty Research Room",
            "block": "Block B",
            "zone_type": "office",
            "area_sqm": 100.0,
            "appliances": [
                {"name": "Split AC", "power_watts": 1500.0, "load_factor": 0.6, "standby_watts": 10.0},
            ],
        },
    )
    assert create_room.status_code == 201
    room_id = create_room.json()["id"]

    # 2. Query benchmark comparison
    res = auth_client.get(f"/api/v1/analytics/benchmarks/{room_id}?area_sqm=100.0&zone_type=office")
    assert res.status_code == 200
    bench = res.json()
    assert bench["room_id"] == room_id
    assert bench["benchmark_epi"] == 140.0
    assert "ECBC 2017" in bench["source_citation"]
    assert bench["rating"] in ["efficient", "standard", "inefficient"]

