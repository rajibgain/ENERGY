import csv
import io
from datetime import date
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from fastapi.responses import Response
from sqlalchemy.orm import Session
from typing import List

import crud
import models
import schemas
import services
from auth_security import AuthContext, require_roles
from database import get_db


router = APIRouter(prefix="/api/v1", tags=["Facilities & electricity records"])
MAX_SCHEMATIC_BYTES = 10 * 1024 * 1024


def _read_schematic(file: UploadFile):
    filename = (file.filename or "").replace("\\", "/")
    extension = Path(filename).suffix.lower()
    formats = {
        ".png": ("image/png", lambda content: content.startswith(b"\x89PNG\r\n\x1a\n")),
        ".jpg": ("image/jpeg", lambda content: content.startswith(b"\xff\xd8\xff")),
        ".jpeg": ("image/jpeg", lambda content: content.startswith(b"\xff\xd8\xff")),
        ".webp": ("image/webp", lambda content: len(content) >= 12 and content[:4] == b"RIFF" and content[8:12] == b"WEBP"),
        ".pdf": ("application/pdf", lambda content: content.startswith(b"%PDF-")),
    }
    if extension not in formats:
        raise HTTPException(status_code=415, detail="Upload a PNG, JPG, WEBP or PDF building schematic.")
    content = file.file.read(MAX_SCHEMATIC_BYTES + 1)
    if len(content) > MAX_SCHEMATIC_BYTES:
        raise HTTPException(status_code=413, detail="Building schematics must be 10 MB or smaller.")
    content_type, matches_signature = formats[extension]
    if not matches_signature(content):
        raise HTTPException(status_code=415, detail="This file does not match its image or PDF type.")
    safe_name = "".join(
        char for char in Path(filename).name
        if char.isascii() and (char.isalnum() or char in " ._-")
    )[:120] or f"building-schematic{extension}"
    return content, content_type, safe_name


@router.post("/rooms/", response_model=schemas.Room, status_code=201)
def create_room(
    room: schemas.RoomCreate,
    context: AuthContext = Depends(require_roles("owner", "admin", "manager")),
    db: Session = Depends(get_db),
):
    if room.site_id is not None and not crud.get_site(db, room.site_id, context.organization.id):
        raise HTTPException(status_code=404, detail="Location not found in this organization.")
    return crud.create_room(db=db, room=room, organization_id=context.organization.id)


@router.get("/rooms/", response_model=List[schemas.Room])
def read_rooms(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=250),
    context: AuthContext = Depends(require_roles("owner", "admin", "manager", "staff")),
    db: Session = Depends(get_db),
):
    return crud.get_rooms(db, organization_id=context.organization.id, skip=skip, limit=limit)


@router.get("/sites/", response_model=List[schemas.SiteView])
def read_sites(
    context: AuthContext = Depends(require_roles("owner", "admin", "manager", "staff")),
    db: Session = Depends(get_db),
):
    return crud.get_sites(db, organization_id=context.organization.id)


@router.post("/sites/", response_model=schemas.SiteView, status_code=201)
def create_site(
    site: schemas.SiteCreate,
    context: AuthContext = Depends(require_roles("owner", "admin", "manager")),
    db: Session = Depends(get_db),
):
    saved = models.Site(
        organization_id=context.organization.id,
        **site.model_dump(),
    )
    db.add(saved)
    db.commit()
    db.refresh(saved)
    return saved


@router.patch("/sites/{site_id}/", response_model=schemas.SiteView)
def update_site(
    site_id: int,
    changes: schemas.SiteUpdate,
    context: AuthContext = Depends(require_roles("owner", "admin", "manager")),
    db: Session = Depends(get_db),
):
    saved = crud.get_site(db, site_id, context.organization.id)
    if not saved:
        raise HTTPException(status_code=404, detail="Location not found in this organization.")
    for key, value in changes.model_dump(exclude_unset=True).items():
        setattr(saved, key, value)
    db.commit()
    db.refresh(saved)
    return saved


