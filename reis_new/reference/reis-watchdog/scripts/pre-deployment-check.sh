#!/bin/bash

###############################################################################
# Pre-deployment Form Validation Script
# Runs before deployment to ensure no critical form changes occurred
###############################################################################

set -e # Exit on error

echo "🔍 REIS Watchdog - Pre-Deployment Form Validation"
echo "=================================================="
echo ""

# Configuration
STAGING_URL="${STAGING_URL:-https://staging.is.mendelu.cz}"
PRODUCTION_URL="${PRODUCTION_URL:-https://is.mendelu.cz}"
BASELINE_DIR="baselines"
REPORT_DIR="test-results"

# Create directories if they don't exist
mkdir -p "$BASELINE_DIR"
mkdir -p "$REPORT_DIR"

# Step 1: Discover forms on staging
echo "📊 Step 1: Scanning staging environment..."
PAGES_TO_SCAN="$STAGING_URL" node scripts/discover-forms.js

# Step 2: Compare with production baseline
echo ""
echo "🔄 Step 2: Comparing with production baseline..."

if [ ! -f "$BASELINE_DIR/forms-baseline-latest.json" ]; then
  echo "⚠️  WARNING: No production baseline found!"
  echo "   Creating initial baseline from staging..."
  cp "$BASELINE_DIR/forms-baseline-latest.json" "$BASELINE_DIR/forms-baseline-production.json"
else
  # Run comparison
  node scripts/compare-baselines.js \
    "$BASELINE_DIR/forms-baseline-production.json" \
    "$BASELINE_DIR/forms-baseline-latest.json"
fi

# Step 3: Run Playwright tests
echo ""
echo "🧪 Step 3: Running automated form regression tests..."

# Start mock server for form-integrity tests
echo "🚀 Starting mock server..."
npm run start-server > /dev/null 2>&1 &
MOCK_SERVER_PID=$!

# Ensure mock server is killed on exit
trap "kill $MOCK_SERVER_PID" EXIT

# Wait for server to start
sleep 5

npm test -- --reporter=list --reporter=html --reporter=json

# Step 4: Check test results
if [ $? -eq 0 ]; then
  echo ""
  echo "✅ All form integrity tests passed!"
  echo "   Safe to deploy."
  exit 0
else
  echo ""
  echo "❌ Form integrity tests FAILED!"
  echo "   DO NOT DEPLOY until issues are resolved."
  echo "   Check the report: $REPORT_DIR/index.html"
  exit 1
fi
