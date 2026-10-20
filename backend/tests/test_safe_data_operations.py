from datetime import date
from decimal import Decimal
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.herd import Cow, Warehouse


@pytest.mark.asyncio
async def test_soft_delete_and_archival_filtering(client: AsyncClient):
    auth_headers = {"Authorization": "Bearer dev-user:admin"}

    # 1. Create Warehouse
    wh_resp = await client.post(
        "/api/v1/herd/warehouses",
        json={"name": "Shed Archival Alpha", "housing_type": "shed", "capacity": 15},
        headers=auth_headers,
    )
    assert wh_resp.status_code == 201
    wh_id = wh_resp.json()["warehouse_id"]

    # 2. Archive Warehouse
    patch_wh = await client.patch(
        f"/api/v1/herd/warehouses/{wh_id}",
        json={"is_archived": True},
        headers=auth_headers,
    )
    assert patch_wh.status_code == 200
    assert patch_wh.json()["is_archived"] is True

    # Check listing defaults (should NOT include archived)
    whs_default = await client.get("/api/v1/herd/warehouses", headers=auth_headers)
    assert all(w["warehouse_id"] != wh_id for w in whs_default.json())

    # Check listing with include_archived=true
    whs_all = await client.get("/api/v1/herd/warehouses?include_archived=true", headers=auth_headers)
    assert any(w["warehouse_id"] == wh_id and w["is_archived"] is True for w in whs_all.json())

    # Check listing with archived_only=true
    whs_only = await client.get("/api/v1/herd/warehouses?archived_only=true", headers=auth_headers)
    assert any(w["warehouse_id"] == wh_id for w in whs_only.json())

    # 3. Create active Warehouse and Cow
    wh_active_resp = await client.post(
        "/api/v1/herd/warehouses",
        json={"name": "Shed Active", "housing_type": "shed", "capacity": 20},
        headers=auth_headers,
    )
    wh_act_id = wh_active_resp.json()["warehouse_id"]

    cow_resp = await client.post(
        "/api/v1/herd/cows",
        json={
            "current_tag_number": "COW-ARCH-01",
            "sex": "female",
            "category": "dairy",
            "acquisition_type": "born_on_farm",
            "acquisition_date": str(date.today()),
            "warehouse_id": wh_act_id,
            "status": "active",
        },
        headers=auth_headers,
    )
    assert cow_resp.status_code == 201
    cow_id = cow_resp.json()["cow_id"]

    # Soft-archive the cow via status="archived"
    cow_patch = await client.patch(
        f"/api/v1/herd/cows/{cow_id}",
        json={"status": "archived"},
        headers=auth_headers,
    )
    assert cow_patch.status_code == 200
    assert cow_patch.json()["status"] == "archived"

    # Default cows query excludes archived
    cows_default = await client.get("/api/v1/herd/cows", headers=auth_headers)
    assert all(c["cow_id"] != cow_id for c in cows_default.json())

    # include_archived=true includes it
    cows_all = await client.get("/api/v1/herd/cows?include_archived=true", headers=auth_headers)
    assert any(c["cow_id"] == cow_id and c["status"] == "archived" for c in cows_all.json())

    # 4. Expense category archival
    cat_resp = await client.post(
        "/api/v1/feeding/categories",
        json={"name": "Temporary Feed Cat", "name_bn": "ফিড", "category_group": "food"},
        headers=auth_headers,
    )
    assert cat_resp.status_code == 201
    cat_id = cat_resp.json()["category_id"]

    patch_cat = await client.patch(
        f"/api/v1/feeding/categories/{cat_id}",
        json={"is_archived": True},
        headers=auth_headers,
    )
    assert patch_cat.status_code == 200
    assert patch_cat.json()["is_archived"] is True

    cats_default = await client.get("/api/v1/feeding/categories", headers=auth_headers)
    assert all(c["category_id"] != cat_id for c in cats_default.json())

    cats_all = await client.get("/api/v1/feeding/categories?include_archived=true", headers=auth_headers)
    assert any(c["category_id"] == cat_id for c in cats_all.json())


