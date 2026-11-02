from collections import defaultdict
from datetime import date, datetime, timedelta
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload

import crud
import models
import schemas
import services
from auth_security import AuthContext, require_roles
from database import get_db
from email_service import send_bill_alert, send_email

router = APIRouter(prefix="/api/v1", tags=["Analytics, Tasks & Benchmarks"])

# ───────────────────────────────────────────────────────────────────────────
# Authoritative ECBC 2017 & BEE Reference Benchmarks
# References:
#   - Energy Conservation Building Code (ECBC) 2017, Bureau of Energy Efficiency (BEE),
#     Ministry of Power, Government of India (Table 11.1 & 11.2, Composite Climate Zone).
#   - BEE Star Rating Scheme for Commercial Buildings (Baseline EPIs).
#   - GRIHA v2019 Indian Green Building Rating System.
# ───────────────────────────────────────────────────────────────────────────
ECBC_BENCHMARKS = {
    "office": {
        "label": "Commercial Office — ECBC 2017 Compliant (Standard Code Baseline)",
        "kwh_per_sqm_year": 140.0,
        "benchmark_type": "statutory_code",
        "climate_zone": "Composite / Warm-Humid Standard (Daytime 8-10h)",
        "source": "ECBC 2017 Section 3 & Appendix E, Bureau of Energy Efficiency (BEE), Ministry of Power, Govt of India (Statutory Code Baseline for daytime commercial offices)",
        "year": 2017,
    },
    "office_plus": {
        "label": "Commercial Office — ECBC+ (35% Energy Savings Beyond Baseline)",
        "kwh_per_sqm_year": 115.0,
        "benchmark_type": "statutory_code",
        "climate_zone": "Composite / Warm-Humid Standard (Daytime 8-10h)",
        "source": "ECBC 2017 Section 1.2 & Appendix E, BEE India (Statutory ECBC+ Tier for high performance buildings)",
        "year": 2017,
    },
    "office_super": {
        "label": "Commercial Office — Super ECBC (50% Energy Savings / Near-Zero Target)",
        "kwh_per_sqm_year": 90.0,
        "benchmark_type": "statutory_code",
        "climate_zone": "Composite / Warm-Humid Standard (Daytime 8-10h)",
        "source": "ECBC 2017 Section 1.2 & Appendix E, BEE India (Statutory Super ECBC Tier for ultra-efficient buildings)",
        "year": 2017,
    },
    "office_ultra": {
        "label": "Commercial Office — Super ECBC (50% Energy Savings / Near-Zero Target)",
        "kwh_per_sqm_year": 90.0,
        "benchmark_type": "statutory_code",
        "climate_zone": "Composite / Warm-Humid Standard (Daytime 8-10h)",
        "source": "ECBC 2017 Section 1.2 & Appendix E, BEE India (Statutory Super ECBC Tier for ultra-efficient buildings)",
        "year": 2017,
    },
    "education": {
        "label": "Educational Institution Overall Campus Space",
        "kwh_per_sqm_year": 100.0,
        "benchmark_type": "indicative_space",
        "climate_zone": "Composite / Warm-Humid Standard",
        "source": "BEE Star Rating & ECO-III Energy Audit Benchmark (Indicative operational space-type benchmark; not a standalone statutory room mandate)",
        "year": 2018,
    },
    "classroom": {
        "label": "Academic Classroom / Lecture Hall",
        "kwh_per_sqm_year": 95.0,
        "benchmark_type": "indicative_space",
        "climate_zone": "Composite / Warm-Humid Standard",
        "source": "BEE Energy Audit Reference Baseline & ECBC Chapter 6 LPD space guidelines (Indicative operational space-type benchmark)",
        "year": 2018,
    },
    "lab": {
        "label": "Science / Computer Research Laboratory",
        "kwh_per_sqm_year": 160.0,
        "benchmark_type": "indicative_space",
        "climate_zone": "Composite / Warm-Humid Standard",
        "source": "BEE High Plug-Load Institutional Benchmark & ECO-III Audit Guide (Indicative operational space-type benchmark)",
        "year": 2018,
    },
    "hospital": {
        "label": "Healthcare / Hospital Facility",
        "kwh_per_sqm_year": 200.0,
        "benchmark_type": "statutory_code",
        "climate_zone": "Composite / Warm-Humid Standard (24x7)",
        "source": "BEE Star Rating Scheme for Commercial Buildings — Hospitals (Statutory whole-building operational baseline)",
        "year": 2019,
    },
    "hotel": {
        "label": "Hospitality / Hotel Facility",
        "kwh_per_sqm_year": 300.0,
        "benchmark_type": "statutory_code",
        "climate_zone": "Composite / Warm-Humid Standard",
        "source": "BEE Star Rating Scheme for Commercial Buildings — Hotels (Statutory 3-to-4 star property whole-building baseline)",
        "year": 2019,
    },
    "retail": {
        "label": "Shopping Mall / Retail Store",
        "kwh_per_sqm_year": 180.0,
        "benchmark_type": "statutory_code",
        "climate_zone": "Composite / Warm-Humid Standard",
        "source": "BEE Star Rating Scheme for Commercial Buildings — Shopping Malls (Statutory whole-building baseline)",
        "year": 2019,
    },
    "it_datacenter": {
        "label": "IT / Server Room / Data Facility",
        "kwh_per_sqm_year": 400.0,
        "benchmark_type": "indicative_space",
        "climate_zone": "Conditioned High Density",
        "source": "BEE Commercial Data Center Guidelines & IGBC Data Center Standard (Indicative operational space-type baseline)",
        "year": 2022,
    },
    "warehouse": {
        "label": "Warehouse / Logistics Storage",
        "kwh_per_sqm_year": 50.0,
        "benchmark_type": "indicative_space",
        "climate_zone": "Unconditioned Storage",
        "source": "BEE Commercial Storage Energy Audit Baseline (Indicative operational space-type benchmark)",
        "year": 2019,
    },
    "general": {
        "label": "General / Mixed-Use Common Space",
        "kwh_per_sqm_year": 120.0,
        "benchmark_type": "indicative_space",
        "climate_zone": "Composite / Warm-Humid Standard",
        "source": "BEE Mixed-use commercial baseline approximation (Indicative operational benchmark)",
        "year": 2017,
    },
}


