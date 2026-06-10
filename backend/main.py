import httpx
import os
import random
import asyncio
import threading
from fastapi import FastAPI, Depends, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func
from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any
from database import get_db, engine, Base
from models import User, Flight, Ticket, Promotion
from schemas import UserCreate, Token, FlightOut, TicketOut, PurchaseRequest, DashboardMetrics, FlightCreate, FlightUpdate
from auth import (get_password_hash, verify_password, create_access_token,
                  get_current_user, get_admin_or_developer, get_developer_only)
from email_service import (
    send_verification_email, send_ticket_purchase_email,
    send_flight_status_email, send_price_drop_email,
    email_verification_codes, generate_code
)
import pytz

app = FastAPI(title="SkyControl")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Часовой пояс Москвы
MOSCOW_TZ = pytz.timezone('Europe/Moscow')

@app.on_event("startup")
async def startup():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

# ========== ВСПОМОГАТЕЛЬНАЯ ФУНКЦИЯ ==========
async def flight_to_dict(flight: Flight, db: AsyncSession) -> Dict[str, Any]:
    """Преобразует объект Flight в словарь с динамическим расчётом свободных мест"""
    
    # Реальное количество проданных билетов
    tickets_count = await db.scalar(
        select(func.count(Ticket.id)).where(Ticket.flight_id == flight.id)
    )
    sold_tickets = tickets_count or 0
    
    # Получаем список занятых мест
    sold_seats_result = await db.execute(
        select(Ticket.seat_number).where(Ticket.flight_id == flight.id)
    )
    sold_seats = list(sold_seats_result.scalars().all())
    
    # Реальная вместимость
    capacity = flight.capacity or 30
    
    # Свободных мест = вместимость - проданные билеты
    actual_free_seats = capacity - sold_tickets
    
    # Защита от отрицательных значений
    if actual_free_seats < 0:
        actual_free_seats = 0
    
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
        "status": flight.status,
        "free_seats": actual_free_seats,
        "price": float(flight.price) if flight.price else 0,
        "stopovers": flight.stopovers or [],
        "capacity": capacity,
        "sold_seats": sold_seats,
        "actual_departure": flight.actual_departure,
        "actual_arrival": flight.actual_arrival,
    }

# ========== АВТОРИЗАЦИЯ ==========
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
        "bonuses": current_user.bonuses or 0,
        "pending_bonuses": current_user.pending_bonuses or 0
    }

# ========== РЕЙСЫ ==========
@app.get("/api/flights/prices")
async def get_prices_calendar(request: Request, db: AsyncSession = Depends(get_db)):
    origin = request.query_params.get("origin", "")
    destination = request.query_params.get("destination", "")
    year_str = request.query_params.get("year", "2026")
    month_str = request.query_params.get("month", "6")
    try:
        year = int(year_str)
        month = int(month_str)
    except:
        return {"prices": {}}
    start_date = datetime(year, month, 1)
    if month == 12:
        end_date = datetime(year + 1, 1, 1)
    else:
        end_date = datetime(year, month + 1, 1)
    result = await db.execute(
        select(Flight)
        .where(Flight.origin.ilike(f"%{origin}%"), Flight.destination.ilike(f"%{destination}%"),
               Flight.scheduled_departure >= start_date, Flight.scheduled_departure < end_date,
               Flight.status.in_(["scheduled", "boarding", "delayed"]))
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

@app.get("/api/flights/all")
async def get_all_flights(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Flight).order_by(Flight.scheduled_departure.desc()))
    flights = result.scalars().all()
    result_list = []
    for f in flights:
        result_list.append(await flight_to_dict(f, db))
    return result_list

@app.post("/api/flights")
async def create_flight(flight: FlightCreate, db: AsyncSession = Depends(get_db), admin=Depends(get_admin_or_developer)):
    new_flight = Flight(**flight.dict())
    db.add(new_flight)
    await db.commit()
    await db.refresh(new_flight)
    return await flight_to_dict(new_flight, db)