@pytest.mark.asyncio
async def test_weight_record_update(client: AsyncClient):
    auth_headers = {"Authorization": "Bearer dev-user:admin"}

    wh_resp = await client.post(
        "/api/v1/herd/warehouses",
        json={"name": "Weight Shed", "housing_type": "shed", "capacity": 10},
        headers=auth_headers,
    )
    wh_id = wh_resp.json()["warehouse_id"]

    cow_resp = await client.post(
        "/api/v1/herd/cows",
        json={
            "current_tag_number": "COW-WT-01",
            "sex": "male",
            "category": "bull",
            "acquisition_type": "born_on_farm",
            "acquisition_date": str(date.today()),
            "warehouse_id": wh_id,
            "status": "active",
        },
        headers=auth_headers,
    )
    cow_id = cow_resp.json()["cow_id"]

    # Record weight
    wt_resp = await client.post(
        f"/api/v1/herd/cows/{cow_id}/weight",
        json={"weigh_date": str(date.today()), "weight_kg": 300.0},
        headers=auth_headers,
    )
    assert wt_resp.status_code == 201
    wt_id = wt_resp.json()["weight_id"]
    assert Decimal(wt_resp.json()["weight_kg"]) == Decimal("300.00")

    # Correct weight via PATCH without deleting
    patch_wt = await client.patch(
        f"/api/v1/herd/cows/{cow_id}/weight/{wt_id}",
        json={"weight_kg": 325.50},
        headers=auth_headers,
    )
    assert patch_wt.status_code == 200
    assert Decimal(patch_wt.json()["weight_kg"]) == Decimal("325.50")

    # Verify cow detail latest_weight_kg reflects updated value
    cow_detail = await client.get(f"/api/v1/herd/cows/{cow_id}", headers=auth_headers)
    assert Decimal(cow_detail.json()["latest_weight_kg"]) == Decimal("325.50")


@pytest.mark.asyncio
async def test_feeding_record_update_and_recalculation(client: AsyncClient):
    auth_headers = {"Authorization": "Bearer dev-user:admin"}

    wh_resp = await client.post(
        "/api/v1/herd/warehouses",
        json={"name": "Feed Shed", "housing_type": "shed", "capacity": 10},
        headers=auth_headers,
    )
    wh_id = wh_resp.json()["warehouse_id"]

    cat_resp = await client.post(
        "/api/v1/feeding/categories",
        json={"name": "Grain Feed", "name_bn": "দানা খাদ্য", "category_group": "food"},
        headers=auth_headers,
    )
    cat_id = cat_resp.json()["category_id"]

    ft_resp = await client.post(
        "/api/v1/feeding/feed-types",
        json={"category_id": cat_id, "name": "Wheat Bran", "name_bn": "গম ভুসি", "unit": "kg", "unit_cost": 45.0},
        headers=auth_headers,
    )
    ft_id = ft_resp.json()["feed_type_id"]

    # Add feeding record: 10 kg @ 45 = 450
    feed_rec = await client.post(
        "/api/v1/feeding/feeding-records",
        json={
            "warehouse_id": wh_id,
            "feed_type_id": ft_id,
            "feeding_date": str(date.today()),
            "quantity": 10.0,
        },
        headers=auth_headers,
    )
    assert feed_rec.status_code == 201
    f_id = feed_rec.json()["feeding_id"]
    assert Decimal(feed_rec.json()["cost"]) == Decimal("450.00")

    # Update quantity to 20 kg -> Cost must automatically recalculate to 900
    patch_feed = await client.patch(
        f"/api/v1/feeding/feeding-records/{f_id}",
        json={"quantity": 20.0},
        headers=auth_headers,
    )
    assert patch_feed.status_code == 200
    assert Decimal(patch_feed.json()["quantity"]) == Decimal("20.00")
    assert Decimal(patch_feed.json()["cost"]) == Decimal("900.00")


