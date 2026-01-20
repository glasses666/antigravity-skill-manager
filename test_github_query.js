const https = require('https');

const query = 'topic:claude-code';
const searchQuery = encodeURIComponent(query);
const url = `https://api.github.com/search/repositories?q=${searchQuery}&sort=stars&order=desc&page=1&per_page=30`;

console.log('Testing URL:', url);

const options = {
    headers: {
        'User-Agent': 'Antigravity-VSCode-Extension'
    }
};

https.get(url, options, (res) => {
    console.log('Status:', res.statusCode);
    let data = '';
    res.on('data', (chunk) => data += chunk);
    res.on('end', () => {
        try {
            const json = JSON.parse(data);
            console.log('Total Count:', json.total_count);
            console.log('Items:', json.items ? json.items.length : 0);
            if (json.items && json.items.length > 0) {
                console.log('First Item:', json.items[0].full_name);
                console.log('First Item Topics:', json.items[0].topics);
            }
            if (json.errors) {
                console.error('Errors:', JSON.stringify(json.errors, null, 2));
            }
        } catch (e) {
            console.error('Error parsing JSON:', e);
            console.log('Raw body:', data.substring(0, 200));
        }
    });
}).on('error', (e) => {
    console.error('Request error:', e);
});