@app.get("/api/flights")
async def search_flights(origin: Optional[str] = None, destination: Optional[str] = None,
                         date: Optional[str] = None, status: Optional[str] = None,
                         db: AsyncSession = Depends(get_db)):
    query = select(Flight)
    if status:
        query = query.where(Flight.status == status)
    else:
        query = query.where(Flight.status.in_(["scheduled", "boarding", "delayed"]))
    if origin:
        query = query.where(Flight.origin.ilike(f"%{origin}%"))
    if destination:
        query = query.where(Flight.destination.ilike(f"%{destination}%"))
    if date:
        d = datetime.fromisoformat(date)
        query = query.where(Flight.scheduled_departure >= d, Flight.scheduled_departure < d + timedelta(days=1))
    result = await db.execute(query.order_by(Flight.scheduled_departure))
    flights = result.scalars().all()
    result_list = []
    for f in flights:
        result_list.append(await flight_to_dict(f, db))
    return result_list

@app.get("/api/flights/{flight_id}")
async def get_flight(flight_id: int, db: AsyncSession = Depends(get_db)):
    flight = await db.get(Flight, flight_id)
    if not flight:
        raise HTTPException(404, "Рейс не найден")
    return await flight_to_dict(flight, db)

@app.put("/api/flights/{flight_id}")
async def update_flight(flight_id: int, flight_data: FlightUpdate, db: AsyncSession = Depends(get_db), admin=Depends(get_admin_or_developer)):
    flight = await db.get(Flight, flight_id)
    if not flight:
        raise HTTPException(404, "Рейс не найден")
    update_data = flight_data.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(flight, key, value)
    await db.commit()
    await db.refresh(flight)
    return await flight_to_dict(flight, db)

@app.delete("/api/flights/{flight_id}")
async def delete_flight(flight_id: int, db: AsyncSession = Depends(get_db), admin=Depends(get_admin_or_developer)):
    flight = await db.get(Flight, flight_id)
    if not flight:
        raise HTTPException(404, "Рейс не найден")
    
    if flight.status in ["boarding", "departed"]:
        raise HTTPException(400, "Нельзя удалить рейс, на который уже началась посадка или который вылетел")
    
    tickets_result = await db.execute(select(Ticket).where(Ticket.flight_id == flight_id))
    tickets = tickets_result.scalars().all()
    for ticket in tickets:
        await db.delete(ticket)
    await db.delete(flight)
    await db.commit()
    return {"msg": f"Рейс {flight.flight_number} удалён"}

# ========== УПРАВЛЕНИЕ СТАТУСАМИ РЕЙСОВ ==========
@app.put("/api/flights/{flight_id}/status")
async def update_flight_status(
    flight_id: int, 
    status: str, 
    db: AsyncSession = Depends(get_db), 
    admin=Depends(get_admin_or_developer)
):
    flight = await db.get(Flight, flight_id)
    if not flight:
        raise HTTPException(404, "Рейс не найден")
    
    old_status = flight.status
    flight.status = status
    
    # Запоминаем фактическое время вылета и прилёта
    if status == "departed":
        flight.actual_departure = datetime.now(MOSCOW_TZ)
    elif status == "landed":
        flight.actual_arrival = datetime.now(MOSCOW_TZ)
    
    # Если задержка — обновляем estimated_departure
    if status == "delayed" and not flight.estimated_departure:
        flight.estimated_departure = flight.scheduled_departure + timedelta(minutes=30)
    
    await db.commit()
    return {"msg": f"Статус рейса изменён с {old_status} на {status}"}


@app.put("/api/flights/{flight_id}/delay")
async def delay_flight(
    flight_id: int, 
    minutes: int, 
    db: AsyncSession = Depends(get_db), 
    admin=Depends(get_admin_or_developer)
):
    flight = await db.get(Flight, flight_id)
    if not flight:
        raise HTTPException(404, "Рейс не найден")
    
    flight.status = "delayed"
    flight.estimated_departure = flight.scheduled_departure + timedelta(minutes=minutes)
    flight.estimated_arrival = flight.scheduled_arrival + timedelta(minutes=minutes)
    await db.commit()
    return {"msg": f"Рейс задержан на {minutes} минут", "estimated_departure": flight.estimated_departure}

