# CLAUDE.md - Developer Reference for AI Agents

This document provides a comprehensive overview of the PlexDownloadarr codebase to help Claude agents (or any AI assistant) get up to speed quickly and work effectively on this project.

## Table of Contents
1. [Project Overview](#project-overview)
2. [Architecture & Tech Stack](#architecture--tech-stack)
3. [Key Directories & Files](#key-directories--files)
4. [Development Workflow](#development-workflow)
5. [Common Tasks](#common-tasks)
6. [Important Patterns & Conventions](#important-patterns--conventions)
7. [Mobile & PWA Considerations](#mobile--pwa-considerations)
8. [Testing & Building](#testing--building)
9. [Git Workflow](#git-workflow)
10. [Known Issues & Gotchas](#known-issues--gotchas)
11. [API Overview](#api-overview)
12. [Authentication Flow](#authentication-flow)

---

## Project Overview

**PlexDownloadarr** is a modern web application that provides a user-friendly interface for downloading media from a Plex Media Server. It integrates with Plex's authentication system and respects user permissions.

### Key Features
- **Plex OAuth Authentication**: Users sign in with their Plex accounts
- **Library Browsing**: Display movies, TV shows, and music with posters and metadata
- **One-Click Downloads**: Download original media files directly
- **Permission Respect**: Honors Plex's user access controls
- **Progressive Web App (PWA)**: Installable on mobile devices
- **Responsive Design**: Works on desktop, mobile browser, and PWA
- **Download Management**: Real-time download progress with queue management
- **Admin Features**: Download history, logs, and settings

### Project Goals
- Provide a sleek, Overseerr-like interface for Plex downloads
- Respect Plex server permissions and user access
- Work seamlessly on mobile and desktop
- Maintain security through proper authentication

---

## Architecture & Tech Stack

### Backend
- **Runtime**: Node.js with Express
- **Language**: TypeScript
- **Database**: SQLite (via better-sqlite3)
- **Authentication**: Session-based with express-session
- **Plex Integration**: Direct Plex API calls (no official SDK)
- **Logging**: Winston for structured logging
- **File Serving**: Direct file streaming from Plex server paths

**Location**: `/backend`

### Frontend
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS with custom dark theme
- **State Management**: Zustand for auth, React Context for downloads
- **Routing**: React Router v6
- **API Client**: Axios
- **PWA**: Service Worker + Web App Manifest

**Location**: `/frontend`

### Deployment
- **Containerization**: Docker with docker-compose
- **Multi-stage Build**: Frontend built and served by backend
- **Volumes**: SQLite database and logs persisted
- **Network**: Backend serves both API and static frontend

---

## Key Directories & Files

### Backend Structure
```
backend/
├── src/
│   ├── index.ts                 # Entry point, Express setup
│   ├── config/
│   │   └── index.ts            # Configuration (ports, Plex metadata)
│   ├── db/
│   │   ├── index.ts            # SQLite database initialization
│   │   └── schema.sql          # Database schema
│   ├── middleware/
│   │   ├── auth.ts             # Authentication middleware
│   │   └── error.ts            # Error handling middleware
│   ├── routes/
│   │   ├── auth.ts             # Login, logout, Plex OAuth
│   │   ├── media.ts            # Media browsing and downloads
│   │   ├── libraries.ts        # Library listing
│   │   ├── settings.ts         # Admin settings (Plex URL/token)
│   │   ├── downloads.ts        # Download history
│   │   └── logs.ts             # System logs
│   ├── services/
│   │   └── plexService.ts      # Plex API integration
│   ├── utils/
│   │   └── logger.ts           # Winston logger setup
│   └── types/
│       └── index.ts            # TypeScript types
├── package.json
└── tsconfig.json
```

### Frontend Structure
```
frontend/
├── src/
│   ├── main.tsx                # Entry point, React setup
│   ├── App.tsx                 # Routes and protected route logic
│   ├── components/
│   │   ├── Header.tsx          # Top navigation with safe area insets
│   │   ├── Sidebar.tsx         # Left nav with library list
│   │   ├── DownloadManager.tsx # Floating download progress widget
│   │   └── MediaCard.tsx       # Reusable media poster card
│   ├── pages/
│   │   ├── Setup.tsx           # First-time admin setup
│   │   ├── Login.tsx           # Login with Plex OAuth
│   │   ├── Dashboard.tsx       # Home page with libraries
│   │   ├── LibraryView.tsx     # Grid view of media in library
│   │   ├── MediaDetail.tsx     # Detail page with download button
│   │   ├── SearchResults.tsx   # Search results page
│   │   ├── Settings.tsx        # Admin settings page
│   │   ├── DownloadHistory.tsx # Admin download history
│   │   └── Logs.tsx            # Admin logs page
│   ├── stores/
│   │   └── authStore.ts        # Zustand store for auth state
│   ├── contexts/
│   │   └── DownloadContext.tsx # React Context for download queue
│   ├── services/
│   │   └── api.ts              # Axios API client
│   ├── hooks/
│   │   └── useMobileMenu.ts    # Custom hook for mobile menu state
│   ├── styles/
│   │   └── index.css           # Tailwind + custom styles
│   └── types/
│       └── index.ts            # TypeScript types
├── public/
│   ├── manifest.json           # PWA manifest
│   ├── service-worker.js       # Service worker for PWA
│   ├── icon.svg                # App icon (SVG)
│   ├── icon-*.png              # App icons (PNG)
│   └── favicon.ico             # Favicon
├── index.html                  # HTML entry point
├── package.json
├── tailwind.config.js          # Tailwind configuration
├── vite.config.ts              # Vite configuration
└── tsconfig.json
```

### Configuration Files
```
/
├── docker-compose.yml          # Docker Compose configuration
├── Dockerfile                  # Multi-stage Docker build
├── README.md                   # User-facing documentation
├── CLAUDE.md                   # This file
└── .gitignore
```

---

## Development Workflow

### Local Development Setup

1. **Install Dependencies**
   ```bash
   # Backend
   cd backend
   npm install

   # Frontend
   cd ../frontend
   npm install
   ```

2. **Start Development Servers**
   ```bash
   # Backend (runs on port 3001)
   cd backend
   npm run dev

   # Frontend (runs on port 5173)
   cd frontend
   npm run dev
   ```

3. **Build for Production**
   ```bash
   # Frontend build (output to frontend/dist)
   cd frontend
   npm run build

   # Backend build (output to backend/dist)
   cd backend
   npm run build
   ```

4. **Docker Build**
   ```bash
   # Build and run with Docker Compose
   docker-compose up --build
   ```

### Important: Always Test Builds
Before committing frontend changes, **always run `npm run build`** to catch TypeScript errors:
```bash
cd /home/user/PlexDownloadarr/frontend
npm run build
```

---

## Common Tasks

### Adding a New API Endpoint

1. **Create route in backend**
   ```typescript
   // backend/src/routes/myRoute.ts
   import { Router } from 'express';
   import { requireAuth } from '../middleware/auth';

   const router = Router();

   router.get('/my-endpoint', requireAuth, async (req, res) => {
     try {
       // Your logic here
       res.json({ success: true });
     } catch (error) {
       res.status(500).json({ error: 'Error message' });
     }
   });

   export default router;
   ```

2. **Register in backend/src/index.ts**
   ```typescript
   import myRoute from './routes/myRoute';
   app.use('/api/my-route', myRoute);
   ```

3. **Add API call in frontend**
   ```typescript
   // frontend/src/services/api.ts
   export const api = {
     // ... existing methods
     myEndpoint: () => axios.get('/api/my-route/my-endpoint'),
   };
   ```

### Adding a New Page

1. **Create page component**
   ```typescript
   // frontend/src/pages/MyPage.tsx
   import React from 'react';
   import { Header } from '../components/Header';
   import { Sidebar } from '../components/Sidebar';
   import { useMobileMenu } from '../hooks/useMobileMenu';

   export const MyPage: React.FC = () => {
     const { isMobileMenuOpen, toggleMobileMenu, closeMobileMenu } = useMobileMenu();

     return (
       <div className="flex h-screen overflow-hidden bg-dark">
         <Sidebar isOpen={isMobileMenuOpen} onClose={closeMobileMenu} />
         <div className="flex flex-col flex-1 overflow-hidden">
           <Header onMenuClick={toggleMobileMenu} />
           <main className="flex-1 p-4 md:p-8 overflow-y-auto">
             <h2 className="text-2xl md:text-3xl font-bold mb-4 md:mb-6">My Page</h2>
             {/* Your content here */}
           </main>
         </div>
       </div>
     );
   };
   ```

2. **Add route in App.tsx**
   ```typescript
   <Route
     path="/my-page"
     element={
       <ProtectedRoute>
         <MyPage />
       </ProtectedRoute>
     }
   />
   ```

### Adding Database Columns

1. **Modify schema**
   ```sql
   -- backend/src/db/schema.sql
   ALTER TABLE users ADD COLUMN new_field TEXT;
   ```

2. **Update database initialization**
   ```typescript
   // backend/src/db/index.ts
   // Add migration logic if needed
   ```

3. **Update TypeScript types**
   ```typescript
   // backend/src/types/index.ts
   export interface User {
     // ... existing fields
     newField?: string;
   }
   ```

### Styling with Tailwind

**Responsive Design Pattern:**
```tsx
<div className="text-sm md:text-base p-4 md:p-8 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3">
  {/* Mobile-first approach with md: breakpoint at 768px */}
</div>
```

**Custom Colors (see tailwind.config.js):**
- `bg-dark` - Main background (#0a0a0f)
- `bg-dark-100` - Cards/panels (#0f0f23)
- `bg-dark-200` - Hover states (#1a1a2e)
- `bg-dark-50` - Borders (#2d2d2d)
- `text-primary-500` - Primary orange (#e87c03)
- `text-secondary-500` - Secondary purple (#b794f4)

---

## Important Patterns & Conventions

### Authentication Pattern
```typescript
// All protected routes use requireAuth middleware
router.get('/protected', requireAuth, async (req, res) => {
  const userId = req.session.userId;  // Available after requireAuth
  const user = req.user;              // User object attached to request
});
```

### Error Handling Pattern
```typescript
// Backend
try {
  const data = await someAsyncOperation();
  res.json(data);
} catch (error) {
  logger.error('Operation failed', { error, userId: req.session.userId });
  res.status(500).json({ error: 'User-friendly error message' });
}

// Frontend
try {
  await api.someOperation();
  // Success handling
} catch (err: any) {
  setError(err.response?.data?.error || 'Fallback error message');
}
```

### Download Flow Pattern
1. User clicks download button
2. Frontend calls `/api/media/:ratingKey/download`
3. Backend creates download record in database
4. Backend streams file with proper headers
5. Download progress tracked via DownloadContext
6. DownloadManager widget shows progress
7. Download history recorded for admin

### Responsive Component Pattern
Every page with Header/Sidebar should:
1. Import `useMobileMenu` hook
2. Pass `isOpen`, `onClose` to Sidebar
3. Pass `onMenuClick` to Header
4. Use responsive Tailwind classes (`md:`, `sm:`)
5. Apply safe area insets if needed (PWA)

---

## Mobile & PWA Considerations

### Safe Area Insets (iPhone Notch Support)
Always respect safe areas in PWA for devices with notches:

```typescript
// Header component
style={{
  paddingTop: 'calc(0.75rem + env(safe-area-inset-top))',
}}

// Sidebar component
style={{
  paddingTop: 'calc(1rem + env(safe-area-inset-top))',
  paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))',
  paddingLeft: 'calc(1rem + env(safe-area-inset-left))',
}}
```

### Mobile Plex OAuth
**CRITICAL**: `window.open()` must be called **synchronously** in click handler on mobile browsers:

```typescript
// ❌ WRONG - Will be blocked on mobile
const handleLogin = async () => {
  const pin = await generatePin();  // Async operation
  window.open(pin.url, '_blank');   // TOO LATE - popup blocked
};

// ✅ CORRECT - Open immediately
const handleLogin = async () => {
  const authWindow = window.open('about:blank', '_blank');  // Open immediately
  const pin = await generatePin();
  if (authWindow) {
    authWindow.location.href = pin.url;  // Navigate blank window
  }
};
```

### PWA Theme Colors
- `theme-color` meta tag: `#0f0f23` (dark background, not orange)
- Manifest `background_color`: `#0f0f23`
- Manifest `theme_color`: `#0f0f23`
- This prevents orange overflow areas on mobile

### Mobile Menu Pattern
```typescript
const { isMobileMenuOpen, toggleMobileMenu, closeMobileMenu } = useMobileMenu();
// Hook handles:
// - Mobile menu state
// - Auto-close on window resize (desktop)
// - Backdrop click handling
```

---

## Testing & Building

### Frontend Build & Type Check
```bash
cd frontend
npm run build  # Runs `tsc && vite build`
```
**Always run this before committing!** Catches TypeScript errors.

### Backend Build
```bash
cd backend
npm run build  # Compiles TypeScript to dist/
```

### Manual Testing Checklist
- [ ] Desktop browser (Chrome/Firefox)
- [ ] Mobile browser (Safari iOS, Chrome Android)
- [ ] PWA installed (iOS and/or Android)
- [ ] Plex OAuth flow works
- [ ] Downloads complete successfully
- [ ] Admin features accessible (if admin user)
- [ ] Mobile menu opens/closes properly
- [ ] Safe areas respected (iPhone notch)

---

## Git Workflow

### Branch Naming
- Feature branches: `claude/feature-name-{sessionId}`
- Always use the session ID suffix provided in context

### Commit Messages
Use descriptive commit messages with this format:
```
Short summary (50 chars or less)

Detailed explanation:
- What problem this solves
- What changed
- Why this approach was taken

Files modified:
- file/path/one.ts - Description
- file/path/two.tsx - Description
```

### Pushing Changes
```bash
git add -A
git commit -m "Your commit message"
git push -u origin <branch-name>
```

**Important**: If push fails with "fetch first" error:
```bash
git pull --rebase origin <branch-name>
git push -u origin <branch-name>
```

---

## Known Issues & Gotchas

### 1. Mobile Popup Blocking
**Issue**: Mobile browsers block `window.open()` if not called directly in user gesture.

**Solution**: Open blank window immediately (synchronously), then navigate it after async operations.

### 2. Plex API Rate Limiting
**Issue**: Plex API has rate limits; excessive requests can cause temporary blocks.

**Solution**: Cache library and media data when possible. Don't poll too frequently.

### 3. File Path Permissions
**Issue**: Backend needs read access to Plex media files for downloads.

**Solution**: Ensure Docker volume mounts match Plex library paths, or run backend with appropriate permissions.

### 4. Session Persistence
**Issue**: Sessions stored in memory by default; lost on server restart.

**Solution**: Users must re-login after server restart. Future: consider session store (Redis, database).

### 5. Plex Server Name Detection
**Issue**: Plex `/identity` endpoint doesn't return `friendlyName`.

**Solution**: Query both `/identity` (for machineIdentifier) and `/` (for friendlyName).

### 6. CORS in Development
**Issue**: Frontend (port 5173) calling backend (port 3001) triggers CORS.

**Solution**: Backend has CORS middleware configured for development. In production, frontend is served by backend (no CORS issue).

### 7. PWA Service Worker Caching
**Issue**: Service worker caches can cause stale content.

**Solution**: Service worker uses network-first strategy. Clear browser cache if seeing stale content.

### 8. TypeScript Strict Null Checks
**Issue**: Plex API responses can have nullable fields.

**Solution**: Always check for null/undefined before using optional fields:
```typescript
const title = media.title || 'Unknown Title';
const year = media.year ? `(${media.year})` : '';
```

---

## API Overview

### Authentication Endpoints

**POST /api/auth/login**
- Body: `{ username, password }`
- Returns: `{ user, token }`
- Local admin login

**POST /api/auth/plex/pin**
- Generates Plex OAuth PIN
- Returns: `{ id, code, url }`

**POST /api/auth/plex/callback**
- Body: `{ pinId }`
- Exchanges PIN for Plex user token
- Returns: `{ user, token }`

**POST /api/auth/logout**
- Destroys session
- Returns: `{ success }`

### Media Endpoints

**GET /api/libraries**
- Requires auth
- Returns: Array of Library objects

**GET /api/media/library/:libraryKey**
- Requires auth
- Returns: Array of Media objects in library

**GET /api/media/:ratingKey**
- Requires auth
- Returns: Detailed Media object

**GET /api/media/:ratingKey/download**
- Requires auth
- Streams media file with Content-Disposition header
- Records download in history

**GET /api/media/search?q={query}**
- Requires auth
- Returns: Array of Media objects matching query

### Admin Endpoints

**GET /api/settings**
- Requires admin
- Returns: Settings object (Plex URL, token status, machine ID, server name)

**PUT /api/settings**
- Requires admin
- Body: `{ plexUrl, plexToken }`
- Auto-fetches machine ID and server name
- Returns: Updated settings

**GET /api/downloads/history**
- Requires admin
- Returns: Array of DownloadRecord objects

**GET /api/logs**
- Requires admin
- Query params: `level`, `startDate`, `endDate`
- Returns: Array of log entries

### Setup Endpoint

**GET /api/setup/required**
- Public endpoint
- Returns: `boolean` (true if setup needed)

**POST /api/setup/initialize**
- Public endpoint (only works if setup required)
- Body: `{ username, password }`
- Creates first admin user
- Returns: `{ user, token }`

---

## Authentication Flow

### Local Admin Login
1. User enters username/password
2. Frontend calls POST `/api/auth/login`
3. Backend verifies credentials against database
4. Session created, user object returned
5. Frontend stores auth state in Zustand

### Plex OAuth Login
1. User clicks "Sign in with Plex"
2. Frontend calls POST `/api/auth/plex/pin` to generate PIN
3. Blank window opens immediately (sync)
4. After PIN received, navigate window to Plex auth URL
5. Frontend polls POST `/api/auth/plex/callback` every 2 seconds
6. Backend exchanges PIN for Plex auth token
7. Backend validates user has access to configured Plex server
8. Backend creates/updates user in database
9. Session created, user object returned
10. Frontend stores auth state in Zustand
11. Polling stops, user redirected to home

### Session Management
- Sessions stored in `req.session` via express-session
- Session cookie: `plexdownloadarr-session`
- `requireAuth` middleware checks `req.session.userId`
- Logout destroys session

---

## Database Schema Overview

### users Table
```sql
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT,           -- Only for local admin
  plex_user_id TEXT,            -- Plex user ID
  plex_username TEXT,           -- Plex username
  plex_email TEXT,              -- Plex email
  is_admin BOOLEAN DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)
```

### settings Table
```sql
CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
)
```
**Keys:**
- `plex_url` - Plex server URL
- `plex_token` - Plex auth token
- `plex_machine_id` - Plex server machine identifier
- `plex_server_name` - Friendly server name

### download_history Table
```sql
CREATE TABLE download_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  media_title TEXT NOT NULL,
  media_type TEXT NOT NULL,     -- 'movie', 'episode', 'track'
  file_path TEXT NOT NULL,
  file_size INTEGER,
  download_date DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
)
```

---

## Quick Reference: File Locations

**Need to modify...**

- **Plex API calls** → `backend/src/services/plexService.ts`
- **Authentication logic** → `backend/src/routes/auth.ts`, `backend/src/middleware/auth.ts`
- **Database queries** → `backend/src/db/index.ts`
- **API endpoints** → `backend/src/routes/*`
- **Frontend auth state** → `frontend/src/stores/authStore.ts`
- **Download state** → `frontend/src/contexts/DownloadContext.tsx`
- **API calls** → `frontend/src/services/api.ts`
- **Styling** → `frontend/tailwind.config.js`, `frontend/src/styles/index.css`
- **Mobile menu logic** → `frontend/src/hooks/useMobileMenu.ts`
- **PWA configuration** → `frontend/public/manifest.json`, `frontend/public/service-worker.js`
- **Docker setup** → `docker-compose.yml`, `Dockerfile`

---

## Tips for AI Agents

1. **Always read files before editing** - The Edit tool requires this
2. **Run builds to catch errors** - `npm run build` before committing
3. **Test mobile scenarios** - OAuth, safe areas, responsive design
4. **Check TypeScript types** - Many Plex API fields are optional
5. **Use parallel tool calls** - Read multiple files at once when possible
6. **Maintain consistent patterns** - Follow existing code structure
7. **Consider PWA implications** - Safe areas, popups, service workers
8. **Log appropriately** - Use Winston logger, include context
9. **Handle errors gracefully** - User-friendly messages, proper HTTP codes
10. **Document significant changes** - Update this file if architecture changes

---

## Getting Help

- **User Documentation**: See `README.md`
- **Plex API**: https://github.com/Arcanemagus/plex-api/wiki
- **React Router v6**: https://reactrouter.com/
- **Tailwind CSS**: https://tailwindcss.com/docs
- **Zustand**: https://github.com/pmndrs/zustand
- **PWA**: https://web.dev/progressive-web-apps/

---

**Last Updated**: 2025-11-07 (Session: claude/add-download-progress-bar-011CUsC4Kdw1m1yxqpX5x1oG)

**Maintenance Note**: When making significant architectural changes, please update this document to help future agents understand the codebase.
