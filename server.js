const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const fs = require('fs');
const path = require('path');
const app = express();
const PORT = 5000;

// Load all users including admin
const users = loadUsers();

// Create a map of passwords to usernames
const passwordToUsersMap = {};
Object.keys(users).forEach(username => {
  const password = users[username].password;
  if (!passwordToUsersMap[password]) {
    passwordToUsersMap[password] = [];
  }
  passwordToUsersMap[password].push(username);
});

// Helper function to load all users from files
function loadUsers() {
  const users = {};
  
  // Load admin user
  try {
    Object.assign(users, require('./users/admin'));
  } catch (e) {
    console.error('Error loading admin user:', e.message);
  }
  
  // Load all student users from files in users directory
  const userFiles = fs.readdirSync('./users').filter(file => 
    file.endsWith('.js') && !file.includes('admin')
  );
  
  userFiles.forEach(file => {
    try {
      const userData = require(`./users/${file}`);
      Object.assign(users, userData);
    } catch (e) {
      console.error(`Error loading user file ${file}:`, e.message);
    }
  });
  
  return users;
}

// Helper function to save user data back to file
function saveUserToFile(studentId, userData) {
  try {
    // Find which file contains this student
    const userFiles = fs.readdirSync('./users').filter(file => 
      file.endsWith('.js') && !file.includes('admin')
    );
    
    for (const file of userFiles) {
      const fileData = require(`./users/${file}`);
      if (fileData[studentId]) {
        // Found the file, update the user data
        fileData[studentId] = userData;
        
        // Write back to file
        const filePath = path.join(__dirname, 'users', file);
        const fileContent = `module.exports = ${JSON.stringify(fileData, null, 2)};\n`;
        
        fs.writeFileSync(filePath, fileContent, 'utf8');
        console.log(`[FILE SAVED] Updated ${studentId} in ${file}`);
        return true;
      }
    }
    
    console.error(`[FILE ERROR] Student ${studentId} not found in any user file`);
    return false;
  } catch (e) {
    console.error(`[FILE ERROR] Failed to save ${studentId}:`, e.message);
    return false;
  }
}

// Helper function to get client IP
function getClientIP(req) {
  return req.headers['x-forwarded-for']?.split(',')[0] || 
         req.ip || 
         req.connection.remoteAddress || 
         req.socket.remoteAddress ||
         (req.connection.socket ? req.connection.socket.remoteAddress : null);
}

// Helper functions for grading
function gradeFromScore(score) {
  if (score >= 85) return 'A';
  if (score >= 70) return 'B';
  if (score >= 60) return 'C';
  if (score >= 50) return 'D';
  if (score >= 40) return 'E';
  return 'F';
}

function remarkFromGrade(grade) {
  switch (grade) {
    case 'A': return 'Excellent';
    case 'B': return 'Very Good';
    case 'C': return 'Good';
    case 'D': return 'Average';
    case 'E': return 'Below Average';
    case 'F': return 'Weak';
    default: return '';
  }
}

function bestGrade(subjects) {
  return subjects.map(s => s.grade).sort()[0];
}

function worstGrade(subjects) {
  return subjects.map(s => s.grade).sort().reverse()[0];
}

// Middleware
app.use(bodyParser.urlencoded({ 
  extended: true,
  limit: '15mb',
  parameterLimit: 20000
}));
app.use(session({ secret: 'secret-key', resave: false, saveUninitialized: true }));
app.use(express.static('public'));

// Login Handler
app.post('/login', (req, res) => {
  const username = String(req.body.username).trim();
  const password = req.body.password;
  const user = users[username];
  const ip = getClientIP(req);

  if (user && user.password === password) {
    req.session.user = username;
    
    // Log successful login to console with IP
    console.log(`[LOGIN] ${username} logged in successfully from IP: ${ip} at ${new Date().toLocaleString()}`);

    // Check if user is admin
    if (user.isAdmin) {
      req.session.isAdmin = true;
      return res.redirect('/admin/dashboard');
    }

    // Check if multiple users share this password
    const usersWithSamePassword = passwordToUsersMap[password];
    if (usersWithSamePassword.length > 1) {
      // Store the users with same password in session
      req.session.usersWithSamePassword = usersWithSamePassword;
      res.redirect('/multi');
    } else {
      res.redirect('/dashboard');
    }
  } else {
    res.redirect('login_error.html?error=1');
    console.log(`[LOGIN FAILED] ID: ${username} PASSWORD: ${password} from IP: ${ip} at ${new Date().toLocaleString()}`);
  }
});

