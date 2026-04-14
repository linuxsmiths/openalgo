"""
Watchlist API Endpoints
REST API for managing user watchlists and fetching watchlist quotes
"""

import importlib
from flask import request
from flask_restx import Namespace, Resource, fields
from database.auth_db import verify_api_key, get_auth_token_broker
from database import watchlist_db
from services import symbol_search_service
from services.broker_error_utils import is_broker_auth_error, revoke_broker_session_for_api_key
from utils.logging import get_logger

logger = get_logger(__name__)

watchlist_ns = Namespace('watchlist', description='Watchlist management')

def import_broker_module(broker_name: str):
    """Dynamically import broker-specific data module"""
    try:
        module_path = f"broker.{broker_name}.api.data"
        broker_module = importlib.import_module(module_path)
        return broker_module
    except ImportError as error:
        logger.exception(f"Error importing broker module '{module_path}': {error}")
        return None


# Response models
watchlist_symbol_model = watchlist_ns.model('WatchlistSymbol', {
    'symbol': fields.String(required=True),
    'exchange': fields.String(required=True),
    'ltp': fields.Float(),
    'change_amount': fields.Float(),
    'change_percent': fields.Float(),
    'bid': fields.Float(),
    'ask': fields.Float(),
    'volume': fields.Float(),
    'created_at': fields.String(),
})

watchlist_response_model = watchlist_ns.model('WatchlistResponse', {
    'status': fields.String(),
    'message': fields.String(),
    'data': fields.List(fields.Nested(watchlist_symbol_model)),
})

search_result_model = watchlist_ns.model('SearchResult', {
    'symbol': fields.String(),
    'exchange': fields.String(),
    'name': fields.String(),
    'company_name': fields.String(),
})


@watchlist_ns.route('/add')
class AddToWatchlist(Resource):
    """Add a symbol to user's watchlist"""
    
    def post(self):
        """
        Add symbol to watchlist
        
        Request body:
        {
            "apikey": "user_api_key",
            "symbol": "SBIN",
            "exchange": "NSE"  # optional, default: NSE
        }
        """
        try:
            data = request.get_json() or {}
            apikey = data.get('apikey')
            symbol = data.get('symbol', '').upper()
            exchange = data.get('exchange', 'NSE').upper()
            
            if not apikey:
                return ({
                    'status': 'error',
                    'message': 'API key is required'
                }), 400
            
            if not symbol:
                return ({
                    'status': 'error',
                    'message': 'Symbol is required'
                }), 400
            
            # Verify API key and get user_id
            user_id = verify_api_key(apikey)
            if not user_id:
                return ({
                    'status': 'error',
                    'message': 'Invalid API key'
                }), 401
            
            # Add to watchlist (symbol validation happens during get_multiquotes)
            result = watchlist_db.add_symbol_to_watchlist(user_id, symbol, exchange)
            
            if result['status'] == 'error':
                return result, 400
            
            return result, 200
        
        except Exception as e:
            logger.error(f"Error adding to watchlist: {e}")
            return ({
                'status': 'error',
                'message': f'Server error: {str(e)}'
            }), 500


@watchlist_ns.route('/remove/<string:symbol>')
class RemoveFromWatchlist(Resource):
    """Remove a symbol from user's watchlist"""
    
    def delete(self, symbol):
        """
        Remove symbol from watchlist
        
        Query params:
        - apikey: user_api_key
        - exchange: exchange type (optional, default: NSE)
        """
        try:
            apikey = request.args.get('apikey')
            exchange = request.args.get('exchange', 'NSE').upper()
            symbol = symbol.upper()
            
            if not apikey:
                return ({
                    'status': 'error',
                    'message': 'API key is required'
                }), 400
            
            # Verify API key
            user_id = verify_api_key(apikey)
            if not user_id:
                return ({
                    'status': 'error',
                    'message': 'Invalid API key'
                }), 401
            
            # Remove from watchlist
            result = watchlist_db.remove_symbol_from_watchlist(user_id, symbol, exchange)
            
            if result['status'] == 'error':
                return result, 400
            
            return result, 200
        
        except Exception as e:
            logger.error(f"Error removing from watchlist: {e}")
            return ({
                'status': 'error',
                'message': f'Server error: {str(e)}'
            }), 500


