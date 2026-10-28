from datetime import datetime, timedelta
import hashlib
import re
import secrets
import threading
import time

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session, joinedload

import models
import schemas
from auth_security import (
    AuthContext,
    clear_session_cookie,
    hash_password,
    require_roles,
    set_session_cookie,
    verify_password,
)
from database import get_db


router = APIRouter(prefix="/api/v1/auth", tags=["Authentication & workspace"])
EMAIL_PATTERN = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]{2,}$")
_login_attempts: dict[str, list[float]] = {}
_attempt_lock = threading.Lock()


def normalized_email(value: str) -> str:
    email = value.strip().lower()
    if not EMAIL_PATTERN.fullmatch(email):
        raise HTTPException(status_code=422, detail="Enter a valid email address.")
    return email


def session_payload(user: models.User, membership: models.Membership) -> dict:
    organization = membership.organization
    return {
        "user": {"id": user.id, "email": user.email, "full_name": user.full_name},
        "organization": {
            "id": organization.id,
            "name": organization.name,
            "organization_type": organization.organization_type,
            "state": organization.state,
            "tariff_rate": organization.tariff_rate,
            "carbon_factor": organization.carbon_factor,
            "operating_hours": organization.operating_hours,
            "bbps_partner": organization.bbps_partner,
            "payment_portal_url": organization.payment_portal_url,
        },
        "role": membership.role,
    }


