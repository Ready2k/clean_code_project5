#!/bin/bash

echo "🔄 Prompt Library Interface Launcher"
echo ""
echo "Choose an option:"
echo ""
echo "1) Full Version (complete app with backend & database)"
echo "2) Status Check (see what's available)"
echo ""
read -p "Enter your choice (1-2): " choice

case $choice in
    1)
        echo ""
        echo "🚀 Starting Full Version..."
        ./start-real.sh
        ;;
    2)
        echo ""
        echo "🔍 Checking System Status..."
        ./check-status.sh
        ;;
    *)
        echo ""
        echo "❌ Invalid choice. Please run the script again and choose 1 or 2."
        exit 1
        ;;
esac