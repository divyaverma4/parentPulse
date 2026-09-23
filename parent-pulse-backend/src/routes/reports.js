import express from 'express';
import fs from 'fs';
import path from 'path';

const router = express.Router();

// Serve everything from /public
const PUBLIC_DIR = path.resolve(process.cwd(), 'public');

// Store BOTH JSON files in public so the frontend can fetch them.
// Prefer the latest files from the project jsonData folder when present so the app
// reflects newly scraped data immediately.
const SAMPLE_REPORT_FILE = path.join(PUBLIC_DIR, 'sampleReport.json');
const SAMIR_GRADES_FILE = path.join(PUBLIC_DIR, 'grades_samir.json');
const JSON_DATA_DIR = path.resolve(process.cwd(), 'jsonData');

async function readLatestJson(fileName, publicPath) {
  const projectPath = path.join(JSON_DATA_DIR, fileName);

  if (fs.existsSync(projectPath)) {
    const raw = await fs.promises.readFile(projectPath, 'utf-8');
    return JSON.parse(raw);
  }

  if (fs.existsSync(publicPath)) {
    const raw = await fs.promises.readFile(publicPath, 'utf-8');
    return JSON.parse(raw);
  }

  return null;
}

// GET /api/reports/latest
router.get('/latest', async (req, res) => {
  try {
    const response = {};

    response.sampleReport = await readLatestJson('sampleReport.json', SAMPLE_REPORT_FILE);
    response.gradesSamir = await readLatestJson('grades_samir.json', SAMIR_GRADES_FILE);

    if (!response.sampleReport && !response.gradesSamir) {
      return res.status(404).json({ error: 'No report files found' });
    }

    res.json(response);

  } catch (err) {
    console.error('Error reading latest report:', err);
    res.status(500).json({ error: 'Failed to read report files' });
  }
});

// POST /api/reports/upload
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

    // Always prefer the current project data files in jsonData so the app never uses stale copies.
    await fs.promises.mkdir(JSON_DATA_DIR, { recursive: true });
    await fs.promises.writeFile(path.join(JSON_DATA_DIR, 'sampleReport.json'), out, 'utf-8');

    // Keep public copies in sync for direct static access, but do not treat them as the source of truth.
    await fs.promises.mkdir(PUBLIC_DIR, { recursive: true });
    await fs.promises.writeFile(SAMPLE_REPORT_FILE, out, 'utf-8');

    res.json({ ok: true, path: '/sampleReport.json', source: path.join(JSON_DATA_DIR, 'sampleReport.json') });

  } catch (err) {
    console.error('Error saving report:', err);
    res.status(500).json({ error: 'Failed to save report' });
  }
});

export default router;
