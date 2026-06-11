import os

from sqlalchemy.ext.asyncio import (
    AsyncSession,
    create_async_engine,
    async_sessionmaker,
)

from sqlalchemy.orm import declarative_base

from dotenv import load_dotenv


# ==========================================
# ENV
# ==========================================

load_dotenv()


# ==========================================
# DATABASE URL
# ==========================================

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+asyncpg://postgres:postgres@localhost:5432/skycontrol"
)


# ==========================================
# ENGINE
# ==========================================

engine = create_async_engine(
    DATABASE_URL,

    echo=os.getenv(
        "SQL_DEBUG",
        "False"
    ).lower() == "true",

    future=True,

    pool_size=int(
        os.getenv(
            "DB_POOL_SIZE",
            "20"
        )
    ),

    max_overflow=int(
        os.getenv(
            "DB_MAX_OVERFLOW",
            "30"
        )
    ),

    pool_pre_ping=True,

    pool_recycle=3600
)


# ==========================================
# SESSION FACTORY
# ==========================================

AsyncSessionLocal = async_sessionmaker(
    bind=engine,

    class_=AsyncSession,

    expire_on_commit=False,

    autoflush=False,

    autocommit=False,
)


# ==========================================
# BASE
# ==========================================

Base = declarative_base()


# ==========================================
# DEPENDENCY
# ==========================================

async def get_db():

    async with AsyncSessionLocal() as session:

        try:
            yield session

            await session.commit()

        except Exception:

            await session.rollback()

            raise

        finally:

            await session.close()


# ==========================================
# HEALTH CHECK
# ==========================================

async def check_database():

    try:

        async with engine.begin() as conn:
            await conn.run_sync(lambda _: None)

        return True

    except Exception:
        return False


# ==========================================
# INIT DATABASE
# ==========================================

async def create_tables():

    async with engine.begin() as conn:

        await conn.run_sync(
            Base.metadata.create_all
        )


# ==========================================
# DROP DATABASE
# ==========================================

async def drop_tables():

    async with engine.begin() as conn:

        await conn.run_sync(
            Base.metadata.drop_all
        )