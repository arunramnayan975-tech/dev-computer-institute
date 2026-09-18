require("dotenv").config();

const express = require("express");
const path = require("path");
const helmet = require("helmet");
const cookieParser = require("cookie-parser");
const rateLimit = require("express-rate-limit");
const crypto = require("crypto");
const db = require("./database");
const { validateEnquiry, validateCourse, cleanText } = require("./utils/validation");
const { signAdminToken, requireAdmin, setAuthCookie } = require("./middleware/auth");
const bcrypt = require("bcryptjs");

const app = express();
const PORT = Number(process.env.PORT || 3000);

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  console.error("JWT_SECRET must be set to a random value of at least 32 characters.");
  process.exit(1);
}

app.disable("x-powered-by");
app.set("trust proxy", 1);

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "https://fonts.googleapis.com", "'unsafe-inline'"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'none'"]
    }
  }
}));

app.use(express.json({ limit: "50kb" }));
app.use(express.urlencoded({ extended: false, limit: "20kb" }));
app.use(cookieParser());

const publicLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 120,
  standardHeaders: "draft-8",
  legacyHeaders: false
});

const enquiryLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  message: { error: "Too many enquiries from this network. Please try again later." }
});

app.use("/api/", publicLimiter);

app.use((req, res, next) => {
  const origin = process.env.CORS_ORIGIN;
  if (origin && req.headers.origin === origin) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
  }
  res.setHeader("Vary", "Origin");
  next();
});

// CSRF token for cookie-authenticated admin writes.
app.get("/api/admin/csrf", (req, res) => {
  const token = crypto.randomBytes(32).toString("hex");
  res.cookie("csrf_token", token, {
    httpOnly: false,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 8 * 60 * 60 * 1000,
    path: "/"
  });
  res.json({ csrfToken: token });
});

function requireCsrf(req, res, next) {
  const cookieToken = req.cookies?.csrf_token;
  const headerToken = req.get("x-csrf-token");
  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    return res.status(403).json({ error: "Invalid CSRF token." });
  }
  next();
}

// Public API
app.get("/api/health", (req, res) => res.json({ status: "ok" }));

app.get("/api/courses", (req, res) => {
  const rows = db.prepare(`
    SELECT id, name, slug, description, duration
    FROM courses
    WHERE status = 'active'
    ORDER BY id
  `).all();
  res.json({ courses: rows });
});

app.get("/api/gallery", (req, res) => {
  const rows = db.prepare(`
    SELECT id, title, image_url, description
    FROM gallery WHERE status = 'active'
    ORDER BY id DESC
  `).all();
  res.json({ gallery: rows });
});

app.get("/api/faculty", (req, res) => {
  const rows = db.prepare(`
    SELECT id, name, designation, description, photo_url
    FROM faculty WHERE status = 'active'
    ORDER BY id
  `).all();
  res.json({ faculty: rows });
});

app.get("/api/contact", (req, res) => {
  const rows = db.prepare("SELECT key, value FROM site_settings").all();
  const contact = Object.fromEntries(rows.map(row => [row.key, row.value]));
  res.json({ contact });
});

app.post("/api/enquiries", enquiryLimiter, (req, res) => {
  const result = validateEnquiry(req.body || {});
  if (!result.valid) return res.status(400).json({ error: "Please correct the highlighted fields.", fields: result.errors });

  const stmt = db.prepare(`
    INSERT INTO enquiries (name, email, phone, course, message)
    VALUES (@name, @email, @phone, @course, @message)
  `);
  const info = stmt.run(result.data);
  res.status(201).json({
    success: true,
    message: "Thank you. Your enquiry has been received.",
    enquiryId: info.lastInsertRowid
  });
});

// Admin auth
app.post("/api/admin/login", rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 8,
  message: { error: "Too many login attempts. Please try again later." }
}), async (req, res) => {
  const email = cleanText(req.body?.email, 254).toLowerCase();
  const password = typeof req.body?.password === "string" ? req.body.password : "";

  const admin = db.prepare("SELECT * FROM admins WHERE email = ?").get(email);
  const valid = admin ? await bcrypt.compare(password, admin.password_hash) : false;

  if (!valid) return res.status(401).json({ error: "Invalid email or password." });

  setAuthCookie(res, signAdminToken(admin));
  res.json({ success: true, admin: { id: admin.id, name: admin.name, email: admin.email, role: admin.role } });
});