@app.post("/api/flights/{flight_id}/complete")
async def complete_flight(flight_id: int, db: AsyncSession = Depends(get_db), admin=Depends(get_admin_or_developer)):
    flight = await db.get(Flight, flight_id)
    if not flight:
        raise HTTPException(404, "Рейс не найден")
    flight.status = "landed"
    tickets_result = await db.execute(select(Ticket).where(Ticket.flight_id == flight_id))
    tickets = tickets_result.scalars().all()
    transferred = 0
    for ticket in tickets:
        user = await db.get(User, ticket.user_id)
        if user and (user.pending_bonuses or 0) > 0:
            earned = int(flight.price * 0.05)
            transfer = min(earned, user.pending_bonuses)
            user.pending_bonuses -= transfer
            user.bonuses += transfer
            transferred += transfer
    await db.commit()
    return {"msg": f"Рейс завершён. Переведено бонусов: {transferred}", "transferred": transferred}

# ========== БИЛЕТЫ ==========
@app.post("/api/tickets/purchase")
async def purchase_ticket(req: PurchaseRequest, db: AsyncSession = Depends(get_db), current_user=Depends(get_current_user)):
    flight = await db.get(Flight, req.flight_id)
    if not flight or flight.status not in ("scheduled", "boarding", "delayed"):
        raise HTTPException(400, "Рейс недоступен для покупки")
    
    # Динамическая проверка свободных мест
    tickets_count = await db.scalar(
        select(func.count(Ticket.id)).where(Ticket.flight_id == flight.id)
    )
    sold_tickets = tickets_count or 0
    capacity = flight.capacity or 30
    actual_free_seats = capacity - sold_tickets
    
    if actual_free_seats <= 0:
        raise HTTPException(400, "Нет свободных мест")
    
    # Проверка, не занято ли конкретное место
    existing = await db.execute(
        select(Ticket).where(
            Ticket.flight_id == req.flight_id, 
            Ticket.seat_number == req.seat_number
        )
    )
    if existing.scalars().first():
        raise HTTPException(400, "Место уже занято")
    
    use_bonuses = getattr(req, 'use_bonuses', 0)
    if use_bonuses > 0:
        if use_bonuses > current_user.bonuses:
            raise HTTPException(400, "Недостаточно бонусов")
        if use_bonuses > flight.price * 0.5:
            raise HTTPException(400, "Бонусами можно оплатить не более 50% стоимости")
    
    # Покупка билета
    ticket = Ticket(flight_id=req.flight_id, user_id=current_user.id, seat_number=req.seat_number)
    db.add(ticket)
    earned_bonuses = int(flight.price * 0.05)
    if use_bonuses > 0:
        current_user.bonuses -= use_bonuses
    current_user.pending_bonuses = (current_user.pending_bonuses or 0) + earned_bonuses
    await db.commit()
    await db.refresh(ticket)
    
    if current_user.email and current_user.email_verified:
        send_ticket_purchase_email(current_user.email, current_user.username,
                                   flight.flight_number, flight.origin, flight.destination,
                                   flight.scheduled_departure, req.seat_number, flight.price)
    return {"msg": "Билет куплен", "ticket_id": ticket.id, "bonuses_earned": earned_bonuses}

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
    return [{"id": t.id, "flight_id": t.flight_id, "flight_number": fn, "origin": orig, "destination": dest,
             "departure": dep.isoformat(), "arrival": arr.isoformat(), "status": st,
             "seat_number": t.seat_number, "purchase_date": t.purchase_date.isoformat(), "price": pr}
            for t, fn, orig, dest, dep, arr, st, pr in tickets]

@app.delete("/api/tickets/{ticket_id}")
async def return_ticket(ticket_id: int, db: AsyncSession = Depends(get_db), current_user=Depends(get_current_user)):
    ticket = await db.get(Ticket, ticket_id)
    if not ticket:
        raise HTTPException(404, "Билет не найден")
    if ticket.user_id != current_user.id:
        raise HTTPException(403, "Это не ваш билет")
    flight = await db.get(Flight, ticket.flight_id)
    if flight and flight.status in ("departed", "landed"):
        raise HTTPException(400, "Нельзя вернуть билет после вылета")
    penalty = 0
    if flight:
        earned_bonuses = int(flight.price * 0.05)
        current_user.pending_bonuses = max(0, (current_user.pending_bonuses or 0) - earned_bonuses)
        penalty = int(earned_bonuses * 0.1)
        current_user.bonuses = max(0, current_user.bonuses - penalty)
    await db.delete(ticket)
    await db.commit()
    return {"msg": "Билет возвращён", "penalty": penalty}