// Multi user selection page
app.get('/multi', (req, res) => {
  const usersWithSamePassword = req.session.usersWithSamePassword;
  
  if (!usersWithSamePassword || usersWithSamePassword.length <= 1) {
    return res.redirect('/dashboard');
  }

  const userLinks = usersWithSamePassword.map(username => 
    `<div class="user-card">
      <a href="/select-user?username=${username}">${users[username].name}</a>
    </div>`
  ).join('');

  res.send(`
  <!DOCTYPE html>
  <html>
  <head>
    <title>Select User</title>
    <link rel="icon" type="image/jpg" href="images/favicon.png">
    <link rel="stylesheet" href="style1.css">
  </head>
  <body class="multi">
    <div class="container">
      <h2>Choose who to view<br>Available wards:</h2>
      ${userLinks}
    </div>
  </body>
  </html>
  `);
});

// User selection handler
app.get('/select-user', (req, res) => {
  const selectedUsername = req.query.username;
  const usersWithSamePassword = req.session.usersWithSamePassword;
  const ip = getClientIP(req);
  
  if (usersWithSamePassword && usersWithSamePassword.includes(selectedUsername)) {
    req.session.user = selectedUsername;
    
    // Log the selected user login to console with IP
    console.log(`[LOGIN] ${selectedUsername} logged in successfully from IP: ${ip} at ${new Date().toLocaleString()}`);
    
    res.redirect('/dashboard');
  } else {
    res.redirect('/multi');
  }
});

// Student Dashboard
app.get('/dashboard', (req, res) => {
  const username = req.session.user;
  if (!username || !users[username]) {
    return res.redirect('/login.html');
  }

  // Don't allow admin to access student dashboard
  if (users[username].isAdmin) {
    return res.redirect('/admin/dashboard');
  }

  const user = users[username];
  const term = req.query.term || 'term1';
  const termGallery = user.gallery[term] || [];
  const customHTML = user.customHTML && user.customHTML[term] ? user.customHTML[term] : '';

  res.send(`
  <!DOCTYPE html>
  <html>
  <head>
    <title>Dashboard</title>
    <link rel="stylesheet" href="style.css">
    <link rel="icon" type="image/jpg" href="images/favicon.png">
    <script>
      document.addEventListener('DOMContentLoaded', function() {
        const printButton = document.getElementById('print');
    
        if (printButton) {
          printButton.addEventListener('click', function() {
            window.print();
          });
        }
      });
    </script>
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
        width: 100%;
        overflow-x: auto;
      }
      .custom-html table {
        width: 100%;
        border-collapse: collapse;
        margin: 10px 0;
      }
      .custom-html th, .custom-html td {
        border: 1px solid #333;
        padding: 8px;
        text-align: center;
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
            : '<p style="font-size:30pt;"></p>'
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
      <div style="height:20px;"></div>
      <button id="print">Print | Save</button>
      <br><br>
      <a href="/logout" style="color: #666; text-decoration: none;">← Logout</a>
    </div>
  </body>
  </html>
  `);
});

