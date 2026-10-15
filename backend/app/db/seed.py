import asyncio
from datetime import date, timedelta
from decimal import Decimal
from sqlalchemy import select
from app.core.database import async_session_maker
from app.models.feeding import ExpenseCategory, FeedType, FeedingRecord, Expense
from app.models.herd import Warehouse, Cow, Supplier, WeightRecord, CowWarehouseHistory
from app.models.evaluation import MarketPrice, PurchaseEvaluation
from app.models.health import HealthRecord, BreedingRecord, PregnancyReport
from app.models.labor import Worker, WorkerAttendance, SalaryPayment, MillCharge
from app.models.sales import MilkProduction, Customer, SalesInvoice, SalesInvoiceLine, SalePayment

DEFAULT_CATEGORIES = [
    {"name": "Concentrated Feed", "name_bn": "দানাদার খাদ্য", "category_group": "food"},
    {"name": "Green Grass", "name_bn": "কাঁচা ঘাস", "category_group": "food"},
    {"name": "Dry Straw", "name_bn": "শুকনা খড়", "category_group": "food"},
    {"name": "Vitamin & Minerals", "name_bn": "ভিটামিন ও খনিজ", "category_group": "food"},
    {"name": "Molasses", "name_bn": "মলাসেস / লালি গুড়", "category_group": "food"},
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
        for w_data in DEFAULT_WAREHOUSES:
            existing = (await session.execute(select(Warehouse).where(Warehouse.name == w_data["name"]))).scalar_one_or_none()
            if not existing:
                session.add(Warehouse(**w_data))

        category_map = {}
        for cat_data in DEFAULT_CATEGORIES:
            existing = (await session.execute(select(ExpenseCategory).where(ExpenseCategory.name == cat_data["name"]))).scalar_one_or_none()
            if not existing:
                cat = ExpenseCategory(**cat_data)
                session.add(cat)
                await session.flush()
                category_map[cat.name] = cat
            else:
                category_map[existing.name] = existing

        feed_items = [
            ("Concentrated Feed", "দানাদার খাদ্য", "kg", Decimal("55.00"), "Concentrated Feed"),
            ("Green Grass", "কাঁচা ঘাস", "kg", Decimal("5.50"), "Green Grass"),
            ("Dry Straw", "শুকনা খড়", "bundle", Decimal("18.00"), "Dry Straw"),
            ("Vitamin Premix", "ভিটামিন মিনারেল প্রিমিক্স", "kg", Decimal("350.00"), "Vitamin & Minerals"),
            ("Molasses", "মলাসেস / লালি গুড়", "kg", Decimal("48.00"), "Molasses"),
        ]
        for name, name_bn, unit, unit_cost, cat_name in feed_items:
            cat = category_map.get(cat_name)
            if cat and not (await session.execute(select(FeedType).where(FeedType.name == name))).scalar_one_or_none():
                session.add(FeedType(category_id=cat.category_id, name=name, name_bn=name_bn, unit=unit, unit_cost=unit_cost))

        today = date.today()
        if not (await session.execute(select(MarketPrice).where(MarketPrice.price_date == today))).scalar_one_or_none():
            session.add(MarketPrice(price_date=today, price_per_kg_net=Decimal("650.00"), source="Local Cattle Market Average"))

        await session.commit()
        print("Base data seeded.")

async def seed_sample_data():
    """Full client-demo dataset."""
    await seed_data()
    today = date.today()
    async with async_session_maker() as session:
        if (await session.execute(select(Cow).where(Cow.current_tag_number == "GC-001"))).scalar_one_or_none():
            print("Demo data already exists; skipping.")
            return

        warehouses = {w.name: w for w in (await session.execute(select(Warehouse))).scalars()}
        main = next(w for w in warehouses.values() if "Main" in w.name)
        calf = next(w for w in warehouses.values() if "Calf" in w.name)
        isol = next(w for w in warehouses.values() if "Quarantine" in w.name)

        suppliers = [
            Supplier(name="Rahman Livestock", phone="01711000001", supplier_type="farm"),
            Supplier(name="Savar Cattle Market", phone="01711000002", supplier_type="market"),
            Supplier(name="Gazipur Dairy Farm", phone="01711000003", supplier_type="farm"),
            Supplier(name="Local Bazar Trader", phone="01711000004", supplier_type="individual"),
        ]
        session.add_all(suppliers)
        await session.flush()

        cows = [
            Cow(current_tag_number="GC-001", sex="female", category="dairy", birth_date=today-timedelta(days=1400), acquisition_type="bought_from_supplier", acquisition_date=today-timedelta(days=950), purchase_price=Decimal("155000"), supplier_id=suppliers[0].supplier_id, warehouse_id=main.warehouse_id, status="active", notes="Holstein cross, high yielder"),
            Cow(current_tag_number="GC-002", sex="female", category="dairy", birth_date=today-timedelta(days=1200), acquisition_type="bought_from_bazar", acquisition_date=today-timedelta(days=800), purchase_price=Decimal("142000"), supplier_id=suppliers[1].supplier_id, warehouse_id=main.warehouse_id, status="active", notes="Good temperament"),
            Cow(current_tag_number="GC-003", sex="female", category="dairy", birth_date=today-timedelta(days=1100), acquisition_type="bought_from_supplier", acquisition_date=today-timedelta(days=700), purchase_price=Decimal("138000"), supplier_id=suppliers[2].supplier_id, warehouse_id=main.warehouse_id, status="active", notes="Consistent 20+ L/day"),
            Cow(current_tag_number="GC-004", sex="female", category="dairy", birth_date=today-timedelta(days=980), acquisition_type="bought_from_supplier", acquisition_date=today-timedelta(days=600), purchase_price=Decimal("128000"), supplier_id=suppliers[0].supplier_id, warehouse_id=main.warehouse_id, status="active"),
            Cow(current_tag_number="GC-005", sex="female", category="dairy", birth_date=today-timedelta(days=900), acquisition_type="bought_from_bazar", acquisition_date=today-timedelta(days=500), purchase_price=Decimal("135000"), supplier_id=suppliers[1].supplier_id, warehouse_id=main.warehouse_id, status="active"),
            Cow(current_tag_number="GC-006", sex="female", category="dairy", birth_date=today-timedelta(days=850), acquisition_type="bought_from_supplier", acquisition_date=today-timedelta(days=450), purchase_price=Decimal("148000"), supplier_id=suppliers[2].supplier_id, warehouse_id=main.warehouse_id, status="active"),
            Cow(current_tag_number="GC-B01", sex="male", category="bull", birth_date=today-timedelta(days=1100), acquisition_type="bought_from_supplier", acquisition_date=today-timedelta(days=750), purchase_price=Decimal("125000"), supplier_id=suppliers[0].supplier_id, warehouse_id=main.warehouse_id, status="active", notes="Breeding bull"),
            Cow(current_tag_number="GC-H01", sex="female", category="heifer", birth_date=today-timedelta(days=450), acquisition_type="bought_from_supplier", acquisition_date=today-timedelta(days=300), purchase_price=Decimal("95000"), supplier_id=suppliers[2].supplier_id, warehouse_id=main.warehouse_id, status="active"),
            Cow(current_tag_number="GC-C01", sex="female", category="calf", birth_date=today-timedelta(days=120), acquisition_type="born_on_farm", acquisition_date=today-timedelta(days=120), warehouse_id=calf.warehouse_id, status="active", notes="Daughter of GC-001"),
            Cow(current_tag_number="GC-C02", sex="male", category="calf", birth_date=today-timedelta(days=90), acquisition_type="born_on_farm", acquisition_date=today-timedelta(days=90), warehouse_id=calf.warehouse_id, status="active"),
            Cow(current_tag_number="GC-S01", sex="female", category="dairy", birth_date=today-timedelta(days=1600), acquisition_type="bought_from_bazar", acquisition_date=today-timedelta(days=1100), purchase_price=Decimal("110000"), supplier_id=suppliers[3].supplier_id, warehouse_id=main.warehouse_id, status="sold", notes="Sold last month"),
            Cow(current_tag_number="GC-D01", sex="female", category="dairy", birth_date=today-timedelta(days=1800), acquisition_type="bought_from_supplier", acquisition_date=today-timedelta(days=1300), purchase_price=Decimal("98000"), supplier_id=suppliers[0].supplier_id, warehouse_id=isol.warehouse_id, status="deceased", notes="Died of disease"),
        ]
        session.add_all(cows)
        await session.flush()
        cows[8].dam_id = cows[0].cow_id
        cows[9].dam_id = cows[1].cow_id

        weights = [(0,30,"485"),(0,7,"492"),(1,30,"445"),(1,7,"450"),(2,30,"460"),(2,7,"468"),(3,25,"420"),(4,20,"435"),(5,15,"455"),(6,40,"520"),(7,10,"280"),(8,5,"95"),(9,5,"78")]
        session.add_all([WeightRecord(cow_id=cows[i].cow_id, weigh_date=today-timedelta(days=d), weight_kg=Decimal(w)) for i,d,w in weights])

        session.add_all([CowWarehouseHistory(cow_id=c.cow_id, warehouse_id=c.warehouse_id, moved_in_date=c.acquisition_date, reason="Initial placement") for c in cows])
        session.add(CowWarehouseHistory(cow_id=cows[0].cow_id, warehouse_id=isol.warehouse_id, moved_in_date=today-timedelta(days=40), moved_out_date=today-timedelta(days=35), reason="Temporary isolation"))

        session.add_all([
            HealthRecord(cow_id=cows[0].cow_id, record_type="vaccination", record_date=today-timedelta(days=35), vet_name="Dr. Karim", details="FMD + HS", cost=Decimal("1200"), next_due_date=today+timedelta(days=150)),
            HealthRecord(cow_id=cows[1].cow_id, record_type="deworming", record_date=today-timedelta(days=12), vet_name="Dr. Karim", details="Routine", cost=Decimal("450"), next_due_date=today+timedelta(days=78)),
            HealthRecord(cow_id=cows[2].cow_id, record_type="treatment", record_date=today-timedelta(days=8), vet_name="Dr. Fatema", details="Mastitis treatment", cost=Decimal("2800")),
            HealthRecord(cow_id=cows[3].cow_id, record_type="checkup", record_date=today-timedelta(days=5), vet_name="Dr. Karim", details="Pregnancy check", cost=Decimal("600")),
            HealthRecord(cow_id=cows[4].cow_id, record_type="vaccination", record_date=today-timedelta(days=20), vet_name="Dr. Karim", details="Anthrax", cost=Decimal("900"), next_due_date=today+timedelta(days=345)),
            HealthRecord(cow_id=cows[5].cow_id, record_type="deworming", record_date=today-timedelta(days=3), vet_name="Dr. Fatema", details="Quarterly", cost=Decimal("500")),
            HealthRecord(cow_id=cows[6].cow_id, record_type="checkup", record_date=today-timedelta(days=15), vet_name="Dr. Karim", details="Breeding soundness", cost=Decimal("1500")),
            HealthRecord(cow_id=cows[8].cow_id, record_type="vaccination", record_date=today-timedelta(days=10), vet_name="Dr. Karim", details="Calf FMD", cost=Decimal("400")),
        ])

        session.add(BreedingRecord(cow_id=cows[0].cow_id, heat_date=today-timedelta(days=110), seed_date=today-timedelta(days=107), conception_date=today-timedelta(days=95), method="artificial_insemination", semen_code="HF-2026-220", semen_provider="District AI Center", doctor_name="Dr. Karim", cost=Decimal("2200"), outcome="successful"))
        session.add(BreedingRecord(cow_id=cows[2].cow_id, heat_date=today-timedelta(days=45), seed_date=today-timedelta(days=42), method="artificial_insemination", semen_code="HF-2026-185", semen_provider="District AI Center", doctor_name="Dr. Fatema", cost=Decimal("2000"), outcome="pending"))
        session.add(BreedingRecord(cow_id=cows[3].cow_id, heat_date=today-timedelta(days=200), seed_date=today-timedelta(days=197), conception_date=today-timedelta(days=185), method="artificial_insemination", semen_code="HF-2025-998", semen_provider="District AI Center", doctor_name="Dr. Karim", cost=Decimal("1800"), outcome="successful"))
        await session.flush()
        breedings = (await session.execute(select(BreedingRecord))).scalars().all()
        session.add(PregnancyReport(cow_id=cows[0].cow_id, breeding_id=breedings[0].breeding_id, report_date=today-timedelta(days=70), status="confirmed", expected_calving_date=today+timedelta(days=190)))
        session.add(PregnancyReport(cow_id=cows[3].cow_id, breeding_id=breedings[2].breeding_id, report_date=today-timedelta(days=150), status="confirmed", expected_calving_date=today+timedelta(days=90)))

        categories = {c.name: c for c in (await session.execute(select(ExpenseCategory))).scalars()}
        feeds = {f.name: f for f in (await session.execute(select(FeedType))).scalars()}
        for d in range(1, 8):
            for name, qty in [("Concentrated Feed", "22"), ("Green Grass", "55"), ("Dry Straw", "10")]:
                f = feeds[name]
                session.add(FeedingRecord(feed_type_id=f.feed_type_id, feeding_date=today-timedelta(days=d), quantity=Decimal(qty), cost=Decimal(qty)*f.unit_cost, notes="Daily herd ration"))
        session.add_all([
            Expense(category_id=categories["Electricity Bill"].category_id, warehouse_id=main.warehouse_id, expense_date=today-timedelta(days=5), amount=Decimal("4850"), description="Monthly electricity"),
            Expense(category_id=categories["Veterinary Services"].category_id, expense_date=today-timedelta(days=8), amount=Decimal("2800"), description="Mastitis treatment GC-003"),
            Expense(category_id=categories["Cow Rope"].category_id, expense_date=today-timedelta(days=12), amount=Decimal("1200"), description="New ropes"),
            Expense(category_id=categories["Labor Food"].category_id, expense_date=today-timedelta(days=2), amount=Decimal("1800"), description="Weekly worker meals"),
            Expense(category_id=categories["Ear Tags"].category_id, expense_date=today-timedelta(days=20), amount=Decimal("650"), description="Replacement tags"),
        ])

        workers = [
            Worker(name="Abdul Karim", phone="01811000001", role="caretaker", join_date=today-timedelta(days=600), monthly_salary=Decimal("18500"), status="active"),
            Worker(name="Mina Akter", phone="01811000002", role="milker", join_date=today-timedelta(days=320), monthly_salary=Decimal("16500"), status="active"),
            Worker(name="Rafiq Islam", phone="01811000003", role="cleaner", join_date=today-timedelta(days=180), monthly_salary=Decimal("14000"), status="active"),
            Worker(name="Shahidul Islam", phone="01811000004", role="night_guard", join_date=today-timedelta(days=90), monthly_salary=Decimal("15000"), status="active"),
        ]
        session.add_all(workers)
        await session.flush()
        for d in range(1, 15):
            for i, w in enumerate(workers):
                present = not (i == 1 and d % 7 == 0)
                session.add(WorkerAttendance(worker_id=w.worker_id, attendance_date=today-timedelta(days=d), is_present=present, note=None if present else "Weekly leave"))
        last_month = (today.replace(day=1) - timedelta(days=1)).replace(day=1)
        session.add_all([SalaryPayment(worker_id=w.worker_id, pay_month=last_month, base_salary=w.monthly_salary, absence_deduction=Decimal("0"), bonus=Decimal("1500") if i==0 else Decimal("0"), net_paid=w.monthly_salary+(Decimal("1500") if i==0 else Decimal("0")), paid_date=today.replace(day=1), status="paid") for i,w in enumerate(workers)])
        session.add(MillCharge(charge_date=today-timedelta(days=3), charge_type="worker_food", amount=Decimal("2200"), description="Weekly meal supplies"))
        session.add(MillCharge(charge_date=today-timedelta(days=10), charge_type="substitute_worker", amount=Decimal("800"), substitute_name="Temporary helper", description="One-day substitute"))

        customers = [
            Customer(name="Green Valley Dairy", phone="01911000001", customer_type="dairy_shop"),
            Customer(name="Fresh Milk Corner", phone="01911000002", customer_type="dairy_shop"),
            Customer(name="City Wholesaler", phone="01911000003", customer_type="wholesaler"),
            Customer(name="Mrs. Nasrin", phone="01911000004", customer_type="individual"),
            Customer(name="Meat Buyer Karim", phone="01911000005", customer_type="meat_buyer"),
        ]
        session.add_all(customers)
        await session.flush()

        inv1 = SalesInvoice(invoice_number=f"INV-{today:%Y%m}-001", customer_id=customers[0].customer_id, invoice_date=today-timedelta(days=3), due_date=today+timedelta(days=4), status="partially_paid", subtotal=Decimal("12600"), discount=Decimal("0"), total_amount=Decimal("12600"), paid_amount=Decimal("8000"), notes="Regular milk supply")
        inv2 = SalesInvoice(invoice_number=f"INV-{today:%Y%m}-002", customer_id=customers[1].customer_id, invoice_date=today-timedelta(days=1), due_date=today+timedelta(days=6), status="paid", subtotal=Decimal("8400"), discount=Decimal("200"), total_amount=Decimal("8200"), paid_amount=Decimal("8200"))
        inv3 = SalesInvoice(invoice_number=f"INV-{today:%Y%m}-003", customer_id=customers[2].customer_id, invoice_date=today-timedelta(days=5), due_date=today+timedelta(days=2), status="issued", subtotal=Decimal("21000"), discount=Decimal("0"), total_amount=Decimal("21000"), paid_amount=Decimal("0"))
        inv4 = SalesInvoice(invoice_number=f"INV-{today:%Y%m}-004", customer_id=customers[4].customer_id, invoice_date=today-timedelta(days=20), due_date=today-timedelta(days=10), status="paid", subtotal=Decimal("145000"), discount=Decimal("0"), total_amount=Decimal("145000"), paid_amount=Decimal("145000"), notes="Sold GC-S01")
        session.add_all([inv1, inv2, inv3, inv4])
        await session.flush()
        session.add_all([
            SalesInvoiceLine(invoice_id=inv1.invoice_id, item_type="milk", description="Fresh milk", quantity=Decimal("180"), unit_price=Decimal("70"), line_total=Decimal("12600")),
            SalesInvoiceLine(invoice_id=inv2.invoice_id, item_type="milk", description="Fresh milk", quantity=Decimal("120"), unit_price=Decimal("70"), line_total=Decimal("8400")),
            SalesInvoiceLine(invoice_id=inv3.invoice_id, item_type="milk", description="Bulk milk", quantity=Decimal("300"), unit_price=Decimal("70"), line_total=Decimal("21000")),
            SalesInvoiceLine(invoice_id=inv4.invoice_id, item_type="animal", cow_id=cows[10].cow_id, description="Sold cow GC-S01", quantity=Decimal("1"), unit_price=Decimal("145000"), line_total=Decimal("145000")),
        ])
        session.add_all([
            SalePayment(invoice_id=inv1.invoice_id, payment_date=today-timedelta(days=3), amount=Decimal("8000"), payment_method="bKash", reference_number="BK-8891"),
            SalePayment(invoice_id=inv2.invoice_id, payment_date=today-timedelta(days=1), amount=Decimal("8200"), payment_method="cash"),
            SalePayment(invoice_id=inv4.invoice_id, payment_date=today-timedelta(days=18), amount=Decimal("145000"), payment_method="bank", reference_number="TRX-5542"),
        ])

        dairy = [cows[0], cows[1], cows[2], cows[3]]
        yields = [(12.5,10.2),(9.8,8.5),(11.0,9.5),(10.5,9.0)]
        for d in range(1,11):
            for i, cow in enumerate(dairy):
                m,e = yields[i]
                session.add(MilkProduction(cow_id=cow.cow_id, production_date=today-timedelta(days=d), session="morning", liters=Decimal(str(m))))
                session.add(MilkProduction(cow_id=cow.cow_id, production_date=today-timedelta(days=d), session="evening", liters=Decimal(str(e))))

        for d in range(5):
            session.add(MarketPrice(price_date=today-timedelta(days=d), price_per_kg_net=Decimal("650")+Decimal(d*2), source="Gabtoli / Local Hat"))
        await session.flush()
        prices = (await session.execute(select(MarketPrice).order_by(MarketPrice.price_date.desc()))).scalars().all()
        session.add_all([
            PurchaseEvaluation(evaluation_date=today-timedelta(days=4), supplier_id=suppliers[1].supplier_id, live_weight_kg=Decimal("410"), growth_potential="good", net_weight_percent=Decimal("58"), est_net_weight_kg=Decimal("237.8"), offered_price=Decimal("148000"), net_price_per_kg=Decimal("622"), market_price_id=prices[0].market_price_id, market_price_per_kg=Decimal("650"), is_profitable=True, decision="bought", notes="Bought as GC-006"),
            PurchaseEvaluation(evaluation_date=today-timedelta(days=2), supplier_id=suppliers[3].supplier_id, live_weight_kg=Decimal("380"), growth_potential="poor", net_weight_percent=Decimal("55"), est_net_weight_kg=Decimal("209"), offered_price=Decimal("135000"), net_price_per_kg=Decimal("646"), market_price_id=prices[0].market_price_id, market_price_per_kg=Decimal("650"), is_profitable=False, decision="returned"),
            PurchaseEvaluation(evaluation_date=today-timedelta(days=1), supplier_id=suppliers[0].supplier_id, live_weight_kg=Decimal("395"), growth_potential="good", net_weight_percent=Decimal("57"), est_net_weight_kg=Decimal("225.15"), offered_price=Decimal("140000"), net_price_per_kg=Decimal("622"), market_price_id=prices[0].market_price_id, market_price_per_kg=Decimal("650"), is_profitable=True, decision="pending"),
        ])

        await session.commit()
        print("Full demo data loaded.")

if __name__ == "__main__":
    asyncio.run(seed_sample_data())