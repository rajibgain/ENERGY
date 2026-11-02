from datetime import date, datetime, time
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


Role = Literal["owner", "admin", "manager", "staff"]


def validate_strong_password(value: str) -> str:
    checks = {
        "12 or more characters": len(value) >= 12,
        "a lowercase letter": any("a" <= char <= "z" for char in value),
        "an uppercase letter": any("A" <= char <= "Z" for char in value),
        "a number": any("0" <= char <= "9" for char in value),
        "a symbol": any(not char.isspace() and (not char.isascii() or not char.isalnum()) for char in value),
    }
    missing = [requirement for requirement, passed in checks.items() if not passed]
    if missing:
        raise ValueError("Password must include " + ", ".join(missing) + ".")
    return value


class OrganizationView(BaseModel):
    id: int
    name: str
    organization_type: str
    state: str
    tariff_rate: float
    tariff_mode: Literal["flat", "time_of_use"] = "flat"
    peak_tariff_rate: float = 8.0
    offpeak_tariff_rate: float = 8.0
    peak_start_time: time = time(17, 0)
    peak_end_time: time = time(22, 0)
    effective_tariff_rate: float = 8.0
    carbon_factor: float
    operating_hours: float
    bbps_partner: str = "Setu"
    payment_portal_url: str = ""

    model_config = ConfigDict(from_attributes=True)


class OrganizationUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=2, max_length=120)
    organization_type: Optional[str] = Field(default=None, min_length=2, max_length=60)
    state: Optional[str] = Field(default=None, min_length=2, max_length=80)
    tariff_rate: Optional[float] = Field(default=None, ge=0, le=1000)
    tariff_mode: Optional[Literal["flat", "time_of_use"]] = None
    peak_tariff_rate: Optional[float] = Field(default=None, ge=0, le=1000)
    offpeak_tariff_rate: Optional[float] = Field(default=None, ge=0, le=1000)
    peak_start_time: Optional[time] = None
    peak_end_time: Optional[time] = None
    carbon_factor: Optional[float] = Field(default=None, ge=0, le=3)
    operating_hours: Optional[float] = Field(default=None, gt=0, le=24)
    bbps_partner: Optional[str] = Field(default=None, min_length=2, max_length=80)
    payment_portal_url: Optional[str] = Field(default=None, max_length=500)

    @field_validator("payment_portal_url")
    @classmethod
    def provider_url_requires_https(cls, value):
        if value and not value.startswith("https://"):
            raise ValueError("The provider bill-pay URL must use HTTPS.")
        return value


class UserView(BaseModel):
    id: int
    email: str
    full_name: str

    model_config = ConfigDict(from_attributes=True)


class SessionView(BaseModel):
    user: UserView
    organization: OrganizationView
    role: Role


class RegisterRequest(BaseModel):
    email: str = Field(min_length=3, max_length=254)
    full_name: str = Field(min_length=2, max_length=120)
    password: str = Field(min_length=12, max_length=128)
    organization_name: str = Field(min_length=2, max_length=120)
    organization_type: str = Field(default="Other", min_length=2, max_length=60)
    state: str = Field(default="Maharashtra", min_length=2, max_length=80)

    @field_validator("password")
    @classmethod
    def password_meets_strength_rules(cls, value):
        return validate_strong_password(value)


class LoginRequest(BaseModel):
    email: str = Field(min_length=3, max_length=254)
    password: str = Field(min_length=1, max_length=128)


class ForgotPasswordRequest(BaseModel):
    email: str = Field(min_length=3, max_length=254)


class ResetPasswordRequest(BaseModel):
    token: str = Field(min_length=10)
    new_password: str = Field(min_length=8, max_length=128)

    @field_validator("new_password")
    @classmethod
    def password_meets_rules(cls, value):
        return validate_strong_password(value)


class GoogleLoginRequest(BaseModel):
    credential: str = Field(min_length=100, max_length=8192)


class GoogleRegisterRequest(GoogleLoginRequest):
    organization_name: str = Field(min_length=2, max_length=120)
    organization_type: str = Field(default="Other", min_length=2, max_length=60)
    state: str = Field(default="Maharashtra", min_length=2, max_length=80)


class AdvisorHistoryMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=2000)


class AdvisorChatRequest(BaseModel):
    question: str = Field(min_length=1, max_length=1200)
    history: list[AdvisorHistoryMessage] = Field(default_factory=list, max_length=10)

    @field_validator("question")
    @classmethod
    def question_has_text(cls, value):
        if not value.strip():
            raise ValueError("Enter a question for the energy advisor.")
        return value


class InvitationRegisterRequest(BaseModel):
    token: str = Field(min_length=24, max_length=128)
    email: str = Field(min_length=3, max_length=254)
    full_name: str = Field(min_length=2, max_length=120)
    password: str = Field(min_length=1, max_length=128)


class InvitationCreate(BaseModel):
    email: str = Field(min_length=3, max_length=254)
    role: Literal["admin", "manager", "staff"]


class InvitationView(BaseModel):
    id: int
    email: str
    role: Role
    expires_at: datetime

    model_config = ConfigDict(from_attributes=True)


class SiteFields(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    address: str = Field(default="", max_length=240)
    city: str = Field(default="", max_length=100)
    state: str = Field(min_length=2, max_length=80)
    latitude: Optional[float] = Field(default=None, ge=-90, le=90)
    longitude: Optional[float] = Field(default=None, ge=-180, le=180)

    @model_validator(mode="after")
    def coordinates_are_a_pair(self):
        if (self.latitude is None) != (self.longitude is None):
            raise ValueError("Enter both latitude and longitude to place a map pin.")
        return self


class SiteCreate(SiteFields):
    pass


class SiteUpdate(SiteFields):
    pass


class SiteView(SiteFields):
    id: int
    has_schematic: bool = False
    schematic_filename: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class MemberView(BaseModel):
    id: int
    role: Role
    is_active: bool
    user: UserView
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class MemberRoleUpdate(BaseModel):
    role: Literal["admin", "manager", "staff"]


class ApplianceBase(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    power_watts: float = Field(gt=0, le=10_000_000)
    load_factor: float = Field(default=1.0, ge=0.05, le=1.0)
    standby_watts: float = Field(default=0.0, ge=0, le=10_000_000)

    @model_validator(mode="after")
    def standby_cannot_exceed_rated_power(self):
        if self.standby_watts > self.power_watts * self.load_factor:
            raise ValueError("Standby watts cannot exceed the estimated active load.")
        return self


class ApplianceCreate(ApplianceBase):
    pass


class Appliance(ApplianceBase):
    id: int
    room_id: int

    model_config = ConfigDict(from_attributes=True)


class ApplianceTemplateView(BaseModel):
    id: int
    name: str
    category: str
    power_watts: float
    load_factor: float
    standby_watts: float
    region: str = "IN"
    is_default: bool = True

    model_config = ConfigDict(from_attributes=True)


class ScheduleBase(BaseModel):
    day_of_week: str = Field(min_length=2, max_length=24)
    start_time: time
    end_time: time


class ScheduleCreate(ScheduleBase):
    pass


class Schedule(ScheduleBase):
    id: int
    room_id: int

    model_config = ConfigDict(from_attributes=True)


class RoomBase(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    block: str = Field(min_length=1, max_length=120)
    site_id: Optional[int] = Field(default=None, gt=0)
    zone_type: str = Field(default="general", max_length=60)
    area_sqm: Optional[float] = Field(default=None, gt=0, le=1_000_000)


class RoomCreate(RoomBase):
    appliances: list[ApplianceBase] = Field(default_factory=list, max_length=50)


class RoomSiteUpdate(BaseModel):
    site_id: int = Field(gt=0)


class Room(RoomBase):
    id: int
    appliances: list[Appliance] = Field(default_factory=list)
    schedules: list[Schedule] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)


class BillCreate(BaseModel):
    biller: str = Field(min_length=2, max_length=120)
    state: str = Field(min_length=2, max_length=80)
    site: str = Field(default="Portfolio", min_length=1, max_length=120)
    reference: str = Field(default="—", max_length=80)
    amount: float = Field(gt=0, le=1_000_000_000)
    due_date: date


class BillPaymentRecord(BaseModel):
    payment_reference: str = Field(min_length=2, max_length=100)


class BillStatusUpdate(BaseModel):
    status: Literal["due", "void"]


class BillView(BaseModel):
    id: int
    biller: str
    state: str
    site: str
    reference: str
    amount: float
    due_date: date
    status: str
    paid_date: Optional[date] = None
    payment_reference: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ── Meter Readings ──────────────────────────────────────────────────────────


class MeterReadingView(BaseModel):
    id: int
    organization_id: int
    room_id: Optional[int] = None
    timestamp: datetime
    kwh_reading: float
    interval_minutes: int
    source: str
    uploaded_at: datetime

    model_config = ConfigDict(from_attributes=True)


class MeterUploadResponse(BaseModel):
    message: str
    imported_count: int
    warnings: list[str] = Field(default_factory=list)


class ModeledVsMeasuredItem(BaseModel):
    period: str
    modeled_kwh: float
    measured_kwh: float
    difference_kwh: float
    difference_pct: float


class ModeledVsMeasuredSummary(BaseModel):
    monthly_data: list[ModeledVsMeasuredItem]
    total_modeled_kwh: float
    total_measured_kwh: float
    net_gap_kwh: float


# ── Audit Tasks ──────────────────────────────────────────────────────────


class AuditTaskCreate(BaseModel):
    title: str = Field(min_length=2, max_length=200)
    description: str = Field(default="", max_length=1000)
    assigned_to: Optional[str] = Field(default=None, max_length=120)
    due_date: Optional[date] = None
    priority: Literal["low", "medium", "high", "critical"] = "medium"
    room_id: Optional[int] = None


class AuditTaskUpdate(BaseModel):
    title: Optional[str] = Field(default=None, min_length=2, max_length=200)
    description: Optional[str] = Field(default=None, max_length=1000)
    assigned_to: Optional[str] = Field(default=None, max_length=120)
    due_date: Optional[date] = None
    priority: Optional[Literal["low", "medium", "high", "critical"]] = None
    status: Optional[Literal["open", "in_progress", "completed", "cancelled"]] = None
    room_id: Optional[int] = None
    before_reading_kwh: Optional[float] = None
    after_reading_kwh: Optional[float] = None


class AuditTaskView(BaseModel):
    id: int
    organization_id: int
    title: str
    description: str
    assigned_to: Optional[str] = None
    due_date: Optional[date] = None
    status: str
    priority: str
    room_id: Optional[int] = None
    before_reading_kwh: Optional[float] = None
    after_reading_kwh: Optional[float] = None
    verified_savings_kwh: Optional[float] = None
    verified_savings_inr: Optional[float] = None
    created_by_id: int
    created_at: datetime
    updated_at: datetime
    completed_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


# ── Analytics, Forecasting & Benchmarks ───────────────────────────────────


class BillTrendItem(BaseModel):
    month: str
    total_amount: float
    bill_count: int
    avg_amount: float
    rolling_avg: Optional[float] = None
    is_anomaly: bool = False


class HistoricalMonthAmount(BaseModel):
    month: str
    amount: float


class BillForecastView(BaseModel):
    historical_months: list[HistoricalMonthAmount]
    predicted_month: str
    predicted_amount: float
    predicted_kwh: float
    confidence_r2: float
    trend: Literal["increasing", "decreasing", "stable"]


class BenchmarkComparisonView(BaseModel):
    room_id: int
    room_name: str
    zone_type: str
    area_sqm: float
    annual_modeled_kwh: float
    epi_kwh_sqm_year: float
    benchmark_epi: float
    benchmark_label: str
    benchmark_type: Literal["statutory_code", "indicative_space"] = "indicative_space"
    climate_zone: str = "Composite / Warm-Humid Standard"
    rating: Literal["efficient", "standard", "inefficient"]
    percentage_difference: float
    source_citation: str
    benchmark_year: int
