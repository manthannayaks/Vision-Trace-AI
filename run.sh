#!/bin/bash
# VisionTrack AI - Launch Script
# Starts both the FastAPI Backend and Vite React Frontend

echo "=========================================================="
echo "          Starting VisionTrack AI System                  "
echo "=========================================================="

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# 1. Start Backend
echo "[1/2] Launching FastAPI Backend on http://localhost:8000..."
cd "$ROOT_DIR/backend"
source venv/bin/activate
uvicorn app.main:app --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!

# 2. Start Frontend
echo "[2/2] Launching React + Vite Frontend on http://localhost:5173..."
cd "$ROOT_DIR/frontend"
npm run dev &
FRONTEND_PID=$!

echo ""
echo "VisionTrack AI is live!"
echo "-> Frontend Dashboard:  http://localhost:5173"
echo "-> Backend API Docs:    http://localhost:8000/docs"
echo "-> System Health:       http://localhost:8000/api/health"
echo ""
echo "Press Ctrl+C to shut down both servers."

trap "echo 'Stopping VisionTrack AI...'; kill $BACKEND_PID $FRONTEND_PID; exit 0" SIGINT SIGTERM

wait