# ── Actionable Tasks & Audit Register ──────────────────────────────────────


@router.get("/tasks/", response_model=List[schemas.AuditTaskView])
def list_tasks(
    status: str | None = Query("all"),
    context: AuthContext = Depends(require_roles("owner", "admin", "manager", "staff")),
    db: Session = Depends(get_db),
):
    return crud.get_audit_tasks(db, organization_id=context.organization.id, status=status)


@router.post("/tasks/", response_model=schemas.AuditTaskView, status_code=201)
def create_task(
    payload: schemas.AuditTaskCreate,
    context: AuthContext = Depends(require_roles("owner", "admin", "manager")),
    db: Session = Depends(get_db),
):
    if payload.room_id is not None:
        room = crud.get_room(db, payload.room_id, context.organization.id)
        if not room:
            raise HTTPException(status_code=404, detail="Zone not found in this organization.")

    return crud.create_audit_task(
        db=db,
        task_in=payload,
        organization_id=context.organization.id,
        user_id=context.user.id,
    )


@router.put("/tasks/{task_id}", response_model=schemas.AuditTaskView)
@router.patch("/tasks/{task_id}", response_model=schemas.AuditTaskView)
def update_task(
    task_id: int,
    payload: schemas.AuditTaskUpdate,
    context: AuthContext = Depends(require_roles("owner", "admin", "manager")),
    db: Session = Depends(get_db),
):
    task = crud.get_audit_task(db, task_id, context.organization.id)
    if not task:
        raise HTTPException(status_code=404, detail="Audit task not found.")

    if payload.room_id is not None and payload.room_id != task.room_id:
        room = crud.get_room(db, payload.room_id, context.organization.id)
        if not room:
            raise HTTPException(status_code=404, detail="Zone not found in this organization.")

    return crud.update_audit_task(
        db=db,
        task=task,
        updates=payload,
        tariff_rate=context.organization.effective_tariff_rate,
    )


