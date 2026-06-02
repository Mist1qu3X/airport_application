import httpx
import os
import random
from fastapi import FastAPI, Depends, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func
from datetime import datetime, timedelta
from typing import List, Optional
from database import get_db, engine, Base
from models import User, Flight, Ticket, Promotion
from schemas import UserCreate, Token, FlightOut, TicketOut, PurchaseRequest, DashboardMetrics
from auth import (get_password_hash, verify_password, create_access_token,
                  get_current_user, get_admin_or_developer)

app = FastAPI(title="SkyControl")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

# ---------- АВТОРИЗАЦИЯ ----------
@app.post("/api/register", response_model=Token)
async def register(user: UserCreate, db: AsyncSession = Depends(get_db)):
    existing = await db.execute(select(User).where(User.username == user.username))
    if existing.scalars().first():
        raise HTTPException(400, "Пользователь уже существует")
    hashed = get_password_hash(user.password)
    new_user = User(username=user.username, hashed_password=hashed, full_name=user.full_name)
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)
    token = create_access_token(data={"sub": new_user.username})
    return {"access_token": token, "token_type": "bearer"}

@app.post("/api/login", response_model=Token)
async def login(username: str, password: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.username == username))
    user = result.scalars().first()
    if not user or not verify_password(password, user.hashed_password):
        raise HTTPException(401, "Неверный логин или пароль")
    token = create_access_token(data={"sub": user.username})
    return {"access_token": token, "token_type": "bearer"}

@app.get("/api/profile")
async def get_profile(current_user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return {
        "id": current_user.id,
        "username": current_user.username,
        "role": current_user.role,
        "full_name": current_user.full_name,
        "bonuses": current_user.bonuses
    }

@app.get("/api/flights/all", response_model=List[FlightOut])
async def get_all_flights(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Flight).order_by(Flight.scheduled_departure.desc()))
    return result.scalars().all()

# ---------- РЕЙСЫ ----------
@app.get("/api/flights", response_model=List[FlightOut])
async def search_flights(
    origin: Optional[str] = None,
    destination: Optional[str] = None,
    date: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    query = select(Flight).where(
        Flight.status.in_(["scheduled", "boarding", "delayed"]),
        Flight.free_seats > 0
    )
    if origin:
        query = query.where(Flight.origin.ilike(f"%{origin}%"))
    if destination:
        query = query.where(Flight.destination.ilike(f"%{destination}%"))
    if date:
        d = datetime.fromisoformat(date)
        query = query.where(Flight.scheduled_departure >= d, Flight.scheduled_departure < d + timedelta(days=1))
    result = await db.execute(query.order_by(Flight.scheduled_departure))
    return result.scalars().all()

# ---------- КАЛЕНДАРЬ ЦЕН ----------
@app.get("/api/flights/prices")
async def get_prices_calendar(request: Request, db: AsyncSession = Depends(get_db)):
    # Получаем параметры вручную
    origin = request.query_params.get("origin", "")
    destination = request.query_params.get("destination", "")
    year_str = request.query_params.get("year", "2026")
    month_str = request.query_params.get("month", "6")
    
    try:
        year = int(year_str)
        month = int(month_str)
    except:
        return {"prices": {}}
    
    # Первый и последний день месяца
    start_date = datetime(year, month, 1)
    if month == 12:
        end_date = datetime(year + 1, 1, 1)
    else:
        end_date = datetime(year, month + 1, 1)
    
    # Ищем рейсы
    result = await db.execute(
        select(Flight)
        .where(
            Flight.origin.ilike(f"%{origin}%"),
            Flight.destination.ilike(f"%{destination}%"),
            Flight.scheduled_departure >= start_date,
            Flight.scheduled_departure < end_date,
            Flight.status.in_(["scheduled", "boarding", "delayed"]),
            Flight.free_seats > 0
        )
        .order_by(Flight.scheduled_departure)
    )
    flights = result.scalars().all()
    
    # Группируем по дням
    prices_by_day = {}
    for flight in flights:
        day = str(flight.scheduled_departure.day)
        price = float(flight.price)
        
        if day not in prices_by_day:
            prices_by_day[day] = {
                "price": price,
                "flights_count": 1,
                "min_price": price
            }
        else:
            prices_by_day[day]["flights_count"] += 1
            if price < prices_by_day[day]["min_price"]:
                prices_by_day[day]["min_price"] = price
                prices_by_day[day]["price"] = price
    
    return {"prices": prices_by_day}

@app.get("/api/flights/{id}", response_model=FlightOut)
async def get_flight(id: int, db: AsyncSession = Depends(get_db)):
    flight = await db.get(Flight, id)
    if not flight:
        raise HTTPException(404, "Рейс не найден")
    return flight

# ---------- БИЛЕТЫ ----------
@app.post("/api/tickets/purchase")
async def purchase_ticket(req: PurchaseRequest, db: AsyncSession = Depends(get_db),
                          current_user=Depends(get_current_user)):
    flight = await db.get(Flight, req.flight_id)
    if not flight or flight.status not in ("scheduled", "boarding", "delayed"):
        raise HTTPException(400, "Рейс недоступен для покупки")
    existing = await db.execute(
        select(Ticket).where(Ticket.flight_id == req.flight_id, Ticket.seat_number == req.seat_number)
    )
    if existing.scalars().first():
        raise HTTPException(400, "Место уже занято")
    if flight.free_seats <= 0:
        raise HTTPException(400, "Нет свободных мест")
    
    use_bonuses = getattr(req, 'use_bonuses', 0)
    if use_bonuses > 0:
        if use_bonuses > current_user.bonuses:
            raise HTTPException(400, "Недостаточно бонусов")
        if use_bonuses > flight.price * 0.5:
            raise HTTPException(400, "Бонусами можно оплатить не более 50% стоимости")
    
    flight.free_seats -= 1
    ticket = Ticket(flight_id=req.flight_id, user_id=current_user.id, seat_number=req.seat_number)
    db.add(ticket)
    
    current_user.bonuses += int(flight.price * 0.05)
    if use_bonuses > 0:
        current_user.bonuses -= use_bonuses
    
    await db.commit()
    await db.refresh(ticket)
    return {"msg": "Билет куплен", "ticket_id": ticket.id, "bonuses_earned": int(flight.price * 0.05)}

@app.get("/api/tickets/my")
async def my_tickets(current_user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Ticket, Flight.flight_number, Flight.origin, Flight.destination,
               Flight.scheduled_departure, Flight.scheduled_arrival, Flight.status, Flight.price)
        .join(Flight, Ticket.flight_id == Flight.id)
        .where(Ticket.user_id == current_user.id)
        .order_by(Ticket.purchase_date.desc())
    )
    tickets = result.all()
    return [{
        "id": t.id,
        "flight_id": t.flight_id,
        "flight_number": fn,
        "origin": orig,
        "destination": dest,
        "departure": dep.isoformat(),
        "arrival": arr.isoformat(),
        "status": st,
        "seat_number": t.seat_number,
        "purchase_date": t.purchase_date.isoformat(),
        "price": pr
    } for t, fn, orig, dest, dep, arr, st, pr in tickets]

