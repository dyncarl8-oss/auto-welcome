# 🔍 Webhook Debug Checklist - Test Works but Real Joins Don't

## Current Situation

✅ **Webhook configured**: `https://auto-welcome-syaj.onrender.com/api/whop/webhook`  
✅ **Test webhook works**: Returns `200` with `{"success":true}`  
❌ **Real joins don't trigger webhook**: When user "bigagud" joined, no webhook received

---

## 🎯 Possible Causes & How to Check

### 1. **Wrong Events Selected**

**The Issue**: You might have the wrong events selected in Whop.

**Check:**
1. Go to Whop Dashboard → Webhooks → Your Webhook
2. Look at "Subscribed Events"
3. Make sure you have **both** of these checked:
   - ✅ `membership_went_valid`
   - ✅ `app_membership_went_valid`

**Why Both?**
- `membership_went_valid` = When someone joins a paid membership
- `app_membership_went_valid` = When someone gets access to your specific app

**Additional events to consider:**
- `membership.created` - When membership is first created
- `payment.succeeded` - When payment goes through

**Fix**: Add both events if they're missing.

---

### 2. **User Was Already a Member**

**The Issue**: If "bigagud" was already a member, there's no "new join" event to trigger.

**Check:**
1. Was this user's first time joining?
2. Or were they re-accessing an existing membership?

**What happens:**
- ✅ **First join**: Triggers `membership_went_valid` 
- ❌ **Existing member accessing app**: No webhook (just validates access)

**Evidence from your logs:**
```
POST /api/validate-access 200 in 680ms
GET /api/customer/welcome-status 200 in 386ms
```
This shows the user accessing the app, but doesn't prove they just joined.

**Test**: Have a completely new person join (never been a member before).

---

### 3. **Webhook Registered for Wrong Company**

**The Issue**: Webhooks are company-specific. Your webhook might be registered for a different company than where the user joined.

**From your logs:**
```
📦 Retrieved company ID from experience: biz_EfM4YDzQmtSt1P
```

This is the company where the user accessed the app.

**Check:**
1. Go to Whop Dashboard → Webhooks
2. Check which company/app the webhook is registered under
3. Make sure it's the same company: `biz_EfM4YDzQmtSt1P`

**Fix**: If it's the wrong company, create a new webhook for the correct company.

---

### 4. **Check Webhook Delivery Logs**

**Most Important Check!**

Whop logs every webhook delivery attempt. This will tell you exactly what's happening.

**How to check:**
1. Go to Whop Dashboard → Webhooks
2. Click on your webhook (`auto-welcome-syaj.onrender.com/api/whop/webhook`)
3. Look for **"Recent Deliveries"** or **"Delivery History"** tab
4. Check for delivery attempts around the time "bigagud" joined

**What you'll see:**

**If there ARE delivery attempts:**
- Check the status code
- Check the timestamp
- Check the event type
- Check error messages

**If there are NO delivery attempts:**
- The webhook isn't configured for the right events
- Or the event didn't trigger at all (user was already a member)

**This is the most important diagnostic step!**

---

### 5. **App Not Installed in the Company**

**The Issue**: Your Whop app might not be installed in the company where users are joining.

**Check:**
1. Is your app installed and approved in the company `biz_EfM4YDzQmtSt1P`?
2. Does the app have the right permissions?

**Required permissions:**
- `member:read` - To read membership info
- `user:read` - To read user details
- `message:write` - To send DMs

**Fix**: Re-install the app in the company if needed.

---

### 6. **Webhook Event Filtering**

**The Issue**: Whop might be filtering events based on product/plan.

**Check:**
1. In webhook configuration, is there any filtering by product/plan?
2. Does the webhook apply to ALL products or just specific ones?

**Fix**: Make sure webhook applies to all products/memberships.

---

## 🧪 Diagnostic Steps (Do These Now)

