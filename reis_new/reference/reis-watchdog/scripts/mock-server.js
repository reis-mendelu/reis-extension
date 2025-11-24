const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8080;
const MOCK_SITE_DIR = path.join(__dirname, '..', 'university-monitor', 'mock-site');

const server = http.createServer((req, res) => {
    // Serve index.html for all requests
    const filePath = path.join(MOCK_SITE_DIR, 'index.html');

    fs.readFile(filePath, (err, data) => {
        if (err) {
            res.writeHead(404);
            res.end('Not Found');
            return;
        }

        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(data);
    });
});

server.listen(PORT, () => {
    console.log(`🌐 Mock server running at http://localhost:${PORT}`);
    console.log(`📄 Serving: ${MOCK_SITE_DIR}/index.html`);
    console.log('Press Ctrl+C to stop');
});
