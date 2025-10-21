# 🔧 Webhook Setup Instructions - Step by Step

## Current Situation
Your webhook endpoint is working (proven by curl test), but Whop is not sending join events to it because the webhook hasn't been configured in Whop's dashboard.

---

## 🎯 Step-by-Step Fix

### Step 1: Get Your App URL

First, you need your public app URL. Check your Replit deployment URL:

1. Look at the top of your Replit workspace
2. Find the URL that looks like: `https://[your-project-name].[your-username].repl.co`
3. Or check your deployment/webview URL

**Your webhook URL will be:**
```
https://[your-replit-url]/api/whop/webhook
```

### Step 2: Configure Webhook in Whop Dashboard

#### Option A: Via Whop Developer Dashboard (Easiest)

1. **Go to Whop Developer Portal**
   - Visit: https://whop.com/apps
   - Or navigate: Whop Dashboard → "Apps" → Your App

2. **Find Webhooks Section**
   - In your app settings, look for "Webhooks" tab/section
   - Click "Add Webhook" or "Create Webhook"

3. **Configure the Webhook**
   - **Webhook URL**: `https://[your-replit-url]/api/whop/webhook`
   - **Events to subscribe to**: 
     - ✅ `membership_went_valid` 
     - ✅ `app_membership_went_valid`
     - ✅ `membership.created` (if available)
   - **Status**: Enabled/Active

4. **Save the Webhook**
   - Click "Save" or "Create"
   - Copy the **Webhook Secret** (looks like `whsec_...` or similar)

5. **Add Secret to Environment Variables**
   - In Replit, go to "Secrets" (🔒 icon in sidebar)
   - Add: `WHOP_WEBHOOK_SECRET` = `[the secret you copied]`
   - This allows your app to verify webhook authenticity

#### Option B: Via Whop API (Alternative)

If you prefer using the API:

```bash
# Replace YOUR_WHOP_API_KEY and YOUR_REPLIT_URL
curl --request POST \
  --url https://api.whop.com/api/v5/webhooks \
  --header 'Authorization: Bearer YOUR_WHOP_API_KEY' \
  --header 'Content-Type: application/json' \
  --data '{
    "url": "https://YOUR_REPLIT_URL/api/whop/webhook",
    "events": ["membership_went_valid", "app_membership_went_valid"]
  }'
```

---

## 🧪 Step 3: Test the Webhook

### Test 1: Use Whop's Test Button

1. In Whop Dashboard → Webhooks
2. Find your newly created webhook
3. Click "Test" or "Send Test Event"
4. Watch your Replit logs

**Expected logs:**
```
=== WHOP WEBHOOK RECEIVED ===
Headers: { ... }
Body: { ... }
📥 Received Whop webhook action: membership_went_valid
```

### Test 2: Have Someone Join

1. Create a test membership or have someone join your community
2. Watch your Replit logs

**Expected flow:**
```
=== WHOP WEBHOOK RECEIVED ===
📥 Received Whop webhook action: membership_went_valid
New member joined: [name] (@[username])
✅ Found creator for company [company_id]
Created customer record for [name]
HeyGen video generation started for [username]: [video_id]
```

---

## 🔍 Troubleshooting

### Issue: "Missing Whop webhook signature" error

**Cause:** Webhook secret doesn't match

**Fix:**
1. Go to Whop Dashboard → Webhooks
2. Copy the webhook secret
3. Update your Replit Secrets: `WHOP_WEBHOOK_SECRET`
4. Restart your app

### Issue: Webhook receives test events but not real joins

**Possible causes:**
1. Wrong events selected - make sure you have `membership_went_valid` selected
2. App not installed in the company where people are joining
3. Webhook is disabled - check the toggle in Whop Dashboard

**Fix:**
- Verify webhook is "Enabled" in Whop Dashboard
- Check "Recent Deliveries" in webhook settings to see delivery attempts
- Make sure app is installed and approved in your Whop company

### Issue: "Invalid signature" errors