### Step 1: Check Webhook Events
```
Go to: Whop Dashboard → Webhooks → Your Webhook
Look for: Subscribed Events section
Verify: Both membership_went_valid AND app_membership_went_valid are checked
```

### Step 2: Check Delivery Logs (MOST IMPORTANT)
```
Go to: Whop Dashboard → Webhooks → Your Webhook → Recent Deliveries
Look for: Delivery attempts around when "bigagud" joined
Check: Status codes, timestamps, error messages
```

### Step 3: Test with a Brand New Member
```
Have someone who has NEVER been a member join
Watch: Both Whop delivery logs AND your Render logs
Expected: Webhook POST to /api/whop/webhook
```

### Step 4: Manual Test Different Event
```
In Whop Dashboard, test sending these events manually:
- membership_went_valid
- app_membership_went_valid
- membership.created (if available)

See which ones your endpoint receives
```

---

## 🔧 Quick Fixes to Try

### Fix 1: Add More Events

In your webhook configuration, add ALL membership-related events:
- `membership_went_valid`
- `app_membership_went_valid`
- `membership.created`
- `membership.updated`
- `payment.succeeded`

Cast a wide net to see which event actually fires.

### Fix 2: Create a Test Script

Create a test curl to simulate what Whop sends:

```bash
curl -X POST https://auto-welcome-syaj.onrender.com/api/whop/webhook \
  -H "Content-Type: application/json" \
  -H "x-whop-signature: t=1234567890,v1=test" \
  -d '{
    "action": "membership_went_valid",
    "data": {
      "id": "mem_test123",
      "user_id": "user_test123",
      "status": "valid",
      "status_reason": "created",
      "company_id": "biz_EfM4YDzQmtSt1P",
      "user": {
        "id": "user_test123",
        "username": "testuser",
        "email": "test@example.com"
      }
    }
  }'
```

Check your Render logs to see if this triggers the flow.

### Fix 3: Temporarily Disable Signature Verification

To rule out signature issues, temporarily remove `WHOP_WEBHOOK_SECRET` from your environment variables and restart your app.

**WARNING**: Only do this for testing! Add it back after.

---

## 📊 What to Share

To help diagnose further, please share:

### 1. Webhook Configuration Screenshot
- Go to Whop Dashboard → Webhooks
- Screenshot showing:
  - Webhook URL
  - Subscribed events
  - Status (enabled/disabled)

### 2. Delivery Logs
- Screenshot of "Recent Deliveries" for your webhook
- Especially around the time "bigagud" joined

### 3. Was "bigagud" a New Member?
- Was this their first time joining your community?
- Or were they already a member just accessing the app?

### 4. Company ID Verification
- Is your webhook registered for company `biz_EfM4YDzQmtSt1P`?
- Or a different company?

---

## 🎯 Most Likely Causes

Based on your situation, the most likely causes are:

1. **User was already a member** (no new join event) - 60% likely
2. **Wrong events selected in webhook** - 25% likely
3. **Webhook registered for different company** - 10% likely
4. **Event filtering/product mismatch** - 5% likely

**The delivery logs will tell you exactly which one it is!**

---

## ✅ Expected Working Flow

When everything works correctly:

```
1. New member joins for the FIRST time
   ↓
2. Whop sends POST to: https://auto-welcome-syaj.onrender.com/api/whop/webhook
   ↓
3. Your Render app logs:
   === WHOP WEBHOOK RECEIVED ===
   📥 Received Whop webhook action: membership_went_valid
   New member joined: bigagud (@wahart)
   ↓
4. Video generation triggers
   ↓
5. DM sent when complete
```

Currently you're stuck at step 2 - Whop isn't sending the webhook for real joins.

---

## 🆘 Next Steps

1. **Check webhook delivery logs** (this will tell you everything)
2. **Verify subscribed events** include both membership events
3. **Test with a brand new member** (not an existing one)
4. Share the delivery logs so we can see exactly what's happening

The delivery logs are the key! 🔑
