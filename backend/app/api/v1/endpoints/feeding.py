from datetime import date
from decimal import Decimal, ROUND_HALF_UP
from typing import List, Optional
import uuid
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload, selectinload

from app.core.database import get_db
from app.core.security import AuthUser, UserRole, get_current_user, require_roles
from app.models.feeding import Expense, ExpenseCategory, FeedType, FeedingRecord
from app.models.herd import Cow, Warehouse
from app.schemas.feeding import (
    ExpenseCategoryCreate,
    ExpenseCategoryRead,
    ExpenseCategoryUpdate,
    ExpenseCreate,
    ExpenseRead,
    ExpenseUpdate,
    FeedTypeCreate,
    FeedTypeRead,
    FeedTypeUpdate,
    FeedingRecordCreate,
    FeedingRecordRead,
    FeedingRecordUpdate,
)
from app.services.safe_data_operations import capture_lifecycle_state, record_lifecycle_changes

router = APIRouter()


# ---------------------- EXPENSE CATEGORIES ----------------------
@router.get("/categories", response_model=List[ExpenseCategoryRead])
async def list_expense_categories(
    group: Optional[str] = None,
    include_archived: bool = False,
    archived_only: bool = False,
    db: AsyncSession = Depends(get_db),
    current_user: AuthUser = Depends(get_current_user),
):
    stmt = select(ExpenseCategory)
    if group:
        stmt = stmt.where(ExpenseCategory.category_group == group)
    if archived_only:
        stmt = stmt.where(ExpenseCategory.is_archived == True)
    elif not include_archived:
        stmt = stmt.where(ExpenseCategory.is_archived == False)
    return (await db.execute(stmt)).scalars().all()


@router.post("/categories", response_model=ExpenseCategoryRead, status_code=status.HTTP_201_CREATED)
async def create_expense_category(
    data: ExpenseCategoryCreate,
    db: AsyncSession = Depends(get_db),
    current_user: AuthUser = Depends(require_roles([UserRole.ADMIN, UserRole.MANAGER])),
):
    cat = ExpenseCategory(
        name=data.name,
        name_bn=data.name_bn,
        category_group=data.category_group,
        created_by=current_user.id,
        updated_by=current_user.id,
    )
    db.add(cat)
    await db.commit()
    await db.refresh(cat)
    return cat


@router.patch("/categories/{category_id}", response_model=ExpenseCategoryRead)
async def update_expense_category(
    category_id: uuid.UUID,
    data: ExpenseCategoryUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: AuthUser = Depends(require_roles([UserRole.ADMIN, UserRole.MANAGER])),
):
    cat = await db.get(ExpenseCategory, category_id)
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")

    lifecycle_before = capture_lifecycle_state(cat)
    update_dict = data.model_dump(exclude_unset=True)
    for field, val in update_dict.items():
        setattr(cat, field, val)
    record_lifecycle_changes(db, cat, lifecycle_before, current_user.id, current_user.email)
    cat.updated_by = current_user.id

    await db.commit()
    await db.refresh(cat)
    return cat


# ---------------------- FEED TYPES ----------------------
@router.get("/feed-types", response_model=List[FeedTypeRead])
async def list_feed_types(
    include_archived: bool = False,
    archived_only: bool = False,
    db: AsyncSession = Depends(get_db),
    current_user: AuthUser = Depends(get_current_user),
):
    stmt = select(FeedType).options(joinedload(FeedType.category))
    if archived_only:
        stmt = stmt.where(FeedType.is_archived == True)
    elif not include_archived:
        stmt = stmt.where(FeedType.is_archived == False)
    feed_types = (await db.execute(stmt)).scalars().unique().all()
    res = []
    for ft in feed_types:
        r = FeedTypeRead.model_validate(ft)
        r.category_name = ft.category.name if ft.category else None
        res.append(r)
    return res


@router.post("/feed-types", response_model=FeedTypeRead, status_code=status.HTTP_201_CREATED)
async def create_feed_type(
    data: FeedTypeCreate,
    db: AsyncSession = Depends(get_db),
    current_user: AuthUser = Depends(require_roles([UserRole.ADMIN, UserRole.MANAGER])),
):
    cat = await db.get(ExpenseCategory, data.category_id)
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")

    ft = FeedType(
        category_id=data.category_id,
        name=data.name,
        name_bn=data.name_bn,
        unit=data.unit,
        unit_cost=data.unit_cost,
        created_by=current_user.id,
        updated_by=current_user.id,
    )
    db.add(ft)
    await db.commit()
    await db.refresh(ft)
    r = FeedTypeRead.model_validate(ft)
    r.category_name = cat.name
    return r


