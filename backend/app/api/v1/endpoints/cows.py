from datetime import date
from decimal import Decimal
from typing import List, Optional
import uuid
from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload, selectinload

from app.core.database import get_db
from app.core.security import AuthUser, UserRole, get_current_user, require_roles
from app.models.herd import Cow, CowWarehouseHistory, Supplier, Warehouse, WeightRecord
from app.models.sales import Customer, SalesInvoice, SalesInvoiceLine
from app.schemas.herd import (
    CowCreate,
    CowDetailRead,
    CowOffspringRead,
    CowRead,
    CowSaleRecordRead,
    CowUpdate,
    CowWarehouseHistoryCreate,
    CowWarehouseHistoryRead,
    SupplierCreate,
    SupplierRead,
    SupplierUpdate,
    WarehouseCreate,
    WarehouseRead,
    WarehouseUpdate,
    WeightRecordCreate,
    WeightRecordRead,
    WeightRecordUpdate,
)
from app.services.safe_data_operations import capture_lifecycle_state, record_lifecycle_changes
from app.services.storage_service import (
    delete_cow_profile_picture as delete_profile_picture_from_storage,
    upload_cow_profile_picture as upload_profile_picture_to_storage,
)

router = APIRouter()

ALLOWED_IMAGE_TYPES = {
    "image/jpeg": ".jpg",
    "image/jpg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
}
MAX_PROFILE_IMAGE_BYTES = 5 * 1024 * 1024


# ---------------------- WAREHOUSES ----------------------
@router.get("/warehouses", response_model=List[WarehouseRead])
async def list_warehouses(
    include_archived: bool = False,
    archived_only: bool = False,
    db: AsyncSession = Depends(get_db),
    current_user: AuthUser = Depends(get_current_user),
):
    occ_sub = (
        select(Cow.warehouse_id, func.count().label("occupancy"))
        .where(Cow.status == "active", Cow.is_archived == False)
        .group_by(Cow.warehouse_id)
        .subquery()
    )
    stmt = (
        select(Warehouse, func.coalesce(occ_sub.c.occupancy, 0).label("occupancy"))
        .outerjoin(occ_sub, Warehouse.warehouse_id == occ_sub.c.warehouse_id)
    )
    if archived_only:
        stmt = stmt.where(Warehouse.is_archived == True)
    elif not include_archived:
        stmt = stmt.where(Warehouse.is_archived == False)
    rows = (await db.execute(stmt)).all()

    res = []
    for w, occupancy in rows:
        w_read = WarehouseRead.model_validate(w)
        w_read.current_occupancy = occupancy
        res.append(w_read)
    return res


@router.post("/warehouses", response_model=WarehouseRead, status_code=status.HTTP_201_CREATED)
async def create_warehouse(
    data: WarehouseCreate,
    db: AsyncSession = Depends(get_db),
    current_user: AuthUser = Depends(require_roles([UserRole.ADMIN, UserRole.MANAGER])),
):
    warehouse = Warehouse(
        name=data.name,
        housing_type=data.housing_type,
        capacity=data.capacity,
        created_by=current_user.id,
        updated_by=current_user.id,
    )
    db.add(warehouse)
    await db.commit()
    await db.refresh(warehouse)
    w_read = WarehouseRead.model_validate(warehouse)
    w_read.current_occupancy = 0
    return w_read


@router.patch("/warehouses/{warehouse_id}", response_model=WarehouseRead)
async def update_warehouse(
    warehouse_id: uuid.UUID,
    data: WarehouseUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: AuthUser = Depends(require_roles([UserRole.ADMIN, UserRole.MANAGER])),
):
    warehouse = await db.get(Warehouse, warehouse_id)
    if not warehouse:
        raise HTTPException(status_code=404, detail="Warehouse not found")

    lifecycle_before = capture_lifecycle_state(warehouse)
    update_dict = data.model_dump(exclude_unset=True)
    for field, val in update_dict.items():
        setattr(warehouse, field, val)
    record_lifecycle_changes(db, warehouse, lifecycle_before, current_user.id, current_user.email)
    warehouse.updated_by = current_user.id

    await db.commit()
    await db.refresh(warehouse)
    w_read = WarehouseRead.model_validate(warehouse)
    return w_read