// Admin Dashboard
app.get('/admin/dashboard', (req, res) => {
  const username = req.session.user;
  if (!username || !users[username] || !users[username].isAdmin) {
    return res.redirect('/login.html');
  }

  res.send(`
  <!DOCTYPE html>
  <html>
  <head>
    <title>Admin Dashboard</title>
    <link rel="icon" type="image/jpg" href="images/favicon.png">
    <style>
      body {
        font-family: Arial, sans-serif;
        max-width: 800px;
        margin: 0 auto;
        padding: 20px;
        background-color: #f5f5f5;
      }
      .header {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        padding: 20px;
        border-radius: 10px;
        margin-bottom: 30px;
        text-align: center;
      }
      .menu {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 20px;
        margin-bottom: 30px;
      }
      .menu-item {
        background: white;
        padding: 25px;
        border-radius: 10px;
        text-align: center;
        box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        text-decoration: none;
        color: #333;
        transition: transform 0.3s, box-shadow 0.3s;
      }
      .menu-item:hover {
        transform: translateY(-5px);
        box-shadow: 0 5px 20px rgba(0,0,0,0.2);
      }
      .menu-item h3 {
        margin-top: 0;
        color: #667eea;
      }
      .logout {
        display: inline-block;
        padding: 10px 20px;
        background: #ff6b6b;
        color: white;
        text-decoration: none;
        border-radius: 5px;
        margin-top: 20px;
      }
      .logout:hover {
        background: #ff5252;
      }
    </style>
  </head>
  <body>
    <div class="header">
      <h1>School Administration Dashboard</h1>
      <p>Welcome, ${users[username].name}</p>
    </div>
    
    <div class="menu">
      <a href="/admin/report-entry" class="menu-item">
        <h3>📝 Enter Report</h3>
        <p>Enter terminal reports for a class</p>
      </a>
      
      <a href="/admin/manage-users" class="menu-item">
        <h3>👥 Manage Users</h3>
        <p>View and manage student accounts</p>
      </a>
      
      <a href="/admin/view-reports" class="menu-item">
        <h3>📊 View Reports</h3>
        <p>View submitted reports</p>
      </a>
      
      <a href="/admin/settings" class="menu-item">
        <h3>⚙️ Settings</h3>
        <p>System configuration</p>
      </a>
    </div>
    
    <div style="text-align: center;">
      <a href="/logout" class="logout">Logout</a>
    </div>
  </body>
  </html>
  `);
});

// Helper function to get class names from user files
function getClassNames() {
  const classFiles = fs.readdirSync('./users').filter(file => 
    file.endsWith('.js') && !file.includes('admin')
  );
  
  // Extract class names from filenames (remove number prefix and .js extension)
  const classNames = classFiles.map(file => {
    const name = file.replace(/\d+_/, '').replace('.js', '');
    return {
      filename: file.replace('.js', ''),
      displayName: name.replace(/_/g, ' ').toUpperCase(),
      studentIds: getStudentIdsFromClassFile(file)
    };
  });
  
  return classNames;
}

// Helper function to get student IDs from a class file
function getStudentIdsFromClassFile(filename) {
  try {
    const fileData = require(`./users/${filename}`);
    return Object.keys(fileData).filter(key => !key.includes('isAdmin'));
  } catch (e) {
    console.error(`Error reading student IDs from ${filename}:`, e.message);
    return [];
  }
}

