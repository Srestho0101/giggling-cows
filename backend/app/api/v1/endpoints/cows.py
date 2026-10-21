from datetime import date
from decimal import Decimal
from typing import List, Optional
import uuid
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload, selectinload

from app.core.database import get_db
from app.core.security import AuthUser, UserRole, get_current_user, require_roles
from app.models.herd import Cow, CowIDHistory, CowWarehouseHistory, Supplier, Warehouse, WeightRecord
from app.schemas.herd import (
    CowCreate,
    CowDetailRead,
    CowIDHistoryRead,
    CowRead,
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

router = APIRouter()


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
        stmt = stmt.where(Cow.current_tag_number.ilike(f"%{search}%"))

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
            selectinload(Cow.id_history),
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
    if cow.weight_records:
        latest_w = max(cow.weight_records, key=lambda w: w.weigh_date)
        detail.latest_weight_kg = latest_w.weight_kg

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
        for m in cow.warehouse_history
    ]

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
        breed=data.breed,
        birth_date=data.birth_date,
        acquisition_type=data.acquisition_type,
        acquisition_date=data.acquisition_date,
        purchase_price=data.purchase_price,
        supplier_id=data.supplier_id,
        dam_id=data.dam_id,
        sire_id=data.sire_id,
        warehouse_id=data.warehouse_id,
        status=data.status,
        notes=data.notes,
        created_by=current_user.id,
        updated_by=current_user.id,
    )
    db.add(cow)
    await db.flush()

    # Add initial tag history
    id_hist = CowIDHistory(
        cow_id=cow.cow_id,
        tag_number=cow.current_tag_number,
        tag_type="ear_tag",
        assigned_date=cow.acquisition_date,
        reason="Initial tag on creation",
        created_by=current_user.id,
        updated_by=current_user.id,
    )
    db.add(id_hist)

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
    # If tag number is changing, create tag history record
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

        # Close old tag history
        old_tag_stmt = (
            select(CowIDHistory)
            .where(
                CowIDHistory.cow_id == cow_id,
                CowIDHistory.tag_number == cow.current_tag_number,
                CowIDHistory.removed_date.is_(None),
            )
            .order_by(CowIDHistory.assigned_date.desc())
        )
        old_tag_record = (await db.execute(old_tag_stmt)).scalars().first()
        today = date.today()
        if old_tag_record:
            old_tag_record.removed_date = today

        # Add new tag history
        new_tag_record = CowIDHistory(
            cow_id=cow_id,
            tag_number=data.current_tag_number,
            tag_type="ear_tag",
            assigned_date=today,
            reason="Tag number updated",
            created_by=current_user.id,
            updated_by=current_user.id,
        )
        db.add(new_tag_record)

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

    if cow.warehouse_id != data.warehouse_id:
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