# ========== ДАШБОРД ==========
@app.get("/api/reports/dashboard", response_model=DashboardMetrics)
async def dashboard(db: AsyncSession = Depends(get_db), admin=Depends(get_admin_or_developer)):
    result = await db.execute(select(Flight))
    flights = result.scalars().all()
    
    total = len(flights)
    
    # Считаем задержки
    delayed_flights = 0
    total_delay_minutes = 0
    on_time_count = 0
    
    for f in flights:
        delay = 0
        
        # Если есть estimated_departure (задержка от админа)
        if f.estimated_departure:
            delay = (f.estimated_departure - f.scheduled_departure).total_seconds() / 60
            if delay > 0:
                delayed_flights += 1
                total_delay_minutes += delay
        
        # Если рейс уже вылетел (actual_departure)
        elif f.actual_departure:
            delay = (f.actual_departure - f.scheduled_departure).total_seconds() / 60
            if delay > 0:
                delayed_flights += 1
                total_delay_minutes += delay
        
        # Если статус "delayed", но нет estimated — считаем 30 мин (как в автообновлении)
        elif f.status == 'delayed':
            delayed_flights += 1
            total_delay_minutes += 30
        
        # Пунктуальность: задержка ≤ 15 минут
        if delay <= 15:
            on_time_count += 1
    
    avg_delay = round(total_delay_minutes / delayed_flights, 1) if delayed_flights > 0 else 0
    punctuality = round(on_time_count / total * 100, 1) if total > 0 else 100
    
    # Рейсы по часам (по московскому времени)
    hours_data = {}
    for f in flights:
        moscow_time = f.scheduled_departure.replace(tzinfo=pytz.UTC).astimezone(MOSCOW_TZ)
        hour = moscow_time.hour
        hours_data[hour] = hours_data.get(hour, 0) + 1
    flights_by_hour = [{"hour": h, "count": c} for h, c in sorted(hours_data.items())]
    
    # Самый загруженный маршрут
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
            "flights": max_route[1]
        }
    
    return {
        "total_flights": total,
        "delayed_flights": delayed_flights,
        "punctuality": punctuality,
        "avg_delay_minutes": avg_delay,
        "flights_by_hour": flights_by_hour,
        "top_route": top_route
    }

# ========== АДМИНИСТРИРОВАНИЕ ==========
@app.get("/api/users")
async def get_users(db: AsyncSession = Depends(get_db), admin=Depends(get_admin_or_developer)):
    result = await db.execute(select(User))
    return result.scalars().all()

@app.put("/api/users/{user_id}/role")
async def change_role(user_id: int, role: str, db: AsyncSession = Depends(get_db), developer=Depends(get_developer_only)):
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(404, "Пользователь не найден")
    user.role = role
    await db.commit()
    return {"msg": f"Роль изменена на {role}"}

# ========== БОНУСЫ ==========
@app.get("/api/bonus/{user_id}")
async def get_bonus(user_id: int, db: AsyncSession = Depends(get_db)):
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(404, "Пользователь не найден")
    tickets_count = await db.scalar(select(func.count(Ticket.id)).where(Ticket.user_id == user_id))
    return {"points": user.bonuses or 0, "pending_points": user.pending_bonuses or 0, "tickets_count": tickets_count or 0}

