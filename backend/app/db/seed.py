import asyncio
from datetime import date, timedelta
from decimal import Decimal
import uuid
from sqlalchemy import select
from app.core.database import async_session_maker
from app.models.feeding import ExpenseCategory, FeedType
from app.models.herd import Warehouse
from app.models.evaluation import MarketPrice
from app.models.herd import Cow, Supplier, WeightRecord, CowWarehouseHistory
from app.models.feeding import FeedingRecord, Expense
from app.models.health import HealthRecord, BreedingRecord, PregnancyReport
from app.models.labor import Worker, WorkerAttendance, SalaryPayment, MillCharge
from app.models.sales import MilkProduction, Customer, SalesInvoice, SalesInvoiceLine, SalePayment


DEFAULT_CATEGORIES = [
    # Food categories
    {"name": "Concentrated Feed", "name_bn": "দানাদার খাদ্য", "category_group": "food"},
    {"name": "Green Grass", "name_bn": "কাঁচা ঘাস", "category_group": "food"},
    {"name": "Dry Straw", "name_bn": "শুকনা খড়", "category_group": "food"},
    {"name": "Vitamin & Minerals", "name_bn": "ভিটামিন ও খনিজ", "category_group": "food"},
    {"name": "Molasses", "name_bn": "মলাসেস / লালি গুড়", "category_group": "food"},
    
    # Miscellaneous categories
    {"name": "Cow Rope", "name_bn": "গরুর রশি", "category_group": "miscellaneous"},
    {"name": "Ear Tags", "name_bn": "ট্যাগ", "category_group": "miscellaneous"},
    {"name": "Cow Mats & Bedding", "name_bn": "গরুর ম্যাট ও বিছানা", "category_group": "miscellaneous"},
    {"name": "Chaff Cutter Repair", "name_bn": "কাঁরি কাটার মেশিন মেরামত", "category_group": "miscellaneous"},
    {"name": "Electronic Items", "name_bn": "বৈদ্যুতিক সরঞ্জাম", "category_group": "miscellaneous"},
    {"name": "Electricity Bill", "name_bn": "বিদ্যুৎ বিল", "category_group": "miscellaneous"},
    {"name": "Veterinary Services", "name_bn": "চিকিৎসা ও পশু চিকিৎসক ফি", "category_group": "miscellaneous"},
    {"name": "Labor Food", "name_bn": "শ্রমিকদের খাবার খরচ", "category_group": "miscellaneous"},
]

DEFAULT_WAREHOUSES = [
    {"name": "Main Cow Shed (প্রধান শেড)", "housing_type": "tie_stall", "capacity": 30},
    {"name": "Calf Shed (বাছুর শেড)", "housing_type": "pen", "capacity": 15},
    {"name": "Quarantine / Hospital Shed (আইসোলেশন শেড)", "housing_type": "isolation", "capacity": 5},
]


async def seed_data():
    async with async_session_maker() as session:
        # 1. Seed Warehouses
        for w_data in DEFAULT_WAREHOUSES:
            stmt = select(Warehouse).where(Warehouse.name == w_data["name"])
            existing = (await session.execute(stmt)).scalar_one_or_none()
            if not existing:
                warehouse = Warehouse(
                    name=w_data["name"],
                    housing_type=w_data["housing_type"],
                    capacity=w_data["capacity"],
                )
                session.add(warehouse)

        # 2. Seed Expense Categories
        category_map = {}
        for cat_data in DEFAULT_CATEGORIES:
            stmt = select(ExpenseCategory).where(ExpenseCategory.name == cat_data["name"])
            existing = (await session.execute(stmt)).scalar_one_or_none()
            if not existing:
                cat = ExpenseCategory(
                    name=cat_data["name"],
                    name_bn=cat_data["name_bn"],
                    category_group=cat_data["category_group"],
                )
                session.add(cat)
                await session.flush()
                category_map[cat.name] = cat
            else:
                category_map[existing.name] = existing

        # 3. Seed Feed Types
        feed_items = [
            ("Concentrated Feed", "দানাদার খাদ্য", "kg", Decimal("55.00"), "Concentrated Feed"),
            ("Green Grass", "কাঁচা ঘাস", "kg", Decimal("5.50"), "Green Grass"),
            ("Dry Straw", "শুকনা খড়", "bundle", Decimal("18.00"), "Dry Straw"),
            ("Vitamin Premix", "ভিটামিন মিনারেল প্রিমিক্স", "kg", Decimal("350.00"), "Vitamin & Minerals"),
            ("Molasses", "মলাসেস / লালি গুড়", "kg", Decimal("48.00"), "Molasses"),
        ]

        for name, name_bn, unit, unit_cost, cat_name in feed_items:
            cat = category_map.get(cat_name)
            if cat:
                stmt = select(FeedType).where(FeedType.name == name)
                existing = (await session.execute(stmt)).scalar_one_or_none()
                if not existing:
                    feed_type = FeedType(
                        category_id=cat.category_id,
                        name=name,
                        name_bn=name_bn,
                        unit=unit,
                        unit_cost=unit_cost,
                    )
                    session.add(feed_type)

        # 4. Seed Current Market Price snapshot
        today = date.today()
        stmt = select(MarketPrice).where(MarketPrice.price_date == today)
        existing_price = (await session.execute(stmt)).scalar_one_or_none()
        if not existing_price:
            market_price = MarketPrice(
                price_date=today,
                price_per_kg_net=Decimal("650.00"),
                source="Local Cattle Market Average (গাবতলী / আঞ্চলিক হাট)",
            )
            session.add(market_price)

        await session.commit()
        print("Database seeded successfully with default categories, feed types, warehouses, and market price.")


