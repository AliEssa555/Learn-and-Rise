const https = require('https');

const req = https.get('https://www.youtube.com', (res) => {
    console.log(`Status code: ${res.statusCode}`);
    res.on('data', () => { }); // Consume
    res.on('end', () => console.log('Response ended.'));
});

req.on('error', (e) => {
    console.error(`Error: ${e.message}`);
});

req.setTimeout(5000, () => {
    console.error('Request timed out!');
    req.destroy();
    process.exit(1);
});
