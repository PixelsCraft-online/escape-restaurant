# Escape Restaurant Management

A fully featured, real-time comprehensive restaurant ordering and management system built with the PERN stack (PostgreSQL, Express, React, Node.js), Redis, and Socket.io.

## Features
- **Customer Menu** (`/menu?table=N`): QR-code based ordering, real-time category updates, slide-up cart, and live order tracking.
- **Kitchen Panel** (`/kitchen`): Real-time order queue with audio notifications, item-level status updates (Done, Skip, Out of Stock), and tick timers.
- **Counter Panel** (`/counter`): Central billing station, active order monitoring, discount application, and bill generation (with 5% GST calculation).
- **Admin Dashboard** (`/admin`): PIN-protected (PIN: `escape2024`) analytics displaying live revenue, order volume, charts, and instant menu availability toggling.

## Tech Stack
- **Frontend**: React (Vite), Tailwind CSS v3, Recharts
- **Backend**: Node.js, Express, Socket.io
- **Database**: PostgreSQL (Prisma ORM)
- **Caching**: Redis (for instant menu loads)

## Quick Start

### 1. Prerequisites
Ensure you have installed:
- Node.js (v18+)
- PostgreSQL (Running locally)
- Redis (Running locally on default port 6379, or provide a URL)

### 2. Install Dependencies
From the root directory, run:
```bash
npm run install:all
```

### 3. Environment Setup
Configure your database and redis connection strings in `escape-restaurant/.env`:
```env
DATABASE_URL=
REDIS_URL=
PORT=5000
ADMIN_PIN=
CLIENT_URL=
```
*(Copy the template from `.env.example`)*

### 4. Database Setup & Seeding
Navigate to the root directory and run the initialization commands:
```bash
# Push schema to database
npm run prisma:migrate

# Seed with 20 tables and 30 items
npm run prisma:seed
```

### 5. Generate QR Codes
Generate QR codes for tables 1-20 (Saved to `client/public/qr/`):
```bash
npm run generate:qr
```

### 6. Start the App
Start both the Vite frontend and Node backend concurrently:
```bash
npm run dev
```

The application will be available at:
- **Client**: `http://localhost:5173`
- **Server**: `http://localhost:5000`

---
*Created for the "Escape Restaurant" application demo.*
# escape-restaurant
# escape-restaurant