async def seed_sample_data():
    """Add a small, repeatable demo farm dataset for exercising the app locally."""
    await seed_data()
    today = date.today()
    async with async_session_maker() as session:
        if (await session.execute(select(Cow).where(Cow.current_tag_number == "DEMO-001"))).scalar_one_or_none():
            print("Sample farm data already exists; skipping.")
            return

        warehouses = {w.name: w for w in (await session.execute(select(Warehouse))).scalars()}
        main_shed = next(w for w in warehouses.values() if "Main Cow Shed" in w.name)
        calf_shed = next(w for w in warehouses.values() if "Calf Shed" in w.name)
        suppliers = [
            Supplier(name="Rahman Livestock", phone="01710000001", supplier_type="farm"),
            Supplier(name="Savar Cattle Market", phone="01710000002", supplier_type="market")
        ]
        session.add_all(suppliers)
        await session.flush()
        cows = [
            Cow(current_tag_number="DEMO-001", sex="female", category="dairy", birth_date=today-timedelta(days=1250), acquisition_type="bought_from_supplier", acquisition_date=today-timedelta(days=900), purchase_price=Decimal("145000"), supplier_id=suppliers[0].supplier_id, warehouse_id=main_shed.warehouse_id, status="active", notes="Holstein cross; steady milk yield."),
            Cow(current_tag_number="DEMO-002", sex="female", category="dairy", birth_date=today-timedelta(days=1095), acquisition_type="bought_from_bazar", acquisition_date=today-timedelta(days=700), purchase_price=Decimal("132000"), supplier_id=suppliers[1].supplier_id, warehouse_id=main_shed.warehouse_id, status="active", notes="Good temperament."),
            Cow(current_tag_number="DEMO-003", sex="male", category="bull", birth_date=today-timedelta(days=950), acquisition_type="bought_from_supplier", acquisition_date=today-timedelta(days=600), purchase_price=Decimal("118000"), supplier_id=suppliers[0].supplier_id, warehouse_id=main_shed.warehouse_id, status="active", notes="Breeding bull."),
            Cow(current_tag_number="DEMO-004", sex="female", category="calf", birth_date=today-timedelta(days=150), acquisition_type="born_on_farm", acquisition_date=today-timedelta(days=150), dam_id=None, warehouse_id=calf_shed.warehouse_id, status="active", notes="Young heifer calf."),
        ]
        session.add_all(cows)
        await session.flush()
        # Link the farm-born calf to its dam after insertion.
        cows[3].dam_id = cows[0].cow_id

        categories = {c.name: c for c in (await session.execute(select(ExpenseCategory))).scalars()}
        feeds = {f.name: f for f in (await session.execute(select(FeedType))).scalars()}
        session.add_all([
            *[WeightRecord(cow_id=cows[i].cow_id, weigh_date=today-timedelta(days=30), weight_kg=Decimal(w)) for i, w in enumerate((468, 422, 510, 92))],
            *[CowWarehouseHistory(cow_id=c.cow_id, warehouse_id=c.warehouse_id, moved_in_date=c.acquisition_date, reason="Initial placement") for c in cows],
            HealthRecord(cow_id=cows[0].cow_id, record_type="vaccination", record_date=today-timedelta(days=20), vet_name="Dr. Karim", details="FMD vaccination", cost=Decimal("850"), next_due_date=today+timedelta(days=160)),
            HealthRecord(cow_id=cows[1].cow_id, record_type="deworming", record_date=today-timedelta(days=8), vet_name="Dr. Karim", details="Routine deworming", cost=Decimal("450"), next_due_date=today+timedelta(days=82)),
            BreedingRecord(cow_id=cows[0].cow_id, heat_date=today-timedelta(days=95), seed_date=today-timedelta(days=92), conception_date=today-timedelta(days=80), semen_code="HF-2026-118", semen_provider="District AI Center", doctor_name="Dr. Karim", cost=Decimal("1800"), outcome="successful", notes="Follow-up confirmed."),
        ])
        await session.flush()
        breeding = (await session.execute(select(BreedingRecord).where(BreedingRecord.cow_id == cows[0].cow_id))).scalar_one()
        session.add(PregnancyReport(cow_id=cows[0].cow_id, breeding_id=breeding.breeding_id, report_date=today-timedelta(days=55), status="confirmed", expected_calving_date=today+timedelta(days=205), notes="Pregnancy confirmed by examination."))
        for feed_name, qty in (("Concentrated Feed", "18"), ("Green Grass", "45"), ("Dry Straw", "8")):
            feed = feeds[feed_name]
            session.add(FeedingRecord(feed_type_id=feed.feed_type_id, cow_id=None, feeding_date=today-timedelta(days=1), quantity=Decimal(qty), cost=Decimal(qty)*feed.unit_cost, notes="Daily herd ration"))
        session.add(Expense(category_id=categories["Electricity Bill"].category_id, warehouse_id=main_shed.warehouse_id, expense_date=today-timedelta(days=4), amount=Decimal("4200"), description="Monthly shed electricity"))

        workers = [Worker(name="Abdul Karim", phone="01810000001", role="caretaker", join_date=today-timedelta(days=500), monthly_salary=Decimal("18000"), status="active"), Worker(name="Mina Akter", phone="01810000002", role="milker", join_date=today-timedelta(days=260), monthly_salary=Decimal("16000"), status="active")]
        session.add_all(workers)
        await session.flush()
        yesterday = today-timedelta(days=1)
        session.add_all([WorkerAttendance(worker_id=w.worker_id, attendance_date=yesterday, is_present=(i == 0), note=None if i == 0 else "Weekly leave") for i, w in enumerate(workers)])
        session.add_all([SalaryPayment(worker_id=w.worker_id, pay_month=today.replace(day=1)-timedelta(days=1), base_salary=w.monthly_salary, absence_deduction=Decimal("0"), bonus=Decimal("1000") if i == 0 else Decimal("0"), net_paid=w.monthly_salary+(Decimal("1000") if i == 0 else Decimal("0")), paid_date=today.replace(day=1), status="paid") for i, w in enumerate(workers)])
        session.add(MillCharge(charge_date=today-timedelta(days=2), charge_type="worker_food", amount=Decimal("650"), description="Weekly worker meal supplies"))

        customer = Customer(name="Green Valley Dairy Shop", phone="01910000001", customer_type="dairy_shop")
        session.add(customer)
        await session.flush()
        invoice = SalesInvoice(invoice_number=f"DEMO-{today:%Y%m%d}-001", customer_id=customer.customer_id, invoice_date=today-timedelta(days=2), due_date=today+timedelta(days=5), status="partially_paid", subtotal=Decimal("8400"), discount=Decimal("0"), total_amount=Decimal("8400"), paid_amount=Decimal("5000"), notes="Demo milk order")
        session.add(invoice)
        await session.flush()
        session.add_all([
            SalesInvoiceLine(invoice_id=invoice.invoice_id, item_type="milk", description="Fresh cow milk", quantity=Decimal("120"), unit_price=Decimal("70"), line_total=Decimal("8400")),
            SalePayment(invoice_id=invoice.invoice_id, payment_date=today-timedelta(days=2), amount=Decimal("5000"), payment_method="bKash", reference_number="DEMO-PAY-001"),
        ])
        session.add_all([
            MilkProduction(cow_id=cows[0].cow_id, production_date=today-timedelta(days=1), session="morning", liters=Decimal("12.5")),
            MilkProduction(cow_id=cows[0].cow_id, production_date=today-timedelta(days=1), session="evening", liters=Decimal("10.2")),
            MilkProduction(cow_id=cows[1].cow_id, production_date=today-timedelta(days=1), session="morning", liters=Decimal("9.1")),
            MilkProduction(cow_id=cows[1].cow_id, production_date=today-timedelta(days=1), session="evening", liters=Decimal("7.8")),
        ])
        session.add(PurchaseEvaluation(evaluation_date=today-timedelta(days=3), supplier_id=suppliers[1].supplier_id, live_weight_kg=Decimal("390"), growth_potential="good", net_weight_percent=Decimal("58"), est_net_weight_kg=Decimal("226.20"), offered_price=Decimal("138000"), net_price_per_kg=Decimal("610.08"), market_price_id=None, market_price_per_kg=Decimal("650"), is_profitable=True, decision="returned", notes="Evaluation example; animal not purchased."))
        await session.commit()
        print("Sample farm data created: 4 cows, care and feeding records, staff, milk sales, and a purchase evaluation.")


if __name__ == "__main__":
    asyncio.run(seed_sample_data())
