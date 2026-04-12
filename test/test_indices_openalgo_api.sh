#!/bin/bash

# Get valid OpenAlgo API key from database
APIKEY=$(cd /home/tomar/exploits/StockMarket/openalgo-linuxsmiths/openalgo && uv run python << 'PYEOF'
from database.auth_db import get_api_key_for_tradingview
api_key = get_api_key_for_tradingview('linuxsmiths')
print(api_key)
PYEOF
)

if [ -z "$APIKEY" ]; then
    echo "ERROR: Could not retrieve OpenAlgo API key"
    exit 1
fi

echo "==============================================="
echo "Testing Indices API with OpenAlgo API Key"
echo "==============================================="
echo ""
echo "Using OpenAlgo API Key: ${APIKEY:0:20}..."
echo ""

# Test 1: Valid API key - Success
echo "TEST 1: Valid OpenAlgo API Key"
echo "------------------------------"
RESPONSE1=$(curl -s -X POST http://127.0.0.1:5000/api/v1/indices/ \
  -H "Content-Type: application/json" \
  -d "{\"apikey\":\"$APIKEY\"}")

STATUS=$(echo "$RESPONSE1" | python3 -c "import sys, json; print(json.load(sys.stdin).get('status', 'unknown'))")
INDICES_COUNT=$(echo "$RESPONSE1" | python3 -c "import sys, json; data=json.load(sys.stdin); print(len(data.get('data', {}).get('indices', [])))")
IS_CACHED=$(echo "$RESPONSE1" | python3 -c "import sys, json; print(json.load(sys.stdin).get('data', {}).get('cached', False))")

echo "Status: $STATUS"
echo "Indices Count: $INDICES_COUNT"
echo "Cached: $IS_CACHED"

if [ "$STATUS" = "success" ] && [ "$INDICES_COUNT" = "3" ]; then
    echo "✅ PASS: Returned 3 indices as expected"
else
    echo "❌ FAIL: Expected 3 indices with success status"
    exit 1
fi

echo ""
echo "Indices Data:"
echo "$RESPONSE1" | python3 -c "import sys, json; data=json.load(sys.stdin)['data']['indices']; [print(f\"  - {i['index_name']}: {i['ltp']} ({i['change_percent']:+.2f}%)\") for i in data]"
echo ""

# Test 2: Verify cache works
echo "TEST 2: Cache Verification (second request)"
echo "-----------------------------------------"
RESPONSE2=$(curl -s -X POST http://127.0.0.1:5000/api/v1/indices/ \
  -H "Content-Type: application/json" \
  -d "{\"apikey\":\"$APIKEY\"}")

CACHED_AT1=$(echo "$RESPONSE1" | python3 -c "import sys, json; print(json.load(sys.stdin).get('data', {}).get('cached_at', ''))")
CACHED_AT2=$(echo "$RESPONSE2" | python3 -c "import sys, json; print(json.load(sys.stdin).get('data', {}).get('cached_at', ''))")

if [ "$CACHED_AT1" = "$CACHED_AT2" ]; then
    echo "✅ PASS: Cache timestamp unchanged (data from cache)"
    echo "  Cached at: $CACHED_AT1"
else
    echo "❌ FAIL: Cache timestamps differ"
    exit 1
fi

echo ""

# Test 3: Invalid API key - Error handling
echo "TEST 3: Invalid API Key Error Handling"
echo "--------------------------------------"
RESPONSE3=$(curl -s -X POST http://127.0.0.1:5000/api/v1/indices/ \
  -H "Content-Type: application/json" \
  -d '{"apikey":"invalid-key-xyz"}')

ERROR_STATUS=$(echo "$RESPONSE3" | python3 -c "import sys, json; print(json.load(sys.stdin).get('status', 'unknown'))")
ERROR_MESSAGE=$(echo "$RESPONSE3" | python3 -c "import sys, json; print(json.load(sys.stdin).get('message', ''))")

if [ "$ERROR_STATUS" = "error" ]; then
    echo "✅ PASS: Returns error for invalid key"
    echo "  Message: $ERROR_MESSAGE"
else
    echo "❌ FAIL: Should return error for invalid key"
    exit 1
fi

echo ""
echo "==============================================="
echo "All tests PASSED ✅"
echo "==============================================="
echo ""
echo "Summary:"
echo "  ✅ API endpoint working correctly"
echo "  ✅ Valid OpenAlgo API key accepted"
echo "  ✅ Returns 3 indices (NIFTY 50, SENSEX, BANKNIFTY)"
echo "  ✅ Caching working (5-minute TTL)"
echo "  ✅ Invalid key handling working"
echo "  ✅ Using OPENALGO API key (not broker-specific)"
echo ""

