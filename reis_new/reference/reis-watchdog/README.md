# 🔍 REIS Watchdog - Form Monitoring & Testing System

A comprehensive testing framework for monitoring and validating web forms before deployment.

## 📋 Features

- **Real-time monitoring** of local mock forms during development
- **Automated form discovery** across multiple pages
- **Baseline snapshot** comparison to detect breaking changes
- **Regression testing** for all forms before deployment
- **CI/CD integration** ready

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Watch Mock Site (Development)
Monitor local mock-site for changes in real-time:
```bash
npm run watch
```

### 3. Discover All Forms (Initial Setup)
Scan your website and create a baseline snapshot of all forms:
```bash
npm run discover-forms
```

This will:
- Scan all URLs defined in `scripts/discover-forms.js`
- Extract complete form structures (inputs, selects, textareas, buttons)
- Save baseline to `baselines/forms-baseline-latest.json`

### 4. Run Regression Tests
Test all forms against the baseline:
```bash
npm run test:all-forms
```

### 5. Pre-Deployment Validation
Run the complete validation workflow before deploying:
```bash
npm run pre-deploy
```

This will:
1. Scan staging environment
2. Compare with production baseline
3. Run automated regression tests
4. Generate HTML report
5. Exit with error code if tests fail

## 📂 Project Structure

```
reis-watchdog/
├── scripts/
│   ├── discover-forms.js          # Scan pages and extract form structures
│   ├── compare-baselines.js       # Compare two baseline snapshots
│   └── pre-deployment-check.sh    # Full pre-deployment workflow
├── university-monitor/
│   ├── tests/
│   │   ├── form-integrity.spec.ts       # Original mock-site tests
│   │   └── all-forms-regression.spec.ts # Auto-generated tests for all forms
│   └── mock-site/
│       └── index.html             # Local mock form for testing
├── baselines/
│   ├── forms-baseline-latest.json      # Latest baseline snapshot
│   └── forms-baseline-production.json  # Production baseline
├── watch-mock-site.js             # Real-time file watcher
└── package.json
```

## 🔧 Configuration

### Add Pages to Scan

Edit `scripts/discover-forms.js` and add URLs to the `PAGES_TO_SCAN` array:

```javascript
const PAGES_TO_SCAN = [
  'https://is.mendelu.cz/auth/rozvrhy_view.pl',
  'https://is.mendelu.cz/auth/studium',
  'https://is.mendelu.cz/auth/prihlaska',
  // Add more here...
];
```

### Authentication

If your forms require authentication, update `scripts/discover-forms.js`:

```javascript
async function discoverForms() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  
  // Add authentication
  await context.addCookies([
    { name: 'session_id', value: 'your-session-token', domain: 'is.mendelu.cz', path: '/' }
  ]);
  
  const page = await context.newPage();
  // ... rest of code
}
```

Or use login flow:

```javascript
const page = await context.newPage();
await page.goto('https://is.mendelu.cz/login');
await page.fill('#username', process.env.USERNAME);
await page.fill('#password', process.env.PASSWORD);
await page.click('button[type="submit"]');
await page.waitForNavigation();
```

## 🎯 Workflow Examples

### Scenario 1: Initial Setup (First Time)

```bash
# 1. Scan production and create baseline
npm run discover-forms

# 2. Copy as production baseline
cp baselines/forms-baseline-latest.json baselines/forms-baseline-production.json
```

### Scenario 2: Before Deploying Changes

```bash
# 1. Scan staging environment
STAGING_URL=https://staging.is.mendelu.cz npm run discover-forms

# 2. Compare with production
npm run compare-baselines baselines/forms-baseline-production.json baselines/forms-baseline-latest.json

# 3. Run automated tests
npm run test:all-forms

# 4. Or run everything at once
npm run pre-deploy
```

### Scenario 3: Continuous Development

```bash
# Run file watcher while editing mock-site
npm run watch

# Make changes to university-monitor/mock-site/index.html
# See instant feedback in console
```

## 📊 Understanding Test Results

### ✅ No Changes
```
✅ No changes detected between baselines.
```
Safe to deploy!

### ⚠️ Warnings
```
⚠️  WARNINGS:
   ⚠️  https://... [Form 0]: New input added: "semester"
```
Review these changes - they might be intentional features.

### 🚨 Critical Changes
```
🚨 CRITICAL CHANGES:
   ❌ https://... [Form 0]: Input removed: "rozvrh_student"
   ❌ https://... [Form 1]: Form action changed: "/old" → "/new"
```
**DO NOT DEPLOY** until you understand why these critical changes occurred.

## 🔄 CI/CD Integration

### GitHub Actions Example

```yaml
name: Pre-Deployment Form Validation

on:
  pull_request:
    branches: [main]

jobs:
  form-validation:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm install
      
      - name: Install Playwright browsers
        run: npx playwright install --with-deps
      
      - name: Run form validation
        run: npm run pre-deploy
        env:
          STAGING_URL: ${{ secrets.STAGING_URL }}
      
      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: playwright-report
          path: playwright-report/
```

## 📝 NPM Scripts Reference

| Script | Description |
|--------|-------------|
| `npm run watch` | Watch mock-site for real-time changes |
| `npm run discover-forms` | Scan pages and create baseline |
| `npm run compare-baselines` | Compare two baseline files |
| `npm run test` | Run all Playwright tests |
| `npm run test:all-forms` | Run only form regression tests |
| `npm run pre-deploy` | Full pre-deployment validation |

## 🐛 Troubleshooting

### "No baseline found"
Run `npm run discover-forms` to create an initial baseline.

### "Form count changed"
The number of forms on a page changed. Verify if this is intentional.

### Authentication issues
Add login flow or cookies to `scripts/discover-forms.js` as shown in Configuration section.

### Tests timing out
Increase timeout in `playwright.config.ts`:
```typescript
export default defineConfig({
  timeout: 60000, // 60 seconds
  // ...
});
```

## 📚 Learn More

- [Playwright Documentation](https://playwright.dev)
- [Chokidar File Watching](https://github.com/paulmillr/chokidar)

## 📄 License

MIT
