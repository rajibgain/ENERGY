from datetime import datetime

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Column,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    LargeBinary,
    String,
    Time,
    UniqueConstraint,
)
from sqlalchemy.orm import deferred, relationship

from database import Base


class Organization(Base):
    __tablename__ = "organizations"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(120), nullable=False)
    organization_type = Column(String(60), nullable=False, default="Other")
    state = Column(String(80), nullable=False, default="Maharashtra")
    tariff_rate = Column(Float, nullable=False, default=8.0)
    carbon_factor = Column(Float, nullable=False, default=0.82)
    operating_hours = Column(Float, nullable=False, default=8.0)
    bbps_partner = Column(String(80), nullable=False, default="Setu")
    payment_portal_url = Column(String(500), nullable=False, default="")
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    memberships = relationship("Membership", back_populates="organization", cascade="all, delete-orphan")


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(254), nullable=False, unique=True, index=True)
    full_name = Column(String(120), nullable=False)
    password_hash = Column(String(256), nullable=False)
    google_sub = Column(String(255), nullable=True, unique=True, index=True)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    memberships = relationship("Membership", back_populates="user", cascade="all, delete-orphan")


class Membership(Base):
    __tablename__ = "memberships"
    __table_args__ = (
        UniqueConstraint("user_id", "organization_id", name="uq_membership_user_org"),
        CheckConstraint("role IN ('owner', 'admin', 'manager', 'staff')", name="ck_membership_role"),
    )

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    role = Column(String(20), nullable=False, default="staff")
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    user = relationship("User", back_populates="memberships")
    organization = relationship("Organization", back_populates="memberships")


class Invitation(Base):
    __tablename__ = "invitations"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    email = Column(String(254), nullable=False, index=True)
    role = Column(String(20), nullable=False)
    token_hash = Column(String(64), nullable=False, unique=True, index=True)
    created_by_id = Column(Integer, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False)
    expires_at = Column(DateTime, nullable=False)
    accepted_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)


class Site(Base):
    __tablename__ = "sites"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(120), nullable=False)
    address = Column(String(240), nullable=False, default="")
    city = Column(String(100), nullable=False, default="")
    state = Column(String(80), nullable=False, default="")
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    schematic_filename = Column(String(180), nullable=True)
    schematic_content_type = Column(String(80), nullable=True)
    schematic_data = deferred(Column(LargeBinary, nullable=True))

    rooms = relationship("Room", back_populates="site")

    @property
    def has_schematic(self):
        return bool(self.schematic_filename)


class Room(Base):
    __tablename__ = "rooms"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=False, index=True)
    site_id = Column(Integer, ForeignKey("sites.id", ondelete="SET NULL"), nullable=True, index=True)
    name = Column(String(120), nullable=False, index=True)
    block = Column(String(120), nullable=False)

    site = relationship("Site", back_populates="rooms")
    appliances = relationship("Appliance", back_populates="room", cascade="all, delete-orphan")
    schedules = relationship("Schedule", back_populates="room", cascade="all, delete-orphan")


class Appliance(Base):
    __tablename__ = "appliances"

    id = Column(Integer, primary_key=True, index=True)
    room_id = Column(Integer, ForeignKey("rooms.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(120), nullable=False)
    power_watts = Column(Float, nullable=False)

    room = relationship("Room", back_populates="appliances")


class Schedule(Base):
    __tablename__ = "schedules"

    id = Column(Integer, primary_key=True, index=True)
    room_id = Column(Integer, ForeignKey("rooms.id", ondelete="CASCADE"), nullable=False, index=True)
    day_of_week = Column(String(24), nullable=False)
    start_time = Column(Time, nullable=False)
    end_time = Column(Time, nullable=False)

    room = relationship("Room", back_populates="schedules")


class BillRecord(Base):
    __tablename__ = "bill_records"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    biller = Column(String(120), nullable=False)
    state = Column(String(80), nullable=False)
    site = Column(String(120), nullable=False, default="Portfolio")
    reference = Column(String(80), nullable=False, default="—")
    amount = Column(Float, nullable=False)
    due_date = Column(Date, nullable=False)
    status = Column(String(16), nullable=False, default="due")
    paid_date = Column(Date, nullable=True)
    payment_reference = Column(String(100), nullable=True)
    created_by_id = Column(Integer, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)
