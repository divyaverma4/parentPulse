import express from 'express';
import OpenAI from 'openai';

const router = express.Router();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

router.post('/quiz-from-pdf', async (req, res) => {
    try {
        const { prompt, fileName, fileData } = req.body;

        if (!prompt || !fileName || !fileData) {
            return res.status(400).json({ error: "Missing required fields." });
        }

        // 1️⃣ Upload the PDF to OpenAI
        const uploaded = await openai.files.create({
            file: Buffer.from(fileData, "base64"),
            purpose: "assistants"
        });

        // 2️⃣ Use file_id in the chat request
        const completion = await openai.chat.completions.create({
            model: "gpt-4.1",
            messages: [
                {
                    role: "user",
                    content: [
                        {
                            type: "text",
                            text: prompt
                        },
                        {
                            type: "file",
                            file_id: uploaded.id
                        }
                    ]
                }
            ]
        });

        const answer =
            completion.choices?.[0]?.message?.content ||
            "I started the quiz, but no response was returned.";

        res.json({ response: answer });

    } catch (err) {
        console.error("Quiz-from-PDF error:", err);
        res.status(500).json({ error: "Failed to process PDF quiz request." });
    }
});

export default router;
