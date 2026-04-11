import dotenv from 'dotenv';
const result = dotenv.config({ path: 'local.env' });
console.log('dotenv loaded:', !result.error);
console.log('SUPABASE_URL exists:', !!process.env.SUPABASE_URL);
console.log('SUPABASE_ANON_KEY exists:', !!process.env.SUPABASE_ANON_KEY);
console.log('OPENAI_API_KEY exists:', !!process.env.OPENAI_API_KEY);