# ---------------------- SUPPLIERS ----------------------
@router.get("/suppliers", response_model=List[SupplierRead])
async def list_suppliers(
    include_archived: bool = False,
    archived_only: bool = False,
    db: AsyncSession = Depends(get_db),
    current_user: AuthUser = Depends(get_current_user),
):
    stmt = select(Supplier)
    if archived_only:
        stmt = stmt.where(Supplier.is_archived == True)
    elif not include_archived:
        stmt = stmt.where(Supplier.is_archived == False)
    suppliers = (await db.execute(stmt)).scalars().all()
    return suppliers


@router.post("/suppliers", response_model=SupplierRead, status_code=status.HTTP_201_CREATED)
async def create_supplier(
    data: SupplierCreate,
    db: AsyncSession = Depends(get_db),
    current_user: AuthUser = Depends(require_roles([UserRole.ADMIN, UserRole.MANAGER, UserRole.DATA_ENTRY])),
):
    supplier = Supplier(
        name=data.name,
        phone=data.phone,
        supplier_type=data.supplier_type,
        created_by=current_user.id,
        updated_by=current_user.id,
    )
    db.add(supplier)
    await db.commit()
    await db.refresh(supplier)
    return supplier


@router.patch("/suppliers/{supplier_id}", response_model=SupplierRead)
async def update_supplier(
    supplier_id: uuid.UUID,
    data: SupplierUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: AuthUser = Depends(require_roles([UserRole.ADMIN, UserRole.MANAGER])),
):
    supplier = await db.get(Supplier, supplier_id)
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")

    lifecycle_before = capture_lifecycle_state(supplier)
    update_dict = data.model_dump(exclude_unset=True)
    for field, val in update_dict.items():
        setattr(supplier, field, val)
    record_lifecycle_changes(db, supplier, lifecycle_before, current_user.id, current_user.email)
    supplier.updated_by = current_user.id

    await db.commit()
    await db.refresh(supplier)
    return supplier


# ---------------------- COWS ----------------------
@router.get("/cows", response_model=List[CowRead])
async def list_cows(
    warehouse_id: Optional[uuid.UUID] = None,
    status: Optional[str] = None,
    category: Optional[str] = None,
    sex: Optional[str] = None,
    search: Optional[str] = None,
    include_archived: bool = False,
    archived_only: bool = False,
    db: AsyncSession = Depends(get_db),
    current_user: AuthUser = Depends(get_current_user),
):
    latest_weight = (
        select(WeightRecord.weight_kg)
        .where(WeightRecord.cow_id == Cow.cow_id, WeightRecord.is_archived == False)
        .order_by(WeightRecord.weigh_date.desc(), WeightRecord.created_at.desc())
        .limit(1)
        .correlate(Cow)
        .scalar_subquery()
    )
    stmt = (
        select(Cow, latest_weight.label("latest_weight"))
        .options(
            joinedload(Cow.warehouse),
            joinedload(Cow.supplier),
            joinedload(Cow.dam),
            joinedload(Cow.sire),
        )
    )

    if archived_only:
        stmt = stmt.where(Cow.is_archived == True)
    elif not include_archived:
        stmt = stmt.where(Cow.is_archived == False)

    if warehouse_id:
        stmt = stmt.where(Cow.warehouse_id == warehouse_id)
    if status:
        stmt = stmt.where(Cow.status == status)
    if category:
        stmt = stmt.where(Cow.category == category)
    if sex:
        stmt = stmt.where(Cow.sex == sex)
    if search:
        pattern = f"%{search}%"
        stmt = stmt.outerjoin(Warehouse, Cow.warehouse_id == Warehouse.warehouse_id).where(
            or_(
                Cow.current_tag_number.ilike(pattern),
                Cow.category.ilike(pattern),
                Cow.cow_type.ilike(pattern),
                Cow.breed.ilike(pattern),
                Cow.color.ilike(pattern),
                Cow.marking.ilike(pattern),
                Cow.buyer_name.ilike(pattern),
                Cow.notes.ilike(pattern),
                Warehouse.name.ilike(pattern),
            )
        )

    stmt = stmt.order_by(Cow.created_at.desc())
    rows = (await db.execute(stmt)).unique().all()

    results = []
    for c, weight in rows:
        read_obj = CowRead.model_validate(c)
        read_obj.warehouse_name = c.warehouse.name if c.warehouse else None
        read_obj.supplier_name = c.supplier.name if c.supplier else None
        read_obj.dam_tag = c.dam.current_tag_number if c.dam else None
        read_obj.sire_tag = c.sire.current_tag_number if c.sire else None
        read_obj.latest_weight_kg = weight
        results.append(read_obj)

    return results


