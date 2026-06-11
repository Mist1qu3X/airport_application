from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List

import asyncio
import random
import os

import pytz

from fastapi import (
    FastAPI,
    Depends,
    HTTPException,
    Request,
    Query,
    status,
)
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import (
    func,
    and_,
    or_,
    delete as sql_delete,
)
from database import get_db, engine, Base
from models import User, Flight, Ticket, Promotion
from schemas import (
    UserCreate,
    Token,
    PurchaseRequest,
    DashboardMetrics,
    FlightCreate,
    FlightUpdate,
)
from auth import (
    get_password_hash,
    verify_password,
    create_access_token,
    get_current_user,
    get_admin_or_developer,
    get_developer_only,
)
from email_service import (
    send_verification_email,
    send_ticket_purchase_email,
    send_flight_status_email,
    send_price_drop_email,
    email_verification_codes,
    generate_code,
)

app = FastAPI(title="SkyControl", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ======================== TIMEZONE SETUP ========================
MOSCOW_TZ = pytz.timezone("Europe/Moscow")
UTC_TZ = pytz.UTC

VALID_FLIGHT_STATUSES = {
    "scheduled",
    "boarding",
    "delayed",
    "departed",
    "landed",
    "cancelled",
}
BOOKABLE_STATUSES = {"scheduled", "boarding", "delayed"}
COMPLETED_STATUSES = {"departed", "landed", "cancelled"}

# ======================== HELPERS ========================
def utc_now() -> datetime:
    return datetime.now(UTC_TZ)

def msk_now() -> datetime:
    return datetime.now(MOSCOW_TZ)

def to_utc(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        dt = MOSCOW_TZ.localize(dt)
    return dt.astimezone(UTC_TZ).replace(tzinfo=None)

def to_msk(dt: datetime) -> datetime:
    if dt is None:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=UTC_TZ)
    return dt.astimezone(MOSCOW_TZ)

def safe_float(value):
    try:
        return float(value)
    except Exception:
        return 0.0

async def get_flight_sold_seats(flight_id: int, db: AsyncSession) -> List[int]:
    result = await db.execute(
        select(Ticket.seat_number).where(Ticket.flight_id == flight_id)
    )
    return list(result.scalars().all())

async def get_flight_sold_count(flight_id: int, db: AsyncSession) -> int:
    count = await db.scalar(
        select(func.count(Ticket.id)).where(Ticket.flight_id == flight_id)
    )
    return count or 0

async def calculate_free_seats(flight: Flight, db: AsyncSession) -> int:
    sold = await get_flight_sold_count(flight.id, db)
    capacity = flight.capacity or 30
    return max(0, capacity - sold)

async def flight_to_dict(flight: Flight, db: AsyncSession) -> Dict[str, Any]:
    sold_seats = await get_flight_sold_seats(flight.id, db)
    free_seats = await calculate_free_seats(flight, db)
    return {
        "id": flight.id,
        "flight_number": flight.flight_number,
        "airline": flight.airline,
        "origin": flight.origin,
        "destination": flight.destination,
        "scheduled_departure": flight.scheduled_departure,
        "scheduled_arrival": flight.scheduled_arrival,
        "estimated_departure": flight.estimated_departure,
        "estimated_arrival": flight.estimated_arrival,
        "actual_departure": flight.actual_departure,
        "actual_arrival": flight.actual_arrival,
        "status": flight.status,
        "price": safe_float(flight.price),
        "capacity": flight.capacity or 30,
        "free_seats": free_seats,
        "sold_seats": sold_seats,
        "stopovers": flight.stopovers or [],
    }

async def get_flight_or_404(flight_id: int, db: AsyncSession) -> Flight:
    flight = await db.get(Flight, flight_id)
    if not flight:
        raise HTTPException(status_code=404, detail="Рейс не найден")
    return flight

async def update_flight_statuses(db: AsyncSession) -> int:
    # Обновление статусов (посадка/вылет/прибытие)
    result = await db.execute(
        select(Flight).where(Flight.status.in_(["scheduled", "boarding", "delayed", "departed"]))
    )
    flights = result.scalars().all()
    now_msk = msk_now()
    updated = 0

    for flight in flights:
        dep_msk = to_msk(flight.scheduled_departure)
        arr_msk = to_msk(flight.scheduled_arrival)
        est_dep_msk = to_msk(flight.estimated_departure) if flight.estimated_departure else dep_msk

        old_status = flight.status
        new_status = flight.status

        if flight.status == "scheduled":
            minutes_to_departure = (dep_msk - now_msk).total_seconds() / 60
            if 0 <= minutes_to_departure <= 60:
                new_status = "boarding"
            elif minutes_to_departure < 0:
                if flight.estimated_departure and est_dep_msk > now_msk:
                    new_status = "delayed"
                else:
                    new_status = "departed"
                    flight.actual_departure = dep_msk.astimezone(UTC_TZ).replace(tzinfo=None)
        elif flight.status == "boarding":
            if dep_msk < now_msk:
                if flight.estimated_departure and est_dep_msk > now_msk:
                    new_status = "delayed"
                else:
                    new_status = "departed"
                    flight.actual_departure = dep_msk.astimezone(UTC_TZ).replace(tzinfo=None)
        elif flight.status == "delayed":
            if est_dep_msk < now_msk:
                new_status = "departed"
                flight.actual_departure = est_dep_msk.astimezone(UTC_TZ).replace(tzinfo=None)
        elif flight.status == "departed":
            if arr_msk < now_msk:
                new_status = "landed"
                flight.actual_arrival = arr_msk.astimezone(UTC_TZ).replace(tzinfo=None)

        if new_status != old_status:
            flight.status = new_status
            updated += 1

    if updated > 0:
        await db.commit()

    # ------------------------------------------------------------
    # АВТОМАТИЧЕСКИЙ ПЕРЕНОС БОНУСОВ ДЛЯ ВСЕХ ПРИБЫВШИХ РЕЙСОВ
    # ------------------------------------------------------------
    landed_flights = await db.execute(select(Flight).where(Flight.status == "landed"))
    landed_flights = landed_flights.scalars().all()
    for flight in landed_flights:
        tickets_result = await db.execute(select(Ticket).where(Ticket.flight_id == flight.id))
        tickets = tickets_result.scalars().all()
        for ticket in tickets:
            user = await db.get(User, ticket.user_id)
            if user and (user.pending_bonuses or 0) > 0:
                earned = int(flight.price * 0.05)
                transfer = min(earned, user.pending_bonuses)
                if transfer > 0:
                    user.pending_bonuses -= transfer
                    user.bonuses = (user.bonuses or 0) + transfer
        # коммитим после обработки каждого рейса, чтобы не терять прогресс
        await db.commit()

    return updated

# ======================== STARTUP ========================
@app.on_event("startup")
async def startup():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print("✅ SkyControl started")

# ======================== AUTH ========================
@app.post("/api/register", response_model=Token)
async def register(user: UserCreate, db: AsyncSession = Depends(get_db)):
    existing = await db.execute(select(User).where(User.username == user.username))
    if existing.scalars().first():
        raise HTTPException(status_code=400, detail="Пользователь уже существует")
    new_user = User(
        username=user.username.strip(),
        hashed_password=get_password_hash(user.password),
        full_name=user.full_name or "",
        role="user",
        bonuses=0,
        pending_bonuses=0,
    )
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)
    token = create_access_token({"sub": new_user.username})
    return {"access_token": token, "token_type": "bearer"}

