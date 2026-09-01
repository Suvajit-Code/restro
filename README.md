# Empire Restaurant

A Node.js + Express restaurant management app for handling staff login, shop operations, kitchen workflows, attendance, menu management, orders, and bills.

## Features

- Staff and admin authentication flow
- Role-based dashboards for admin, shop manager, worker, cook, and cleaner
- Menu management and order placement
- Kitchen and shop approval workflow
- Attendance tracking
- Bill generation and viewing
- Socket.IO live updates for staff calls
- Firebase Firestore support with automatic in-memory fallback for local/dev use

## Tech Stack

- Node.js
- Express
- TypeScript
- Firebase Firestore
- Socket.IO
- EJS templates
- Multer for profile uploads

## Getting Started

### 1) Install dependencies

```bash
npm install
```

### 2) Run in development mode

```bash
npm run dev
```

### 3) Build for production

```bash
npm run build
```

### 4) Start the production server

```bash
npm start
```

The app will run on port 5000 by default unless `PORT` is set.

## Environment Variables

Create a `.env` file in the project root if you want to use Firebase Firestore.

```env
PORT=5000
SESSION_SECRET=your_session_secret
FIREBASE_API_KEY=your_api_key
FIREBASE_AUTH_DOMAIN=your_auth_domain
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_STORAGE_BUCKET=your_storage_bucket
FIREBASE_MESSAGING_SENDER_ID=your_sender_id
FIREBASE_APP_ID=your_app_id
FIREBASE_MEASUREMENT_ID=your_measurement_id
FIREBASE_DATABASE_URL=your_database_url
```

If Firebase config is missing, invalid, or `USE_FIREBASE` is not set to `true`, the app automatically falls back to an in-memory data store so the app can still run for local development or demo purposes.

## Project Structure

```text
src/
  app.ts
  config/
  controllers/
  routes/
views/
public/
```

## Notes

- A local `.env` file is optional.
- Production deployments may prefer a real Firebase project or a dedicated database backend.
- The app is designed for local and small-scale restaurant operations.

## License

ISC
