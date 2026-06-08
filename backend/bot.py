import os
import asyncio
import random
import string
from datetime import datetime, timedelta
from telebot.async_telebot import AsyncTeleBot
from telebot.types import InlineKeyboardMarkup, InlineKeyboardButton

BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "8788385350:AAHviJKYt80E2AHVdExpRMrIvI4N0MI78mo")
bot = AsyncTeleBot(BOT_TOKEN)

# Хранилища
verification_codes = {}
linked_accounts = {}
password_reset_codes = {}

# ========== ФУНКЦИИ ОТПРАВКИ УВЕДОМЛЕНИЙ ==========

async def send_verification_code(telegram_id, username):
    code = ''.join(random.choices(string.digits, k=6))
    expiration = datetime.utcnow() + timedelta(minutes=5)
    
    verification_codes[telegram_id] = {
        "code": code,
        "username": username,
        "expires": expiration.timestamp()
    }
    
    keyboard = InlineKeyboardMarkup()
    keyboard.add(InlineKeyboardButton("📱 Перейти на сайт", url="https://t.me/RuslanSkyControBot"))
    
    await bot.send_message(
        telegram_id,
        f"🔐 *Подтверждение регистрации RuslanSkyControl*\n\n"
        f"Здравствуйте, *{username}*!\n\n"
        f"Ваш код подтверждения: `{code}`\n\n"
        f"⏰ Код действителен *5 минут*.\n\n"
        f"Введите этот код на сайте для завершения регистрации.",
        parse_mode="Markdown",
        reply_markup=keyboard
    )

async def verify_code(telegram_id, code):
    if telegram_id not in verification_codes:
        return False, "❌ Код не найден. Запросите новый."
    
    data = verification_codes[telegram_id]
    if datetime.utcnow().timestamp() > data["expires"]:
        del verification_codes[telegram_id]
        return False, "⏰ Код истёк. Запросите новый."
    
    if data["code"] != code:
        return False, "❌ Неверный код. Попробуйте ещё раз."
    
    username = data["username"]
    del verification_codes[telegram_id]
    return True, username

async def link_account(telegram_id, user_id):
    linked_accounts[telegram_id] = user_id
    await bot.send_message(
        telegram_id,
        "✅ *Аккаунт успешно привязан!*\n\n"
        "Теперь вы будете получать уведомления:\n"
        "✈ О покупке билетов\n"
        "🔔 Об изменении статуса рейсов\n"
        "💰 О снижении цен на избранных маршрутах\n\n"
        "Бот: @RuslanSkyControBot",
        parse_mode="Markdown"
    )

async def get_user_id_by_telegram(telegram_id):
    return linked_accounts.get(telegram_id)

async def get_telegram_by_user_id(user_id):
    for tid, uid in linked_accounts.items():
        if uid == user_id:
            return tid
    return None

async def notify_ticket_purchase(telegram_id, flight_number, airline, origin, destination, departure, price, seat):
    dep_date = departure.strftime("%d.%m.%Y %H:%M") if departure else ""
    
    keyboard = InlineKeyboardMarkup()
    keyboard.add(InlineKeyboardButton("📄 Мои билеты", url="https://t.me/RuslanSkyControBot"))
    
    await bot.send_message(
        telegram_id,
        f"✅ *Билет успешно куплен!*\n\n"
        f"🛫 *Рейс:* {flight_number}\n"
        f"✈ *Авиакомпания:* {airline}\n"
        f"📍 *Маршрут:* {origin} → {destination}\n"
        f"📅 *Вылет:* {dep_date}\n"
        f"💺 *Место:* {seat}\n"
        f"💰 *Цена:* {price:,.0f} ₽\n\n"
        f"🎉 *Счастливого полёта!* ✈️",
        parse_mode="Markdown",
        reply_markup=keyboard
    )

