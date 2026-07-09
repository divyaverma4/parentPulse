import express from 'express';
import OpenAI from 'openai';
import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

const router = express.Router();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// In-memory quiz sessions
const quizSessions = {};
// Structure:
// quizSessions[quizId] = {
//   questions: [...],
//   index: 0,
//   score: 0,
//   results: [
//      { question, answer, correct, explanation }
//   ]
// };


// ⭐ Fisher–Yates Shuffle
function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}


// 1️⃣ START QUIZ FROM PDF
router.post('/quiz-from-pdf', async (req, res) => {
    try {
        const { prompt, fileName, fileData } = req.body;

        if (!prompt || !fileName || !fileData) {
            return res.status(400).json({ error: "Missing required fields." });
        }

        if (!process.env.OPENAI_API_KEY) {
            return res.status(500).json({ error: "OpenAI API key not configured." });
        }

        // Ask OpenAI to generate quiz questions
        const completion = await openai.chat.completions.create({
            model: "gpt-4.1",
            messages: [
                {
                    role: "user",
                    content: [
                        {
                            type: "text",
                            text: "Using this PDF, generate 10 quiz questions. Only output the questions in a numbered list."
                        },
                        {
                            type: "file",
                            file: {
                                name: fileName,
                                mime_type: "application/pdf",
                                data: fileData
                            }
                        }
                    ]
                }
            ]
        });

        const raw = completion.choices?.[0]?.message?.content || "";

        // Parse questions
        const parsedQuestions = raw
            .split("\n")
            .map(q => q.replace(/^\d+\.\s*/, "").trim())
            .filter(q => q.length > 0);

        if (parsedQuestions.length === 0) {
            return res.json({ response: "Could not generate quiz questions." });
        }

        // ⭐ Shuffle questions
        const questions = shuffle(parsedQuestions);

        // Create quiz session
        const quizId = crypto.randomUUID();
        quizSessions[quizId] = {
            questions,
            index: 0,
            score: 0,
            results: []
        };

        res.json({
            quizId,
            question: questions[0]
        });

    } catch (err) {
        console.error("Quiz-from-PDF error:", err);
        res.status(500).json({ error: "Failed to start quiz." });
    }
});


// 2️⃣ ANSWER A QUIZ QUESTION
router.post('/quiz-answer', async (req, res) => {
    try {
        const { quizId, answer } = req.body;

        if (!quizId || !answer) {
            return res.status(400).json({ error: "Missing quizId or answer." });
        }

        const session = quizSessions[quizId];
        if (!session) {
            return res.status(404).json({ error: "Quiz session not found." });
        }

        const question = session.questions[session.index];

        // Ask OpenAI to evaluate the answer
        const evaluation = await openai.chat.completions.create({
            model: "gpt-4.1",
            messages: [
                {
                    role: "user",
                    content: [
                        {
                            type: "text",
                            text: `
Evaluate the user's answer.

Question: ${question}
Answer: ${answer}

Respond in JSON with:
{
  "correct": true/false,
  "explanation": "1-2 sentence explanation"
}
                            `
                        }
                    ]
                }
            ]
        });

        let result;
        try {
            result = JSON.parse(evaluation.choices[0].message.content);
        } catch {
            result = {
                correct: false,
                explanation: "Could not parse evaluation."
            };
        }

        // Track score + store result
        if (result.correct) {
            session.score++;
        }

        session.results.push({
            question,
            answer,
            correct: result.correct,
            explanation: result.explanation
        });

        // Move to next question
        session.index++;

        const nextQuestion =
            session.index < session.questions.length
                ? session.questions[session.index]
                : null;

        // ⭐ If quiz is finished, return summary
        if (!nextQuestion) {
            const total = session.questions.length;
            const correct = session.score;
            const incorrect = total - correct;
            const percentage = Math.round((correct / total) * 100);

            return res.json({
                correct: result.correct,
                explanation: result.explanation,
                nextQuestion: null,
                summary: {
                    totalQuestions: total,
                    correct,
                    incorrect,
                    percentage,
                    results: session.results
                }
            });
        }

        // Normal response
        res.json({
            correct: result.correct,
            explanation: result.explanation,
            nextQuestion
        });

    } catch (err) {
        console.error("Quiz-answer error:", err);
        res.status(500).json({ error: "Failed to evaluate answer." });
    }
});

export default router;
