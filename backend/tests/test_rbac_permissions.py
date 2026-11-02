import pytest
import io


def test_rbac_staff_role_restrictions(make_authenticated_client):
    client_staff, user_staff, org = make_authenticated_client("staff@test.com", "Test Org", "staff")

    # Staff CAN read rooms
    assert client_staff.get("/api/v1/rooms/").status_code == 200

    # Staff CANNOT create a room
    room_payload = {
        "name": "Staff Room",
        "block": "Block B",
        "zone_type": "classroom",
        "area_sqm": 50.0,
        "appliances": [{"name": "Fan", "power_watts": 75.0, "load_factor": 1.0, "standby_watts": 0.0}],
    }
    res_create_room = client_staff.post("/api/v1/rooms/", json=room_payload)
    assert res_create_room.status_code == 403

    # Staff CANNOT upload schedules
    csv_file = ("schedule.csv", io.BytesIO(b"day_of_week,start_time,end_time\nMonday,09:00,10:00"), "text/csv")
    assert client_staff.post("/api/v1/rooms/1/schedules/upload/", files={"file": csv_file}).status_code == 403

    # Staff CANNOT create or delete tasks
    assert client_staff.post("/api/v1/tasks/", json={"title": "Test Task"}).status_code == 403
    assert client_staff.delete("/api/v1/tasks/1").status_code == 403

    # Staff CANNOT read or create bill records
    assert client_staff.get("/api/v1/bill-records/").status_code == 403
    bill_payload = {
        "biller": "Tata Power",
        "state": "Maharashtra",
        "site": "HQ",
        "reference": "REF",
        "amount": 100.0,
        "due_date": "2026-05-01",
    }
    assert client_staff.post("/api/v1/bill-records/", json=bill_payload).status_code == 403

    # Staff CANNOT manage team members or invitations
    assert client_staff.get("/api/v1/auth/members").status_code == 403
    assert client_staff.post("/api/v1/auth/invitations", json={"email": "new@test.com", "role": "staff"}).status_code == 403


def test_rbac_manager_role_capabilities_and_limits(make_authenticated_client):
    client_mgr, user_mgr, org = make_authenticated_client("manager@test.com", "Manager Org", "manager")

    # Manager CAN create rooms and tasks
    room_payload = {
        "name": "Manager Lab",
        "block": "Block C",
        "zone_type": "lab",
        "area_sqm": 60.0,
        "appliances": [{"name": "Oscilloscope", "power_watts": 200.0, "load_factor": 0.5, "standby_watts": 20.0}],
    }
    res_room = client_mgr.post("/api/v1/rooms/", json=room_payload)
    assert res_room.status_code == 201
    room_id = res_room.json()["id"]

    res_task = client_mgr.post("/api/v1/tasks/", json={"title": "Calibrate sensors", "room_id": room_id})
    assert res_task.status_code == 201

    # Manager CAN view and add bills
    bill_payload = {
        "biller": "MSEDCL",
        "state": "Maharashtra",
        "site": "Lab Building",
        "reference": "REF-MGR-1",
        "amount": 12000.0,
        "due_date": "2026-06-01",
    }
    assert client_mgr.post("/api/v1/bill-records/", json=bill_payload).status_code == 201
    assert client_mgr.get("/api/v1/bill-records/").status_code == 200

    # Manager CANNOT update organization profile
    res_org_update = client_mgr.patch("/api/v1/auth/organization", json={"name": "Hacked Name"})
    assert res_org_update.status_code == 403

    # Manager CANNOT list or issue team invitations
    assert client_mgr.get("/api/v1/auth/invitations").status_code == 403
    assert client_mgr.post("/api/v1/auth/invitations", json={"email": "other@test.com", "role": "staff"}).status_code == 403


def test_rbac_admin_vs_owner_invitation_restrictions(make_authenticated_client):
    client_admin, user_admin, org = make_authenticated_client("admin@test.com", "Admin Org", "admin")

    # Admin CAN invite a manager or staff
    res_invite_staff = client_admin.post("/api/v1/auth/invitations", json={"email": "staff1@test.com", "role": "staff"})
    assert res_invite_staff.status_code in (200, 201)

    # Admin CANNOT invite another admin (Only Owner can invite Admin)
    res_invite_admin = client_admin.post("/api/v1/auth/invitations", json={"email": "admin2@test.com", "role": "admin"})
    assert res_invite_admin.status_code == 403
    assert "only the owner can invite an admin" in res_invite_admin.json()["detail"].lower()
