# GEHU ERP — Phase 1 (real backend foundation)

## Read this first: what's actually in this zip

Your original upload was a small static-HTML frontend talking to a ~70-line
Express backend that stored everything in in-memory JavaScript arrays (no
database at all) and checked plain-text passwords. There was no faculty
role, no store, no models, and the login/API URLs were hardcoded to
`localhost` in three separate files.

Building the full spec you described — 15+ database models, three complete
role-based dashboards, a working e-commerce store with cart/checkout,
notifications, global search, admissions/results/assignments workflows, and
a verified production deployment — is realistically weeks of engineering
work. I'm not going to hand you a zip that *claims* all of that is done when
it isn't; that would leave you debugging things I told you were finished.

**What this zip actually contains, verified:**

- A real MongoDB/Mongoose backend: `User`, `Student`, `Faculty`, `Course`,
  `Subject`, `Attendance`, `Notice` models with proper relationships.
- Real authentication: bcrypt-hashed passwords, JWT tokens, role-based
  middleware (`protect` + `authorize`). No plaintext passwords anywhere.
- Working REST APIs for auth, students, faculty, courses, subjects,
  attendance (with auto-calculated percentage), and notices — all
  protected, all backed by the database, not hardcoded arrays.
- The public landing site (your redesigned `index.html`), `login.html`,
  and `apply.html`, wired to the real `/api/auth/login` endpoint via a
  single configurable `config.js` (no more hardcoded `localhost` scattered
  across files).
- Admin dashboard: add/delete students, mark attendance, view a student's
  attendance history — all hitting the real database through the API.
- Student dashboard: shows the student's own profile, their course's
  subjects (pulled from the database via course+semester, not a hardcoded
  subject map), and their real attendance percentage. I removed the fake
  hardcoded "Assignments Due: 2" and "CGPA: 8.4" cards that were in the
  original — those features don't exist yet, so showing fabricated numbers
  would be dishonest.

**What I verified:** every JS file (backend routes/models/middleware, and
every inline `<script>` block in the HTML pages) passes `node --check` with
no syntax errors. I could not run a live end-to-end test against a real
MongoDB instance in this sandbox (no network access to Atlas or a Mongo
binary), so test the full login → dashboard → attendance flow yourself
after you plug in a real `MONGODB_URI` — see "Local setup" below.

**What is NOT in this zip yet** (from your original 23-point spec):

- Faculty dashboard UI (the backend API for faculty exists; there's no
  frontend page for it)
- College store / cart / orders / admin store management
- Assignments, results, admissions workflow, events, leave applications,
  notifications UI, global search UI
