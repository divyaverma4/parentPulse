import dotenv from 'dotenv';
dotenv.config({ path: 'local.env' });

const { supabase } = await import('./src/supabaseClient.js');
const { askQuestion } = await import('./src/chatbot.js');

const { data: enrollments, error: enrollErr } = await supabase
  .from('enrollments')
  .select('user_id, role')
  .eq('role', 'student');

if (enrollErr) {
  console.error('Enrollments error:', enrollErr.message);
  process.exit(1);
}

const counts = new Map();
for (const r of (enrollments || [])) {
  counts.set(r.user_id, (counts.get(r.user_id) || 0) + 1);
}

const candidate = [...counts.entries()]
  .filter(([, c]) => c > 1)
  .sort((a, b) => b[1] - a[1])[0];

if (!candidate) {
  console.error('No multi-course student found');
  process.exit(1);
}

const studentUserId = candidate[0];
console.log('Using studentUserId:', studentUserId, 'enrollments:', candidate[1]);

const result = await askQuestion('overall grade of all classes broken down by course', studentUserId, null);

console.log('--- RESPONSE START ---');
console.log(result.response);
console.log('--- RESPONSE END ---');
console.log('Has breakdown object:', Boolean(result.context?.courseBreakdown));
console.log('Course rows:', result.context?.courseBreakdown?.length || 0);
