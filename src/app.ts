import express from 'express';

import path from 'path';
import cors from 'cors';
import dotenv from 'dotenv';
import flash from 'connect-flash';
import { initDb, setIo } from './config/db';
import authRoutes from './routes/authRoutes';
import adminRoutes from './routes/adminRoutes';

dotenv.config();

const app = express();

// ─── View Engine ───────────────────────────────────────────────────────────────
app.engine('html', require('ejs').renderFile);
app.set('view engine', 'html');
// Use __dirname for Vercel compatibility (works in both local & serverless)
app.set('views', path.join(__dirname, '..', 'views'));
app.use(express.static(path.join(__dirname, '..', 'public')));
app.use('/uploads', express.static(path.join(__dirname, '..', 'public', 'uploads')));

app.get('/static/uploads/:id', async (req, res, next) => {
    const id = req.params.id;
    if (!id || id === 'default.jpg' || id === 'sg+logo.jpg' || id.endsWith('.jpg') || id.endsWith('.png')) {
        return next();
    }
    try {
        const { queryDb } = await import('./config/db');
        const images = await queryDb('images', { id });
        if (images.length > 0 && images[0].data) {
            const base64Data = images[0].data;
            const parts = base64Data.split(';base64,');
            if (parts.length === 2) {
                const contentType = parts[0].split(':')[1];
                const buffer = Buffer.from(parts[1], 'base64');
                res.setHeader('Content-Type', contentType);
                res.setHeader('Cache-Control', 'public, max-age=31536000');
                return res.send(buffer);
            }
        }
    } catch (e) {
        console.error('[Image Fetch Error]', e);
    }
    next();
});

app.use('/static', express.static(path.join(__dirname, '..', 'public')));

// ─── Middleware ────────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
import cookieSession from 'cookie-session';

app.use(cookieSession({
    name: 'session',
    secret: process.env.SESSION_SECRET || 'empire_secret_key_fixed_2025',
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
}));

// Extend Request interface so TypeScript doesn't complain about req.session for cookie-session
declare module 'express-serve-static-core' {
    interface Request {
        session: any;
    }
}

app.use(flash());

// ─── Global Template Variables ─────────────────────────────────────────────────
app.use((req, res, next) => {
    res.locals.session = req.session;
    next();
});

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/', authRoutes);
app.use('/api', adminRoutes);    // Serves /api/menu, /api/tables, /api/admin/data, etc.

// ─── 404 Handler ──────────────────────────────────────────────────────────────
app.use((req, res) => {
    res.status(404).send(`
        <html><body style="background:#0f172a;color:#f8fafc;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;">
            <div style="text-align:center;"><h2>Page Not Found</h2><p>The page you are looking for does not exist.</p><a href="/" style="color:#38bdf8;">Go Home</a></div>
        </body></html>
    `);
});

// ─── Global Error Handler ─────────────────────────────────────────────────────
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('[ERROR]', err.stack || err.message || err);
    res.status(500).send(`
        <html><body style="background:#0f172a;color:#f8fafc;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;">
            <div style="text-align:center;"><h2>System Error</h2><p>The server encountered an internal error. Please try again.</p><a href="/" style="color:#38bdf8;">Go Home</a></div>
        </body></html>
    `);
});

// ─── Local Dev Server (not used on Vercel) ────────────────────────────────────
if (!process.env.VERCEL) {
    const { createServer } = require('http');
    const { Server } = require('socket.io');

    let currentServer: any = null;

    const PORT = Number(process.env.PORT) || 5000;

    const startServer = (port: number) => {
        if (currentServer) return;

        const server = createServer(app);
        currentServer = server;

        const io = new Server(server, { cors: { origin: '*' } });
        setIo(io);

        io.on('connection', (socket: any) => {
            socket.on('call_staff', (data: any) => {
                io.emit('staff_called', data);
            });
            socket.on('stop_call_staff', (data: any) => {
                io.emit('staff_call_stopped', data);
            });
        });

        server.once('error', (err: any) => {
            if (err.code === 'EADDRINUSE') {
                const nextPort = port + 1;
                console.log(`[WARN] Port ${port} is busy, trying ${nextPort}...`);
                currentServer = null;
                startServer(nextPort);
                return;
            }
            console.error('[FATAL] Server error:', err);
        });

        server.listen(port, async () => {
            await initDb();
            console.log(`[SUCCESS] Empire Restaurant Server is running!`);
            console.log(`👉 Local: http://localhost:${port}`);
        });
    };

    startServer(PORT);
}

// ─── Vercel Serverless Export ─────────────────────────────────────────────────
// This dual-export pattern satisfies both CommonJS (Vercel) and ESM bundlers.
module.exports = app;
export default app;
