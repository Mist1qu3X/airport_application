import os
import smtplib
import random
import string
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime, timedelta

# SMTP настройки Mail.ru
SMTP_HOST = os.getenv("SMTP_HOST", "smtp.mail.ru")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", "rturdahunov@bk.ru")
SMTP_PASS = os.getenv("SMTP_PASS", "mmtRq2emARdxmKawRpHg")
FROM_EMAIL = "rturdahunov@bk.ru"
APP_URL = os.getenv("APP_URL", "http://localhost:5173")

# Хранилище кодов подтверждения
email_verification_codes = {}

def generate_code():
    return ''.join(random.choices(string.digits, k=6))

def send_email(to_email, subject, html_body):
    """Отправка email через SMTP Mail.ru"""
    msg = MIMEMultipart('alternative')
    msg['From'] = f"SkyControl <{FROM_EMAIL}>"
    msg['To'] = to_email
    msg['Subject'] = subject
    msg.attach(MIMEText(html_body, 'html', 'utf-8'))

    try:
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
            server.starttls()
            server.login(SMTP_USER, SMTP_PASS)
            server.send_message(msg)
        print(f"Email sent to {to_email}")
        return True
    except Exception as e:
        print(f"Email error: {e}")
        return False

def send_verification_email(email, username, code):
    """Отправка кода подтверждения регистрации"""
    subject = "SkyControl - Email Verification"
    html = f"""
    <div style="max-width:600px;margin:0 auto;font-family:Arial,sans-serif">
        <div style="background:#004785;padding:20px;border-radius:10px 10px 0 0">
            <h1 style="color:#fff;margin:0">✈ SkyControl</h1>
        </div>
        <div style="background:#fff;padding:30px;border:1px solid #e0e0e0;border-top:none">
            <h2>Welcome, {username}!</h2>
            <p>Your verification code:</p>
            <div style="background:#f5f8fc;padding:20px;text-align:center;border-radius:8px;margin:20px 0">
                <span style="font-size:32px;font-weight:bold;letter-spacing:8px;color:#004785">{code}</span>
            </div>
            <p style="color:#888;font-size:14px">Code expires in 5 minutes.</p>
            <hr style="border:1px solid #e0e0e0;margin:20px 0">
            <p style="color:#aaa;font-size:12px">If you didn't create this account, please ignore this email.</p>
        </div>
    </div>
    """
    return send_email(email, subject, html)

def send_ticket_purchase_email(email, username, flight_number, origin, destination, departure, seat, price):
    """Уведомление о покупке билета"""
    dep_str = departure.strftime("%d %b %Y, %H:%M") if departure else ""
    subject = f"SkyControl - Ticket Confirmed: {flight_number}"
    html = f"""
    <div style="max-width:600px;margin:0 auto;font-family:Arial,sans-serif">
        <div style="background:#004785;padding:20px;border-radius:10px 10px 0 0">
            <h1 style="color:#fff;margin:0">✈ Ticket Confirmed!</h1>
        </div>
        <div style="background:#fff;padding:30px;border:1px solid #e0e0e0;border-top:none">
            <h2>Thank you, {username}!</h2>
            <table style="width:100%;border-collapse:collapse;margin:20px 0">
                <tr><td style="padding:8px;color:#888">Flight</td><td style="padding:8px;font-weight:bold">{flight_number}</td></tr>
                <tr><td style="padding:8px;color:#888">Route</td><td style="padding:8px;font-weight:bold">{origin} → {destination}</td></tr>
                <tr><td style="padding:8px;color:#888">Departure</td><td style="padding:8px;font-weight:bold">{dep_str}</td></tr>
                <tr><td style="padding:8px;color:#888">Seat</td><td style="padding:8px;font-weight:bold">{seat}</td></tr>
                <tr><td style="padding:8px;color:#888">Price</td><td style="padding:8px;font-weight:bold;color:#004785;font-size:18px">{price:,.0f} RUB</td></tr>
            </table>
            <a href="{APP_URL}/tickets" style="display:inline-block;background:#ff8c00;color:#fff;padding:12px 30px;text-decoration:none;border-radius:8px;font-weight:bold">View My Tickets</a>
        </div>
    </div>
    """
    return send_email(email, subject, html)

def send_flight_status_email(email, username, flight_number, origin, destination, old_status, new_status, departure):
    """Уведомление об изменении статуса рейса"""
    dep_str = departure.strftime("%d %b %Y, %H:%M") if departure else ""
    status_colors = {"delayed": "#e60000", "boarding": "#ff8c00", "cancelled": "#999", "departed": "#6c5ce7"}
    color = status_colors.get(new_status, "#004785")
    subject = f"SkyControl - Flight {flight_number} Status Update"
    html = f"""
    <div style="max-width:600px;margin:0 auto;font-family:Arial,sans-serif">
        <div style="background:{color};padding:20px;border-radius:10px 10px 0 0">
            <h1 style="color:#fff;margin:0">Flight Status Update</h1>
        </div>
        <div style="background:#fff;padding:30px;border:1px solid #e0e0e0;border-top:none">
            <p>Hello {username},</p>
            <p>Flight <b>{flight_number}</b> ({origin} → {destination}, {dep_str}) status changed:</p>
            <p><b>{old_status}</b> → <b style="color:{color}">{new_status}</b></p>
            <a href="{APP_URL}/flight/0" style="display:inline-block;background:#004785;color:#fff;padding:10px 25px;text-decoration:none;border-radius:6px">Check Details</a>
        </div>
    </div>
    """
    return send_email(email, subject, html)

def send_price_drop_email(email, username, origin, destination, old_price, new_price):
    """Уведомление о снижении цены"""
    diff = old_price - new_price
    subject = f"SkyControl - Price Drop: {origin} → {destination}"
    html = f"""
    <div style="max-width:600px;margin:0 auto;font-family:Arial,sans-serif">
        <div style="background:#00a650;padding:20px;border-radius:10px 10px 0 0">
            <h1 style="color:#fff;margin:0">💰 Price Drop Alert!</h1>
        </div>
        <div style="background:#fff;padding:30px;border:1px solid #e0e0e0;border-top:none">
            <p>Hey {username},</p>
            <p>Price for <b>{origin} → {destination}</b> dropped!</p>
            <p>Was: <s>{old_price:,.0f} RUB</s> → Now: <b style="color:#00a650;font-size:20px">{new_price:,.0f} RUB</b></p>
            <p>You save: <b>{diff:,.0f} RUB</b></p>
            <a href="{APP_URL}/results?origin={origin}&destination={destination}" style="display:inline-block;background:#ff8c00;color:#fff;padding:12px 30px;text-decoration:none;border-radius:8px;font-weight:bold">Book Now</a>
        </div>
    </div>
    """
    return send_email(email, subject, html)