@router.post("/sites/{site_id}/schematic/", response_model=schemas.SiteView)
def upload_site_schematic(
    site_id: int,
    file: UploadFile = File(...),
    context: AuthContext = Depends(require_roles("owner", "admin", "manager")),
    db: Session = Depends(get_db),
):
    site = crud.get_site(db, site_id, context.organization.id)
    if not site:
        raise HTTPException(status_code=404, detail="Location not found in this organization.")
    content, content_type, filename = _read_schematic(file)
    site.schematic_data = content
    site.schematic_content_type = content_type
    site.schematic_filename = filename
    db.commit()
    db.refresh(site)
    return site


@router.get("/sites/{site_id}/schematic/")
def read_site_schematic(
    site_id: int,
    context: AuthContext = Depends(require_roles("owner", "admin", "manager", "staff")),
    db: Session = Depends(get_db),
):
    site = crud.get_site(db, site_id, context.organization.id)
    if not site or not site.schematic_data:
        raise HTTPException(status_code=404, detail="No schematic is saved for this location.")
    filename = (site.schematic_filename or "building-schematic").replace('"', "").replace("\r", "").replace("\n", "")
    return Response(
        content=site.schematic_data,
        media_type=site.schematic_content_type or "application/octet-stream",
        headers={
            "Content-Disposition": f'inline; filename="{filename}"',
            "X-Content-Type-Options": "nosniff",
            "Content-Security-Policy": "sandbox",
            "Cache-Control": "private, no-store",
        },
    )


@router.delete("/sites/{site_id}/schematic/", response_model=schemas.SiteView)
def delete_site_schematic(
    site_id: int,
    context: AuthContext = Depends(require_roles("owner", "admin", "manager")),
    db: Session = Depends(get_db),
):
    site = crud.get_site(db, site_id, context.organization.id)
    if not site:
        raise HTTPException(status_code=404, detail="Location not found in this organization.")
    site.schematic_data = None
    site.schematic_content_type = None
    site.schematic_filename = None
    db.commit()
    db.refresh(site)
    return site


@router.patch("/rooms/{room_id}/site/", response_model=schemas.Room)
def move_room_to_site(
    room_id: int,
    changes: schemas.RoomSiteUpdate,
    context: AuthContext = Depends(require_roles("owner", "admin", "manager")),
    db: Session = Depends(get_db),
):
    room = crud.get_room(db, room_id, context.organization.id)
    if not room:
        raise HTTPException(status_code=404, detail="Room not found in this organization.")
    if not crud.get_site(db, changes.site_id, context.organization.id):
        raise HTTPException(status_code=404, detail="Location not found in this organization.")
    room.site_id = changes.site_id
    db.commit()
    return crud.get_room(db, room.id, context.organization.id)


@router.post("/rooms/{room_id}/appliances/", response_model=schemas.Appliance, status_code=201)
def create_appliance_for_room(
    room_id: int,
    appliance: schemas.ApplianceCreate,
    context: AuthContext = Depends(require_roles("owner", "admin", "manager")),
    db: Session = Depends(get_db),
):
    room = crud.get_room(db, room_id=room_id, organization_id=context.organization.id)
    if not room:
        raise HTTPException(status_code=404, detail="Facility zone not found.")
    return crud.create_appliance(db=db, appliance=appliance, room_id=room_id)


@router.post("/rooms/{room_id}/schedules/", response_model=schemas.Schedule, status_code=201)
def create_schedule_for_room(
    room_id: int,
    schedule: schemas.ScheduleCreate,
    context: AuthContext = Depends(require_roles("owner", "admin", "manager")),
    db: Session = Depends(get_db),
):
    room = crud.get_room(db, room_id=room_id, organization_id=context.organization.id)
    if not room:
        raise HTTPException(status_code=404, detail="Facility zone not found.")
    return crud.create_schedule(db=db, schedule=schedule, room_id=room_id)