@router.get("/cows/{cow_id}", response_model=CowDetailRead)
async def get_cow_detail(
    cow_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: AuthUser = Depends(get_current_user),
):
    stmt = (
        select(Cow)
        .options(
            selectinload(Cow.warehouse),
            selectinload(Cow.supplier),
            selectinload(Cow.dam),
            selectinload(Cow.sire),
            selectinload(Cow.warehouse_history).selectinload(CowWarehouseHistory.warehouse),
            selectinload(Cow.weight_records),
        )
        .where(Cow.cow_id == cow_id)
    )
    cow = (await db.execute(stmt)).scalar_one_or_none()
    if not cow:
        raise HTTPException(status_code=404, detail="Cow not found")

    detail = CowDetailRead.model_validate(cow)
    detail.warehouse_name = cow.warehouse.name if cow.warehouse else None
    detail.supplier_name = cow.supplier.name if cow.supplier else None
    detail.dam_tag = cow.dam.current_tag_number if cow.dam else None
    detail.sire_tag = cow.sire.current_tag_number if cow.sire else None

    active_weights = [w for w in cow.weight_records if not w.is_archived]
    if active_weights:
        latest_w = max(active_weights, key=lambda w: (w.weigh_date, w.created_at))
        detail.latest_weight_kg = latest_w.weight_kg
    else:
        detail.latest_weight_kg = None

    sorted_weights = sorted(cow.weight_records, key=lambda w: (w.weigh_date, w.created_at), reverse=True)
    detail.weight_records = [WeightRecordRead.model_validate(w) for w in sorted_weights]

    sorted_warehouse_history = sorted(
        cow.warehouse_history,
        key=lambda m: (m.moved_in_date, m.created_at),
        reverse=True,
    )
    detail.warehouse_history = [
        CowWarehouseHistoryRead(
            movement_id=m.movement_id,
            cow_id=m.cow_id,
            warehouse_id=m.warehouse_id,
            warehouse_name=m.warehouse.name if m.warehouse else None,
            moved_in_date=m.moved_in_date,
            moved_out_date=m.moved_out_date,
            reason=m.reason,
            created_at=m.created_at,
            updated_at=m.updated_at,
            created_by=m.created_by,
            updated_by=m.updated_by,
        )
        for m in sorted_warehouse_history
    ]

    offspring_stmt = (
        select(Cow)
        .where(
            Cow.is_archived == False,
            or_(Cow.dam_id == cow_id, Cow.sire_id == cow_id),
        )
        .order_by(Cow.birth_date.desc(), Cow.acquisition_date.desc())
    )
    offspring_rows = (await db.execute(offspring_stmt)).scalars().all()
    detail.offspring = [CowOffspringRead.model_validate(child) for child in offspring_rows]

    sale_stmt = (
        select(SalesInvoiceLine, SalesInvoice, Customer)
        .join(SalesInvoice, SalesInvoiceLine.invoice_id == SalesInvoice.invoice_id)
        .join(Customer, SalesInvoice.customer_id == Customer.customer_id)
        .where(
            SalesInvoiceLine.cow_id == cow_id,
            SalesInvoiceLine.item_type == "animal",
            SalesInvoice.status != "void",
        )
        .order_by(SalesInvoice.invoice_date.desc(), SalesInvoice.created_at.desc())
        .limit(1)
    )
    sale_row = (await db.execute(sale_stmt)).first()
    if sale_row:
        line, invoice, customer = sale_row
        detail.sale_record = CowSaleRecordRead(
            sale_date=cow.sold_date or invoice.invoice_date,
            sale_price=cow.sale_price if cow.sale_price is not None else line.line_total,
            buyer_name=cow.buyer_name or customer.name,
            buyer_phone=cow.buyer_phone or customer.phone,
            buyer_address=cow.buyer_address,
            buyer_type=customer.customer_type,
            customer_id=customer.customer_id,
            invoice_id=invoice.invoice_id,
            invoice_number=invoice.invoice_number,
            invoice_status=invoice.status,
            paid_amount=invoice.paid_amount,
            outstanding_balance=max(Decimal("0.00"), invoice.total_amount - invoice.paid_amount),
            notes=cow.sale_notes or invoice.notes or line.description,
        )
    elif cow.status == "sold" or any(
        [cow.sold_date, cow.sale_price is not None, cow.buyer_name, cow.buyer_phone, cow.buyer_address, cow.sale_notes]
    ):
        detail.sale_record = CowSaleRecordRead(
            sale_date=cow.sold_date,
            sale_price=cow.sale_price,
            buyer_name=cow.buyer_name,
            buyer_phone=cow.buyer_phone,
            buyer_address=cow.buyer_address,
            notes=cow.sale_notes,
        )

    return detail


