from sqlalchemy.orm import Session, joinedload

import models
import schemas


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


def create_room(db: Session, room: schemas.RoomCreate, organization_id: int):
    db_room = models.Room(
        organization_id=organization_id,
        name=room.name.strip(),
        block=room.block.strip(),
    )
    db.add(db_room)
    db.commit()
    return get_room(db, db_room.id, organization_id)


def create_appliance(db: Session, appliance: schemas.ApplianceCreate, room_id: int):
    db_appliance = models.Appliance(
        name=appliance.name.strip(),
        power_watts=appliance.power_watts,
        room_id=room_id,
    )
    db.add(db_appliance)
    db.commit()
    db.refresh(db_appliance)
    return db_appliance


def create_schedule(db: Session, schedule: schemas.ScheduleCreate, room_id: int):
    db_schedule = models.Schedule(
        day_of_week=schedule.day_of_week.strip(),
        start_time=schedule.start_time,
        end_time=schedule.end_time,
        room_id=room_id,
    )
    db.add(db_schedule)
    db.commit()
    db.refresh(db_schedule)
    return db_schedule