// Admin Report Entry Page - Now by class
app.get('/admin/report-entry', (req, res) => {
  const username = req.session.user;
  if (!username || !users[username] || !users[username].isAdmin) {
    return res.redirect('/login.html');
  }

  // Get all class names for the dropdown
  const classes = getClassNames();
  
  const classOptions = classes.map(cls => 
    `<option value="${cls.filename}">${cls.displayName} (${cls.studentIds.length} students)</option>`
  ).join('');

  res.send(`
  <!DOCTYPE html>
  <html>
  <head>
    <title>Report Entry</title>
    <link rel="stylesheet" href="/reportentry.css">
  </head>
  <body>
    <a href="/admin/dashboard" class="back-link">← Back to Admin Dashboard</a>
    <h1>Terminal Report Form</h1>
    
    <div class="class-selection">
      <h3>Select Class for Report</h3>
      <select id="classSelect" onchange="updateFormForClass()">
        <option value="">-- Select a class --</option>
        ${classOptions}
      </select>
      <div id="classInfo" style="margin-top: 15px;"></div>
      <div id="classStudentsList">
        <p>Select a class to see existing students...</p>
      </div>
    </div>
    
    <form action="/admin/submit-report" method="POST" id="classForm">
      <input type="hidden" id="selectedClass" name="selectedClass" value="">
      <input type="hidden" id="term" name="term" value="term1">
      
      <h2>Term Selection</h2>
      <div style="margin-bottom: 20px;">
        <label><input type="radio" name="termSelect" value="term1" checked onclick="document.getElementById('term').value='term1'"> Term 1</label>
        <label style="margin-left: 20px;"><input type="radio" name="termSelect" value="term2" onclick="document.getElementById('term').value='term2'"> Term 2</label>
        <label style="margin-left: 20px;"><input type="radio" name="termSelect" value="term3" onclick="document.getElementById('term').value='term3'"> Term 3</label>
      </div>
      
      <h2>Class Info</h2>
      <div id="classInfoFields">
        <!-- Class info fields will be auto-filled here -->
      </div>
      <input type="text" name="t-attend" placeholder="Total attendance" required>
      <input type="text" name="v-date" placeholder="Vacation date" required>
      <input type="text" name="r-date" placeholder="Reopen date" required>

      <h2>Subjects</h2>
      <div id="subjectsSection">
        <div class="subject-entry" data-index="0">
          <input type="text" name="subjectNames[]" placeholder="Subject Name" required>
        </div>
      </div>
      <button type="button" onclick="addSubject()">➕ Add another subject</button><br><br>

      <h2>Student Info</h2>
      <div id="students"></div>

      <button type="button" onclick="addStudent()">➕ Add another student</button><br><br>
      <button type="submit" style="background-color: rgb(67 215 145);">Submit Reports for Class</button>
    </form>

    <script>
      let studentCount = 0;
      let subjectCount = 1;
      let currentClassStudents = [];

      function updateFormForClass() {
        const select = document.getElementById('classSelect');
        const selectedClass = select.value;
        const classField = document.getElementById('selectedClass');
        const infoDiv = document.getElementById('classInfo');
        const studentsListDiv = document.getElementById('classStudentsList');
        const classInfoFields = document.getElementById('classInfoFields');
        
        classField.value = selectedClass;
        currentClassStudents = [];
        
        if (selectedClass) {
          // Extract class name from filename (remove number prefix)
          const className = selectedClass.replace(/^\\d+_/, '').replace(/_/g, ' ').toUpperCase();
          
          // Auto-fill class name in form
          classInfoFields.innerHTML = \`
            <input type="text" name="class" value="\${className}" readonly style="background-color: #f0f0f0;">
          \`;
          
          infoDiv.innerHTML = \`Selected: <strong>\${className}</strong>\`;
          
          // Fetch students in this class
          fetchStudentsForClass(selectedClass);
        } else {
          classInfoFields.innerHTML = '';
          infoDiv.innerHTML = '';
          studentsListDiv.innerHTML = '<p>Select a class to see existing students...</p>';
        }
      }

      function fetchStudentsForClass(className) {
        // Fetch existing students in this class
        fetch('/admin/get-class-students?class=' + encodeURIComponent(className))
          .then(response => response.json())
          .then(data => {
            const studentsListDiv = document.getElementById('classStudentsList');
            if (data.students && data.students.length > 0) {
              let html = '<h4>Existing Students in this class:</h4>';
              data.students.forEach(student => {
                html += \`
                  <div class="student-item">
                    <span class="existing-student">\${student.id}</span> - \${student.name}
                  </div>
                \`;
              });
              studentsListDiv.innerHTML = html;
            } else {
              studentsListDiv.innerHTML = '<p>No existing students found in this class.</p>';
            }
            
            // Reset student count
            studentCount = 0;
            const studentsDiv = document.getElementById('students');
            studentsDiv.innerHTML = '';
          })
          .catch(error => {
            console.error('Error fetching students:', error);
            document.getElementById('classStudentsList').innerHTML = '<p>Error loading students.</p>';
          });
      }

      function addSubject() {
        const subjectsDiv = document.getElementById('subjectsSection');
        const subjectHTML = \`
          <div class="subject-entry" data-index="\${subjectCount}">
            <input type="text" name="subjectNames[]" placeholder="Subject Name" required>
          </div>
        \`;
        subjectsDiv.insertAdjacentHTML('beforeend', subjectHTML);
        subjectCount++;
      }

      function addStudent() {
        const studentsDiv = document.getElementById('students');
        const selectedClass = document.getElementById('selectedClass').value;
        
        if (!selectedClass) {
          alert('Please select a class first.');
          return;
        }
        
        // Get all subject names entered by the user
        const subjectInputs = document.querySelectorAll('input[name="subjectNames[]"]');
        const subjects = Array.from(subjectInputs).map(input => input.value.trim()).filter(val => val !== '');
        
        if (subjects.length === 0) {
          alert('Please add at least one subject before adding a student.');
          return;
        }

        const studentHTML = \`
          <div class="student-row" data-index="\${studentCount}">
            <h3>Student \${studentCount + 1}</h3>
            <div class="student-id-row">
              <input type="text" name="studentId[]" placeholder="Student ID" required title="Must match the ID in the system">
              <input type="text" name="name[]" placeholder="Full Name" required>
            </div>
            <input type="text" name="attendance[]" placeholder="Attendance" required>
            <input type="text" name="house[]" placeholder="House number" required>
            <input type="text" name="promotion[]" placeholder="Promoted to">
            <input type="text" name="teacherComment[]" placeholder="Teacher Comment">
            <input type="text" name="interest[]" placeholder="Student Interest">
            <input type="text" name="hodComment[]" placeholder="HOD's Comment">
            <div class="subjects" id="subjects-\${studentCount}">
              <h4>Subjects</h4>
            </div>
          </div>
        \`;
        
        studentsDiv.insertAdjacentHTML('beforeend', studentHTML);
        
        // Add subject fields for this student using the pre-defined subject names
        const subjectDiv = document.getElementById(\`subjects-\${studentCount}\`);
        subjects.forEach((subjectName, index) => {
          const subjectHTML = \`
            <div class="subject-row">
              <input type="text" name="subjectName_\${studentCount}[]" value="\${subjectName}" readonly>
              <input type="number" name="classScore_\${studentCount}[]" placeholder="Class Score (30%)" min="0" max="30" required>
              <input type="number" name="examScore_\${studentCount}[]" placeholder="Exam Score (70%)" min="0" max="70" required>
            </div>
          \`;
          subjectDiv.insertAdjacentHTML('beforeend', subjectHTML);
        });
        
        studentCount++;
        
        // Update students list display
        updateStudentsListDisplay();
      }

      function updateStudentsListDisplay() {
        const studentsListDiv = document.getElementById('classStudentsList');
        if (studentCount > 0) {
          let studentsHTML = '<h4>Students added for reports:</h4>';
          
          // Get all student IDs and names
          for (let i = 0; i < studentCount; i++) {
            const studentDiv = document.querySelector(\`.student-row[data-index="\${i}"]\`);
            if (studentDiv) {
              const idInput = studentDiv.querySelector('input[name="studentId[]"]');
              const nameInput = studentDiv.querySelector('input[name="name[]"]');
              if (idInput && nameInput) {
                studentsHTML += \`
                  <div class="student-item">
                    <span class="new-student">\${idInput.value || 'No ID'}</span>: \${nameInput.value || 'No Name'}
                  </div>
                \`;
              }
            }
          }
          // Append to existing content
          const existingContent = studentsListDiv.innerHTML;
          if (!existingContent.includes('Students added for reports')) {
            studentsListDiv.innerHTML = existingContent + studentsHTML;
          }
        }
      }

      // Listen for changes in student ID and name fields
      document.addEventListener('input', function(e) {
        if (e.target.name === 'studentId[]' || e.target.name === 'name[]') {
          updateStudentsListDisplay();
        }
      });

      window.onload = () => {
        addSubject();
      };
    </script>
  </body>
  </html>
  `);
});

