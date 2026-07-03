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

router.post('/quiz-from-pdf', upload.single('file'), async (req, res) => {
  try {
    const prompt =
      req.body.prompt ||
      'Using this PDF, quiz me on the material. Ask me questions one by one and assess my answer.';

    const pdfBuffer = req.file?.buffer;
    const fileName = req.file?.originalname || req.body.fileName || 'report.pdf';

    if (!pdfBuffer) {
      return res.status(400).json({ error: 'Missing PDF file upload.' });
    }

    // FIX: Use Node buffer upload instead of browser File()
    const uploaded = await openai.files.create({
      file: {
        buffer: pdfBuffer,
        filename: fileName,
        mimeType: req.file?.mimetype || 'application/pdf'
      },
      purpose: 'assistants'
    });

    const response = await openai.responses.create({
      model: 'gpt-4.1',
      input: [
        {
          role: 'user',
          content: [
            {
              type: 'input_text',
              text: `${prompt}\n\nCreate 5 quiz questions based on the attached PDF. Return only a numbered list with one question per line.`
            },
            {
              type: 'input_file',
              file_id: uploaded.id
            }
          ]
        }
      ]
    });

    const raw = response.output_text || '';
    const questions = raw
      .split(/\r?\n/)
      .map((q) => q.replace(/^\s*\d+[.)]\s*/, '').trim())
      .filter((q) => q.length > 0);

    if (questions.length === 0) {
      return res.status(500).json({ error: 'Could not generate quiz questions from PDF.' });
    }

    const quizId = crypto.randomUUID();
    quizSessions[quizId] = { questions, index: 0 };

    return res.json({ quizId, question: questions[0] });
  } catch (err) {
    console.error('Quiz-from-PDF error:', err);
    return res.status(500).json({ error: 'Failed to process PDF quiz request.' });
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