def invite_digest(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _rate_limit_login(key: str):
    now = time.monotonic()
    cutoff = now - 15 * 60
    with _attempt_lock:
        attempts = [timestamp for timestamp in _login_attempts.get(key, []) if timestamp >= cutoff]
        if len(attempts) >= 10:
            raise HTTPException(status_code=429, detail="Too many attempts. Wait 15 minutes and try again.")
        attempts.append(now)
        _login_attempts[key] = attempts


def _clear_login_limit(key: str):
    with _attempt_lock:
        _login_attempts.pop(key, None)


@router.post("/register", response_model=schemas.SessionView, status_code=status.HTTP_201_CREATED)
def register(payload: schemas.RegisterRequest, response: Response, db: Session = Depends(get_db)):
    email = normalized_email(payload.email)
    if db.query(models.User.id).filter(models.User.email == email).first():
        raise HTTPException(status_code=409, detail="An account with this email already exists. Sign in or use your invitation link.")

    try:
        organization = models.Organization(
            name=payload.organization_name.strip(),
            organization_type=payload.organization_type.strip(),
            state=payload.state.strip(),
        )
        user = models.User(email=email, full_name=payload.full_name.strip(), password_hash=hash_password(payload.password))
        db.add_all([organization, user])
        db.flush()
        membership = models.Membership(user_id=user.id, organization_id=organization.id, role="owner", is_active=True)
        db.add(membership)
        # One owner creates a workspace. Any facilities from the old single-tenant
        # installation are adopted once, then become tenant-scoped as usual.
        db.query(models.Room).filter(models.Room.organization_id.is_(None)).update(
            {models.Room.organization_id: organization.id}, synchronize_session=False
        )
        db.commit()
        db.refresh(user)
        db.refresh(membership)
    except Exception:
        db.rollback()
        raise

    set_session_cookie(response, user.id, organization.id)
    return session_payload(user, membership)


@router.post("/register-invitation", response_model=schemas.SessionView, status_code=status.HTTP_201_CREATED)
def register_from_invitation(payload: schemas.InvitationRegisterRequest, response: Response, db: Session = Depends(get_db)):
    email = normalized_email(payload.email)
    invitation = db.query(models.Invitation).filter(models.Invitation.token_hash == invite_digest(payload.token)).first()
    now = datetime.utcnow()
    if not invitation or invitation.accepted_at or invitation.expires_at <= now:
        raise HTTPException(status_code=400, detail="This invitation is invalid or has expired.")
    if invitation.email != email:
        raise HTTPException(status_code=403, detail="Use the email address this invitation was sent to.")

    organization = db.query(models.Organization).filter(models.Organization.id == invitation.organization_id).first()
    if not organization:
        raise HTTPException(status_code=400, detail="The invited workspace is no longer available.")

    user = db.query(models.User).filter(models.User.email == email).first()
    if user:
        if not verify_password(payload.password, user.password_hash):
            raise HTTPException(status_code=401, detail="That email already has an account. Use its existing password.")
        if not user.is_active:
            raise HTTPException(status_code=403, detail="This account is disabled. Ask a workspace owner for help.")
        membership = (
            db.query(models.Membership)
            .filter(models.Membership.user_id == user.id, models.Membership.organization_id == organization.id)
            .first()
        )
        other_active = (
            db.query(models.Membership)
            .filter(models.Membership.user_id == user.id, models.Membership.is_active.is_(True))
            .first()
        )
        if other_active and (not membership or other_active.id != membership.id):
            raise HTTPException(status_code=409, detail="This account already belongs to another workspace. Use a separate work account for now.")
        if membership and membership.is_active:
            raise HTTPException(status_code=409, detail="This account already belongs to this workspace.")
    else:
        user = models.User(email=email, full_name=payload.full_name.strip(), password_hash=hash_password(payload.password))
        db.add(user)
        db.flush()
        membership = None

    try:
        if membership:
            membership.role = invitation.role
            membership.is_active = True
        else:
            membership = models.Membership(
                user_id=user.id,
                organization_id=organization.id,
                role=invitation.role,
                is_active=True,
            )
            db.add(membership)
        invitation.accepted_at = now
        db.commit()
        db.refresh(user)
        db.refresh(membership)
    except Exception:
        db.rollback()
        raise

    set_session_cookie(response, user.id, organization.id)
    return session_payload(user, membership)


@router.post("/login", response_model=schemas.SessionView)
def login(payload: schemas.LoginRequest, request: Request, response: Response, db: Session = Depends(get_db)):
    email = normalized_email(payload.email)
    client_ip = request.client.host if request.client else "unknown"
    limit_key = f"{client_ip}:{email}"
    _rate_limit_login(limit_key)

    user = db.query(models.User).filter(models.User.email == email).first()
    if not user or not verify_password(payload.password, user.password_hash) or not user.is_active:
        raise HTTPException(status_code=401, detail="Email or password is incorrect.")
    membership = (
        db.query(models.Membership)
        .options(joinedload(models.Membership.organization))
        .filter(models.Membership.user_id == user.id, models.Membership.is_active.is_(True))
        .order_by(models.Membership.id.asc())
        .first()
    )
    if not membership:
        raise HTTPException(status_code=403, detail="No active workspace is assigned to this account. Use a workspace invitation.")

    _clear_login_limit(limit_key)
    set_session_cookie(response, user.id, membership.organization_id)
    return session_payload(user, membership)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(response: Response):
    clear_session_cookie(response)


@router.get("/me", response_model=schemas.SessionView)
def read_session(context: AuthContext = Depends(require_roles("owner", "admin", "manager", "staff"))):
    return session_payload(context.user, context.membership)


@router.patch("/organization", response_model=schemas.OrganizationView)
def update_organization(
    changes: schemas.OrganizationUpdate,
    context: AuthContext = Depends(require_roles("owner", "admin")),
    db: Session = Depends(get_db),
):
    for field_name in changes.model_fields_set:
        value = getattr(changes, field_name)
        if value is None:
            continue
        if isinstance(value, str):
            value = value.strip()
        setattr(context.organization, field_name, value)
    db.commit()
    db.refresh(context.organization)
    return context.organization


@router.get("/members", response_model=list[schemas.MemberView])
def list_members(context: AuthContext = Depends(require_roles("owner", "admin")), db: Session = Depends(get_db)):
    return (
        db.query(models.Membership)
        .options(joinedload(models.Membership.user))
        .filter(models.Membership.organization_id == context.organization.id)
        .order_by(models.Membership.is_active.desc(), models.Membership.id.asc())
        .all()
    )


@router.patch("/members/{membership_id}", response_model=schemas.MemberView)
def update_member_role(
    membership_id: int,
    changes: schemas.MemberRoleUpdate,
    context: AuthContext = Depends(require_roles("owner", "admin")),
    db: Session = Depends(get_db),
):
    member = (
        db.query(models.Membership)
        .options(joinedload(models.Membership.user))
        .filter(models.Membership.id == membership_id, models.Membership.organization_id == context.organization.id)
        .first()
    )
    if not member:
        raise HTTPException(status_code=404, detail="Team member not found.")
    if member.user_id == context.user.id or member.role == "owner":
        raise HTTPException(status_code=400, detail="You cannot change the owner role or your own role.")
    if context.membership.role == "admin" and member.role == "admin":
        raise HTTPException(status_code=403, detail="Only the owner can manage another admin.")
    if context.membership.role == "admin" and changes.role == "admin":
        raise HTTPException(status_code=403, detail="Only the owner can promote an admin.")
    member.role = changes.role
    db.commit()
    db.refresh(member)
    return member


@router.delete("/members/{membership_id}", response_model=schemas.MemberView)
def suspend_member(
    membership_id: int,
    context: AuthContext = Depends(require_roles("owner", "admin")),
    db: Session = Depends(get_db),
):
    member = (
        db.query(models.Membership)
        .options(joinedload(models.Membership.user))
        .filter(models.Membership.id == membership_id, models.Membership.organization_id == context.organization.id)
        .first()
    )
    if not member:
        raise HTTPException(status_code=404, detail="Team member not found.")
    if member.user_id == context.user.id or member.role == "owner":
        raise HTTPException(status_code=400, detail="You cannot remove yourself or the workspace owner.")
    if context.membership.role == "admin" and member.role == "admin":
        raise HTTPException(status_code=403, detail="Only the owner can remove another admin.")
    member.is_active = False
    db.commit()
    db.refresh(member)
    return member


@router.post("/invitations", status_code=status.HTTP_201_CREATED)
def create_invitation(
    payload: schemas.InvitationCreate,
    context: AuthContext = Depends(require_roles("owner", "admin")),
    db: Session = Depends(get_db),
):
    email = normalized_email(payload.email)
    if payload.role == "admin" and context.membership.role != "owner":
        raise HTTPException(status_code=403, detail="Only the owner can invite an admin.")
    existing_user = db.query(models.User).filter(models.User.email == email).first()
    if existing_user:
        existing_membership = (
            db.query(models.Membership)
            .filter(models.Membership.user_id == existing_user.id, models.Membership.organization_id == context.organization.id)
            .first()
        )
        if existing_membership and existing_membership.is_active:
            raise HTTPException(status_code=409, detail="This person already has access to the workspace.")

    db.query(models.Invitation).filter(
        models.Invitation.organization_id == context.organization.id,
        models.Invitation.email == email,
        models.Invitation.accepted_at.is_(None),
    ).delete(synchronize_session=False)

    token = secrets.token_urlsafe(32)
    invitation = models.Invitation(
        organization_id=context.organization.id,
        email=email,
        role=payload.role,
        token_hash=invite_digest(token),
        created_by_id=context.user.id,
        expires_at=datetime.utcnow() + timedelta(days=7),
    )
    db.add(invitation)
    db.commit()
    db.refresh(invitation)
    return {"id": invitation.id, "email": email, "role": invitation.role, "token": token, "expires_at": invitation.expires_at}


@router.get("/invitations", response_model=list[schemas.InvitationView])
def list_invitations(context: AuthContext = Depends(require_roles("owner", "admin")), db: Session = Depends(get_db)):
    return (
        db.query(models.Invitation)
        .filter(
            models.Invitation.organization_id == context.organization.id,
            models.Invitation.accepted_at.is_(None),
            models.Invitation.expires_at > datetime.utcnow(),
        )
        .order_by(models.Invitation.created_at.desc())
        .all()
    )


@router.delete("/invitations/{invitation_id}", status_code=status.HTTP_204_NO_CONTENT)
def revoke_invitation(
    invitation_id: int,
    context: AuthContext = Depends(require_roles("owner", "admin")),
    db: Session = Depends(get_db),
):
    invitation = (
        db.query(models.Invitation)
        .filter(models.Invitation.id == invitation_id, models.Invitation.organization_id == context.organization.id)
        .first()
    )
    if not invitation:
        raise HTTPException(status_code=404, detail="Invitation not found.")
    db.delete(invitation)
    db.commit()
