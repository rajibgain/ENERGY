from datetime import time
import pytest

import models
import services


def test_required_exact_energy_calculation():
    """EXACT REQUIRED TEST CASE:
    4.5 kW connected load, 2 idle hours, ₹8/kWh, 0.82 kg CO₂e/kWh
    -> exactly 9.0 kWh, ₹72.0, 7.38 kg CO₂e.
    """
    # 4.5 kW total load, load factor = 1.0, standby = 0 W
    room = models.Room(
        organization_id=1,
        name="Physics Lab 101",
        block="Science Block",
    )
    room.appliances = [
        models.Appliance(
            name="Lab Equipment Bench",
            power_watts=4500.0,
            load_factor=1.0,
            standby_watts=0.0,
        )
    ]

    # Daily operating baseline = 8 hours. Scheduled = 6 hours (09:00 to 15:00 everyday).
    # Idle hours = 8 - 6 = 2 hours.
    room.schedules = [
        models.Schedule(
            day_of_week="Everyday",
            start_time=time(9, 0),
            end_time=time(15, 0),
        )
    ]

    result = services.calculate_room_waste(
        room=room,
        tariff_rate=8.0,
        daily_op_hours=8.0,
        carbon_factor=0.82,
    )

    # 4.5 kW active load - 0 kW standby load = 4.5 kW avoidable load
    # 4.5 kW * 2 idle hours = exactly 9.0 kWh
    assert result["wasted_energy_kwh"] == 9.0, f"Expected 9.0 kWh, got {result['wasted_energy_kwh']}"

    # 9.0 kWh * ₹8/kWh = exactly ₹72.0
    assert result["financial_loss_inr"] == 72.0, f"Expected ₹72.0, got {result['financial_loss_inr']}"

    # 9.0 kWh * 0.82 kg CO₂e/kWh = exactly 7.38 kg CO₂e
    assert result["carbon_footprint_kg"] == 7.38, f"Expected 7.38 kg CO₂e, got {result['carbon_footprint_kg']}"

    # Efficiency score: 6h / 8h = 75.0%
    assert result["efficiency_score"] == 75.0


def test_energy_with_load_factor_and_standby():
    """Tests load factor (e.g. 0.6) and standby watts (e.g. 90W) calculation."""
    room = models.Room(
        organization_id=1,
        name="Office 202",
        block="Admin Wing",
    )
    room.appliances = [
        models.Appliance(
            name="Split AC Unit",
            power_watts=4500.0,
            load_factor=0.6,    # Active draw = 2700 W (2.7 kW)
            standby_watts=90.0, # Standby draw = 90 W (0.09 kW)
        )
    ]
    # 6 hours scheduled, 2 idle hours
    room.schedules = [
        models.Schedule(
            day_of_week="Everyday",
            start_time=time(9, 0),
            end_time=time(15, 0),
        )
    ]

    result = services.calculate_room_waste(
        room=room,
        tariff_rate=8.0,
        daily_op_hours=8.0,
        carbon_factor=0.82,
    )

    # Avoidable load = 2.7 kW - 0.09 kW = 2.61 kW
    # Modeled gap = 2.61 kW * 2 hours = 5.22 kWh
    assert result["wasted_energy_kwh"] == 5.22
    # Modeled cost = 5.22 * 8 = ₹41.76
    assert result["financial_loss_inr"] == 41.76
    # Modeled emissions = 5.22 * 0.82 = 4.28 kg CO₂e
    assert result["carbon_footprint_kg"] == 4.28


def test_schedule_overlapping_merge():
    """Tests that overlapping schedules are merged without double counting."""
    room = models.Room(organization_id=1, name="Lecture Hall A", block="Main")
    room.appliances = [models.Appliance(name="Lights", power_watts=1000.0, load_factor=1.0, standby_watts=0.0)]
    # Overlapping intervals on Monday: 09:00-11:00 and 10:00-12:00 -> should merge to 09:00-12:00 (3 hours on Monday = 3/7 h/day)
    room.schedules = [
        models.Schedule(day_of_week="Monday", start_time=time(9, 0), end_time=time(11, 0)),
        models.Schedule(day_of_week="Monday", start_time=time(10, 0), end_time=time(12, 0)),
    ]

    hours_per_day = services._scheduled_hours_per_day(room.schedules)
    assert round(hours_per_day, 4) == round(3.0 / 7.0, 4)


def test_time_of_use_blended_tariff():
    """Tests duration-weighted peak/off-peak blended tariff rate in Organization model."""
    org = models.Organization(
        name="Tech Campus",
        tariff_mode="time_of_use",
        tariff_rate=8.0,
        peak_tariff_rate=12.0,      # ₹12 during peak
        offpeak_tariff_rate=6.0,    # ₹6 off-peak
        peak_start_time=time(18, 0),# 18:00 to 22:00 = 4 hours peak (240 mins)
        peak_end_time=time(22, 0),
    )
    # 240 mins peak @ 12.0 + 1200 mins off-peak @ 6.0
    # Blended = (240 * 12 + 1200 * 6) / 1440 = (2880 + 7200) / 1440 = 10080 / 1440 = 7.0 ₹/kWh
    assert round(org.effective_tariff_rate, 2) == 7.0