@app.post("/api/login", response_model=Token)
async def login(username: str, password: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.username == username))
    user = result.scalars().first()
    if not user or not verify_password(password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Неверный логин или пароль")
    token = create_access_token({"sub": user.username})
    return {"access_token": token, "token_type": "bearer"}

@app.get("/api/profile")
async def get_profile(current_user: User = Depends(get_current_user)):
    return {
        "id": current_user.id,
        "username": current_user.username,
        "full_name": current_user.full_name,
        "role": current_user.role,
        "email": current_user.email or "",
        "email_verified": current_user.email_verified or False,
        "bonuses": current_user.bonuses or 0,
        "pending_bonuses": current_user.pending_bonuses or 0,
    }

@app.put("/api/profile")
async def update_profile(full_name: str, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    current_user.full_name = full_name
    await db.commit()
    return {"success": True, "full_name": current_user.full_name}

@app.put("/api/profile/email")
async def update_email(email: str, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    email = email.strip().lower()
    existing = await db.execute(select(User).where(and_(User.email == email, User.id != current_user.id)))
    if existing.scalars().first():
        raise HTTPException(status_code=400, detail="Email уже используется")
    current_user.email = email
    current_user.email_verified = False
    await db.commit()
    return {"success": True, "message": "Email обновлён"}

@app.get("/api/email/status")
async def email_status(current_user: User = Depends(get_current_user)):
    return {"email": current_user.email or "", "verified": current_user.email_verified or False}

# ======================== EMAIL VERIFICATION ========================
@app.post("/api/email/send-verification")
async def send_email_verification_endpoint(email: str, username: str, current_user: User = Depends(get_current_user)):
    code = generate_code()
    email_verification_codes[email] = {
        "code": code,
        "username": username,
        "expires": (datetime.utcnow() + timedelta(minutes=5)).timestamp(),
    }
    success = send_verification_email(email, username, code)
    if not success:
        raise HTTPException(status_code=500, detail="Ошибка отправки email")
    return {"msg": "Код отправлен на email"}

@app.post("/api/email/verify-code")
async def verify_email_code(email: str, code: str, db: AsyncSession = Depends(get_db)):
    if email not in email_verification_codes:
        raise HTTPException(status_code=400, detail="Код не найден")
    data = email_verification_codes[email]
    if datetime.utcnow().timestamp() > data["expires"]:
        del email_verification_codes[email]
        raise HTTPException(status_code=400, detail="Код истёк")
    if data["code"] != code:
        raise HTTPException(status_code=400, detail="Неверный код")
    user_result = await db.execute(select(User).where(User.username == data["username"]))
    user = user_result.scalars().first()
    if user:
        user.email = email
        user.email_verified = True
        await db.commit()
    del email_verification_codes[email]
    return {"msg": "Email подтверждён"}

# ======================== FLIGHTS ========================
@app.get("/api/flights/all")
async def get_all_flights(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Flight).order_by(Flight.scheduled_departure.asc()))
    flights = result.scalars().all()
    return [await flight_to_dict(f, db) for f in flights]

@app.post("/api/flights")
async def create_flight(
    flight: FlightCreate,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_admin_or_developer),
):
    data = flight.model_dump()
    for field in ("scheduled_departure", "scheduled_arrival", "estimated_departure", "estimated_arrival"):
        if data.get(field):
            data[field] = to_utc(data[field])
    new_flight = Flight(**data)
    db.add(new_flight)
    await db.commit()
    await db.refresh(new_flight)
    return await flight_to_dict(new_flight, db)

@app.get("/api/flights")
async def search_flights(
    origin: Optional[str] = None,
    destination: Optional[str] = None,
    date: Optional[str] = None,
    status: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    await update_flight_statuses(db)
    query = select(Flight)
    if status:
        query = query.where(Flight.status == status)
    else:
        query = query.where(Flight.status.in_(BOOKABLE_STATUSES))
    if origin:
        query = query.where(Flight.origin.ilike(f"%{origin}%"))
    if destination:
        query = query.where(Flight.destination.ilike(f"%{destination}%"))
    if date:
        d = datetime.fromisoformat(date)
        query = query.where(Flight.scheduled_departure >= d, Flight.scheduled_departure < d + timedelta(days=1))
    result = await db.execute(query.order_by(Flight.scheduled_departure))
    flights = result.scalars().all()
    return [await flight_to_dict(f, db) for f in flights]

@app.get("/api/flights/prices")
async def get_prices_calendar(
    origin: str = Query(""),
    destination: str = Query(""),
    year: int = Query(2026),
    month: int = Query(6),
    db: AsyncSession = Depends(get_db),
):
    start_date = datetime(year, month, 1)
    end_date = datetime(year, month + 1, 1) if month < 12 else datetime(year + 1, 1, 1)
    result = await db.execute(
        select(Flight)
        .where(
            Flight.origin.ilike(f"%{origin}%"),
            Flight.destination.ilike(f"%{destination}%"),
            Flight.scheduled_departure >= start_date,
            Flight.scheduled_departure < end_date,
            Flight.status.in_(BOOKABLE_STATUSES),
        )
        .order_by(Flight.scheduled_departure)
    )
    flights = result.scalars().all()
    prices_by_day = {}
    for flight in flights:
        day = str(flight.scheduled_departure.day)
        price = float(flight.price)
        if day not in prices_by_day:
            prices_by_day[day] = {"price": price, "flights_count": 1, "min_price": price}
        else:
            prices_by_day[day]["flights_count"] += 1
            if price < prices_by_day[day]["min_price"]:
                prices_by_day[day]["min_price"] = price
                prices_by_day[day]["price"] = price
    return {"prices": prices_by_day}

@app.get("/api/flights/{flight_id}")
async def get_flight(flight_id: int, db: AsyncSession = Depends(get_db)):
    flight = await get_flight_or_404(flight_id, db)
    return await flight_to_dict(flight, db)

@app.put("/api/flights/{flight_id}")
async def update_flight(
    flight_id: int,
    flight_data: FlightUpdate,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_admin_or_developer),
):
    flight = await get_flight_or_404(flight_id, db)
    update_data = flight_data.model_dump(exclude_unset=True)
    for field in ("scheduled_departure", "scheduled_arrival", "estimated_departure", "estimated_arrival", "actual_departure", "actual_arrival"):
        if field in update_data and update_data[field] is not None:
            update_data[field] = to_utc(update_data[field])
    for key, value in update_data.items():
        setattr(flight, key, value)
    await db.commit()
    await db.refresh(flight)
    return await flight_to_dict(flight, db)

@app.delete("/api/flights/{flight_id}")
async def delete_flight(flight_id: int, db: AsyncSession = Depends(get_db), admin: User = Depends(get_admin_or_developer)):
    flight = await get_flight_or_404(flight_id, db)
    if flight.status in ["boarding", "departed"]:
        raise HTTPException(status_code=400, detail="Нельзя удалить активный рейс")
    await db.execute(sql_delete(Ticket).where(Ticket.flight_id == flight_id))
    await db.delete(flight)
    await db.commit()
    return {"msg": f"Рейс {flight.flight_number} удалён"}

# ======================== FLIGHT STATUS MANAGEMENT ========================
@app.put("/api/flights/{flight_id}/status")
async def update_flight_status(
    flight_id: int,
    status: str,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_admin_or_developer),
):
    if status not in VALID_FLIGHT_STATUSES:
        raise HTTPException(status_code=400, detail=f"Недопустимый статус: {status}")
    flight = await get_flight_or_404(flight_id, db)
    old_status = flight.status
    flight.status = status
    now_utc = utc_now().replace(tzinfo=None)
    if status == "departed":
        flight.actual_departure = now_utc
    elif status == "landed":
        flight.actual_arrival = now_utc
    elif status == "delayed" and not flight.estimated_departure:
        flight.estimated_departure = flight.scheduled_departure + timedelta(minutes=30)
        flight.estimated_arrival = flight.scheduled_arrival + timedelta(minutes=30)
    await db.commit()
    return {"msg": f"Статус рейса изменён с {old_status} на {status}"}

