# Webhook Verification Guide

## ✅ What I Fixed

Your app had an **inconsistency in DM sending methods**:
- The polling service was using the Whop SDK method `sendDirectMessageToUser()` 
- Other parts were using the REST API directly

**I've now standardized all DM sending to use the REST API method**, which is more reliable and includes better error handling.

---

## 🔍 How to Verify Everything is Working

### Step 1: Check Your Webhooks are Configured

#### Whop Webhook
1. Go to your Whop Dashboard
2. Navigate to **Developer → Webhooks** (or **Settings → Webhooks**)
3. Verify you have a webhook configured:
   - **URL**: `https://your-app-url/api/whop/webhook`
   - **Event**: `membership_went_valid` or `app_membership_went_valid`
   - **Status**: Enabled ✅

#### HeyGen Webhook (Optional, you have polling as backup)
1. Go to HeyGen Dashboard
2. Navigate to **Settings → Webhooks**
3. Add webhook URL: `https://your-app-url/api/heygen/webhook`

---

### Step 2: Test Webhook Connectivity

Run this command to test if your webhook endpoint is accessible:

```bash
curl https://your-app-url/api/whop/webhook/test
```

**Expected response:**
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

### Step 3: Check Required Permissions

Your Whop app needs these permissions:
- ✅ `message:write` - To send DMs
- ✅ `member:basic:read` - To fetch member info
- ✅ `user:basic:read` - To get user details

**How to verify:**
1. Go to Whop Dashboard → Developer → Your App → Permissions
2. Ensure all these permissions are enabled
3. If you added new permissions, **re-approve the app installation**

---

### Step 4: Verify Setup is Complete

1. Log into your app as an **admin**
2. Go to the **Admin Dashboard**
3. Check that setup shows as **Complete**:
   - ✅ Avatar uploaded
   - ✅ Voice model trained (or audio uploaded)
   - ✅ Message template saved

If any are missing, the app **won't send videos** even if webhooks work.

---

### Step 5: Test with a Real Member

**Option A: Have someone join (Live Test)**
1. Have a friend or test account join your Whop
2. Watch your server logs for these messages:

```
=== WHOP WEBHOOK RECEIVED ===
📥 Received Whop webhook action: membership_went_valid
✅ Found creator for company [company_id]
Created customer record for [Name]
🎥 Calling HeyGen Avatar IV API...
HeyGen video generation started for [username]: [video_id]
```

3. Wait 1-2 minutes for HeyGen to process
4. Check logs again for:

```
📹 Polling: Found 1 video(s) being generated...
📹 Video [video_id] status: completed
✅ Video [video_id] is complete! URL: [url]
📤 Sending DM to user [user_id]...
✅ DM sent successfully to [Name]
```

5. New member should receive a DM with the video!

**Option B: Use Admin Test Button**
1. Go to Admin Dashboard
2. Click **"Test Video Generation"** button
3. You should receive a DM with a test video

---

### Step 6: Check Customer Dashboard

1. Have the new member log into the app
2. They should see:
   - "Check your DMs for a personal message 🎥"
   - Their name displayed
   - Video status indicator

---

## 🐛 Troubleshooting

### Issue: "No DMs being sent"

**Check these in order:**

1. **Is creator setup complete?**
   ```
   Admin Dashboard → Should show "Setup Complete"
   ```

2. **Is webhook receiving events?**
   ```
   Server logs → Look for "WHOP WEBHOOK RECEIVED"
   ```

3. **Is video generation starting?**
   ```
   Server logs → Look for "HeyGen video generation started"
   ```

4. **Is video completing?**
   ```
   Server logs → Look for "Video [id] status: completed"
   ```

5. **Is DM sending failing?**
   ```
   Server logs → Look for "DM sending failed" or "PERMISSIONS ISSUE"
   ```

### Issue: "PERMISSIONS ISSUE: message:write"

**Solution:**
1. Go to Whop Dashboard → Developer → Your App → Permissions
2. Add `message:write` permission
3. **Important:** You must **re-approve** the app installation:
   - Uninstall the app from your company
   - Reinstall it
   - This refreshes the permissions

### Issue: "No creator found for company [company_id]"

**Solution:**
1. Make sure you've logged into the app as an admin
2. Complete the setup wizard (upload avatar, train voice, save template)
3. The creator record is created when you first access the admin dashboard

### Issue: "Videos stuck in GENERATING status"

**Solution:**
1. Check HeyGen API key is valid
2. Check HeyGen account has credits
3. Wait at least 2 minutes (HeyGen can take time)
4. Check server logs for HeyGen errors
5. The polling service runs every 30 seconds - it will eventually pick it up

### Issue: "Customer already has videos, skipping generation"

**Solution:**
This is expected behavior! The app only sends ONE welcome video per customer.
If you want to send another video:
1. Go to Admin Dashboard → Customers tab
2. Find the customer
3. Click **"Trigger Video"** to manually generate a new video

---

## 📊 Monitoring Your App

### Key Log Messages to Watch

✅ **Good Signs:**
```
✅ Connected to MongoDB
🔄 Video polling service started
Received Whop webhook: membership_went_valid
✅ Found creator for company
HeyGen video generation started
Video [id] status: completed
✅ DM sent successfully
```

❌ **Warning Signs:**
```
❌ No creator found for company
❌ Creator setup incomplete
❌ HeyGen API error
❌ DM sending failed
⚠️ PERMISSIONS ISSUE
```

---

## 🎯 Expected Full Flow

Here's what should happen when someone joins:

```
1. User joins Whop
   ↓
2. Whop → Webhook → Your app
   ↓
3. App creates customer record
   ↓
4. App triggers HeyGen video generation
   ↓
5. HeyGen processes video (1-3 minutes)
   ↓
6. Polling service detects completion (or HeyGen webhook)
   ↓
7. App sends DM to customer
   ↓
8. Customer receives personalized video! 🎉
```

**Typical Timeline:**
- Webhook received: **Instant**
- Video generation starts: **< 5 seconds**
- Video completes: **1-3 minutes**
- DM sent: **< 5 seconds after completion**
- **Total: ~2-4 minutes from join to DM**

---

## 🚀 Quick Test Commands

### Test Webhook Endpoint
```bash
curl https://your-app-url/api/whop/webhook/test
```

### Check App Logs (if on Replit)
Go to your Replit → Shell → Look for the logs

### Check Video Status in Database
You can query your MongoDB to see video statuses:
```javascript
// In MongoDB Compass or similar
db.videos.find().sort({createdAt: -1}).limit(10)
```

---

## 📞 Need Help?

If you're still having issues:

1. **Share your server logs** from when someone joins
2. **Check the Admin Dashboard** → Customers tab → Video status
3. **Verify all environment variables** are set:
   - `WHOP_API_KEY`
   - `NEXT_PUBLIC_WHOP_APP_ID`
   - `HEYGEN_API_KEY`
   - `MONGODB_URI`

The code is correct and should work! Most issues are related to:
- ❌ Permissions not approved
- ❌ Webhooks not configured
- ❌ Setup incomplete
- ❌ Missing environment variables
