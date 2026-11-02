import io
import pytest


def test_schedule_overlap_rejection(auth_client):
    # 1. Create a zone
    room_payload = {
        "name": "Physics Lecture Hall",
        "block": "Block P",
        "zone_type": "classroom",
        "area_sqm": 90.0,
        "appliances": [{"name": "Lighting Rig", "power_watts": 400.0, "load_factor": 1.0, "standby_watts": 0.0}],
    }
    room_res = auth_client.post("/api/v1/rooms/", json=room_payload)
    assert room_res.status_code == 201
    room_id = room_res.json()["id"]

    # 2. Add base schedule: Monday 09:00 - 12:00
    base_res = auth_client.post(
        f"/api/v1/rooms/{room_id}/schedules/",
        json={"day_of_week": "Monday", "start_time": "09:00", "end_time": "12:00"},
    )
    assert base_res.status_code in (200, 201)

    # 3. Try to add exact duplicate: should return existing without error
    dup_res = auth_client.post(
        f"/api/v1/rooms/{room_id}/schedules/",
        json={"day_of_week": "Monday", "start_time": "09:00", "end_time": "12:00"},
    )
    assert dup_res.status_code in (200, 201)

    # 4. Try to add overlapping sub-interval: Monday 10:00 - 11:00 -> 409 Conflict
    overlap_res1 = auth_client.post(
        f"/api/v1/rooms/{room_id}/schedules/",
        json={"day_of_week": "Monday", "start_time": "10:00", "end_time": "11:00"},
    )
    assert overlap_res1.status_code == 409
    assert "overlaps" in overlap_res1.json()["detail"].lower()

    # 5. Try to add overlapping boundary: Monday 11:30 - 14:00 -> 409 Conflict
    overlap_res2 = auth_client.post(
        f"/api/v1/rooms/{room_id}/schedules/",
        json={"day_of_week": "Monday", "start_time": "11:30", "end_time": "14:00"},
    )
    assert overlap_res2.status_code == 409

    # 6. Add contiguous back-to-back schedule: Monday 12:00 - 15:00 -> Allowed (200 or 201)
    contig_res = auth_client.post(
        f"/api/v1/rooms/{room_id}/schedules/",
        json={"day_of_week": "Monday", "start_time": "12:00", "end_time": "15:00"},
    )
    assert contig_res.status_code in (200, 201)

    # 7. Add schedule on a different day: Tuesday 09:00 - 12:00 -> Allowed (200 or 201)
    diff_day_res = auth_client.post(
        f"/api/v1/rooms/{room_id}/schedules/",
        json={"day_of_week": "Tuesday", "start_time": "09:00", "end_time": "12:00"},
    )
    assert diff_day_res.status_code in (200, 201)


def test_batch_schedule_csv_overlap_and_malformed_input(auth_client):
    room_payload = {
        "name": "Chemistry Lab 2",
        "block": "Block C",
        "zone_type": "lab",
        "area_sqm": 75.0,
        "appliances": [{"name": "Fume Hood", "power_watts": 800.0, "load_factor": 0.7, "standby_watts": 50.0}],
    }
    room_res = auth_client.post("/api/v1/rooms/", json=room_payload)
    assert room_res.status_code == 201
    room_id = room_res.json()["id"]

    # Seed an existing schedule: Wednesday 08:00 - 11:00
    auth_client.post(
        f"/api/v1/rooms/{room_id}/schedules/",
        json={"day_of_week": "Wednesday", "start_time": "08:00", "end_time": "11:00"},
    )

    # Upload CSV containing:
    # Row 1: Wednesday 08:00 - 11:00 (exact duplicate of existing)
    # Row 2: Wednesday 10:00 - 13:00 (overlaps with existing)
    # Row 3: Wednesday 14:00 - 16:00 (valid, non-overlapping)
    # Row 4: Wednesday 15:00 - 17:00 (overlaps with Row 3 in same batch)
    csv_content = (
        "day_of_week,start_time,end_time\n"
        "Wednesday,08:00,11:00\n"
        "Wednesday,10:00,13:00\n"
        "Wednesday,14:00,16:00\n"
        "Wednesday,15:00,17:00\n"
    )
    files = {"file": ("schedule.csv", io.BytesIO(csv_content.encode("utf-8")), "text/csv")}
    upload_res = auth_client.post(f"/api/v1/rooms/{room_id}/schedules/upload/", files=files)
    assert upload_res.status_code == 200
    res_data = upload_res.json()
    assert res_data["count"] == 1  # Only row 3 added
    assert res_data["skipped_duplicates"] == 1  # Row 1
    assert res_data["skipped_overlaps"] == 2  # Row 2 and Row 4


def test_malformed_csv_error_handling(auth_client):
    room_res = auth_client.post(
        "/api/v1/rooms/",
        json={"name": "Testing Zone", "block": "B", "zone_type": "office", "appliances": [{"name": "A", "power_watts": 10.0, "load_factor": 1.0, "standby_watts": 0.0}]},
    )
    room_id = room_res.json()["id"]

    # 1. Missing required headers
    bad_header_csv = "colA,colB,colC\nMonday,09:00,12:00\n"
    res1 = auth_client.post(
        f"/api/v1/rooms/{room_id}/schedules/upload/",
        files={"file": ("test.csv", io.BytesIO(bad_header_csv.encode("utf-8")), "text/csv")},
    )
    assert res1.status_code == 422
    assert "needs day_of_week, start_time and end_time" in res1.json()["detail"]

    # 2. Invalid time format
    bad_time_csv = "day_of_week,start_time,end_time\nMonday,99:99,12:00\n"
    res2 = auth_client.post(
        f"/api/v1/rooms/{room_id}/schedules/upload/",
        files={"file": ("test.csv", io.BytesIO(bad_time_csv.encode("utf-8")), "text/csv")},
    )
    assert res2.status_code == 422
    assert "Invalid schedule on CSV row 2" in res2.json()["detail"]

    # 3. Empty file
    empty_csv = ""
    res3 = auth_client.post(
        f"/api/v1/rooms/{room_id}/schedules/upload/",
        files={"file": ("test.csv", io.BytesIO(empty_csv.encode("utf-8")), "text/csv")},
    )
    assert res3.status_code == 422
