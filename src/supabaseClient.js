import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase credentials in environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Get student's current grades and submission summary
 */
export async function getStudentGradesSummary(studentUserId) {
  try {
    const { data, error } = await supabase
      .from('submissions')
      .select(`
        score,
        grade,
        excused,
        missing,
        late,
        submitted_at,
        graded_at,
        assignment_id,
        assignments(name, points_possible, due_at),
        student_user_id
      `)
      .eq('student_user_id', studentUserId);
    
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching student grades:', error);
    throw error;
  }
}

/**
 * Get missing assignments for a student
 */
export async function getMissingAssignments(studentUserId, courseId = null) {
  try {
    let query = supabase
      .from('submissions')
      .select(`
        submission_id,
        missing,
        late,
        excused,
        submitted_at,
        assignment_id,
        assignments(name, due_at, points_possible, courses(name)),
        student_user_id
      `)
      .eq('student_user_id', studentUserId)
      .eq('missing', true);
    
    if (courseId) {
      query = query.eq('assignments.course_id', courseId);
    }
    
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching missing assignments:', error);
    throw error;
  }
}

/**
 * Get student's course enrollments and grades
 */
export async function getStudentCourses(studentUserId) {
  try {
    const { data, error } = await supabase
      .from('enrollments')
      .select(`
        course_id,
        courses(course_code, name, account_id)
      `)
      .eq('user_id', studentUserId)
      .eq('role', 'student');
    
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching student courses:', error);
    throw error;
  }
}

/**
 * Get assignment group weights and details
 */
export async function getAssignmentGroupWeights(courseId) {
  try {
    const { data, error } = await supabase
      .from('assignment_groups')
      .select('*')
      .eq('course_id', courseId);
    
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching assignment groups:', error);
    throw error;
  }
}

/**
 * Get student information
 */
export async function getStudentInfo(studentUserId) {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('user_id', studentUserId)
      .single();
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error fetching student info:', error);
    throw error;
  }
}

/**
 * Get all submissions for a course
 */
export async function getCourseSubmissions(courseId) {
  try {
    const { data, error } = await supabase
      .from('submissions')
      .select(`
        score,
        grade,
        missing,
        late,
        excused,
        graded_at,
        assignment_id,
        student_user_id,
        assignments(name, due_at, assignment_group_id),
        users(full_name, email)
      `)
      .eq('assignments.course_id', courseId);
    
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching course submissions:', error);
    throw error;
  }
}

/**
 * Get grading periods for a course
 */
export async function getGradingPeriods(courseId) {
  try {
    const { data, error } = await supabase
      .from('grading_periods')
      .select('*')
      .eq('course_id', courseId)
      .order('start_date', { ascending: true });
    
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching grading periods:', error);
    throw error;
  }
}

/**
 * Get late submissions
 */
export async function getLateSubmissions(studentUserId) {
  try {
    const { data, error } = await supabase
      .from('submissions')
      .select(`
        submission_id,
        score,
        grade,
        late,
        submitted_at,
        assignment_id,
        assignments(name, due_at, points_possible),
        student_user_id
      `)
      .eq('student_user_id', studentUserId)
      .eq('late', true);
    
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching late submissions:', error);
    throw error;
  }
}

/**
 * Query relevant data for a question (intelligent search)
 */
export async function queryContextForQuestion(question, studentUserId, courseId = null) {
  try {
    const questionLower = question.toLowerCase();
    let context = {};

    // Help determine what data to fetch based on question keywords
    if (questionLower.includes('grade') || questionLower.includes('score')) {
      context.grades = await getStudentGradesSummary(studentUserId);
    }
    
    if (questionLower.includes('missing')) {
      context.missing = await getMissingAssignments(studentUserId, courseId);
    }
    
    if (questionLower.includes('late')) {
      context.late = await getLateSubmissions(studentUserId);
    }
    
    if (questionLower.includes('course') || questionLower.includes('class')) {
      context.courses = await getStudentCourses(studentUserId);
    }
    
    if (questionLower.includes('assignment') || questionLower.includes('group') || questionLower.includes('weight')) {
      if (courseId) {
        context.assignmentGroups = await getAssignmentGroupWeights(courseId);
      }
    }
    
    if (questionLower.includes('period')) {
      if (courseId) {
        context.gradingPeriods = await getGradingPeriods(courseId);
      }
    }

    // Always include student info
    context.studentInfo = await getStudentInfo(studentUserId);
    
    return context;
  } catch (error) {
    console.error('Error querying context:', error);
    throw error;
  }
}

/**
 * Format database context into a readable string for OpenAI
 */
export function formatContextForOpenAI(contextData) {
  let contextString = 'Student Database Context:\n\n';

  if (contextData.studentInfo) {
    contextString += `Student: ${contextData.studentInfo.full_name} (${contextData.studentInfo.email})\n`;
    contextString += `User Type: ${contextData.studentInfo.user_type}\n\n`;
  }

  if (contextData.courses && contextData.courses.length > 0) {
    contextString += 'Enrolled Courses:\n';
    contextData.courses.forEach(c => {
      if (c.courses) {
        contextString += `- ${c.courses.course_code || 'N/A'}: ${c.courses.name}\n`;
      }
    });
    contextString += '\n';
  }

  if (contextData.grades && contextData.grades.length > 0) {
    contextString += 'Grade Summary:\n';
    const scores = contextData.grades
      .filter(g => g.score !== null)
      .map(g => parseFloat(g.score));
    if (scores.length > 0) {
      const avg = (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2);
      const highest = Math.max(...scores).toFixed(2);
      const lowest = Math.min(...scores).toFixed(2);
      contextString += `- Average Score: ${avg}%\n`;
      contextString += `- Highest: ${highest}%\n`;
      contextString += `- Lowest: ${lowest}%\n`;
    }
    const excused = contextData.grades.filter(g => g.excused).length;
    if (excused > 0) {
      contextString += `- Excused Assignments: ${excused}\n`;
    }
    contextString += '\n';
  }

  if (contextData.missing && contextData.missing.length > 0) {
    contextString += `Missing Assignments (${contextData.missing.length}):\n`;
    contextData.missing.slice(0, 5).forEach(m => {
      if (m.assignments) {
        contextString += `- ${m.assignments.name} (due: ${m.assignments.due_at || 'N/A'})\n`;
      }
    });
    contextString += '\n';
  }

  if (contextData.late && contextData.late.length > 0) {
    contextString += `Late Submissions (${contextData.late.length}):\n`;
    contextData.late.slice(0, 5).forEach(l => {
      if (l.assignments) {
        contextString += `- ${l.assignments.name}: ${l.score || 0}/${l.assignments.points_possible}\n`;
      }
    });
    contextString += '\n';
  }

  if (contextData.assignmentGroups && contextData.assignmentGroups.length > 0) {
    contextString += 'Assignment Group Weights:\n';
    contextData.assignmentGroups.forEach(g => {
      contextString += `- ${g.name}: ${g.group_weight || 'N/A'}%\n`;
    });
    contextString += '\n';
  }

  if (contextData.gradingPeriods && contextData.gradingPeriods.length > 0) {
    contextString += 'Grading Periods:\n';
    contextData.gradingPeriods.forEach(p => {
      contextString += `- ${p.title}: ${p.start_date} to ${p.end_date}\n`;
    });
  }

  return contextString;
}

export default supabase;