@router.patch("/feed-types/{feed_type_id}", response_model=FeedTypeRead)
async def update_feed_type(
    feed_type_id: uuid.UUID,
    data: FeedTypeUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: AuthUser = Depends(require_roles([UserRole.ADMIN, UserRole.MANAGER])),
):
    ft = await db.get(FeedType, feed_type_id)
    if not ft:
        raise HTTPException(status_code=404, detail="Feed type not found")

    lifecycle_before = capture_lifecycle_state(ft)
    update_dict = data.model_dump(exclude_unset=True)
    for field, val in update_dict.items():
        setattr(ft, field, val)
    record_lifecycle_changes(db, ft, lifecycle_before, current_user.id, current_user.email)
    ft.updated_by = current_user.id

    await db.commit()
    await db.refresh(ft)
    r = FeedTypeRead.model_validate(ft)
    return r


# ---------------------- FEEDING RECORDS ----------------------
@router.get("/feeding-records", response_model=List[FeedingRecordRead])
async def list_feeding_records(
    cow_id: Optional[uuid.UUID] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    include_archived: bool = False,
    archived_only: bool = False,
    db: AsyncSession = Depends(get_db),
    current_user: AuthUser = Depends(get_current_user),
):
    stmt = (
        select(FeedingRecord)
        .options(
            selectinload(FeedingRecord.feed_type),
            selectinload(FeedingRecord.cow),
        )
        .order_by(FeedingRecord.feeding_date.desc())
    )
    if cow_id:
        stmt = stmt.where(FeedingRecord.cow_id == cow_id)
    if start_date:
        stmt = stmt.where(FeedingRecord.feeding_date >= start_date)
    if end_date:
        stmt = stmt.where(FeedingRecord.feeding_date <= end_date)
    if archived_only:
        stmt = stmt.where(FeedingRecord.is_archived == True)
    elif not include_archived:
        stmt = stmt.where(FeedingRecord.is_archived == False)

    records = (await db.execute(stmt)).scalars().all()
    res = []
    for fr in records:
        res.append(
            FeedingRecordRead(
                feeding_id=fr.feeding_id,
                feed_type_id=fr.feed_type_id,
                feed_name=fr.feed_type.name if fr.feed_type else None,
                feed_name_bn=fr.feed_type.name_bn if fr.feed_type else None,
                unit=fr.feed_type.unit if fr.feed_type else None,
                cow_id=fr.cow_id,
                cow_tag_number=fr.cow.current_tag_number if fr.cow else None,
                feeding_date=fr.feeding_date,
                quantity=fr.quantity,
                cost=fr.cost,
                notes=fr.notes,
                is_archived=fr.is_archived,
                created_at=fr.created_at,
                updated_at=fr.updated_at,
                created_by=fr.created_by,
                updated_by=fr.updated_by,
            )
        )
    return res


@router.post("/feeding-records", response_model=FeedingRecordRead, status_code=status.HTTP_201_CREATED)
async def create_feeding_record(
    data: FeedingRecordCreate,
    db: AsyncSession = Depends(get_db),
    current_user: AuthUser = Depends(require_roles([UserRole.ADMIN, UserRole.MANAGER, UserRole.DATA_ENTRY])),
):
    ft = await db.get(FeedType, data.feed_type_id)
    if not ft:
        raise HTTPException(status_code=404, detail="Feed type not found")

    unit_cost = data.custom_unit_cost if data.custom_unit_cost is not None else ft.unit_cost
    calculated_cost = (data.quantity * unit_cost).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

    record = FeedingRecord(
        feed_type_id=data.feed_type_id,
        cow_id=data.cow_id,
        feeding_date=data.feeding_date,
        quantity=data.quantity,
        cost=calculated_cost,
        notes=data.notes,
        created_by=current_user.id,
        updated_by=current_user.id,
    )
    db.add(record)
    await db.commit()
    await db.refresh(record)

    cow_tag = None
    if record.cow_id:
        c = await db.get(Cow, record.cow_id)
        if c:
            cow_tag = c.current_tag_number

    return FeedingRecordRead(
        feeding_id=record.feeding_id,
        feed_type_id=record.feed_type_id,
        feed_name=ft.name,
        feed_name_bn=ft.name_bn,
        unit=ft.unit,
        cow_id=record.cow_id,
        cow_tag_number=cow_tag,
        feeding_date=record.feeding_date,
        quantity=record.quantity,
        cost=record.cost,
        notes=record.notes,
        is_archived=record.is_archived,
        created_at=record.created_at,
        updated_at=record.updated_at,
        created_by=record.created_by,
        updated_by=record.updated_by,
    )


