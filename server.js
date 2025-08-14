// server.js
const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const app = express();
const PORT = 5000;

// User data
const users = {
  ...require('./users/1_little_daisy'),
  ...require('./users/2_rose'),
  ...require('./users/3_lily'),
  ...require('./users/4_tulip_kg1'),
  ...require('./users/5_sunflower_kg2'),
  ...require('./users/6_cactus_cl1'),
  ...require('./users/7_marigold_cl2'),
  ...require('./users/8_rosemary_cl3'),
  ...require('./users/9_daffodils_cl4'),
  ...require('./users/10_jasmine_cl5'),
  ...require('./users/11_carnaation_cl6'),
  ...require('./users/12_morning-glory_jhs1'),
  ...require('./users/13_camellia_jhs2'),
  ...require('./users/14_orchid_jhs3'),
};

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({ secret: 'secret-key', resave: false, saveUninitialized: true }));
app.use(express.static('public'));

// Login Handler
app.post('/login', (req, res) => {
  const username = String(req.body.username).trim();
  const password = req.body.password;
  const user = users[username];

  if (user && user.password === password) {
    req.session.user = username;

    // Log successful login to console
    console.log(`[LOGIN] ${username} logged in successfully at ${new Date().toLocaleString()}`);

    res.redirect('/dashboard');
  } else {
    res.send('Invalid username or password');
    console.log(`[LOGIN] ${username} couldn't log in at ${new Date().toLocaleString()}`);
  }
});

// Dashboard
app.get('/dashboard', (req, res) => {
  const username = req.session.user;
  if (!username || !users[username]) {
    return res.redirect('/login.html');
  }

  const user = users[username];
  const term = req.query.term || 'term3'; // Current term
  const termGallery = user.gallery[term] || [];
  const customHTML = user.customHTML && user.customHTML[term] ? user.customHTML[term] : '';

  res.send(`
  <!DOCTYPE html>
  <html>
  <head>
    <title>Dashboard</title>
    <link rel="stylesheet" href="style.css">
    <link rel="icon" type="image/jpg" href="images/favicon.png">
    <style>
      .announcement {
        background-color: #eef;
        padding: 15px;
        margin-top: 20px;
        border-left: 5px solid #33a;
        border-radius: 8px;
      }
      .custom-html {
        margin-top: 20px;
      }
    </style>
  </head>
  <body>
    <div class="card">
      <img src="${user.image}" alt="${user.name}" class="profile-img">
      <h1><b>${user.name}</b></h1>
      <p>${user.info}</p>

      <div class="buttons">
        <a href="/dashboard?term=term1" class="${term === 'term1' ? 'active' : ''}">Term1</a>
        <a href="/dashboard?term=term2" class="${term === 'term2' ? 'active' : ''}">Term2</a>
        <a href="/dashboard?term=term3" class="${term === 'term3' ? 'active' : ''}">Term3</a>
      </div>

      <div class="gallery">
        ${
          termGallery.length > 0
            ? termGallery.map(img => `<img src="${img}" alt="Bill/Report/Booklist">`).join('')
            : '<p style="font-size:30pt;">Bills✔</p>'
        }
      </div>

      <div class="custom-html">
        ${customHTML}
      </div>

      ${user.showExtraDiv ? `
        <div class="extra-section">
          <h3>Objective Exam</h3>
          <div class="link-buttons">
            ${
              user.links && user.links.length
              ? user.links.map(link => `
              <a href="${link.url}" class="btn" target="_blank">${link.label}</a>
              `).join('')
              : '<p>No links provided.</p>'
            }
          </div>
        </div>
      ` : ''}
    </div>
  </body>
  </html>
  `);
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});