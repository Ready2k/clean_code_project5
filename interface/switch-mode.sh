#!/bin/bash

echo "🔄 Prompt Library Interface Mode Switcher"
echo ""
echo "Choose which version to run:"
echo ""
echo "1) Demo Mode (UI only, no backend needed)"
echo "2) Full Version (complete app with backend & database)"
echo "3) Status Check (see what's available)"
echo ""
read -p "Enter your choice (1-3): " choice

case $choice in
    1)
        echo ""
        echo "🎮 Starting Demo Mode..."
        ./start-demo.sh
        ;;
    2)
        echo ""
        echo "🚀 Starting Full Version..."
        ./start-real.sh
        ;;
    3)
        echo ""
        echo "🔍 Checking System Status..."
        ./check-status.sh
        ;;
    *)
        echo ""
        echo "❌ Invalid choice. Please run the script again and choose 1, 2, or 3."
        exit 1
        ;;
esac