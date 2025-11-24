require('dotenv').config();
const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

/**
 * Discovers all forms on specified pages and creates a baseline snapshot
 * Usage: node scripts/discover-forms.js
 */

const PAGES_TO_SCAN = [
    // 'http://localhost:8080',

    // --- REIS Dependencies ---

    // 1. Schedule Fetcher (POST)
    // Used by: fetchDayScheduele, fetchWeekScheduele
    'https://is.mendelu.cz/auth/katalog/rozvrhy_view.pl',

    // 2. User ID Fetcher (GET)
    // Used by: App.tsx (to get current user ID)
    'https://is.mendelu.cz/auth/student/studium.pl',

    // 3. Subjects List Fetcher (GET)
    // Used by: fetchSubjects (utils_shared.ts)
    'https://is.mendelu.cz/auth/student/list.pl',

    // 4. Files Search (POST)
    // Used by: fetchServerFilesById (utils_shared.ts)
    'https://is.mendelu.cz/auth/dok_server/vyhledavani.pl',

    // 5. Other Links (App.tsx)
    'https://is.mendelu.cz/auth/student/moje_studium.pl',
    'https://is.mendelu.cz/auth/student/hodnoceni.pl',
    'https://is.mendelu.cz/auth/katalog/plany.pl',
    'https://is.mendelu.cz/auth/dok_server/slozka.pl', // Generic folder URL
];

// Selectors for login verification
const LOGIN_SELECTORS = {
    LOGOUT_BTN: 'a[href*="logout"]', // Generic logout link
    LOGOUT_CZ: 'a[href*="odhlas"]',  // Czech logout link
    USER_INFO: '.user-info',         // Hypothetical user info section
    AUTH_AREA: 'body.auth-area'      // Hypothetical body class
};

async function checkLoginState(page) {
    // Check for common signs of being logged in
    const logoutLink = await page.locator('a[href*="logout.pl"], a[href*="odhlaseni.pl"]').count();
    if (logoutLink > 0) return true;

    // Check if we are on the login page (definitely not logged in)
    const loginForm = await page.locator('form[action*="login.pl"]').count();
    if (loginForm > 0) return false;

    // If we are in the /auth/ path and not on login page, we might be good, 
    // but let's be strict.
    const url = page.url();
    if (url.includes('/auth/') && !url.includes('login.pl')) {
        return true;
    }

    return false;
}

async function performLogin(page, username, password) {
    console.log('🔐 Attempting login...');
    try {
        await page.goto('https://is.mendelu.cz/auth/login.pl');

        // Check if we were redirected immediately (already logged in)
        if (page.url().includes('/auth/') && !page.url().includes('login.pl')) {
            console.log('   ℹ️  Already logged in (redirected from login page).');
            return true;
        }

        // Check if login form is present
        const loginInputCount = await page.locator('input[name="credential_0"]').count();
        if (loginInputCount === 0) {
            // We are not on login page and not in auth (unexpected), or maybe structure changed
            // But let's check if we are in auth anyway
            if (await checkLoginState(page)) {
                console.log('   ✅ Already logged in.');
                return true;
            }
            console.error('   ❌ Not on login page and not logged in. Current URL:', page.url());
            return false;
        }

        await page.fill('input[name="credential_0"]', username);
        await page.fill('input[name="credential_1"]', password);
        await page.click('input[type="submit"]');

        // Wait for navigation and a clear sign of success
        await page.waitForLoadState('networkidle');

        // Check if we are redirected to a logged-in area
        // Mendelu usually redirects to /auth/student/studium.pl or similar
        try {
            await page.waitForURL('**/auth/**', { timeout: 15000 });
        } catch (e) {
            console.log('   ⚠️  Timed out waiting for redirect, checking state anyway...');
        }

        // Verify session cookie
        const cookies = await page.context().cookies();
        if (cookies.length > 0) {
            console.log(`   🍪 Cookies set: ${cookies.length} (Domains: ${[...new Set(cookies.map(c => c.domain))].join(', ')})`);
        }

        const isLoggedIn = await checkLoginState(page);
        if (isLoggedIn) {
            console.log('✅ Login successful!');
            return true;
        } else {
            console.warn('⚠️  Login appeared to succeed but validation failed (could not find logout link). Assuming success if in /auth/.');
            return page.url().includes('/auth/');
        }
    } catch (error) {
        console.error('❌ Login failed:', error.message);
        return false;
    }
}

