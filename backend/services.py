from datetime import time as dt_time
import models


_WEEKDAYS = ("monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday")


def _to_minutes(val) -> int:
    if isinstance(val, dt_time):
        return val.hour * 60 + val.minute
    if isinstance(val, str):
        parts = val.strip().split(":")
        return int(parts[0]) * 60 + int(parts[1])
    raise ValueError(f"Cannot convert {val} to minutes")


def schedule_to_segments(day_label: str, start_val, end_val) -> list[tuple[int, int, int]]:
    """Converts a schedule day and time interval into normalized (day_index, start_min, end_min) segments."""
    label = str(day_label or "").strip().lower()
    start_m = _to_minutes(start_val)
    end_m = _to_minutes(end_val)
    if start_m == end_m:
        return []

    if label in {"everyday", "daily", "all days"}:
        day_indices = list(range(7))
    elif label in _WEEKDAYS:
        day_indices = [_WEEKDAYS.index(label)]
    else:
        return []

    segments = []
    for d in day_indices:
        if end_m > start_m:
            segments.append((d, start_m, end_m))
        else:
            # Overnight schedule: wraps around midnight into following day
            segments.append((d, start_m, 24 * 60))
            segments.append(((d + 1) % 7, 0, end_m))
    return segments


def schedules_overlap(day1: str, start1, end1, day2: str, start2, end2) -> bool:
    """Returns True if two schedule intervals intersect on any common calendar day."""
    segs1 = schedule_to_segments(day1, start1, end1)
    segs2 = schedule_to_segments(day2, start2, end2)
    for d1, s1, e1 in segs1:
        for d2, s2, e2 in segs2:
            if d1 == d2 and max(s1, s2) < min(e1, e2):
                return True
    return False


def find_overlapping_schedule(existing_schedules, day: str, start, end):
    """Finds the first existing schedule that overlaps with the proposed (day, start, end)."""
    new_segs = schedule_to_segments(day, start, end)
    for existing in existing_schedules:
        ex_segs = schedule_to_segments(existing.day_of_week, existing.start_time, existing.end_time)
        for d1, s1, e1 in new_segs:
            for d2, s2, e2 in ex_segs:
                if d1 == d2 and max(s1, s2) < min(e1, e2):
                    return existing
    return None


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
