from datetime import datetime
from typing import Optional, List, Dict, Any

from pydantic import BaseModel, Field, ConfigDict, EmailStr


# =========================
# AUTH
# =========================

class UserCreate(BaseModel):
    username: str = Field(min_length=3, max_length=50)
    password: str = Field(min_length=6, max_length=100)
    full_name: Optional[str] = ""
    email: Optional[EmailStr] = None


class LoginRequest(BaseModel):
    username: str
    password: str


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


# =========================
# USER
# =========================

class UserProfile(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    username: str
    role: str

    full_name: Optional[str] = ""
    email: Optional[str] = ""

    email_verified: bool = False

    bonuses: int = 0
    pending_bonuses: int = 0


class UserShort(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    username: str
    role: str

    full_name: Optional[str] = ""
    email: Optional[str] = ""

    bonuses: int = 0
    pending_bonuses: int = 0


class ChangeRoleRequest(BaseModel):
    role: str


# =========================
# FLIGHTS
# =========================

class Stopover(BaseModel):
    airport: str
    arrival: str
    departure: str


class FlightCreate(BaseModel):
    flight_number: str
    airline: str

    origin: str
    destination: str

    scheduled_departure: datetime
    scheduled_arrival: datetime

    status: str = "scheduled"

    capacity: int = 180
    price: float = 5000

    stopovers: List[Dict[str, Any]] = []


class FlightUpdate(BaseModel):
    flight_number: Optional[str] = None
    airline: Optional[str] = None

    origin: Optional[str] = None
    destination: Optional[str] = None

    scheduled_departure: Optional[datetime] = None
    scheduled_arrival: Optional[datetime] = None

    estimated_departure: Optional[datetime] = None
    estimated_arrival: Optional[datetime] = None

    status: Optional[str] = None

    capacity: Optional[int] = None
    price: Optional[float] = None

    stopovers: Optional[List[Dict[str, Any]]] = None


class FlightOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int

    flight_number: str
    airline: str

    origin: str
    destination: str

    scheduled_departure: datetime
    scheduled_arrival: datetime

    estimated_departure: Optional[datetime] = None
    estimated_arrival: Optional[datetime] = None

    actual_departure: Optional[datetime] = None
    actual_arrival: Optional[datetime] = None

    status: str

    capacity: int
    free_seats: int

    price: float

    sold_seats: List[int] = []

    stopovers: List[Dict[str, Any]] = []


class FlightStatusUpdate(BaseModel):
    status: str


class FlightDelayRequest(BaseModel):
    minutes: int = Field(gt=0, le=1440)


# =========================
# PRICE CALENDAR
# =========================

class CalendarPriceDay(BaseModel):
    price: float
    min_price: float
    flights_count: int


class CalendarPricesResponse(BaseModel):
    prices: Dict[str, CalendarPriceDay]


# =========================
# TICKETS
# =========================

class PurchaseRequest(BaseModel):
    flight_id: int
    seat_number: int
    use_bonuses: int = 0


class PurchaseResponse(BaseModel):
    msg: str
    ticket_id: int
    bonuses_earned: int


class TicketOut(BaseModel):
    id: int

    flight_id: int
    flight_number: str

    origin: str
    destination: str

    departure: str
    arrival: str

    status: str

    seat_number: int

    purchase_date: str

    price: float


# =========================
# BONUS
# =========================

class BonusInfo(BaseModel):
    points: int
    pending_points: int
    tickets_count: int


# =========================
# EMAIL
# =========================

class EmailVerificationRequest(BaseModel):
    email: EmailStr
    username: str


class VerifyEmailRequest(BaseModel):
    email: EmailStr
    code: str


class UpdateEmailRequest(BaseModel):
    email: EmailStr


# =========================
# DASHBOARD
# =========================

class DashboardMetrics(BaseModel):
    total_flights: int

    delayed_flights: int

    punctuality: float

    avg_delay_minutes: float

    flights_by_hour: List[dict]

    top_route: dict


# =========================
# PROMOTIONS
# =========================

class PromotionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int

    title: str

    description: Optional[str] = ""

    discount: int

    active: bool