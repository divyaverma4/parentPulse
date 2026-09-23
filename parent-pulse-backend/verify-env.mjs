import dotenv from 'dotenv';
const result = dotenv.config();
console.log('dotenv loaded:', !result.error);
console.log('SUPABASE_URL exists:', !!process.env.SUPABASE_URL);
console.log('SUPABASE_PUBLISHABLE_KEY exists:', !!process.env.SUPABASE_PUBLISHABLE_KEY);
console.log('SUPABASE_SECRET_KEY exists:', !!process.env.SUPABASE_SECRET_KEY);
console.log('OPENAI_API_KEY exists:', !!process.env.OPENAI_API_KEY);
