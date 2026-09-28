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
- [PostgreSQL](https://www.postgresql.org/) (v14 or newer)

### 2. Set Up the Database

Open a terminal and run:

```bash
# Create the database
psql -U postgres -c "CREATE DATABASE novacart;"

# Run the schema to create tables and seed data
psql -U postgres -d novacart -f backend/models/schema.sql
```

### 3. Configure Environment Variables

```bash
# Copy the example file
cp backend/.env.example backend/.env
```

Then open `backend/.env` and fill in:
- `DB_PASSWORD` — your PostgreSQL password
- `JWT_SECRET` — a long random string (run `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"`)

### 4. Install Dependencies & Start the Backend

```bash
cd backend
npm install
npm run dev      # development (auto-restarts on file changes)
# or
npm start        # production
```

### 5. Open the Frontend

Simply open `frontend/pages/index.html` in your browser.

> No frontend server needed — it runs directly from the file system.

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
