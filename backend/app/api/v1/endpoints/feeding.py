from datetime import date
from decimal import Decimal, ROUND_HALF_UP
from typing import List, Optional
import uuid
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.security import AuthUser, UserRole, get_current_user, require_roles
from app.models.feeding import Expense, ExpenseCategory, FeedType, FeedingRecord
from app.models.herd import Cow, Warehouse
from app.schemas.feeding import (
    ExpenseCategoryCreate,
    ExpenseCategoryRead,
    ExpenseCreate,
    ExpenseRead,
    ExpenseUpdate,
    FeedTypeCreate,
    FeedTypeRead,
    FeedTypeUpdate,
    FeedingRecordCreate,
    FeedingRecordRead,
)

router = APIRouter()


# ---------------------- EXPENSE CATEGORIES ----------------------
@router.get("/categories", response_model=List[ExpenseCategoryRead])
async def list_expense_categories(
    group: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: AuthUser = Depends(get_current_user),
):
    stmt = select(ExpenseCategory)
    if group:
        stmt = stmt.where(ExpenseCategory.category_group == group)
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


# ---------------------- FEED TYPES ----------------------
@router.get("/feed-types", response_model=List[FeedTypeRead])
async def list_feed_types(
    include_archived: bool = False,
    db: AsyncSession = Depends(get_db),
    current_user: AuthUser = Depends(get_current_user),
):
    stmt = select(FeedType).options(selectinload(FeedType.category))
    if not include_archived:
        stmt = stmt.where(FeedType.is_archived == False)
    feed_types = (await db.execute(stmt)).scalars().all()
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

    update_dict = data.model_dump(exclude_unset=True)
    for field, val in update_dict.items():
        setattr(ft, field, val)
    ft.updated_by = current_user.id

    await db.commit()
    await db.refresh(ft)
    r = FeedTypeRead.model_validate(ft)
    return r


@router.delete("/feed-types/{feed_type_id}", response_model=FeedTypeRead)
async def archive_feed_type(
    feed_type_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: AuthUser = Depends(require_roles([UserRole.ADMIN, UserRole.MANAGER])),
):
    ft = await db.get(FeedType, feed_type_id)
    if not ft:
        raise HTTPException(status_code=404, detail="Feed type not found")

    ft.is_archived = True
    ft.updated_by = current_user.id

    await db.commit()
    await db.refresh(ft)
    r = FeedTypeRead.model_validate(ft)
    r.category_name = ft.category.name if ft.category else None
    return r


# ---------------------- FEEDING RECORDS ----------------------
@router.get("/feeding-records", response_model=List[FeedingRecordRead])
async def list_feeding_records(
    cow_id: Optional[uuid.UUID] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
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
        created_at=record.created_at,
        updated_at=record.updated_at,
        created_by=record.created_by,
        updated_by=record.updated_by,
    )


# ---------------------- EXPENSES ----------------------
@router.get("/expenses", response_model=List[ExpenseRead])
async def list_expenses(
    category_id: Optional[uuid.UUID] = None,
    warehouse_id: Optional[uuid.UUID] = None,
    cow_id: Optional[uuid.UUID] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
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
        created_at=exp.created_at,
        updated_at=exp.updated_at,
        created_by=exp.created_by,
        updated_by=exp.updated_by,
    )
