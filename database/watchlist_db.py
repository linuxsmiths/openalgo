"""
Watchlist Database Module
Manages user watchlist with persistent symbol tracking
"""

import os
from datetime import datetime
from sqlalchemy import Column, String, DateTime, Integer, UniqueConstraint, and_, create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import scoped_session, sessionmaker

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./db/openalgo.db")
engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False} if "sqlite" in DATABASE_URL else {},
    pool_pre_ping=True,
)
SessionLocal = scoped_session(sessionmaker(autocommit=False, autoflush=False, bind=engine))
Base = declarative_base()


class Watchlist(Base):
    """
    Watchlist Model - stores symbols in user's watchlist
    
    Attributes:
        id: Primary key
        user_id: User identifier
        symbol: Trading symbol (e.g., 'SBIN', 'NIFTY')
        exchange: Exchange type (e.g., 'NSE', 'BSE', 'NFO')
        created_at: Timestamp when symbol was added
    """
    __tablename__ = 'watchlist'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String(100), nullable=False, index=True)
    symbol = Column(String(50), nullable=False, index=True)
    exchange = Column(String(50), nullable=False, default='NSE')
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Unique constraint: each user can only have one entry per symbol+exchange combo
    __table_args__ = (
        UniqueConstraint('user_id', 'symbol', 'exchange', name='unique_user_symbol_exchange'),
    )


def initialize_watchlist_db():
    """
    Initialize watchlist database tables
    Called during app startup
    """
    try:
        Base.metadata.create_all(
            bind=engine,
            tables=[Watchlist.__table__],
            checkfirst=True
        )
        return True
    except Exception as e:
        print(f"Error initializing watchlist database: {e}")
        return False


def get_session():
    """Get database session"""
    return SessionLocal()


def add_symbol_to_watchlist(user_id: str, symbol: str, exchange: str = 'NSE') -> dict:
    """
    Add a symbol to user's watchlist
    
    Args:
        user_id: User identifier
        symbol: Trading symbol
        exchange: Exchange type (default: NSE)
    
    Returns:
        dict with status and message
    """
    try:
        db_session = get_session()
        
        # Check if symbol already exists
        existing = db_session.query(Watchlist).filter(
            and_(
                Watchlist.user_id == user_id,
                Watchlist.symbol == symbol,
                Watchlist.exchange == exchange
            )
        ).first()
        
        if existing:
            return {
                'status': 'error',
                'message': f'{symbol} already in your watchlist'
            }
        
        # Add new symbol
        new_entry = Watchlist(
            user_id=user_id,
            symbol=symbol,
            exchange=exchange
        )
        db_session.add(new_entry)
        db_session.commit()
        
        return {
            'status': 'success',
            'message': f'Added {symbol} to watchlist',
            'data': {
                'symbol': symbol,
                'exchange': exchange
            }
        }
    except Exception as e:
        return {
            'status': 'error',
            'message': f'Error adding symbol: {str(e)}'
        }
    finally:
        db_session.close()


def remove_symbol_from_watchlist(user_id: str, symbol: str, exchange: str = 'NSE') -> dict:
    """
    Remove a symbol from user's watchlist
    
    Args:
        user_id: User identifier
        symbol: Trading symbol
        exchange: Exchange type (default: NSE)
    
    Returns:
        dict with status and message
    """
    try:
        db_session = get_session()
        
        # Find and delete the entry
        deleted_count = db_session.query(Watchlist).filter(
            and_(
                Watchlist.user_id == user_id,
                Watchlist.symbol == symbol,
                Watchlist.exchange == exchange
            )
        ).delete()
        
        db_session.commit()
        
        if deleted_count == 0:
            return {
                'status': 'error',
                'message': f'{symbol} not found in your watchlist'
            }
        
        return {
            'status': 'success',
            'message': f'Removed {symbol} from watchlist'
        }
    except Exception as e:
        return {
            'status': 'error',
            'message': f'Error removing symbol: {str(e)}'
        }
    finally:
        db_session.close()


def get_user_watchlist(user_id: str) -> list:
    """
    Get all symbols in user's watchlist
    
    Args:
        user_id: User identifier
    
    Returns:
        list of dicts with symbol, exchange, and created_at
    """
    try:
        db_session = get_session()
        
        entries = db_session.query(Watchlist).filter(
            Watchlist.user_id == user_id
        ).order_by(Watchlist.created_at.asc()).all()
        
        watchlist = [
            {
                'symbol': entry.symbol,
                'exchange': entry.exchange,
                'created_at': entry.created_at.isoformat() if entry.created_at else None
            }
            for entry in entries
        ]
        
        return watchlist
    except Exception as e:
        print(f"Error fetching watchlist: {e}")
        return []
    finally:
        db_session.close()


def get_watchlist_symbols(user_id: str) -> list:
    """
    Get just the symbols (for quoting)
    
    Args:
        user_id: User identifier
    
    Returns:
        list of dicts with symbol and exchange only
    """
    try:
        db_session = get_session()
        
        entries = db_session.query(Watchlist.symbol, Watchlist.exchange).filter(
            Watchlist.user_id == user_id
        ).all()
        
        return [{'symbol': s, 'exchange': e} for s, e in entries]
    except Exception as e:
        print(f"Error fetching watchlist symbols: {e}")
        return []
    finally:
        db_session.close()


def clear_user_watchlist(user_id: str) -> dict:
    """
    Clear all symbols from user's watchlist
    
    Args:
        user_id: User identifier
    
    Returns:
        dict with status and count of removed symbols
    """
    try:
        db_session = get_session()
        
        deleted_count = db_session.query(Watchlist).filter(
            Watchlist.user_id == user_id
        ).delete()
        
        db_session.commit()
        
        return {
            'status': 'success',
            'message': f'Cleared watchlist ({deleted_count} symbols removed)',
            'data': {'count': deleted_count}
        }
    except Exception as e:
        return {
            'status': 'error',
            'message': f'Error clearing watchlist: {str(e)}'
        }
    finally:
        db_session.close()


def symbol_in_watchlist(user_id: str, symbol: str, exchange: str = 'NSE') -> bool:
    """
    Check if a symbol is in user's watchlist
    
    Args:
        user_id: User identifier
        symbol: Trading symbol
        exchange: Exchange type
    
    Returns:
        bool - True if symbol is in watchlist
    """
    try:
        db_session = get_session()
        
        exists = db_session.query(Watchlist).filter(
            and_(
                Watchlist.user_id == user_id,
                Watchlist.symbol == symbol,
                Watchlist.exchange == exchange
            )
        ).first() is not None
        
        return exists
    except Exception as e:
        print(f"Error checking watchlist: {e}")
        return False
    finally:
        db_session.close()
