"""
Top Movers API Endpoint
REST API for fetching top gainers and losers
"""

import os
from flask import request
from flask_restx import Namespace, Resource, fields
from marshmallow import Schema, fields as ma_fields, ValidationError

from limiter import limiter
from services.topmovers_service import get_top_movers
from utils.logging import get_logger

API_RATE_LIMIT = os.getenv("API_RATE_LIMIT", "10 per minute")
api = Namespace("topmovers", description="Top Movers API")
logger = get_logger(__name__)


class TopMoversSchema(Schema):
    """Schema for top movers request"""
    apikey = ma_fields.Str(required=True)
    exchange = ma_fields.Str(required=False, missing='NSE')
    limit = ma_fields.Int(required=False, missing=10)


schema = TopMoversSchema()


# Response models for Swagger
quote_model = api.model(
    'Quote',
    {
        'symbol': fields.String(description='Trading symbol', example='SBIN'),
        'exchange': fields.String(description='Exchange code', example='NSE'),
        'ltp': fields.Float(description='Last traded price'),
        'prev_close': fields.Float(description='Previous close price'),
        'change_amount': fields.Float(description='Absolute change'),
        'change_percent': fields.Float(description='Percentage change'),
        'volume': fields.Integer(description='Trading volume'),
    },
)

topmovers_response_model = api.model(
    'TopMoversResponse',
    {
        'status': fields.String(description='Response status', example='success'),
        'data': fields.Nested(
            api.model(
                'TopMoversData',
                {
                    'gainers': fields.List(fields.Nested(quote_model), description='Top gainers'),
                    'losers': fields.List(fields.Nested(quote_model), description='Top losers'),
                    'cached': fields.Boolean(description='Whether data is from cache'),
                    'cached_at': fields.String(description='Cache timestamp'),
                },
            ),
            description='Response data',
        ),
        'message': fields.String(description='Response message'),
    },
)


@api.route('/')
class TopMovers(Resource):
    """Top Movers Endpoint"""

    @limiter.limit(API_RATE_LIMIT)
    @api.doc(description='Get top gainers and losers for an exchange')
    @api.expect(
        api.model(
            'TopMoversRequest',
            {
                'apikey': fields.String(required=True, description='API Key'),
                'exchange': fields.String(
                    required=False,
                    description='Exchange code (NSE, BSE)',
                    example='NSE',
                    default='NSE',
                ),
                'limit': fields.Integer(
                    required=False,
                    description='Number of top movers',
                    example=10,
                    default=10,
                ),
            },
        )
    )
    @api.response(200, 'Success', topmovers_response_model)
    @api.response(400, 'Bad Request')
    @api.response(401, 'Unauthorized')
    @api.response(500, 'Internal Server Error')
    def post(self):
        """Fetch top gainers and losers"""
        try:
            # Parse and validate request
            data = request.get_json() or {}

            try:
                validated_data = schema.load(data)
            except ValidationError as err:
                return {
                    'status': 'error',
                    'message': f"Validation error: {err.messages}",
                }, 400

            apikey = validated_data.get('apikey')
            exchange = validated_data.get('exchange', 'NSE').upper()
            limit = min(validated_data.get('limit', 10), 100)  # Cap at 100

            logger.info(f"TopMovers request: exchange={exchange}, limit={limit}")

            # Validate exchange
            if exchange not in ['NSE', 'BSE', 'NFO']:
                return {
                    'status': 'error',
                    'message': f"Invalid exchange: {exchange}. Must be NSE, BSE, or NFO",
                }, 400

            # Validate API key
            from database.auth_db import verify_api_key
            user_id = verify_api_key(apikey)
            if not user_id:
                return {
                    'status': 'error',
                    'message': 'Invalid or expired API key',
                }, 401

            # Fetch top movers (pass API key, not username)
            result = get_top_movers(apikey, exchange=exchange, limit=limit)

            return {
                'status': 'success',
                'data': {
                    'gainers': result.get('gainers', []),
                    'losers': result.get('losers', []),
                    'cached': result.get('cached', False),
                    'cached_at': result.get('cached_at'),
                },
                'message': f"Fetched top {limit} gainers and losers for {exchange}",
            }, 200

        except Exception as e:
            logger.exception(f"Error in TopMovers endpoint: {e}")
            return {
                'status': 'error',
                'message': f"Error fetching top movers: {str(e)}",
            }, 500
