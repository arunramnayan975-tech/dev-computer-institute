const Database = require("better-sqlite3");
const bcrypt = require("bcryptjs");
const path = require("path");
const fs = require("fs");

const dataDir = path.join(__dirname, "..", "data");
fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(path.join(dataDir, "institute.db"));
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
CREATE TABLE IF NOT EXISTS admins (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'admin',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS courses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL DEFAULT '',
  duration TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS enquiries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  course TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS gallery (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  image_url TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS faculty (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  designation TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  photo_url TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS site_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_enquiries_status ON enquiries(status);
CREATE INDEX IF NOT EXISTS idx_enquiries_created_at ON enquiries(created_at);
CREATE INDEX IF NOT EXISTS idx_courses_status ON courses(status);
`);

const courses = [
  ["Basic / Data Entry", "basic-data-entry", "Build essential computer skills and develop practical knowledge for data entry and everyday computer work.", "4–6 months"],
  ["Diploma with DTP & Tally", "diploma-dtp-tally", "A comprehensive diploma program combining desktop publishing and accounting-related computer skills.", "12 months"],
  ["Diploma with DTP & Web Designing", "diploma-dtp-web", "A diploma program covering desktop publishing and web designing fundamentals.", "12 months"],
  ["Tally", "tally", "Develop practical knowledge of Tally and computer-based accounting workflows.", "3–4 months"],
  ["Web Designing", "web-designing", "Learn the fundamentals of designing and creating websites through practical computer-based training.", "4 months"],
  ["Basic & Tally", "basic-tally", "Combine essential computer skills with practical Tally training in a structured course.", "7–8 months"],
  ["Advanced Excel", "advanced-excel", "Develop advanced skills for working efficiently with spreadsheets and Excel-based tasks.", "6 months"],
  ["Advanced Diploma Course", "advanced-diploma", "A comprehensive diploma-level program designed to develop a broader range of computer skills.", "12 months"],
  ["Hindi & English Numeric Typing", "typing", "Improve typing skills for Hindi and English text along with numeric data entry.", ""]
];

const insertCourse = db.prepare(`
  INSERT OR IGNORE INTO courses (name, slug, description, duration)
  VALUES (?, ?, ?, ?)
`);
const seedCourses = db.transaction(() => {
  for (const course of courses) insertCourse.run(...course);
});
seedCourses();

const defaultSettings = {
  address: "",
  phone: "",
  email: "",
  working_hours: ""
};
const insertSetting = db.prepare("INSERT OR IGNORE INTO site_settings (key, value) VALUES (?, ?)");
for (const [key, value] of Object.entries(defaultSettings)) insertSetting.run(key, value);

function ensureInitialAdmin() {
  const count = db.prepare("SELECT COUNT(*) AS count FROM admins").get().count;
  if (count > 0) return;

  const email = String(process.env.ADMIN_EMAIL || "").trim().toLowerCase();
  const password = String(process.env.ADMIN_PASSWORD || "");
  const name = String(process.env.ADMIN_NAME || "Institute Administrator").trim();

  if (!email || !password || password.length < 12) {
    console.warn("No initial admin created. Set ADMIN_EMAIL and an ADMIN_PASSWORD of at least 12 characters in .env, then restart.");
    return;
  }

  const hash = bcrypt.hashSync(password, 12);
  db.prepare("INSERT INTO admins (name, email, password_hash) VALUES (?, ?, ?)")
    .run(name || "Institute Administrator", email, hash);
  console.log(`Initial admin created for ${email}`);
}

ensureInitialAdmin();

module.exports = db;
