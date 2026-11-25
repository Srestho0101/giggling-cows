import uuid
from datetime import date, timedelta
from decimal import Decimal
import pytest
from httpx import AsyncClient

from app.core.config import Settings
from app.services.evaluation_service import calculate_evaluation_metrics


def test_supabase_pooler_url_configuration():
    settings = Settings(
        DATABASE_URL="postgresql://postgres:secret@aws-0-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true"
    )

    assert "pgbouncer" not in settings.async_database_url
    assert "sslmode" not in settings.async_database_url
    assert settings.database_connect_args["ssl"] == "require"


@pytest.mark.asyncio
async def test_evaluation_calculation_logic():
    # Test "good" growth potential (61% net weight)
    # Live weight: 500 kg -> 305 kg net
    # Offered price: 180,000 BDT -> 590.16 BDT/kg
    # Market price: 650 BDT/kg -> Profitable!
    res = calculate_evaluation_metrics(
        live_weight_kg=Decimal("500.00"),
        growth_potential="good",
        offered_price=Decimal("180000.00"),
        market_price_per_kg=Decimal("650.00"),
    )
    assert res.net_weight_percent == Decimal("61.00")
    assert res.est_net_weight_kg == Decimal("305.00")
    assert res.net_price_per_kg == Decimal("590.16")
    assert res.is_profitable is True
    assert res.price_difference_per_kg == Decimal("59.84")

    # Test "poor" growth potential (54.5% net weight)
    # Live weight: 400 kg -> 218 kg net
    # Offered price: 150,000 BDT -> 688.07 BDT/kg
    # Market price: 650 BDT/kg -> Not Profitable!
    res_poor = calculate_evaluation_metrics(
        live_weight_kg=Decimal("400.00"),
        growth_potential="poor",
        offered_price=Decimal("150000.00"),
        market_price_per_kg=Decimal("650.00"),
    )
    assert res_poor.net_weight_percent == Decimal("54.50")
    assert res_poor.est_net_weight_kg == Decimal("218.00")
    assert res_poor.net_price_per_kg == Decimal("688.07")
    assert res_poor.is_profitable is False


