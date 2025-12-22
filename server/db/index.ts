import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = path.join(__dirname, 'success-rates.db');
const SCHEMA_PATH = path.join(__dirname, 'schema.sql');

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    
    // Initialize schema
    const schema = fs.readFileSync(SCHEMA_PATH, 'utf-8');
    db.exec(schema);
    
    console.log('📦 Database initialized at', DB_PATH);
  }
  return db;
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}

// Helper functions for common operations
export function upsertFaculty(id: number, name: string): void {
  const db = getDb();
  db.prepare(`
    INSERT INTO faculties (id, name) VALUES (?, ?)
    ON CONFLICT(id) DO UPDATE SET name = excluded.name
  `).run(id, name);
}

export function upsertSemester(id: number, facultyId: number, name: string, year: number): void {
  const db = getDb();
  db.prepare(`
    INSERT INTO semesters (id, faculty_id, name, year) VALUES (?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET name = excluded.name, year = excluded.year
  `).run(id, facultyId, name, year);
}

export function upsertCourse(code: string, name: string, predmetId: string): number {
  const db = getDb();
  db.prepare(`
    INSERT INTO courses (code, name, predmet_id) VALUES (?, ?, ?)
    ON CONFLICT(code) DO UPDATE SET name = excluded.name, predmet_id = excluded.predmet_id
  `).run(code, name, predmetId);
  
  const row = db.prepare('SELECT id FROM courses WHERE code = ?').get(code) as { id: number };
  return row.id;
}

export function insertSuccessRate(
  courseId: number,
  semesterId: number,
  termName: string,
  grades: { A: number; B: number; C: number; D: number; E: number; F: number; FN: number }
): void {
  const db = getDb();
  
  // Delete existing entry for this course-semester-term to avoid duplicates
  db.prepare(`
    DELETE FROM success_rates 
    WHERE course_id = ? AND semester_id = ? AND term_name = ?
  `).run(courseId, semesterId, termName);
  
  db.prepare(`
    INSERT INTO success_rates (course_id, semester_id, term_name, grade_a, grade_b, grade_c, grade_d, grade_e, grade_f, grade_fn)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(courseId, semesterId, termName, grades.A, grades.B, grades.C, grades.D, grades.E, grades.F, grades.FN);
}

export function markCourseScraped(code: string): void {
  const db = getDb();
  db.prepare(`UPDATE courses SET last_scraped = datetime('now') WHERE code = ?`).run(code);
}

export function markSemesterScraped(id: number): void {
  const db = getDb();
  db.prepare(`UPDATE semesters SET last_scraped = datetime('now') WHERE id = ?`).run(id);
}

export function getUnscrapedCourses(semesterId: number): Array<{ id: number; code: string; predmetId: string }> {
  const db = getDb();
  return db.prepare(`
    SELECT c.id, c.code, c.predmet_id as predmetId
    FROM courses c
    WHERE c.last_scraped IS NULL
    OR c.id NOT IN (SELECT DISTINCT course_id FROM success_rates WHERE semester_id = ?)
  `).all(semesterId) as Array<{ id: number; code: string; predmetId: string }>;
}

export function getSuccessRatesByCourse(courseCode: string): any {
  const db = getDb();
  
  const rates = db.prepare(`
    SELECT 
      sr.term_name,
      sr.grade_a, sr.grade_b, sr.grade_c, sr.grade_d, sr.grade_e, sr.grade_f, sr.grade_fn,
      s.name as semester_name, s.year,
      c.code as course_code
    FROM success_rates sr
    JOIN courses c ON sr.course_id = c.id
    JOIN semesters s ON sr.semester_id = s.id
    WHERE c.code = ?
    ORDER BY s.year DESC, sr.term_name
  `).all(courseCode);
  
  if (rates.length === 0) return null;
  
  // Group by semester
  const grouped: Record<string, any> = {};
  for (const r of rates as any[]) {
    const key = r.semester_name;
    if (!grouped[key]) {
      grouped[key] = {
        semesterName: r.semester_name,
        year: r.year,
        totalPass: 0,
        totalFail: 0,
        terms: []
      };
    }
    const pass = r.grade_a + r.grade_b + r.grade_c + r.grade_d + r.grade_e;
    const fail = r.grade_f + r.grade_fn;
    grouped[key].totalPass += pass;
    grouped[key].totalFail += fail;
    grouped[key].terms.push({
      term: r.term_name,
      grades: { A: r.grade_a, B: r.grade_b, C: r.grade_c, D: r.grade_d, E: r.grade_e, F: r.grade_f, FN: r.grade_fn },
      pass,
      fail
    });
  }
  
  return {
    courseCode,
    stats: Object.values(grouped),
    lastUpdated: new Date().toISOString()
  };
}
