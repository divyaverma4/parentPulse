import { queryContextForQuestion, getStudentInfo, formatContextForOpenAI } from './supabaseClient.js';
import { generateResponse, generateResponseStream } from './openaiClient.js';

/**
 * Ask a question and get AI response based on live database data
 */
export async function askQuestion(userQuestion, studentUserId, courseId = null) {
  try {
    // Fetch relevant data from database based on the question
    const contextData = await queryContextForQuestion(userQuestion, studentUserId, courseId);
    
    if (!contextData || Object.keys(contextData).length === 0) {
      return {
        question: userQuestion,
        response: 'Unable to retrieve relevant data from the database.',
        context: {},
      };
    }

    // Build context string from actual database data
    const contextString = formatContextForOpenAI(contextData);

    // Generate response using OpenAI with real data context
    const response = await generateResponse(userQuestion, contextString);

    return {
      question: userQuestion,
      response: response,
      context: contextData, // Return actual data for reference
      dataUsed: Object.keys(contextData).filter(k => contextData[k] && contextData[k].length > 0),
    };
  } catch (error) {
    console.error('Error in askQuestion:', error);
    throw error;
  }
}

/**
 * Get insights about a student's performance
 */
export async function getStudentInsights(studentUserId, courseId = null) {
  try {
    const contextData = await queryContextForQuestion('overall performance', studentUserId, courseId);
    
    const insights = {
      studentName: contextData.studentInfo?.full_name,
      enrolledCourses: contextData.courses?.length || 0,
      averageGrade: null,
      missingCount: contextData.missing?.length || 0,
      lateCount: contextData.late?.length || 0,
      excusedCount: 0,
    };

    if (contextData.grades && contextData.grades.length > 0) {
      const scores = contextData.grades
        .filter(g => g.score !== null)
        .map(g => parseFloat(g.score));
      if (scores.length > 0) {
        insights.averageGrade = (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2);
      }
      insights.excusedCount = contextData.grades.filter(g => g.excused).length;
    }

    return insights;
  } catch (error) {
    console.error('Error getting student insights:', error);
    throw error;
  }
}

/**
 * Interactive chat session
 */
export async function startChatSession(studentUserId, courseId = null) {
  return {
    sendMessage: async function(message) {
      try {
        const response = await askQuestion(message, studentUserId, courseId);
        return {
          userMessage: message,
          botResponse: response.response,
          context: response.context,
          timestamp: new Date().toISOString(),
        };
      } catch (error) {
        console.error('Error in chat session:', error);
        throw error;
      }
    },
  };
}

export default {
  askQuestion,
  getStudentInsights,
  startChatSession,
};