@router.patch("/feeding-records/{feeding_id}", response_model=FeedingRecordRead)
async def update_feeding_record(
    feeding_id: uuid.UUID,
    data: FeedingRecordUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: AuthUser = Depends(require_roles([UserRole.ADMIN, UserRole.MANAGER, UserRole.DATA_ENTRY])),
):
    rec = await db.get(FeedingRecord, feeding_id)
    if not rec:
        raise HTTPException(status_code=404, detail="Feeding record not found")

    lifecycle_before = capture_lifecycle_state(rec)
    feed_type_id = data.feed_type_id or rec.feed_type_id
    ft = await db.get(FeedType, feed_type_id)
    if not ft:
        raise HTTPException(status_code=404, detail="Feed type not found")

    if data.feed_type_id is not None:
        rec.feed_type_id = data.feed_type_id
    if data.cow_id is not None:
        rec.cow_id = data.cow_id
    if data.feeding_date is not None:
        rec.feeding_date = data.feeding_date
    if data.notes is not None:
        rec.notes = data.notes
    if data.is_archived is not None:
        rec.is_archived = data.is_archived

    if data.quantity is not None or data.custom_unit_cost is not None or data.feed_type_id is not None:
        qty = data.quantity if data.quantity is not None else rec.quantity
        unit_cost = data.custom_unit_cost if data.custom_unit_cost is not None else ft.unit_cost
        rec.quantity = qty
        rec.cost = (qty * unit_cost).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

    record_lifecycle_changes(db, rec, lifecycle_before, current_user.id, current_user.email)
    rec.updated_by = current_user.id
    await db.commit()
    await db.refresh(rec)

    cow_tag = None
    if rec.cow_id:
        c = await db.get(Cow, rec.cow_id)
        if c:
            cow_tag = c.current_tag_number

    return FeedingRecordRead(
        feeding_id=rec.feeding_id,
        feed_type_id=rec.feed_type_id,
        feed_name=ft.name,
        feed_name_bn=ft.name_bn,
        unit=ft.unit,
        cow_id=rec.cow_id,
        cow_tag_number=cow_tag,
        feeding_date=rec.feeding_date,
        quantity=rec.quantity,
        cost=rec.cost,
        notes=rec.notes,
        is_archived=rec.is_archived,
        created_at=rec.created_at,
        updated_at=rec.updated_at,
        created_by=rec.created_by,
        updated_by=rec.updated_by,
    )


# ---------------------- EXPENSES ----------------------
@router.get("/expenses", response_model=List[ExpenseRead])
async def list_expenses(
    category_id: Optional[uuid.UUID] = None,
    warehouse_id: Optional[uuid.UUID] = None,
    cow_id: Optional[uuid.UUID] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    include_archived: bool = False,
    archived_only: bool = False,
    include_void: bool = False,
    void_only: bool = False,
    db: AsyncSession = Depends(get_db),
    current_user: AuthUser = Depends(get_current_user),
):
    stmt = (
        select(Expense)
        .options(
            selectinload(Expense.category),
            selectinload(Expense.warehouse),
            selectinload(Expense.cow),
        )
        .order_by(Expense.expense_date.desc())
    )
    if category_id:
        stmt = stmt.where(Expense.category_id == category_id)
    if warehouse_id:
        stmt = stmt.where(Expense.warehouse_id == warehouse_id)
    if cow_id:
        stmt = stmt.where(Expense.cow_id == cow_id)
    if start_date:
        stmt = stmt.where(Expense.expense_date >= start_date)
    if end_date:
        stmt = stmt.where(Expense.expense_date <= end_date)
    if archived_only:
        stmt = stmt.where(Expense.is_archived == True)
    elif not include_archived:
        stmt = stmt.where(Expense.is_archived == False)
    if void_only:
        stmt = stmt.where(Expense.is_void == True)
    elif not include_void:
        stmt = stmt.where(Expense.is_void == False)

    expenses = (await db.execute(stmt)).scalars().all()
    res = []
    for exp in expenses:
        res.append(
            ExpenseRead(
                expense_id=exp.expense_id,
                category_id=exp.category_id,
                category_name=exp.category.name if exp.category else None,
                category_name_bn=exp.category.name_bn if exp.category else None,
                warehouse_id=exp.warehouse_id,
                warehouse_name=exp.warehouse.name if exp.warehouse else None,
                cow_id=exp.cow_id,
                cow_tag_number=exp.cow.current_tag_number if exp.cow else None,
                expense_date=exp.expense_date,
                amount=exp.amount,
                description=exp.description,
                is_archived=exp.is_archived,
                is_void=exp.is_void,
                void_reason=exp.void_reason,
                created_at=exp.created_at,
                updated_at=exp.updated_at,
                created_by=exp.created_by,
                updated_by=exp.updated_by,
            )
        )
    return res


