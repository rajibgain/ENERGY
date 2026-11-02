import csv
import io
from datetime import date, datetime
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


@router.get("/appliance-templates/", response_model=List[schemas.ApplianceTemplateView])
def get_appliance_templates(
    category: str | None = Query(None),
    context: AuthContext = Depends(require_roles("owner", "admin", "manager", "staff")),
    db: Session = Depends(get_db),
):
    return crud.get_appliance_templates(db, category=category)


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

        # Query existing schedule slots to avoid duplicates and overlaps
        existing_schedules = db.query(models.Schedule).filter(models.Schedule.room_id == room.id).all()
        existing_slots = {
            (s.day_of_week.strip().lower(), s.start_time, s.end_time)
            for s in existing_schedules
        }
        seen_in_batch = set()
        schedules = []
        skipped_duplicates = 0
        skipped_overlaps = 0
        active_intervals = list(existing_schedules)

        for row_number, row in enumerate(reader, start=2):
            try:
                schedule = schemas.ScheduleCreate(
                    day_of_week=row.get(field_map["day_of_week"], "").strip(),
                    start_time=row.get(field_map["start_time"], "").strip(),
                    end_time=row.get(field_map["end_time"], "").strip(),
                )
                slot_key = (schedule.day_of_week.lower(), schedule.start_time, schedule.end_time)
                # Exact duplicate check
                if slot_key in existing_slots or slot_key in seen_in_batch:
                    skipped_duplicates += 1
                    continue

                # Intersecting interval overlap check
                overlap = services.find_overlapping_schedule(
                    active_intervals,
                    schedule.day_of_week,
                    schedule.start_time,
                    schedule.end_time,
                )
                if overlap:
                    skipped_overlaps += 1
                    continue

                seen_in_batch.add(slot_key)
                db_sched = models.Schedule(
                    room_id=room.id,
                    day_of_week=schedule.day_of_week,
                    start_time=schedule.start_time,
                    end_time=schedule.end_time,
                )
                schedules.append(db_sched)
                active_intervals.append(db_sched)
            except Exception as exc:
                raise HTTPException(status_code=422, detail=f"Invalid schedule on CSV row {row_number}.") from exc

        if not schedules and skipped_duplicates == 0 and skipped_overlaps == 0:
            raise HTTPException(status_code=422, detail="The CSV has no schedule rows.")
        if schedules:
            db.add_all(schedules)
            db.commit()

        msg = f"Successfully added {len(schedules)} schedules to {room.name}."
        if skipped_duplicates > 0:
            msg += f" ({skipped_duplicates} duplicate entry/entries skipped)"
        if skipped_overlaps > 0:
            msg += f" ({skipped_overlaps} overlapping entry/entries skipped)"
        return {
            "message": msg,
            "count": len(schedules),
            "skipped_duplicates": skipped_duplicates,
            "skipped_overlaps": skipped_overlaps,
        }
    except HTTPException:
        raise
    except (UnicodeDecodeError, csv.Error) as exc:
        raise HTTPException(status_code=422, detail="Could not read this CSV as UTF-8.") from exc
    except Exception as exc:
        db.rollback()
        raise


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


# ── Meter Data CSV Upload & Analytics ──────────────────────────────────────


def _parse_meter_timestamp(raw_value: str) -> datetime:
    raw = raw_value.strip()
    formats = [
        "%Y-%m-%dT%H:%M:%S",
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%dT%H:%M",
        "%Y-%m-%d %H:%M",
        "%d/%m/%Y %H:%M:%S",
        "%d/%m/%Y %H:%M",
        "%d-%m-%Y %H:%M:%S",
        "%d-%m-%Y %H:%M",
        "%Y-%m-%d",
        "%d/%m/%Y",
        "%d-%m-%Y",
    ]
    for fmt in formats:
        try:
            return datetime.strptime(raw, fmt)
        except ValueError:
            continue
    raise ValueError(f"Unrecognized date/time format: '{raw_value}'")


