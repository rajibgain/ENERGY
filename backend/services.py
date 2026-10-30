import models


_WEEKDAYS = ("monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday")


def _scheduled_hours_per_day(schedules):
    """Average weekly schedule coverage, merging overlaps so a zone is not counted twice."""
    intervals_by_day = [[] for _ in _WEEKDAYS]
    for schedule in schedules:
        label = str(schedule.day_of_week or "").strip().lower()
        start = schedule.start_time.hour * 60 + schedule.start_time.minute
        end = schedule.end_time.hour * 60 + schedule.end_time.minute
        if start == end:
            continue
        if end < start:
            end += 24 * 60
        days = range(7) if label in {"everyday", "daily", "all days"} else [_WEEKDAYS.index(label) if label in _WEEKDAYS else -1]
        for day in days:
            if day < 0:
                continue
            if end <= 24 * 60:
                intervals_by_day[day].append((start, end))
            else:
                intervals_by_day[day].append((start, 24 * 60))
                intervals_by_day[(day + 1) % 7].append((0, end - 24 * 60))

    weekly_minutes = 0
    for intervals in intervals_by_day:
        current = None
        for start, end in sorted(intervals):
            if current is None:
                current = [start, end]
            elif start <= current[1]:
                current[1] = max(current[1], end)
            else:
                weekly_minutes += current[1] - current[0]
                current = [start, end]
        if current is not None:
            weekly_minutes += current[1] - current[0]
    return weekly_minutes / 60 / 7

def calculate_room_waste(
    room: models.Room,
    tariff_rate: float = 8.0,
    daily_op_hours: float = 8.0,
    carbon_factor: float = 0.82,
):
    """
    Calculates the energy and financial waste of a room.
    Defaults are demo assumptions; live workspaces should set local tariff and operating hours.
    """
    # Keep rated capacity separate from estimated operating and standby loads.
    total_kw = sum(app.power_watts for app in room.appliances) / 1000.0
    active_kw = sum(app.power_watts * (app.load_factor if app.load_factor is not None else 1.0) for app in room.appliances) / 1000.0
    standby_kw = sum(app.standby_watts or 0.0 for app in room.appliances) / 1000.0

    # 2. Calculate average daily schedule coverage, merging overlapping entries.
    scheduled_hours = _scheduled_hours_per_day(room.schedules)

    # 3. Calculate Empty (Wasted) Hours
    empty_hours = daily_op_hours - scheduled_hours
    if empty_hours < 0:
        empty_hours = 0.0  # Can't have negative waste if classes exceed normal hours

    # 4. Calculate Environmental & Financial Metrics
    wasted_kwh = max(0.0, active_kw - standby_kw) * empty_hours
    modeled_energy_kwh = active_kw * scheduled_hours + standby_kw * empty_hours
    financial_loss = wasted_kwh * tariff_rate
    co2_emissions = wasted_kwh * carbon_factor

    # 5. Calculate Efficiency Score
    utilization = (scheduled_hours / daily_op_hours * 100) if daily_op_hours > 0 else 0
    efficiency_score = min(100, max(0, utilization))

    return {
        "room_name": room.name,
        "total_load_kw": total_kw,
        "active_load_kw": active_kw,
        "standby_load_kw": standby_kw,
        "total_scheduled_hours": round(scheduled_hours, 2),
        "total_empty_hours": round(empty_hours, 2),
        "daily_wasted_hours": round(empty_hours, 2),
        "wasted_energy_kwh": round(wasted_kwh, 2),
        "modeled_energy_kwh": round(modeled_energy_kwh, 2),
        "financial_loss_inr": round(financial_loss, 2),
        "carbon_footprint_kg": round(co2_emissions, 2),
        "efficiency_score": round(efficiency_score, 1)
    }
