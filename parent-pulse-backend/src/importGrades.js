import fs from "fs";
import path from "path";
import { supabase } from "./supabaseClient.js";
import { initSchema } from "./initSchema.js";   // <-- must export this
                                                 //     from initSchema.js

const JSON_DIR = "./jsonData";
const DRY_RUN = false; // Set to true to skip actual DB writes and just log actions

function fakeId(prefix) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function fakeRowFor(table) {
  const idFieldMap = {
    accounts: "account_id",
    users: "user_id",
    courses: "course_id",
    enrollments: "enrollment_id",
    grading_periods: "grading_period_id",
    assignment_groups: "assignment_group_id",
    assignments: "assignment_id",
    submissions: "submission_id"
  };

  const row = { id: fakeId(table) };
  const key = idFieldMap[table] || "id";
  row[key] = fakeId(key);
  return row;
}

function isGradeExport(raw) {
  return !!(
    raw &&
    typeof raw === "object" &&
    typeof raw.student === "string" &&
    raw.student.trim() &&
    raw.classes &&
    typeof raw.classes === "object"
  );
}

async function insertRow(table, payload) {
  if (!supabase) {
    const fake = fakeRowFor(table);
    console.warn(`⚠ Supabase is not configured; skipping insert for ${table}.`);
    return fake;
  }

  if (DRY_RUN) {
    const fake = fakeRowFor(table);
    console.log(`[DRY RUN] → ${table}`, payload, "→", fake.id);
    return fake;
  }

  const { data, error } = await supabase.from(table).insert(payload).select();

  if (error) {
    console.error(`❌ Insert failed for table "${table}"`, error);
    throw error;
  }

  if (!data || data.length === 0) {
    throw new Error(`❌ Insert returned no data for table "${table}". Table may not exist.`);
  }

  return data[0];
}

function mapStatus(status) {
  return {
    excused: status === "Excuse",
    missing: status === "Missing",
    late: status === "Late"
  };
}

function pickId(row, keys) {
  for (const key of keys) {
    if (row && row[key] != null && row[key] !== "") return row[key];
  }
  return row?.id ?? null;
}

async function importGrades() {
  console.log("⏳ Waiting for schema to be ready...");
  await initSchema();   // <-- ensures tables exist BEFORE inserts
  console.log("✅ Schema ready. Starting import...\n");

  const files = fs.readdirSync(JSON_DIR).filter(f => f.endsWith(".json"));
  console.log(`Found ${files.length} JSON files`);

  for (const file of files) {
    console.log(`\n📄 Importing ${file}`);

    const raw = JSON.parse(fs.readFileSync(path.join(JSON_DIR, file), "utf8"));
    if (!isGradeExport(raw)) {
      console.warn(`⚠ Skipping ${file}: not a grade export JSON file.`);
      continue;
    }

    const studentName = raw.student.trim();

    // 1. ACCOUNT
    const accountRow = await insertRow("accounts", {
      name: `${studentName}-account`
    });
    const accountId = pickId(accountRow, ["account_id", "id"]);

    // 2. USER
    const userRow = await insertRow("users", {
      account_id: accountId,
      full_name: studentName,
      email: `${studentName.toLowerCase()}@school.edu`,
      user_type: "student"
    });
    const userId = pickId(userRow, ["user_id", "id"]);

    // 3. CLASSES → COURSES
    for (const [className, classData] of Object.entries(raw.classes)) {
      const courseRow = await insertRow("courses", {
        account_id: accountId,
        course_code: className,
        name: className
      });
      const courseId = pickId(courseRow, ["course_id", "id"]);

      // 4. ENROLLMENT
      await insertRow("enrollments", {
        user_id: userId,
        course_id: courseId,
        role: "student"
      });

      // 5. TERMS → GRADING PERIODS
      for (const [termLabel, termData] of Object.entries(classData.terms)) {
        const gradingPeriodRow = await insertRow("grading_periods", {
          course_id: courseId,
          title: termLabel,
          start_date: "2024-01-01",
          end_date: "2024-12-31",
          term_grade: termData.termGrade ?? null,
          letter_grade: termData.letterGrade ?? null
        });
        const gradingPeriodId = pickId(gradingPeriodRow, ["grading_period_id", "id"]);

        // 6. ASSIGNMENTS
        for (const a of termData.assignments) {
          // CATEGORY → assignment_groups
          let groupId = null;
          if (a.category) {
            const groupRow = await insertRow("assignment_groups", {
              course_id: courseId,
              name: a.category
            });
            groupId = pickId(groupRow, ["assignment_group_id", "id"]);
          }

          const assignmentRow = await insertRow("assignments", {
            course_id: courseId,
            assignment_group_id: groupId,
            name: a.name,
            points_possible: a.max,
            due_at: a.due ? new Date(a.due) : null
          });
          const assignmentId = pickId(assignmentRow, ["assignment_id", "id"]);

          const flags = mapStatus(a.status);

          // 7. SUBMISSIONS
          await insertRow("submissions", {
            assignment_id: assignmentId,
            student_user_id: userId,
            score: a.pts,
            grade:
              a.pts != null && a.max != null
                ? ((a.pts / a.max) * 100).toFixed(2) + "%"
                : null,
            excused: flags.excused,
            missing: flags.missing,
            late: flags.late
          });
        }
      }
    }
  }

  console.log("\n🎉 Import complete");
}

// Run importer
importGrades().catch(err => {
  console.error("\n❌ Import failed:", err.message ?? err);
  process.exit(1);
});
