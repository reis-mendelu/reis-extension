const fs = require('fs');
const path = require('path');

const MOCK_SITE_PATH = path.join(__dirname, '..', 'university-monitor', 'mock-site', 'index.html');

console.log('🤖 Starting Form Change Simulation...');
console.log(`Target: ${MOCK_SITE_PATH}`);

try {
    // 1. Read original content
    const originalContent = fs.readFileSync(MOCK_SITE_PATH, 'utf8');
    console.log('✓ Read original file');

    // 2. Inject a change (add a new input)
    console.log('📝 Injecting new input field...');
    const modifiedContent = originalContent.replace(
        '<!-- Hidden Inputs -->',
        '<!-- Hidden Inputs -->\n        <input name="simulation_test_input" type="text" placeholder="I am a simulation" />'
    );

    fs.writeFileSync(MOCK_SITE_PATH, modifiedContent);
    console.log('✓ File saved with changes. Watcher should trigger now!');
    console.log('⏳ Waiting 5 seconds before reverting...');

    // 3. Wait and revert
    setTimeout(() => {
        console.log('↺ Reverting changes...');
        fs.writeFileSync(MOCK_SITE_PATH, originalContent);
        console.log('✓ File reverted to original state.');
        console.log('✨ Simulation complete.');
    }, 5000);

} catch (error) {
    console.error('❌ Error during simulation:', error);
}
