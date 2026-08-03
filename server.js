const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3456;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(__dirname));

const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const DURATION_FILE = path.join(DATA_DIR, 'duration.json');
const SUMMARY_FILE = path.join(DATA_DIR, 'summary.json');
const LOCK_FILE = path.join(DATA_DIR, 'lock.json');

// Simple file-based lock to prevent concurrent write corruption
function acquireLock(key) {
  let locks = {};
  try { locks = JSON.parse(fs.readFileSync(LOCK_FILE, 'utf-8')); } catch (e) {}
  if (locks[key]) return false;
  locks[key] = Date.now();
  fs.writeFileSync(LOCK_FILE, JSON.stringify(locks));
  return true;
}

function releaseLock(key) {
  let locks = {};
  try { locks = JSON.parse(fs.readFileSync(LOCK_FILE, 'utf-8')); } catch (e) {}
  delete locks[key];
  fs.writeFileSync(LOCK_FILE, JSON.stringify(locks));
}

function readData(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf-8')); }
  catch (e) { return null; }
}

function writeData(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

// ===== Duration API =====
app.get('/api/duration', (req, res) => {
  let data = readData(DURATION_FILE);
  res.json({ success: true, data: data || [] });
});

app.post('/api/duration', (req, res) => {
  let key = 'duration';
  let waited = 0;
  while (!acquireLock(key) && waited < 3000) {
    // Busy wait max 3 seconds
    const start = Date.now();
    while (Date.now() - start < 50) {} 
    waited += 50;
  }
  if (!acquireLock(key)) {
    // Force acquire after timeout
    let locks = {};
    try { locks = JSON.parse(fs.readFileSync(LOCK_FILE, 'utf-8')); } catch (e) {}
    delete locks[key];
    fs.writeFileSync(LOCK_FILE, JSON.stringify(locks));
    acquireLock(key);
  }
  
  try {
    writeData(DURATION_FILE, req.body);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  } finally {
    releaseLock(key);
  }
});

// ===== Summary API =====
app.get('/api/summary', (req, res) => {
  let data = readData(SUMMARY_FILE);
  res.json({ success: true, data: data || [] });
});

app.post('/api/summary', (req, res) => {
  let key = 'summary';
  let waited = 0;
  while (!acquireLock(key) && waited < 3000) {
    const start = Date.now();
    while (Date.now() - start < 50) {} 
    waited += 50;
  }
  if (!acquireLock(key)) {
    let locks = {};
    try { locks = JSON.parse(fs.readFileSync(LOCK_FILE, 'utf-8')); } catch (e) {}
    delete locks[key];
    fs.writeFileSync(LOCK_FILE, JSON.stringify(locks));
    acquireLock(key);
  }
  
  try {
    writeData(SUMMARY_FILE, req.body);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  } finally {
    releaseLock(key);
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ success: true, time: Date.now() });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