async def notify_flight_status_change(telegram_id, flight_number, origin, destination, old_status, new_status, departure):
    status_map = {
        "scheduled": "🟢 По расписанию",
        "boarding": "🟡 Посадка",
        "delayed": "🔴 Задержан",
        "departed": "🟣 Вылетел",
        "landed": "🟠 Прибыл",
        "cancelled": "⚫ Отменён"
    }
    
    dep_date = departure.strftime("%d.%m.%Y %H:%M") if departure else ""
    
    await bot.send_message(
        telegram_id,
        f"🔔 *Изменение статуса рейса!*\n\n"
        f"🛫 *{flight_number}*\n"
        f"📍 {origin} → {destination}\n"
        f"📅 {dep_date}\n\n"
        f"{status_map.get(old_status, old_status)} → {status_map.get(new_status, new_status)}\n\n"
        f"Проверьте информацию на сайте.",
        parse_mode="Markdown"
    )

async def notify_price_drop(telegram_id, origin, destination, old_price, new_price):
    diff = old_price - new_price
    percent = int((diff / old_price) * 100) if old_price > 0 else 0
    
    keyboard = InlineKeyboardMarkup()
    keyboard.add(InlineKeyboardButton("🔍 Найти билеты", url="https://t.me/RuslanSkyControBot"))
    
    await bot.send_message(
        telegram_id,
        f"📉 *Снижение цены!*\n\n"
        f"📍 *{origin} → {destination}*\n\n"
        f"💰 Было: *{old_price:,.0f} ₽*\n"
        f"💰 Стало: *{new_price:,.0f} ₽*\n"
        f"🎉 Экономия: *{diff:,.0f} ₽* ({percent}%)\n\n"
        f"🔥 Не упустите выгодное предложение!",
        parse_mode="Markdown",
        reply_markup=keyboard
    )

async def notify_registration(telegram_id, username):
    await bot.send_message(
        telegram_id,
        f"🎉 *Регистрация завершена!*\n\n"
        f"Добро пожаловать, *{username}*!\n\n"
        f"✈ Ищите дешёвые авиабилеты\n"
        f"⭐ Добавляйте избранные маршруты\n"
        f"💰 Копите бонусы за покупки\n\n"
        f"Бот: @RuslanSkyControBot\n"
        f"Приятных путешествий! 🌍",
        parse_mode="Markdown"
    )

# ========== ОБРАБОТЧИКИ КОМАНД ==========

@bot.message_handler(commands=['start'])
async def cmd_start(message):
    telegram_id = message.from_user.id
    first_name = message.from_user.first_name
    
    if telegram_id in linked_accounts:
        await bot.reply_to(
            message,
            f"👋 С возвращением, *{first_name}*!\n\n"
            f"Ваш аккаунт привязан к RuslanSkyControl.\n"
            f"Вы будете получать уведомления о рейсах.\n\n"
            f"*/status* — проверить статус\n"
            f"*/unlink* — отвязать аккаунт\n"
            f"*/help* — помощь",
            parse_mode="Markdown"
        )
    else:
        keyboard = InlineKeyboardMarkup()
        keyboard.add(InlineKeyboardButton("🔗 Привязать аккаунт", callback_data="link_account"))
        
        await bot.reply_to(
            message,
            f"👋 *Добро пожаловать в RuslanSkyControl Bot, {first_name}!*\n\n"
            f"Я ваш персональный ассистент для поиска авиабилетов.\n\n"
            f"✈ *Что я умею:*\n"
            f"🔐 Подтверждать регистрацию\n"
            f"📢 Уведомлять о статусе рейсов\n"
            f"💰 Сообщать о снижении цен\n"
            f"🎫 Присылать информацию о билетах\n\n"
            f"🔗 *Привяжите аккаунт*, чтобы начать получать уведомления!\n\n"
            f"*/link* — привязать аккаунт\n"
            f"*/help* — список команд",
            parse_mode="Markdown",
            reply_markup=keyboard
        )

@bot.message_handler(commands=['help'])
async def cmd_help(message):
    await bot.reply_to(
        message,
        "🆘 *Помощь RuslanSkyControl Bot*\n\n"
        "*/start* — главное меню\n"
        "*/link* — привязать аккаунт\n"
        "*/unlink* — отвязать аккаунт\n"
        "*/status* — статус привязки\n"
        "*/notifications* — настройки уведомлений\n"
        "*/help* — эта справка\n\n"
        "Бот: @RuslanSkyControBot",
        parse_mode="Markdown"
    )

