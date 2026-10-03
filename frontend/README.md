# Frontend (React + TypeScript + Vite)

Barebone React frontend configured for the FastAPI backend.

## Scripts

```bash
# Start Vite development server (port 3000)
npm run dev

# Build production bundle
npm run build

# Preview production build locally
npm run preview
```

## Backend API Proxy

During local development, API requests directed to `/api` and `/healthz` are automatically proxied to the FastAPI server running on `http://localhost:8000` via [vite.config.ts](file:///Users/ajk/personal/careerTrack/frontend/vite.config.ts).
