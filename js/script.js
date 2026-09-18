/* ==========================================================================
   DEV COMPUTER INSTITUTE — SCRIPT
   Organized into small, independent modules that each set up one feature.
   Every module is wrapped in a function and called once on DOMContentLoaded.
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  setFooterYear();
  initHeaderScrollState();
  initMobileNav();
  initActiveNavLink();
  initFaqAccordion();
  initFormValidation();
  initBackToTop();
  initScrollReveal();
});

/* ---------------------------------------------------------------
   Footer year — keeps the copyright year current automatically.
---------------------------------------------------------------- */
function setFooterYear() {
  const yearEl = document.getElementById('footer-year');
  if (yearEl) {
    yearEl.textContent = new Date().getFullYear();
  }
}

/* ---------------------------------------------------------------
   Header scroll state — adds a border/shadow once the page has
   scrolled past the top, so the sticky nav reads as "lifted".
---------------------------------------------------------------- */
function initHeaderScrollState() {
  const header = document.getElementById('site-header');
  if (!header) return;

  const updateState = () => {
    header.classList.toggle('is-scrolled', window.scrollY > 8);
  };

  updateState();
  window.addEventListener('scroll', updateState, { passive: true });
}

/* ---------------------------------------------------------------
   Mobile navigation — toggles the hamburger menu open/closed and
   closes it again whenever a link inside it is clicked.
---------------------------------------------------------------- */
function initMobileNav() {
  const hamburger = document.getElementById('hamburger');
  const mobileMenu = document.getElementById('mobile-menu');
  if (!hamburger || !mobileMenu) return;

  const closeMenu = () => {
    hamburger.setAttribute('aria-expanded', 'false');
    mobileMenu.classList.remove('is-open');
  };

  const toggleMenu = () => {
    const isOpen = mobileMenu.classList.toggle('is-open');
    hamburger.setAttribute('aria-expanded', String(isOpen));
  };

  hamburger.addEventListener('click', toggleMenu);

  mobileMenu.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', closeMenu);
  });

  // Close the menu if the viewport is resized back to desktop width
  window.addEventListener('resize', () => {
    if (window.innerWidth > 900) closeMenu();
  });
}

/* ---------------------------------------------------------------
   Active nav link — highlights the nav item that matches the
   section currently in view, using IntersectionObserver.
---------------------------------------------------------------- */
function initActiveNavLink() {
  const sections = document.querySelectorAll('main section[id]');
  const navLinks = document.querySelectorAll('.nav-link');
  if (!sections.length || !navLinks.length) return;

  const linkForId = (id) =>
    Array.from(navLinks).find((link) => link.getAttribute('href') === `#${id}`);

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          navLinks.forEach((link) => link.classList.remove('is-active'));
          const activeLink = linkForId(entry.target.id);
          if (activeLink) activeLink.classList.add('is-active');
        }
      });
    },
    { rootMargin: '-40% 0px -55% 0px' }
  );

  sections.forEach((section) => observer.observe(section));
}

/* ---------------------------------------------------------------
   FAQ accordion — expands one answer at a time. Built with plain
   buttons + aria-expanded so it stays keyboard and screen-reader
   accessible without any extra library.
---------------------------------------------------------------- */
function initFaqAccordion() {
  const faqItems = document.querySelectorAll('.faq-item');
  if (!faqItems.length) return;

  faqItems.forEach((item) => {
    const question = item.querySelector('.faq-question');
    const answer = item.querySelector('.faq-answer');
    if (!question || !answer) return;

    question.addEventListener('click', () => {
      const isOpen = question.getAttribute('aria-expanded') === 'true';

      // Close every other item first, for a single-open accordion
      faqItems.forEach((otherItem) => {
        const otherQuestion = otherItem.querySelector('.faq-question');
        const otherAnswer = otherItem.querySelector('.faq-answer');
        if (otherQuestion && otherAnswer) {
          otherQuestion.setAttribute('aria-expanded', 'false');
          otherAnswer.style.maxHeight = null;
        }
      });

      // Then open this one, unless it was already open (acts as a toggle)
      if (!isOpen) {
        question.setAttribute('aria-expanded', 'true');
        answer.style.maxHeight = `${answer.scrollHeight}px`;
      }
    });
  });
}

