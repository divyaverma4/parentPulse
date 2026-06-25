import express from 'express';
import multer from 'multer';
import OpenAI from 'openai';

const upload = multer();
const router = express.Router();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

router.post('/quiz-from-pdf', upload.single("file"), async (req, res) => {
    try {
        const prompt = req.body.prompt;
        const pdfBuffer = req.file.buffer;

        // Upload file to OpenAI
        const uploaded = await openai.files.create({
            file: pdfBuffer,
            purpose: "assistants"
        });

        // Ask OpenAI using file_id
        const completion = await openai.chat.completions.create({
            model: "gpt-4.1",
            messages: [
                {
                    role: "user",
                    content: [
                        { type: "text", text: prompt },
                        { type: "file", file_id: uploaded.id }
                    ]
                }
            ]
        });

        res.json({
            response: completion.choices[0].message.content
        });

    } catch (err) {
        console.error("Quiz-from-PDF error:", err);
        res.status(500).json({ error: "Failed to process PDF quiz request." });
    }
});

export default router;
