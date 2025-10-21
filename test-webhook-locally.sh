#!/bin/bash

# Test webhook with realistic Whop payload
# This simulates what Whop sends when a new member joins

echo "🧪 Testing Webhook Endpoint with Realistic Payload"
echo "=================================================="
echo ""

WEBHOOK_URL="https://auto-welcome-syaj.onrender.com/api/whop/webhook"

echo "📡 Sending POST request to: $WEBHOOK_URL"
echo ""

# Test 1: membership_went_valid (most common event)
echo "Test 1: membership_went_valid event"
echo "------------------------------------"
curl -X POST "$WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -H "x-whop-signature: t=1234567890,v1=test_signature" \
  -d '{
    "action": "membership_went_valid",
    "data": {
      "id": "mem_test123",
      "user_id": "user_uXiBOjehkK37z",
      "status": "valid",
      "status_reason": "created",
      "company_id": "biz_EfM4YDzQmtSt1P",
      "user": {
        "id": "user_uXiBOjehkK37z",
        "username": "wahart",
        "email": "test@example.com"
      },
      "access_pass": {
        "name": "Test Membership"
      },
      "product_id": "prod_test123"
    }
  }' -w "\nHTTP Status: %{http_code}\n"

echo ""
echo ""

# Test 2: app_membership_went_valid (app-specific event)
echo "Test 2: app_membership_went_valid event"
echo "----------------------------------------"
curl -X POST "$WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -H "x-whop-signature: t=1234567890,v1=test_signature" \
  -d '{
    "action": "app_membership_went_valid",
    "data": {
      "id": "mem_test456",
      "user_id": "user_uXiBOjehkK37z",
      "status": "valid",
      "status_reason": "created",
      "company_id": "biz_EfM4YDzQmtSt1P",
      "user": {
        "id": "user_uXiBOjehkK37z",
        "username": "wahart"
      }
    }
  }' -w "\nHTTP Status: %{http_code}\n"

echo ""
echo ""

echo "✅ Tests Complete!"
echo ""
echo "📋 Check your Render logs to see if the webhooks were processed"
echo "Expected logs:"
echo "  - === WHOP WEBHOOK RECEIVED ==="
echo "  - 📥 Received Whop webhook action: membership_went_valid"
echo "  - New member joined: ..."
echo ""
echo "If you see these logs, your endpoint is working correctly!"
