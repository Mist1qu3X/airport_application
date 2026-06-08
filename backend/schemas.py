from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

class UserCreate(BaseModel):
    username: str
    password: str
    full_name: Optional[str] = ""

class Token(BaseModel):
    access_token: str
    token_type: str

class FlightOut(BaseModel):
    id: int
    flight_number: str
    airline: str
    origin: str
    destination: str
    scheduled_departure: datetime
    scheduled_arrival: datetime
    estimated_departure: Optional[datetime] = None
    estimated_arrival: Optional[datetime] = None
    status: str
    free_seats: int
    price: float
    stopovers: List[dict] = []

class TicketOut(BaseModel):
    id: int
    flight_id: int
    flight_number: str
    origin: str
    destination: str
    seat_number: int
    purchase_date: datetime

class PurchaseRequest(BaseModel):
    flight_id: int
    seat_number: int
    use_bonuses: int = 0

class DashboardMetrics(BaseModel):
    total_flights: int
    delayed_flights: int
    punctuality: float
    avg_delay_minutes: float
    flights_by_hour: List[dict]
    top_route: dict

class FlightCreate(BaseModel):
    flight_number: str
    airline: str
    origin: str
    destination: str
    scheduled_departure: datetime
    scheduled_arrival: datetime
    status: str = "scheduled"
    free_seats: int = 30
    price: float = 5000.0
    stopovers: list = []

class FlightUpdate(BaseModel):
    flight_number: Optional[str] = None
    airline: Optional[str] = None
    origin: Optional[str] = None
    destination: Optional[str] = None
    scheduled_departure: Optional[datetime] = None
    scheduled_arrival: Optional[datetime] = None
    status: Optional[str] = None
    free_seats: Optional[int] = None
    price: Optional[float] = None
    stopovers: Optional[list] = None