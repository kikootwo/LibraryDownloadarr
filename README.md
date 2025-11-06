# PlexDownloadarr

> Your Plex library, ready to download

PlexDownloadarr is a modern web application that provides a user-friendly interface for downloading media from a Plex Media Server. It integrates with Plex's authentication system and respects user permissions, while presenting library content in a sleek, browsable interface similar to Overseerr or Wizarr.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Docker](https://img.shields.io/badge/docker-ready-brightgreen.svg)

## Features

- **Local Admin Setup**: First-time setup wizard for creating local admin account
- **Plex OAuth Authentication**: Users sign in with their Plex accounts
- **Library Browsing**: Display movies and TV shows with posters, titles, descriptions, and metadata
- **Search Functionality**: Search across all accessible libraries
- **One-Click Downloads**: Download original media files with a single click
- **Permission Respect**: Honor Plex's user access controls and library restrictions
- **Responsive Design**: Mobile-friendly interface that works on all devices
- **Modern Dark Theme**: Aesthetic matching the *arr ecosystem (Sonarr, Radarr, Overseerr)

## Tech Stack

### Backend
- Node.js + Express + TypeScript
- SQLite database (via better-sqlite3)
- Plex API integration
- JWT authentication

### Frontend
- React 18 + TypeScript
- Vite (build tool)
- Tailwind CSS (styling)
- Zustand (state management)
- React Router (routing)

## Quick Start with Docker (Recommended)

### Prerequisites
- Docker and Docker Compose installed
- Plex Media Server running and accessible
- Plex authentication token (can be configured during setup)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/PlexDownloadarr.git
cd PlexDownloadarr
```

2. Create environment file:
```bash
cp .env.example .env
```

3. Edit `.env` and set your configuration (or configure via web UI later):
```env
# IMPORTANT: Change these secrets in production!
JWT_SECRET=your-super-secret-jwt-key-change-this
SESSION_SECRET=your-super-secret-session-key-change-this

# Plex configuration (can be set via web UI)
PLEX_URL=http://your-plex-server:32400
PLEX_TOKEN=your-plex-token
```

4. Start the application:
```bash
docker-compose up -d
```

5. Access the application at `http://localhost:5069`

6. Complete the initial setup wizard:
   - Create your admin account
   - Configure Plex server connection
   - Start browsing and downloading!

## Manual Installation (Development)

### Prerequisites
- Node.js 20+ and npm
- Plex Media Server

### Backend Setup

```bash
cd backend
npm install
cp .env.example .env
# Edit .env with your configuration
npm run dev
```

The backend will start on `http://localhost:5069`

### Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

The frontend will start on `http://localhost:3000` and proxy API requests to the backend.

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `5069` |
| `NODE_ENV` | Environment (development/production) | `development` |
| `BASE_URL` | Base URL for the application | `http://localhost:5069` |
| `PLEX_URL` | Plex Media Server URL | - |
| `PLEX_TOKEN` | Plex authentication token | - |
| `JWT_SECRET` | Secret for JWT tokens | (change in production!) |
| `SESSION_SECRET` | Secret for session management | (change in production!) |
| `DATABASE_PATH` | Path to SQLite database | `./data/plexdownloadarr.db` |
| `LOG_LEVEL` | Logging level (info/debug/warn/error) | `info` |

### Docker Volumes

The docker-compose setup mounts two directories:
- `./data` - Database and application data (persistent)
- `./logs` - Application logs

## Usage

### First-Time Setup

1. Navigate to PlexDownloadarr URL
2. You'll be redirected to the setup page
3. Create an admin account:
   - Username
   - Password
   - Email
4. Configure Plex connection (optional at this stage):
   - Plex Server URL
   - Plex Token
5. Click "Complete Setup"

### Admin Login

Use the admin credentials you created during setup to log in at `/login`.

### Plex User Login

1. Click "Sign in with Plex"
2. Authorize in the Plex window
3. You'll be automatically logged in

### Browsing and Downloading

1. Select a library from the sidebar
2. Browse through your media with posters and metadata
3. Click on any item to view details
4. Click "Download" to download the media file

### Settings (Admin Only)

