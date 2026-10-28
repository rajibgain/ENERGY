from datetime import date, datetime, time
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator


Role = Literal["owner", "admin", "manager", "staff"]


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


class LoginRequest(BaseModel):
    email: str = Field(min_length=3, max_length=254)
    password: str = Field(min_length=1, max_length=128)


class InvitationRegisterRequest(BaseModel):
    token: str = Field(min_length=24, max_length=128)
    email: str = Field(min_length=3, max_length=254)
    full_name: str = Field(min_length=2, max_length=120)
    password: str = Field(min_length=12, max_length=128)


class InvitationCreate(BaseModel):
    email: str = Field(min_length=3, max_length=254)
    role: Literal["admin", "manager", "staff"]


class InvitationView(BaseModel):
    id: int
    email: str
    role: Role
    expires_at: datetime

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


class RoomCreate(RoomBase):
    pass


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
