const fetch = require('node-fetch');

async function testConnectivity() {
    console.log('Testing connectivity to YouTube...');
    try {
        const response = await fetch('https://www.youtube.com/watch?v=dIUEwTn6VWw', { timeout: 10000 });
        console.log(`Status: ${response.status}`);
        console.log(`Headers: ${JSON.stringify(response.headers.raw())}`);
        const text = await response.text();
        console.log(`Body length: ${text.length}`);
        console.log(`Contains 'player' or 'watch': ${text.includes('player')}`);
    } catch (e) {
        console.log(`Connect FAILED: ${e.message}`);
    }
}

testConnectivity();
