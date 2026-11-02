from sqlalchemy.orm import Session
import models

DEFAULT_APPLIANCE_TEMPLATES = [
    {"name": "1.5-ton Split AC", "category": "HVAC", "power_watts": 1500.0, "load_factor": 0.6, "standby_watts": 15.0, "region": "IN"},
    {"name": "2-ton Split AC", "category": "HVAC", "power_watts": 2000.0, "load_factor": 0.6, "standby_watts": 20.0, "region": "IN"},
    {"name": "Window AC 1.5-ton", "category": "HVAC", "power_watts": 1800.0, "load_factor": 0.65, "standby_watts": 12.0, "region": "IN"},
    {"name": "Standard Ceiling Fan", "category": "Fan", "power_watts": 75.0, "load_factor": 0.8, "standby_watts": 0.0, "region": "IN"},
    {"name": "BEE 5-Star Ceiling Fan", "category": "Fan", "power_watts": 35.0, "load_factor": 0.8, "standby_watts": 0.0, "region": "IN"},
    {"name": "40W Tube Light", "category": "Lighting", "power_watts": 40.0, "load_factor": 1.0, "standby_watts": 0.0, "region": "IN"},
    {"name": "LED Tube Light 20W", "category": "Lighting", "power_watts": 20.0, "load_factor": 1.0, "standby_watts": 0.0, "region": "IN"},
    {"name": "LED Panel 40W", "category": "Lighting", "power_watts": 40.0, "load_factor": 1.0, "standby_watts": 0.0, "region": "IN"},
    {"name": "CFL 15W", "category": "Lighting", "power_watts": 15.0, "load_factor": 1.0, "standby_watts": 0.0, "region": "IN"},
    {"name": "Desktop Computer", "category": "IT", "power_watts": 200.0, "load_factor": 0.5, "standby_watts": 5.0, "region": "IN"},
    {"name": "Laptop", "category": "IT", "power_watts": 65.0, "load_factor": 0.4, "standby_watts": 3.0, "region": "IN"},
    {"name": "Projector", "category": "IT", "power_watts": 300.0, "load_factor": 0.9, "standby_watts": 5.0, "region": "IN"},
    {"name": "Laser Printer", "category": "IT", "power_watts": 600.0, "load_factor": 0.3, "standby_watts": 10.0, "region": "IN"},
    {"name": "Water Cooler", "category": "Kitchen", "power_watts": 150.0, "load_factor": 0.4, "standby_watts": 5.0, "region": "IN"},
    {"name": "Microwave Oven", "category": "Kitchen", "power_watts": 1200.0, "load_factor": 0.3, "standby_watts": 3.0, "region": "IN"},
    {"name": "Electric Kettle", "category": "Kitchen", "power_watts": 1500.0, "load_factor": 0.2, "standby_watts": 0.0, "region": "IN"},
]

def seed_default_appliances(db: Session) -> int:
    """Seeds default standard appliances idempotently. Returns count of new items added."""
    count = 0
    existing_names = {row[0] for row in db.query(models.ApplianceTemplate.name).all()}
    for item in DEFAULT_APPLIANCE_TEMPLATES:
        if item["name"] not in existing_names:
            template = models.ApplianceTemplate(
                name=item["name"],
                category=item["category"],
                power_watts=item["power_watts"],
                load_factor=item["load_factor"],
                standby_watts=item["standby_watts"],
                region=item["region"],
                is_default=True,
            )
            db.add(template)
            count += 1
    if count > 0:
        db.commit()
    return count

if __name__ == "__main__":
    from database import SessionLocal
    with SessionLocal() as db:
        added = seed_default_appliances(db)
        print(f"Seeded {added} default appliances.")