@router.post("/cows", response_model=CowDetailRead, status_code=status.HTTP_201_CREATED)
async def create_cow(
    data: CowCreate,
    db: AsyncSession = Depends(get_db),
    current_user: AuthUser = Depends(require_roles([UserRole.ADMIN, UserRole.MANAGER, UserRole.DATA_ENTRY])),
):
    # Check active tag uniqueness
    stmt = select(Cow).where(
        Cow.current_tag_number == data.current_tag_number,
        Cow.status != "archived",
    )
    existing = (await db.execute(stmt)).scalar_one_or_none()
    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"An active cow with tag number '{data.current_tag_number}' already exists.",
        )

    # Check warehouse exists
    wh = await db.get(Warehouse, data.warehouse_id)
    if not wh:
        raise HTTPException(status_code=404, detail="Warehouse not found")

    cow = Cow(
        current_tag_number=data.current_tag_number,
        sex=data.sex,
        category=data.category,
        cow_type=data.cow_type,
        breed=data.breed,
        color=data.color,
        marking=data.marking,
        profile_picture_url=data.profile_picture_url,
        birth_date=data.birth_date,
        acquisition_type=data.acquisition_type,
        acquisition_date=data.acquisition_date,
        purchase_price=data.purchase_price,
        supplier_id=data.supplier_id,
        dam_id=data.dam_id,
        sire_id=data.sire_id,
        warehouse_id=data.warehouse_id,
        status=data.status,
        gives_milk=bool(data.gives_milk) if data.sex == "female" and data.status == "active" else False,
        milking_sessions=list(data.milking_sessions or []) if (data.sex == "female" and data.status == "active" and data.gives_milk) else [],
        sold_date=data.sold_date,
        sale_price=data.sale_price,
        buyer_name=data.buyer_name,
        buyer_phone=data.buyer_phone,
        buyer_address=data.buyer_address,
        sale_notes=data.sale_notes,
        notes=data.notes,
        created_by=current_user.id,
        updated_by=current_user.id,
    )
    db.add(cow)
    await db.flush()

    # Add initial warehouse movement
    wh_hist = CowWarehouseHistory(
        cow_id=cow.cow_id,
        warehouse_id=cow.warehouse_id,
        moved_in_date=cow.acquisition_date,
        reason="Initial warehouse assignment",
        created_by=current_user.id,
        updated_by=current_user.id,
    )
    db.add(wh_hist)

    await db.commit()
    return await get_cow_detail(cow.cow_id, db, current_user)


