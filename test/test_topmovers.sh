#!/bin/bash

# Test script for Top Gainers/Losers API
# Usage: ./test_topmovers.sh [api_key]
# If no API key provided, fetches first available key from database

API_KEY="${1:-}"

# If no API key provided, try to fetch one from the database
if [ -z "$API_KEY" ]; then
  echo "Fetching first available API key from database..."
  API_KEY=$(cd /home/tomar/exploits/StockMarket/openalgo-linuxsmiths/openalgo && uv run python << 'PYTHON'
import sys
sys.path.insert(0, '/home/tomar/exploits/StockMarket/openalgo-linuxsmiths/openalgo')
from database.auth_db import get_first_available_api_key
key = get_first_available_api_key()
print(key)
PYTHON
)
fi

if [ -z "$API_KEY" ]; then
  echo "ERROR: No API key found. Please provide one as argument:"
  echo "  $0 <api_key>"
  exit 1
fi

echo "Testing Top Gainers/Losers API..."
echo "API Key: $API_KEY"
echo ""

echo "=== Test 1: NSE (limit 10) ==="
curl -s -X POST http://127.0.0.1:5000/api/v1/topmovers/ \
  -H "Content-Type: application/json" \
  -d "{\"apikey\": \"$API_KEY\", \"exchange\": \"NSE\", \"limit\": 10}" | python -m json.tool

echo ""
echo "=== Test 2: Cached Request (should return cached: true) ==="
curl -s -X POST http://127.0.0.1:5000/api/v1/topmovers/ \
  -H "Content-Type: application/json" \
  -d "{\"apikey\": \"$API_KEY\", \"exchange\": \"NSE\", \"limit\": 10}" | python -m json.tool

echo ""
echo "=== Test 3: BSE (limit 5) ==="
curl -s -X POST http://127.0.0.1:5000/api/v1/topmovers/ \
  -H "Content-Type: application/json" \
  -d "{\"apikey\": \"$API_KEY\", \"exchange\": \"BSE\", \"limit\": 5}" | python -m json.tool

echo ""
echo "=== Test 4: NFO (limit 3) ==="
curl -s -X POST http://127.0.0.1:5000/api/v1/topmovers/ \
  -H "Content-Type: application/json" \
  -d "{\"apikey\": \"$API_KEY\", \"exchange\": \"NFO\", \"limit\": 3}" | python -m json.tool
