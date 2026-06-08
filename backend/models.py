from sqlalchemy import Column, Integer, String, Float, DateTime, Boolean, JSON, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    role = Column(String, default="user")
    full_name = Column(String)
    email = Column(String, default="")
    email_verified = Column(Boolean, default=False)
    bonuses = Column(Integer, default=0)
    pending_bonuses = Column(Integer, default=0)

class Flight(Base):
    __tablename__ = "flights"
    id = Column(Integer, primary_key=True, index=True)
    flight_number = Column(String, nullable=False)
    airline = Column(String, nullable=False)
    origin = Column(String, nullable=False)
    destination = Column(String, nullable=False)
    scheduled_departure = Column(DateTime, nullable=False)
    scheduled_arrival = Column(DateTime, nullable=False)
    estimated_departure = Column(DateTime)
    estimated_arrival = Column(DateTime)
    status = Column(String, default="scheduled")
    free_seats = Column(Integer, default=30)
    price = Column(Float, default=5000.0)
    stopovers = Column(JSON, default=[])

class Ticket(Base):
    __tablename__ = "tickets"
    id = Column(Integer, primary_key=True, index=True)
    flight_id = Column(Integer, ForeignKey("flights.id"))
    user_id = Column(Integer, ForeignKey("users.id"))
    seat_number = Column(Integer, nullable=False)
    purchase_date = Column(DateTime, server_default=func.now())
    __table_args__ = (UniqueConstraint('flight_id', 'seat_number'),)

class Promotion(Base):
    __tablename__ = "promotions"
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    description = Column(String)
    discount = Column(Integer, default=0)
    active = Column(Boolean, default=True)