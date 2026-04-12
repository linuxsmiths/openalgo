"""
Top Movers Service
Business logic for fetching and calculating top gainers/losers
"""

import importlib
from typing import Any, Dict, List

from database.auth_db import get_auth_token_broker
from database.topmovers_cache_db import get_cached_movers, save_movers_cache, clear_stale_cache
from utils.logging import get_logger

logger = get_logger(__name__)


def import_broker_module(broker_name: str) -> dict[str, Any] | None:
    """Dynamically import broker-specific data module"""
    try:
        module_path = f"broker.{broker_name}.api.data"
        broker_module = importlib.import_module(module_path)
        return broker_module
    except ImportError as error:
        logger.exception(f"Error importing broker module '{module_path}': {error}")
        return None


def get_symbols_for_exchange(broker_name: str, exchange: str) -> list[dict]:
    """
    Get all symbols for an exchange from broker's master contract
    
    Args:
        broker_name: Name of the broker
        exchange: Exchange code (NSE, BSE)
    
    Returns:
        List of dicts with symbol and exchange
    """
    try:
        # Import broker's master contract database
        master_contract_module = importlib.import_module(
            f"broker.{broker_name}.database.master_contract_db"
        )
        
        # Try to get symbols from SymToken table
        if hasattr(master_contract_module, 'SymToken'):
            SymToken = master_contract_module.SymToken
            
            # For NSE/BSE, instrumenttype is often NULL (spot market equities)
            # For derivatives (NFO, MCX), filter by specific instrument types
            if exchange in ['NSE', 'BSE']:
                # Query symbols where instrumenttype is NULL or empty (spot equities)
                symbols = SymToken.query.filter_by(exchange=exchange).filter(
                    (SymToken.instrumenttype == None) |
                    (SymToken.instrumenttype == '') |
                    (SymToken.instrumenttype == 'EQ')
                ).all()
            else:
                # For derivatives, filter by specific instrument type (EQ if available)
                symbols = SymToken.query.filter_by(exchange=exchange).filter_by(
                    instrumenttype='EQ'
                ).all()
            
            result = [
                {'symbol': s.symbol, 'exchange': s.exchange}
                for s in symbols
            ]
            
            logger.info(f"Found {len(result)} symbols for {exchange} from {broker_name}")
            return result
        
    except Exception as e:
        logger.debug(f"Could not fetch symbols from {broker_name}: {e}")
    
    # Fallback: return empty list (will be handled by caller)
    return []


def get_common_symbols(exchange: str) -> list[dict]:
    """
    Fallback: Return list of common stocks for testing
    This is used when master contract DB is not available
    """
    # Common NSE stocks for testing
    nse_stocks = [
        'SBIN', 'RELIANCE', 'HDFC', 'INFY', 'TCS', 'LT', 'ITC', 'WIPRO',
        'ASIANPAINT', 'MARUTI', 'HCLTECH', 'AXISBANK', 'KOTAKBANK', 'ICICIBANK',
        'BAJAJFINSV', 'BAJAJ-AUTO', 'SUNPHARMA', 'TATASTEEL', 'M&M', 'ULTRACEMCO',
        'BHARTIARTL', 'ADANIPOWER', 'ADANIENT', 'SHREECEM', 'JSWSTEEL', 'HINDALCO',
        'TECHM', 'HDFCBANK', 'POWERGRID', 'NTPC', 'BPCL', 'ONGC', 'IOC', 'EICHERMOT',
    ]
    
    bse_stocks = nse_stocks[:20]  # Subset for BSE
    
    if exchange == 'NSE':
        stocks = nse_stocks
    elif exchange == 'BSE':
        stocks = bse_stocks
    else:
        stocks = nse_stocks + bse_stocks
    
    return [{'symbol': stock, 'exchange': exchange} for stock in stocks]