app.post("/api/admin/logout", requireAdmin, requireCsrf, (req, res) => {
  res.clearCookie("admin_token", { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/" });
  res.clearCookie("csrf_token", { httpOnly: false, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/" });
  res.json({ success: true });
});

app.get("/api/admin/me", requireAdmin, (req, res) => {
  res.json({ admin: req.admin });
});

// Admin: enquiries
app.get("/api/admin/enquiries", requireAdmin, (req, res) => {
  const rows = db.prepare(`
    SELECT id, name, email, phone, course, message, status, created_at, updated_at
    FROM enquiries ORDER BY id DESC
  `).all();
  res.json({ enquiries: rows });
});

app.patch("/api/admin/enquiries/:id", requireAdmin, requireCsrf, (req, res) => {
  const id = Number(req.params.id);
  const status = ["new", "contacted", "closed"].includes(req.body?.status) ? req.body.status : null;
  if (!Number.isInteger(id) || !status) return res.status(400).json({ error: "Invalid enquiry or status." });

  const result = db.prepare("UPDATE enquiries SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(status, id);
  if (!result.changes) return res.status(404).json({ error: "Enquiry not found." });
  res.json({ success: true });
});

app.delete("/api/admin/enquiries/:id", requireAdmin, requireCsrf, (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: "Invalid enquiry." });

  const result = db.prepare("DELETE FROM enquiries WHERE id = ?").run(id);
  if (!result.changes) return res.status(404).json({ error: "Enquiry not found." });

  res.json({ success: true });
});

// Admin: courses
app.get("/api/admin/courses", requireAdmin, (req, res) => {
  res.json({ courses: db.prepare("SELECT * FROM courses ORDER BY id").all() });
});

app.post("/api/admin/courses", requireAdmin, requireCsrf, (req, res) => {
  const result = validateCourse(req.body || {});
  if (!result.valid) return res.status(400).json({ error: "Invalid course.", fields: result.errors });

  try {
    const info = db.prepare(`
      INSERT INTO courses (name, slug, description, duration, status)
      VALUES (@name, @slug, @description, @duration, @status)
    `).run(result.data);
    res.status(201).json({ success: true, id: info.lastInsertRowid });
  } catch (error) {
    if (String(error.message).includes("UNIQUE")) return res.status(409).json({ error: "That course slug already exists." });
    throw error;
  }
});

app.put("/api/admin/courses/:id", requireAdmin, requireCsrf, (req, res) => {
  const id = Number(req.params.id);
  const result = validateCourse(req.body || {});
  if (!Number.isInteger(id) || !result.valid) return res.status(400).json({ error: "Invalid course.", fields: result.errors });

  const info = db.prepare(`
    UPDATE courses
    SET name=@name, slug=@slug, description=@description, duration=@duration, status=@status,
        updated_at=CURRENT_TIMESTAMP
    WHERE id=@id
  `).run({ ...result.data, id });

  if (!info.changes) return res.status(404).json({ error: "Course not found." });
  res.json({ success: true });
});

app.delete("/api/admin/courses/:id", requireAdmin, requireCsrf, (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: "Invalid course." });
  const info = db.prepare("UPDATE courses SET status='inactive', updated_at=CURRENT_TIMESTAMP WHERE id=?").run(id);
  if (!info.changes) return res.status(404).json({ error: "Course not found." });
  res.json({ success: true });
});

// Admin: site settings
app.get("/api/admin/settings", requireAdmin, (req, res) => {
  const rows = db.prepare("SELECT key, value FROM site_settings").all();
  res.json({ settings: Object.fromEntries(rows.map(row => [row.key, row.value])) });
});

app.put("/api/admin/settings", requireAdmin, requireCsrf, (req, res) => {
  const allowed = ["address", "phone", "email", "working_hours"];
  const update = db.prepare(`
    INSERT INTO site_settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=CURRENT_TIMESTAMP
  `);

  const transaction = db.transaction(() => {
    for (const key of allowed) {
      if (Object.prototype.hasOwnProperty.call(req.body || {}, key)) {
        update.run(key, cleanText(req.body[key], 500));
      }
    }
  });
  transaction();
  res.json({ success: true });
});

// Serve the existing frontend unchanged.
app.use(express.static(path.join(__dirname, ".."), {
  index: "index.html",
  extensions: ["html"]
}));

app.use("/admin", express.static(path.join(__dirname, "..", "admin")));

app.use((req, res) => {
  if (req.path.startsWith("/api/")) return res.status(404).json({ error: "Endpoint not found." });
  res.status(404).send("Page not found.");
});

app.use((err, req, res, next) => {
  console.error(err);
  if (res.headersSent) return next(err);
  res.status(500).json({ error: "An unexpected server error occurred." });
});

app.listen(PORT, () => {
  console.log(`Dev Computer Institute website running at http://localhost:${PORT}`);
  console.log(`Admin dashboard: http://localhost:${PORT}/admin/`);
});
