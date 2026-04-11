import { queryContextForQuestion, getStudentInfo, formatContextForOpenAI } from './supabaseClient.js';
import { generateResponse, generateResponseStream, classifyQuestionIntent } from './openaiClient.js';

function getCourseLabelFromGrade(grade) {
  const courseCode = grade?.assignments?.courses?.course_code;
  const courseName = grade?.assignments?.courses?.name;
  const fallbackCourseId = grade?.assignments?.course_id;

  if (courseCode && courseName) return `${courseCode} - ${courseName}`;
  if (courseName) return courseName;
  if (courseCode) return courseCode;
  if (fallbackCourseId != null) return `Course ${fallbackCourseId}`;
  return 'Unknown Course';
}

function toLetterGrade(averageGPA) {
  if (averageGPA === null) return null;

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

  return letterGrade;
}

async function buildCourseBreakdown(grades) {
  const { calculateAverageGrade, calculateOverallPercentage } = await import('./supabaseClient.js');

  const grouped = new Map();
  for (const grade of grades || []) {
    const key = getCourseLabelFromGrade(grade);
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(grade);
  }

  const rows = [];
  for (const [courseLabel, courseGrades] of grouped.entries()) {
    const averageGPA = calculateAverageGrade(courseGrades);
    const overallPercentage = calculateOverallPercentage(courseGrades);
    const gradedAssignments = courseGrades.filter(g => {
      const hasLetter = g.grade && g.grade.trim() !== '';
      const hasScore = g.score != null;
      return !(g.excused || g.missing) && (hasLetter || hasScore);
    }).length;

    rows.push({
      courseLabel,
      averageGrade: averageGPA,
      letterGrade: toLetterGrade(averageGPA),
      overallPercentage,
      gradedAssignments,
      totalAssignments: courseGrades.length
    });
  }

  rows.sort((a, b) => a.courseLabel.localeCompare(b.courseLabel));
  return rows;
}

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

    const letterGrade = toLetterGrade(averageGPA);

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
      const questionLower = userQuestion.toLowerCase();

      // Map user terms to math course synonyms, including algebra and mathematics
      const mathTermsRegex = /\b(math|mathematics|algebra)\b/i;
      const allCoursesRegex = /\b(all\s+(classes|courses)|every\s+(class|course)|across\s+all\s+(classes|courses)|each\s+(class|course)|by\s+(class|course)|broken\s+down\s+by\s+(class|course)|per\s+(class|course))\b/i;
      const asksAllCoursesBreakdown = allCoursesRegex.test(questionLower);

      if (asksAllCoursesBreakdown) {
        // User explicitly asked for cross-course output, so ignore any incoming course scope.
        effectiveCourseId = null;
      }

      if (!effectiveCourseId && !asksAllCoursesBreakdown && mathTermsRegex.test(questionLower)) {
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

      if (asksAllCoursesBreakdown) {
        const courseBreakdown = await buildCourseBreakdown(averageData.allGrades || []);

        if (courseBreakdown.length === 0) {
          return {
            question: userQuestion,
            response: 'I could not find graded assignments across your courses yet.',
            overallPercentage: averageData.overallPercentage,
            context: {
              ...averageData,
              courseBreakdown
            },
            allGrades: averageData.allGrades,
            dataUsed: ['grades'],
            apiCall: 'AVERAGE_GRADE'
          };
        }

        const courseLines = courseBreakdown
          .map(row => {
            const gpaPart = row.averageGrade !== null ? `GPA ${row.averageGrade} (${row.letterGrade})` : 'No GPA yet';
            const pctPart = row.overallPercentage !== null ? `${row.overallPercentage}%` : 'N/A%';
            return `- ${row.courseLabel}: ${gpaPart}, ${pctPart}, based on ${row.gradedAssignments}/${row.totalAssignments} assignments`;
          })
          .join('\n');

        return {
          question: userQuestion,
          response: `Here is your grade breakdown by course:\n${courseLines}\n\nOverall across all classes: GPA ${averageData.averageGrade} (${averageData.letterGrade}), ${averageData.overallPercentage}%, based on ${averageData.gradedAssignments}/${averageData.totalAssignments} assignments.`,
          overallPercentage: averageData.overallPercentage,
          context: {
            ...averageData,
            courseBreakdown
          },
          allGrades: averageData.allGrades,
          dataUsed: ['grades'],
          apiCall: 'AVERAGE_GRADE'
        };
      }

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
