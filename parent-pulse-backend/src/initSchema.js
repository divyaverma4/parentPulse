import { supabase } from "./supabaseClient.js";

async function canUseExecSql() {
  if (!supabase || typeof supabase.rpc !== "function") {
    return false;
  }

  try {
    const { error } = await supabase.rpc("exec_sql", { sql: "SELECT 1" });
    if (error) {
      const msg = (error.message || "").toLowerCase();
      if (msg.includes("exec_sql") || msg.includes("function") || msg.includes("schema cache")) {
        return false;
      }
    }
    return true;
  } catch (err) {
    return false;
  }
}

async function runSQL(sql) {
  if (!supabase || typeof supabase.rpc !== "function") {
    console.warn("⚠ Supabase client is not configured; skipping SQL setup.");
    return false;
  }

  const { error } = await supabase.rpc("exec_sql", { sql });
  if (error) {
    console.warn("⚠ SQL setup not available in this Supabase project; skipping schema creation.");
    return false;
  }

  return true;
}

export async function initSchema() {
  console.log("🔧 Ensuring tables exist...");

  if (!supabase) {
    console.warn("⚠ Supabase is not configured. Skipping schema initialization.");
    return false;
  }

  const sqlAllowed = await canUseExecSql();
  if (!sqlAllowed) {
    console.warn("⚠ exec_sql RPC is unavailable in this project. Skipping automatic schema creation.");
    return false;
  }

  await runSQL(`
    CREATE TABLE IF NOT EXISTS accounts (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      name text
    );
  `);

  await runSQL(`
    CREATE TABLE IF NOT EXISTS users (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      account_id uuid REFERENCES accounts(id),
      full_name text,
      email text,
      user_type text
    );
  `);

  await runSQL(`
    CREATE TABLE IF NOT EXISTS courses (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      account_id uuid REFERENCES accounts(id),
      course_code text,
      name text
    );
  `);

  await runSQL(`
    CREATE TABLE IF NOT EXISTS enrollments (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid REFERENCES users(id),
      course_id uuid REFERENCES courses(id),
      role text
    );
  `);

  await runSQL(`
    CREATE TABLE IF NOT EXISTS grading_periods (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      course_id uuid REFERENCES courses(id),
      title text,
      start_date date,
      end_date date
    );
  `);

  await runSQL(`
    CREATE TABLE IF NOT EXISTS assignment_groups (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      course_id uuid REFERENCES courses(id),
      name text
    );
  `);

  await runSQL(`
    CREATE TABLE IF NOT EXISTS assignments (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      course_id uuid REFERENCES courses(id),
      assignment_group_id uuid REFERENCES assignment_groups(id),
      name text,
      points_possible numeric,
      due_at timestamptz
    );
  `);

  await runSQL(`
    CREATE TABLE IF NOT EXISTS submissions (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      assignment_id uuid REFERENCES assignments(id),
      student_user_id uuid REFERENCES users(id),
      score numeric,
      grade text,
      excused boolean,
      missing boolean,
      late boolean
    );
  `);

  // Daily entry (one per date)
  await runSQL(`
    CREATE TABLE IF NOT EXISTS daily_entries (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      date date,
      day text
    );
  `);

  // Subjects inside each daily entry
  await runSQL(`
    CREATE TABLE IF NOT EXISTS subjects (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      entry_id uuid REFERENCES daily_entries(id),
      subject_name text
    );
  `);

  // Teachers inside each subject
  await runSQL(`
    CREATE TABLE IF NOT EXISTS subject_teachers (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      subject_id uuid REFERENCES subjects(id),
      teacher_name text,
      today text,
      homework text,
      upcoming text,
      other text
    );
  `);

  // Upcoming dates list
  await runSQL(`
    CREATE TABLE IF NOT EXISTS upcoming_dates (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      entry_id uuid REFERENCES daily_entries(id),
      description text
    );
  `);

  // Exam schedule
  await runSQL(`
    CREATE TABLE IF NOT EXISTS exam_schedule (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      entry_id uuid REFERENCES daily_entries(id),
      exam_date date,
      subject text
    );
  `);

  await runSQL(`
    TRUNCATE TABLE
      submissions,
      enrollments,
      grading_periods,
      assignments,
      assignment_groups,
      courses,
      subject_teachers,
      subjects,
      upcoming_dates,
      exam_schedule,
      daily_entries,
      users,
      accounts
    RESTART IDENTITY CASCADE;
  `);

  console.log("✅ Schema ready");
}
