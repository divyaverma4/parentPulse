/**
 * Example client usage of the Chatbot API
 * This demonstrates how to interact with the chatbot endpoints using live database data
 */

// ============================================
// Example 1: Ask a Question (with live data)
// ============================================
async function askQuestion() {
  try {
    const studentUserId = 1; // Example student ID (Alice)
    const courseId = 1; // Example course ID
    
    const response = await fetch('http://localhost:3000/api/chat/ask', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        question: 'What is my overall grade and what assignments am I missing?',
        studentUserId: studentUserId,
        courseId: courseId,
      }),
    });

    const data = await response.json();
    console.log('Question:', data.question);
    console.log('AI Response:', data.response);
    console.log('Data Used:', data.dataUsed);
  } catch (error) {
    console.error('Error:', error);
  }
}

// ============================================
// Example 2: Get Student Insights
// ============================================
async function getStudentInsights() {
  try {
    const studentUserId = 1; // Example student ID
    
    const response = await fetch(`http://localhost:3000/api/chat/insights/${studentUserId}`);
    const data = await response.json();

    console.log('Student Insights:');
    console.log('  Name:', data.studentName);
    console.log('  Average Grade:', data.averageGrade);
    console.log('  Enrolled Courses:', data.enrolledCourses);
    console.log('  Missing Assignments:', data.missingCount);
    console.log('  Late Submissions:', data.lateCount);
  } catch (error) {
    console.error('Error:', error);
  }
}

// ============================================
// Example 3: Stream Response (Real-time data)
// ============================================
async function streamResponse() {
  try {
    const studentUserId = 1; // Example student ID
    
    const response = await fetch('http://localhost:3000/api/chat/stream', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        question: 'How can I improve my grades? What should I focus on?',
        studentUserId: studentUserId,
      }),
    });

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    console.log('Streaming Response:');
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const text = decoder.decode(value);
      const lines = text.split('\n');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data && data !== '[DONE]') {
            const parsed = JSON.parse(data);
            process.stdout.write(parsed.content || '');
          }
        }
      }
    }
    console.log('\n--- Streaming Complete ---');
  } catch (error) {
    console.error('Error:', error);
  }
}

// ============================================
// Example 4: Health Check
// ============================================
async function checkHealth() {
  try {
    const response = await fetch('http://localhost:3000/api/health');
    const data = await response.json();
    console.log('Server Status:', data.status);
  } catch (error) {
    console.error('Error:', error);
  }
}

// ============================================
// Run Examples
// ============================================
async function runExamples() {
  console.log('🚀 Starting Chatbot API Examples\n');

  console.log('1️⃣ Health Check:');
  await checkHealth();

  console.log('\n2️⃣ Ask Question (with live data):');
  await askQuestion();

  console.log('\n3️⃣ Student Insights:');
  await getStudentInsights();

  console.log('\n4️⃣ Stream Response:');
  await streamResponse();
}

// Uncomment to run examples
//runExamples().catch(console.error);

export { askQuestion, getStudentInsights, streamResponse, checkHealth };