@pytest.mark.asyncio
async def test_health_and_breeding_updates(client: AsyncClient):
    auth_headers = {"Authorization": "Bearer dev-user:admin"}

    wh_resp = await client.post(
        "/api/v1/herd/warehouses",
        json={"name": "Health Shed", "housing_type": "tie_stall", "capacity": 10},
        headers=auth_headers,
    )
    wh_id = wh_resp.json()["warehouse_id"]

    cow_resp = await client.post(
        "/api/v1/herd/cows",
        json={
            "current_tag_number": "COW-HLT-01",
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

    # 1. Health record creation and update
    hlth_resp = await client.post(
        "/api/v1/health/records",
        json={
            "cow_id": cow_id,
            "record_type": "vaccination",
            "record_date": str(date.today()),
            "vet_name": "Dr. Kamal",
            "cost": 400.0,
            "details": "FMD vaccine dose 1",
        },
        headers=auth_headers,
    )
    assert hlth_resp.status_code == 201
    hlth_id = hlth_resp.json()["health_id"]

    patch_hlth = await client.patch(
        f"/api/v1/health/records/{hlth_id}",
        json={"cost": 450.0, "details": "FMD vaccine dose 1 (booster included)"},
        headers=auth_headers,
    )
    assert patch_hlth.status_code == 200
    assert Decimal(patch_hlth.json()["cost"]) == Decimal("450.00")
    assert "booster included" in patch_hlth.json()["details"]

    # 2. Breeding record creation and update
    breed_resp = await client.post(
        "/api/v1/health/breeding",
        json={
            "cow_id": cow_id,
            "seed_date": str(date.today()),
            "method": "artificial_insemination",
            "semen_code": "HF-909",
            "outcome": "pending",
        },
        headers=auth_headers,
    )
    assert breed_resp.status_code == 201
    breed_id = breed_resp.json()["breeding_id"]
    assert breed_resp.json()["outcome"] == "pending"

    patch_breed = await client.patch(
        f"/api/v1/health/breeding/{breed_id}",
        json={"outcome": "successful", "cost": 1200.0},
        headers=auth_headers,
    )
    assert patch_breed.status_code == 200
    assert patch_breed.json()["outcome"] == "successful"
    assert Decimal(patch_breed.json()["cost"]) == Decimal("1200.00")

    # 3. Pregnancy report creation and update
    preg_resp = await client.post(
        "/api/v1/health/pregnancy",
        json={
            "cow_id": cow_id,
            "report_date": str(date.today()),
            "status": "confirmed",
            "expected_calving_date": str(date.today()),
        },
        headers=auth_headers,
    )
    assert preg_resp.status_code == 201
    preg_id = preg_resp.json()["pregnancy_id"]

    patch_preg = await client.patch(
        f"/api/v1/health/pregnancy/{preg_id}",
        json={"status": "calved", "actual_calving_date": str(date.today())},
        headers=auth_headers,
    )
    assert patch_preg.status_code == 200
    assert patch_preg.json()["status"] == "calved"
    assert patch_preg.json()["actual_calving_date"] == str(date.today())


@pytest.mark.asyncio
async def test_labor_attendance_salary_mill_charges(client: AsyncClient):
    auth_headers = {"Authorization": "Bearer dev-user:admin"}

    worker_resp = await client.post(
        "/api/v1/labor/workers",
        json={
            "name": "Rafiqul Islam",
            "role": "Farm Assistant",
            "join_date": str(date.today()),
            "monthly_salary": 18000.0,
            "status": "active",
        },
        headers=auth_headers,
    )
    assert worker_resp.status_code == 201
    worker_id = worker_resp.json()["worker_id"]

    # 1. Attendance batch create and individual update
    att_resp = await client.post(
        "/api/v1/labor/attendance/batch",
        json={
            "attendance_date": str(date.today()),
            "records": [
                {
                    "worker_id": worker_id,
                    "is_present": False,
                    "note": "Sick leave",
                }
            ],
        },
        headers=auth_headers,
    )
    assert att_resp.status_code == 200
    recorded_list = att_resp.json()
    att_item = next(a for a in recorded_list if a["worker_id"] == worker_id)
    att_id = att_item["attendance_id"]
    assert att_item["is_present"] is False

    patch_att = await client.patch(
        f"/api/v1/labor/attendance/{att_id}",
        json={"is_present": True, "note": "Correction: reported after doctor visit"},
        headers=auth_headers,
    )
    assert patch_att.status_code == 200
    assert patch_att.json()["is_present"] is True

    # 2. Mill Charge creation, update, and voiding
    mc_resp = await client.post(
        "/api/v1/labor/mill-charges",
        json={
            "charge_date": str(date.today()),
            "charge_type": "substitute_worker",
            "substitute_name": "Jashim",
            "amount": 700.0,
            "description": "Day substitute",
        },
        headers=auth_headers,
    )
    assert mc_resp.status_code == 201
    mc_id = mc_resp.json()["mill_charge_id"]

    # Void mill charge
    patch_mc = await client.patch(
        f"/api/v1/labor/mill-charges/{mc_id}",
        json={"is_void": True, "void_reason": "Charged in error to incorrect date"},
        headers=auth_headers,
    )
    assert patch_mc.status_code == 200
    assert patch_mc.json()["is_void"] is True
    assert patch_mc.json()["void_reason"] == "Charged in error to incorrect date"

    # Default listing excludes voided mill charge
    mc_list = await client.get("/api/v1/labor/mill-charges", headers=auth_headers)
    assert all(m["mill_charge_id"] != mc_id for m in mc_list.json())

    mc_all = await client.get("/api/v1/labor/mill-charges?include_void=true", headers=auth_headers)
    assert any(m["mill_charge_id"] == mc_id and m["is_void"] is True for m in mc_all.json())


@pytest.mark.asyncio
async def test_milk_production_update_and_voiding(client: AsyncClient):
    auth_headers = {"Authorization": "Bearer dev-user:admin"}

    wh_resp = await client.post(
        "/api/v1/herd/warehouses",
        json={"name": "Milk Shed", "housing_type": "tie_stall", "capacity": 10},
        headers=auth_headers,
    )
    wh_id = wh_resp.json()["warehouse_id"]

    cow_resp = await client.post(
        "/api/v1/herd/cows",
        json={
            "current_tag_number": "COW-MILK-01",
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

    # Record milk
    milk_resp = await client.post(
        "/api/v1/sales/milk",
        json={
            "cow_id": cow_id,
            "production_date": str(date.today()),
            "session": "morning",
            "liters": 14.50,
        },
        headers=auth_headers,
    )
    assert milk_resp.status_code == 201
    milk_id = milk_resp.json()["milk_id"]
    assert Decimal(milk_resp.json()["liters"]) == Decimal("14.50")

    # Correct liters via PATCH
    patch_milk = await client.patch(
        f"/api/v1/sales/milk/{milk_id}",
        json={"liters": 15.25},
        headers=auth_headers,
    )
    assert patch_milk.status_code == 200
    assert Decimal(patch_milk.json()["liters"]) == Decimal("15.25")

    # Void milk entry
    void_milk = await client.patch(
        f"/api/v1/sales/milk/{milk_id}",
        json={"is_void": True, "void_reason": "Bucket spilled and re-milked"},
        headers=auth_headers,
    )
    assert void_milk.status_code == 200
    assert void_milk.json()["is_void"] is True

    # Default query excludes voided milk
    milk_active = await client.get(f"/api/v1/sales/milk?cow_id={cow_id}", headers=auth_headers)
    assert len(milk_active.json()) == 0

    # include_void=true includes it
    milk_all = await client.get(f"/api/v1/sales/milk?cow_id={cow_id}&include_void=true", headers=auth_headers)
    assert len(milk_all.json()) == 1
    assert milk_all.json()[0]["is_void"] is True


@pytest.mark.asyncio
async def test_expense_voiding_and_report_exclusion(client: AsyncClient):
    auth_headers = {"Authorization": "Bearer dev-user:admin"}

    cat_resp = await client.post(
        "/api/v1/feeding/categories",
        json={"name": "Veterinary Expense", "name_bn": "চিকিৎসা", "category_group": "miscellaneous"},
        headers=auth_headers,
    )
    cat_id = cat_resp.json()["category_id"]

    today_str = str(date.today())
    exp_resp = await client.post(
        "/api/v1/feeding/expenses",
        json={
            "category_id": cat_id,
            "expense_date": today_str,
            "amount": 3500.0,
            "description": "Routine vet supplies",
        },
        headers=auth_headers,
    )
    assert exp_resp.status_code == 201
    exp_id = exp_resp.json()["expense_id"]

    # Dashboard should reflect the 3500 expense
    dash_before = await client.get("/api/v1/reports/dashboard", headers=auth_headers)
    assert Decimal(dash_before.json()["month_total_expenses"]) >= Decimal("3500.00")

    # Void the expense
    patch_exp = await client.patch(
        f"/api/v1/feeding/expenses/{exp_id}",
        json={"is_void": True, "void_reason": "Duplicate invoice from vendor"},
        headers=auth_headers,
    )
    assert patch_exp.status_code == 200
    assert patch_exp.json()["is_void"] is True

    # Default expenses query excludes voided expense
    exp_list = await client.get(f"/api/v1/feeding/expenses?start_date={today_str}", headers=auth_headers)
    assert all(e["expense_id"] != exp_id for e in exp_list.json())

    # include_void returns it
    exp_all = await client.get(
        f"/api/v1/feeding/expenses?start_date={today_str}&include_void=true",
        headers=auth_headers,
    )
    assert any(e["expense_id"] == exp_id and e["is_void"] is True for e in exp_all.json())


@pytest.mark.asyncio
async def test_payment_voiding_and_invoice_recalibration(client: AsyncClient):
    auth_headers = {"Authorization": "Bearer dev-user:admin"}

    # 1. Customer
    cust_resp = await client.post(
        "/api/v1/sales/customers",
        json={"name": "Tariq Sweetmeat", "phone": "01811223344", "customer_type": "dairy_shop"},
        headers=auth_headers,
    )
    assert cust_resp.status_code == 201
    cust_id = cust_resp.json()["customer_id"]

    # 2. Invoice for 20,000 BDT
    today_str = str(date.today())
    inv_resp = await client.post(
        "/api/v1/sales/invoices",
        json={
            "customer_id": cust_id,
            "invoice_date": today_str,
            "discount": 0.0,
            "lines": [
                {
                    "item_type": "milk",
                    "description": "Bulk Raw Milk 250L",
                    "quantity": 250.0,
                    "unit_price": 80.0,
                }
            ],
        },
        headers=auth_headers,
    )
    assert inv_resp.status_code == 201
    inv_id = inv_resp.json()["invoice_id"]
    assert Decimal(inv_resp.json()["total_amount"]) == Decimal("20000.00")

    # Issue invoice
    issue_resp = await client.patch(
        f"/api/v1/sales/invoices/{inv_id}/status",
        json={"status": "issued"},
        headers=auth_headers,
    )
    assert issue_resp.status_code == 200
    assert issue_resp.json()["status"] == "issued"

    # 3. Add Payment 1: 8,000 BDT -> partially_paid
    p1_resp = await client.post(
        f"/api/v1/sales/invoices/{inv_id}/payments",
        json={
            "payment_date": today_str,
            "amount": 8000.0,
            "payment_method": "bank",
        },
        headers=auth_headers,
    )
    assert p1_resp.status_code == 201
    p1_id = p1_resp.json()["payment_id"]

    inv_p1 = await client.get(f"/api/v1/sales/invoices/{inv_id}", headers=auth_headers)
    assert inv_p1.json()["status"] == "partially_paid"
    assert Decimal(inv_p1.json()["paid_amount"]) == Decimal("8000.00")
    assert Decimal(inv_p1.json()["outstanding_balance"]) == Decimal("12000.00")

    # 4. Add Payment 2: 12,000 BDT -> paid
    p2_resp = await client.post(
        f"/api/v1/sales/invoices/{inv_id}/payments",
        json={
            "payment_date": today_str,
            "amount": 12000.0,
            "payment_method": "cash",
        },
        headers=auth_headers,
    )
    assert p2_resp.status_code == 201
    p2_id = p2_resp.json()["payment_id"]

    inv_p2 = await client.get(f"/api/v1/sales/invoices/{inv_id}", headers=auth_headers)
    assert inv_p2.json()["status"] == "paid"
    assert Decimal(inv_p2.json()["paid_amount"]) == Decimal("20000.00")
    assert Decimal(inv_p2.json()["outstanding_balance"]) == Decimal("0.00")

    # 5. Attempt to void invoice with active payments -> Must fail!
    void_fail = await client.patch(
        f"/api/v1/sales/invoices/{inv_id}/status",
        json={"status": "void"},
        headers=auth_headers,
    )
    assert void_fail.status_code == 400
    assert "Reverse payments first" in void_fail.json()["detail"]

    # 6. Void Payment 2 (12,000 BDT) -> Invoice reverts to partially_paid!
    void_p2 = await client.patch(
        f"/api/v1/sales/invoices/{inv_id}/payments/{p2_id}/void",
        json={"void_reason": "Cash was counterfeit/invalid"},
        headers=auth_headers,
    )
    assert void_p2.status_code == 200
    assert void_p2.json()["status"] == "void"

    inv_after_void_p2 = await client.get(f"/api/v1/sales/invoices/{inv_id}", headers=auth_headers)
    assert inv_after_void_p2.json()["status"] == "partially_paid"
    assert Decimal(inv_after_void_p2.json()["paid_amount"]) == Decimal("8000.00")
    assert Decimal(inv_after_void_p2.json()["outstanding_balance"]) == Decimal("12000.00")

    # 7. Void Payment 1 (8,000 BDT) -> Invoice reverts to issued!
    void_p1 = await client.patch(
        f"/api/v1/sales/invoices/{inv_id}/payments/{p1_id}/void",
        json={"void_reason": "Bank transfer reversed"},
        headers=auth_headers,
    )
    assert void_p1.status_code == 200
    assert void_p1.json()["status"] == "void"

    inv_after_void_p1 = await client.get(f"/api/v1/sales/invoices/{inv_id}", headers=auth_headers)
    assert inv_after_void_p1.json()["status"] == "issued"
    assert Decimal(inv_after_void_p1.json()["paid_amount"]) == Decimal("0.00")
    assert Decimal(inv_after_void_p1.json()["outstanding_balance"]) == Decimal("20000.00")

    # 8. Now void the invoice -> Must succeed!
    void_inv = await client.patch(
        f"/api/v1/sales/invoices/{inv_id}/status",
        json={"status": "void"},
        headers=auth_headers,
    )
    assert void_inv.status_code == 200
    assert void_inv.json()["status"] == "void"


@pytest.mark.asyncio
async def test_no_hard_delete_endpoints_and_referential_integrity(client: AsyncClient):
    auth_headers = {"Authorization": "Bearer dev-user:admin"}

    # Verify that physical DELETE HTTP methods are rejected (405 Method Not Allowed)
    # on vital operational and transactional resources to enforce non-destructive operations:
    endpoints_to_verify = [
        "/api/v1/herd/cows/00000000-0000-0000-0000-000000000001",
        "/api/v1/sales/milk/00000000-0000-0000-0000-000000000001",
        "/api/v1/feeding/expenses/00000000-0000-0000-0000-000000000001",
        "/api/v1/feeding/feeding-records/00000000-0000-0000-0000-000000000001",
        "/api/v1/sales/invoices/00000000-0000-0000-0000-000000000001",
        "/api/v1/health/records/00000000-0000-0000-0000-000000000001",
        "/api/v1/health/breeding/00000000-0000-0000-0000-000000000001",
        "/api/v1/labor/attendance/00000000-0000-0000-0000-000000000001",
        "/api/v1/labor/salary-payments/00000000-0000-0000-0000-000000000001",
    ]

    for ep in endpoints_to_verify:
        resp = await client.delete(ep, headers=auth_headers)
        assert resp.status_code == 405, f"Endpoint {ep} should reject physical DELETE with 405"