@watchlist_ns.route('')
class GetWatchlist(Resource):
    """Get user's watchlist with current quotes"""
    
    def get(self):
        """
        Get watchlist with live quotes
        
        Query params:
        - apikey: user_api_key
        """
        try:
            apikey = request.args.get('apikey')
            
            if not apikey:
                return ({
                    'status': 'error',
                    'message': 'API key is required'
                }), 400
            
            # Verify API key and get user_id
            user_id = verify_api_key(apikey)
            if not user_id:
                return ({
                    'status': 'error',
                    'message': 'Invalid API key'
                }), 401
            
            # Get watchlist symbols for this user
            symbols = watchlist_db.get_watchlist_symbols(user_id)
            
            if not symbols:
                return ({
                    'status': 'success',
                    'message': 'Watchlist is empty',
                    'data': []
                }), 200
            
            # Get broker auth token using API key
            auth_token, broker_name = get_auth_token_broker(apikey)
            if not broker_name or not auth_token:
                return ({
                    'status': 'error',
                    'message': 'Broker session expired. Please re-authenticate.',
                    'auth_error': True,
                }), 401
            
            # Import broker module
            broker_module = import_broker_module(broker_name)
            if not broker_module:
                return ({
                    'status': 'error',
                    'message': f'Broker {broker_name} not supported'
                }), 503
            
            # Get BrokerData class
            BrokerData = getattr(broker_module, 'BrokerData', None)
            if not BrokerData:
                return ({
                    'status': 'error',
                    'message': 'Broker data handler not found'
                }), 503
            
            # Initialize broker and fetch quotes
            broker_data = BrokerData(auth_token)
            
            # Build symbol list for broker (as dicts, not strings)
            instruments = [{'symbol': sym['symbol'], 'exchange': sym['exchange']} for sym in symbols]
            
            # Fetch quotes
            try:
                quotes_data = broker_data.get_multiquotes(instruments)
            except Exception as e:
                error_msg = str(e)
                # Check if it's an authentication error
                if is_broker_auth_error(error_msg):
                    revoke_broker_session_for_api_key(apikey, error_msg)
                    return ({
                        'status': 'error',
                        'message': 'Broker session expired. Please re-authenticate.',
                        'auth_error': True,
                    }), 401
                # Other errors
                return ({
                    'status': 'error',
                    'message': f'Error fetching quotes: {error_msg}'
                }), 500
            
            if not quotes_data:
                return ({
                    'status': 'success',
                    'message': 'No quotes available',
                    'data': []
                }), 200
            
            # Format response
            watchlist_items = []
            for quote in quotes_data:
                if quote:
                    # Extract data from nested 'data' key (broker format)
                    quote_data = quote.get('data', {})
                    ltp = float(quote_data.get('ltp', 0)) if quote_data.get('ltp') else 0
                    prev_close = float(quote_data.get('prev_close', 0)) if quote_data.get('prev_close') else 0
                    
                    # Calculate change amount and percent
                    change_amount = ltp - prev_close if prev_close else 0
                    change_percent = ((ltp - prev_close) / prev_close * 100) if prev_close else 0
                    
                    # Extract depth data
                    depth = quote_data.get('depth', {})
                    buy_orders = depth.get('buy', [])
                    sell_orders = depth.get('sell', [])
                    
                    # Calculate total buyers/sellers
                    total_buy_quantity = sum(order.get('quantity', 0) for order in buy_orders)
                    total_sell_quantity = sum(order.get('quantity', 0) for order in sell_orders)
                    total_buy_orders = sum(order.get('orders', 0) for order in buy_orders)
                    total_sell_orders = sum(order.get('orders', 0) for order in sell_orders)
                    
                    watchlist_items.append({
                        'symbol': quote.get('symbol', ''),
                        'exchange': quote.get('exchange', 'NSE'),
                        'ltp': ltp,
                        'change_amount': change_amount,
                        'change_percent': change_percent,
                        'bid': float(quote_data.get('bid', 0)) if quote_data.get('bid') else 0,
                        'ask': float(quote_data.get('ask', 0)) if quote_data.get('ask') else 0,
                        'volume': float(quote_data.get('volume', 0)) if quote_data.get('volume') else 0,
                        # Day high/low/open
                        'high': float(quote_data.get('high', 0)) if quote_data.get('high') else 0,
                        'low': float(quote_data.get('low', 0)) if quote_data.get('low') else 0,
                        'open': float(quote_data.get('open', 0)) if quote_data.get('open') else 0,
                        # Market depth
                        'depth': {
                            'buy': buy_orders,
                            'sell': sell_orders,
                        },
                        'total_buy_quantity': total_buy_quantity,
                        'total_sell_quantity': total_sell_quantity,
                        'total_buy_orders': total_buy_orders,
                        'total_sell_orders': total_sell_orders,
                        # 52-week high/low (to be calculated separately)
                        'week_52_high': 0,  # TODO: Calculate from historical data
                        'week_52_low': 0,   # TODO: Calculate from historical data
                    })
            
            return ({
                'status': 'success',
                'message': f'Fetched {len(watchlist_items)} symbols',
                'data': watchlist_items
            }), 200
        
        except Exception as e:
            logger.error(f"Error getting watchlist: {e}")
            return ({
                'status': 'error',
                'message': f'Server error: {str(e)}'
            }), 500


