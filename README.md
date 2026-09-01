# Empire Restaurant

Empire Restaurant is a restaurant management app built with HTML, CSS, JavaScript, TypeScript, Node.js, Express, and Firebase-ready data services. It supports login, dashboard workflows, menu management, order processing, attendance, billing, and staff role-based access for a small restaurant operation.

## Features

- Role-based login and session flow for admin, shop manager, worker, cook, and cleaner
- Admin dashboard for approval, blocking, role updates, and menu management
- Shop manager dashboard for staff verification, order approval, and shop operations
- Worker order placement and order history tracking
- Cook panel for processing kitchen requests
- Cleaner panel and table status updates
- Attendance tracking with login/logout timestamps
- Bill generation and order invoice display
- Real-time staff call notifications using Socket.IO
- Profile image upload support with Multer
- Firebase-ready Firestore setup with automatic in-memory fallback for local/demo mode

## Tech Stack

### Frontend
- HTML
- CSS
- JavaScript
- EJS templates for server-rendered pages
- Static assets in the public folder

### Backend
- Node.js
- Express
- TypeScript
- Socket.IO
- Multer
- Cookie-session based authentication

### Data / Storage
- Firebase Firestore (optional real backend)
- In-memory fallback store for local development and testing

## Working Process and Flow

### 1) App startup
- The server starts from `src/app.ts`.
- It loads environment variables, sets up Express, static files, view rendering, and session middleware.
- It initializes the database layer and starts the local Node server if not running in Vercel mode.

### 2) Login flow
- User hits `/login` and submits username, password, and role.
- The server validates the user in the database.
- Staff users must also provide a valid shop ID to access their assigned shop.
- If valid, the server stores session data including user ID, role, shop ID, and attendance session.
- The user is redirected to the correct dashboard.

### 3) Role-based dashboard routing
- Admin goes to `/admin`
- Shop manager goes to `/shop`
- Worker goes to `/worker_ui`
- Cook goes to `/cook_ui`
- Cleaner goes to `/cleaner_ui`

### 4) Orders and kitchen workflow
- Workers create orders from the table interface.
- Orders are saved with a status such as `New`, `Cooking`, `Processing`, `Reverted`, or `Billed`.
- Shop managers review and approve or reject orders.
- Cook panel updates order status for kitchen processing.
- Bills can be generated and printed from the final order.

### 5) Data persistence
- With valid Firebase env values, the app stores data in Firestore.
- Without Firebase, the app falls back to an in-memory store so the app can still run reliably in local/demo environments.

## Project Structure

```text
project-root/
├── src/
│   ├── app.ts
│   ├── config/
│   │   └── db.ts
│   ├── controllers/
│   │   ├── adminController.ts
│   │   └── authController.ts
│   └── routes/
│       ├── adminRoutes.ts
│       └── authRoutes.ts
├── public/
│   ├── css/
│   └── js/
├── views/
│   ├── login.html
│   ├── register.html
│   ├── admin_panel.html
│   ├── shop_panel.html
│   ├── worker_panel.html
│   ├── cook_panel.html
│   ├── cleaner_panel.html
│   └── bill_template.html
├── package.json
├── tsconfig.json
├── README.md
├── .env.example
├── vercel.json
└── convert.js
```

## Getting Started

### 1) Install dependencies

```bash
npm install
```

### 2) Run in development mode

```bash
npm run dev
```

### 3) Build the app

```bash
npm run build
```

### 4) Start production server

```bash
npm start
```

The application runs on port `5000` by default unless `PORT` is set in the environment.

## Environment Variables

Copy `.env.example` to `.env` and configure values if you want to enable Firebase Firestore.

```env
PORT=5000
SESSION_SECRET=your_session_secret
USE_FIREBASE=false
FIREBASE_API_KEY=your_api_key
FIREBASE_AUTH_DOMAIN=your_auth_domain
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_STORAGE_BUCKET=your_storage_bucket
FIREBASE_MESSAGING_SENDER_ID=your_sender_id
FIREBASE_APP_ID=your_app_id
FIREBASE_MEASUREMENT_ID=your_measurement_id
FIREBASE_DATABASE_URL=your_database_url
```

Important:
- If `USE_FIREBASE` is not set to `true`, the app uses the built-in in-memory fallback mode.
- This makes local development smooth even without a real Firebase project.

## Notes on Frontend and UI

The project uses a mix of server-rendered HTML pages and JavaScript-powered interactive logic. The UI is not yet fully polished, but the app structure is built around:
- HTML for page structure
- CSS for styling/layout
- JavaScript for dynamic interactions
- TypeScript for backend logic and safer server-side development

## Planned Improvements

### 1) Real login page flow
- Replace the current minimal flow with a cleaner auth experience.
- Add stronger validation, password masking, role-specific login cards, and better error messages.
- Improve session handling and redirect logic after login/logout.

### 2) Frontend UI cleanup
- Standardize layout colors, spacing, and component styles.
- Refine admin/shop/cook/cleaner dashboard design.
- Improve mobile responsiveness and improve page consistency across all HTML views.

## License

ISC
