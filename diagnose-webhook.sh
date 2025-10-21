#!/bin/bash

# Webhook Diagnostic Script
# This script helps diagnose why webhooks aren't being received

echo "🔍 Webhook Setup Diagnostic"
echo "=============================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check 1: Environment Variables
echo "1️⃣ Checking Environment Variables..."
if [ -z "$WHOP_API_KEY" ]; then
    echo -e "${RED}❌ WHOP_API_KEY is not set${NC}"
else
    echo -e "${GREEN}✅ WHOP_API_KEY is set${NC}"
fi

if [ -z "$WHOP_WEBHOOK_SECRET" ]; then
    echo -e "${YELLOW}⚠️  WHOP_WEBHOOK_SECRET is not set (webhooks will work but without verification)${NC}"
else
    echo -e "${GREEN}✅ WHOP_WEBHOOK_SECRET is set${NC}"
fi

if [ -z "$NEXT_PUBLIC_WHOP_APP_ID" ]; then
    echo -e "${RED}❌ NEXT_PUBLIC_WHOP_APP_ID is not set${NC}"
else
    echo -e "${GREEN}✅ NEXT_PUBLIC_WHOP_APP_ID is set${NC}"
fi

if [ -z "$HEYGEN_API_KEY" ]; then
    echo -e "${RED}❌ HEYGEN_API_KEY is not set${NC}"
else
    echo -e "${GREEN}✅ HEYGEN_API_KEY is set${NC}"
fi

echo ""

# Check 2: Get app URL
echo "2️⃣ Detecting App URL..."
if [ -n "$REPLIT_DEV_DOMAIN" ]; then
    APP_URL="https://${REPLIT_DEV_DOMAIN}"
    echo -e "${GREEN}✅ Found Replit domain: $APP_URL${NC}"
else
    echo -e "${YELLOW}⚠️  REPLIT_DEV_DOMAIN not set. Using localhost...${NC}"
    APP_URL="http://localhost:5000"
fi

WEBHOOK_URL="${APP_URL}/api/whop/webhook"
TEST_URL="${APP_URL}/api/whop/webhook/test"

echo "   Webhook URL: $WEBHOOK_URL"
echo ""

# Check 3: Test endpoint accessibility
echo "3️⃣ Testing Webhook Endpoint Accessibility..."
echo "   Testing: $TEST_URL"

HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$TEST_URL" 2>/dev/null)

if [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}✅ Webhook endpoint is accessible (HTTP $HTTP_CODE)${NC}"
    curl -s "$TEST_URL" | jq . 2>/dev/null || curl -s "$TEST_URL"
else
    echo -e "${RED}❌ Webhook endpoint is NOT accessible (HTTP $HTTP_CODE)${NC}"
    echo "   Make sure your app is running!"
fi

echo ""

# Check 4: Test POST to webhook (simulated)
echo "4️⃣ Testing Webhook POST Endpoint..."
echo "   Sending test POST request..."

RESPONSE=$(curl -s -X POST "$WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "membership_went_valid",
    "data": {
      "id": "mem_test",
      "user_id": "user_test",
      "status": "valid",
      "status_reason": "test"
    }
  }' 2>/dev/null)

if echo "$RESPONSE" | grep -q "success"; then
    echo -e "${GREEN}✅ Webhook endpoint accepted POST request${NC}"
    echo "   Response: $RESPONSE"
else
    echo -e "${YELLOW}⚠️  Webhook response: $RESPONSE${NC}"
fi

echo ""

# Check 5: Instructions
echo "5️⃣ Next Steps:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📋 Your webhook URL for Whop Dashboard:"
echo -e "${GREEN}$WEBHOOK_URL${NC}"
echo ""
echo "To configure in Whop:"
echo "1. Go to: https://whop.com/apps"
echo "2. Select your app"
echo "3. Go to Webhooks section"
echo "4. Add webhook with URL: $WEBHOOK_URL"
echo "5. Select events: membership_went_valid, app_membership_went_valid"
echo "6. Enable the webhook"
echo "7. Copy the webhook secret to your environment as WHOP_WEBHOOK_SECRET"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check 6: Test Whop API connectivity
echo "6️⃣ Testing Whop API Connection..."
if [ -n "$WHOP_API_KEY" ]; then
    echo "   Making test API call to Whop..."
    
    API_TEST=$(curl -s -w "\nHTTP_CODE:%{http_code}" \
      "https://api.whop.com/api/v5/me" \
      -H "Authorization: Bearer $WHOP_API_KEY" 2>/dev/null)
    
    HTTP_CODE=$(echo "$API_TEST" | grep "HTTP_CODE" | cut -d: -f2)
    
    if [ "$HTTP_CODE" = "200" ]; then
        echo -e "${GREEN}✅ Whop API connection successful${NC}"
    else
        echo -e "${RED}❌ Whop API connection failed (HTTP $HTTP_CODE)${NC}"
        echo "   Check your WHOP_API_KEY"
    fi
else
    echo -e "${YELLOW}⚠️  Skipping (WHOP_API_KEY not set)${NC}"
fi

echo ""
echo "✅ Diagnostic Complete!"
echo ""
echo "📄 Full instructions: See WEBHOOK_SETUP_INSTRUCTIONS.md"
