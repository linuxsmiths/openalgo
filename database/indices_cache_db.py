"""
Indices Cache Database
Caches index quotes with TTL for fast retrieval
"""

import os
from datetime import datetime, timedelta
from sqlalchemy import Column, String, Float, Integer, DateTime, create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import scoped_session, sessionmaker

from utils.logging import get_logger

logger = get_logger(__name__)

DATABASE_URL = os.getenv("DATABASE_URL")
engine = create_engine(DATABASE_URL)
db_session = scoped_session(sessionmaker(autocommit=False, autoflush=False, bind=engine))
Base = declarative_base()


class IndicesCache(Base):
    """Cache for index quotes"""
    __tablename__ = "indices_cache"

    id = Column(Integer, primary_key=True)
    index_name = Column(String(100), unique=True, nullable=False, index=True)
    symbol = Column(String(100), nullable=False)
    exchange = Column(String(50), nullable=False)
    ltp = Column(Float, nullable=False)
    prev_close = Column(Float, nullable=False)
    change_amount = Column(Float, nullable=False)
    change_percent = Column(Float, nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow, nullable=False)


def init_db():
    logger.info("Initializing Indices Cache DB")
    Base.metadata.create_all(bind=engine)


def get_cached_indices(max_age_minutes: int = 5) -> dict | None:
    """
    Get cached indices if fresh
    
    Args:
        max_age_minutes: Max age of cache in minutes
    
    Returns:
        Dict with indices data or None if stale/not cached
    """
    try:
        records = db_session.query(IndicesCache).all()
        if not records:
            logger.debug("No cached indices found")
            return None
        
        # Check if cache is fresh
        oldest = min(r.timestamp for r in records)
        age = datetime.utcnow() - oldest
        
        if age > timedelta(minutes=max_age_minutes):
            logger.debug(f"Cache stale ({age.total_seconds():.0f}s old)")
            return None
        
        indices_data = []
        for record in records:
            indices_data.append({
                'index_name': record.index_name,
                'symbol': record.symbol,
                'exchange': record.exchange,
                'ltp': record.ltp,
                'prev_close': record.prev_close,
                'change_amount': record.change_amount,
                'change_percent': record.change_percent,
            })
        
        logger.info(f"Returning cached {len(indices_data)} indices (age: {age.total_seconds():.0f}s)")
        return {
            'indices': indices_data,
            'cached_at': oldest.isoformat() if oldest else None,
        }
        
    except Exception as e:
        logger.exception(f"Error retrieving cached indices: {e}")
        return None


def save_indices_cache(indices_data: list) -> bool:
    """
    Save indices data to cache
    
    Args:
        indices_data: List of index dicts with ltp, prev_close, etc.
    
    Returns:
        True if successful, False otherwise
    """
    try:
        # Clear old cache
        db_session.query(IndicesCache).delete()
        
        # Insert new data
        for idx_data in indices_data:
            cache_record = IndicesCache(
                index_name=idx_data['index_name'],
                symbol=idx_data['symbol'],
                exchange=idx_data['exchange'],
                ltp=idx_data['ltp'],
                prev_close=idx_data['prev_close'],
                change_amount=idx_data['change_amount'],
                change_percent=idx_data['change_percent'],
                timestamp=datetime.utcnow(),
            )
            db_session.add(cache_record)
        
        db_session.commit()
        logger.info(f"Cached {len(indices_data)} indices successfully")
        return True
        
    except Exception as e:
        logger.exception(f"Error saving indices cache: {e}")
        db_session.rollback()
        return False


def clear_stale_cache(max_age_minutes: int = 5) -> None:
    """Clear stale cache entries"""
    try:
        cutoff_time = datetime.utcnow() - timedelta(minutes=max_age_minutes)
        deleted = db_session.query(IndicesCache).filter(
            IndicesCache.timestamp < cutoff_time
        ).delete()
        db_session.commit()
        if deleted:
            logger.info(f"Cleared {deleted} stale cache entries")
    except Exception as e:
        logger.exception(f"Error clearing stale cache: {e}")
        db_session.rollback()
