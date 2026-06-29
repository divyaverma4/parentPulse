import express from 'express';
import fs from 'fs';
import path from 'path';

const router = express.Router();

const PUBLIC_DIR = path.resolve(process.cwd(), 'public');
const SAMPLE_REPORT_FILE = path.join(JSON_DIR, 'sampleReport.json');
const SAMIR_GRADES_FILE = path.join(PUBLIC_DIR, 'grades_samir.json');

router.get('/latest', async (req, res) => {
  try {
    const response = {};

    // Load sampleReport.json
    if (fs.existsSync(SAMPLE_REPORT_FILE)) {
      const raw = await fs.promises.readFile(SAMPLE_REPORT_FILE, 'utf-8');
      response.sampleReport = JSON.parse(raw);
    } else {
      response.sampleReport = null;
    }

    // Load grades_samir.json
    if (fs.existsSync(SAMIR_GRADES_FILE)) {
      const raw = await fs.promises.readFile(SAMIR_GRADES_FILE, 'utf-8');
      response.gradesSamir = JSON.parse(raw);
    } else {
      response.gradesSamir = null;
    }

    // If both missing → 404
    if (!response.sampleReport && !response.gradesSamir) {
      return res.status(404).json({ error: 'No report files found' });
    }

    res.json(response);

  } catch (err) {
    console.error('Error reading latest report:', err);
    res.status(500).json({ error: 'Failed to read report files' });
  }
});

// Upload endpoint (unchanged)
router.post('/upload', async (req, res) => {
  try {
    const UPLOAD_KEY = process.env.REPORT_UPLOAD_KEY;
    if (UPLOAD_KEY) {
      const provided = req.headers['x-upload-key'];
      if (!provided || provided !== UPLOAD_KEY) {
        return res.status(401).json({ error: 'Unauthorized: missing or invalid upload key' });
      }
    }

    const report = req.body;
    if (!report || typeof report !== 'object') {
      return res.status(400).json({ error: 'JSON body required' });
    }

    const out = JSON.stringify(report, null, 2);
    await fs.promises.writeFile(SAMPLE_REPORT_FILE, out, 'utf-8');

    res.json({ ok: true, path: '/sampleReport.json' });

  } catch (err) {
    console.error('Error saving report:', err);
    res.status(500).json({ error: 'Failed to save report' });
  }
});

export default router;
