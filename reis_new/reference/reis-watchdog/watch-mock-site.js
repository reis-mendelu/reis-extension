const chokidar = require('chokidar');
const fs = require('fs');
const path = require('path');

const MOCK_SITE_PATH = path.join(__dirname, 'university-monitor', 'mock-site', 'index.html');

console.log('🔍 REIS Watchdog - Monitoring mock-site for changes...');
console.log(`📁 Watching: ${MOCK_SITE_PATH}\n`);

// Initialize watcher
const watcher = chokidar.watch(MOCK_SITE_PATH, {
    persistent: true,
    ignoreInitial: false,
    awaitWriteFinish: {
        stabilityThreshold: 100,
        pollInterval: 50
    }
});

// Helper function to extract form elements from HTML
function analyzeFormStructure(filePath) {
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        const formMatch = content.match(/<form[^>]*>/i);
        const inputMatches = content.match(/<input[^>]*>/gi) || [];
        const selectMatches = content.match(/<select[^>]*>/gi) || [];

        return {
            formAction: formMatch ? formMatch[0].match(/action="([^"]*)"/i)?.[1] : null,
            inputCount: inputMatches.length,
            selectCount: selectMatches.length,
            inputs: inputMatches.map(input => {
                const name = input.match(/name="([^"]*)"/i)?.[1];
                const type = input.match(/type="([^"]*)"/i)?.[1];
                return { name, type };
            }),
            selects: selectMatches.map(select => {
                const name = select.match(/name="([^"]*)"/i)?.[1];
                return { name };
            })
        };
    } catch (error) {
        console.error('❌ Error analyzing form:', error.message);
        return null;
    }
}

let previousStructure = null;

// File added or changed
watcher.on('add', (filePath) => {
    const timestamp = new Date().toISOString();
    console.log(`✅ [${timestamp}] File detected: ${path.basename(filePath)}`);

    const structure = analyzeFormStructure(filePath);
    if (structure) {
        console.log('📋 Initial form structure:');
        console.log(`   - Form action: ${structure.formAction}`);
        console.log(`   - Inputs: ${structure.inputCount}`);
        console.log(`   - Selects: ${structure.selectCount}`);
        structure.inputs.forEach(input => {
            console.log(`     • input[name="${input.name}", type="${input.type}"]`);
        });
        structure.selects.forEach(select => {
            console.log(`     • select[name="${select.name}"]`);
        });
        console.log('');
        previousStructure = structure;
    }
});

watcher.on('change', (filePath) => {
    const timestamp = new Date().toISOString();
    console.log(`\n🔄 [${timestamp}] CHANGE DETECTED in ${path.basename(filePath)}`);
    console.log('━'.repeat(60));

    const newStructure = analyzeFormStructure(filePath);

    if (newStructure && previousStructure) {
        // Compare structures
        const changes = [];

        if (newStructure.formAction !== previousStructure.formAction) {
            changes.push(`⚠️  Form action changed: "${previousStructure.formAction}" → "${newStructure.formAction}"`);
        }

        if (newStructure.inputCount !== previousStructure.inputCount) {
            changes.push(`⚠️  Input count changed: ${previousStructure.inputCount} → ${newStructure.inputCount}`);
        }

        if (newStructure.selectCount !== previousStructure.selectCount) {
            changes.push(`⚠️  Select count changed: ${previousStructure.selectCount} → ${newStructure.selectCount}`);
        }

        // Check for input name changes
        const prevInputNames = new Set(previousStructure.inputs.map(i => i.name));
        const newInputNames = new Set(newStructure.inputs.map(i => i.name));

        newInputNames.forEach(name => {
            if (!prevInputNames.has(name)) {
                changes.push(`➕ New input added: name="${name}"`);
            }
        });

        prevInputNames.forEach(name => {
            if (!newInputNames.has(name)) {
                changes.push(`➖ Input removed: name="${name}"`);
            }
        });

        // Check for select name changes
        const prevSelectNames = new Set(previousStructure.selects.map(s => s.name));
        const newSelectNames = new Set(newStructure.selects.map(s => s.name));

        newSelectNames.forEach(name => {
            if (!prevSelectNames.has(name)) {
                changes.push(`➕ New select added: name="${name}"`);
            }
        });

        prevSelectNames.forEach(name => {
            if (!newSelectNames.has(name)) {
                changes.push(`➖ Select removed: name="${name}"`);
            }
        });


        if (changes.length > 0) {
            console.log('⚡ CRITICAL CHANGES DETECTED:');
            changes.forEach(change => console.log(`   ${change}`));

            // Send Slack notification if configured
            if (process.env.SLACK_WEBHOOK_URL) {
                const { spawn } = require('child_process');
                const changesText = changes.join('\n');
                const slackProcess = spawn('node', [
                    path.join(__dirname, 'scripts', 'send-slack-notification.js'),
                    'warning',
                    'Form changes detected in local mock-site',
                    changesText
                ]);

                slackProcess.on('exit', (code) => {
                    if (code === 0) {
                        console.log('   📤 Slack notification sent');
                    }
                });
            }
        } else {
            console.log('✓ Form structure unchanged (cosmetic changes only)');
        }

        console.log('\n📋 Current form structure:');
        console.log(`   - Form action: ${newStructure.formAction}`);
        console.log(`   - Inputs: ${newStructure.inputCount}`);
        console.log(`   - Selects: ${newStructure.selectCount}`);
        newStructure.inputs.forEach(input => {
            console.log(`     • input[name="${input.name}", type="${input.type}"]`);
        });
        newStructure.selects.forEach(select => {
            console.log(`     • select[name="${select.name}"]`);
        });

        previousStructure = newStructure;
    } else if (newStructure) {
        console.log('✓ File updated');
        previousStructure = newStructure;
    }

    console.log('━'.repeat(60));
    console.log('');
});

watcher.on('error', (error) => {
    console.error('❌ Watcher error:', error);
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n\n👋 Stopping watchdog...');
    watcher.close();
    process.exit(0);
});
