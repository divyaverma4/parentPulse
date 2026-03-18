import express from 'express';
import { askQuestion, getStudentInsights } from '../chatbot.js';

const router = express.Router();

/**
 * POST /api/chat/ask
 * Ask a question about student grades with live database context
 * Body: { question, studentUserId, courseId? }
 */
router.post('/ask', async (req, res) => {
  try {
    const { question, studentUserId, courseId } = req.body;

    if (!question) {
      return res.status(400).json({
        error: 'Question is required',
      });
    }

    if (!studentUserId) {
      return res.status(400).json({
        error: 'studentUserId is required',
      });
    }

    const result = await askQuestion(question, studentUserId, courseId);
    res.json(result);
  } catch (error) {
    console.error('Error in /ask endpoint:', error);
    res.status(500).json({
      error: 'Failed to process question',
      message: error.message,
    });
  }
});

/**
 * GET /api/chat/insights/:studentUserId
 * Get student performance insights
 */
router.get('/insights/:studentUserId', async (req, res) => {
  try {
    const { studentUserId } = req.params;
    const { courseId } = req.query;

    const insights = await getStudentInsights(parseInt(studentUserId), courseId ? parseInt(courseId) : null);
    res.json(insights);
  } catch (error) {
    console.error('Error in /insights endpoint:', error);
    res.status(500).json({
      error: 'Failed to fetch insights',
      message: error.message,
    });
  }
});

/**
 * POST /api/chat/stream
 * Stream the AI response in real-time based on database context
 */
router.post('/stream', async (req, res) => {
  try {
    const { question, studentUserId, courseId } = req.body;

    if (!question || !studentUserId) {
      return res.status(400).json({
        error: 'Question and studentUserId are required',
      });
    }

    // Set headers for streaming
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Import here to avoid issues
    const { generateResponseStream } = await import('../openaiClient.js');
    const { queryContextForQuestion, formatContextForOpenAI } = await import('../supabaseClient.js');
    
    const contextData = await queryContextForQuestion(question, studentUserId, courseId);
    const contextString = formatContextForOpenAI(contextData);
    
    const stream = await generateResponseStream(question, contextString);

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || '';
      if (content) {
        res.write(`data: ${JSON.stringify({ content })}\n\n`);
      }
    }

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (error) {
    console.error('Error in /stream endpoint:', error);
    res.status(500).json({
      error: 'Failed to stream response',
      message: error.message,
    });
  }
});

export default router;
