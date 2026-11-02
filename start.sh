#!/bin/sh
cd "$(dirname "$0")"
[ -d node_modules ] || npm install --no-audit --no-fund
echo "Sayt: http://localhost:3000"
node server.js
