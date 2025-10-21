#!/bin/bash

# Webhook Test Script
# Usage: ./test-webhook.sh https://your-app.replit.app

if [ -z "$1" ]; then
  echo "❌ Error: Please provide your app URL"
  echo "Usage: ./test-webhook.sh https://your-app.replit.app"
  exit 1
fi

APP_URL="$1"
WEBHOOK_URL="${APP_URL}/api/whop/webhook"

echo "🧪 Testing webhook endpoint: ${WEBHOOK_URL}"
echo ""
echo "================================================"
echo "Test 1: Check if endpoint is accessible"
echo "================================================"
curl -s "${APP_URL}/api/whop/webhook/test" | jq '.' || echo "❌ Endpoint not accessible or invalid JSON response"
echo ""

echo "================================================"
echo "Test 2: Send test membership_went_valid webhook"
echo "================================================"

# Sample webhook payload
PAYLOAD='{
  "action": "membership_went_valid",
  "data": {
    "id": "mem_test123",
    "user_id": "user_test123",
    "user": {
      "id": "user_test123",
      "username": "testuser",
      "email": "test@example.com",
      "name": "Test User"
    },
    "access_pass": {
      "name": "Test Plan",
      "id": "pass_test123"
    },
    "product_id": "prod_test123",
    "company_id": "biz_test123",
    "status": "active",
    "status_reason": "created"
  }
}'

echo "Sending payload:"
echo "$PAYLOAD" | jq '.'
echo ""

# Send the webhook (without signature for testing)
RESPONSE=$(curl -s -X POST "${WEBHOOK_URL}" \
  -H "Content-Type: application/json" \
  -d "${PAYLOAD}")

echo "Response:"
echo "$RESPONSE" | jq '.' || echo "$RESPONSE"
echo ""

echo "================================================"
echo "📋 Check your server logs now!"
echo "================================================"
echo "You should see:"
echo "  === WHOP WEBHOOK RECEIVED ==="
echo "  📥 Received Whop webhook action: membership_went_valid"
echo ""
echo "If you see these logs, your webhook endpoint is working!"
echo "If not, check:"
echo "  1. Is your app running?"
echo "  2. Is the URL correct?"
echo "  3. Check server logs for errors"