@router.patch("/cows/{cow_id}", response_model=CowDetailRead)
async def update_cow(
    cow_id: uuid.UUID,
    data: CowUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: AuthUser = Depends(require_roles([UserRole.ADMIN, UserRole.MANAGER])),
):
    cow = await db.get(Cow, cow_id)
    if not cow:
        raise HTTPException(status_code=404, detail="Cow not found")

    lifecycle_before = capture_lifecycle_state(cow)
    # Check tag uniqueness when tag changes
    if data.current_tag_number and data.current_tag_number != cow.current_tag_number:
        stmt = select(Cow).where(
            Cow.current_tag_number == data.current_tag_number,
            Cow.cow_id != cow_id,
            Cow.status != "archived",
        )
        existing = (await db.execute(stmt)).scalar_one_or_none()
        if existing:
            raise HTTPException(
                status_code=400,
                detail=f"An active cow with tag number '{data.current_tag_number}' already exists.",
            )

    # If warehouse is changing, update movement history
    if data.warehouse_id and data.warehouse_id != cow.warehouse_id:
        target_wh = await db.get(Warehouse, data.warehouse_id)
        if not target_wh:
            raise HTTPException(status_code=404, detail="Target warehouse not found")

        today = date.today()
        # Close old movement
        old_mov_stmt = (
            select(CowWarehouseHistory)
            .where(
                CowWarehouseHistory.cow_id == cow_id,
                CowWarehouseHistory.warehouse_id == cow.warehouse_id,
                CowWarehouseHistory.moved_out_date.is_(None),
            )
            .order_by(CowWarehouseHistory.moved_in_date.desc())
        )
        old_mov = (await db.execute(old_mov_stmt)).scalars().first()
        if old_mov:
            old_mov.moved_out_date = today

        # New movement
        new_mov = CowWarehouseHistory(
            cow_id=cow_id,
            warehouse_id=data.warehouse_id,
            moved_in_date=today,
            reason="Transferred to new warehouse",
            created_by=current_user.id,
            updated_by=current_user.id,
        )
        db.add(new_mov)

    update_dict = data.model_dump(exclude_unset=True)

    if update_dict.get("dam_id") == cow_id or update_dict.get("sire_id") == cow_id:
        raise HTTPException(status_code=400, detail="A cow cannot be its own dam or sire.")

    next_acquisition = update_dict.get("acquisition_type", cow.acquisition_type)
    next_birth_date = update_dict.get("birth_date", cow.birth_date)
    next_acq_date = update_dict.get("acquisition_date", cow.acquisition_date)

    if next_acquisition == "born_on_farm":
        if update_dict.get("supplier_id") is not None:
            raise HTTPException(status_code=400, detail="Born on farm cows cannot have a supplier.")
        update_dict["supplier_id"] = None
        update_dict["purchase_price"] = Decimal("0")
        if next_birth_date is not None:
            next_acq_date = next_birth_date
            update_dict["acquisition_date"] = next_birth_date

    if next_birth_date is not None and next_acq_date < next_birth_date:
        raise HTTPException(
            status_code=400,
            detail="Acquisition date cannot be earlier than birth date.",
        )

    next_sex = update_dict.get("sex", cow.sex)
    next_status = update_dict.get("status", cow.status)
    if data.is_archived is True:
        next_status = "archived"
    if next_sex == "male" or next_status != "active":
        update_dict["gives_milk"] = False
        update_dict["milking_sessions"] = []
    elif "gives_milk" in update_dict and update_dict["gives_milk"] is not None:
        gives_milk_val = bool(update_dict["gives_milk"])
        update_dict["gives_milk"] = gives_milk_val
        if not gives_milk_val:
            update_dict["milking_sessions"] = []
        elif "milking_sessions" not in update_dict and not cow.milking_sessions:
            update_dict["milking_sessions"] = ["morning", "noon", "evening"]

    for field, val in update_dict.items():
        setattr(cow, field, val)

    if data.is_archived is not None:
        cow.is_archived = data.is_archived
        if data.is_archived:
            cow.status = "archived"
        elif cow.status == "archived":
            cow.status = "active"
    elif "status" in update_dict:
        cow.is_archived = cow.status == "archived"

    record_lifecycle_changes(db, cow, lifecycle_before, current_user.id, current_user.email)
    cow.updated_by = current_user.id

    await db.commit()
    return await get_cow_detail(cow.cow_id, db, current_user)


# ---------------------- WEIGHT RECORDS ----------------------
@router.post("/cows/{cow_id}/weight", response_model=WeightRecordRead, status_code=status.HTTP_201_CREATED)
async def add_cow_weight_record(
    cow_id: uuid.UUID,
    data: WeightRecordCreate,
    db: AsyncSession = Depends(get_db),
    current_user: AuthUser = Depends(require_roles([UserRole.ADMIN, UserRole.MANAGER, UserRole.DATA_ENTRY])),
):
    cow = await db.get(Cow, cow_id)
    if not cow:
        raise HTTPException(status_code=404, detail="Cow not found")

    weight_record = WeightRecord(
        cow_id=cow_id,
        weigh_date=data.weigh_date,
        weight_kg=data.weight_kg,
        created_by=current_user.id,
        updated_by=current_user.id,
    )
    db.add(weight_record)
    await db.commit()
    await db.refresh(weight_record)
    return weight_record