@app.put("/api/flights/{flight_id}/delay")
async def delay_flight(
    flight_id: int,
    minutes: int,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_admin_or_developer),
):
    if not (1 <= minutes <= 1440):
        raise HTTPException(status_code=400, detail="Задержка: 1-1440 минут")
    flight = await get_flight_or_404(flight_id, db)
    flight.status = "delayed"
    flight.estimated_departure = flight.scheduled_departure + timedelta(minutes=minutes)
    flight.estimated_arrival = flight.scheduled_arrival + timedelta(minutes=minutes)
    await db.commit()
    return {"msg": f"Рейс задержан на {minutes} минут"}

@app.post("/api/flights/{flight_id}/complete")
async def complete_flight(
    flight_id: int,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_admin_or_developer),
):
    flight = await get_flight_or_404(flight_id, db)
    flight.status = "landed"
    flight.actual_arrival = utc_now().replace(tzinfo=None)
    tickets_result = await db.execute(select(Ticket).where(Ticket.flight_id == flight_id))
    tickets = tickets_result.scalars().all()
    transferred = 0
    for ticket in tickets:
        user = await db.get(User, ticket.user_id)
        if user and (user.pending_bonuses or 0) > 0:
            earned = int(flight.price * 0.05)
            transfer = min(earned, user.pending_bonuses)
            user.pending_bonuses -= transfer
            user.bonuses = (user.bonuses or 0) + transfer
            transferred += transfer
    await db.commit()
    return {"msg": f"Рейс завершён. Начислено бонусов: {transferred}"}