def get_top_movers(api_key: str, exchange: str = 'NSE', limit: int = 10) -> Dict[str, Any]:
    """
    Get top gainers and losers for a given exchange

    Args:
        api_key: OpenAlgo API key (for broker auth)
        exchange: Exchange code (NSE, BSE)
        limit: Number of top movers to return

    Returns:
        Dictionary with 'gainers' and 'losers' lists
    """
    try:
        # Step 1: Check cache first
        cached = get_cached_movers(exchange, max_age_minutes=5)
        if cached:
            logger.info(f"Returning cached top movers for {exchange}")
            return {
                'gainers': cached['gainers'][:limit],
                'losers': cached['losers'][:limit],
                'cached': True,
                'cached_at': cached['cached_at'].isoformat() if cached['cached_at'] else None,
            }

        logger.info(f"Cache miss for {exchange}, fetching fresh data")

        # Step 2: Get broker and auth token using API key
        auth_token, broker_name = get_auth_token_broker(api_key)
        
        if not broker_name or not auth_token:
            # If no valid auth token, return empty (user not authenticated with broker yet)
            logger.warning(f"No valid auth token for API key")
            return {'gainers': [], 'losers': [], 'cached': False}

        logger.debug(f"Using broker: {broker_name}")

        # Step 3: Import broker module
        broker_module = import_broker_module(broker_name)
        if not broker_module:
            raise Exception(f"Failed to import broker module for {broker_name}")

        # Step 4: Initialize broker data handler
        BrokerData = getattr(broker_module, 'BrokerData', None)
        if not BrokerData:
            raise Exception(f"BrokerData class not found in {broker_name} module")

        broker_data = BrokerData(auth_token)

        # Step 5: Get all symbols for exchange
        logger.info(f"Fetching symbols for {exchange}")
        symbols = get_symbols_for_exchange(broker_name, exchange)
        if not symbols:
            logger.warning(f"No symbols found for {exchange}, trying fallback")
            # Fallback: use a hardcoded list of common NSE/BSE stocks
            symbols = get_common_symbols(exchange)
        
        if not symbols:
            logger.warning(f"Still no symbols found for {exchange}")
            return {'gainers': [], 'losers': [], 'cached': False}

        logger.info(f"Found {len(symbols)} symbols for {exchange}")

        # Step 6: Fetch multiquotes
        logger.info(f"Fetching quotes for {len(symbols)} symbols from {broker_name}")
        try:
            # Convert symbols to required format
            symbol_list = [{'symbol': sym['symbol'], 'exchange': sym['exchange']} for sym in symbols]
            quotes_response = broker_data.get_multiquotes(symbol_list)
        except Exception as e:
            logger.exception(f"Error fetching multiquotes: {e}")
            # Try with fallback symbols if we have auth token issues
            if not auth_token and "auth" not in str(e).lower():
                logger.info("Trying with fallback common symbols")
                symbols = get_common_symbols(exchange)
                if symbols:
                    symbol_list = [{'symbol': sym['symbol'], 'exchange': sym['exchange']} for sym in symbols]
                    try:
                        quotes_response = broker_data.get_multiquotes(symbol_list)
                    except Exception as retry_e:
                        logger.exception(f"Retry failed: {retry_e}")
                        raise Exception(f"Failed to fetch quotes from broker: {str(retry_e)}")
                else:
                    raise Exception(f"Failed to fetch quotes from broker: {str(e)}")
            else:
                raise Exception(f"Failed to fetch quotes from broker: {str(e)}")

        if not quotes_response:
            logger.warning("No quotes data received from broker")
            return {'gainers': [], 'losers': [], 'cached': False}

        # Step 7: Calculate 1D P&L for each symbol
        logger.debug(f"Received quotes for {len(quotes_response)} symbols")
        movers_data = []

        for quote_item in quotes_response:
            try:
                # Handle both response formats
                if isinstance(quote_item, dict):
                    if 'data' in quote_item:
                        # Format: {symbol, exchange, data: {ltp, prev_close, ...}}
                        symbol = quote_item.get('symbol')
                        exchange_code = quote_item.get('exchange')
                        quote_data = quote_item.get('data', {})
                    else:
                        # Skip if no data
                        continue
                else:
                    continue

                ltp = quote_data.get('ltp', 0)
                prev_close = quote_data.get('prev_close', 0)
                volume = quote_data.get('volume', 0)

                if not prev_close or prev_close == 0:
                    logger.debug(f"Skipping {symbol}: no prev_close data")
                    continue

                # Calculate 1D change
                change_amount = ltp - prev_close
                change_percent = (change_amount / prev_close) * 100

                movers_data.append({
                    'symbol': symbol,
                    'exchange': exchange_code,
                    'ltp': round(ltp, 2),
                    'prev_close': round(prev_close, 2),
                    'change_amount': round(change_amount, 2),
                    'change_percent': round(change_percent, 2),
                    'volume': int(volume),
                })

            except Exception as e:
                logger.debug(f"Error processing quote for {quote_item}: {e}")
                continue

        if not movers_data:
            logger.warning("No valid quotes data after processing")
            return {'gainers': [], 'losers': [], 'cached': False}

        logger.info(f"Processed {len(movers_data)} symbols for P&L calculation")

        # Step 8: Sort by % change
        sorted_movers = sorted(movers_data, key=lambda x: x['change_percent'], reverse=True)

        # Step 9: Extract top gainers and losers
        gainers = sorted_movers[:limit]
        losers = sorted_movers[-limit:][::-1]  # Reverse to show biggest losers first

        # Step 10: Cache results
        try:
            save_movers_cache(exchange, gainers, losers)
        except Exception as e:
            logger.exception(f"Error saving cache: {e}")
            # Continue anyway, cache is not critical

        logger.info(f"Successfully fetched top {limit} gainers and losers for {exchange}")

        return {
            'gainers': gainers,
            'losers': losers,
            'cached': False,
        }

    except Exception as e:
        logger.exception(f"Error in get_top_movers: {e}")
        raise Exception(f"Error fetching top movers: {str(e)}")
