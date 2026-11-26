from datetime import date, timedelta
from decimal import Decimal
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_sales_invoice_edit_multiline_and_recalculation(client: AsyncClient):
    auth = {"Authorization": "Bearer dev-user:admin"}
    cust = (
        await client.post(
            "/api/v1/sales/customers",
            json={"name": "Dhaka Dairy", "customer_type": "dairy_shop"},
            headers=auth,
        )
    ).json()

    inv = (
        await client.post(
            "/api/v1/sales/invoices",
            json={
                "customer_id": cust["customer_id"],
                "invoice_date": str(date.today()),
                "discount": 100.0,
                "lines": [
                    {
                        "item_type": "milk",
                        "description": "Morning milk",
                        "quantity": 50.0,
                        "unit_price": 80.0,
                    }
                ],
            },
            headers=auth,
        )
    ).json()
    inv_id = inv["invoice_id"]
    assert Decimal(inv["total_amount"]) == Decimal("3900.00")

    # Edit to multi-line invoice (morning + evening milk) and updated discount
    patched = await client.patch(
        f"/api/v1/sales/invoices/{inv_id}",
        json={
            "discount": 50.0,
            "lines": [
                {
                    "item_type": "milk",
                    "description": "Morning milk",
                    "quantity": 40.0,
                    "unit_price": 80.0,
                },
                {
                    "item_type": "milk",
                    "description": "Evening milk",
                    "quantity": 20.0,
                    "unit_price": 85.0,
                },
            ],
        },
        headers=auth,
    )
    assert patched.status_code == 200
    body = patched.json()
    assert len(body["lines"]) == 2
    assert Decimal(body["subtotal"]) == Decimal("4900.00")
    assert Decimal(body["discount"]) == Decimal("50.00")
    assert Decimal(body["total_amount"]) == Decimal("4850.00")


@pytest.mark.asyncio
async def test_purchase_evaluation_edit_and_market_price_basis(client: AsyncClient):
    auth = {"Authorization": "Bearer dev-user:admin"}

    mp = await client.post(
        "/api/v1/evaluations/market-prices",
        json={
            "price_date": str(date.today()),
            "price_per_kg_net": 700.0,
            "price_basis": "dressed_meat",
            "source": "Road Bazar",
        },
        headers=auth,
    )
    assert mp.status_code == 201
    assert mp.json()["price_basis"] == "dressed_meat"

    ev = (
        await client.post(
            "/api/v1/evaluations",
            json={
                "evaluation_date": str(date.today()),
                "live_weight_kg": 350.0,
                "growth_potential": "good",
                "custom_net_weight_percent": 61.0,
                "offered_price": 125000.0,
                "market_price_per_kg": 700.0,
                "decision": "pending",
            },
            headers=auth,
        )
    ).json()
    ev_id = ev["evaluation_id"]

    # Edit live weight & offered price -> derived metrics recalculate
    patched = await client.patch(
        f"/api/v1/evaluations/{ev_id}",
        json={
            "live_weight_kg": 400.0,
            "custom_net_weight_percent": 60.0,
            "offered_price": 120000.0,
            "decision": "bought",
        },
        headers=auth,
    )
    assert patched.status_code == 200
    data = patched.json()
    assert Decimal(data["est_net_weight_kg"]) == Decimal("240.00")
    assert Decimal(data["net_price_per_kg"]) == Decimal("500.00")
    assert data["is_profitable"] is True
    assert data["decision"] == "bought"


@pytest.mark.asyncio
async def test_breeding_pregnancy_date_validation_and_calving_alert_clear(client: AsyncClient):
    auth = {"Authorization": "Bearer dev-user:admin"}
    today = date.today()

    wh = (
        await client.post(
            "/api/v1/herd/warehouses",
            json={"name": "Thakurgaon Shed", "capacity": 15},
            headers=auth,
        )
    ).json()
    cow = (
        await client.post(
            "/api/v1/herd/cows",
            json={
                "current_tag_number": "208",
                "sex": "female",
                "category": "dairy",
                "cow_type": "Cow",
                "acquisition_type": "born_on_farm",
                "acquisition_date": str(today - timedelta(days=300)),
                "warehouse_id": wh["warehouse_id"],
            },
            headers=auth,
        )
    ).json()
    cow_id = cow["cow_id"]
    # Female Cow with cow_type='Cow' automatically defaults to gives_milk=True with sessions
    assert cow["gives_milk"] is True
    assert len(cow["milking_sessions"]) == 3

    # Search matches shed name too
    search_res = (await client.get("/api/v1/herd/cows?search=Thakurgaon", headers=auth)).json()
    assert any(c["cow_id"] == cow_id for c in search_res)

    # Breeding date order check: seed_date < heat_date rejected
    bad_breed = await client.post(
        "/api/v1/health/breeding",
        json={
            "cow_id": cow_id,
            "heat_date": str(today),
            "seed_date": str(today - timedelta(days=1)),
            "method": "artificial_insemination",
            "semen_code": "S-100",
        },
        headers=auth,
    )
    assert bad_breed.status_code == 422

    # Pregnancy expected_calving < report_date rejected
    bad_preg = await client.post(
        "/api/v1/health/pregnancy",
        json={
            "cow_id": cow_id,
            "report_date": str(today),
            "status": "suspected",
            "expected_calving_date": str(today - timedelta(days=3)),
        },
        headers=auth,
    )
    assert bad_preg.status_code == 422

    # Create an overdue suspected pregnancy, then log a sibling calved report -> alert clears
    await client.post(
        "/api/v1/health/pregnancy",
        json={
            "cow_id": cow_id,
            "report_date": str(today - timedelta(days=30)),
            "status": "suspected",
            "expected_calving_date": str(today - timedelta(days=6)),
        },
        headers=auth,
    )
    dash1 = (await client.get("/api/v1/reports/dashboard", headers=auth)).json()
    assert dash1["breeding_alert_count"] == 1

    await client.post(
        "/api/v1/health/pregnancy",
        json={
            "cow_id": cow_id,
            "report_date": str(today - timedelta(days=2)),
            "status": "suspected",
            "actual_calving_date": str(today - timedelta(days=2)),
            "notes": "Done",
        },
        headers=auth,
    )
    dash2 = (await client.get("/api/v1/reports/dashboard", headers=auth)).json()
    assert dash2["breeding_alert_count"] == 0


