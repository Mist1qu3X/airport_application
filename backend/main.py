import httpx
import os
from fastapi import FastAPI, Depends, HTTPException, Query
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
    
    # Проверка оплаты бонусами (если переданы)
    use_bonuses = getattr(req, 'use_bonuses', 0)
    if use_bonuses > 0:
        if use_bonuses > current_user.bonuses:
            raise HTTPException(400, "Недостаточно бонусов")
        if use_bonuses > flight.price * 0.5:
            raise HTTPException(400, "Бонусами можно оплатить не более 50% стоимости")
    
    flight.free_seats -= 1
    ticket = Ticket(flight_id=req.flight_id, user_id=current_user.id, seat_number=req.seat_number)
    db.add(ticket)
    
    # Начисление бонусов (5% от цены)
    current_user.bonuses += int(flight.price * 0.05)
    # Списание бонусов, если использованы
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
    
    # Возвращаем место
    if flight:
        flight.free_seats += 1
    
    # Забираем 50% бонусов, начисленных при покупке
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

# ---------- ИМПОРТ ИЗ AVIATIONSTACK ----------
@app.post("/api/import/flights")
async def import_flights(db: AsyncSession = Depends(get_db), admin=Depends(get_admin_or_developer)):
    api_key = os.getenv("AVIATIONSTACK_API_KEY")
    if not api_key:
        raise HTTPException(500, "API key not set")
    url = "https://api.aviationstack.com/v1/flights"
    headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}
    params = {"access_key": api_key, "limit": 100, "flight_status": "active", "dep_iata": "SVO"}
    async with httpx.AsyncClient(timeout=30, headers=headers) as client:
        resp = await client.get(url, params=params)
        if resp.status_code != 200:
            raise HTTPException(502, f"External API error: {resp.text[:200]}")
        data = resp.json()
        flights_data = data.get("data", [])
        count = 0
        for f in flights_data:
            flight_number = f.get("flight", {}).get("iata") or f.get("flight", {}).get("icao")
            if not flight_number:
                continue
            dep_str = f.get("departure", {}).get("scheduled")
            arr_str = f.get("arrival", {}).get("scheduled")
            if not dep_str or not arr_str:
                continue
            try:
                dep = datetime.fromisoformat(dep_str.replace("Z", "+00:00"))
                arr = datetime.fromisoformat(arr_str.replace("Z", "+00:00"))
            except:
                continue
            est_dep_str = f.get("departure", {}).get("estimated")
            est_dep = None
            if est_dep_str:
                try:
                    est_dep = datetime.fromisoformat(est_dep_str.replace("Z", "+00:00"))
                except:
                    pass
            flight_status = f.get("flight_status", "scheduled")
            # UPSERT
            existing = await db.execute(
                select(Flight).where(Flight.flight_number == flight_number, Flight.scheduled_departure == dep)
            )
            if existing.scalars().first():
                continue
            new_flight = Flight(
                flight_number=flight_number,
                airline=f.get("airline", {}).get("name", "Unknown"),
                origin=f.get("departure", {}).get("airport", "Unknown"),
                destination=f.get("arrival", {}).get("airport", "Unknown"),
                scheduled_departure=dep,
                scheduled_arrival=arr,
                estimated_departure=est_dep,
                status=flight_status,
                free_seats=30,
                price=5000.0
            )
            db.add(new_flight)
            count += 1
        await db.commit()
        return {"msg": f"Импортировано {count} рейсов"}

# ---------- АКЦИИ ----------
@app.get("/api/promotions")
async def get_promotions(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Promotion).where(Promotion.active == True))
    return result.scalars().all()