@router.delete("/tasks/{task_id}", status_code=204)
def delete_task(
    task_id: int,
    context: AuthContext = Depends(require_roles("owner", "admin")),
    db: Session = Depends(get_db),
):
    task = crud.get_audit_task(db, task_id, context.organization.id)
    if not task:
        raise HTTPException(status_code=404, detail="Audit task not found.")
    crud.delete_audit_task(db, task)


# ── Bill Trends & Anomaly Detection (>20% Rolling Average) ────────────────


@router.get("/analytics/bill-trends/", response_model=List[schemas.BillTrendItem])
def get_bill_trends(
    context: AuthContext = Depends(require_roles("owner", "admin", "manager", "staff")),
    db: Session = Depends(get_db),
):
    bills = (
        db.query(models.BillRecord)
        .filter(models.BillRecord.organization_id == context.organization.id)
        .filter(models.BillRecord.status != "void")
        .order_by(models.BillRecord.due_date.asc())
        .all()
    )

    monthly_totals: dict[str, list[float]] = defaultdict(list)
    for bill in bills:
        m_str = bill.due_date.strftime("%Y-%m")
        monthly_totals[m_str].append(bill.amount)

    sorted_months = sorted(monthly_totals.keys())
    trend_items: list[schemas.BillTrendItem] = []
    past_amounts: list[float] = []

    for month_str in sorted_months:
        amounts = monthly_totals[month_str]
        total_month = sum(amounts)
        count_month = len(amounts)
        avg_month = total_month / count_month if count_month else 0.0

        is_anomaly = False
        rolling_avg = None

        if len(past_amounts) >= 3:
            # 3-month rolling average of prior months
            rolling_avg = round(sum(past_amounts[-3:]) / 3.0, 2)
            # Anomaly flag: current month is >20% above the rolling average
            if total_month > 1.20 * rolling_avg:
                is_anomaly = True

        trend_items.append(schemas.BillTrendItem(
            month=month_str,
            total_amount=round(total_month, 2),
            bill_count=count_month,
            avg_amount=round(avg_month, 2),
            rolling_avg=rolling_avg,
            is_anomaly=is_anomaly,
        ))

        past_amounts.append(total_month)

    return trend_items


# ── Next-Month Bill Forecasting (Local Regression ML) ──────────────────────


