import express from 'express';
import fs from 'fs';
import path from 'path';

const router = express.Router();

const PUBLIC_DIR = path.resolve(process.cwd(), 'public');
const REPORT_FILE = path.join(PUBLIC_DIR, 'sampleReport.json');

router.get('/latest', async (req, res) => {
  try {
    if (!fs.existsSync(REPORT_FILE)) return res.status(404).json({ error: 'No report found' });
    const raw = await fs.promises.readFile(REPORT_FILE, 'utf-8');
    const json = JSON.parse(raw);
    res.json(json);
  } catch (err) {
    console.error('Error reading latest report:', err);
    res.status(500).json({ error: 'Failed to read report' });
  }
});

// Simple upload endpoint: accepts JSON body and overwrites public/sampleReport.json
// Optional protection: set REPORT_UPLOAD_KEY env var and POST with header 'x-upload-key' matching it.
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
    if (!report || typeof report !== 'object') return res.status(400).json({ error: 'JSON body required' });

    const out = JSON.stringify(report, null, 2);
    await fs.promises.writeFile(REPORT_FILE, out, 'utf-8');

    // return the saved report
    res.json({ ok: true, path: '/sampleReport.json' });
  } catch (err) {
    console.error('Error saving report:', err);
    res.status(500).json({ error: 'Failed to save report' });
  }
});

export default router;