@pytest.mark.asyncio
async def test_cow_lifecycle_and_invoicing_flow(client: AsyncClient):
    auth_headers = {"Authorization": "Bearer dev-user:admin"}

    # 1. Create a warehouse
    wh_resp = await client.post(
        "/api/v1/herd/warehouses",
        json={"name": "Test Shed A", "housing_type": "tie_stall", "capacity": 20},
        headers=auth_headers,
    )
    assert wh_resp.status_code == 201
    wh_id = wh_resp.json()["warehouse_id"]

    # 2. Create an active cow
    cow_resp = await client.post(
        "/api/v1/herd/cows",
        json={
            "current_tag_number": "COW-001",
            "sex": "female",
            "category": "dairy",
            "acquisition_type": "born_on_farm",
            "acquisition_date": str(date.today()),
            "warehouse_id": wh_id,
            "status": "active",
        },
        headers=auth_headers,
    )
    assert cow_resp.status_code == 201
    cow_data = cow_resp.json()
    cow_id = cow_data["cow_id"]
    assert cow_data["status"] == "active"
    assert len(cow_data["id_history"]) == 1
    assert len(cow_data["warehouse_history"]) == 1

    # 3. Create a customer
    cust_resp = await client.post(
        "/api/v1/sales/customers",
        json={"name": "Abdul Karim", "phone": "01711000000", "customer_type": "meat_buyer"},
        headers=auth_headers,
    )
    assert cust_resp.status_code == 201
    cust_id = cust_resp.json()["customer_id"]

    # 4. Create an invoice selling COW-001
    inv_resp = await client.post(
        "/api/v1/sales/invoices",
        json={
            "customer_id": cust_id,
            "invoice_date": str(date.today()),
            "discount": 5000.0,
            "notes": "Cow sale",
            "lines": [
                {
                    "item_type": "animal",
                    "cow_id": cow_id,
                    "description": "Bull/Cow sale COW-001",
                    "quantity": 1.0,
                    "unit_price": 125000.0,
                }
            ],
        },
        headers=auth_headers,
    )
    assert inv_resp.status_code == 201
    inv_data = inv_resp.json()
    inv_id = inv_data["invoice_id"]
    assert inv_data["status"] == "draft"
    assert Decimal(inv_data["subtotal"]) == Decimal("125000.00")
    assert Decimal(inv_data["discount"]) == Decimal("5000.00")
    assert Decimal(inv_data["total_amount"]) == Decimal("120000.00")
    assert Decimal(inv_data["paid_amount"]) == Decimal("0.00")

    # Verify cow is still active while invoice is draft
    c_check = await client.get(f"/api/v1/herd/cows/{cow_id}", headers=auth_headers)
    assert c_check.json()["status"] == "active"

    # 5. Issue the invoice -> cow status must transition to 'sold'
    issue_resp = await client.patch(
        f"/api/v1/sales/invoices/{inv_id}/status",
        json={"status": "issued"},
        headers=auth_headers,
    )
    assert issue_resp.status_code == 200
    assert issue_resp.json()["status"] == "issued"

    c_sold_check = await client.get(f"/api/v1/herd/cows/{cow_id}", headers=auth_headers)
    assert c_sold_check.json()["status"] == "sold"

    # 6. Record partial payment
    pay1_resp = await client.post(
        f"/api/v1/sales/invoices/{inv_id}/payments",
        json={
            "payment_date": str(date.today()),
            "amount": 50000.0,
            "payment_method": "bKash",
            "reference_number": "TRX998877",
        },
        headers=auth_headers,
    )
    assert pay1_resp.status_code == 201

    inv_after_pay1 = await client.get(f"/api/v1/sales/invoices/{inv_id}", headers=auth_headers)
    assert inv_after_pay1.json()["status"] == "partially_paid"
    assert Decimal(inv_after_pay1.json()["paid_amount"]) == Decimal("50000.00")
    assert Decimal(inv_after_pay1.json()["outstanding_balance"]) == Decimal("70000.00")

    # 7. Complete the payment
    pay2_resp = await client.post(
        f"/api/v1/sales/invoices/{inv_id}/payments",
        json={
            "payment_date": str(date.today()),
            "amount": 70000.0,
            "payment_method": "cash",
        },
        headers=auth_headers,
    )
    assert pay2_resp.status_code == 201

    inv_after_pay2 = await client.get(f"/api/v1/sales/invoices/{inv_id}", headers=auth_headers)
    assert inv_after_pay2.json()["status"] == "paid"
    assert Decimal(inv_after_pay2.json()["paid_amount"]) == Decimal("120000.00")
    assert Decimal(inv_after_pay2.json()["outstanding_balance"]) == Decimal("0.00")


@pytest.mark.asyncio
async def test_breeding_source_exclusivity(client: AsyncClient):
    auth_headers = {"Authorization": "Bearer dev-user:admin"}

    wh_resp = await client.post(
        "/api/v1/herd/warehouses",
        json={"name": "Breeding Shed", "housing_type": "tie_stall", "capacity": 10},
        headers=auth_headers,
    )
    wh_id = wh_resp.json()["warehouse_id"]

    cow_resp = await client.post(
        "/api/v1/herd/cows",
        json={
            "current_tag_number": "DAM-01",
            "sex": "female",
            "category": "dairy",
            "acquisition_type": "born_on_farm",
            "acquisition_date": str(date.today()),
            "warehouse_id": wh_id,
            "status": "active",
        },
        headers=auth_headers,
    )
    cow_id = cow_resp.json()["cow_id"]

    # Attempt with NEITHER sire_id nor semen_code -> Must fail
    fail_neither = await client.post(
        "/api/v1/health/breeding",
        json={
            "cow_id": cow_id,
            "seed_date": str(date.today()),
            "method": "artificial_insemination",
        },
        headers=auth_headers,
    )
    assert fail_neither.status_code == 422

    # Attempt with valid semen_code -> Success
    success_semen = await client.post(
        "/api/v1/health/breeding",
        json={
            "cow_id": cow_id,
            "seed_date": str(date.today()),
            "method": "artificial_insemination",
            "semen_code": "HOLSTEIN-BRAC-99",
            "semen_provider": "BRAC AI Service",
            "cost": 850.0,
        },
        headers=auth_headers,
    )
    assert success_semen.status_code == 201
    assert success_semen.json()["semen_code"] == "HOLSTEIN-BRAC-99"


