# Dev Computer Institute — Official Website Foundation

This project contains the existing public frontend plus a Node.js/Express backend and an authenticated admin dashboard.

## Stack

- HTML5 / CSS3 / vanilla JavaScript
- Node.js
- Express
- SQLite (better-sqlite3)
- Helmet
- Rate limiting
- bcrypt password hashing
- JWT-based admin session in an HttpOnly cookie
- CSRF protection for admin write operations

## Run locally

1. Install Node.js 18 or newer.
2. Copy `.env.example` to `.env`.
3. Set a strong `JWT_SECRET`.
4. Set `ADMIN_EMAIL` and a strong `ADMIN_PASSWORD` (12+ characters).
5. Install dependencies:

```bash
npm install
```

6. Start:

```bash
npm start
```

7. Open:

- Public website: http://localhost:3000/
- Admin dashboard: http://localhost:3000/admin/

The database is created automatically at `data/institute.db`.

## Important

The public contact fields are intentionally blank in the database until the institute confirms the official address, phone, email and opening hours. Do not publish unverified information.

The initial admin is created only when no admin exists and valid admin environment variables are present. Never commit `.env`.

## API

Public:
- `GET /api/health`
- `GET /api/courses`
- `GET /api/gallery`
- `GET /api/faculty`
- `GET /api/contact`
- `POST /api/enquiries`

Admin (authentication required):
- `POST /api/admin/login`
- `POST /api/admin/logout`
- `GET /api/admin/me`
- `GET /api/admin/enquiries`
- `PATCH /api/admin/enquiries/:id`
- `GET /api/admin/courses`
- `POST /api/admin/courses`
- `PUT /api/admin/courses/:id`
- `DELETE /api/admin/courses/:id`
- `GET /api/admin/settings`
- `PUT /api/admin/settings`

## Production notes

Before using this as the public production site:

- Deploy behind HTTPS.
- Use a long random `JWT_SECRET`.
- Set `NODE_ENV=production`.
- Use a proper domain and email service.
- Configure automated database backups.
- Consider PostgreSQL if enquiry volume/concurrency grows.
- Add verified institute content, privacy/terms pages and a real image-storage strategy.
- Review the admin account and access policy with the institute.
