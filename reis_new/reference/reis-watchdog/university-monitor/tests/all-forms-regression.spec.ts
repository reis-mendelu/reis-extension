import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

/**
 * Automated form regression tests
 * Compares current form structures against the baseline
 */

const BASELINE_PATH = path.join(__dirname, '../../baselines/forms-baseline-latest.json');

// Load baseline
let baseline: any = {};
if (fs.existsSync(BASELINE_PATH)) {
    baseline = JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8'));
} else {
    console.warn('⚠️  No baseline found. Run `npm run discover-forms` first.');
}

/**
 * Helper to extract form structure (same logic as discover-forms.js)
 */
async function extractFormStructure(page: any, formIndex: number) {
    const forms = await page.$$('form');
    if (formIndex >= forms.length) return null;

    const form = forms[formIndex];

    return await form.evaluate((formEl: any, index: number) => {
        const action = formEl.getAttribute('action') || '';
        const method = formEl.getAttribute('method') || 'get';
        const name = formEl.getAttribute('name') || `form-${index}`;
        const id = formEl.getAttribute('id') || '';

        const inputs = Array.from(formEl.querySelectorAll('input')).map((input: any) => ({
            name: input.getAttribute('name') || '',
            type: input.getAttribute('type') || 'text',
            id: input.getAttribute('id') || '',
            required: input.hasAttribute('required'),
            value: input.getAttribute('value') || ''
        }));

        const selects = Array.from(formEl.querySelectorAll('select')).map((select: any) => ({
            name: select.getAttribute('name') || '',
            id: select.getAttribute('id') || '',
            required: select.hasAttribute('required'),
            optionCount: select.querySelectorAll('option').length
        }));

        const textareas = Array.from(formEl.querySelectorAll('textarea')).map((textarea: any) => ({
            name: textarea.getAttribute('name') || '',
            id: textarea.getAttribute('id') || '',
            required: textarea.hasAttribute('required')
        }));

        const buttons = Array.from(formEl.querySelectorAll('button, input[type="submit"]')).map((btn: any) => ({
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
    }, formIndex);
}

// Generate tests dynamically for each page in baseline
for (const [url, pageData] of Object.entries(baseline)) {
    if ((pageData as any).error) {
        test.skip(`${url} - skipped due to baseline error`, () => { });
        continue;
    }

    const forms = (pageData as any).forms || [];

    test.describe(`Form Integrity: ${url}`, () => {

        test(`should have ${forms.length} form(s)`, async ({ page }) => {
            await page.goto(url);
            const currentForms = await page.$$('form');
            expect(currentForms.length).toBe(forms.length);
        });

        // Test each form individually
        forms.forEach((baselineForm: any, formIdx: number) => {
            test(`Form ${formIdx}: structure matches baseline`, async ({ page }) => {
                await page.goto(url);

                const currentForm = await extractFormStructure(page, formIdx);

                // Assert form exists
                expect(currentForm).not.toBeNull();

                // Compare form action (critical!)
                expect(currentForm.attributes.action).toBe(baselineForm.attributes.action);

                // Compare element counts
                expect(currentForm.inputs.length).toBe(baselineForm.inputs.length);
                expect(currentForm.selects.length).toBe(baselineForm.selects.length);
                expect(currentForm.textareas.length).toBe(baselineForm.textareas.length);

                // Compare input names (order-independent)
                const currentInputNames = currentForm.inputs.map((i: any) => i.name).sort();
                const baselineInputNames = baselineForm.inputs.map((i: any) => i.name).sort();
                expect(currentInputNames).toEqual(baselineInputNames);

                // Compare select names
                const currentSelectNames = currentForm.selects.map((s: any) => s.name).sort();
                const baselineSelectNames = baselineForm.selects.map((s: any) => s.name).sort();
                expect(currentSelectNames).toEqual(baselineSelectNames);

                // Compare textarea names
                const currentTextareaNames = currentForm.textareas.map((t: any) => t.name).sort();
                const baselineTextareaNames = baselineForm.textareas.map((t: any) => t.name).sort();
                expect(currentTextareaNames).toEqual(baselineTextareaNames);
            });

            test(`Form ${formIdx}: all inputs have correct types`, async ({ page }) => {
                await page.goto(url);
                const currentForm = await extractFormStructure(page, formIdx);

                // Check each input type matches baseline
                for (const baselineInput of baselineForm.inputs) {
                    const matchingInput = currentForm.inputs.find((i: any) => i.name === baselineInput.name);
                    expect(matchingInput, `Input '${baselineInput.name}' not found`).toBeDefined();
                    expect(matchingInput.type).toBe(baselineInput.type);
                }
            });

            test(`Form ${formIdx}: buttons match baseline`, async ({ page }) => {
                await page.goto(url);
                const currentForm = await extractFormStructure(page, formIdx);

                expect(currentForm.buttons.length).toBe(baselineForm.buttons.length);
            });
        });
    });
}
