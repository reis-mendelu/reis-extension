#!/usr/bin/env node

/**
 * Send Slack notifications via webhook
 * Usage: node scripts/send-slack-notification.js <type> <message> [details]
 * 
 * Types: success, warning, critical
 * 
 * Environment variables:
 * - SLACK_WEBHOOK_URL: Required. Your Slack Incoming Webhook URL
 */

const https = require('https');
const url = require('url');

const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL;

if (!SLACK_WEBHOOK_URL) {
    console.log('⚠️  SLACK_WEBHOOK_URL not set. Skipping Slack notification.');
    process.exit(0);
}

const type = process.argv[2] || 'info';
const message = process.argv[3] || 'No message provided';
const details = process.argv[4] || '';

// Color coding for different types
const colors = {
    success: '#36a64f',
    warning: '#ff9800',
    critical: '#ff0000',
    info: '#2196f3'
};

const emojis = {
    success: '✅',
    warning: '⚠️',
    critical: '🚨',
    info: 'ℹ️'
};

const color = colors[type] || colors.info;
const emoji = emojis[type] || emojis.info;

// Build Slack message payload
const payload = {
    attachments: [
        {
            color: color,
            blocks: [
                {
                    type: 'header',
                    text: {
                        type: 'plain_text',
                        text: `${emoji} REIS Watchdog Alert`,
                        emoji: true
                    }
                },
                {
                    type: 'section',
                    text: {
                        type: 'mrkdwn',
                        text: `*${message}*`
                    }
                }
            ]
        }
    ]
};

// Add details if provided
if (details) {
    payload.attachments[0].blocks.push({
        type: 'section',
        text: {
            type: 'mrkdwn',
            text: `\`\`\`\n${details}\n\`\`\``
        }
    });
}

// Add timestamp
payload.attachments[0].blocks.push({
    type: 'context',
    elements: [
        {
            type: 'mrkdwn',
            text: `<!date^${Math.floor(Date.now() / 1000)}^{date_num} {time_secs}|${new Date().toISOString()}>`
        }
    ]
});

// Send to Slack
const webhookUrl = new url.URL(SLACK_WEBHOOK_URL);
const options = {
    hostname: webhookUrl.hostname,
    port: 443,
    path: webhookUrl.pathname + webhookUrl.search,
    method: 'POST',
    headers: {
        'Content-Type': 'application/json'
    }
};

const req = https.request(options, (res) => {
    let data = '';
    res.on('data', (chunk) => {
        data += chunk;
    });
    res.on('end', () => {
        if (res.statusCode === 200) {
            console.log('✅ Slack notification sent successfully');
        } else {
            console.error(`❌ Slack notification failed: ${res.statusCode} - ${data}`);
            process.exit(1);
        }
    });
});

req.on('error', (error) => {
    console.error('❌ Error sending Slack notification:', error.message);
    process.exit(1);
});

req.write(JSON.stringify(payload));
req.end();