@app.delete("/api/tickets/{ticket_id}")
async def return_ticket(ticket_id: int, db: AsyncSession = Depends(get_db),
                        current_user=Depends(get_current_user)):
    ticket = await db.get(Ticket, ticket_id)
    if not ticket:
        raise HTTPException(404, "Билет не найден")
    if ticket.user_id != current_user.id:
        raise HTTPException(403, "Это не ваш билет")
    
    flight = await db.get(Flight, ticket.flight_id)
    if flight and flight.status in ("departed", "landed"):
        raise HTTPException(400, "Нельзя вернуть билет после вылета")
    
    if flight:
        flight.free_seats += 1
    
    bonus_to_remove = int(flight.price * 0.05 * 0.5) if flight else 0
    current_user.bonuses = max(0, current_user.bonuses - bonus_to_remove)
    
    await db.delete(ticket)
    await db.commit()
    return {"msg": "Билет возвращён", "bonuses_removed": bonus_to_remove}

# ---------- ДАШБОРД ----------
@app.get("/api/reports/dashboard", response_model=DashboardMetrics)
async def dashboard(db: AsyncSession = Depends(get_db), admin=Depends(get_admin_or_developer)):
    total = await db.scalar(select(func.count(Flight.id)))
    delayed = await db.scalar(select(func.count(Flight.id)).where(Flight.status == "delayed"))
    on_time = await db.scalar(select(func.count(Flight.id)).where(Flight.status == "scheduled"))
    punctuality = round((on_time / total * 100), 1) if total else 100
    avg_delay = await db.scalar(
        select(func.avg(func.extract('epoch', Flight.estimated_departure - Flight.scheduled_departure)/60))
        .where(Flight.status == "delayed")
    ) or 0
    hours = await db.execute(
        select(func.extract('hour', Flight.scheduled_departure).label('h'), func.count(Flight.id))
        .group_by('h').order_by('h')
    )
    flights_by_hour = [{"hour": int(h), "count": c} for h, c in hours]
    top = await db.execute(
        select(Flight.origin, Flight.destination, func.count(Flight.id).label('cnt'))
        .group_by(Flight.origin, Flight.destination).order_by(func.count(Flight.id).desc()).limit(1)
    )
    top_route = {}
    row = top.first()
    if row:
        top_route = {"origin": row.origin, "destination": row.destination, "flights": row.cnt}
    return {
        "total_flights": total,
        "delayed_flights": delayed,
        "punctuality": punctuality,
        "avg_delay_minutes": round(float(avg_delay), 1),
        "flights_by_hour": flights_by_hour,
        "top_route": top_route
    }