@pytest.mark.asyncio
async def test_cow_acquisition_rules(client: AsyncClient):
    auth_headers = {"Authorization": "Bearer dev-user:admin"}

    wh_resp = await client.post(
        "/api/v1/herd/warehouses",
        json={"name": "Shed X", "housing_type": "tie_stall", "capacity": 10},
        headers=auth_headers,
    )
    wh_id = wh_resp.json()["warehouse_id"]

    supp_resp = await client.post(
        "/api/v1/herd/suppliers",
        json={"name": "Rahim Dairy", "supplier_type": "dairy_farm"},
        headers=auth_headers,
    )
    supp_id = supp_resp.json()["supplier_id"]

    # Fails if born on farm has supplier_id
    resp_invalid_born = await client.post(
        "/api/v1/herd/cows",
        json={
            "current_tag_number": "INVALID-BORN-01",
            "sex": "female",
            "category": "dairy",
            "acquisition_type": "born_on_farm",
            "acquisition_date": str(date.today()),
            "supplier_id": supp_id,
            "warehouse_id": wh_id,
        },
        headers=auth_headers,
    )
    assert resp_invalid_born.status_code == 422


@pytest.mark.asyncio
async def test_purchase_evaluation_to_cow_conversion(client: AsyncClient):
    auth_headers = {"Authorization": "Bearer dev-user:admin"}

    # 1. Warehouse & Supplier
    wh_resp = await client.post(
        "/api/v1/herd/warehouses",
        json={"name": "Shed Evaluation", "housing_type": "shed", "capacity": 15},
        headers=auth_headers,
    )
    wh_id = wh_resp.json()["warehouse_id"]

    supp_resp = await client.post(
        "/api/v1/herd/suppliers",
        json={"name": "Kader Bepari", "supplier_type": "individual"},
        headers=auth_headers,
    )
    supp_id = supp_resp.json()["supplier_id"]

    # 2. Add Market Price
    mp_resp = await client.post(
        "/api/v1/evaluations/market-prices",
        json={"price_date": str(date.today()), "price_per_kg_net": 650.0, "source": "Hazaribagh"},
        headers=auth_headers,
    )
    assert mp_resp.status_code == 201
    mp_id = mp_resp.json()["market_price_id"]

    # 3. Create purchase evaluation
    eval_resp = await client.post(
        "/api/v1/evaluations",
        json={
            "evaluation_date": str(date.today()),
            "supplier_id": supp_id,
            "live_weight_kg": 450.0,
            "growth_potential": "good",
            "offered_price": 160000.0,
            "market_price_id": mp_id,
            "decision": "pending",
        },
        headers=auth_headers,
    )
    assert eval_resp.status_code == 201
    eval_data = eval_resp.json()
    eval_id = eval_data["evaluation_id"]
    assert eval_data["is_profitable"] is True

    # 4. Convert evaluation to cow
    conv_resp = await client.post(
        f"/api/v1/evaluations/{eval_id}/convert-to-cow",
        json={
            "tag_number": "BOUGHT-EVAL-01",
            "sex": "male",
            "category": "bull",
            "warehouse_id": wh_id,
        },
        headers=auth_headers,
    )
    assert conv_resp.status_code == 201
    cow_res = conv_resp.json()
    assert cow_res["current_tag_number"] == "BOUGHT-EVAL-01"
    assert cow_res["status"] == "active"
    assert Decimal(cow_res["purchase_price"]) == Decimal("160000.00")


@pytest.mark.asyncio
async def test_dashboard_and_reports_flow(client: AsyncClient):
    auth_headers = {"Authorization": "Bearer dev-user:admin"}

    # 1. Dashboard on empty/fresh database returns valid structured response
    dash_resp = await client.get("/api/v1/reports/dashboard", headers=auth_headers)
    assert dash_resp.status_code == 200
    dash = dash_resp.json()
    assert "total_cows" in dash
    assert "milk_today_liters" in dash
    assert "month_total_expenses" in dash
    assert "alerts" in dash

    # 2. Profitability report returns valid structured response
    today_str = str(date.today())
    prof_resp = await client.get(
        f"/api/v1/reports/profitability?start_date={today_str}&end_date={today_str}",
        headers=auth_headers,
    )
    assert prof_resp.status_code == 200
    prof = prof_resp.json()
    assert "total_invoiced_revenue" in prof
    assert "total_costs" in prof
    assert "accrual_net_profit" in prof
    assert "cash_net_margin" in prof


