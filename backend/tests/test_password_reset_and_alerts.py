import pytest
from datetime import date, timedelta
from auth_security import create_password_reset_token, decode_password_reset_token, verify_password
import models


def test_password_reset_flow(client, db_session, test_user):
    # 1. Request password reset for existing user
    res = client.post("/api/v1/auth/forgot-password", json={"email": test_user.email})
    assert res.status_code == 200
    assert "instructions have been sent" in res.json()["message"]

    # 2. Request password reset for non-existent user (must return same generic message for security)
    res_unknown = client.post("/api/v1/auth/forgot-password", json={"email": "nonexistent@unknown.com"})
    assert res_unknown.status_code == 200
    assert "instructions have been sent" in res_unknown.json()["message"]

    # 3. Create a valid reset token
    token = create_password_reset_token(test_user.id, test_user.email)
    claims = decode_password_reset_token(token)
    assert claims["sub"] == str(test_user.id)
    assert claims["email"] == test_user.email
    assert claims["purpose"] == "password_reset"

    # 4. Attempt reset with an invalid/tampered token
    tampered_token = token + "xyz"
    bad_res = client.post("/api/v1/auth/reset-password", json={"token": tampered_token, "new_password": "NewStrongPass123!"})
    assert bad_res.status_code == 400

    # 5. Attempt reset with a weak password (fails validation)
    weak_res = client.post("/api/v1/auth/reset-password", json={"token": token, "new_password": "weak"})
    assert weak_res.status_code == 422

    # 6. Execute successful password reset
    new_pass = "BrandNewSecurePassword123!"
    success_res = client.post("/api/v1/auth/reset-password", json={"token": token, "new_password": new_pass})
    assert success_res.status_code == 200
    assert "successfully updated" in success_res.json()["message"]

    # Verify password in DB was changed and authenticates
    db_session.refresh(test_user)
    assert verify_password(new_pass, test_user.password_hash)


def test_automated_alerts_dispatch(auth_client, db_session, test_organization, test_user):
    # 1. Seed a bill due in 3 days
    due_date = date.today() + timedelta(days=3)
    bill = models.BillRecord(
        organization_id=test_organization.id,
        biller="Adani Electricity",
        state="Maharashtra",
        site="Campus Site",
        reference="BILL-ALERT-1",
        amount=18500.0,
        due_date=due_date,
        status="due",
        created_by_id=test_user.id,
    )
    db_session.add(bill)

    # 2. Seed a room with high idle energy gap (waste > 50 kWh/day)
    # 10 kW total load, 0 operating hours = 8h empty * 10kW = 80 kWh/day waste
    high_waste_room = models.Room(
        name="Large Central Auditorium",
        block="Main Complex",
        zone_type="auditorium",
        area_sqm=500.0,
        organization_id=test_organization.id,
    )
    db_session.add(high_waste_room)
    db_session.flush()

    appliance = models.Appliance(
        name="Central Chiller Fan",
        power_watts=10000.0,
        load_factor=1.0,
        standby_watts=0.0,
        room_id=high_waste_room.id,
    )
    db_session.add(appliance)
    db_session.commit()

    # 3. Trigger alert dispatch endpoint
    res = auth_client.post("/api/v1/analytics/alerts/dispatch/")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "completed"
    assert data["due_bills_found"] >= 1
    assert data["recipients_count"] >= 1

