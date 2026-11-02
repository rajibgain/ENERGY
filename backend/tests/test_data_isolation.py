import pytest
import models


def test_organization_data_isolation(make_authenticated_client, db_session):
    # Setup Org A (Owner) and Org B (Owner)
    client_a, user_a, org_a = make_authenticated_client("alice@org-a.com", "Alpha Corp", "owner")
    client_b, user_b, org_b = make_authenticated_client("bob@org-b.com", "Beta Corp", "owner")

    # 1. Org A creates a room
    room_payload = {
        "name": "Alpha Server Room",
        "block": "Building 1",
        "zone_type": "it_datacenter",
        "area_sqm": 80.0,
        "appliances": [
            {"name": "Server Rack", "power_watts": 3000.0, "load_factor": 0.9, "standby_watts": 500.0}
        ],
    }
    res_a_room = client_a.post("/api/v1/rooms/", json=room_payload)
    assert res_a_room.status_code == 201
    room_a_id = res_a_room.json()["id"]

    # 2. Org A creates an audit task
    task_payload = {
        "title": "Alpha HVAC Maintenance",
        "description": "Clean air filters",
        "room_id": room_a_id,
        "priority": "high",
    }
    res_a_task = client_a.post("/api/v1/tasks/", json=task_payload)
    assert res_a_task.status_code == 201
    task_a_id = res_a_task.json()["id"]

    # 3. Org A creates a bill record
    bill_payload = {
        "biller": "Tata Power",
        "state": "Maharashtra",
        "site": "Mumbai HQ",
        "reference": "REF-ALPHA-99",
        "amount": 25000.0,
        "due_date": "2026-04-15",
    }
    res_a_bill = client_a.post("/api/v1/bill-records/", json=bill_payload)
    assert res_a_bill.status_code == 201
    bill_a_id = res_a_bill.json()["id"]

    # ── Verify Org B Isolation ─────────────────────────────────────────────

    # Org B lists rooms: must NOT see Org A's room
    res_b_rooms = client_b.get("/api/v1/rooms/")
    assert res_b_rooms.status_code == 200
    b_room_ids = [r["id"] for r in res_b_rooms.json()]
    assert room_a_id not in b_room_ids

    # Org B attempts to access Org A's room analysis: 404
    res_b_waste = client_b.get(f"/api/v1/rooms/{room_a_id}/waste-analysis/")
    assert res_b_waste.status_code == 404
    assert "not found" in res_b_waste.json()["detail"].lower()

    # Org B attempts to benchmark Org A's room: 404
    res_b_bench = client_b.get(f"/api/v1/analytics/benchmarks/{room_a_id}")
    assert res_b_bench.status_code == 404

    # Org B lists tasks: must NOT see Org A's task
    res_b_tasks = client_b.get("/api/v1/tasks/")
    assert res_b_tasks.status_code == 200
    b_task_ids = [t["id"] for t in res_b_tasks.json()]
    assert task_a_id not in b_task_ids

    # Org B attempts to modify Org A's task: 404
    res_b_update_task = client_b.patch(f"/api/v1/tasks/{task_a_id}", json={"status": "completed"})
    assert res_b_update_task.status_code == 404

    # Org B attempts to delete Org A's task: 404
    res_b_del_task = client_b.delete(f"/api/v1/tasks/{task_a_id}")
    assert res_b_del_task.status_code == 404

    # Org B lists bills: must NOT see Org A's bill
    res_b_bills = client_b.get("/api/v1/bill-records/")
    assert res_b_bills.status_code == 200
    b_bill_ids = [b["id"] for b in res_b_bills.json()]
    assert bill_a_id not in b_bill_ids

    # Org B attempts to modify Org A's bill: 404
    res_b_pay_bill = client_b.put(f"/api/v1/bill-records/{bill_a_id}/payment", json={"payment_reference": "HACKED"})
    assert res_b_pay_bill.status_code == 404