**Temporary workaround (for testing only):**
1. Remove `WHOP_WEBHOOK_SECRET` from Replit Secrets
2. Restart your app
3. App will accept webhooks without verification (you'll see a warning)
4. ⚠️ **Add the secret back after testing!**

### Issue: Webhooks not arriving at all

**Check:**
1. ✅ Is your Replit app running?
2. ✅ Can you access `https://[your-url]/api/whop/webhook/test` in a browser?
3. ✅ Is the webhook enabled in Whop Dashboard?
4. ✅ Are the correct events selected?

**Test endpoint accessibility:**
```bash
curl https://[your-replit-url]/api/whop/webhook/test
```

Should return:
```json
{
  "status": "Webhook endpoint is accessible",
  "webhookUrl": "/api/whop/webhook",
  "environment": {
    "hasApiKey": true,
    "hasWebhookSecret": true,
    "hasAppId": true
  }
}
```

---

## 📊 How to Verify It's Working

### In Whop Dashboard:
1. Go to Webhooks → Your Webhook → Recent Deliveries
2. You should see delivery attempts with status codes
3. **200 OK** = Success ✅
4. **401 Unauthorized** = Signature issue
5. **500 Error** = Your app crashed

### In Your Replit Logs:
When someone joins, you should see this complete flow:

```
=== WHOP WEBHOOK RECEIVED ===
📥 Received Whop webhook action: membership_went_valid
📋 Webhook data - status_reason: created, status: valid
📦 Membership data - Company ID: biz_XXXX
Fetched user details from Whop: John Doe (@johndoe)
New member joined: John Doe (@johndoe, user_XXXX)
🔍 Looking for creator with company ID: biz_XXXX
✅ Found creator for company biz_XXXX
Created customer record for John Doe with company ID: biz_XXXX
Created video record for johndoe
Using Avatar IV with text-to-speech for johndoe
✅ HeyGen video generation started for johndoe: [video_id]
```

Then 1-3 minutes later:
```
📹 Polling: Found 1 video(s) being generated...
📹 Video [video_id] status: completed
✅ Video [video_id] is complete! URL: https://...
📤 Sending DM to user user_XXXX...
✅ DM sent successfully to John Doe
🎉 Video [video_id] successfully sent to John Doe
```

---

## ✅ Success Checklist

Before considering it "done", verify:

- [ ] Webhook configured in Whop Dashboard with correct URL
- [ ] Events `membership_went_valid` and `app_membership_went_valid` are selected
- [ ] Webhook is enabled/active
- [ ] Webhook secret is set in Replit Secrets as `WHOP_WEBHOOK_SECRET`
- [ ] Test webhook works (using Whop's test button)
- [ ] Real join triggers webhook (test with actual membership)
- [ ] Video generation starts when webhook received
- [ ] DM is sent when video completes

---

## 🆘 Still Not Working?

If you've followed all steps and it's still not working, gather this info:

1. **Screenshot of Whop webhook configuration**
2. **Screenshot of "Recent Deliveries" in Whop webhook settings**
3. **Your full Replit logs** when someone joins
4. **Result of:**
   ```bash
   curl https://[your-url]/api/whop/webhook/test
   ```
5. **Your environment variables** (without showing the actual secrets):
   ```
   WHOP_API_KEY: set? yes/no
   WHOP_WEBHOOK_SECRET: set? yes/no
   NEXT_PUBLIC_WHOP_APP_ID: set? yes/no
   ```

This will help diagnose the exact issue!

---

## 📚 Additional Resources

- **Whop Webhooks Guide**: https://dev.whop.com/webhooks
- **Whop API Reference**: https://dev.whop.com/api-reference
- **Your test endpoint**: `https://[your-url]/api/whop/webhook/test`

---

## Summary

**The issue**: Whop doesn't know to send webhooks to your app
**The fix**: Configure the webhook in Whop Developer Dashboard
**The result**: New members automatically get personalized videos 🎥

Good luck! Let me know if you run into any issues. 🚀