@router.post("/rooms/{room_id}/schedules/upload/")
def upload_schedules_csv(
    room_id: int,
    file: UploadFile = File(...),
    context: AuthContext = Depends(require_roles("owner", "admin", "manager")),
    db: Session = Depends(get_db),
):
    room = crud.get_room(db, room_id=room_id, organization_id=context.organization.id)
    if not room:
        raise HTTPException(status_code=404, detail="Facility zone not found.")
    if file.size is not None and file.size > 10 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="CSV files must be 10 MB or smaller.")
    try:
        content = file.file.read(10 * 1024 * 1024 + 1)
        if len(content) > 10 * 1024 * 1024:
            raise HTTPException(status_code=413, detail="CSV files must be 10 MB or smaller.")
        text = content.decode("utf-8-sig")
        reader = csv.DictReader(io.StringIO(text))
        required_headers = {"day_of_week", "start_time", "end_time"}
        if not reader.fieldnames or not required_headers.issubset({header.strip().lower() for header in reader.fieldnames}):
            raise HTTPException(status_code=422, detail="CSV needs day_of_week, start_time and end_time columns.")
        field_map = {header.strip().lower(): header for header in reader.fieldnames}
        schedules = []
        for row_number, row in enumerate(reader, start=2):
            try:
                schedule = schemas.ScheduleCreate(
                    day_of_week=row.get(field_map["day_of_week"], "").strip(),
                    start_time=row.get(field_map["start_time"], "").strip(),
                    end_time=row.get(field_map["end_time"], "").strip(),
                )
                schedules.append(models.Schedule(
                    room_id=room.id,
                    day_of_week=schedule.day_of_week,
                    start_time=schedule.start_time,
                    end_time=schedule.end_time,
                ))
            except Exception as exc:
                raise HTTPException(status_code=422, detail=f"Invalid schedule on CSV row {row_number}.") from exc
        if not schedules:
            raise HTTPException(status_code=422, detail="The CSV has no schedule rows.")
        db.add_all(schedules)
        db.commit()
    except HTTPException:
        db.rollback()
        raise
    except (UnicodeDecodeError, csv.Error) as exc:
        db.rollback()
        raise HTTPException(status_code=422, detail="Could not read this CSV as UTF-8.") from exc
    return {"message": f"Successfully added {len(schedules)} schedules to {room.name}.", "count": len(schedules)}


@router.get("/rooms/{room_id}/waste-analysis/")
def analyze_room_waste(
    room_id: int,
    tariff_rate: float | None = Query(None, ge=0, le=1000),
    carbon_factor: float | None = Query(None, ge=0, le=3),
    operating_hours: float | None = Query(None, gt=0, le=24),
    context: AuthContext = Depends(require_roles("owner", "admin", "manager", "staff")),
    db: Session = Depends(get_db),
):
    room = crud.get_room(db, room_id=room_id, organization_id=context.organization.id)
    if not room:
        raise HTTPException(status_code=404, detail="Facility zone not found.")
    return services.calculate_room_waste(
        room=room,
        tariff_rate=tariff_rate if tariff_rate is not None else context.organization.effective_tariff_rate,
        daily_op_hours=operating_hours if operating_hours is not None else context.organization.operating_hours,
        carbon_factor=carbon_factor if carbon_factor is not None else context.organization.carbon_factor,
    )


