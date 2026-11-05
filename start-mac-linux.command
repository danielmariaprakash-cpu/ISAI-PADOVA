#!/bin/sh
cd "$(dirname "$0")"
command -v node >/dev/null || { echo "Node.js is not installed. Get it from https://nodejs.org (LTS) and run this again."; exit 1; }
U=http://localhost:3000
( sleep 2
  if [ "$(uname)" = "Darwin" ]; then open -a "Google Chrome" "$U" 2>/dev/null || open "$U"
  else google-chrome "$U" 2>/dev/null || chromium "$U" 2>/dev/null || chromium-browser "$U" 2>/dev/null || xdg-open "$U"; fi ) >/dev/null 2>&1 &
node server.js
