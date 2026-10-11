#!/bin/bash
cd /c/Users/mingy/Desktop/trae/novel-pipeline
export NODE_PATH=/c/Users/mingy/Desktop/trae/novel-pipeline/server
node --max-old-space-size=6000 --max-semi-space-size=256 \
  --heapsnapshot-near-heap-limit=4500 \
  --require ./scripts/verify-2026-10-11/mem_watchdog.js \
  server/index.js