// API endpoint to get students in a class
app.get('/admin/get-class-students', (req, res) => {
  const className = req.query.class;
  if (!className) {
    return res.json({ students: [] });
  }

  try {
    const classData = require(`./users/${className}`);
    const students = Object.keys(classData)
      .filter(key => !classData[key].isAdmin) // Exclude admin
      .map(id => ({
        id: id,
        name: classData[id].name || 'Unknown'
      }));
    
    res.json({ students });
  } catch (e) {
    console.error('Error loading class data:', e.message);
    res.json({ students: [] });
  }
});

// Handle report submission from admin
app.post('/admin/submit-report', (req, res) => {
  const username = req.session.user;
  if (!username || !users[username] || !users[username].isAdmin) {
    return res.redirect('/login.html');
  }

  const className = req.body.selectedClass;
  const term = req.body.term || 'term1';
  const data = req.body;
  const students = [];

  // Extract class info
  const classDisplayName = data.class;
  const totalAttendance = data["t-attend"];
  const vacationDate = data["v-date"];
  const reopenDate = data["r-date"];

  // Get subject names from the form
  const predefinedSubjects = data.subjectNames || [];

  for (let i = 0; i < (data.name ? data.name.length : 0); i++) {
    const studentId = data.studentId ? data.studentId[i] : '';
    const studentName = data.name ? data.name[i] : '';
    const subjectNames = data[`subjectName_${i}`] || [];
    const classScores = data[`classScore_${i}`] || [];
    const examScores = data[`examScore_${i}`] || [];

    let totalScore = 0;
    const subjects = [];

    for (let j = 0; j < subjectNames.length; j++) {
      const classScore = parseInt(classScores[j] || 0);
      const examScore = parseInt(examScores[j] || 0);
      const total = classScore + examScore;

      totalScore += total;

      const grade = gradeFromScore(total);
      const remark = remarkFromGrade(grade);

      subjects.push({
        name: subjectNames[j],
        classScore,
        examScore,
        total,
        grade,
        remark
      });
    }

    students.push({
      studentId: studentId,
      name: studentName,
      attendance: data.attendance ? data.attendance[i] : '',
      house: data.house ? data.house[i] : '',
      promotion: data.promotion ? data.promotion[i] : '',
      interest: data.interest ? data.interest[i] : '',
      teacherComment: data.teacherComment ? data.teacherComment[i] : '',
      hodComment: data.hodComment ? data.hodComment[i] : '',
      subjects,
      cumulated: totalScore,
      bestGrade: bestGrade(subjects),
      worstGrade: worstGrade(subjects)
    });
  }

  // Assign positions
  const sorted = [...students].sort((a, b) => b.cumulated - a.cumulated);
  sorted.forEach((student, index) => {
    student.position = index + 1;
  });

  students.forEach(student => {
    const match = sorted.find(s => s.name === student.name && s.cumulated === student.cumulated);
    student.position = match ? match.position : students.length;
  });

  // Generate and save individual reports for each student
  const reportResults = [];
  
  students.forEach(student => {
    // Generate the report HTML
    const reportHTML = generateStudentReport(student, classDisplayName, totalAttendance, vacationDate, reopenDate, students.length);
    
    // Save to the user's file if they exist
    if (users[student.studentId]) {
      // Clone the user data
      const updatedUserData = { ...users[student.studentId] };
      
      // Initialize customHTML if it doesn't exist
      if (!updatedUserData.customHTML) {
        updatedUserData.customHTML = {};
      }
      
      // Store the report HTML in the specified term
      updatedUserData.customHTML[term] = reportHTML;
      
      // Save to file
      const saved = saveUserToFile(student.studentId, updatedUserData);
      
      if (saved) {
        // Update the in-memory copy
        users[student.studentId] = updatedUserData;
        reportResults.push({
          studentId: student.studentId,
          name: student.name,
          saved: true,
          position: student.position,
          cumulated: student.cumulated
        });
        
        console.log(`[REPORT SAVED] Report for ${student.studentId} (${student.name}) saved to file in ${term}`);
      } else {
        reportResults.push({
          studentId: student.studentId,
          name: student.name,
          saved: false,
          error: "Failed to save to file"
        });
      }
    } else {
      reportResults.push({
        studentId: student.studentId,
        name: student.name,
        saved: false,
        error: "Student ID not found in system"
      });
      
      console.log(`[REPORT WARNING] Student ${student.studentId} not found in system`);
    }
  });

  // Generate summary HTML for admin preview
  const summaryHTML = generateSummaryHTML(classDisplayName, term, totalAttendance, vacationDate, reopenDate, reportResults);
  
  // Save summary for admin preview
  fs.writeFile(path.join(__dirname, 'public', 'report_summary.html'), summaryHTML, (err) => {
    if (err) {
      console.error('Failed to write file:', err);
      return res.status(500).send('Internal Server Error');
    }
    res.redirect('/report_summary.html');
  });
});

