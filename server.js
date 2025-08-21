const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;
const alertsFile = path.join(__dirname, 'alerts.json');

app.use(bodyParser.json());
app.use(express.static('public'));

// Load alerts
app.get('/alerts', (req, res) => {
    fs.readFile(alertsFile, (err, data) => {
        if (err) return res.json([]);
        res.json(JSON.parse(data));
    });
});

// Save alert
app.post('/alerts', (req, res) => {
    const newAlert = req.body;
    fs.readFile(alertsFile, (err, data) => {
        let alerts = [];
        if (!err && data.length) {
            alerts = JSON.parse(data);
        }
        alerts.push(newAlert);
        fs.writeFile(alertsFile, JSON.stringify(alerts, null, 2), (err) => {
            if (err) return res.status(500).json({ error: 'Failed to save alert' });
            res.json({ success: true });
        });
    });
});

// Delete alert
app.delete('/alerts/:index', (req, res) => {
    const index = parseInt(req.params.index);
    fs.readFile(alertsFile, (err, data) => {
        if (err) return res.status(500).json({ error: 'Failed to read alerts' });
        let alerts = JSON.parse(data);
        if (index >= 0 && index < alerts.length) {
            alerts.splice(index, 1);
            fs.writeFile(alertsFile, JSON.stringify(alerts, null, 2), (err) => {
                if (err) return res.status(500).json({ error: 'Failed to delete alert' });
                res.json({ success: true });
            });
        } else {
            res.status(400).json({ error: 'Invalid alert index' });
        }
    });
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
