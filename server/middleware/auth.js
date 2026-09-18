const jwt = require("jsonwebtoken");

function signAdminToken(admin) {
  return jwt.sign(
    { sub: admin.id, role: admin.role, email: admin.email, name: admin.name },
    process.env.JWT_SECRET,
    { expiresIn: "8h" }
  );
}

function requireAdmin(req, res, next) {
  const token = req.cookies?.admin_token;
  if (!token) return res.status(401).json({ error: "Authentication required." });

  try {
    req.admin = jwt.verify(token, process.env.JWT_SECRET);
    if (req.admin.role !== "admin") return res.status(403).json({ error: "Admin access required." });
    next();
  } catch {
    return res.status(401).json({ error: "Session expired. Please log in again." });
  }
}

function setAuthCookie(res, token) {
  res.cookie("admin_token", token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 8 * 60 * 60 * 1000,
    path: "/"
  });
}

module.exports = { signAdminToken, requireAdmin, setAuthCookie };
