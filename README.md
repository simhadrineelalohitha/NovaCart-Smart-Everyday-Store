# NovaCart — Smart Everyday Store

A full-stack e-commerce web application built for the CodeAlpha internship programme.

## Tech Stack

| Layer      | Technology                     |
|------------|--------------------------------|
| Frontend   | HTML5, CSS3, Vanilla JavaScript |
| Backend    | Node.js + Express.js           |
| Database   | PostgreSQL                     |
| Auth       | JWT + bcrypt                   |

---

## Project Structure

```
NovaCart/
├── backend/          # Node.js + Express API
└── frontend/         # HTML, CSS, JavaScript
```

---

## Getting Started

### 1. Prerequisites

- [Node.js](https://nodejs.org/) (v18 or newer)
- An existing PostgreSQL database for production. These instructions do not create a database.

### 2. Configure Environment Variables

Copy `backend/.env.example` to `backend/.env` for local development. Local development uses `DB_PATH` when `DATABASE_URL` is empty; production requires `DATABASE_URL`. The authentication code requires `JWT_SECRET`; `JWT_EXPIRES_IN` is optional.

Keep production credentials in the hosting provider's environment settings, not in source control. No `SESSION_SECRET` is used by this application.

### 3. Install and Start

From the repository root:

```bash
npm install
npm start
```

The root install also installs the backend dependencies. The server serves the frontend and API from one origin at `http://localhost:5000` by default. Local HTML-file mode remains supported by the frontend API helper.

### 4. Initialize or Migrate Data

Database initialization is explicit and does not run at server startup. Before applying the schema or importing products, inspect the existing target PostgreSQL schema. `npm run db:init` (from `backend/`) applies non-destructive `CREATE TABLE IF NOT EXISTS` statements to the database selected by `DATABASE_URL`; it does not create a database or seed sample products.

To merge the local SQLite catalog and its local accounts into that existing PostgreSQL database, configure `DATABASE_URL` for the command and run `npm run db:migrate:sqlite` from `backend/`. The importer checks the existing schema, de-duplicates products by `source_product_id` and users by email, does not overwrite matches, and reports the final counts. It is not run automatically.

### Render Commands

Set the Render service root directory to the repository root, then use:

```text
Build Command: npm install
Start Command: npm start
```

The production API uses same-origin `/api/...` paths and requires `NODE_ENV=production`, `DATABASE_URL`, and `JWT_SECRET`. Set `FRONTEND_URL` only when the browser frontend is on a different origin.

---

## API Endpoints

| Method | Endpoint              | Auth | Description          |
|--------|-----------------------|------|----------------------|
| GET    | `/api/health`         | No   | Server health check  |
| POST   | `/api/auth/register`  | No   | Register new user    |
| POST   | `/api/auth/login`     | No   | Login, receive JWT   |
| GET    | `/api/products`       | No   | List all products    |
| GET    | `/api/products/:id`   | No   | Get single product   |
| GET    | `/api/cart`           | ✅   | Get user's cart      |
| POST   | `/api/cart`           | ✅   | Add item to cart     |
| PUT    | `/api/cart/:id`       | ✅   | Update cart item     |
| DELETE | `/api/cart/:id`       | ✅   | Remove cart item     |
| POST   | `/api/orders`         | ✅   | Place order          |
| GET    | `/api/orders`         | ✅   | Get order history    |
| GET    | `/api/orders/:id`     | ✅   | Get order details    |

---

## Development Stages

- [x] **Stage 1** — Project setup, folder structure, health check API
- [ ] **Stage 2** — User authentication (register, login, JWT)
- [ ] **Stage 3** — Product listing and detail pages
- [ ] **Stage 4** — Shopping cart
- [ ] **Stage 5** — Order processing
- [ ] **Stage 6** — Polish, responsive design, README

---

*Built by [Your Name] — CodeAlpha Full Stack Development Internship*
