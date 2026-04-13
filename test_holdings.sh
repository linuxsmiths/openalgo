#!/bin/bash

# Get the API key for linuxsmiths user (encrypted)
API_KEY=$(sqlite3 db/openalgo.db "SELECT api_key_encrypted FROM api_keys WHERE user_id = 'linuxsmiths' LIMIT 1;")

if [ -z "$API_KEY" ]; then
  echo "Error: Could not find API key for user"
  exit 1
fi

echo "Testing holdings endpoint with API key..."
echo ""

# Test with API key in body
curl -X POST http://127.0.0.1:5000/api/v1/holdings \
  -H "Content-Type: application/json" \
  -d "{\"apikey\": \"$API_KEY\"}" \
  -s | python3 -m json.tool

echo ""