@pytest.mark.asyncio
async def test_error_handler_cors_and_json(client: AsyncClient):
    # Test unhandled server error returning JSON and CORS headers
    resp = await client.get(
        "/api/v1/herd/cows/not-a-valid-uuid",
        headers={"Origin": "https://giggling-cows.vercel.app"},
    )
    # Validation errors return 422 JSON with CORS headers
    assert resp.status_code == 422
    assert "application/json" in resp.headers.get("content-type", "")
    assert resp.headers.get("access-control-allow-origin") == "https://giggling-cows.vercel.app"


@pytest.mark.asyncio
async def test_cow_profile_details_weights_tags_moves_and_offspring(client: AsyncClient):
    auth_headers = {"Authorization": "Bearer dev-user:admin"}

    wh1 = (
        await client.post(
            "/api/v1/herd/warehouses",
            json={"name": "Profile Shed 1", "housing_type": "tie_stall", "capacity": 20},
            headers=auth_headers,
        )
    ).json()["warehouse_id"]
    wh2 = (
        await client.post(
            "/api/v1/herd/warehouses",
            json={"name": "Profile Shed 2", "housing_type": "pen", "capacity": 10},
            headers=auth_headers,
        )
    ).json()["warehouse_id"]

    dam_resp = await client.post(
        "/api/v1/herd/cows",
        json={
            "current_tag_number": "PROF-DAM-01",
            "sex": "female",
            "category": "dairy",
            "breed": "friesian",
            "acquisition_type": "bought_from_bazar",
            "acquisition_date": "2026-01-10",
            "warehouse_id": wh1,
            "status": "active",
        },
        headers=auth_headers,
    )
    assert dam_resp.status_code == 201
    dam_id = dam_resp.json()["cow_id"]

    # Create offspring linked to dam
    calf_resp = await client.post(
        "/api/v1/herd/cows",
        json={
            "current_tag_number": "PROF-CALF-01",
            "sex": "female",
            "category": "calf",
            "breed": "friesian",
            "birth_date": "2026-05-01",
            "acquisition_type": "born_on_farm",
            "acquisition_date": "2026-05-01",
            "dam_id": dam_id,
            "warehouse_id": wh1,
            "status": "active",
        },
        headers=auth_headers,
    )
    assert calf_resp.status_code == 201
    calf_id = calf_resp.json()["cow_id"]

    # Moving to the same warehouse must return 400
    same_move = await client.post(
        f"/api/v1/herd/cows/{dam_id}/move",
        json={"warehouse_id": wh1, "moved_in_date": "2026-06-01", "reason": "No-op"},
        headers=auth_headers,
    )
    assert same_move.status_code == 400

    # Moving to wh2 succeeds and sorts newest-first
    ok_move = await client.post(
        f"/api/v1/herd/cows/{dam_id}/move",
        json={"warehouse_id": wh2, "moved_in_date": "2026-06-01", "reason": "Isolation"},
        headers=auth_headers,
    )
    assert ok_move.status_code == 200
    assert ok_move.json()["warehouse_id"] == wh2
    assert ok_move.json()["warehouse_history"][0]["warehouse_id"] == wh2
    assert ok_move.json()["warehouse_history"][1]["moved_out_date"] == "2026-06-01"

    # Log two weights, then archive the newer one -> latest_weight_kg must fall back to active weight
    w1 = (
        await client.post(
            f"/api/v1/herd/cows/{dam_id}/weight",
            json={"weigh_date": "2026-05-01", "weight_kg": 440.0},
            headers=auth_headers,
        )
    ).json()
    w2 = (
        await client.post(
            f"/api/v1/herd/cows/{dam_id}/weight",
            json={"weigh_date": "2026-06-01", "weight_kg": 465.0},
            headers=auth_headers,
        )
    ).json()
    assert Decimal(w2["weight_kg"]) == Decimal("465.00")

    arch_w2 = await client.patch(
        f"/api/v1/herd/cows/{dam_id}/weight/{w2['weight_id']}",
        json={"is_archived": True},
        headers=auth_headers,
    )
    assert arch_w2.status_code == 200

    detail_after_archive = (await client.get(f"/api/v1/herd/cows/{dam_id}", headers=auth_headers)).json()
    assert Decimal(detail_after_archive["latest_weight_kg"]) == Decimal("440.00")
    assert detail_after_archive["weight_records"][0]["weight_id"] == w2["weight_id"]
    assert detail_after_archive["offspring"][0]["cow_id"] == calf_id

    # Add secondary RFID tag without changing primary tag
    rfid_resp = await client.post(
        f"/api/v1/herd/cows/{dam_id}/tags",
        json={
            "tag_number": "RFID-9901",
            "tag_type": "rfid",
            "assigned_date": "2026-06-05",
            "reason": "Electronic collar",
            "set_as_current": False,
        },
        headers=auth_headers,
    )
    assert rfid_resp.status_code == 201
    assert rfid_resp.json()["current_tag_number"] == "PROF-DAM-01"

    # Replace primary tag (must reject duplicate active tag, succeed for unique tag)
    dup_tag = await client.post(
        f"/api/v1/herd/cows/{dam_id}/tags",
        json={
            "tag_number": "PROF-CALF-01",
            "tag_type": "ear_tag",
            "assigned_date": "2026-06-10",
            "set_as_current": True,
        },
        headers=auth_headers,
    )
    assert dup_tag.status_code == 400

    new_tag = await client.post(
        f"/api/v1/herd/cows/{dam_id}/tags",
        json={
            "tag_number": "PROF-DAM-02",
            "tag_type": "ear_tag",
            "assigned_date": "2026-06-10",
            "reason": "Replacement ear tag",
            "set_as_current": True,
        },
        headers=auth_headers,
    )
    assert new_tag.status_code == 201
    new_tag_data = new_tag.json()
    assert new_tag_data["current_tag_number"] == "PROF-DAM-02"
    assert len(new_tag_data["id_history"]) == 3
    old_primary = next(t for t in new_tag_data["id_history"] if t["tag_number"] == "PROF-DAM-01")
    assert old_primary["removed_date"] == "2026-06-10"

    # Self-parent guard on PATCH
    self_parent = await client.patch(
        f"/api/v1/herd/cows/{calf_id}",
        json={"dam_id": calf_id},
        headers=auth_headers,
    )
    assert self_parent.status_code == 400