@app.post("/api/flights/auto-update-statuses")
async def auto_update_flights_statuses(db: AsyncSession = Depends(get_db)):
    updated = await update_flight_statuses(db)
    return {"msg": f"Обновлено статусов: {updated}", "updated": updated}

# ======================== TICKETS ========================
@app.post("/api/tickets/purchase")
async def purchase_ticket(
    req: PurchaseRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    flight = await get_flight_or_404(req.flight_id, db)
    if flight.status not in BOOKABLE_STATUSES:
        raise HTTPException(status_code=400, detail="Рейс недоступен для покупки")
    sold_count = await get_flight_sold_count(flight.id, db)
    if sold_count >= (flight.capacity or 30):
        raise HTTPException(status_code=400, detail="Нет свободных мест")
    existing = await db.execute(
        select(Ticket).where(Ticket.flight_id == req.flight_id, Ticket.seat_number == req.seat_number)
    )
    if existing.scalars().first():
        raise HTTPException(status_code=400, detail="Место уже занято")
    use_bonuses = req.use_bonuses or 0
    if use_bonuses > 0:
        if use_bonuses > (current_user.bonuses or 0):
            raise HTTPException(status_code=400, detail="Недостаточно бонусов")
        if use_bonuses > flight.price * 0.5:
            raise HTTPException(status_code=400, detail="Бонусами можно оплатить до 50%")
    ticket = Ticket(flight_id=req.flight_id, user_id=current_user.id, seat_number=req.seat_number)
    db.add(ticket)
    earned_bonuses = int(flight.price * 0.05)
    if use_bonuses > 0:
        current_user.bonuses = (current_user.bonuses or 0) - use_bonuses
    current_user.pending_bonuses = (current_user.pending_bonuses or 0) + earned_bonuses
    await db.commit()
    await db.refresh(ticket)
    if current_user.email and current_user.email_verified:
        send_ticket_purchase_email(
            current_user.email, current_user.username,
            flight.flight_number, flight.origin, flight.destination,
            flight.scheduled_departure, req.seat_number, flight.price,
        )
    return {"msg": "Билет куплен", "ticket_id": ticket.id, "bonuses_earned": earned_bonuses}

@app.get("/api/tickets/my")
async def my_tickets(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Ticket, Flight)
        .join(Flight, Ticket.flight_id == Flight.id)
        .where(Ticket.user_id == current_user.id)
        .order_by(Ticket.purchase_date.desc())
    )
    tickets = result.all()
    return [
        {
            "id": ticket.id,
            "flight_id": ticket.flight_id,
            "flight_number": flight.flight_number,
            "origin": flight.origin,
            "destination": flight.destination,
            "departure": flight.scheduled_departure.isoformat() if flight.scheduled_departure else None,
            "arrival": flight.scheduled_arrival.isoformat() if flight.scheduled_arrival else None,
            "status": flight.status,
            "seat_number": ticket.seat_number,
            "purchase_date": ticket.purchase_date.isoformat() if ticket.purchase_date else None,
            "price": safe_float(flight.price),
        }
        for ticket, flight in tickets
    ]

