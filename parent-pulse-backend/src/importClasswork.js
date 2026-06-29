import fs from "fs";
import path from "path";
import { supabase } from "./supabaseClient.js";
import { initSchema } from "./initSchema.js";

const JSON_DIR = "./jsonData";
const DRY_RUN = false;

function fakeId(prefix) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeExamDate(dateStr, year = 2026) {
  const [month, day] = dateStr.split("/");
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

/* -------------------------------------------------------
   SAFE insertRow — logs errors but DOES NOT throw
   (prevents importer from dying early)
--------------------------------------------------------*/
async function insertRow(table, payload) {
  if (DRY_RUN) {
    const fake = { id: fakeId(table) };
    console.log(`[DRY RUN] → ${table}`, payload, "→", fake.id);
    return fake;
  }

  const { data, error } = await supabase.from(table).insert(payload).select();

  if (error) {
    console.error(`⚠ Insert failed for table "${table}" — skipping row`, error);
    return null; // <-- DO NOT THROW
  }

  if (!data || data.length === 0) {
    console.error(`⚠ Insert returned no data for table "${table}" — skipping row`);
    return null;
  }

  return data[0];
}

export async function importDailyLog(fileName) {
  console.log("⏳ Waiting for schema to be ready...");
  await initSchema();
  console.log("✅ Schema ready. Starting daily log import...\n");

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

  for (const entry of raw.entries) {
    console.log(`\n📄 Importing daily entry for ${entry.date}`);

    // 1. DAILY ENTRY
    const entryRow = await insertRow("daily_entries", {
      date: entry.date,
      day: entry.day
    });

    if (!entryRow) {
      console.error("⚠ Skipping entire entry due to failed daily_entries insert");
      continue;
    }

    // 2. SUBJECTS + TEACHERS
    for (const [subjectName, subjectData] of Object.entries(entry.subjects || {})) {
      const subjectRow = await insertRow("subjects", {
        entry_id: entryRow.id,
        subject_name: subjectName
      });

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
            subject_id: subjectRow.id,
            teacher_name: teacherName,
            today: teacherInfo.today || null,
            homework: teacherInfo.homework || null,
            upcoming: teacherInfo.upcoming || null,
            other: teacherInfo.other || null
          });
        }
      } else {
        await insertRow("subject_teachers", {
          subject_id: subjectRow.id,
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
        entry_id: entryRow.id,
        description: item
      });
    }

    // 4. EXAM SCHEDULE
    for (const [examDate, subject] of Object.entries(entry.exam_schedule || {})) {
      const normalized = normalizeExamDate(examDate);

      await insertRow("exam_schedule", {
        entry_id: entryRow.id,
        exam_date: normalized,
        subject
      });
    }
  }

  console.log("\n🎉 Daily log import complete");
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
  });
}
