#!/bin/bash
# Build TaskScore.app via xcodebuild
set -euo pipefail

cd "$(dirname "$0")"

echo "Building TaskScore app..."
xcodebuild -project TaskScore.xcodeproj -scheme TaskScore -configuration Release build

# Find the built .app in DerivedData
APP_PATH=$(xcodebuild -project TaskScore.xcodeproj -scheme TaskScore -configuration Release -showBuildSettings 2>/dev/null | grep -m1 'BUILT_PRODUCTS_DIR' | sed 's/.*= //')
echo ""
echo "Build succeeded."
echo "App location: $APP_PATH/TaskScore.app"
echo "Run with: open \"$APP_PATH/TaskScore.app\""
