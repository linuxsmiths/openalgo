"""
Indices Service
Business logic for fetching and calculating index data
"""

import importlib
from typing import Any, Dict, List

from database.auth_db import get_auth_token_broker
from database.indices_cache_db import get_cached_indices, save_indices_cache
from utils.logging import get_logger

logger = get_logger(__name__)


def import_broker_module(broker_name: str):
    """Dynamically import broker-specific data module"""
    try:
        module_path = f"broker.{broker_name}.api.data"
        broker_module = importlib.import_module(module_path)
        return broker_module
    except ImportError as error:
        logger.exception(f"Error importing broker module '{module_path}': {error}")
        return None


def get_indices(api_key: str) -> Dict[str, Any]:
    """
    Get current quotes for key indices
    
    Args:
        api_key: OpenAlgo API key (for broker auth)
    
    Returns:
        Dictionary with indices data
    """
    try:
        # Skip cache for indices - need real-time data for banner
        # (Uncomment below to enable 5-min caching if needed)
        # cached = get_cached_indices(max_age_minutes=5)
        # if cached:
        #     logger.info("Returning cached indices data")
        #     return {
        #         'indices': cached['indices'],
        #         'cached': True,
        #         'cached_at': cached['cached_at'],
        #     }

        logger.info("Fetching fresh indices data")

        # Step 2: Get broker and auth token using API key
        auth_token, broker_name = get_auth_token_broker(api_key)
        
        if not broker_name or not auth_token:
            logger.warning("No valid auth token for API key")
            return {'indices': [], 'cached': False}

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

        # Step 5: Define indices to fetch
        # Format: (index_name, symbol, exchange)
        # These indices are universally supported across all brokers:
        # - NSE_INDEX and BSE_INDEX are standard exchange types in OpenAlgo
        # - All brokers (Angel, Kotak, CompositeEdge, etc.) have index data in master contracts
        # - Using unified get_multiquotes() API, not broker-specific calls
        all_indices = [
            ('NIFTY 50', 'NIFTY', 'NSE_INDEX'),
            ('SENSEX', 'SENSEX', 'BSE_INDEX'),
            ('BANKNIFTY', 'BANKNIFTY', 'NSE_INDEX'),
            ('NIFTY 100', 'NIFTY100', 'NSE_INDEX'),
            ('NIFTY NEXT 50', 'NIFTYNXT50', 'NSE_INDEX'),
            ('NIFTY AUTO', 'NIFTYAUTO', 'NSE_INDEX'),
            ('NIFTY IT', 'NIFTYIT', 'NSE_INDEX'),
            ('NIFTY PHARMA', 'NIFTYPHARMA', 'NSE_INDEX'),
            ('FINNIFTY', 'FINNIFTY', 'NSE_INDEX'),
        ]

        # Step 6: Fetch quotes for indices using unified OpenAlgo API
        # This works with all brokers. If broker doesn't support indices, 
        # get_multiquotes() will handle gracefully (return empty or error logged)
        logger.info(f"Fetching quotes for {len(all_indices)} indices")
        try:
            symbol_list = [{'symbol': sym, 'exchange': exchange} for _, sym, exchange in all_indices]
            quotes_response = broker_data.get_multiquotes(symbol_list)
        except Exception as e:
            logger.exception(f"Error fetching index quotes: {e}")
            return {'indices': [], 'cached': False}

        if not quotes_response:
            logger.warning("No quotes data received from broker")
            return {'indices': [], 'cached': False}

        # Step 7: Process quotes and calculate daily change
        logger.debug(f"Processing {len(quotes_response)} index quotes")
        indices_data = []

        for i, quote_item in enumerate(quotes_response):
            try:
                if i >= len(all_indices):
                    break
                    
                index_name, symbol, exchange = all_indices[i]
                
                if isinstance(quote_item, dict):
                    if 'data' in quote_item:
                        quote_data = quote_item.get('data', {})
                    else:
                        continue
                else:
                    continue

                ltp = quote_data.get('ltp', 0)
                prev_close = quote_data.get('prev_close', 0)

                if not prev_close or prev_close == 0:
                    logger.debug(f"Skipping {index_name}: no prev_close data")
                    continue

                # Calculate daily change
                change_amount = ltp - prev_close
                change_percent = (change_amount / prev_close) * 100

                indices_data.append({
                    'index_name': index_name,
                    'symbol': symbol,
                    'exchange': exchange,
                    'ltp': round(ltp, 2),
                    'prev_close': round(prev_close, 2),
                    'change_amount': round(change_amount, 2),
                    'change_percent': round(change_percent, 2),
                })

            except Exception as e:
                logger.debug(f"Error processing index quote {i}: {e}")
                continue

        if not indices_data:
            logger.warning("No valid index quotes after processing")
            return {'indices': [], 'cached': False}

        logger.info(f"Processed {len(indices_data)} indices successfully")

        # Skip caching for real-time indices
        # (Uncomment below to enable 5-min caching if needed)
        # try:
        #     save_indices_cache(indices_data)
        # except Exception as e:
        #     logger.exception(f"Error saving cache: {e}")

        return {
            'indices': indices_data,
            'cached': False,
        }

    except Exception as e:
        logger.exception(f"Error in get_indices: {e}")
        raise Exception(f"Error fetching indices: {str(e)}")