@pytest.mark.asyncio
async def test_feed_stock_worker_advances_and_report_csvs(client: AsyncClient):
    auth = {"Authorization": "Bearer dev-user:admin"}
    today = date.today()

    # 1. Feed stock restock + deduction
    cat = (
        await client.post(
            "/api/v1/feeding/categories",
            json={"name": "Silage", "name_bn": "সাইলেজ", "category_group": "food"},
            headers=auth,
        )
    ).json()
    ft = (
        await client.post(
            "/api/v1/feeding/feed-types",
            json={
                "category_id": cat["category_id"],
                "name": "Maize Silage",
                "name_bn": "ভুট্টা সাইলেজ",
                "unit": "kg",
                "unit_cost": 12.0,
                "stock_quantity": 0.0,
                "reorder_level": 50.0,
            },
            headers=auth,
        )
    ).json()
    ft_id = ft["feed_type_id"]

    restock = await client.post(
        "/api/v1/feeding/stock-entries",
        json={"feed_type_id": ft_id, "entry_date": str(today), "quantity_added": 200.0},
        headers=auth,
    )
    assert restock.status_code == 201

    feed_log = await client.post(
        "/api/v1/feeding/feeding-records",
        json={"feed_type_id": ft_id, "feeding_date": str(today), "quantity": 45.0},
        headers=auth,
    )
    assert feed_log.status_code == 201

    ft_after = (await client.get("/api/v1/feeding/feed-types", headers=auth)).json()
    matched_ft = next(x for x in ft_after if x["feed_type_id"] == ft_id)
    assert Decimal(matched_ft["stock_quantity"]) == Decimal("155.00")

    # 2. Worker advance (ogrim) + salary settlement with overtime & advance deduction
    worker = (
        await client.post(
            "/api/v1/labor/workers",
            json={
                "name": "Hasan Ali",
                "role": "caretaker",
                "join_date": str(today - timedelta(days=90)),
                "monthly_salary": 15000.0,
            },
            headers=auth,
        )
    ).json()
    w_id = worker["worker_id"]

    adv = await client.post(
        "/api/v1/labor/advances",
        json={"worker_id": w_id, "advance_date": str(today), "amount": 2500.0, "notes": "Ogrim"},
        headers=auth,
    )
    assert adv.status_code == 201

    w_check = (await client.get(f"/api/v1/labor/workers/{w_id}", headers=auth)).json()
    assert Decimal(w_check["outstanding_advance"]) == Decimal("2500.00")

    sal = await client.post(
        "/api/v1/labor/salary-payments",
        json={
            "worker_id": w_id,
            "pay_month": str(today.replace(day=1)),
            "base_salary": 15000.0,
            "absence_deduction": 0.0,
            "advance_deduction": 1500.0,
            "bonus": 1000.0,
            "overtime_pay": 500.0,
            "payroll_day_basis": "calendar",
            "paid_date": str(today),
            "status": "paid",
        },
        headers=auth,
    )
    assert sal.status_code == 201
    assert Decimal(sal.json()["net_paid"]) == Decimal("15000.00")

    w_after = (await client.get(f"/api/v1/labor/workers/{w_id}", headers=auth)).json()
    assert Decimal(w_after["outstanding_advance"]) == Decimal("1000.00")

    # 3. Herd & Milk summary CSV exports
    herd_csv = await client.get("/api/v1/reports/herd-summary/csv", headers=auth)
    assert herd_csv.status_code == 200
    assert "text/csv" in herd_csv.headers["content-type"]

    milk_csv = await client.get("/api/v1/reports/milk-summary/csv", headers=auth)
    assert milk_csv.status_code == 200
    assert "text/csv" in milk_csv.headers["content-type"]
