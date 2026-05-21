#!/bin/bash
echo "============================================"
echo "  AI Novel Pipeline - Startup Script"
echo "============================================"
echo ""

command -v node >/dev/null 2>&1 || { echo "[ERROR] Node.js not found. Install from https://nodejs.org/"; exit 1; }

echo "[1/4] Checking backend dependencies..."
if [ ! -d "server/node_modules" ]; then
    echo "Installing backend dependencies..."
    (cd server && npm install)
else
    echo "Backend dependencies ready"
fi

echo "[2/4] Checking frontend dependencies..."
if [ ! -d "client/node_modules" ]; then
    echo "Installing frontend dependencies..."
    (cd client && npm install)
else
    echo "Frontend dependencies ready"
fi

echo "[3/4] Checking environment config..."
if [ ! -f "server/.env" ]; then
    echo "Creating default .env..."
    cat > server/.env << 'EOF'
MINIMAX_API_KEY=your_api_key_here
MINIMAX_GROUP_ID=your_group_id_here
MINIMAX_MODEL=MiniMax-M2.7
PORT=3001
EOF
    echo "[NOTE] Created server/.env - Please edit with your API Key!"
fi

echo "[4/4] Starting services..."
echo ""
echo "Starting backend (port 3001)..."
(cd server && node index.js) &
SERVER_PID=$!
sleep 3

echo "Starting frontend (port 5173)..."
(cd client && npx vite --host) &
CLIENT_PID=$!

echo ""
echo "============================================"
echo "  Startup complete!"
echo "  Frontend: http://localhost:5173"
echo "  Backend:  http://localhost:3001"
echo "============================================"
echo ""
echo "Press Ctrl+C to stop all services"

trap "kill $SERVER_PID $CLIENT_PID 2>/dev/null; exit" INT TERM
wait