// Helper function to generate student report HTML
function generateStudentReport(student, className, totalAttendance, vacationDate, reopenDate, totalStudents) {
  return `
<div class="terminal-report">
  <div style="text-align: center; margin-bottom: 30px; border-bottom: 2px solid #333; padding-bottom: 20px;">
    <!-- <h1 style="margin: 0; color: #333;">GRACE TENDER CARE SCHOOL</h1> -->
    <h2 style="margin: 10px 0; color: #555;">TERMINAL REPORT</h2>
    <h3 style="margin: 5px 0; color: #777;">${className}</h3>
  </div>
  
  <div style="margin-bottom: 30px;">
    <h2 style="color: #333; margin-bottom: 15px;">${student.name}</h2>
    <table style="width: 100%; margin-bottom: 20px;">
      <tr>
        <td style="width: 50%; padding: 5px;"><strong>Student ID:</strong> ${student.studentId}</td>
        <td style="width: 50%; padding: 5px;"><strong>Position:</strong> ${student.position} out of ${totalStudents}</td>
      </tr>
      <tr>
        <td style="padding: 5px;"><strong>Total Score:</strong> ${student.cumulated}</td>
        <td style="padding: 5px;"><strong>Attendance:</strong> ${student.attendance} days out of ${totalAttendance}</td>
      </tr>
      <tr>
        <td style="padding: 5px;"><strong>House:</strong> ${student.house}</td>
        <td style="padding: 5px;"><strong>Promoted to:</strong> ${student.promotion || 'N/A'}</td>
      </tr>
      <tr>
        <td style="padding: 5px;"><strong>Vacation Date:</strong> ${vacationDate}</td>
        <td style="padding: 5px;"><strong>Reopen Date:</strong> ${reopenDate}</td>
      </tr>
    </table>
  </div>
  
  <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px;">
    <thead>
      <tr style="background-color: #f2f2f2;">
        <th style="border: 1px solid #333; padding: 10px; text-align: center;">Subject</th>
        <th style="border: 1px solid #333; padding: 10px; text-align: center;">Class Score<br>30%</th>
        <th style="border: 1px solid #333; padding: 10px; text-align: center;">Exam Score<br>70%</th>
        <th style="border: 1px solid #333; padding: 10px; text-align: center;">Total<br>100%</th>
        <th style="border: 1px solid #333; padding: 10px; text-align: center;">Grade</th>
        <th style="border: 1px solid #333; padding: 10px; text-align: center;">Remarks</th>
      </tr>
    </thead>
    <tbody>
      ${student.subjects.map(sub => `
        <tr>
          <td style="border: 1px solid #333; padding: 8px; text-align: left;">${sub.name}</td>
          <td style="border: 1px solid #333; padding: 8px; text-align: center;">${sub.classScore}</td>
          <td style="border: 1px solid #333; padding: 8px; text-align: center;">${sub.examScore}</td>
          <td style="border: 1px solid #333; padding: 8px; text-align: center;">${sub.total}</td>
          <td style="border: 1px solid #333; padding: 8px; text-align: center; font-weight: bold;">${sub.grade}</td>
          <td style="border: 1px solid #333; padding: 8px; text-align: center;">${sub.remark}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>
  
  <div style="margin-bottom: 30px;">
    <p><strong>Best Grade:</strong> ${student.bestGrade}</p>
    <p><strong>Worst Grade:</strong> ${student.worstGrade}</p>
    <p><strong>Student Interest:</strong> ${student.interest || 'N/A'}</p>
    <p><strong>Teacher's Comment:</strong> ${student.teacherComment || 'N/A'}</p>
    <p><strong>HOD's Comment:</strong> ${student.hodComment || 'N/A'}</p>
  </div>
  
  <!-- <div style="text-align: center; margin-top: 50px;">
    <div style="display: inline-block; text-align: center; margin: 0 50px;">
      <p style="border-top: 1px solid #333; width: 200px; margin: 0 auto; padding-top: 5px;">Head Teacher</p>
    </div>
    <div style="display: inline-block; text-align: center; margin: 0 50px;">
      <p style="border-top: 1px solid #333; width: 200px; margin: 0 auto; padding-top: 5px;">Class Teacher</p>
    </div>
  </div> -->
</div>`;
}

// Helper function to generate summary HTML
function generateSummaryHTML(className, term, totalAttendance, vacationDate, reopenDate, reportResults) {
  const savedCount = reportResults.filter(r => r.saved).length;
  const failedCount = reportResults.filter(r => !r.saved).length;
  
  return `
<!DOCTYPE html>
<html>
<head>
  <title>Report Summary - ${className}</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 20px; background-color: #f5f5f5; }
    .container { max-width: 800px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
    h1 { color: #333; text-align: center; }
    .summary-box { 
      background: #f8f9fa; 
      padding: 20px; 
      border-radius: 10px; 
      margin: 20px 0; 
      border-left: 5px solid #667eea;
    }
    .success { color: green; }
    .error { color: red; }
    .warning { color: orange; }
    .student-result { 
      padding: 10px; 
      margin: 10px 0; 
      border-radius: 5px; 
      border-left: 5px solid #ddd;
    }
    .student-result.success { border-left-color: #28a745; background-color: #d4edda; }
    .student-result.error { border-left-color: #dc3545; background-color: #f8d7da; }
    .actions { margin-top: 30px; text-align: center; }
    .btn { 
      display: inline-block; 
      padding: 10px 20px; 
      margin: 5px; 
      text-decoration: none; 
      border-radius: 5px; 
      font-weight: bold;
    }
    .btn-primary { background: #667eea; color: white; }
    .btn-secondary { background: #6c757d; color: white; }
    .term-badge { 
      display: inline-block; 
      padding: 5px 10px; 
      background: #764ba2; 
      color: white; 
      border-radius: 20px; 
      font-size: 0.9em;
      margin-left: 10px;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>Report Submission Summary <span class="term-badge">${term.toUpperCase()}</span></h1>
    
    <div class="summary-box">
      <h2>${className}</h2>
      <p><strong>Term:</strong> ${term}</p>
      <p><strong>Total Attendance Days:</strong> ${totalAttendance}</p>
      <p><strong>Vacation Date:</strong> ${vacationDate}</p>
      <p><strong>Reopen Date:</strong> ${reopenDate}</p>
      <p><strong>Reports Processed:</strong> ${reportResults.length}</p>
      <p><strong class="success">Successfully Saved:</strong> ${savedCount}</p>
      <p><strong class="${failedCount > 0 ? 'error' : 'warning'}">Failed:</strong> ${failedCount}</p>
    </div>
    
    <h2>Individual Student Results</h2>
    ${reportResults.map(result => `
      <div class="student-result ${result.saved ? 'success' : 'error'}">
        <strong>${result.name} (ID: ${result.studentId})</strong>
        ${result.saved ? 
          `<span class="success">✓ Saved successfully</span><br>
           <small>Position: ${result.position} | Total Score: ${result.cumulated}</small>` : 
          `<span class="error">✗ Failed to save</span><br>
           <small>Error: ${result.error}</small>`
        }
      </div>
    `).join('')}
    
    <div class="actions">
      <a href="/admin/report-entry" class="btn btn-primary">← Enter Another Report</a>
      <a href="/admin/dashboard" class="btn btn-secondary">Return to Dashboard</a>
    </div>
    
    <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; text-align: center;">
      <p><strong>Note:</strong> Reports have been saved directly to the student files in the <code>users/</code> directory.</p>
      <p>Students can now view their reports by logging in and selecting the appropriate term.</p>
    </div>
  </div>
</body>
</html>`;
}

// Logout handler
app.get('/logout', (req, res) => {
  const username = req.session.user;
  const ip = getClientIP(req);
  
  if (username) {
    console.log(`[LOGOUT] ${username} logged out from IP: ${ip} at ${new Date().toLocaleString()}`);
  }
  
  req.session.destroy();
  res.redirect('/');
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Loaded ${Object.keys(users).length} users from files`);
});