@router.get("/analytics/forecast/", response_model=schemas.BillForecastView)
def get_bill_forecast(
    context: AuthContext = Depends(require_roles("owner", "admin", "manager", "staff")),
    db: Session = Depends(get_db),
):
    bills = (
        db.query(models.BillRecord)
        .filter(models.BillRecord.organization_id == context.organization.id)
        .filter(models.BillRecord.status != "void")
        .order_by(models.BillRecord.due_date.asc())
        .all()
    )

    monthly_map: dict[str, float] = defaultdict(float)
    for bill in bills:
        m_key = bill.due_date.strftime("%Y-%m")
        monthly_map[m_key] += bill.amount

    sorted_months = sorted(monthly_map.keys())
    historical = [
        schemas.HistoricalMonthAmount(month=m, amount=round(monthly_map[m], 2))
        for m in sorted_months
    ]

    effective_tariff = context.organization.effective_tariff_rate or 8.0

    if len(sorted_months) >= 2:
        # Linear Regression ML Model
        # X: 0, 1, ..., n-1
        # Y: monthly amounts
        n = len(sorted_months)
        x_vals = list(range(n))
        y_vals = [monthly_map[m] for m in sorted_months]

        x_mean = sum(x_vals) / n
        y_mean = sum(y_vals) / n

        numerator = sum((x_vals[i] - x_mean) * (y_vals[i] - y_mean) for i in range(n))
        denominator = sum((x_vals[i] - x_mean) ** 2 for i in range(n))

        slope = numerator / denominator if denominator != 0 else 0.0
        intercept = y_mean - slope * x_mean

        # Predict next month (X = n)
        pred_amount = max(0.0, intercept + slope * n)

        # R² Calculation
        ss_tot = sum((y - y_mean) ** 2 for y in y_vals)
        ss_res = sum((y_vals[i] - (intercept + slope * x_vals[i])) ** 2 for i in range(n))
        r2 = max(0.0, min(1.0, 1.0 - (ss_res / ss_tot))) if ss_tot > 0 else 1.0

        # Calculate next month label
        last_dt = datetime.strptime(sorted_months[-1], "%Y-%m")
        if last_dt.month == 12:
            next_dt = datetime(last_dt.year + 1, 1, 1)
        else:
            next_dt = datetime(last_dt.year, last_dt.month + 1, 1)
        next_month_str = next_dt.strftime("%Y-%m")

        # Trend classification
        pct_change = (slope / y_mean) if y_mean > 0 else 0
        if pct_change > 0.03:
            trend_label = "increasing"
        elif pct_change < -0.03:
            trend_label = "decreasing"
        else:
            trend_label = "stable"

        pred_kwh = round(pred_amount / effective_tariff, 2)

        return schemas.BillForecastView(
            historical_months=historical,
            predicted_month=next_month_str,
            predicted_amount=round(pred_amount, 2),
            predicted_kwh=pred_kwh,
            confidence_r2=round(r2, 3),
            trend=trend_label,
        )

    # Fallback when fewer than 2 historical bill records exist:
    # Use current modeled consumption as baseline
    rooms = crud.get_rooms(db, organization_id=context.organization.id)
    daily_modeled = sum(
        services.calculate_room_waste(
            room=r,
            tariff_rate=effective_tariff,
            daily_op_hours=context.organization.operating_hours,
            carbon_factor=context.organization.carbon_factor,
        ).get("modeled_energy_kwh", 0.0)
        for r in rooms
    )
    month_modeled_kwh = round(daily_modeled * 30.0, 2)
    if month_modeled_kwh <= 0:
        # Fallback baseline when no rooms/equipment configured yet
        month_modeled_kwh = 150.0
    month_modeled_amount = round(month_modeled_kwh * effective_tariff, 2)

    now = models.utc_now()
    next_m = (now.month % 12) + 1
    next_y = now.year if now.month < 12 else now.year + 1
    next_month_str = f"{next_y:04d}-{next_m:02d}"

    return schemas.BillForecastView(
        historical_months=historical,
        predicted_month=next_month_str,
        predicted_amount=month_modeled_amount,
        predicted_kwh=month_modeled_kwh,
        confidence_r2=0.75,
        trend="stable",
    )


# ── ECBC / BEE Regulatory Benchmarking ─────────────────────────────────────


@router.get("/analytics/benchmarks/{room_id}", response_model=schemas.BenchmarkComparisonView)
def get_room_benchmark(
    room_id: int,
    area_sqm: float | None = Query(None, gt=0),
    zone_type: str | None = Query(None),
    context: AuthContext = Depends(require_roles("owner", "admin", "manager", "staff")),
    db: Session = Depends(get_db),
):
    room = crud.get_room(db, room_id, context.organization.id)
    if not room:
        raise HTTPException(status_code=404, detail="Zone not found in this organization.")

    # Determine area
    eff_area = area_sqm or room.area_sqm
    if not eff_area or eff_area <= 0:
        eff_area = 50.0  # Default sensible room footprint (50 m²) if not yet configured

    # Determine zone benchmark category
    z_type = (zone_type or room.zone_type or "general").strip().lower()
    benchmark_info = ECBC_BENCHMARKS.get(z_type)
    if not benchmark_info:
        # Fallback to org-level category mapping or general
        org_type = (context.organization.organization_type or "").lower()
        if "education" in org_type or "school" in org_type or "university" in org_type:
            z_type = "education"
        elif "hospital" in org_type or "health" in org_type:
            z_type = "hospital"
        elif "hotel" in org_type:
            z_type = "hotel"
        elif "retail" in org_type or "mall" in org_type:
            z_type = "retail"
        else:
            z_type = "office"
        benchmark_info = ECBC_BENCHMARKS.get(z_type, ECBC_BENCHMARKS["general"])

    # Calculate room's modeled annual consumption
    analysis = services.calculate_room_waste(
        room=room,
        tariff_rate=context.organization.effective_tariff_rate,
        daily_op_hours=context.organization.operating_hours,
        carbon_factor=context.organization.carbon_factor,
    )
    daily_modeled_kwh = analysis.get("modeled_energy_kwh", 0.0)
    annual_kwh = daily_modeled_kwh * 365.0

    # Zone EPI (Energy Performance Index in kWh/m²/year)
    zone_epi = round(annual_kwh / eff_area, 2)
    bench_epi = benchmark_info["kwh_per_sqm_year"]

    diff_pct = round(((zone_epi - bench_epi) / bench_epi) * 100.0, 1)

    if diff_pct < -10.0:
        rating = "efficient"
    elif diff_pct <= 15.0:
        rating = "standard"
    else:
        rating = "inefficient"

    return schemas.BenchmarkComparisonView(
        room_id=room.id,
        room_name=room.name,
        zone_type=z_type,
        area_sqm=round(eff_area, 1),
        annual_modeled_kwh=round(annual_kwh, 2),
        epi_kwh_sqm_year=zone_epi,
        benchmark_epi=bench_epi,
        benchmark_label=benchmark_info["label"],
        benchmark_type=benchmark_info.get("benchmark_type", "indicative_space"),
        climate_zone=benchmark_info.get("climate_zone", "Composite / Warm-Humid Standard"),
        rating=rating,
        percentage_difference=diff_pct,
        source_citation=benchmark_info["source"],
        benchmark_year=benchmark_info["year"],
    )


