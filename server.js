require('dotenv').config();
const express = require('express');
const multer = require('multer');
const pool = require('./db');
const path = require('path');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

/* ------------------------
   Multer Config (Resume Upload)
------------------------ */
const fs = require('fs');
const uploadsDir = path.join(__dirname, 'uploads');

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
  console.log('✅ uploads directory created');
}

// Multer config to store resumes
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    let originalName = file.originalname;
    if (!originalName.toLowerCase().endsWith('.pdf')) {
      originalName += '.pdf';
    }
    cb(null, originalName);
  }
});
const upload = multer({ storage });


/* ------------------------
   Database Initialization Route
------------------------ */
app.get('/init-db', async (req, res) => {
  try {
    const query = `
      CREATE TABLE IF NOT EXISTS candidates (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100),
        specialization VARCHAR(100),
        location VARCHAR(100),
        years_experience VARCHAR(50),
        remark TEXT,
        resume_url TEXT,
        employee_referral BOOLEAN DEFAULT false,
        employee_id VARCHAR(50),
        consultancy_referral BOOLEAN DEFAULT false,
        consultancy_name VARCHAR(100)
      );
    `;
    await pool.query(query);
    res.send('✅ candidates table created successfully (if not existed)');
  } catch (err) {
    console.error('❌ Error creating table:', err);
    res.status(500).send('Error creating table: ' + err.message);
  }
});

/* ------------------------
   API ROUTES
------------------------ */

// POST: Add candidate
app.post('/candidates', upload.single('resume'), async (req, res) => {
  try {
    const {
      name,
      specialization,
      location,
      years_experience,
      remark,
      employee_referral,
      employee_id,
      consultancy_referral,
      consultancy_name,
    } = req.body;

    if (employee_referral === 'true' && consultancy_referral === 'true') {
      return res.status(400).json({ error: "Only one referral type can be true." });
    }

    const resumeUrl = req.file ? `/uploads/${req.file.filename}` : '';

    const result = await pool.query(
      `INSERT INTO candidates 
        (name, specialization, location, years_experience, remark, resume_url, employee_referral, employee_id, consultancy_referral, consultancy_name) 
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [
        name,
        specialization,
        location,
        years_experience,
        remark,
        resumeUrl,
        employee_referral === 'true',
        employee_referral === 'true' ? employee_id : null,
        consultancy_referral === 'true',
        consultancy_referral === 'true' ? consultancy_name : null,
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'An error occurred while saving the candidate.' });
  }
});

// GET: Fetch all candidates
app.get('/candidates', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM candidates');
    res.status(200).json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'An error occurred while fetching candidates.' });
  }
});

// GET: Dashboard stats
app.get('/dashboard-stats', async (req, res) => {
  try {
    const stats = {};

    const total = await pool.query(`SELECT COUNT(*) FROM candidates`);
    stats.total_candidates = parseInt(total.rows[0].count);

    const freshers = await pool.query(`SELECT COUNT(*) FROM candidates WHERE specialization = 'Fresher'`);
    stats.freshers = parseInt(freshers.rows[0].count);
    stats.experienced = stats.total_candidates - stats.freshers;

    const employeeRef = await pool.query(`SELECT COUNT(*) FROM candidates WHERE employee_referral = true`);
    stats.employee_referrals = parseInt(employeeRef.rows[0].count);

    const consultancyRef = await pool.query(`SELECT COUNT(*) FROM candidates WHERE consultancy_referral = true`);
    stats.consultancy_referrals = parseInt(consultancyRef.rows[0].count);

    const locations = await pool.query(`SELECT location, COUNT(*) FROM candidates GROUP BY location`);
    stats.candidates_by_location = locations.rows;

    const experience = await pool.query(`SELECT years_experience, COUNT(*) FROM candidates GROUP BY years_experience`);
    stats.candidates_by_experience = experience.rows;

    res.json(stats);
  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard stats.' });
  }
});

// DELETE: Candidate by ID
app.delete('/candidates/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('DELETE FROM candidates WHERE id = $1 RETURNING *', [id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Candidate not found.' });
    }
    res.json({ message: 'Candidate deleted successfully.' });
  } catch (error) {
    console.error('Error deleting candidate:', error);
    res.status(500).json({ error: 'An error occurred while deleting the candidate.' });
  }
});

// PUT: Update candidate
app.put('/candidates/:id', async (req, res) => {
  const { id } = req.params;
  const {
    name,
    specialization,
    location,
    years_experience,
    remark,
    employee_referral,
    employee_id,
    consultancy_referral,
    consultancy_name
  } = req.body;

  try {
    const result = await pool.query(
      `UPDATE candidates SET
        name = $1,
        specialization = $2,
        location = $3,
        years_experience = $4,
        remark = $5,
        employee_referral = $6,
        employee_id = $7,
        consultancy_referral = $8,
        consultancy_name = $9
      WHERE id = $10 RETURNING *`,
      [
        name,
        specialization,
        location,
        years_experience,
        remark,
        employee_referral === true,
        employee_referral ? employee_id : null,
        consultancy_referral === true,
        consultancy_referral ? consultancy_name : null,
        id
      ]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Candidate not found.' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating candidate:', error);
    res.status(500).json({ error: 'An error occurred while updating the candidate.' });
  }
});

/* ------------------------
   Static Files
------------------------ */
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

/* ------------------------
   Fallback & Server Start
------------------------ */
app.use((req, res) => {
  console.log(`❌ No route matched for ${req.method} ${req.originalUrl}`);
  res.status(404).send('Route not found');
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});

