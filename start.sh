#!/bin/bash

# Simple start script for POS System
# Use this if you don't want to use systemd service

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}=============================================="
echo -e "🚀 Starting POS System for GO COFFEE"
echo -e "==============================================${NC}"

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js is not installed!"
    echo -e "Please install Node.js first:${NC}"
    echo "curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -"
    echo "sudo apt-get install -y nodejs"
    exit 1
fi

# Check if npm dependencies are installed
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}📦 Installing dependencies...${NC}"
    npm install
fi

# Check if required files exist
if [ ! -f "server.js" ]; then
    echo -e "${RED}❌ server.js not found!"
    echo -e "Please make sure all files are in the current directory.${NC}"
    exit 1
fi

if [ ! -f "index.html" ]; then
    echo -e "${RED}❌ index.html not found!"
    echo -e "Please make sure all files are in the current directory.${NC}"
    exit 1
fi

# Get IP address for display
IP_ADDRESS=$(hostname -I | awk '{print $1}')

# Check printer
echo -e "${BLUE}🖨️  Checking printer status...${NC}"
if lpstat -p XPrinterXP &>/dev/null; then
    echo -e "${GREEN}✅ Printer XPrinterXP is ready${NC}"
else
    echo -e "${YELLOW}⚠️  Printer XPrinterXP not found or not ready${NC}"
    echo -e "${YELLOW}   The system will still work, but printing may fail${NC}"
fi

echo -e "${GREEN}✅ All checks passed!${NC}"
echo -e "${BLUE}=============================================="
echo -e "📍 Server will start on port 3000"
echo -e "🌐 Local access: http://localhost:3000"
echo -e "=============================================="
echo -e "Press Ctrl+C to stop the server"
echo -e "==============================================${NC}"

# Start the server
node server.js