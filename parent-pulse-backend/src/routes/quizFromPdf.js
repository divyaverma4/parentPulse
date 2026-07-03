import express from 'express';
import multer from 'multer';
import OpenAI from 'openai';
import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

const upload = multer();
const router = express.Router();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const quizSessions = {};

router.post('/quiz-from-pdf', async (req, res) => {
  try {
    const { pdfName } = req.body;

    if (!pdfName) {
      return res.status(400).json({ error: 'pdfName is required' });
    }

    const pdfPath = path.join('/app/pdfs', pdfName);

    if (!fs.existsSync(pdfPath)) {
      return res.status(404).json({ error: 'PDF not found on server' });
    }

    const pdfBuffer = fs.readFileSync(pdfPath);
    const parsed = await pdfParse(pdfBuffer);
    const text = parsed.text;

    const quiz = generateQuizFromText(text);

    const quizId = crypto.randomUUID();
    quizSessions[quizId] = { questions: quiz, index: 0 };

    res.json({ quizId, question: quiz[0] });
  } catch (err) {
    console.error('Quiz-from-PDF error:', err);
    res.status(500).json({ error: 'Failed to process PDF quiz request.' });
  }
});


router.post('/quiz-answer', async (req, res) => {
    try {
        const { quizId, answer } = req.body;

        if (!quizId || !answer) {
            return res.status(400).json({ error: 'Missing quizId or answer.' });
        }

        const session = quizSessions[quizId];
        if (!session) {
            return res.status(404).json({ error: 'Quiz session not found.' });
        }

        const question = session.questions[session.index];
        const evaluation = await openai.responses.create({
            model: 'gpt-4.1',
            input: [
                {
                    role: 'user',
                    content: [
                        {
                            type: 'input_text',
                            text: `Evaluate the user's answer.\n\nQuestion: ${question}\nAnswer: ${answer}\n\nRespond with strict JSON in this format: {"correct": true/false, "explanation": "1-2 sentence explanation"}`
                        }
                    ]
                }
            ]
        });

        let result;
        try {
            const raw = (evaluation.output_text || '').replace(/```json|```/g, '').trim();
            result = JSON.parse(raw);
        } catch {
            result = {
                correct: false,
                explanation: 'Could not parse evaluation.'
            };
        }

        session.index += 1;
        const nextQuestion = session.index < session.questions.length ? session.questions[session.index] : null;

        return res.json({
            correct: result.correct,
            explanation: result.explanation,
            nextQuestion
        });
    } catch (err) {
        console.error('Quiz-answer error:', err);
        return res.status(500).json({ error: 'Failed to evaluate answer.' });
    }
});

export default router;
