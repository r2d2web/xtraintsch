const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
const port = 3000;

// Middleware
app.use(express.static('public'));
app.use(express.json());

// Read alerts from JSON file
function readAlerts() {
  try {
    const data = fs.readFileSync('alerts.json', 'utf8');
    return JSON.parse(data);
  } catch (err) {
    return { alerts: [] };
  }
}

// Write alerts to JSON file
function writeAlerts(alerts) {
  fs.writeFileSync('alerts.json', JSON.stringify(alerts, null, 2));
}

// Clean up expired alerts
function cleanExpiredAlerts() {
  const data = readAlerts();
  const now = new Date().getTime();
  
  data.alerts = data.alerts.filter(alert => {
    const expirationTime = new Date(alert.timestamp).getTime() + (alert.duration * 60 * 60 * 1000);
    return expirationTime > now;
  });
  
  writeAlerts(data);
}

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/report', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'report.html'));
});

app.get('/api/alerts', (req, res) => {
  cleanExpiredAlerts();
  const data = readAlerts();
  res.json(data.alerts);
});

app.post('/api/alerts', (req, res) => {
  const { category, title, description, lat, lng, userId } = req.body;
  
  // Set durations for different categories (in hours)
  const categoryDurations = {
    'traffic': 1.5,
    'building': 24,
    'event': 6,
    'weather': 3,
    'other': 12
  };
  
  const newAlert = {
    id: Date.now().toString(),
    category,
    title,
    description,
    lat,
    lng,
    userId,
    timestamp: new Date().toISOString(),
    duration: categoryDurations[category] || 12
  };
  
  const data = readAlerts();
  data.alerts.push(newAlert);
  writeAlerts(data);
  
  res.json({ success: true, id: newAlert.id });
});

app.delete('/api/alerts/:id', (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;
  
  const data = readAlerts();
  const alertIndex = data.alerts.findIndex(alert => alert.id === id);
  
  if (alertIndex === -1) {
    return res.status(404).json({ success: false, message: 'Alert not found' });
  }
  
  if (data.alerts[alertIndex].userId !== userId) {
    return res.status(403).json({ success: false, message: 'Not authorized to delete this alert' });
  }
  
  data.alerts.splice(alertIndex, 1);
  writeAlerts(data);
  
  res.json({ success: true });
});

// Start server
app.listen(port, () => {
  console.log(`Community Alert System running at http://localhost:${port}`);
  cleanExpiredAlerts(); // Clean up on startup
});

// Clean up expired alerts every hour
setInterval(cleanExpiredAlerts, 60 * 60 * 1000);