Access `/settings` to configure:
- Plex server URL
- Plex authentication token
- Test Plex connection

## API Documentation

### Authentication Endpoints

- `GET /api/auth/setup/required` - Check if setup is required
- `POST /api/auth/setup` - Complete initial setup
- `POST /api/auth/login` - Admin login
- `POST /api/auth/plex/pin` - Generate Plex PIN for OAuth
- `POST /api/auth/plex/authenticate` - Authenticate with Plex PIN
- `GET /api/auth/me` - Get current user
- `POST /api/auth/logout` - Logout

### Library Endpoints

- `GET /api/libraries` - Get all libraries
- `GET /api/libraries/:libraryKey/content` - Get library content

### Media Endpoints

- `GET /api/media/search?q=query` - Search media
- `GET /api/media/:ratingKey` - Get media metadata
- `GET /api/media/:ratingKey/download?partKey=key` - Download media file
- `GET /api/media/thumb/:ratingKey?path=path` - Get thumbnail/poster

### Settings Endpoints (Admin Only)

- `GET /api/settings` - Get settings
- `PUT /api/settings` - Update settings
- `POST /api/settings/test-connection` - Test Plex connection

## Project Structure

```
PlexDownloadarr/
├── backend/                 # Backend (Node.js + Express)
│   ├── src/
│   │   ├── config/         # Configuration
│   │   ├── middleware/     # Express middleware
│   │   ├── models/         # Database models
│   │   ├── routes/         # API routes
│   │   ├── services/       # Business logic (Plex service)
│   │   ├── utils/          # Utilities (logger)
│   │   └── index.ts        # Entry point
│   ├── package.json
│   └── tsconfig.json
├── frontend/               # Frontend (React + TypeScript)
│   ├── src/
│   │   ├── components/    # React components
│   │   ├── pages/         # Page components
│   │   ├── services/      # API client
│   │   ├── stores/        # State management (Zustand)
│   │   ├── styles/        # Global styles
│   │   ├── types/         # TypeScript types
│   │   ├── App.tsx        # Main app component
│   │   └── main.tsx       # Entry point
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   └── tailwind.config.js
├── Dockerfile             # Docker configuration
├── docker-compose.yml     # Docker Compose configuration
└── README.md             # This file
```

## Security Considerations

- Always change `JWT_SECRET` and `SESSION_SECRET` in production
- Use HTTPS in production (configure reverse proxy)
- Plex tokens are stored encrypted in the database
- Rate limiting is enabled on API endpoints
- Sessions expire after 24 hours
- CSRF protection is implemented

## Troubleshooting

### Cannot connect to Plex server

1. Verify Plex URL is correct and accessible
2. Verify Plex token is valid
3. Check firewall rules
4. Use "Test Connection" in settings

### Downloads not working

1. Ensure user has proper Plex permissions
2. Check that Plex server is accessible from PlexDownloadarr
3. Verify file exists in Plex library

### Frontend not loading

1. Check that backend is running
2. Verify port 5069 is accessible
3. Check browser console for errors

## Development

### Backend Development

```bash
cd backend
npm run dev  # Starts with nodemon for auto-reload
```

### Frontend Development

```bash
cd frontend
npm run dev  # Starts Vite dev server with HMR
```

### Building for Production

```bash
# Backend
cd backend
npm run build

# Frontend
cd frontend
npm run build

# Or use Docker
docker-compose build
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License.

## Acknowledgments

- Inspired by [Overseerr](https://overseerr.dev) and [Wizarr](https://wizarr.dev)
- Built with [Plex API](https://github.com/phillipj/node-plex-api)
- UI design inspired by the *arr ecosystem

## Roadmap

### Future Features

- Batch downloads (download multiple items as zip)
- Quality selection (if multiple versions exist)
- Download queue with progress tracking
- Recently added media section
- Collections support
- User management dashboard for admins
- Advanced filters (genre, year, rating, resolution)
- Continue watching integration
- Download history and statistics
- Mobile app (React Native)

## Support

For issues, questions, or feature requests, please open an issue on GitHub.

---

Made with ❤️ for the Plex community
