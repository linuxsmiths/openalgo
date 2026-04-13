"""
Indices API Endpoint
REST API for fetching current index data
"""

import os
from flask import request
from flask_restx import Namespace, Resource, fields
from marshmallow import Schema, fields as ma_fields, ValidationError

from limiter import limiter
from services.indices_service import get_indices
from utils.logging import get_logger

API_RATE_LIMIT = os.getenv("API_RATE_LIMIT", "10 per minute")
api = Namespace("indices", description="Indices API")
logger = get_logger(__name__)


class IndicesSchema(Schema):
    """Schema for indices request"""
    apikey = ma_fields.Str(required=True)


schema = IndicesSchema()


# Response models for Swagger
index_model = api.model(
    'Index',
    {
        'index_name': fields.String(description='Index name', example='NIFTY 50'),
        'symbol': fields.String(description='Index symbol', example='NIFTY'),
        'exchange': fields.String(description='Exchange', example='NSE_INDEX'),
        'ltp': fields.Float(description='Last traded price'),
        'prev_close': fields.Float(description='Previous close price'),
        'change_amount': fields.Float(description='Absolute change'),
        'change_percent': fields.Float(description='Percentage change'),
    },
)

indices_response_model = api.model(
    'IndicesResponse',
    {
        'status': fields.String(description='Response status', example='success'),
        'data': fields.Nested(
            api.model(
                'IndicesData',
                {
                    'indices': fields.List(fields.Nested(index_model), description='List of indices'),
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
class Indices(Resource):
    """Indices Endpoint - Works with all brokers via unified OpenAlgo API"""

    @limiter.limit(API_RATE_LIMIT)
    @api.doc(description='Get current index quotes. Universal endpoint - works with all brokers')
    @api.expect(
        api.model(
            'IndicesRequest',
            {
                'apikey': fields.String(required=True, description='API Key'),
            },
        )
    )
    @api.response(200, 'Success', indices_response_model)
    @api.response(400, 'Bad Request')
    @api.response(401, 'Unauthorized')
    @api.response(500, 'Internal Server Error')
    def post(self):
        """Fetch current index quotes"""
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

            logger.info(f"Indices request from API key")

            # Validate API key
            from database.auth_db import verify_api_key, get_auth_token_broker
            user_id = verify_api_key(apikey)
            if not user_id:
                return {
                    'status': 'error',
                    'message': 'Invalid or expired API key',
                    'auth_error': True,
                }, 401
            
            # Check if broker session is still valid
            auth_token, broker_name = get_auth_token_broker(apikey)
            if not broker_name or not auth_token:
                return {
                    'status': 'error',
                    'message': 'Broker session expired. Please re-authenticate.',
                    'auth_error': True,
                }, 401

            # Fetch indices data
            result = get_indices(apikey)

            return {
                'status': 'success',
                'data': {
                    'indices': result.get('indices', []),
                    'cached': result.get('cached', False),
                    'cached_at': result.get('cached_at'),
                },
                'message': f"Fetched {len(result.get('indices', []))} indices",
            }, 200

        except Exception as e:
            logger.exception(f"Error in Indices endpoint: {e}")
            return {
                'status': 'error',
                'message': f"Error fetching indices: {str(e)}",
            }, 500