async function extractFormStructure(page, url) {
    try {
        await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
    } catch (error) {
        console.error(`   ⚠️  Navigation error (will try to extract anyway): ${error.message}`);
    }

    // Session Recovery Check
    const isLoginPage = await page.locator('form[action*="login.pl"]').count() > 0;
    if (isLoginPage && url.includes('/auth/') && !url.includes('login.pl')) {
        console.warn('   ⚠️  Redirected to login page! Session might be lost.');
        // We could attempt re-login here, but for now, let's just report it.
        // To implement recovery, we'd need to pass credentials to this function or make it recursive.
    }

    const forms = await page.$$('form');
    const formData = [];

    for (let i = 0; i < forms.length; i++) {
        const form = forms[i];

        const structure = await form.evaluate((formEl, index) => {
            // Extract form attributes
            const action = formEl.getAttribute('action') || '';
            const method = formEl.getAttribute('method') || 'get';
            const name = formEl.getAttribute('name') || `form-${index}`;
            const id = formEl.getAttribute('id') || '';

            // Extract all inputs
            const inputs = Array.from(formEl.querySelectorAll('input')).map(input => ({
                name: input.getAttribute('name') || '',
                type: input.getAttribute('type') || 'text',
                id: input.getAttribute('id') || '',
                required: input.hasAttribute('required'),
                value: input.getAttribute('value') || ''
            }));

            // Extract all selects
            const selects = Array.from(formEl.querySelectorAll('select')).map(select => ({
                name: select.getAttribute('name') || '',
                id: select.getAttribute('id') || '',
                required: select.hasAttribute('required'),
                optionCount: select.querySelectorAll('option').length
            }));

            // Extract all textareas
            const textareas = Array.from(formEl.querySelectorAll('textarea')).map(textarea => ({
                name: textarea.getAttribute('name') || '',
                id: textarea.getAttribute('id') || '',
                required: textarea.hasAttribute('required')
            }));

            // Extract buttons
            const buttons = Array.from(formEl.querySelectorAll('button, input[type="submit"]')).map(btn => ({
                type: btn.tagName.toLowerCase(),
                value: btn.getAttribute('value') || btn.textContent.trim(),
                name: btn.getAttribute('name') || ''
            }));

            return {
                formIndex: index,
                attributes: { action, method, name, id },
                inputs,
                selects,
                textareas,
                buttons,
                totalElements: inputs.length + selects.length + textareas.length
            };
        }, i);

        formData.push(structure);
    }

    return formData;
}

async function discoverForms() {
    const browser = await chromium.launch({ headless: true });
    // Create a persistent context to hold cookies
    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });
    const page = await context.newPage();

    const inventory = {};

    console.log('🔍 Starting form discovery...\n');

    // Check for credentials
    const username = process.env.MENDELU_USER;
    const password = process.env.MENDELU_PASS;
    let loggedIn = false;

    if (username && password) {
        loggedIn = await performLogin(page, username, password);
    } else {
        console.log('⚠️  No credentials provided (MENDELU_USER/MENDELU_PASS).');
        console.log('   Scanning public pages only.\n');
    }

    for (const url of PAGES_TO_SCAN) {
        console.log(`📄 Scanning: ${url}`);

        // Auto-recovery: If we should be logged in but aren't, try again
        if (username && password && !loggedIn) {
            console.log('   🔄 Session lost or not established. Retrying login...');
            loggedIn = await performLogin(page, username, password);
        }

        try {
            const forms = await extractFormStructure(page, url);

            // Check if we got the login form instead of the target
            const isLoginForm = forms.some(f => f.attributes.action && f.attributes.action.includes('login.pl'));
            if (isLoginForm && url.includes('/auth/') && !url.includes('login.pl')) {
                console.warn('   ⚠️  Warning: Captured login form instead of target content.');
                loggedIn = false; // Mark session as lost for next iteration
            }

            inventory[url] = {
                scannedAt: new Date().toISOString(),
                formCount: forms.length,
                forms
            };

            console.log(`   ✓ Found ${forms.length} form(s)`);
            forms.forEach((form, idx) => {
                console.log(`     - Form ${idx}: ${form.attributes.action || 'no action'} (${form.totalElements} elements)`);
            });

        } catch (error) {
            console.error(`   ✗ Error scanning ${url}:`, error.message);
            inventory[url] = {
                error: error.message,
                scannedAt: new Date().toISOString()
            };
        }

        console.log('');
    }

    await browser.close();

    // Save baseline snapshot
    const baselineDir = path.join(__dirname, '..', 'baselines');
    if (!fs.existsSync(baselineDir)) {
        fs.mkdirSync(baselineDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const baselinePath = path.join(baselineDir, `forms-baseline-${timestamp}.json`);
    const latestPath = path.join(baselineDir, 'forms-baseline-latest.json');

    fs.writeFileSync(baselinePath, JSON.stringify(inventory, null, 2));
    fs.writeFileSync(latestPath, JSON.stringify(inventory, null, 2));

    console.log(`\n✅ Baseline saved to:`);
    console.log(`   - ${baselinePath}`);
    console.log(`   - ${latestPath}`);

    return inventory;
}

// Run if called directly
if (require.main === module) {
    discoverForms().catch(console.error);
}

module.exports = { discoverForms, extractFormStructure };
