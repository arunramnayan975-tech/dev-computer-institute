function cleanText(value, maxLength) {
  if (typeof value !== "string") return "";
  return value.replace(/\u0000/g, "").trim().slice(0, maxLength);
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;
}

function isValidPhone(phone) {
  return /^[0-9+\-\s()]{7,20}$/.test(phone);
}

function validateEnquiry(body) {
  const name = cleanText(body.name, 100);
  const email = cleanText(body.email, 254).toLowerCase();
  const phone = cleanText(body.phone, 20);
  const course = cleanText(body.course, 120);
  const message = cleanText(body.message, 2000);

  const errors = {};
  if (name.length < 2) errors.name = "Please enter your full name.";
  if (!isValidEmail(email)) errors.email = "Please enter a valid email address.";
  if (!isValidPhone(phone)) errors.phone = "Please enter a valid phone number.";
  if (!course) errors.course = "Please select a course.";
  if (message.length < 10) errors.message = "Please add a message of at least 10 characters.";

  return { valid: Object.keys(errors).length === 0, errors, data: { name, email, phone, course, message } };
}

function validateCourse(body) {
  const name = cleanText(body.name, 150);
  const slug = cleanText(body.slug, 150).toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-|-$/g, "");
  const description = cleanText(body.description, 1000);
  const duration = cleanText(body.duration, 100);
  const status = body.status === "inactive" ? "inactive" : "active";
  const errors = {};
  if (name.length < 2) errors.name = "Course name is required.";
  if (!slug) errors.slug = "A valid course slug is required.";
  return { valid: Object.keys(errors).length === 0, errors, data: { name, slug, description, duration, status } };
}

module.exports = { cleanText, isValidEmail, isValidPhone, validateEnquiry, validateCourse };
