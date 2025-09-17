document.addEventListener('DOMContentLoaded', function() {
    // Initialize map
    const map = L.map('map').setView([39.8283, -98.5795], 4); // Default to US center
    
    // Add tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);
    
    let marker = null;
    
    // Set up map click event
    map.on('click', function(e) {
        setLocation(e.latlng.lat, e.latlng.lng);
    });
    
    // Set up current location button
    document.getElementById('get-location').addEventListener('click', function() {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                function(position) {
                    const lat = position.coords.latitude;
                    const lng = position.coords.longitude;
                    
                    setLocation(lat, lng);
                    map.setView([lat, lng], 15);
                },
                function(error) {
                    alert('Error getting location: ' + error.message);
                }
            );
        } else {
            alert('Geolocation is not supported by this browser.');
        }
    });
    
    // Set up form submission
    document.getElementById('alert-form').addEventListener('submit', function(e) {
        e.preventDefault();
        
        const lat = document.getElementById('lat').value;
        const lng = document.getElementById('lng').value;
        
        if (!lat || !lng) {
            alert('Please select a location on the map for your alert.');
            return;
        }
        
        const category = document.getElementById('category').value;
        const title = document.getElementById('title').value;
        const description = document.getElementById('description').value;
        const userId = document.getElementById('userId').value;
        
        // Save userId to localStorage for future reference
        localStorage.setItem('userId', userId);
        
        submitAlert({
            category,
            title,
            description,
            lat: parseFloat(lat),
            lng: parseFloat(lng),
            userId
        });
    });
    
    // Set up cancel button
    document.getElementById('cancel-btn').addEventListener('click', function() {
        if (confirm('Are you sure you want to cancel? All entered data will be lost.')) {
            window.location.href = '/';
        }
    });
    
    function setLocation(lat, lng) {
        document.getElementById('lat').value = lat;
        document.getElementById('lng').value = lng;
        document.getElementById('location-status').textContent = 
            `Location set: ${lat.toFixed(4)}, ${lng.toFixed(4)}`;
        
        // Remove existing marker
        if (marker) {
            map.removeLayer(marker);
        }
        
        // Add new marker
        marker = L.marker([lat, lng]).addTo(map);
    }
    
    function submitAlert(alertData) {
        fetch('/api/alerts', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(alertData)
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                alert('Alert submitted successfully!');
                window.location.href = '/';
            } else {
                alert('Error submitting alert. Please try again.');
            }
        })
        .catch(error => {
            console.error('Error submitting alert:', error);
            alert('Error submitting alert. Please try again.');
        });
    }
});