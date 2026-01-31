const express = require('express');
const { exec } = require('child_process');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = 3001;

app.use(cors());

app.get('/api/calendar/sync', (req, res) => {
    const swiftScript = path.join(__dirname, 'fetch_events.swift');
    
    exec(`swift "${swiftScript}"`, (error, stdout, stderr) => {
        if (error) {
            console.error(`exec error: ${error}`);
            // Fallback empty array if fails
            return res.status(500).json({ error: 'Failed to fetch events', details: stderr });
        }
        
        try {
            // Swift prints JSON to stdout
            const events = JSON.parse(stdout);
            console.log(`Fetched ${events.length} events`);
            res.json(events);
        } catch (e) {
            console.error("Parse error", e);
            res.status(500).json({ error: 'Failed to parse calendar output' });
        }
    });
});

app.listen(PORT, () => {
    console.log(`Backend running on http://localhost:${PORT}`);
});