@pytest.mark.asyncio
async def test_qa_audit_p0_p1_invariants(client: AsyncClient):
    auth_headers = {"Authorization": "Bearer dev-user:admin"}
    today = date.today()
    month_start = today.replace(day=1)

    wh_resp = await client.post(
        "/api/v1/herd/warehouses",
        json={"name": "QA Audit Shed", "housing_type": "shed", "capacity": 10},
        headers=auth_headers,
    )
    wh_id = wh_resp.json()["warehouse_id"]

    # 1. Cow date & price invariants (#6)
    bad_dates = await client.post(
        "/api/v1/herd/cows",
        json={
            "current_tag_number": "QA-BAD-DATE",
            "sex": "female",
            "category": "heifer",
            "birth_date": "2025-12-21",
            "acquisition_type": "bought_from_bazar",
            "acquisition_date": "2025-12-12",
            "purchase_price": 50000,
            "warehouse_id": wh_id,
        },
        headers=auth_headers,
    )
    assert bad_dates.status_code == 422

    born_cow_resp = await client.post(
        "/api/v1/herd/cows",
        json={
            "current_tag_number": "QA-208",
            "sex": "female",
            "category": "heifer",
            "birth_date": "2022-12-21",
            "acquisition_type": "born_on_farm",
            "acquisition_date": "2022-12-12",
            "purchase_price": 99999,
            "warehouse_id": wh_id,
        },
        headers=auth_headers,
    )
    assert born_cow_resp.status_code == 201
    born_cow = born_cow_resp.json()
    cow_id = born_cow["cow_id"]
    assert Decimal(born_cow["purchase_price"]) == Decimal("0.00")
    assert born_cow["acquisition_date"] == "2022-12-21"

    # Future weigh_date must be rejected
    future_wt = await client.post(
        f"/api/v1/herd/cows/{cow_id}/weight",
        json={"weigh_date": str(today + timedelta(days=1)), "weight_kg": 400},
        headers=auth_headers,
    )
    assert future_wt.status_code == 422

    # 2. Pregnancy calving alert state machine & sidebar alert domain split (#3, #4)
    preg_resp = await client.post(
        "/api/v1/health/pregnancy",
        json={
            "cow_id": cow_id,
            "report_date": str(today - timedelta(days=30)),
            "status": "suspected",
            "expected_calving_date": str(today - timedelta(days=5)),
        },
        headers=auth_headers,
    )
    assert preg_resp.status_code == 201
    preg_id = preg_resp.json()["pregnancy_id"]

    dash_before = (await client.get("/api/v1/reports/dashboard", headers=auth_headers)).json()
    assert dash_before["breeding_alert_count"] == 1
    assert dash_before["health_alert_count"] == 0

    # Setting actual_calving_date auto-transitions status -> calved and clears alert
    calved_patch = await client.patch(
        f"/api/v1/health/pregnancy/{preg_id}",
        json={"actual_calving_date": str(today - timedelta(days=2))},
        headers=auth_headers,
    )
    assert calved_patch.status_code == 200
    assert calved_patch.json()["status"] == "calved"

    dash_after = (await client.get("/api/v1/reports/dashboard", headers=auth_headers)).json()
    assert dash_after["breeding_alert_count"] == 0
    assert all(a["id"] != preg_id for a in dash_after["alerts"])

    # 3. Discounted invoice revenue & receivables reconciliation (#1)
    cust = (
        await client.post(
            "/api/v1/sales/customers",
            json={"name": "QA Buyer", "customer_type": "wholesaler"},
            headers=auth_headers,
        )
    ).json()
    inv = (
        await client.post(
            "/api/v1/sales/invoices",
            json={
                "customer_id": cust["customer_id"],
                "invoice_date": str(today),
                "discount": 100.0,
                "lines": [
                    {
                        "item_type": "milk",
                        "description": "Bulk milk",
                        "quantity": 1000.0,
                        "unit_price": 120.0,
                    }
                ],
            },
            headers=auth_headers,
        )
    ).json()
    inv_id = inv["invoice_id"]
    await client.patch(
        f"/api/v1/sales/invoices/{inv_id}/status",
        json={"status": "issued"},
        headers=auth_headers,
    )
    await client.post(
        f"/api/v1/sales/invoices/{inv_id}/payments",
        json={"payment_date": str(today), "amount": 119900.0, "payment_method": "cash"},
        headers=auth_headers,
    )

    dash_fin = (await client.get("/api/v1/reports/dashboard", headers=auth_headers)).json()
    prof_fin = (
        await client.get(
            f"/api/v1/reports/profitability?start_date={month_start}&end_date={today}",
            headers=auth_headers,
        )
    ).json()
    assert Decimal(dash_fin["month_invoiced_revenue"]) == Decimal("119900.00")
    assert Decimal(dash_fin["total_unpaid_receivables"]) == Decimal("0.00")
    assert Decimal(prof_fin["total_invoiced_revenue"]) == Decimal("119900.00")
    assert Decimal(prof_fin["cash_collected"]) == Decimal("119900.00")
    assert Decimal(prof_fin["receivables_uncollected"]) == Decimal("0.00")