@router.post("/meter-data/upload/", response_model=schemas.MeterUploadResponse)
def upload_meter_csv(
    file: UploadFile = File(...),
    context: AuthContext = Depends(require_roles("owner", "admin", "manager")),
    db: Session = Depends(get_db),
):
    if file.size is not None and file.size > 10 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="CSV files must be 10 MB or smaller.")
    try:
        content = file.file.read(10 * 1024 * 1024 + 1)
        if len(content) > 10 * 1024 * 1024:
            raise HTTPException(status_code=413, detail="CSV files must be 10 MB or smaller.")
        text = content.decode("utf-8-sig")
        reader = csv.DictReader(io.StringIO(text))

        if not reader.fieldnames:
            raise HTTPException(status_code=422, detail="The CSV file is empty.")

        header_map = {h.strip().lower(): h for h in reader.fieldnames}
        ts_key = next((k for k in ["timestamp", "datetime", "time", "date"] if k in header_map), None)
        kwh_key = next((k for k in ["kwh", "kwh_reading", "reading", "energy_kwh", "value"] if k in header_map), None)
        room_key = next((k for k in ["room_name", "zone_name", "room", "zone"] if k in header_map), None)
        interval_key = next((k for k in ["interval_minutes", "interval"] if k in header_map), None)

        if not ts_key or not kwh_key:
            raise HTTPException(
                status_code=422,
                detail="CSV must contain at least 'timestamp' and 'kwh' columns (or equivalent).",
            )

        # Preload rooms for quick matching
        org_rooms = {
            r.name.strip().lower(): r.id
            for r in db.query(models.Room.id, models.Room.name).filter(models.Room.organization_id == context.organization.id).all()
        }

        readings = []
        warnings = []

        for row_idx, row in enumerate(reader, start=2):
            raw_ts = row.get(header_map[ts_key], "")
            raw_kwh = row.get(header_map[kwh_key], "")

            if not raw_ts or not raw_kwh:
                continue

            try:
                parsed_ts = _parse_meter_timestamp(raw_ts)
            except ValueError as err:
                warnings.append(f"Row {row_idx}: {err}")
                continue

            try:
                kwh_val = float(raw_kwh.replace(",", ""))
                if kwh_val < 0:
                    warnings.append(f"Row {row_idx}: negative kWh value ignored ({kwh_val})")
                    continue
            except ValueError:
                warnings.append(f"Row {row_idx}: invalid numeric value '{raw_kwh}'")
                continue

            # Optional room association
            matched_room_id = None
            if room_key:
                raw_room_name = row.get(header_map[room_key], "").strip()
                if raw_room_name:
                    matched_room_id = org_rooms.get(raw_room_name.lower())
                    if not matched_room_id:
                        warnings.append(f"Row {row_idx}: room '{raw_room_name}' not found; assigned to portfolio level.")

            # Optional interval minutes
            interval_mins = 60
            if interval_key:
                try:
                    interval_mins = int(row.get(header_map[interval_key], "60"))
                except ValueError:
                    interval_mins = 60

            readings.append(models.MeterReading(
                organization_id=context.organization.id,
                room_id=matched_room_id,
                timestamp=parsed_ts,
                kwh_reading=round(kwh_val, 3),
                interval_minutes=interval_mins,
                source="csv_upload",
                uploaded_by_id=context.user.id,
            ))

        if not readings:
            detail = "No valid meter readings could be parsed from this file."
            if warnings:
                detail += f" ({len(warnings)} rows had errors, e.g.: {warnings[0]})"
            raise HTTPException(status_code=422, detail=detail)

        db.add_all(readings)
        db.commit()

        return schemas.MeterUploadResponse(
            message=f"Successfully imported {len(readings)} meter reading(s).",
            imported_count=len(readings),
            warnings=warnings[:10],
        )
    except HTTPException:
        db.rollback()
        raise
    except (UnicodeDecodeError, csv.Error) as exc:
        db.rollback()
        raise HTTPException(status_code=422, detail="Could not read CSV file.") from exc


@router.get("/meter-data/readings/", response_model=List[schemas.MeterReadingView])
def list_meter_readings(
    room_id: int | None = Query(None),
    limit: int = Query(100, ge=1, le=1000),
    context: AuthContext = Depends(require_roles("owner", "admin", "manager", "staff")),
    db: Session = Depends(get_db),
):
    query = db.query(models.MeterReading).filter(models.MeterReading.organization_id == context.organization.id)
    if room_id:
        query = query.filter(models.MeterReading.room_id == room_id)
    return query.order_by(models.MeterReading.timestamp.desc()).limit(limit).all()


@router.get("/meter-data/summary/", response_model=schemas.ModeledVsMeasuredSummary)
def get_modeled_vs_measured_summary(
    context: AuthContext = Depends(require_roles("owner", "admin", "manager", "staff")),
    db: Session = Depends(get_db),
):
    # Calculate modeled monthly energy for organization
    rooms = crud.get_rooms(db, organization_id=context.organization.id)
    total_daily_modeled_kwh = 0.0
    for r in rooms:
        analysis = services.calculate_room_waste(
            room=r,
            tariff_rate=context.organization.effective_tariff_rate,
            daily_op_hours=context.organization.operating_hours,
            carbon_factor=context.organization.carbon_factor,
        )
        total_daily_modeled_kwh += analysis.get("modeled_energy_kwh", 0.0)

    # Monthly modeled baseline (~30 days per month)
    monthly_modeled_kwh = round(total_daily_modeled_kwh * 30.0, 2)

    # Aggregate measured readings by month (YYYY-MM)
    readings = (
        db.query(models.MeterReading)
        .filter(models.MeterReading.organization_id == context.organization.id)
        .order_by(models.MeterReading.timestamp.asc())
        .all()
    )

    monthly_measured: dict[str, float] = {}
    for reading in readings:
        m_key = reading.timestamp.strftime("%Y-%m")
        monthly_measured[m_key] = monthly_measured.get(m_key, 0.0) + reading.kwh_reading

    items = []
    total_measured = 0.0
    total_modeled = 0.0

    if monthly_measured:
        for month_str, measured_val in sorted(monthly_measured.items()):
            measured_rounded = round(measured_val, 2)
            diff = round(monthly_modeled_kwh - measured_rounded, 2)
            pct = round((diff / monthly_modeled_kwh * 100), 1) if monthly_modeled_kwh > 0 else 0.0
            items.append(schemas.ModeledVsMeasuredItem(
                period=month_str,
                modeled_kwh=monthly_modeled_kwh,
                measured_kwh=measured_rounded,
                difference_kwh=diff,
                difference_pct=pct,
            ))
            total_measured += measured_rounded
            total_modeled += monthly_modeled_kwh
    else:
        # Provide current month baseline if no readings uploaded yet
        now_str = date.today().strftime("%Y-%m")
        items.append(schemas.ModeledVsMeasuredItem(
            period=now_str,
            modeled_kwh=monthly_modeled_kwh,
            measured_kwh=0.0,
            difference_kwh=monthly_modeled_kwh,
            difference_pct=100.0,
        ))
        total_modeled = monthly_modeled_kwh

    return schemas.ModeledVsMeasuredSummary(
        monthly_data=items,
        total_modeled_kwh=round(total_modeled, 2),
        total_measured_kwh=round(total_measured, 2),
        net_gap_kwh=round(total_modeled - total_measured, 2),
    )

