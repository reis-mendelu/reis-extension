const fs = require('fs');
const path = require('path');

/**
 * Compares two form baselines and reports differences
 * Usage: node scripts/compare-baselines.js <baseline1.json> <baseline2.json>
 */

function compareBaselines(baseline1Path, baseline2Path) {
    console.log('📊 Comparing form baselines...\n');

    const baseline1 = JSON.parse(fs.readFileSync(baseline1Path, 'utf8'));
    const baseline2 = JSON.parse(fs.readFileSync(baseline2Path, 'utf8'));

    let hasChanges = false;
    const changes = [];

    // Compare each URL
    const allUrls = new Set([...Object.keys(baseline1), ...Object.keys(baseline2)]);

    for (const url of allUrls) {
        const page1 = baseline1[url];
        const page2 = baseline2[url];

        // Check if page exists in both
        if (!page1) {
            changes.push({
                severity: 'info',
                url,
                message: `New page added: ${url}`
            });
            continue;
        }

        if (!page2) {
            changes.push({
                severity: 'warning',
                url,
                message: `Page removed: ${url}`
            });
            hasChanges = true;
            continue;
        }

        // Compare form counts
        const forms1 = page1.forms || [];
        const forms2 = page2.forms || [];

        if (forms1.length !== forms2.length) {
            changes.push({
                severity: 'critical',
                url,
                message: `Form count changed: ${forms1.length} → ${forms2.length}`
            });
            hasChanges = true;
        }

        // Compare each form
        const minForms = Math.min(forms1.length, forms2.length);
        for (let i = 0; i < minForms; i++) {
            const form1 = forms1[i];
            const form2 = forms2[i];

            // Check form action
            if (form1.attributes.action !== form2.attributes.action) {
                changes.push({
                    severity: 'critical',
                    url,
                    formIndex: i,
                    message: `Form action changed: "${form1.attributes.action}" → "${form2.attributes.action}"`
                });
                hasChanges = true;
            }

            // Check input counts
            if (form1.inputs.length !== form2.inputs.length) {
                changes.push({
                    severity: 'critical',
                    url,
                    formIndex: i,
                    message: `Input count changed: ${form1.inputs.length} → ${form2.inputs.length}`
                });
                hasChanges = true;
            }

            // Check input names
            const inputs1Names = new Set(form1.inputs.map(i => i.name));
            const inputs2Names = new Set(form2.inputs.map(i => i.name));

            for (const name of inputs2Names) {
                if (!inputs1Names.has(name)) {
                    changes.push({
                        severity: 'warning',
                        url,
                        formIndex: i,
                        message: `New input added: "${name}"`
                    });
                    hasChanges = true;
                }
            }

            for (const name of inputs1Names) {
                if (!inputs2Names.has(name) && name !== '') {
                    changes.push({
                        severity: 'critical',
                        url,
                        formIndex: i,
                        message: `Input removed: "${name}"`
                    });
                    hasChanges = true;
                }
            }

            // Check select counts
            if (form1.selects.length !== form2.selects.length) {
                changes.push({
                    severity: 'warning',
                    url,
                    formIndex: i,
                    message: `Select count changed: ${form1.selects.length} → ${form2.selects.length}`
                });
                hasChanges = true;
            }
        }
    }

    // Print results
    if (changes.length === 0) {
        console.log('✅ No changes detected between baselines.\n');
        return { hasChanges: false, changes: [] };
    }

    console.log(`⚠️  Found ${changes.length} change(s):\n`);

    const critical = changes.filter(c => c.severity === 'critical');
    const warnings = changes.filter(c => c.severity === 'warning');
    const info = changes.filter(c => c.severity === 'info');

    if (critical.length > 0) {
        console.log('🚨 CRITICAL CHANGES:');
        critical.forEach(c => {
            const formInfo = c.formIndex !== undefined ? ` [Form ${c.formIndex}]` : '';
            console.log(`   ❌ ${c.url}${formInfo}: ${c.message}`);
        });
        console.log('');
    }

    if (warnings.length > 0) {
        console.log('⚠️  WARNINGS:');
        warnings.forEach(c => {
            const formInfo = c.formIndex !== undefined ? ` [Form ${c.formIndex}]` : '';
            console.log(`   ⚠️  ${c.url}${formInfo}: ${c.message}`);
        });
        console.log('');
    }

    if (info.length > 0) {
        console.log('ℹ️  INFO:');
        info.forEach(c => {
            console.log(`   ℹ️  ${c.message}`);
        });
        console.log('');
    }

    return { hasChanges, changes, critical, warnings, info };
}

// Run if called directly
if (require.main === module) {
    const [baseline1Path, baseline2Path] = process.argv.slice(2);

    if (!baseline1Path || !baseline2Path) {
        console.error('Usage: node compare-baselines.js <baseline1.json> <baseline2.json>');
        process.exit(1);
    }

    const result = compareBaselines(baseline1Path, baseline2Path);

    // Exit with error code if critical changes found
    if (result.critical && result.critical.length > 0) {
        process.exit(1);
    }
}

module.exports = { compareBaselines };
