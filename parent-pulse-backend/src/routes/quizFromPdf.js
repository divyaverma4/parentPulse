import express from 'express';
import OpenAI from 'openai';
import crypto from 'crypto';
import dotenv from 'dotenv';
import fs from 'fs/promises';
import { createReadStream } from 'fs';
import path from 'path';

dotenv.config();

const router = express.Router();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const quizSessions = {};

router.post('/quiz-from-pdf', async (req, res) => {
  try {
    const prompt =
      req.body?.prompt ||
      'Using this PDF, quiz me on the material. Ask me questions one by one and assess my answer.';

    const fileName = req.body?.fileName || req.body?.pdfName || 'report.pdf';

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ error: 'OpenAI API key is not configured.' });
    }

    let resolvedPath = null;
    if (req.body?.pdfName || req.body?.fileName) {
      const publicDir = path.resolve(process.cwd(), 'public');
      const candidates = [
        path.resolve(publicDir, req.body?.pdfName || req.body?.fileName),
        path.resolve(process.cwd(), req.body?.pdfName || req.body?.fileName),
        path.resolve(req.body?.pdfName || req.body?.fileName)
      ];

      resolvedPath = await (async () => {
        for (const candidate of candidates) {
          try {
            await fs.access(candidate);
            return candidate;
          } catch {
            // continue searching
          }
        }
        return null;
      })();

      if (!resolvedPath) {
        return res.status(400).json({ error: 'PDF file not found on the server.' });
      }

    }

    if (!resolvedPath) {
      return res.status(400).json({ error: 'Missing PDF file upload or file name.' });
    }

    const uploaded = await openai.files.create({
      file: createReadStream(resolvedPath),
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
    return res.status(500).json({
      error: 'Failed to process PDF quiz request.',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
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