/* ---------------------------------------------------------------
   Form validation + enquiry submission. The form first posts to the
   Spring Boot API. If the API is unavailable, a WhatsApp fallback
   keeps the static site usable.
---------------------------------------------------------------- */
function initFormValidation() {
  const form = document.getElementById('enquiry-form');
  if (!form) return;

  const successMessage = document.getElementById('form-success');
  const submitButton = form.querySelector('button[type="submit"]');

  const fields = {
    name: {
      input: document.getElementById('name'),
      error: document.getElementById('error-name'),
      validate: (value) => (value.trim().length >= 2 ? '' : 'Please enter your full name.'),
    },
    email: {
      input: document.getElementById('email'),
      error: document.getElementById('error-email'),
      validate: (value) =>
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()) ? '' : 'Please enter a valid email address.',
    },
    phone: {
      input: document.getElementById('phone'),
      error: document.getElementById('error-phone'),
      validate: (value) =>
        /^[0-9+\-\s()]{7,20}$/.test(value.trim()) ? '' : 'Please enter a valid phone number.',
    },
    course: {
      input: document.getElementById('course'),
      error: document.getElementById('error-course'),
      validate: (value) => (value ? '' : 'Please select a course.'),
    },
    message: {
      input: document.getElementById('message'),
      error: document.getElementById('error-message'),
      validate: (value) => (value.trim().length >= 10 ? '' : 'Please add a short message (10+ characters).'),
    },
  };

  const validateField = (key) => {
    const field = fields[key];
    const errorText = field.validate(field.input.value);
    field.error.textContent = errorText;
    field.input.closest('.form-group').classList.toggle('has-error', Boolean(errorText));
    return !errorText;
  };

  Object.keys(fields).forEach((key) => {
    fields[key].input.addEventListener('blur', () => validateField(key));
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const results = Object.keys(fields).map((key) => validateField(key));
    if (!results.every(Boolean)) {
      successMessage.classList.remove('is-visible');
      const firstInvalid = Object.keys(fields).find((key) => fields[key].error.textContent);
      if (firstInvalid) fields[firstInvalid].input.focus();
      return;
    }

    successMessage.classList.remove('is-visible');
    submitButton.disabled = true;
    const originalText = submitButton.textContent;
    submitButton.textContent = 'Sending…';

    try {
      const response = await fetch('/api/enquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: fields.name.input.value.trim(),
          email: fields.email.input.value.trim(),
          phone: fields.phone.input.value.trim(),
          course: fields.course.input.value,
          message: fields.message.input.value.trim(),
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || 'We could not submit your enquiry. Please try again.');
      }

      successMessage.textContent = data.message || 'Thank you — your enquiry has been received.';
      successMessage.classList.add('is-visible');
      form.reset();

      Object.keys(fields).forEach((key) => {
        fields[key].input.closest('.form-group').classList.remove('has-error');
        fields[key].error.textContent = '';
      });
    } catch (error) {
      // Static-site fallback: if the Spring Boot API is not running yet,
      // send the same enquiry through WhatsApp instead of leaving the user
      // with a dead form.
      const whatsappText = [
        'New Course Enquiry',
        `Name: ${fields.name.input.value.trim()}`,
        `Email: ${fields.email.input.value.trim()}`,
        `Phone: ${fields.phone.input.value.trim()}`,
        `Course: ${fields.course.options[fields.course.selectedIndex].text}`,
        `Message: ${fields.message.input.value.trim()}`
      ].join('\\n');

      const whatsappUrl = `https://wa.me/918287441374?text=${encodeURIComponent(whatsappText)}`;
      successMessage.innerHTML = 'The enquiry server is unavailable. <a href="' + whatsappUrl +
        '" target="_blank" rel="noopener">Click here to send your enquiry on WhatsApp</a>.';
      successMessage.classList.add('is-visible');
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = originalText;
    }
  });
}

/* ---------------------------------------------------------------
   Back to top button — appears after scrolling down a bit, and
   smooth-scrolls back to the hero when clicked.
---------------------------------------------------------------- */
function initBackToTop() {
  const button = document.getElementById('back-to-top');
  if (!button) return;

  const toggleVisibility = () => {
    button.classList.toggle('is-visible', window.scrollY > 500);
  };

  toggleVisibility();
  window.addEventListener('scroll', toggleVisibility, { passive: true });

  button.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}

/* ---------------------------------------------------------------
   Scroll reveal — applied deliberately to section intros and card
   groups only (not every element), so the effect stays subtle
   rather than becoming a scroll-triggered animation on everything.
---------------------------------------------------------------- */
function initScrollReveal() {
  const revealTargets = document.querySelectorAll(
    '.section-intro, .course-card, .feature-card, .highlight-card, .gallery-item'
  );
  if (!revealTargets.length) return;

  revealTargets.forEach((el) => el.classList.add('reveal'));

  const observer = new IntersectionObserver(
    (entries, obs) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          obs.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15 }
  );

  revealTargets.forEach((el) => observer.observe(el));
}
