document.addEventListener('DOMContentLoaded', function() {
    // Initialize map
    const map = L.map('map').setView([39.8283, -98.5795], 4); // Default to US center
    
    // Add tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);
    
    // Load alerts
    loadAlerts();
    
    // Set up report button
    document.getElementById('report-btn').addEventListener('click', function() {
        window.location.href = '/report';
    });
    
    function loadAlerts() {
        fetch('/api/alerts')
            .then(response => response.json())
            .then(alerts => {
                displayAlerts(alerts);
                displayAlertsOnMap(alerts);
            })
            .catch(error => {
                console.error('Error loading alerts:', error);
                document.getElementById('alerts-container').innerHTML = '<p>Error loading alerts. Please try again later.</p>';
            });
    }
    
    function displayAlerts(alerts) {
        const container = document.getElementById('alerts-container');
        
        if (alerts.length === 0) {
            container.innerHTML = '<p>No active alerts at this time.</p>';
            return;
        }
        
        let html = '';
        const userId = localStorage.getItem('userId') || '';
        
        alerts.forEach(alert => {
            const timeRemaining = calculateTimeRemaining(alert.timestamp, alert.duration);
            
            html += `
                <div class="alert-item ${alert.category}">
                    <div class="alert-title">${alert.title}</div>
                    <div class="alert-description">${alert.description}</div>
                    <div class="alert-meta">
                        <span>Category: ${alert.category}</span>
                        <span>Expires in: ${timeRemaining}</span>
                    </div>
                    ${alert.userId === userId ? 
                        `<button class="delete-btn" data-id="${alert.id}">Delete</button>` : ''}
                </div>
            `;
        });
        
        container.innerHTML = html;
        
        // Add event listeners to delete buttons
        document.querySelectorAll('.delete-btn').forEach(button => {
            button.addEventListener('click', function() {
                const alertId = this.getAttribute('data-id');
                deleteAlert(alertId);
            });
        });
    }
    
    function displayAlertsOnMap(alerts) {
        // Clear existing markers
        map.eachLayer(layer => {
            if (layer instanceof L.Marker) {
                map.removeLayer(layer);
            }
        });
        
        // Add new markers
        alerts.forEach(alert => {
            const marker = L.marker([alert.lat, alert.lng]).addTo(map);
            
            let popupContent = `
                <strong>${alert.title}</strong><br>
                ${alert.description}<br>
                <small>Category: ${alert.category}</small>
            `;
            
            marker.bindPopup(popupContent);
        });
        
        // Adjust map view to show all markers if there are any
        if (alerts.length > 0) {
            const group = new L.featureGroup(alerts.map(alert => L.marker([alert.lat, alert.lng])));
            map.fitBounds(group.getBounds().pad(0.1));
        }
    }
    
    function calculateTimeRemaining(timestamp, durationHours) {
        const created = new Date(timestamp);
        const expires = new Date(created.getTime() + (durationHours * 60 * 60 * 1000));
        const now = new Date();
        
        const diff = expires - now;
        
        if (diff <= 0) {
            return 'Expired';
        }
        
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        
        return `${hours}h ${minutes}m`;
    }
    
    function deleteAlert(alertId) {
        const userId = localStorage.getItem('userId') || '';
        
        if (!userId) {
            alert('Cannot identify user. Please try reporting an alert first.');
            return;
        }
        
        if (!confirm('Are you sure you want to delete this alert?')) {
            return;
        }
        
        fetch(`/api/alerts/${alertId}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ userId })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                loadAlerts(); // Reload alerts
            } else {
                alert('Error deleting alert: ' + data.message);
            }
        })
        .catch(error => {
            console.error('Error deleting alert:', error);
            alert('Error deleting alert. Please try again.');
        });
    }
});