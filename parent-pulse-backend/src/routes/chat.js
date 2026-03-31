// File: `src/routes/chat.js` (Node / Express router)
import express from 'express';
import { askQuestion, getStudentInsights } from '../chatbot.js';

const router = express.Router();

/**
 * POST /api/chat/ask
 * Client expects this exact path, so router paths here are appended to the mount path.
 * If this router is mounted with app.use('/api/chat', router) then the full path is /api/chat/ask
 */
router.post('/ask', async (req, res) => {
  try {
    const { question, studentUserId, courseId } = req.body;

    if (!question) {
      return res.status(400).json({ error: 'Question is required' });
    }

    if (!studentUserId) {
      return res.status(400).json({ error: 'studentUserId is required' });
    }

    const result = await askQuestion(question, studentUserId, courseId);
    res.json(result);
  } catch (error) {
    console.error('Error in /ask endpoint:', error);
    res.status(500).json({
      error: 'Failed to process question',
      message: error?.message || 'Internal server error',
    });
  }
});

/**
 * GET /api/chat/insights/:studentUserId
 */
router.get('/insights/:studentUserId', async (req, res) => {
  try {
    const { studentUserId } = req.params;
    const { courseId } = req.query;

    const insights = await getStudentInsights(
      parseInt(studentUserId),
      courseId ? parseInt(courseId) : null
    );

    res.json(insights);
  } catch (error) {
    console.error('Error in /insights endpoint:', error);
    res.status(500).json({
      error: 'Failed to fetch insights',
      message: error?.message || 'Internal server error',
    });
  }
});

/**
 * POST /api/chat/stream
 */
router.post('/stream', async (req, res) => {
  try {
    const { question, studentUserId, courseId } = req.body;

    if (!question || !studentUserId) {
      return res.status(400).json({
        error: 'Question and studentUserId are required',
      });
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

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
    // Can't send JSON after streaming headers; if an error happens early, try JSON; otherwise log and end
    try {
      res.status(500).json({
        error: 'Failed to stream response',
        message: error?.message || 'Internal server error',
      });
    } catch (e) {
      res.end();
    }
  }
});

/**
 * GET /api/chat/average/:studentUserId
 */
router.get('/average/:studentUserId', async (req, res) => {
  try {
    const { studentUserId } = req.params;
    const { courseId } = req.query;

    console.log('[/average endpoint] Request for studentUserId:', studentUserId, 'courseId:', courseId);

    const { getStudentGradesSummary, calculateAverageGrade, calculateOverallPercentage } = await import('../supabaseClient.js');

    const grades = await getStudentGradesSummary(parseInt(studentUserId), courseId ? parseInt(courseId) : null);
    console.log('[/average endpoint] Retrieved', grades.length, 'grades from database');

    const averageGPA = calculateAverageGrade(grades);
    console.log('[/average endpoint] Calculated average GPA:', averageGPA);

    const overallPercentage = calculateOverallPercentage(grades);
    console.log('[/average endpoint] Calculated overall percentage:', overallPercentage);

    if (averageGPA === null) {
      return res.json({
        studentUserId: parseInt(studentUserId),
        averageGrade: null,
        overallPercentage: overallPercentage,
        message: 'No graded assignments found for this student'
      });
    }

    let letterGrade = 'F';
    const gpa = parseFloat(averageGPA);

    if (gpa >= 4.0) letterGrade = 'A+';
    else if (gpa >= 3.7) letterGrade = 'A-';
    else if (gpa >= 3.3) letterGrade = 'B+';
    else if (gpa >= 3.0) letterGrade = 'B';
    else if (gpa >= 2.7) letterGrade = 'B-';
    else if (gpa >= 2.3) letterGrade = 'C+';
    else if (gpa >= 2.0) letterGrade = 'C';
    else if (gpa >= 1.7) letterGrade = 'C-';
    else if (gpa >= 1.3) letterGrade = 'D+';
    else if (gpa >= 1.0) letterGrade = 'D';
    else if (gpa >= 0.7) letterGrade = 'D-';

    const gradedByGrade = grades.filter(g => g.grade && g.grade.trim() !== '').length;
    const gradedByScoreOnly = grades.filter(g => (!g.grade || g.grade.trim() === '') && g.score != null).length;

    res.json({
      studentUserId: parseInt(studentUserId),
      averageGrade: averageGPA,
      overallPercentage: overallPercentage,
      letterGrade,
      gradedAssignments: gradedByGrade + gradedByScoreOnly,
      gradedByGrade,
      gradedByScoreOnly,
      totalAssignments: grades.length,
      allGrades: grades,
      note: gradedByScoreOnly > 0 ? 'Some assignments use score fallback to estimate GPA; grade column is preferred.' : undefined
    });
  } catch (error) {
    console.error('Error in /average endpoint:', error);
    res.status(500).json({
      error: 'Failed to calculate average grade',
      message: error?.message || 'Internal server error',
    });
  }
});

export default router;