@app.delete("/api/tickets/{ticket_id}")
async def return_ticket(ticket_id: int, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    ticket = await db.get(Ticket, ticket_id)
    if not ticket:
        raise HTTPException(status_code=404, detail="Билет не найден")
    if ticket.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Это не ваш билет")
    flight = await db.get(Flight, ticket.flight_id)
    if flight and flight.status in COMPLETED_STATUSES:
        raise HTTPException(status_code=400, detail="Нельзя вернуть билет после вылета")
    penalty = 0
    if flight:
        earned = int(flight.price * 0.05)
        current_user.pending_bonuses = max(0, (current_user.pending_bonuses or 0) - earned)
        penalty = int(earned * 0.1)
        current_user.bonuses = max(0, (current_user.bonuses or 0) - penalty)
    await db.delete(ticket)
    await db.commit()
    return {"msg": "Билет возвращён", "penalty": penalty}

# ======================== DASHBOARD ========================
@app.get("/api/reports/dashboard", response_model=DashboardMetrics)
async def dashboard(db: AsyncSession = Depends(get_db), admin: User = Depends(get_admin_or_developer)):
    result = await db.execute(select(Flight))
    flights = result.scalars().all()
    total = len(flights)
    delayed = sum(1 for f in flights if f.status == "delayed")
    on_time = 0
    total_delay = 0
    delay_count = 0
    for f in flights:
        if f.actual_departure:
            delay_min = (f.actual_departure - f.scheduled_departure).total_seconds() / 60
            if delay_min <= 15:
                on_time += 1
            total_delay += max(0, delay_min)
            delay_count += 1
        elif f.estimated_departure and f.status == "delayed":
            delay_min = (f.estimated_departure - f.scheduled_departure).total_seconds() / 60
            total_delay += delay_min
            delay_count += 1
    punctuality = round(on_time / delay_count * 100, 1) if delay_count > 0 else 100.0
    avg_delay = round(total_delay / delay_count, 1) if delay_count > 0 else 0
    hours_data = {}
    for f in flights:
        msk_time = to_msk(f.scheduled_departure)
        hour = msk_time.hour
        hours_data[hour] = hours_data.get(hour, 0) + 1
    flights_by_hour = [{"hour": h, "count": c} for h, c in sorted(hours_data.items())]
    route_counts = {}
    for f in flights:
        route = f"{f.origin} → {f.destination}"
        route_counts[route] = route_counts.get(route, 0) + 1
    top_route = {}
    if route_counts:
        max_route = max(route_counts.items(), key=lambda x: x[1])
        top_route = {
            "origin": max_route[0].split(" → ")[0],
            "destination": max_route[0].split(" → ")[1],
            "flights": max_route[1],
        }
    return DashboardMetrics(
        total_flights=total,
        delayed_flights=delayed,
        punctuality=punctuality,
        avg_delay_minutes=avg_delay,
        flights_by_hour=flights_by_hour,
        top_route=top_route,
    )

# ======================== USER MANAGEMENT ========================
@app.get("/api/users")
async def get_users(db: AsyncSession = Depends(get_db), admin: User = Depends(get_admin_or_developer)):
    result = await db.execute(select(User))
    return result.scalars().all()

@app.put("/api/users/{user_id}/role")
async def change_role(user_id: int, role: str, db: AsyncSession = Depends(get_db), developer: User = Depends(get_developer_only)):
    if role not in ("user", "admin", "developer"):
        raise HTTPException(status_code=400, detail="Роль: user, admin или developer")
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    user.role = role
    await db.commit()
    return {"msg": f"Роль изменена на {role}"}

# ======================== BONUSES ========================
@app.get("/api/bonus/{user_id}")
async def get_bonus(user_id: int, db: AsyncSession = Depends(get_db)):
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    tickets_count = await db.scalar(select(func.count(Ticket.id)).where(Ticket.user_id == user_id))
    return {
        "points": user.bonuses or 0,
        "pending_points": user.pending_bonuses or 0,
        "tickets_count": tickets_count or 0,
    }

# ======================== PROMOTIONS ========================
@app.get("/api/promotions")
async def get_promotions(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Promotion).where(Promotion.active == True))
    return result.scalars().all()

