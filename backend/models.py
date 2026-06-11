from sqlalchemy import (
    Column,
    Integer,
    String,
    Float,
    DateTime,
    Boolean,
    JSON,
    ForeignKey,
    UniqueConstraint,
    Index
)

from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from database import Base


# ==========================================
# USERS
# ==========================================

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)

    username = Column(String(50), unique=True, nullable=False, index=True)

    hashed_password = Column(String(255), nullable=False)

    role = Column(String(20), nullable=False, default="user")

    full_name = Column(String(255))

    email = Column(String(255), default="")

    email_verified = Column(Boolean, default=False)

    bonuses = Column(Integer, default=0)

    pending_bonuses = Column(Integer, default=0)

    created_at = Column(
        DateTime,
        server_default=func.now()
    )

    tickets = relationship(
        "Ticket",
        back_populates="user",
        cascade="all, delete-orphan"
    )


# ==========================================
# AIRCRAFT
# ==========================================

class Aircraft(Base):
    __tablename__ = "aircraft"

    id = Column(Integer, primary_key=True)

    registration = Column(
        String(20),
        unique=True,
        nullable=False,
        index=True
    )

    model = Column(String(100), nullable=False)

    capacity = Column(Integer, nullable=False)

    status = Column(
        String(30),
        default="on_line"
    )


# ==========================================
# FLIGHTS
# ==========================================

class Flight(Base):
    __tablename__ = "flights"

    id = Column(Integer, primary_key=True)

    flight_number = Column(
        String(20),
        nullable=False,
        unique=True,
        index=True
    )

    airline = Column(
        String(100),
        nullable=False
    )

    origin = Column(
        String(100),
        nullable=False,
        index=True
    )

    destination = Column(
        String(100),
        nullable=False,
        index=True
    )

    scheduled_departure = Column(
        DateTime,
        nullable=False,
        index=True
    )

    scheduled_arrival = Column(
        DateTime,
        nullable=False
    )

    estimated_departure = Column(DateTime)

    estimated_arrival = Column(DateTime)

    actual_departure = Column(DateTime)

    actual_arrival = Column(DateTime)

    status = Column(
        String(30),
        nullable=False,
        default="scheduled",
        index=True
    )

    capacity = Column(
        Integer,
        nullable=False,
        default=180
    )

    free_seats = Column(
        Integer,
        nullable=False,
        default=180
    )

    price = Column(
        Float,
        nullable=False,
        default=5000
    )

    stopovers = Column(
        JSON,
        nullable=False,
        default=list
    )

    created_at = Column(
        DateTime,
        server_default=func.now()
    )

    updated_at = Column(
        DateTime,
        server_default=func.now(),
        onupdate=func.now()
    )

    tickets = relationship(
        "Ticket",
        back_populates="flight",
        cascade="all, delete-orphan"
    )

    __table_args__ = (
        Index(
            "idx_flight_route",
            "origin",
            "destination"
        ),
    )


# ==========================================
# TICKETS
# ==========================================

class Ticket(Base):
    __tablename__ = "tickets"

    id = Column(
        Integer,
        primary_key=True
    )

    flight_id = Column(
        Integer,
        ForeignKey(
            "flights.id",
            ondelete="CASCADE"
        ),
        nullable=False
    )

    user_id = Column(
        Integer,
        ForeignKey(
            "users.id",
            ondelete="CASCADE"
        ),
        nullable=False
    )

    seat_number = Column(
        Integer,
        nullable=False
    )

    purchase_date = Column(
        DateTime,
        server_default=func.now()
    )

    flight = relationship(
        "Flight",
        back_populates="tickets"
    )

    user = relationship(
        "User",
        back_populates="tickets"
    )

    __table_args__ = (
        UniqueConstraint(
            "flight_id",
            "seat_number",
            name="uq_flight_seat"
        ),
    )


# ==========================================
# PROMOTIONS
# ==========================================

class Promotion(Base):
    __tablename__ = "promotions"

    id = Column(
        Integer,
        primary_key=True
    )

    title = Column(
        String(255),
        nullable=False
    )

    description = Column(
        String(2000)
    )

    discount = Column(
        Integer,
        nullable=False,
        default=0
    )

    active = Column(
        Boolean,
        nullable=False,
        default=True
    )

    created_at = Column(
        DateTime,
        server_default=func.now()
    )