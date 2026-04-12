"""
Top Movers Cache Database
Stores cached top gainers/losers data to avoid repeated broker API calls
"""

import os
from datetime import datetime, timedelta

from sqlalchemy import create_engine, Column, Integer, String, Float, DateTime, Index
from sqlalchemy.orm import scoped_session, sessionmaker
from sqlalchemy.ext.declarative import declarative_base

from utils.logging import get_logger

logger = get_logger(__name__)

DATABASE_URL = os.getenv('DATABASE_URL', 'sqlite:///db/openalgo.db')

engine = create_engine(DATABASE_URL)
db_session = scoped_session(sessionmaker(autocommit=False, autoflush=False, bind=engine))
Base = declarative_base()
Base.query = db_session.query_property()


class TopMoversCache(Base):
    """Cache for top gainers/losers data"""
    __tablename__ = 'top_movers_cache'

    id = Column(Integer, primary_key=True)
    symbol = Column(String, nullable=False, index=True)
    exchange = Column(String, nullable=False, index=True)
    ltp = Column(Float)
    prev_close = Column(Float)
    change_percent = Column(Float)
    change_amount = Column(Float)
    volume = Column(Integer)
    mover_type = Column(String)  # 'gainer' or 'loser'
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)

    __table_args__ = (
        Index('idx_exchange_timestamp', 'exchange', 'timestamp'),
        Index('idx_mover_type', 'mover_type'),
    )


def init_db():
    """Initialize top movers cache database"""
    logger.info("Initializing Top Movers Cache DB")
    Base.metadata.create_all(bind=engine)


def clear_stale_cache(exchange: str = None, max_age_minutes: int = 5):
    """Clear cache entries older than max_age_minutes"""
    try:
        cutoff_time = datetime.utcnow() - timedelta(minutes=max_age_minutes)
        query = db_session.query(TopMoversCache).filter(TopMoversCache.timestamp < cutoff_time)

        if exchange:
            query = query.filter(TopMoversCache.exchange == exchange)

        count = query.delete()
        db_session.commit()

        if count > 0:
            logger.info(f"Cleared {count} stale cache entries for {exchange or 'all exchanges'}")
        return count
    except Exception as e:
        logger.exception(f"Error clearing stale cache: {e}")
        db_session.rollback()
        return 0


def get_cached_movers(exchange: str, max_age_minutes: int = 5) -> dict | None:
    """
    Get cached top movers for exchange if fresh
    Returns None if cache is stale or doesn't exist
    """
    try:
        cutoff_time = datetime.utcnow() - timedelta(minutes=max_age_minutes)

        gainers = (
            db_session.query(TopMoversCache)
            .filter(
                TopMoversCache.exchange == exchange,
                TopMoversCache.mover_type == 'gainer',
                TopMoversCache.timestamp >= cutoff_time,
            )
            .order_by(TopMoversCache.change_percent.desc())
            .all()
        )

        losers = (
            db_session.query(TopMoversCache)
            .filter(
                TopMoversCache.exchange == exchange,
                TopMoversCache.mover_type == 'loser',
                TopMoversCache.timestamp >= cutoff_time,
            )
            .order_by(TopMoversCache.change_percent.asc())
            .all()
        )

        if not gainers and not losers:
            return None

        return {
            'gainers': [row_to_dict(row) for row in gainers],
            'losers': [row_to_dict(row) for row in losers],
            'cached_at': gainers[0].timestamp if gainers else losers[0].timestamp if losers else None,
        }

    except Exception as e:
        logger.exception(f"Error fetching cached movers: {e}")
        return None


def save_movers_cache(exchange: str, gainers: list, losers: list):
    """Save top movers to cache"""
    try:
        # Clear old entries for this exchange
        db_session.query(TopMoversCache).filter(TopMoversCache.exchange == exchange).delete()
        db_session.commit()

        now = datetime.utcnow()

        # Add gainers
        for gainer in gainers:
            cache_entry = TopMoversCache(
                symbol=gainer.get('symbol'),
                exchange=exchange,
                ltp=gainer.get('ltp'),
                prev_close=gainer.get('prev_close'),
                change_percent=gainer.get('change_percent'),
                change_amount=gainer.get('change_amount'),
                volume=gainer.get('volume'),
                mover_type='gainer',
                timestamp=now,
            )
            db_session.add(cache_entry)

        # Add losers
        for loser in losers:
            cache_entry = TopMoversCache(
                symbol=loser.get('symbol'),
                exchange=exchange,
                ltp=loser.get('ltp'),
                prev_close=loser.get('prev_close'),
                change_percent=loser.get('change_percent'),
                change_amount=loser.get('change_amount'),
                volume=loser.get('volume'),
                mover_type='loser',
                timestamp=now,
            )
            db_session.add(cache_entry)

        db_session.commit()
        logger.info(f"Cached {len(gainers)} gainers and {len(losers)} losers for {exchange}")

    except Exception as e:
        logger.exception(f"Error saving movers cache: {e}")
        db_session.rollback()


def row_to_dict(row: TopMoversCache) -> dict:
    """Convert database row to dictionary"""
    return {
        'symbol': row.symbol,
        'exchange': row.exchange,
        'ltp': row.ltp,
        'prev_close': row.prev_close,
        'change_percent': round(row.change_percent, 2) if row.change_percent else 0,
        'change_amount': round(row.change_amount, 2) if row.change_amount else 0,
        'volume': row.volume,
    }
