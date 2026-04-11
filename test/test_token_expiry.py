#!/usr/bin/env python3
"""
Test script to simulate token expiration and verify error handling.
Directly tests the holdings_service without going through the API layer.
"""

import sys
import time

username = sys.argv[1] if len(sys.argv) > 1 else "linuxsmiths"

print(f"\n{'='*70}")
print(f"Token Expiry Test for user: {username}")
print(f"Direct Service Call Test")
print(f"{'='*70}\n")

# Step 1: Get user credentials
print("[STEP 1] Getting user auth token from database...")
from database.auth_db import Auth, decrypt_token, encrypt_token, get_auth_token_broker
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

try:
    engine = create_engine("sqlite:///db/openalgo.db")
    Session = sessionmaker(bind=engine)
    session = Session()

    auth_obj = session.query(Auth).filter_by(name=username).first()
    if not auth_obj:
        print(f"ERROR: No auth record found for user '{username}'")
        sys.exit(1)

    original_encrypted_token = auth_obj.auth
    original_token = decrypt_token(original_encrypted_token)
    broker = auth_obj.broker
    print(f"✓ Found user: {username} (broker: {broker})")
    print(f"✓ Token length: {len(original_token)}")
except Exception as e:
    print(f"ERROR: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

# Step 2: Test with valid token
print("\n[STEP 2] Testing get_holdings_with_auth with VALID token...")
try:
    from services.holdings_service import get_holdings_with_auth
    success, data, status_code = get_holdings_with_auth(original_token, broker)
    print(f"✓ Status: {status_code}")
    print(f"✓ Success: {success}")
    if success:
        print(f"✓ Holdings count: {len(data.get('data', {}).get('holdings', []))}")
    else:
        print(f"✓ Error: {data.get('message')[:100]}")
except Exception as e:
    print(f"ERROR: {e}")
    import traceback
    traceback.print_exc()

# Step 3: Corrupt the token
print("\n[STEP 3] Corrupting token in database...")
bad_token = "INVALID_TOKEN_" + "x" * 500
try:
    encrypted_bad_token = encrypt_token(bad_token)
    auth_obj.auth = encrypted_bad_token
    session.commit()
    print(f"✓ Token replaced with invalid token")
    print(f"  (Bad token length: {len(bad_token)})")
except Exception as e:
    print(f"ERROR: {e}")
    sys.exit(1)

# Step 4: Test with invalid token
print("\n[STEP 4] Testing get_holdings_with_auth with INVALID token...")
print("(This should detect the token error)")
try:
    success, data, status_code = get_holdings_with_auth(bad_token, broker)
    print(f"✓ Status: {status_code}")
    print(f"✓ Success: {success}")
    print(f"✓ Response: {data}")

    # Check for 401 and auth error flag
    if status_code == 401:
        print("\n✓✓✓ SUCCESS: Got 401 Unauthorized!")
    else:
        print(f"\n⚠ WARNING: Expected 401, got {status_code}")

    if data.get("auth_error"):
        print("✓✓✓ SUCCESS: auth_error flag is set!")
    else:
        print("⚠ WARNING: auth_error flag not set")

except Exception as e:
    print(f"ERROR: {e}")
    import traceback
    traceback.print_exc()

# Step 5: Restore original token
print("\n[STEP 5] Restoring original token...")
try:
    auth_obj.auth = original_encrypted_token
    session.commit()
    print(f"✓ Original token restored")
except Exception as e:
    print(f"ERROR: {e}")
    sys.exit(1)

# Step 6: Verify original token works again
print("\n[STEP 6] Verifying original token works again...")
try:
    success, data, status_code = get_holdings_with_auth(original_token, broker)
    print(f"✓ Status: {status_code}")
    print(f"✓ Success: {success}")
    if success:
        print(f"✓ Holdings count: {len(data.get('data', {}).get('holdings', []))}")
    else:
        print(f"Note: {data.get('message')[:100]}")
except Exception as e:
    print(f"ERROR: {e}")

print(f"\n{'='*70}")
print("Test Complete!")
print(f"{'='*70}\n")