async def test_cow_detail_read_with_legacy_future_weight(client: AsyncClient, db_session: AsyncSession):
    today = date.today()
    auth_headers = {"X-User-Role": "admin", "X-User-Id": "00000000-0000-0000-0000-000000000001"}

    wh_resp = await client.post(
        "/api/v1/herd/warehouses",
        json={"name": "Legacy Barn", "capacity": 20},
        headers=auth_headers,
    )
    wh_id = wh_resp.json()["warehouse_id"]

    cow_resp = await client.post(
        "/api/v1/herd/cows",
        json={
            "current_tag_number": "LEGACY-999",
            "sex": "female",
            "category": "dairy",
            "acquisition_type": "born_on_farm",
            "acquisition_date": str(today),
            "warehouse_id": wh_id,
        },
        headers=auth_headers,
    )
    assert cow_resp.status_code == 201
    cow_id = cow_resp.json()["cow_id"]

    from app.models.herd import WeightRecord

    future_record = WeightRecord(
        cow_id=uuid.UUID(cow_id),
        weigh_date=today + timedelta(days=5),
        weight_kg=Decimal("450.00"),
        created_by=uuid.UUID("00000000-0000-0000-0000-000000000001"),
    )
    db_session.add(future_record)
    await db_session.commit()

    # Reading cow profile must succeed without ValidationError or 500
    resp = await client.get(f"/api/v1/herd/cows/{cow_id}", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["weight_records"]) == 1
    assert Decimal(data["weight_records"][0]["weight_kg"]) == Decimal("450.00")