@router.post("/expenses", response_model=ExpenseRead, status_code=status.HTTP_201_CREATED)
async def create_expense(
    data: ExpenseCreate,
    db: AsyncSession = Depends(get_db),
    current_user: AuthUser = Depends(require_roles([UserRole.ADMIN, UserRole.MANAGER, UserRole.DATA_ENTRY])),
):
    cat = await db.get(ExpenseCategory, data.category_id)
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")

    exp = Expense(
        category_id=data.category_id,
        warehouse_id=data.warehouse_id,
        cow_id=data.cow_id,
        expense_date=data.expense_date,
        amount=data.amount,
        description=data.description,
        created_by=current_user.id,
        updated_by=current_user.id,
    )
    db.add(exp)
    await db.commit()
    await db.refresh(exp)

    warehouse_name = None
    if exp.warehouse_id:
        wh = await db.get(Warehouse, exp.warehouse_id)
        if wh:
            warehouse_name = wh.name

    cow_tag = None
    if exp.cow_id:
        c = await db.get(Cow, exp.cow_id)
        if c:
            cow_tag = c.current_tag_number

    return ExpenseRead(
        expense_id=exp.expense_id,
        category_id=exp.category_id,
        category_name=cat.name,
        category_name_bn=cat.name_bn,
        warehouse_id=exp.warehouse_id,
        warehouse_name=warehouse_name,
        cow_id=exp.cow_id,
        cow_tag_number=cow_tag,
        expense_date=exp.expense_date,
        amount=exp.amount,
        description=exp.description,
        is_archived=exp.is_archived,
        is_void=exp.is_void,
        void_reason=exp.void_reason,
        created_at=exp.created_at,
        updated_at=exp.updated_at,
        created_by=exp.created_by,
        updated_by=exp.updated_by,
    )


@router.patch("/expenses/{expense_id}", response_model=ExpenseRead)
async def update_expense(
    expense_id: uuid.UUID,
    data: ExpenseUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: AuthUser = Depends(require_roles([UserRole.ADMIN, UserRole.MANAGER, UserRole.DATA_ENTRY])),
):
    exp = await db.get(Expense, expense_id)
    if not exp:
        raise HTTPException(status_code=404, detail="Expense not found")

    lifecycle_before = capture_lifecycle_state(exp)
    update_dict = data.model_dump(exclude_unset=True)
    for field, val in update_dict.items():
        setattr(exp, field, val)
    record_lifecycle_changes(db, exp, lifecycle_before, current_user.id, current_user.email)
    exp.updated_by = current_user.id

    await db.commit()
    await db.refresh(exp)

    cat = await db.get(ExpenseCategory, exp.category_id)
    warehouse_name = None
    if exp.warehouse_id:
        wh = await db.get(Warehouse, exp.warehouse_id)
        if wh:
            warehouse_name = wh.name

    cow_tag = None
    if exp.cow_id:
        c = await db.get(Cow, exp.cow_id)
        if c:
            cow_tag = c.current_tag_number

    return ExpenseRead(
        expense_id=exp.expense_id,
        category_id=exp.category_id,
        category_name=cat.name if cat else None,
        category_name_bn=cat.name_bn if cat else None,
        warehouse_id=exp.warehouse_id,
        warehouse_name=warehouse_name,
        cow_id=exp.cow_id,
        cow_tag_number=cow_tag,
        expense_date=exp.expense_date,
        amount=exp.amount,
        description=exp.description,
        is_archived=exp.is_archived,
        is_void=exp.is_void,
        void_reason=exp.void_reason,
        created_at=exp.created_at,
        updated_at=exp.updated_at,
        created_by=exp.created_by,
        updated_by=exp.updated_by,
    )