# ======================== IMPORT FLIGHTS ========================
@app.post("/api/import/flights")
async def import_flights(db: AsyncSession = Depends(get_db), admin: User = Depends(get_admin_or_developer)):
    try:
        routes = [
            ("Москва", "Сочи", 5000, 2.5), ("Москва", "Санкт-Петербург", 3500, 1.5),
            ("Москва", "Казань", 4000, 1.8), ("Москва", "Новосибирск", 8000, 4.0),
            ("Москва", "Екатеринбург", 7000, 2.5), ("Москва", "Калининград", 5500, 2.0),
            ("Москва", "Краснодар", 4500, 2.0), ("Москва", "Владивосток", 12000, 8.0),
            ("Москва", "Мурманск", 6500, 2.5), ("Москва", "Махачкала", 4800, 3.0),
            ("Москва", "Иркутск", 9500, 6.0), ("Москва", "Челябинск", 6000, 2.5),
            ("Москва", "Самара", 4200, 2.0), ("Москва", "Уфа", 5500, 2.5),
            ("Москва", "Минск", 3800, 1.5), ("Москва", "Стамбул", 8900, 3.5),
            ("Москва", "Дубай", 12500, 5.0), ("Москва", "Ереван", 6500, 3.0),
            ("Москва", "Баку", 7000, 3.0), ("Москва", "Ташкент", 8500, 4.0),
            ("Санкт-Петербург", "Москва", 3500, 1.5), ("Санкт-Петербург", "Сочи", 6000, 3.0),
            ("Санкт-Петербург", "Казань", 4500, 2.0), ("Санкт-Петербург", "Калининград", 3800, 1.5),
            ("Санкт-Петербург", "Мурманск", 4000, 2.0), ("Санкт-Петербург", "Екатеринбург", 7500, 3.0),
            ("Новосибирск", "Москва", 8000, 4.0), ("Новосибирск", "Сочи", 9000, 5.0),
            ("Новосибирск", "Владивосток", 10000, 5.0), ("Екатеринбург", "Москва", 7000, 2.5),
            ("Екатеринбург", "Сочи", 8000, 4.0), ("Казань", "Москва", 4000, 1.8),
            ("Казань", "Сочи", 6000, 3.0), ("Калининград", "Москва", 5500, 2.0),
            ("Калининград", "Санкт-Петербург", 3800, 1.5), ("Владивосток", "Москва", 12000, 8.0),
            ("Владивосток", "Новосибирск", 10000, 5.0), ("Сочи", "Москва", 5000, 2.5),
            ("Сочи", "Екатеринбург", 8000, 4.0), ("Краснодар", "Москва", 4500, 2.0),
            ("Мурманск", "Москва", 6500, 2.5), ("Мурманск", "Санкт-Петербург", 4000, 2.0),
        ]
        airlines = ["Аэрофлот", "S7 Airlines", "Победа", "Уральские авиалинии", "Nordwind", "Россия", "ЮТэйр", "Якутия", "Red Wings", "Azur Air"]
        airline_capacity = {
            "Аэрофлот": 180, "S7 Airlines": 160, "Победа": 189,
            "Россия": 170, "Уральские авиалинии": 150, "Nordwind": 160,
            "ЮТэйр": 140, "Якутия": 120, "Red Wings": 130, "Azur Air": 200,
        }
        transit_cities = ["Казань", "Уфа", "Самара", "Ростов-на-Дону", "Нижний Новгород", "Омск"]
        existing_numbers = set()
        result_nums = await db.execute(select(Flight.flight_number))
        for row in result_nums:
            existing_numbers.add(row[0])
        existing_routes = set()
        result_routes = await db.execute(select(Flight.origin, Flight.destination, Flight.scheduled_departure))
        for orig, dest, dep in result_routes:
            existing_routes.add((orig, dest, dep))
        new_flights = 0
        now_msk = msk_now()
        for origin, dest, base_price, flight_hours in routes:
            for days_ahead in range(1, 35):
                if random.random() < 0.55:
                    continue
                dep_date = now_msk + timedelta(days=days_ahead)
                dep_hour = random.choice([0, 6, 8, 10, 12, 14, 16, 18, 20, 22])
                dep_minute = random.choice([0, 15, 30, 45])
                dep_msk = dep_date.replace(hour=dep_hour, minute=dep_minute, second=0, microsecond=0)
                dep_utc = to_utc(dep_msk)
                if (origin, dest, dep_utc) in existing_routes:
                    continue
                total_hours = flight_hours
                stopovers = []
                if random.random() < 0.25:
                    transit_city = random.choice(transit_cities)
                    if transit_city not in (origin, dest):
                        stopover_duration = random.uniform(1.0, 2.5)
                        total_hours += stopover_duration
                        first_leg = flight_hours * random.uniform(0.4, 0.6)
                        stop_arrival_msk = dep_msk + timedelta(hours=first_leg)
                        stop_departure_msk = stop_arrival_msk + timedelta(hours=stopover_duration)
                        stopovers = [{
                            "airport": transit_city,
                            "arrival": stop_arrival_msk.strftime("%Y-%m-%dT%H:%M:%S"),
                            "departure": stop_departure_msk.strftime("%Y-%m-%dT%H:%M:%S"),
                        }]
                arr_msk = dep_msk + timedelta(hours=total_hours)
                arr_utc = to_utc(arr_msk)
                flight_num = None
                for _ in range(100):
                    prefix = random.choice(["SU", "DP", "S7", "U6", "N4", "FV", "UT", "YK", "WZ", "RL"])
                    candidate = f"{prefix}{random.randint(100, 9999)}"
                    if candidate not in existing_numbers:
                        flight_num = candidate
                        existing_numbers.add(candidate)
                        break
                if not flight_num:
                    continue
                price = max(2000, base_price + random.randint(-1500, 5000))
                airline = random.choice(airlines)
                capacity = airline_capacity.get(airline, 150)
                db.add(Flight(
                    flight_number=flight_num,
                    airline=airline,
                    origin=origin,
                    destination=dest,
                    scheduled_departure=dep_utc,
                    scheduled_arrival=arr_utc,
                    status="scheduled",
                    capacity=capacity,
                    price=price,
                    stopovers=stopovers,
                ))
                existing_routes.add((origin, dest, dep_utc))
                new_flights += 1
                if new_flights >= 200:
                    break
            if new_flights >= 200:
                break
        await db.commit()
        return {"msg": f"Сгенерировано и добавлено {new_flights} рейсов"}
    except Exception as e:
        await db.rollback()
        print(f"❌ ОШИБКА ИМПОРТА: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))