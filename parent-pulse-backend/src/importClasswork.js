import fs from "fs";
import path from "path";
import { supabase } from "./supabaseClient.js";
import { initSchema } from "./initSchema.js";

const JSON_DIR = "./jsonData";
const DRY_RUN = false;

function fakeId(prefix) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function fakeRowFor(table) {
  const idFieldMap = {
    daily_entries: "id",
    subjects: "id",
    subject_teachers: "id",
    upcoming_dates: "id",
    exam_schedule: "id"
  };

  const row = { id: fakeId(table) };
  const key = idFieldMap[table] || "id";
  row[key] = fakeId(key);
  return row;
}

function normalizeExamDate(dateStr, year) {
  const [month, day] = dateStr.split("/");
  const normalizedYear = year || new Date().getFullYear();
  return `${normalizedYear}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
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
    throw new Error(`Insert returned no data for table "${table}"`);
  }

  return data[0];
}

export async function importDailyLog(fileName) {
  console.log("⏳ Waiting for schema to be ready...");
  const schemaReady = await initSchema();
  if (schemaReady) {
    console.log("✅ Schema check complete. Starting daily log import...\n");
  } else {
    console.log("ℹ Automatic schema setup unavailable; using the existing database schema.\n");
  }

  const filePath = path.join(JSON_DIR, fileName);
  if (!fs.existsSync(filePath)) {
    console.error(`❌ File not found: ${filePath}`);
    return;
  }

  const raw = JSON.parse(fs.readFileSync(filePath, "utf8"));

  if (!raw.entries || !Array.isArray(raw.entries)) {
    console.error("❌ JSON missing 'entries' array");
    return;
  }

  let skippedEntries = 0;
  let insertedEntries = 0;

  for (const entry of raw.entries) {
    console.log(`\n📄 Importing daily entry for ${entry.date}`);

    // 1. DAILY ENTRY
    const entryRow = await insertRow("daily_entries", {
      date: entry.date,
      day: entry.day
    });
    const entryId = entryRow?.entry_id ?? entryRow?.id ?? null;

    if (!entryRow) {
      console.error("⚠ Skipping entire entry due to failed daily_entries insert");
      skippedEntries += 1;
      continue;
    }

    insertedEntries += 1;

    // 2. SUBJECTS + TEACHERS
    for (const [subjectName, subjectData] of Object.entries(entry.subjects || {})) {
      const subjectRow = await insertRow("subjects", {
        entry_id: entryId,
        subject_name: subjectName
      });
      const subjectId = subjectRow?.subject_id ?? subjectRow?.id ?? null;

      if (!subjectRow) {
        console.error(`⚠ Skipping subject "${subjectName}"`);
        continue;
      }

      const isTeacherMap =
        typeof subjectData === "object" &&
        Object.values(subjectData).every(v => typeof v === "object");

      if (isTeacherMap) {
        for (const [teacherName, teacherInfo] of Object.entries(subjectData)) {
          await insertRow("subject_teachers", {
            subject_id: subjectId,
            teacher_name: teacherName,
            today: teacherInfo.today || null,
            homework: teacherInfo.homework || null,
            upcoming: teacherInfo.upcoming || null,
            other: teacherInfo.other || null
          });
        }
      } else {
        await insertRow("subject_teachers", {
          subject_id: subjectId,
          teacher_name: null,
          today: subjectData.today || null,
          homework: subjectData.homework || null,
          upcoming: subjectData.upcoming || null,
          other: subjectData.other || null
        });
      }
    }

    // 3. UPCOMING DATES
    for (const item of entry.upcoming_dates || []) {
      await insertRow("upcoming_dates", {
        entry_id: entryId,
        description: item
      });
    }

    // 4. EXAM SCHEDULE
    for (const [examDate, subject] of Object.entries(entry.exam_schedule || {})) {
      const entryYear = Number(String(entry.date || '').slice(0, 4));
      const normalized = normalizeExamDate(examDate, Number.isFinite(entryYear) ? entryYear : undefined);

      await insertRow("exam_schedule", {
        entry_id: entryId,
        exam_date: normalized,
        subject
      });
    }
  }

  if (skippedEntries > 0) {
    throw new Error(
      `Classwork import incomplete: inserted ${insertedEntries} of ${raw.entries.length} entries. ` +
      "Run supabase-setup.sql in the Supabase SQL Editor, then retry."
    );
  }

  console.log(`\n🎉 Daily log import complete: ${insertedEntries} entries imported`);
}

// Run directly if called from CLI
if (process.argv[1].includes("importClasswork.js")) {
  const fileArg = process.argv[2];
  if (!fileArg) {
    console.error("❌ Please provide a JSON filename. Example:");
    console.error("   node importClasswork.js sampleReport.json");
    process.exit(1);
  }

  importDailyLog(fileArg).catch(err => {
    console.error("❌ Import failed:", err);
    process.exitCode = 1;
  });
}