@router.get("/campus-dashboard/")
def get_campus_dashboard(
    tariff_rate: float | None = Query(None, ge=0, le=1000),
    carbon_factor: float | None = Query(None, ge=0, le=3),
    operating_hours: float | None = Query(None, gt=0, le=24),
    context: AuthContext = Depends(require_roles("owner", "admin", "manager", "staff")),
    db: Session = Depends(get_db),
):
    all_rooms = crud.get_rooms(db, organization_id=context.organization.id)
    tariff = tariff_rate if tariff_rate is not None else context.organization.effective_tariff_rate
    emissions_factor = carbon_factor if carbon_factor is not None else context.organization.carbon_factor
    daily_hours = operating_hours if operating_hours is not None else context.organization.operating_hours

    total_wasted_kwh = total_financial_loss = total_co2 = total_efficiency = 0.0
    for room in all_rooms:
        analysis = services.calculate_room_waste(
            room=room,
            tariff_rate=tariff,
            daily_op_hours=daily_hours,
            carbon_factor=emissions_factor,
        )
        total_wasted_kwh += analysis["wasted_energy_kwh"]
        total_financial_loss += analysis["financial_loss_inr"]
        total_co2 += analysis["carbon_footprint_kg"]
        total_efficiency += analysis["efficiency_score"]

    average_efficiency = round(total_efficiency / len(all_rooms), 1) if all_rooms else 0
    return {
        "total_rooms_analyzed": len(all_rooms),
        "campus_wasted_energy_kwh": round(total_wasted_kwh, 2),
        "campus_financial_loss_inr": round(total_financial_loss, 2),
        "campus_carbon_footprint_kg": round(total_co2, 2),
        "campus_efficiency_score": average_efficiency,
    }


@router.get("/bill-records/", response_model=list[schemas.BillView])
def list_bill_records(
    context: AuthContext = Depends(require_roles("owner", "admin", "manager")),
    db: Session = Depends(get_db),
):
    return (
        db.query(models.BillRecord)
        .filter(models.BillRecord.organization_id == context.organization.id)
        .order_by(models.BillRecord.due_date.desc(), models.BillRecord.id.desc())
        .all()
    )


@router.post("/bill-records/", response_model=schemas.BillView, status_code=201)
def create_bill_record(
    payload: schemas.BillCreate,
    context: AuthContext = Depends(require_roles("owner", "admin", "manager")),
    db: Session = Depends(get_db),
):
    record = models.BillRecord(
        organization_id=context.organization.id,
        biller=payload.biller.strip(),
        state=payload.state.strip(),
        site=payload.site.strip(),
        reference=payload.reference.strip() or "—",
        amount=payload.amount,
        due_date=payload.due_date,
        created_by_id=context.user.id,
        status="due",
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


@router.put("/bill-records/{record_id}/payment", response_model=schemas.BillView)
def record_external_payment(
    record_id: int,
    payload: schemas.BillPaymentRecord,
    context: AuthContext = Depends(require_roles("owner", "admin", "manager")),
    db: Session = Depends(get_db),
):
    record = (
        db.query(models.BillRecord)
        .filter(models.BillRecord.id == record_id, models.BillRecord.organization_id == context.organization.id)
        .first()
    )
    if not record:
        raise HTTPException(status_code=404, detail="Bill record not found.")
    if record.status == "void":
        raise HTTPException(status_code=409, detail="Archived bill records cannot be reconciled.")
    record.status = "paid"
    record.paid_date = date.today()
    record.payment_reference = payload.payment_reference.strip()
    db.commit()
    db.refresh(record)
    return record


@router.patch("/bill-records/{record_id}", response_model=schemas.BillView)
def update_bill_status(
    record_id: int,
    payload: schemas.BillStatusUpdate,
    context: AuthContext = Depends(require_roles("owner", "admin", "manager")),
    db: Session = Depends(get_db),
):
    record = (
        db.query(models.BillRecord)
        .filter(models.BillRecord.id == record_id, models.BillRecord.organization_id == context.organization.id)
        .first()
    )
    if not record:
        raise HTTPException(status_code=404, detail="Bill record not found.")
    if record.status == "paid" and payload.status == "due":
        raise HTTPException(status_code=409, detail="A paid bill cannot be reopened from this screen.")
    record.status = payload.status
    db.commit()
    db.refresh(record)
    return record
