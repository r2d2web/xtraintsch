module.exports = {
  "user1": {
    name: "David Ansong Kwakye",
    password: "1234",
    info: "David's dashboard info",
    image: "images/logo.png",
    showExtraDiv: true,
    links: [
      { label: "My Profile", url: "https://example.com/1" },
      { label: "Grades", url: "https://example.com/2" },
      { label: "Timetable", url: "https://example.com/3" },
      { label: "Assignments", url: "https://example.com/4" },
      { label: "Library", url: "https://example.com/5" },
      { label: "Course Materials", url: "https://example.com/6" },
      { label: "Past Questions", url: "https://example.com/7" },
      { label: "Forum", url: "https://example.com/8" },
      { label: "Notice Board", url: "https://example.com/9" },
      { label: "Results", url: "https://example.com/10" },
      { label: "Payments", url: "https://example.com/11" },
      { label: "Help Center", url: "https://example.com/12" },
      { label: "Settings", url: "https://example.com/13" },
      { label: "Feedback", url: "https://example.com/14" },
      { label: "Logout", url: "https://example.com/15" },
      { label: "Dondo", url: "https://example.com/15" }
    ],
    gallery: {
      term1: ["images/1.jpg", "images/2.jpg", "images/3.jpg"],
      term2: ["images/4.jpg", "images/4.jpg"],
      term3: ["images/5.jpg", "images/6.jpg"]
    },
    customHTML: {
      term1: `
        <h2>TERMINAL REPORT</h2>
      <p><b>Student Name:</b> name | <!-- Removed index --> <b>Class:</b> class</p>
      <p><b>Attendance:</b> attendance | <b>Roll:</b> roll | <b>Term:</b> term | <b>Year:</b> year</p>
      <p><b>House:</b> house | <b>Position:</b> position | <b>Promoted To:</b> p</p>
      <p><b>Vacation Date:</b> v date | <b>Reopen Date:</b> r date</p>

      <table>
        <tr><th>Subject</th><th>Class Score (30%)</th><th>Exam Score (70%)</th><th>Total</th><th>Grade</th><th>Remarks</th><th>Teacher</th></tr><tr>
        <td>rme</td>
        <td>10</td>
        <td>10</td>
        <td>20</td>
        <td>F</td>
        <td>WEAK</td>
        <td>grace</td>
      </tr><tr>
        <td>subject</td>
        <td>10</td>
        <td>20</td>
        <td>30</td>
        <td>F</td>
        <td>WEAK</td>
        <td>teacher</td>
      </tr></table>
      <h4>Performance Analysis</h4>
      <p><b>Cumulated Score:</b> 50 | <b>Best Grade:</b> F | <b>Worst Grade:</b> F</p>
      <p><b>Interest:</b> interest | <b>Class Teacher's Remark:</b> remarks | <b>HOD's Remark:</b> bad</p>
    </div>
      `,
      term2: `
      <div class="candidate">
        <h1>RESULT SLIP</h1>
        <h2>David Obiri (1234) — Position: 1</h2>
        <table>
          <tr><th>Subject</th><th>Mark</th><th>Grade</th></tr>
          
            <tr>
              <td>English Language</td>
              <td>100</td>
              <td>1</td>
            </tr>
            <tr>
              <td>Social Studies</td>
              <td>10</td>
              <td>9</td>
            </tr>
            <tr>
              <td>Integrated Science</td>
              <td>2</td>
              <td>9</td>
            </tr>
            <tr>
              <td>Mathematics</td>
              <td>69</td>
              <td>4</td>
            </tr>
            <tr>
              <td>Religious & Moral Education</td>
              <td>2</td>
              <td>9</td>
            </tr>
            <tr>
              <td>Computing</td>
              <td>78</td>
              <td>3</td>
            </tr>
            <tr>
              <td>Career Technology</td>
              <td>30</td>
              <td>9</td>
            </tr>
            <tr>
              <td>Twi</td>
              <td>38</td>
              <td>8</td>
            </tr>
            <tr>
              <td>Creative Arts</td>
              <td>37</td>
              <td>8</td>
            </tr>
            <tr>
              <td>French</td>
              <td>74</td>
              <td>3</td>
            </tr>
        </table>
        <p><strong>Aggregate:</strong> 28</p>
        </div>
      
      `,
      term3: `<div class="announcement"><h3>Final Term Notice</h3><p>Submit all projects before July 28th.</p></div>`
    }
  },
  "user2": {
    name: "Bob",
    password: "1234",
    info: "Bob's secret data",
    image: "images/bob.jpg",
    showExtraDiv: false,
    links: [],
    gallery: {
      term1: ["images/bob1.jpg"],
      term2: ["images/bob2.jpg"],
      term3: ["images/bob3.jpg"]
    },
    customHTML: {
      term1: `
      <h2>dan (Position: 2 out of 2)</h2>
        <p>Class: Class 5</p>
        <p>Vacation Date: 17th April, 2025</p>
        <p>Reopen Date: 6th May, 2025</p>
        <p>House: 2, Attendance: 67 days out of 31</p>
        <p>Cumulated Score: 0</p>
        <p>Best Grade: F, Worst Grade: F</p>
        <p>Promotion: -</p>
        <p>Teacher's Comment: -</p>
        <p>Interest: -</p>
        <p>HOD's Comment: -</p>
        <table>
          <thead>
            <tr>
              <th>Subject</th>
              <th>Class Score</th>
              <th>Exam Score</th>
              <th>Total</th>
              <th>Grade</th>
              <th>Remarks</th>
            </tr>
          </thead>
          <tbody>
            
              <tr>
                <td>Creative Arts</td>
                <td>0</td>
                <td>0</td>
                <td>0</td>
                <td>F</td>
                <td>Weak</td>
              </tr>
            
          </tbody>
        </table>
        
      `,
      term2: `
      <h1>Terminal Report</h1>
        <h2>dan (Position: 2 out of 2)</h2>
        <p>Class: Class 5</p>
        <p>Vacation Date: 17th April, 2025</p>
        <p>Reopen Date: 6th May, 2025</p>
        <p>House: house, Attendance: 67 days out of 31</p>
        <p>Cumulated Score: 0</p>
        <p>Best Grade: F, Worst Grade: F</p>
        <p>Promotion: -</p>
        <p>Teacher's Comment: -</p>
        <p>Interest: -</p>
        <p>HOD's Comment: -</p>
        <table>
          <thead>
            <tr>
              <th>Subject</th>
              <th>Class Score</th>
              <th>Exam Score</th>
              <th>Total</th>
              <th>Grade</th>
              <th>Remarks</th>
            </tr>
          </thead>
          <tbody>
            
              <tr>
                <td>rme</td>
                <td>0</td>
                <td>0</td>
                <td>0</td>
                <td>F</td>
                <td>Weak</td>
              </tr>
            
          </tbody>
        </table>
      `,
      term3: `
      <div style="page-break-after: always; margin-bottom: 50px;">
        <div class="center">
          <img src="images/logo1.png" style="height: 80px; float: left;">
          <img src="images/logo1.png" style="height: 80px; float: right;">
          <h2 class="red">GRACE TENDER CARE SCHOOL – NSUMIA</h2>
          <h3 class="red">FIRST TERM BILL FOR CLASS</h3>
        </div>

        <div style="margin-top: 40px;">
          <p><span class="bold">NAME OF CHILD:</span> 0</p>
          <p><span class="bold">SCHOOL FEES</span> = 0.00</p>
          <p><span class="bold">FEEDING FEE</span> = 0.00</p>
          <p><span class="bold">EXAMS</span> = 0.00</p>
          <p><span class="bold">ARREARS</span> = 0.00</p>
        </div>

        <div class="bill-box">
          <p><h2 class="bold">TOTAL</h2></p>
          <h2><strong>GH₵ 0.00</strong></h2>
        </div>

        <div style="clear: both; margin-top: 50px;">
          <p><strong>NOTE:</strong></p>
          <ol>
            <li>Parents are reminded to pay at least half of the fees before or on reopening of school.</li>
            <li>This term's P.T.A. comes off on the 25<sup>th</sup> of May, 2025 at 2:00 o’clock at the school premises.</li>
          </ol>
          <p>Thank you.</p>
        </div>
      </div>
    
      `
    }
  }
}