# Webhook Debugging Guide - Why You're Not Receiving Webhooks

## 🔍 Current Situation

You enabled all webhook events including:
- ✅ `membership_went_valid`
- ✅ `app_membership_went_valid`

But when someone joins, you're **NOT receiving any webhook**.

---

## 🐛 Common Causes & Solutions

### 1. **Webhook URL Not Publicly Accessible**

Whop can only send webhooks to **public HTTPS URLs**.

**Check:**
```bash
# Test if your webhook endpoint is accessible from the internet
curl https://your-app-url.replit.app/api/whop/webhook/test
```

**Expected Response:**
```json
{
  "status": "Webhook endpoint is accessible",
  "webhookUrl": "/api/whop/webhook"
}
```

**If it fails:**
- ❌ Your Replit app is not running
- ❌ App is in development mode (not deployed)
- ❌ Firewall blocking incoming requests

**Solution:**
1. Make sure your Replit is **deployed** (not just running in dev mode)
2. Use the deployment URL, not localhost
3. Verify HTTPS (HTTP won't work with Whop)

---

### 2. **Wrong Webhook URL Format**

**Check your Whop webhook configuration:**

❌ **WRONG:**
- `http://localhost:5000/api/whop/webhook` (localhost doesn't work)
- `https://your-app.replit.app/webhook` (missing `/api/whop/`)
- `https://your-app.replit.app/api/webhook` (missing `/whop/`)

✅ **CORRECT:**
- `https://your-app-name.replit.app/api/whop/webhook`

---

### 3. **Webhook Signature Verification Failing**

Your app verifies webhook signatures. If the signature doesn't match, the webhook is **rejected silently**.

**Check your logs for:**
```
Invalid Whop webhook signature
```

**Solution:**
1. Go to Whop Dashboard → Webhooks
2. Copy the **Webhook Secret** (looks like `ws_...`)
3. Set it as environment variable: `WHOP_WEBHOOK_SECRET=ws_...`
4. Restart your app

**Or temporarily disable signature verification:**
```bash
# Remove WHOP_WEBHOOK_SECRET from your environment
# The app will skip verification and log a warning
```

---

### 4. **Webhook Not Configured At All**

**Verify webhook exists in Whop:**

1. Go to https://whop.com/dashboard/developer
2. Select your app
3. Go to **Webhooks** section
4. Check if you have a webhook configured

**If no webhook exists, create one:**

**Via Whop Dashboard:**
1. Click **Add Webhook**
2. **URL**: `https://your-app.replit.app/api/whop/webhook`
3. **Events**: Select `membership_went_valid` and `app_membership_went_valid`
4. **Enable** the webhook
5. Save

**Via API:**
```bash
curl --request POST \
  --url https://api.whop.com/api/v5/webhooks \
  --header 'Authorization: Bearer YOUR_WHOP_API_KEY' \
  --header 'Content-Type: application/json' \
  --data '{
    "url": "https://your-app.replit.app/api/whop/webhook",
    "events": ["membership_went_valid", "app_membership_went_valid"]
  }'
```

---

### 5. **Webhook Is Disabled**

Even if configured, the webhook might be **disabled**.

**Check:**
1. Go to Whop Dashboard → Webhooks
2. Look for a toggle switch next to your webhook
3. Make sure it's **ON/Enabled** (usually green)

---

### 6. **Wrong Company/App Context**

Webhooks are tied to a specific **company** or **app**.

**Check:**
- Is the webhook configured in the **same company** where someone is joining?
- Is your app **installed** in that company?

**Solution:**
1. Verify your app is installed in the company
2. Make sure webhook is configured for the correct app/company

---

### 7. **Webhook Deliveries Are Failing (Check Logs)**

Whop logs all webhook delivery attempts.

**Check webhook delivery logs:**
1. Go to Whop Dashboard → Webhooks
2. Click on your webhook
3. Look for **"Recent Deliveries"** or **"Delivery Log"**
4. Check for failed attempts with error messages

**Common errors:**
- `Connection timeout` → Your server is not responding
- `SSL error` → HTTPS certificate issue
- `401 Unauthorized` → Signature verification failing
- `500 Internal Server Error` → Your app is crashing

---

## 🧪 Step-by-Step Debugging

### Step 1: Verify Endpoint Accessibility

```bash
curl -X POST https://your-app.replit.app/api/whop/webhook \
  -H "Content-Type: application/json" \
  -d '{"action": "test", "data": {}}'
```

**Expected:** Your app logs should show:
```
=== WHOP WEBHOOK RECEIVED ===
📥 Received Whop webhook action: test
```

**If nothing shows:** Your endpoint is not accessible or app is not running.

---

### Step 2: Test with Whop's Test Button

1. Go to Whop Dashboard → Webhooks
2. Click on your webhook
3. Click **"Send Test Event"** or **"Test"**
4. Watch your server logs

**If you see the webhook in logs:** ✅ Webhooks work! The issue is with the event trigger.

**If nothing appears:** ❌ Configuration issue (URL, signature, etc.)

---

### Step 3: Temporarily Disable Signature Verification

Edit your environment variables:
```bash
# Remove or comment out:
# WHOP_WEBHOOK_SECRET=ws_...
```

This makes your app accept ANY webhook (for testing only).

**If webhooks now work:** The issue is signature verification.

**If still not working:** The issue is webhook configuration or accessibility.

---

### Step 4: Check Firewall/Network

Some hosting providers block incoming webhooks.

**Check:**
1. Is your Replit app publicly accessible?
2. Try accessing it from a different network
3. Check if there are any firewall rules

---

### Step 5: Enable All Related Events

In Whop Dashboard, enable BOTH:
- ✅ `membership_went_valid`
- ✅ `app_membership_went_valid`
- ✅ (Optional) `membership_experience_claimed`
- ✅ (Optional) `payment_succeeded`

Sometimes one fires when the other doesn't.

---

## 🔄 Alternative: Use Polling Instead of Webhooks

If webhooks just won't work, you can **poll for new members** instead:

### Add a polling service to check for new memberships:

```javascript
// Add this to your server/routes.ts

// Poll for new members every 60 seconds
setInterval(async () => {
  try {
    console.log("🔄 Polling for new members...");
    
    // Get all creators
    const creators = await storage.getAllCreators();
    
    for (const creator of creators) {
      if (!creator.isSetupComplete) continue;
      
      // Get recent memberships from Whop
      const memberships = await whopSdk.memberships.listMemberships({
        company_id: creator.whopCompanyId,
        // Only get memberships from last 5 minutes
        created_at: {
          gte: new Date(Date.now() - 5 * 60 * 1000).toISOString()
        }
      });
      
      for (const membership of memberships.data) {
        // Check if customer already exists
        const existingCustomer = await storage.getCustomerByWhopUserId(
          creator._id, 
          membership.user_id
        );
        
        if (!existingCustomer) {
          console.log(`📋 New member found via polling: ${membership.user_id}`);
          // Process new member (same logic as webhook)
          // ... trigger video generation
        }
      }
    }
  } catch (error) {
    console.error("Polling error:", error);
  }
}, 60000); // Every 60 seconds
```

**Pros:**
- ✅ Works even if webhooks fail
- ✅ No webhook configuration needed
- ✅ Reliable

**Cons:**
- ⚠️ Slight delay (up to 60 seconds)
- ⚠️ More API calls

---

## 📊 What to Check Right Now

Run through this checklist:

1. **App Running?**
   ```bash
   curl https://your-app.replit.app/api/whop/webhook/test
   ```
   ✅ Should return JSON response

2. **Webhook Configured?**
   - Go to Whop Dashboard → Webhooks
   - Verify webhook exists and is enabled

3. **Correct URL?**
   - Should be: `https://your-app.replit.app/api/whop/webhook`
   - Must include `/api/whop/webhook` path

4. **Events Selected?**
   - ✅ `membership_went_valid`
   - ✅ `app_membership_went_valid`

5. **Signature Secret Set?**
   - Check environment variable: `WHOP_WEBHOOK_SECRET`
   - Should match webhook secret in Whop Dashboard

6. **Check Recent Deliveries:**
   - Whop Dashboard → Webhooks → Your Webhook → Recent Deliveries
   - See if any attempts were made and what errors occurred

---

## 🆘 Quick Fix: Disable Signature Verification (Testing Only)

If you need to get it working RIGHT NOW:

1. **Remove `WHOP_WEBHOOK_SECRET` from environment variables**
2. **Restart your app**
3. **Test with a new member joining**

Your app will log:
```
⚠️ WHOP_WEBHOOK_SECRET not set - webhook signature verification skipped
```

This proves whether the issue is signature verification or something else.

**⚠️ Remember to add it back later for security!**

---

## 📝 What Information to Share

If still not working, share:

1. **Your webhook URL** (from Whop Dashboard)
2. **Screenshot of webhook configuration** in Whop
3. **Screenshot of "Recent Deliveries"** (if available)
4. **Server logs** when someone joins
5. **Result of:**
   ```bash
   curl https://your-app.replit.app/api/whop/webhook/test
   ```

This will help identify the exact issue!

---

## ✅ Expected Working Flow

When everything works correctly:

```
1. Someone joins your Whop
   ↓
2. Whop sends POST to: https://your-app.replit.app/api/whop/webhook
   ↓
3. Your app logs:
   === WHOP WEBHOOK RECEIVED ===
   📥 Received Whop webhook action: membership_went_valid
   ↓
4. Video generation triggers
   ↓
5. DM sent when complete
```

Let's get this working! 🚀