@router.patch("/cows/{cow_id}/weight/{weight_id}", response_model=WeightRecordRead)
async def update_cow_weight_record(
    cow_id: uuid.UUID,
    weight_id: uuid.UUID,
    data: WeightRecordUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: AuthUser = Depends(require_roles([UserRole.ADMIN, UserRole.MANAGER, UserRole.DATA_ENTRY])),
):
    rec = await db.get(WeightRecord, weight_id)
    if not rec or rec.cow_id != cow_id:
        raise HTTPException(status_code=404, detail="Weight record not found")

    lifecycle_before = capture_lifecycle_state(rec)
    update_dict = data.model_dump(exclude_unset=True)
    for field, val in update_dict.items():
        setattr(rec, field, val)
    record_lifecycle_changes(db, rec, lifecycle_before, current_user.id, current_user.email)
    rec.updated_by = current_user.id

    await db.commit()
    await db.refresh(rec)
    return rec


# ---------------------- WAREHOUSE MOVEMENT ----------------------
@router.post("/cows/{cow_id}/move", response_model=CowDetailRead)
async def move_cow_warehouse(
    cow_id: uuid.UUID,
    data: CowWarehouseHistoryCreate,
    db: AsyncSession = Depends(get_db),
    current_user: AuthUser = Depends(require_roles([UserRole.ADMIN, UserRole.MANAGER, UserRole.DATA_ENTRY])),
):
    cow = await db.get(Cow, cow_id)
    if not cow:
        raise HTTPException(status_code=404, detail="Cow not found")

    warehouse = await db.get(Warehouse, data.warehouse_id)
    if not warehouse:
        raise HTTPException(status_code=404, detail="Destination warehouse not found")

    if cow.warehouse_id == data.warehouse_id:
        raise HTTPException(status_code=400, detail="Cow is already in the selected warehouse.")

    # Close old movement
    old_mov_stmt = (
        select(CowWarehouseHistory)
        .where(
            CowWarehouseHistory.cow_id == cow_id,
            CowWarehouseHistory.warehouse_id == cow.warehouse_id,
            CowWarehouseHistory.moved_out_date.is_(None),
        )
        .order_by(CowWarehouseHistory.moved_in_date.desc())
    )
    old_mov = (await db.execute(old_mov_stmt)).scalars().first()
    if old_mov:
        old_mov.moved_out_date = data.moved_in_date

    # Add new movement
    new_mov = CowWarehouseHistory(
        cow_id=cow_id,
        warehouse_id=data.warehouse_id,
        moved_in_date=data.moved_in_date,
        reason=data.reason,
        created_by=current_user.id,
        updated_by=current_user.id,
    )
    db.add(new_mov)

    cow.warehouse_id = data.warehouse_id
    cow.updated_by = current_user.id

    await db.commit()

    return await get_cow_detail(cow.cow_id, db, current_user)


# ---------------------- PROFILE PICTURE ----------------------
@router.post("/cows/{cow_id}/profile-picture", response_model=CowDetailRead)
async def upload_cow_profile_picture(
    cow_id: uuid.UUID,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: AuthUser = Depends(require_roles([UserRole.ADMIN, UserRole.MANAGER, UserRole.DATA_ENTRY])),
):
    cow = await db.get(Cow, cow_id)
    if not cow:
        raise HTTPException(status_code=404, detail="Cow not found")

    content_type = (file.content_type or "").lower()
    ext = ALLOWED_IMAGE_TYPES.get(content_type)
    if not ext:
        raise HTTPException(
            status_code=400,
            detail="Unsupported image format. Please upload a JPG, PNG, WebP, or GIF image.",
        )

    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="Uploaded image file is empty.")
    if len(data) > MAX_PROFILE_IMAGE_BYTES:
        raise HTTPException(status_code=400, detail="Profile picture must be 5 MB or smaller.")

    cow.profile_picture_url = await upload_profile_picture_to_storage(
        cow_id=cow_id,
        data=data,
        content_type=content_type,
        ext=ext,
        previous_url=cow.profile_picture_url,
    )
    cow.updated_by = current_user.id
    await db.commit()
    return await get_cow_detail(cow_id, db, current_user)


@router.delete("/cows/{cow_id}/profile-picture", response_model=CowDetailRead)
async def delete_cow_profile_picture(
    cow_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: AuthUser = Depends(require_roles([UserRole.ADMIN, UserRole.MANAGER, UserRole.DATA_ENTRY])),
):
    cow = await db.get(Cow, cow_id)
    if not cow:
        raise HTTPException(status_code=404, detail="Cow not found")

    await delete_profile_picture_from_storage(cow.profile_picture_url)

    cow.profile_picture_url = None
    cow.updated_by = current_user.id
    await db.commit()
    return await get_cow_detail(cow_id, db, current_user)
