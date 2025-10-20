# Whop Role-Based Access App

## Overview
This is a Whop application that implements role-based access control, automatically routing admins to a dashboard and customers to their member view based on Whop's authentication system.

## Architecture
- **Frontend**: React + TypeScript with Wouter routing
- **Backend**: Express.js with Whop SDK integration
- **Authentication**: Handled entirely by Whop - no custom auth needed
- **Styling**: Tailwind CSS with shadcn/ui components

## Key Features
- Automatic role detection (admin vs customer) via Whop SDK
- Admin dashboard with stats and activity monitoring
- Customer view with feature access management
- Dark mode support
- Real-time access validation

## How It Works

### Whop Integration
The app uses Whop's SDK to validate user access:

1. **Experience View Pattern**: App is accessed via `/experiences/[experienceId]`
2. **Token Validation**: Whop automatically adds `x-whop-user-token` header to all requests
3. **Access Check**: Backend validates token and checks user's access level
4. **Role-Based Rendering**: Frontend renders appropriate view based on access level

### Access Levels
- **admin**: Owners/moderators of the Whop → see Admin Dashboard
- **customer**: Regular members → see Customer View
- **no_access**: No access → see Access Denied page

## Configuration

### Required Environment Variables
```
WHOP_API_KEY=<your_api_key>
NEXT_PUBLIC_WHOP_APP_ID=<your_app_id>
```

Get these from: https://whop.com/dashboard/developer/

### Optional for Local Testing
```
WHOP_DEV_TOKEN=<jwt_token_from_whop_dev_tools>
```

## Local Development

### Using Whop Dev Proxy (Recommended)
The dev proxy automatically injects the user token for local testing:

```bash
# Start the dev server
npm run dev

# In a separate terminal, run the dev proxy
npx @whop-apps/dev-proxy --standalone --upstreamPort=5000 --proxyPort=3000
```

Then access your app through the Whop platform with the dev tools set to localhost:3000

### Without Dev Proxy (Mock Mode)
Set `WHOP_DEV_TOKEN` environment variable to test locally without the proxy.

## Deployment

### Whop Dashboard Configuration
1. Go to https://whop.com/dashboard/developer/
2. Select your app
3. In Hosting settings, set Experience View path to: `/experiences/[experienceId]`
4. Deploy your app
5. Install the app in a Whop to test

### Environment Setup
Ensure `WHOP_API_KEY` and `NEXT_PUBLIC_WHOP_APP_ID` are set in your deployment environment.

## Project Structure

```
client/
  src/
    components/
      AdminDashboard.tsx    # Admin view with stats
      CustomerView.tsx      # Customer member view
      Header.tsx           # App header with role badge
      LoadingState.tsx     # Loading indicator
      AccessDenied.tsx     # Access denied screen
    pages/
      Experience.tsx       # Main experience view (role-based routing)
      Home.tsx            # Info page
    lib/
      api.ts              # API helper functions

server/
  lib/
    whop-sdk.ts          # Whop SDK initialization
  middleware/
    whop-proxy.ts        # Dev token injection for local testing
  routes.ts              # API routes for access validation
```

## API Routes

### POST /api/validate-access
Validates user access to an experience.

**Request:**
```json
{
  "experienceId": "exp_xxx"
}
```

**Response:**
```json
{
  "hasAccess": true,
  "accessLevel": "admin"|"customer"|"no_access",
  "userId": "user_xxx"
}
```

### GET /api/user
Gets current user information (requires x-whop-user-token header).

## Development Notes

- The app automatically handles dark/light mode preferences
- All interactive elements include data-testid attributes for testing
- Mock data in dashboards will be replaced with real Whop API calls in production
- The dev proxy is essential for local testing with Whop authentication

## Multi-Tenant Security Architecture

This app is designed for multi-tenant deployment where multiple companies can install and use the app independently. Complete data isolation is enforced at multiple levels:

### Security Layers

1. **Database Constraints** (shared/schema.ts):
   - `whopCompanyId` is NOT NULL and UNIQUE
   - Enforces one creator per company at database level
   - Prevents NULL bypass of unique constraint

2. **Initialization Security** (/api/admin/initialize):
   - REQUIRES `experienceId` in request
   - Verifies user has ADMIN access to experience via Whop SDK
   - Rejects if user lacks admin access (403)
   - Fetches company ID from verified experience (server-side only)
   - Creates creator with company ID OR validates existing creator matches
   - Returns 403 if existing creator belongs to different company

3. **Settings Protection** (/api/admin/save-settings):
   - Company ID is READ-ONLY after initialization
   - Client cannot change company ID (removed from request body)
   - Only messageTemplate can be updated

4. **Webhook Routing** (/api/whop/webhook):
   - Extracts company ID from webhook payload
   - Matches creator by company ID (not first available)
   - Rejects webhooks without company ID or matching creator

5. **API Scoping** (/api/admin/analytics, /api/admin/customers):
   - All Whop API calls include company_id parameter
   - Returns only data for creator's company
   - Logs company context for auditing

### Attack Vectors Blocked

- ❌ Cannot initialize with arbitrary experienceId (admin access check)
- ❌ Cannot change company ID after setup (settings endpoint hardened)
- ❌ Cannot create creator without company ID (DB constraint + validation)
- ❌ Cannot create multiple creators for same company (unique constraint)
- ❌ Webhooks cannot route to wrong creator (company-based lookup)
- ❌ API calls cannot leak cross-company data (company_id parameter)

## Recent Changes
- **October 2025 - Critical Security Update**: Complete multi-tenant isolation
  - Added admin access verification to initialization endpoint
  - Made company ID immutable after initialization
  - Enforced NOT NULL + UNIQUE constraints on whopCompanyId
  - Added company_id scoping to all Whop API calls
  - Fixed webhook routing to use company-based creator lookup
  - Added comprehensive logging for security auditing
  - Blocked all cross-company data access attack vectors
- **October 2025**: Major UX and design improvements
  - Restructured upload flow: Files are now staged locally and only uploaded when "Save Settings" is clicked
  - Fixed avatar preview persistence - preview now remains visible after upload
  - Added setup progress tracker showing completion percentage and steps
  - Enhanced visual design with futuristic aesthetic: gradients, glows, and animations
  - Improved empty states with engaging visuals and better guidance
  - Added custom CSS animations (shimmer, pulse-glow, float, slide-in-up, fade-in)
  - Better status indicators and badges throughout admin dashboard
  - "Unsaved Changes" badge to prevent accidental data loss
  - Improved customer view with better status displays and action cards
  - Added cleanup for polling interval to prevent memory leaks
- Initial implementation with Whop SDK integration
- Role-based routing using experience view pattern  
- API routes for access validation
- Local development setup with mock token support
