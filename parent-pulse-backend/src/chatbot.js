import { queryContextForQuestion, getStudentInfo, formatContextForOpenAI } from './supabaseClient.js';
import { generateResponse, generateResponseStream, classifyQuestionIntent } from './openaiClient.js';

/**
 * Get average grade data for a student
 */
export async function getAverageGrade(studentUserId, courseId = null) {
  try {
    // Import the required functions
    const { getStudentGradesSummary, calculateAverageGrade, calculateOverallPercentage } = await import('./supabaseClient.js');

    // Get all grades for the student (optionally filtered by course)
    const grades = await getStudentGradesSummary(studentUserId, courseId);

    // Calculate average GPA
    const averageGPA = calculateAverageGrade(grades);
    
    // Calculate overall percentage
    const overallPercentage = calculateOverallPercentage(grades);

    if (averageGPA === null) {
      return {
        studentUserId,
        averageGrade: null,
        overallPercentage: overallPercentage,
        letterGrade: null,
        gradedAssignments: 0,
        totalAssignments: grades.length,
        message: 'No graded assignments found for this student'
      };
    }

    // Get letter grade equivalent
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

    return {
      studentUserId,
      averageGrade: averageGPA,
      overallPercentage: overallPercentage,
      letterGrade,
      gradedAssignments: gradedByGrade + gradedByScoreOnly,
      gradedByGrade,
      gradedByScoreOnly,
      totalAssignments: grades.length,
      allGrades: grades
    };
  } catch (error) {
    console.error('Error getting average grade:', error);
    throw error;
  }
}

/**
 * Ask a question and get AI response based on live database data
 */
export async function askQuestion(userQuestion, studentUserId, courseId = null) {
  try {
    // Use OpenAI to classify if this is a grade-related query
    const isGradeQuery = await classifyQuestionIntent(userQuestion);

    if (isGradeQuery) {
      let effectiveCourseId = courseId;

      // Map user terms to math course synonyms, including algebra and mathematics
      const mathTermsRegex = /\b(math|mathematics|algebra)\b/i;
      const questionLower = userQuestion.toLowerCase();

      if (!effectiveCourseId && mathTermsRegex.test(questionLower)) {
        const { getStudentCourses } = await import('./supabaseClient.js');
        const courses = await getStudentCourses(studentUserId);

        const mathCourse = courses.find(c => {
          if (!c || !c.courses) return false;
          const candidate = `${c.courses.course_code || ''} ${c.courses.name || ''}`;
          return mathTermsRegex.test(candidate);
        });

        if (mathCourse && mathCourse.course_id) {
          effectiveCourseId = mathCourse.course_id;
        }
      }

      const averageData = await getAverageGrade(studentUserId, effectiveCourseId);
      return {
        question: userQuestion,
        response: `Your average grade (GPA) is ${averageData.averageGrade}, which corresponds to a letter grade of ${averageData.letterGrade}. Your overall percentage grade is ${averageData.overallPercentage}%. This is based on ${averageData.gradedAssignments} graded assignments out of ${averageData.totalAssignments} total assignments.`,
        overallPercentage: averageData.overallPercentage,
        context: averageData,
        allGrades: averageData.allGrades,
        dataUsed: ['grades'],
        apiCall: 'AVERAGE_GRADE'
      };
    }

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
    const aiResponse = await generateResponse(userQuestion, contextString);

    // Check if OpenAI indicated this should be an API call
    if (aiResponse.includes('[API_CALL:AVERAGE_GRADE]')) {
      // Extract the response part and call the average grade endpoint
      const responseText = aiResponse.replace('[API_CALL:AVERAGE_GRADE]', '').trim();
      const averageData = await getAverageGrade(studentUserId, courseId);
      return {
        question: userQuestion,
        response: responseText,
        context: averageData,
        dataUsed: ['grades'],
        apiCall: 'AVERAGE_GRADE'
      };
    }

    return {
      question: userQuestion,
      response: aiResponse,
      context: contextData, // Return actual data for reference
      allGrades: contextData.grades || [],
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
      // Import the calculateAverageGrade function
      const { calculateAverageGrade } = await import('./supabaseClient.js');
      insights.averageGrade = calculateAverageGrade(contextData.grades);
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