# ---------- АДМИНИСТРИРОВАНИЕ ----------
@app.get("/api/users")
async def get_users(db: AsyncSession = Depends(get_db), admin=Depends(get_admin_or_developer)):
    result = await db.execute(select(User))
    return result.scalars().all()

@app.put("/api/users/{user_id}/role")
async def change_role(user_id: int, role: str, db: AsyncSession = Depends(get_db),
                      admin=Depends(get_admin_or_developer)):
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(404, "Пользователь не найден")
    user.role = role
    await db.commit()
    return {"msg": f"Роль изменена на {role}"}

@app.post("/api/import/flights")
async def import_flights(db: AsyncSession = Depends(get_db), admin=Depends(get_admin_or_developer)):
    # Список популярных направлений (откуда, куда, базовая цена)
    routes = [
        ("Москва", "Сочи", 5000),
        ("Москва", "Санкт-Петербург", 3500),
        ("Москва", "Казань", 4000),
        ("Москва", "Новосибирск", 8000),
        ("Москва", "Екатеринбург", 7000),
        ("Москва", "Калининград", 5500),
        ("Москва", "Краснодар", 4500),
        ("Москва", "Владивосток", 12000),
        ("Москва", "Мурманск", 6500),
        ("Москва", "Махачкала", 4800),
        ("Санкт-Петербург", "Москва", 3500),
        ("Санкт-Петербург", "Сочи", 6000),
        ("Санкт-Петербург", "Казань", 4500),
        ("Новосибирск", "Москва", 8000),
        ("Новосибирск", "Сочи", 9000),
        ("Екатеринбург", "Москва", 7000),
        ("Екатеринбург", "Сочи", 8000),
        ("Казань", "Москва", 4000),
    ]
    airlines = ["Аэрофлот", "S7 Airlines", "Победа", "Уральские авиалинии", "Nordwind", "Россия", "ЮТэйр", "Якутия", "Red Wings", "Azur Air"]
    
    new_flights = 0
    now = datetime.utcnow()
    for origin, dest, base_price in routes:
        # Генерируем рейс на ближайшие 5 дней
        for days_ahead in range(1, 6):
            # Не все дни – чтобы было разнообразие (70% дней имеют рейсы)
            if random.random() < 0.3:
                continue
            dep_date = now + timedelta(days=days_ahead)
            dep_hour = random.choice([6, 7, 8, 9, 10, 12, 14, 16, 18, 20, 22])
            dep = dep_date.replace(hour=dep_hour, minute=0, second=0, microsecond=0)
            # Продолжительность от 1.5 до 8 часов
            duration_h = random.randint(2, 8)
            arr = dep + timedelta(hours=duration_h, minutes=random.randint(0, 59))
            price = base_price + random.randint(-1500, 3000)
            free_seats = random.randint(5, 60)
            flight_num = f"{random.choice(['SU','DP','S7','U6','N4','FV','UT','YK','WZ','RL'])}{random.randint(100,999)}"
            
            # Проверяем, нет ли уже такого рейса
            existing = await db.execute(
                select(Flight).where(Flight.flight_number == flight_num, Flight.scheduled_departure == dep)
            )
            if existing.scalars().first():
                continue
                
            new = Flight(
                flight_number=flight_num,
                airline=random.choice(airlines),
                origin=origin,
                destination=dest,
                scheduled_departure=dep,
                scheduled_arrival=arr,
                estimated_departure=None,
                estimated_arrival=None,
                status="scheduled",
                free_seats=free_seats,
                price=price,
                stopovers=[]
            )
            db.add(new)
            new_flights += 1
            if new_flights >= 150:
                break
        if new_flights >= 150:
            break

    await db.commit()
    return {"msg": f"Сгенерировано и добавлено {new_flights} рейсов"}

# ---------- АКЦИИ ----------
@app.get("/api/promotions")
async def get_promotions(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Promotion).where(Promotion.active == True))
    return result.scalars().all()