# ========== ИМПОРТ РЕЙСОВ (С МОСКОВСКИМ ВРЕМЕНЕМ) ==========
@app.post("/api/import/flights")
async def import_flights(db: AsyncSession = Depends(get_db), admin=Depends(get_admin_or_developer)):
    routes = [("Москва", "Сочи", 5000), ("Москва", "Санкт-Петербург", 3500), ("Москва", "Казань", 4000),
              ("Москва", "Новосибирск", 8000), ("Москва", "Екатеринбург", 7000), ("Москва", "Калининград", 5500),
              ("Москва", "Краснодар", 4500), ("Москва", "Владивосток", 12000), ("Москва", "Мурманск", 6500),
              ("Москва", "Махачкала", 4800), ("Санкт-Петербург", "Москва", 3500), ("Санкт-Петербург", "Сочи", 6000),
              ("Санкт-Петербург", "Казань", 4500), ("Новосибирск", "Москва", 8000), ("Новосибирск", "Сочи", 9000),
              ("Екатеринбург", "Москва", 7000), ("Екатеринбург", "Сочи", 8000), ("Казань", "Москва", 4000)]
    airlines = ["Аэрофлот", "S7 Airlines", "Победа", "Уральские авиалинии", "Nordwind", "Россия", "ЮТэйр", "Якутия", "Red Wings", "Azur Air"]
    
    airline_capacity = {
        "Аэрофлот": 180,
        "S7 Airlines": 160,
        "Победа": 189,
        "Россия": 170,
        "Уральские авиалинии": 150,
        "Nordwind": 160,
        "ЮТэйр": 140,
        "Якутия": 120,
        "Red Wings": 130,
        "Azur Air": 200
    }
    
    new_flights = 0
    # Текущее время по Москве
    now = datetime.now(MOSCOW_TZ)
    
    for origin, dest, base_price in routes:
        for days_ahead in range(1, 35):
            if random.random() < 0.6:
                continue
            # Создаём дату в московском времени
            dep_date = now + timedelta(days=days_ahead)
            dep = dep_date.replace(hour=random.choice([6, 8, 10, 12, 14, 16, 18, 20, 22]), minute=0, second=0, microsecond=0)
            arr = dep + timedelta(hours=random.randint(2, 6), minutes=random.randint(0, 59))
            price = base_price + random.randint(-1500, 5000)
            flight_num = f"{random.choice(['SU','DP','S7','U6','N4','FV','UT','YK','WZ','RL'])}{random.randint(100,999)}"
            
            # Проверка существования рейса
            existing = await db.execute(select(Flight).where(Flight.flight_number == flight_num))
            if existing.scalars().first():
                continue
            
            airline = random.choice(airlines)
            capacity = airline_capacity.get(airline, 150)
            
            # Преобразуем время в UTC для хранения в БД
            dep_utc = dep.astimezone(pytz.UTC).replace(tzinfo=None)
            arr_utc = arr.astimezone(pytz.UTC).replace(tzinfo=None)
            
            db.add(Flight(
                flight_number=flight_num,
                airline=airline,
                origin=origin,
                destination=dest,
                scheduled_departure=dep_utc,
                scheduled_arrival=arr_utc,
                status="scheduled",
                free_seats=capacity,
                capacity=capacity,
                price=max(2000, price),
                stopovers=[] if random.random() > 0.3 else [{"airport": random.choice(["Красноярск", "Новосибирск", "Екатеринбург"]), 
                                                            "arrival": (dep + timedelta(hours=2)).isoformat(), 
                                                            "departure": (dep + timedelta(hours=3)).isoformat()}]
            ))
            new_flights += 1
            if new_flights >= 150:
                break
        if new_flights >= 150:
            break
    await db.commit()
    return {"msg": f"Сгенерировано и добавлено {new_flights} рейсов"}

# ========== EMAIL УВЕДОМЛЕНИЯ ==========
@app.post("/api/email/send-verification")
async def send_email_verification(email: str, username: str):
    code = generate_code()
    email_verification_codes[email] = {
        "code": code,
        "username": username,
        "expires": (datetime.utcnow() + timedelta(minutes=5)).timestamp()
    }
    success = send_verification_email(email, username, code)
    if not success:
        raise HTTPException(500, "Ошибка отправки email")
    return {"msg": "Код отправлен на email"}