@watchlist_ns.route('/search')
class SearchSymbols(Resource):
    """Search for symbols"""
    
    def get(self):
        """
        Search for symbols by name or symbol
        
        Query params:
        - apikey: user API key (required to access master contract)
        - query: search term (required)
        - exchange: filter by exchange (optional, default: NSE)
        - limit: max results (optional, default: 20)
        """
        try:
            apikey = request.args.get('apikey')
            query = request.args.get('query', '').strip().upper()
            exchange = request.args.get('exchange', 'NSE').upper()
            limit = min(int(request.args.get('limit', 20)), 50)
            
            if not apikey:
                return ({
                    'status': 'error',
                    'message': 'API key is required'
                }), 400
            
            if not query or len(query) < 1:
                return ({
                    'status': 'error',
                    'message': 'Search query is required'
                }), 400
            
            # Verify API key
            user_id = verify_api_key(apikey)
            if not user_id:
                return ({
                    'status': 'error',
                    'message': 'Invalid API key'
                }), 401
            
            # Get broker name from API key
            auth_token, broker_name = get_auth_token_broker(apikey)
            if not broker_name:
                return ({
                    'status': 'error',
                    'message': 'Broker not available'
                }), 503
            
            # Dynamically import broker's master contract module
            try:
                master_contract_module = importlib.import_module(
                    f"broker.{broker_name}.database.master_contract_db"
                )
                search_function = getattr(master_contract_module, 'search_symbols', None)
                if not search_function:
                    return ({
                        'status': 'error',
                        'message': f'Symbol search not available for {broker_name}'
                    }), 503
            except ImportError:
                return ({
                    'status': 'error',
                    'message': f'Broker {broker_name} not supported'
                }), 503
            
            # Search symbols using broker's master contract
            try:
                results = search_function(query, exchange)
                
                # Close the database session to return connection to pool
                db_session = getattr(master_contract_module, 'db_session', None)
                if db_session:
                    db_session.close()
                
                # Format results - convert to dict immediately to avoid using closed session
                formatted_results = []
                for result in results[:limit]:
                    formatted_results.append({
                        'symbol': str(getattr(result, 'symbol', '')),
                        'exchange': str(getattr(result, 'exchange', exchange)),
                        'name': str(getattr(result, 'name', '')),
                        'company_name': str(getattr(result, 'name', '')),
                    })
                
                return ({
                    'status': 'success',
                    'message': f'Found {len(formatted_results)} results',
                    'data': formatted_results
                }), 200
            
            except Exception as search_error:
                logger.error(f"Error during symbol search: {search_error}")
                # Try to close session on error too
                db_session = getattr(master_contract_module, 'db_session', None)
                if db_session:
                    try:
                        db_session.close()
                    except:
                        pass
                return ({
                    'status': 'error',
                    'message': 'Symbol search failed'
                }), 503
        
        except Exception as e:
            logger.error(f"Error in search endpoint: {e}")
            return ({
                'status': 'error',
                'message': f'Server error: {str(e)}'
            }), 500


@watchlist_ns.route('/clear')
class ClearWatchlist(Resource):
    """Clear entire watchlist"""
    
    def delete(self):
        """
        Clear all symbols from watchlist
        
        Query params:
        - apikey: user_api_key
        """
        try:
            apikey = request.args.get('apikey')
            
            if not apikey:
                return ({
                    'status': 'error',
                    'message': 'API key is required'
                }), 400
            
            # Verify API key
            user_id = verify_api_key(apikey)
            if not user_id:
                return ({
                    'status': 'error',
                    'message': 'Invalid API key'
                }), 401
            
            # Clear watchlist
            result = watchlist_db.clear_user_watchlist(user_id)
            
            return result, 200
        
        except Exception as e:
            logger.error(f"Error clearing watchlist: {e}")
            return ({
                'status': 'error',
                'message': f'Server error: {str(e)}'
            }), 500
