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


class ApplianceCreate(ApplianceBase):
    pass


class Appliance(ApplianceBase):
    id: int
    room_id: int

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