@app.post("/api/email/verify-code")
async def verify_email_code(email: str, code: str, db: AsyncSession = Depends(get_db)):
    if email not in email_verification_codes:
        raise HTTPException(400, "Код не найден")
    data = email_verification_codes[email]
    if datetime.utcnow().timestamp() > data["expires"]:
        del email_verification_codes[email]
        raise HTTPException(400, "Код истёк")
    if data["code"] != code:
        raise HTTPException(400, "Неверный код")
    user_result = await db.execute(select(User).where(User.username == data["username"]))
    user = user_result.scalars().first()
    if user:
        user.email = email
        user.email_verified = True
        await db.commit()
    del email_verification_codes[email]
    return {"msg": "Email подтверждён"}

@app.get("/api/email/status")
async def email_status(current_user=Depends(get_current_user)):
    return {"email": current_user.email or "", "verified": current_user.email_verified or False}

@app.put("/api/profile/email")
async def update_email(email: str, current_user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    current_user.email = email
    current_user.email_verified = False
    await db.commit()
    return {"msg": "Email обновлён"}

# ========== ОБНОВЛЕНИЕ СТАТУСОВ ==========
@app.post("/api/flights/update-statuses")
async def update_all_flights_statuses(db: AsyncSession = Depends(get_db), admin=Depends(get_admin_or_developer)):
    result = await db.execute(select(Flight))
    flights = result.scalars().all()
    now = datetime.now(MOSCOW_TZ)
    updated = 0
    
    for flight in flights:
        # Преобразуем время рейса в московское
        departure_moscow = flight.scheduled_departure.replace(tzinfo=pytz.UTC).astimezone(MOSCOW_TZ)
        arrival_moscow = flight.scheduled_arrival.replace(tzinfo=pytz.UTC).astimezone(MOSCOW_TZ)
        
        old_status = flight.status
        new_status = flight.status
        
        # Рейс уже должен был вылететь
        if departure_moscow < now:
            if flight.status in ['scheduled', 'boarding']:
                new_status = 'departed'
            elif flight.status == 'delayed' and flight.estimated_departure:
                estimated_moscow = flight.estimated_departure.replace(tzinfo=pytz.UTC).astimezone(MOSCOW_TZ)
                if estimated_moscow < now:
                    new_status = 'departed'
        
        # Рейс уже должен был прилететь
        if arrival_moscow < now and flight.status == 'departed':
            new_status = 'landed'
        
        if new_status != old_status:
            flight.status = new_status
            updated += 1
    
    await db.commit()
    return {"msg": f"Обновлено статусов: {updated}", "updated": updated}

# ========== АВТОМАТИЧЕСКОЕ ОБНОВЛЕНИЕ СТАТУСОВ (ПОСАДКА ЗА ЧАС) ==========
@app.post("/api/flights/auto-update-statuses")
async def auto_update_flights_statuses(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Flight))
    flights = result.scalars().all()
    now_moscow = datetime.now(MOSCOW_TZ)  # текущее московское время
    updated = 0
    
    for flight in flights:
        # Так как в БД время уже московское (без tzinfo), просто добавляем часовой пояс
        dep_moscow = flight.scheduled_departure.replace(tzinfo=MOSCOW_TZ)
        arr_moscow = flight.scheduled_arrival.replace(tzinfo=MOSCOW_TZ)
        
        old_status = flight.status
        new_status = flight.status
        
        # Если время вылета прошло
        if dep_moscow < now_moscow and old_status in ['scheduled', 'boarding']:
            new_status = 'departed'
        
        # Если время прилёта прошло
        if arr_moscow < now_moscow and old_status == 'departed':
            new_status = 'landed'
        
        # За час до вылета — посадка
        minutes_to_departure = (dep_moscow - now_moscow).total_seconds() / 60
        if -60 <= minutes_to_departure < 0 and old_status == 'scheduled':
            new_status = 'boarding'
        
        if new_status != old_status:
            flight.status = new_status
            updated += 1
            print(f"✈ {flight.flight_number}: {old_status} → {new_status}")
    
    await db.commit()
    return {"msg": f"Обновлено статусов: {updated}", "updated": updated}

# ========== АКЦИИ ==========
@app.get("/api/promotions")
async def get_promotions(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Promotion).where(Promotion.active == True))
    return result.scalars().all()