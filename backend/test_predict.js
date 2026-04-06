require('dotenv').config();
const db = require('./src/config/database');
const { buildProjectFeatures } = require('./src/controllers/aiController');

(async () => {
    try {
        const p = await db.query('SELECT id FROM projects LIMIT 1');
        if (p.rows.length === 0) { console.log('NO PROJECTS'); process.exit(); }
        const id = p.rows[0].id;
        console.log('Testing Project:', id);
        
        // Emulate predict logic
        const features = await buildProjectFeatures(id);
        console.log('FEATURES EXTRACTED:', features);
        
        const aiUrl = process.env.AI_SERVICE_URL || 'http://localhost:8000';
        const response = await fetch(`${aiUrl}/predict`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(features)
        });
        const text = await response.text();
        console.log('AI PARSER RESPONSE:', response.status, text);
    } catch(err) {
        console.error('ERROR MESSAGE:', err.message);
    }
    process.exit();
})();
