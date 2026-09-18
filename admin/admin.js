let csrfToken = "";

const $ = (id) => document.getElementById(id);

async function api(url, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (options.body && !headers["Content-Type"]) headers["Content-Type"] = "application/json";
  if (csrfToken && !["GET", "HEAD"].includes((options.method || "GET").toUpperCase())) headers["X-CSRF-Token"] = csrfToken;
  const response = await fetch(url, { ...options, headers, credentials: "same-origin" });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Request failed.");
  return data;
}

async function initCsrf() {
  const data = await api("/api/admin/csrf");
  csrfToken = data.csrfToken;
}

function showToast(message) {
  $("toast").textContent = message;
  $("toast").classList.add("show");
  setTimeout(() => $("toast").classList.remove("show"), 2500);
}

async function loadEnquiries() {
  const { enquiries } = await api("/api/admin/enquiries");
  $("total-count").textContent = enquiries.length;
  $("new-count").textContent = enquiries.filter(e => e.status === "new").length;
  $("enquiries-body").innerHTML = enquiries.map(e => `
    <tr>
      <td><strong>${escapeHtml(e.name)}</strong></td>
      <td>${escapeHtml(e.email)}<br>${escapeHtml(e.phone)}</td>
      <td>${escapeHtml(e.course)}</td>
      <td>${escapeHtml(e.message)}</td>
      <td>
        <select class="status-select" data-id="${e.id}">
          ${["new","contacted","closed"].map(s => `<option value="${s}" ${e.status===s?"selected":""}>${s}</option>`).join("")}
        </select>
        <button class="delete-enquiry secondary" data-id="${e.id}" type="button">Delete</button>
      </td>
      <td>${escapeHtml(e.created_at)}</td>
    </tr>`).join("");

  document.querySelectorAll(".status-select").forEach(select => {
    select.addEventListener("change", async () => {
      try {
        await api(`/api/admin/enquiries/${select.dataset.id}`, {
          method: "PATCH",
          body: JSON.stringify({ status: select.value })
        });
        showToast("Enquiry updated.");
        loadEnquiries();
      } catch (err) { alert(err.message); }
    });
  });

  document.querySelectorAll(".delete-enquiry").forEach(button => {
    button.addEventListener("click", async () => {
      if (!confirm("Delete this enquiry permanently?")) return;
      try {
        await api(`/api/admin/enquiries/${button.dataset.id}`, { method: "DELETE" });
        showToast("Enquiry deleted.");
        loadEnquiries();
      } catch (err) {
        alert(err.message);
      }
    });
  });
}

async function loadCourses() {
  const { courses } = await api("/api/admin/courses");
  $("course-count").textContent = courses.filter(c => c.status === "active").length;
  $("courses-list").innerHTML = courses.map(c => `
    <div class="course-row">
      <div><strong>${escapeHtml(c.name)}</strong><br><span class="muted">${escapeHtml(c.duration)} · ${escapeHtml(c.status)}</span><br>${escapeHtml(c.description)}</div>
      <div class="course-actions">
        <button class="secondary edit-course" data-id="${c.id}">Edit</button>
        ${c.status === "active" ? `<button class="secondary delete-course" data-id="${c.id}">Deactivate</button>` : ""}
      </div>
    </div>`).join("");

  document.querySelectorAll(".edit-course").forEach(btn => btn.addEventListener("click", () => {
    const c = courses.find(x => String(x.id) === btn.dataset.id);
    $("course-id").value = c.id;
    $("course-name").value = c.name;
    $("course-slug").value = c.slug;
    $("course-duration").value = c.duration;
    $("course-description").value = c.description;
    $("course-status").value = c.status;
    window.scrollTo({ top: document.querySelector(".course-form").offsetTop - 20, behavior: "smooth" });
  }));

  document.querySelectorAll(".delete-course").forEach(btn => btn.addEventListener("click", async () => {
    if (!confirm("Deactivate this course?")) return;
    try {
      await api(`/api/admin/courses/${btn.dataset.id}`, { method: "DELETE" });
      showToast("Course deactivated.");
      loadCourses();
    } catch (err) { alert(err.message); }
  }));
}

async function loadSettings() {
  const { settings } = await api("/api/admin/settings");
  $("setting-address").value = settings.address || "";
  $("setting-phone").value = settings.phone || "";
  $("setting-email").value = settings.email || "";
  $("setting-hours").value = settings.working_hours || "";
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, ch => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#039;" }[ch]));
}

async function openDashboard(admin) {
  $("login-view").hidden = true;
  $("dashboard-view").hidden = false;
  $("admin-name").textContent = `${admin.name} · ${admin.email}`;
  await initCsrf();
  await Promise.all([loadEnquiries(), loadCourses(), loadSettings()]);
}

$("login-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  $("login-error").textContent = "";
  try {
    const data = await api("/api/admin/login", {
      method: "POST",
      body: JSON.stringify({
        email: $("login-email").value,
        password: $("login-password").value
      })
    });
    await openDashboard(data.admin);
  } catch (err) {
    $("login-error").textContent = err.message;
  }
});

$("logout-btn").addEventListener("click", async () => {
  try {
    await api("/api/admin/logout", { method: "POST" });
  } finally {
    location.reload();
  }
});

$("refresh-enquiries").addEventListener("click", loadEnquiries);
$("refresh-courses").addEventListener("click", loadCourses);

$("cancel-course").addEventListener("click", () => {
  $("course-form").reset();
  $("course-id").value = "";
});

$("course-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const id = $("course-id").value;
  const body = {
    name: $("course-name").value,
    slug: $("course-slug").value,
    duration: $("course-duration").value,
    description: $("course-description").value,
    status: $("course-status").value
  };
  try {
    await api(id ? `/api/admin/courses/${id}` : "/api/admin/courses", {
      method: id ? "PUT" : "POST",
      body: JSON.stringify(body)
    });
    showToast(id ? "Course updated." : "Course added.");
    $("course-form").reset();
    $("course-id").value = "";
    loadCourses();
  } catch (err) { alert(err.message); }
});

$("settings-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    await api("/api/admin/settings", {
      method: "PUT",
      body: JSON.stringify({
        address: $("setting-address").value,
        phone: $("setting-phone").value,
        email: $("setting-email").value,
        working_hours: $("setting-hours").value
      })
    });
    showToast("Contact information saved.");
  } catch (err) { alert(err.message); }
});

(async function boot() {
  try {
    const data = await api("/api/admin/me");
    await openDashboard(data.admin);
  } catch {
    // Not signed in; login screen remains visible.
  }
})();
