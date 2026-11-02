"""Configurable SMTP email service for SyncSpace.

Environment variables:
  SMTP_HOST: SMTP server hostname (e.g., smtp.gmail.com)
  SMTP_PORT: SMTP port (default 587)
  SMTP_USER: SMTP username/email
  SMTP_PASSWORD: SMTP password or app password
  SMTP_FROM: From address (defaults to SMTP_USER)
  SMTP_TLS: Use STARTTLS (default true)
"""
import logging
import os
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

logger = logging.getLogger("syncspace.email")

SMTP_HOST = os.getenv("SMTP_HOST", "").strip()
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", "").strip()
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "").strip()
SMTP_FROM = os.getenv("SMTP_FROM", "").strip() or SMTP_USER
SMTP_TLS = os.getenv("SMTP_TLS", "true").lower() in ("1", "true", "yes")


def is_smtp_configured() -> bool:
    return bool(SMTP_HOST and SMTP_USER and SMTP_PASSWORD)


def send_email(to: str, subject: str, body_html: str, body_text: str | None = None) -> bool:
    """Sends an email via SMTP. If SMTP is not configured, logs the message and returns False."""
    if not is_smtp_configured():
        logger.info(f"[SMTP Not Configured] Email to '{to}' with subject '{subject}' not sent.")
        return False

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = SMTP_FROM
    msg["To"] = to

    if body_text:
        msg.attach(MIMEText(body_text, "plain", "utf-8"))
    msg.attach(MIMEText(body_html, "html", "utf-8"))

    try:
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=10) as server:
            if SMTP_TLS:
                server.starttls()
            server.login(SMTP_USER, SMTP_PASSWORD)
            server.send_message(msg)
            logger.info(f"Email successfully delivered to {to}")
            return True
    except Exception as exc:
        logger.error(f"Failed to send email to {to}: {exc}")
        return False


def send_invitation_email(to: str, inviter_name: str, org_name: str, invite_link: str) -> bool:
    subject = f"You have been invited to join {org_name} on SyncSpace"
    body_html = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #1a2920; background: #fafaf5; border: 1px solid #e1e3d8; border-radius: 8px;">
        <h2 style="color: #19362a; margin-top: 0;">SyncSpace Workspace Invitation</h2>
        <p>Hello,</p>
        <p><strong>{inviter_name}</strong> has invited you to join the <strong>{org_name}</strong> energy management workspace on SyncSpace.</p>
        <div style="margin: 32px 0;">
            <a href="{invite_link}" style="display: inline-block; padding: 12px 24px; background: #19362a; color: #f2f1e7; text-decoration: none; border-radius: 6px; font-weight: bold;">Accept Workspace Invitation</a>
        </div>
        <p style="font-size: 13px; color: #798076;">Or copy and paste this link into your browser:<br/><a href="{invite_link}" style="color: #56734c;">{invite_link}</a></p>
        <p style="font-size: 12px; color: #a1a69b; margin-top: 32px;">This invitation link will expire in 7 days.</p>
    </div>
    """
    body_text = f"Hello,\n\n{inviter_name} has invited you to join {org_name} on SyncSpace.\n\nAccept your invitation here:\n{invite_link}\n\n(Link expires in 7 days)"
    return send_email(to=to, subject=subject, body_html=body_html, body_text=body_text)


def send_password_reset_email(to: str, user_name: str, reset_link: str) -> bool:
    subject = "Reset your SyncSpace password"
    body_html = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #1a2920; background: #fafaf5; border: 1px solid #e1e3d8; border-radius: 8px;">
        <h2 style="color: #19362a; margin-top: 0;">Password Reset Request</h2>
        <p>Hello {user_name},</p>
        <p>A request was received to reset your password for your SyncSpace account. Click below to proceed:</p>
        <div style="margin: 28px 0;">
            <a href="{reset_link}" style="display: inline-block; padding: 12px 24px; background: #19362a; color: #f2f1e7; text-decoration: none; border-radius: 6px; font-weight: bold;">Reset Your Password</a>
        </div>
        <p style="font-size: 13px; color: #798076;">Or copy and paste this link into your browser:<br/><a href="{reset_link}" style="color: #56734c;">{reset_link}</a></p>
        <p style="font-size: 12px; color: #a1a69b; margin-top: 32px;">This link expires in 1 hour. If you did not request this, please ignore this message.</p>
    </div>
    """
    body_text = f"Hello {user_name},\n\nReset your SyncSpace password with this link:\n{reset_link}\n\n(Link expires in 1 hour)"
    return send_email(to=to, subject=subject, body_html=body_html, body_text=body_text)


def send_bill_alert(to: str, org_name: str, biller: str, amount: float, due_date: str) -> bool:
    subject = f"Alert: Upcoming electricity bill due for {biller} — {org_name}"
    body_html = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #1a2920; background: #fafaf5; border: 1px solid #e1e3d8; border-radius: 8px;">
        <h2 style="color: #19362a; margin-top: 0;">Electricity Bill Due Soon</h2>
        <p>This is an automated alert from your <strong>{org_name}</strong> workspace.</p>
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <tr><td style="padding: 8px 0; color: #798076;">Provider:</td><td><strong>{biller}</strong></td></tr>
            <tr><td style="padding: 8px 0; color: #798076;">Amount Due:</td><td><strong style="color: #b54724;">₹{amount:,.2f}</strong></td></tr>
            <tr><td style="padding: 8px 0; color: #798076;">Due Date:</td><td><strong>{due_date}</strong></td></tr>
        </table>
        <p style="font-size: 13px; color: #798076;">Please review and reconcile the payment in your SyncSpace ledger.</p>
    </div>
    """
    body_text = f"Electricity Bill Alert for {org_name}\nProvider: {biller}\nAmount Due: ₹{amount:,.2f}\nDue Date: {due_date}"
    return send_email(to=to, subject=subject, body_html=body_html, body_text=body_text)


def send_anomaly_alert(to: str, org_name: str, month: str, current_amount: float, rolling_avg: float) -> bool:
    pct_over = round(((current_amount - rolling_avg) / rolling_avg) * 100.0, 1)
    subject = f"Warning: Bill anomaly detected for {month} (+{pct_over}%) — {org_name}"
    body_html = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #1a2920; background: #fff5f2; border: 1px solid #f0cfc4; border-radius: 8px;">
        <h2 style="color: #943216; margin-top: 0;">Statistical Bill Anomaly Flagged</h2>
        <p>SyncSpace detected that your total electricity expenditure for <strong>{month}</strong> is <strong>{pct_over}% higher</strong> than the 3-month rolling average.</p>
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <tr><td style="padding: 8px 0; color: #798076;">{month} Billed Total:</td><td><strong style="color: #943216;">₹{current_amount:,.2f}</strong></td></tr>
            <tr><td style="padding: 8px 0; color: #798076;">3-Month Rolling Average:</td><td><strong>₹{rolling_avg:,.2f}</strong></td></tr>
        </table>
        <p style="font-size: 13px; color: #798076;">Check for uncommissioned equipment, HVAC scheduling gaps, or tariff changes.</p>
    </div>
    """
    body_text = f"Bill Anomaly Flagged for {org_name}\nMonth: {month}\nBilled Total: ₹{current_amount:,.2f}\n3-Month Rolling Avg: ₹{rolling_avg:,.2f} (+{pct_over}%)"
    return send_email(to=to, subject=subject, body_html=body_html, body_text=body_text)

