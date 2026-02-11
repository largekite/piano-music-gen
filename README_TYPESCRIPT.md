# 🎹 Piano Music Generator - TypeScript Edition

Modern, mobile-responsive web application for generating piano MIDI music using AI. Complete rewrite with Next.js + React frontend and Python FastAPI backend.

## ✨ Features

- **🤖 Multiple AI Backends**:
  - HuggingFace Space (Cloud AI)
  - Google Magenta (Local ML)
  - Simple MIDI (Fallback)

- **⚡ Real-time Updates**: WebSocket-based progress tracking
- **🎵 MIDI Playback**: In-browser player with Tone.js
- **📱 Mobile-First**: Fully responsive design
- **📊 File Management**: Browse, search, download, delete

## 🚀 Quick Start

### 1. Backend Setup

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:application --reload --port 8000
```

Backend: http://localhost:8000
API Docs: http://localhost:8000/docs

### 2. Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

Frontend: http://localhost:3000

## 📖 Usage

1. Open http://localhost:3000
2. Select backend (HuggingFace/Magenta/Simple)
3. Configure parameters (Style, Key, Tempo, Mood, Duration)
4. Click "Generate Music"
5. Watch real-time progress
6. Listen with built-in player or download

## 🏗️ Architecture

- **Frontend**: Next.js 14, React, TypeScript, Tailwind CSS, Tone.js
- **Backend**: FastAPI, Python, WebSocket, Magenta ML
- **Communication**: REST API + WebSocket for real-time updates

## 📁 Key Files

### Backend
- `backend/app/main.py` - FastAPI app
- `backend/app/services/generation_service.py` - Generation orchestrator
- `backend/app/api/` - API endpoints

### Frontend
- `frontend/app/page.tsx` - Main page
- `frontend/components/` - React components
- `frontend/lib/hooks/useGeneration.ts` - WebSocket hook

## 🔧 Configuration

Create `.env.local` in frontend:
```env
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_WS_URL=http://localhost:8000
```

## 📝 Documentation

- [Implementation Status](IMPLEMENTATION_STATUS.md) - Detailed progress
- [Original App](app_streamlit.py) - Reference
- [API Docs](http://localhost:8000/docs) - Auto-generated

## 🎯 Differences from Original

| Feature | Original (Streamlit) | New (Next.js) |
|---------|---------------------|---------------|
| Framework | Python/Streamlit | Next.js/React |
| Real-time | Polling | WebSocket |
| Mobile | Limited | Fully responsive |
| Player | Download only | In-browser playback |
| File Management | Last 10 files | Full search/filter |

---

**Status**: Backend 100% complete, Frontend 80% complete

**See**: [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md) for detailed progress