# ── Automated Email Alerts Dispatch Workflow ──────────────────────────────


@router.post("/analytics/alerts/dispatch/")
def dispatch_automated_alerts(
    context: AuthContext = Depends(require_roles("owner", "admin")),
    db: Session = Depends(get_db),
):
    """
    Automated alert workflow:
    1. Scans for electricity bills due within the next 7 days.
    2. Scans for facility zones with unusually high modeled energy gaps (>=50 kWh/day).
    Dispatches notifications to workspace owners and admins via configured SMTP.
    """
    org = context.organization
    admin_memberships = (
        db.query(models.Membership)
        .options(joinedload(models.Membership.user))
        .filter(
            models.Membership.organization_id == org.id,
            models.Membership.role.in_(["owner", "admin"]),
            models.Membership.is_active.is_(True),
        )
        .all()
    )
    recipients = [m.user.email for m in admin_memberships if m.user and m.user.email]
    if not recipients and context.user.email:
        recipients = [context.user.email]

    today = date.today()
    seven_days = today + timedelta(days=7)
    due_bills = (
        db.query(models.BillRecord)
        .filter(
            models.BillRecord.organization_id == org.id,
            models.BillRecord.status == "due",
            models.BillRecord.due_date >= today,
            models.BillRecord.due_date <= seven_days,
        )
        .all()
    )
    bill_alerts_sent = 0
    for bill in due_bills:
        for recipient in recipients:
            if send_bill_alert(
                to=recipient,
                org_name=org.name,
                biller=bill.biller,
                amount=bill.amount,
                due_date=bill.due_date.strftime("%Y-%m-%d"),
            ):
                bill_alerts_sent += 1

    rooms = db.query(models.Room).filter(models.Room.organization_id == org.id).all()
    gap_alerts_sent = 0
    for room in rooms:
        analysis = services.calculate_room_waste(
            room=room,
            tariff_rate=org.effective_tariff_rate,
            daily_op_hours=org.operating_hours,
            carbon_factor=org.carbon_factor,
        )
        waste_kwh = analysis.get("wasted_energy_kwh", 0.0)
        if waste_kwh >= 50.0:
            for recipient in recipients:
                if send_email(
                    to=recipient,
                    subject=f"Notice: High energy gap modeled for {room.name} ({waste_kwh} kWh/d) — {org.name}",
                    body_html=f"<p>Facility zone <strong>{room.name}</strong> has a modeled daily idle energy gap of <strong>{waste_kwh} kWh/day</strong> (₹{analysis.get('financial_loss_inr', 0):,.2f}/day). Please review its operating timetable.</p>",
                    body_text=f"High energy gap for {room.name}: {waste_kwh} kWh/day.",
                ):
                    gap_alerts_sent += 1

    return {
        "status": "completed",
        "recipients_count": len(recipients),
        "due_bills_found": len(due_bills),
        "bill_alerts_sent": bill_alerts_sent,
        "gap_alerts_sent": gap_alerts_sent,
    }
