from datetime import datetime
from fastapi import HTTPException
from sqlalchemy.orm import Session, joinedload
from sqlalchemy.exc import IntegrityError

import models
import schemas
import services


def get_room(db: Session, room_id: int, organization_id: int):
    return (
        db.query(models.Room)
        .options(joinedload(models.Room.appliances), joinedload(models.Room.schedules))
        .filter(
            models.Room.id == room_id,
            models.Room.organization_id == organization_id,
        )
        .first()
    )


def get_rooms(db: Session, organization_id: int, skip: int = 0, limit: int = 100):
    return (
        db.query(models.Room)
        .options(joinedload(models.Room.appliances), joinedload(models.Room.schedules))
        .filter(models.Room.organization_id == organization_id)
        .offset(skip)
        .limit(limit)
        .all()
    )


def get_site(db: Session, site_id: int, organization_id: int):
    return db.query(models.Site).filter(
        models.Site.id == site_id,
        models.Site.organization_id == organization_id,
    ).first()


def get_sites(db: Session, organization_id: int):
    return (
        db.query(models.Site)
        .filter(models.Site.organization_id == organization_id)
        .order_by(models.Site.name)
        .all()
    )


def create_room(db: Session, room: schemas.RoomCreate, organization_id: int):
    site_id = room.site_id
    if site_id is not None and not get_site(db, site_id, organization_id):
        raise ValueError("Choose a location in this organization.")
    if site_id is None:
        default_site = (
            db.query(models.Site)
            .filter(models.Site.organization_id == organization_id)
            .order_by(models.Site.id)
            .first()
        )
        site_id = default_site.id if default_site else None
    db_room = models.Room(
        organization_id=organization_id,
        site_id=site_id,
        name=room.name.strip(),
        block=room.block.strip(),
        zone_type=room.zone_type.strip().lower() if room.zone_type else "general",
        area_sqm=room.area_sqm,
    )
    db.add(db_room)
    db.flush()
    for appliance in room.appliances:
        db.add(models.Appliance(
            name=appliance.name.strip(),
            power_watts=appliance.power_watts,
            load_factor=appliance.load_factor,
            standby_watts=appliance.standby_watts,
            room_id=db_room.id,
        ))
    db.commit()
    return get_room(db, db_room.id, organization_id)


def create_appliance(db: Session, appliance: schemas.ApplianceCreate, room_id: int):
    db_appliance = models.Appliance(
        name=appliance.name.strip(),
        power_watts=appliance.power_watts,
        load_factor=appliance.load_factor,
        standby_watts=appliance.standby_watts,
        room_id=room_id,
    )
    db.add(db_appliance)
    db.commit()
    db.refresh(db_appliance)
    return db_appliance


def create_schedule(db: Session, schedule: schemas.ScheduleCreate, room_id: int):
    # 1. Exact match check
    existing = db.query(models.Schedule).filter(
        models.Schedule.room_id == room_id,
        models.Schedule.day_of_week == schedule.day_of_week.strip(),
        models.Schedule.start_time == schedule.start_time,
        models.Schedule.end_time == schedule.end_time,
    ).first()
    if existing:
        return existing

    # 2. Overlap check against all active schedules in this room
    existing_schedules = db.query(models.Schedule).filter(models.Schedule.room_id == room_id).all()
    overlap = services.find_overlapping_schedule(
        existing_schedules,
        schedule.day_of_week.strip(),
        schedule.start_time,
        schedule.end_time,
    )
    if overlap:
        raise HTTPException(
            status_code=409,
            detail=f"Schedule interval overlaps with existing timetable entry on {overlap.day_of_week} "
                   f"({overlap.start_time.strftime('%H:%M')}–{overlap.end_time.strftime('%H:%M')}).",
        )

    db_schedule = models.Schedule(
        day_of_week=schedule.day_of_week.strip(),
        start_time=schedule.start_time,
        end_time=schedule.end_time,
        room_id=room_id,
    )
    db.add(db_schedule)
    try:
        db.commit()
        db.refresh(db_schedule)
    except IntegrityError:
        db.rollback()
        existing = db.query(models.Schedule).filter(
            models.Schedule.room_id == room_id,
            models.Schedule.day_of_week == schedule.day_of_week.strip(),
            models.Schedule.start_time == schedule.start_time,
            models.Schedule.end_time == schedule.end_time,
        ).first()
        if existing:
            return existing
        raise
    return db_schedule


def get_appliance_templates(db: Session, category: str | None = None):
    query = db.query(models.ApplianceTemplate)
    if category:
        query = query.filter(models.ApplianceTemplate.category == category)
    return query.order_by(models.ApplianceTemplate.category, models.ApplianceTemplate.name).all()


def get_audit_tasks(db: Session, organization_id: int, status: str | None = None):
    query = db.query(models.AuditTask).filter(models.AuditTask.organization_id == organization_id)
    if status and status != "all":
        query = query.filter(models.AuditTask.status == status)
    return query.order_by(models.AuditTask.created_at.desc()).all()


def get_audit_task(db: Session, task_id: int, organization_id: int):
    return db.query(models.AuditTask).filter(
        models.AuditTask.id == task_id,
        models.AuditTask.organization_id == organization_id,
    ).first()


def create_audit_task(db: Session, task_in: schemas.AuditTaskCreate, organization_id: int, user_id: int):
    task = models.AuditTask(
        organization_id=organization_id,
        title=task_in.title.strip(),
        description=task_in.description.strip(),
        assigned_to=task_in.assigned_to.strip() if task_in.assigned_to else None,
        due_date=task_in.due_date,
        priority=task_in.priority,
        room_id=task_in.room_id,
        created_by_id=user_id,
        status="open",
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


def update_audit_task(db: Session, task: models.AuditTask, updates: schemas.AuditTaskUpdate, tariff_rate: float = 8.0):
    data = updates.model_dump(exclude_unset=True)
    if "status" in data:
        if data["status"] == "completed" and task.status != "completed":
            task.completed_at = models.utc_now()
        elif data["status"] != "completed":
            task.completed_at = None

    for key, value in data.items():
        if isinstance(value, str):
            value = value.strip()
        setattr(task, key, value)

    # Automatically compute verified savings if before and after readings are set
    if task.before_reading_kwh is not None and task.after_reading_kwh is not None:
        diff_kwh = max(0.0, task.before_reading_kwh - task.after_reading_kwh)
        task.verified_savings_kwh = round(diff_kwh, 2)
        task.verified_savings_inr = round(diff_kwh * tariff_rate, 2)

    db.commit()
    db.refresh(task)
    return task


def delete_audit_task(db: Session, task: models.AuditTask):
    db.delete(task)
    db.commit()
