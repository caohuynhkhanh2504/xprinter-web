#!/bin/bash

# POS System Setup Script for Armbian Box
# Run this script to set up the complete POS system

echo "=============================================="
echo "🚀 Setting up POS System for GO COFFEE"
echo "=============================================="

# Check if running as root
if [ "$EUID" -eq 0 ]; then
    echo "⚠️  Please don't run this script as root"
    exit 1
fi

# Create project directory
PROJECT_DIR="$HOME/pos-system"
echo "📁 Creating project directory: $PROJECT_DIR"

if [ -d "$PROJECT_DIR" ]; then
    echo "⚠️  Directory already exists. Backing up..."
    mv "$PROJECT_DIR" "$PROJECT_DIR.backup.$(date +%Y%m%d_%H%M%S)"
fi

mkdir -p "$PROJECT_DIR"
cd "$PROJECT_DIR"

# Install Node.js if not installed
echo "🔍 Checking Node.js installation..."
if ! command -v node &> /dev/null; then
    echo "📦 Installing Node.js..."
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    sudo apt-get install -y nodejs
else
    echo "✅ Node.js is already installed: $(node --version)"
fi

# Install npm if not installed
if ! command -v npm &> /dev/null; then
    echo "📦 Installing npm..."
    sudo apt-get install -y npm
else
    echo "✅ npm is already installed: $(npm --version)"
fi

# Create logo.txt file (ESC/POS commands for logo)
echo "🖼️  Creating logo file..."
cat > logo.txt << 'EOF'
[1B][40][1B][61][01]
    ┌─────────────────────┐
    │     ☕ GO COFFEE ☕   │
    └─────────────────────┘
EOF

# Create qr.txt file (placeholder ESC/POS QR code)
echo "📱 Creating QR code file..."
cat > qr.txt << 'EOF'
[1D][6B][51][04][1A][00]QR_CODE_DATA_HERE[1D][6B][51][03][00]
     ▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄
     █ ▄▄▄▄▄ █▀█ █ ▄▄▄▄▄ █
     █ █   █ █▀▀ █ █   █ █
     █ █▄▄▄█ █▀█ █ █▄▄▄█ █
     █▄▄▄▄▄▄▄█▄█▄█▄▄▄▄▄▄▄█
     █▄▄█▄▄▄█ ▄▄▄ ▄█▄█▄▄▄█
     ████▄██▄▀▄█▄▀▄█▄▄█▄██
     █▄▄▄▄▄▄▄█▄▄▄█▄▄▄▄▄▄▄█
EOF

# Create package.json
echo "📄 Creating package.json..."
cat > package.json << 'EOF'
{
  "name": "pos-system",
  "version": "1.0.0",
  "description": "POS System for GO COFFEE with thermal printer support",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js",
    "install-service": "npm install -g pm2 && pm2 start server.js --name pos-system",
    "service-start": "pm2 start pos-system",
    "service-stop": "pm2 stop pos-system",
    "service-restart": "pm2 restart pos-system",
    "service-status": "pm2 status pos-system"
  },
  "keywords": [
    "pos",
    "thermal-printer",
    "receipt",
    "coffee-shop",
    "armbian"
  ],
  "author": "GO COFFEE",
  "license": "MIT",
  "dependencies": {
    "express": "^4.18.2"
  },
  "devDependencies": {
    "nodemon": "^3.0.1"
  },
  "engines": {
    "node": ">=14.0.0"
  }
}
EOF

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Create systemd service file
echo "⚙️  Creating systemd service..."
sudo tee /etc/systemd/system/pos-system.service > /dev/null << EOF
[Unit]
Description=POS System for GO COFFEE
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$PROJECT_DIR
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=3
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF

# Enable and start service
echo "🔧 Enabling POS system service..."
sudo systemctl daemon-reload
sudo systemctl enable pos-system
sudo systemctl start pos-system

# Check printer setup
echo "🖨️  Checking printer setup..."
if lpstat -p 2>/dev/null | grep -q "XPrinterXP"; then
    echo "✅ Printer XPrinterXP found"
else
    echo "⚠️  Printer XPrinterXP not found. Please set up your printer first:"
    echo "   1. Connect your thermal printer"
    echo "   2. Run: sudo lpadmin -p XPrinterXP -E -v usb://path/to/printer"
    echo "   3. Or use system-config-printer to add the printer"
fi

# Get IP address
IP_ADDRESS=$(hostname -I | awk '{print $1}')

echo "=============================================="
echo "✅ POS System setup completed!"
echo "=============================================="
echo "📍 Project location: $PROJECT_DIR"
echo "🌐 Web interface: http://$IP_ADDRESS:3000"
echo "🖨️  Printer: XPrinterXP"
echo "🔧 Service status: $(systemctl is-active pos-system)"
echo ""
echo "📱 Access from other devices on the same network:"
echo "   http://$IP_ADDRESS:3000"
echo ""
echo "🔧 Service management commands:"
echo "   sudo systemctl start pos-system    # Start service"
echo "   sudo systemctl stop pos-system     # Stop service"
echo "   sudo systemctl restart pos-system  # Restart service"
echo "   sudo systemctl status pos-system   # Check status"
echo ""
echo "📋 Log files:"
echo "   sudo journalctl -u pos-system -f   # Follow logs"
echo "=============================================="