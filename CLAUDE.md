# ALL THE MAIL — Overnight Build Plan

## Project Overview
Unified Google account aggregator. Users connect multiple Google accounts and get one view for Gmail, Drive/Docs, and Calendar with source chips identifying each account.

## Tech Stack
- **Backend:** Express.js (ESM), Supabase (Postgres + auth), Google APIs (gmail, drive, calendar), Stripe billing, JWT auth, multer for file uploads
- **Frontend:** React 18 (CRA), react-router-dom, react-quill (compose), react-resizable-panels, lucide-react icons, DOMPurify
- **Database:** Supabase (see database-schema.sql)
- **No tests exist yet.** Zero test files in the entire project.

## Architecture Notes
- `backend/server.js` — monolith (1601 lines), all routes in one file
- `frontend/src/App.js` — monolith (2424 lines), all UI in one component
- Backend already has endpoints for: auth, accounts, emails, docs, calendar events, billing
- Frontend already has modules: everything (unified), mail, docs, cals
- Connected accounts store OAuth tokens in Supabase with per-account scopes (mail, docs, cals)

## Priority Tasks (work through in order)

### 1. Refactor backend/server.js into a proper route structure
- Create `backend/routes/` directory
- Extract into: `auth.js`, `accounts.js`, `emails.js`, `docs.js`, `calendar.js`, `billing.js`
- Create `backend/middleware/auth.js` for the authenticateToken middleware
- Create `backend/lib/google.js` for shared Google OAuth client helpers
- Create `backend/lib/supabase.js` for the Supabase client init
- Keep server.js as the entry point that mounts routes
- Verify the server still starts without errors after refactor

### 2. Refactor frontend/src/App.js into components
- Create `frontend/src/components/` subdirectories for each module
- Extract: `MailView`, `DocsView`, `CalsView`, `EverythingView`, `Sidebar`, `ComposeModal`, `EmailDetail`, `DocPreview`, `EventDetail`
- Extract shared hooks into `frontend/src/hooks/` (useAuth, useAccounts, useEmails, useDocs, useCalendar)
- Keep App.js as the shell that handles routing and auth state
- Ensure no visual regressions — the UI should look exactly the same

### 3. Write comprehensive tests for the backend
- Install jest + supertest as devDependencies in backend/
- Add test script to backend/package.json
- Create `backend/__tests__/` directory
- Test each route file: auth, accounts, emails, docs, calendar, billing
- Mock Supabase and Google API calls
- Test auth middleware (valid token, expired token, missing token)
- Test error handling paths
- Run tests, iterate until all pass

### 4. Write frontend component tests
- Tests already set up via CRA (@testing-library/react is installed)
- Create test files alongside each new component
- Test: rendering, user interactions, account switching, module navigation
- Test SourceChip component (already exists, no test)
- Test utility functions (getAccountShortLabel, etc.)
- Run tests, iterate until all pass

### 5. Add error boundaries and loading states
- Add React Error Boundary component wrapping each module
- Add proper loading skeletons for email list, docs list, calendar
- Add retry logic for failed API calls (exponential backoff)
- Add toast/notification system for user feedback on actions (archive, trash, send)

### 6. Improve the docs module
- Add search/filter for documents (by name, type, date)
- Add document type icons (Sheets, Slides, Docs, PDF)
- Add "Open in Google" button that links to the edit URL
- Add sorting options (last modified, name, type)

### 7. Improve the calendar module
- Add week/day view toggle (currently seems to be list only)
- Add color coding by account
- Add quick-create event form
- Add drag-to-reschedule support or at minimum inline time editing

## Rules
- Commit working code with descriptive messages after completing each numbered task
- Write tests before moving to the next task
- Do NOT touch .env files or any real credentials
- Do NOT push to any remote
- Do NOT modify database-schema.sql
- Preserve all existing visual design, CSS, and branding
- Use ESM imports (the project uses "type": "module")
- If npm install is needed, run it in the appropriate directory (backend/ or frontend/)
