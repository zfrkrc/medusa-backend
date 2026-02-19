#!/bin/bash

# Medusa V2 Service Connectivity Test Script
# Developed for Debian/Linux environments (can be run on Windows via Git Bash/WSL)

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo "------------------------------------------------"
echo "🔍 Starting Medusa V2 Service Connectivity Test"
echo "------------------------------------------------"

# 1. Test Medusa Backend (Port 7001)
echo -n "Checking Medusa Backend (Port 7001)... "
wget --spider -q --tries=1 --timeout=5 http://localhost:7001/health
if [ $? -eq 0 ]; then
    echo -e "${GREEN}PASS${NC}"
else
    echo -e "${RED}FAIL${NC} (Backend not reachable at http://localhost:7001/health)"
fi

# 2. Test Medusa Admin UI (Port 9000)
echo -n "Checking Medusa Admin UI (Port 9000)... "
# Nginx health check path is /health, but we also check the app root
wget --spider -q --tries=1 --timeout=5 http://localhost:9000/health
if [ $? -eq 0 ]; then
    echo -e "${GREEN}PASS${NC} (Nginx OK)"
else
    echo -e "${RED}FAIL${NC} (Admin UI not reachable at http://localhost:9000/health)"
fi

# 3. Test Admin UI Asset Accessibility
echo -n "Checking Admin UI Index File... "
wget --spider -q --tries=1 --timeout=5 http://localhost:9000/app/index.html
if [ $? -eq 0 ]; then
    echo -e "${GREEN}PASS${NC}"
else
    echo -e "${RED}FAIL${NC} (Static assets not found at http://localhost:9000/app/index.html)"
fi

echo "------------------------------------------------"
echo "✅ Test Completed"
echo "------------------------------------------------"