@bot.message_handler(commands=['link'])
async def cmd_link(message):
    telegram_id = message.from_user.id
    
    if telegram_id in linked_accounts:
        await bot.reply_to(message, "✅ Ваш аккаунт уже привязан!")
        return
    
    await bot.reply_to(
        message,
        "🔗 *Привязка аккаунта RuslanSkyControl*\n\n"
        "Чтобы привязать аккаунт:\n\n"
        "1️⃣ Зайдите в *Личный кабинет* на сайте\n"
        "2️⃣ Нажмите «Привязать Telegram»\n"
        "3️⃣ Введите ваш Telegram ID: `{0}`\n"
        "4️⃣ Подтвердите привязку\n\n"
        "Ваш ID: `{0}`\n"
        "Бот: @RuslanSkyControBot".format(telegram_id),
        parse_mode="Markdown"
    )

@bot.message_handler(commands=['unlink'])
async def cmd_unlink(message):
    telegram_id = message.from_user.id
    if telegram_id in linked_accounts:
        del linked_accounts[telegram_id]
        await bot.reply_to(message, "✅ Аккаунт отвязан. Вы больше не будете получать уведомления.")
    else:
        await bot.reply_to(message, "❌ У вас нет привязанного аккаунта.")

@bot.message_handler(commands=['status'])
async def cmd_status(message):
    telegram_id = message.from_user.id
    if telegram_id in linked_accounts:
        user_id = linked_accounts[telegram_id]
        await bot.reply_to(
            message,
            f"✅ *Аккаунт привязан*\n\n"
            f"User ID: `{user_id}`\n"
            f"Telegram ID: `{telegram_id}`\n\n"
            f"Вы получаете уведомления о:\n"
            f"✈ Покупке билетов\n"
            f"🔔 Изменении статуса рейсов\n"
            f"💰 Снижении цен\n\n"
            f"Бот: @RuslanSkyControBot",
            parse_mode="Markdown"
        )
    else:
        await bot.reply_to(message, "❌ Аккаунт не привязан. Используйте /link")

@bot.message_handler(commands=['notifications'])
async def cmd_notifications(message):
    keyboard = InlineKeyboardMarkup(row_width=2)
    keyboard.add(
        InlineKeyboardButton("✅ Билеты", callback_data="notif_tickets"),
        InlineKeyboardButton("✅ Статусы", callback_data="notif_status"),
        InlineKeyboardButton("✅ Цены", callback_data="notif_prices"),
        InlineKeyboardButton("❌ Отключить все", callback_data="notif_off")
    )
    
    await bot.reply_to(
        message,
        "⚙️ *Настройки уведомлений*\n\n"
        "Выберите, какие уведомления вы хотите получать:",
        parse_mode="Markdown",
        reply_markup=keyboard
    )

@bot.callback_query_handler(func=lambda call: True)
async def callback_query(call):
    if call.data == "link_account":
        await cmd_link(call.message)
    elif call.data.startswith("notif_"):
        await bot.answer_callback_query(call.id, "Настройки сохранены ✅")
        await bot.send_message(call.message.chat.id, "✅ Настройки уведомлений обновлены.")

@bot.message_handler(func=lambda message: True)
async def echo_all(message):
    telegram_id = message.from_user.id
    
    # Проверяем, не код ли это подтверждения
    if telegram_id in verification_codes and len(message.text) == 6 and message.text.isdigit():
        success, result = await verify_code(telegram_id, message.text)
        if success:
            await bot.reply_to(
                message, 
                f"✅ Код верный! Регистрация подтверждена для пользователя *{result}*.\n"
                f"Теперь привяжите аккаунт через личный кабинет.",
                parse_mode="Markdown"
            )
        else:
            await bot.reply_to(message, result)
        return
    
    await bot.reply_to(
        message,
        "🤔 Я не понимаю эту команду.\n"
        "Используйте /help для списка доступных команд.\n\n"
        "Бот: @RuslanSkyControBot",
    )

# ========== ЗАПУСК ==========
async def start_bot():
    print("🤖 RuslanSkyControBot запущен!")
    await bot.polling(non_stop=True)