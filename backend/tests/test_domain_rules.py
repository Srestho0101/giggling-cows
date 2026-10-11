from datetime import date
from decimal import Decimal
import pytest
from httpx import AsyncClient

from app.core.config import Settings
from app.services.evaluation_service import calculate_evaluation_metrics


def test_supabase_pooler_url_configuration():
    settings = Settings(
        DATABASE_URL="postgresql://postgres:secret@aws-0-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true"
    )

    assert settings.async_database_url.endswith("postgres?pgbouncer=true&sslmode=require")
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