- Course→subject auto-assignment UI (the API supports it; admin UI to
  manage subjects isn't built)
- Production build tooling, rate limiting, input-validation library,
  automated tests

These are the honest next phases. I'd suggest tackling them in a follow-up
in this order: (1) admin UI for courses/subjects/notices, (2) faculty
dashboard, (3) the store, (4) the remaining workflows — each is a scoped
enough chunk that I can build and actually verify it in one pass.

---

## Project structure

```
Backend/
  server.js              Express app entrypoint
  config/db.js            Mongo connection
  models/                 User, Student, Faculty, Course, Subject, Attendance, Notice
  middleware/auth.js       JWT verify + role-based authorize()
  routes/                  auth, students, faculty, courses, subjects, attendance, notices
  seed/seed.js             one-time script to create the first admin login
  render.yaml              Render deploy blueprint (see "Deploying" below)
  .env.example
  package.json
Frontend/
  config.js                <- set your backend URL here for production
  index.html, login.html, apply.html   (public site)
  admin-dashboard.html, student-dashboard.html
  script.js, style.css, images
netlify.toml               Netlify build config (points at Frontend/)
vercel.json                Vercel build config (points at Frontend/)
.gitignore                 keeps node_modules/.env out of git
```

## Environment variables (`Backend/.env`)

Copy `Backend/.env.example` to `Backend/.env` and fill in:

| Variable | Purpose |
|---|---|
| `MONGODB_URI` | Your MongoDB connection string (Atlas or self-hosted) |
| `JWT_SECRET` | Long random string used to sign login tokens |
| `JWT_EXPIRES_IN` | Token lifetime, e.g. `7d` |
| `PORT` | Port the backend listens on (default 5000) |
| `CLIENT_URL` | Comma-separated list of frontend origins allowed by CORS |
| `ADMIN_SEED_USERNAME` / `ADMIN_SEED_PASSWORD` | Used once by `npm run seed:admin` |

Never commit `.env` — only `.env.example` should go in git.

## Local setup

```bash
cd Backend
npm install
cp .env.example .env
# edit .env: at minimum set MONGODB_URI and JWT_SECRET

npm run seed:admin      # creates your first admin login (uses ADMIN_SEED_* from .env)
npm start                # or: npm run dev
```

The backend runs at `http://localhost:5000`. Health check:
`curl http://localhost:5000/api/health`.

For the frontend, no build step is needed (it's static HTML). Just serve
the `Frontend/` folder — e.g. `npx serve Frontend` or open the files in
VS Code's Live Server — and make sure `Frontend/config.js` points at your
backend:

```js
window.API_BASE = "http://127.0.0.1:5000/api";
```

Log in with the admin account you seeded. As admin, use "Manage Students"
to create student logins (this creates both the `User` and `Student`
records). You'll also need to create at least one `Course` and some
`Subject` records before a student dashboard shows real subjects — there's
no admin UI for that yet, so for now use a tool like Postman/curl against
`POST /api/courses` and `POST /api/subjects` (both admin-only, need your
JWT in the `Authorization: Bearer <token>` header).

## Deploying to hiicrow.site

You'll need three pieces: a hosted MongoDB, a hosted Node backend, and
hosting for the static frontend — then point your domain at them.

1. **MongoDB** — create a free/paid cluster on MongoDB Atlas, add a
   database user, allow network access from your backend host's IP (or
   `0.0.0.0/0` if your host has no fixed IP), and copy the connection
   string into `MONGODB_URI`.

2. **Backend hosting (Render)** — push this repo to GitHub, then on
   [render.com](https://render.com) choose "New +" → "Blueprint" and point
   it at the repo; it will read `Backend/render.yaml` automatically and
   create the service for you. Fill in the secret env vars it prompts for
   (`MONGODB_URI`, `JWT_SECRET`, `CLIENT_URL`, `ADMIN_SEED_USERNAME`,
   `ADMIN_SEED_PASSWORD`) in the dashboard — never commit real values into
   `.env`. (No Render account yet, or prefer Railway/Fly.io/a VPS instead?
   `render.yaml` is only used by Render — any other Node host works too,
   just set the same env vars manually.) Once deployed, add a custom
   domain `api.hiicrow.site` under the service's Settings → Custom
   Domains — Render shows you the exact CNAME target to add at Namecheap.

3. **Frontend hosting (Netlify or Vercel)** — since it's static HTML,
   `netlify.toml` and `vercel.json` at the repo root are already set up to
   build from the `Frontend/` folder — just "Import Project" from the same
   GitHub repo on either platform and it auto-detects the config. Add
   `hiicrow.site` and `www.hiicrow.site` as custom domains in that
   project's dashboard — it'll show you the exact A record / CNAME to add
   at Namecheap.

4. **Wire them together** — edit `Frontend/config.js` before deploying:
   ```js
   window.API_BASE = "https://api.hiicrow.site/api";
   ```

5. **CORS** — set `CLIENT_URL=https://hiicrow.site,https://www.hiicrow.site`
   in the backend's environment so the browser is allowed to call it.

6. **DNS at Namecheap** — Domain List → Manage next to `hiicrow.site` →
   Advanced DNS → Host Records. Remove Namecheap's default parked-page
   records first, then add the A record (root `@`) and CNAME records
   (`www`, `api`) using the exact values your frontend/backend hosts gave
   you in steps 2-3. DNS changes usually take 15 minutes to a few hours to
   propagate; both hosts auto-issue free HTTPS certificates once it
   resolves.

## Security notes

- Passwords are bcrypt-hashed (`models/User.js`); never stored plain text.
- All non-login routes require a valid JWT (`middleware/auth.js`); role
  checks (`authorize('admin')`, etc.) stop students/faculty from hitting
  admin-only endpoints even if they guess the URL.
- CORS is restricted to the origins you list in `CLIENT_URL` — don't leave
  it as `*` in production.
- `.env` is not included in this zip; only `.env.example` is. Generate a
  fresh `JWT_SECRET` for production rather than reusing any example value.
