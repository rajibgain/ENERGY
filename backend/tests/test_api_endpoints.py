import io
import pytest


def test_get_appliance_templates(auth_client):
    response = auth_client.get("/api/v1/appliance-templates/")
    assert response.status_code == 200
    templates = response.json()
    assert len(templates) >= 10
    names = [t["name"] for t in templates]
    assert "1.5-ton Split AC" in names
    assert "Standard Ceiling Fan" in names


def test_create_room_and_deduplicate_schedules(auth_client, test_organization):
    # 1. Create a zone
    room_payload = {
        "name": "Classroom 301",
        "block": "West Wing",
        "zone_type": "classroom",
        "area_sqm": 65.0,
        "appliances": [
            {"name": "Ceiling Fan", "power_watts": 75.0, "load_factor": 0.8, "standby_watts": 0.0},
            {"name": "LED Tube", "power_watts": 20.0, "load_factor": 1.0, "standby_watts": 0.0},
        ],
    }
    create_res = auth_client.post("/api/v1/rooms/", json=room_payload)
    assert create_res.status_code == 201
    room_id = create_res.json()["id"]

    # 2. Upload schedule CSV
    csv_data = (
        "day_of_week,start_time,end_time\n"
        "Monday,09:00,12:00\n"
        "Tuesday,09:00,12:00\n"
        "Monday,09:00,12:00\n"  # Duplicate within batch
    )
    files = {"file": ("schedule.csv", io.BytesIO(csv_data.encode("utf-8")), "text/csv")}
    upload_res = auth_client.post(f"/api/v1/rooms/{room_id}/schedules/upload/", files=files)
    assert upload_res.status_code == 200
    res_json = upload_res.json()
    assert res_json["count"] == 2
    assert res_json["skipped_duplicates"] == 1

    # 3. Upload same CSV again -> all 3 rows in CSV are duplicates of existing
    files2 = {"file": ("schedule.csv", io.BytesIO(csv_data.encode("utf-8")), "text/csv")}
    upload_res2 = auth_client.post(f"/api/v1/rooms/{room_id}/schedules/upload/", files=files2)
    assert upload_res2.status_code == 200
    res_json2 = upload_res2.json()
    assert res_json2["count"] == 0
    assert res_json2["skipped_duplicates"] == 3


def test_meter_data_csv_upload_and_summary(auth_client):
    csv_data = (
        "timestamp,kwh,room_name\n"
        "2026-03-01 09:00,14.5,Classroom 301\n"
        "2026-03-01 10:00,15.2,Classroom 301\n"
        "2026-03-02 09:00,13.8,\n"
    )
    files = {"file": ("meter.csv", io.BytesIO(csv_data.encode("utf-8")), "text/csv")}
    upload_res = auth_client.post("/api/v1/meter-data/upload/", files=files)
    assert upload_res.status_code == 200
    data = upload_res.json()
    assert data["imported_count"] == 3

    # Check summary endpoint
    summary_res = auth_client.get("/api/v1/meter-data/summary/")
    assert summary_res.status_code == 200
    summary_data = summary_res.json()
    assert "monthly_data" in summary_data
    assert summary_data["total_measured_kwh"] > 0
