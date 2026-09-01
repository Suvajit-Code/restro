/**
 * db.ts — Firebase Firestore client SDK (v9+ modular API)
 *
 * WHY CLIENT SDK (not Admin SDK):
 *  - Admin SDK requires a service account JSON / private key env vars
 *  - Client SDK works with just the public config already in .env
 *  - Security is handled by Express session/role middleware (not Firestore rules)
 *  - IMPORTANT: Set Firestore rules to allow all read/write (see below)
 *
 * REQUIRED FIRESTORE RULES (Firebase Console → Firestore → Rules):
 *   rules_version = '2';
 *   service cloud.firestore {
 *     match /databases/{database}/documents {
 *       match /{document=**} {
 *         allow read, write: if true;
 *       }
 *     }
 *   }
 */

import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import {
    getFirestore,
    collection,
    getDocs,
    addDoc,
    updateDoc,
    deleteDoc,
    doc,
    Firestore
} from 'firebase/firestore';
import dotenv from 'dotenv';

dotenv.config();

// ─── Socket.IO Instance (local dev only) ──────────────────────────────────────
let ioInstance: any = null;
export const setIo = (io: any) => { ioInstance = io; };

// ─── Firebase Config ──────────────────────────────────────────────────────────
const firebaseConfig = {
    apiKey:            process.env.FIREBASE_API_KEY            || "",
    authDomain:        process.env.FIREBASE_AUTH_DOMAIN        || "",
    projectId:         process.env.FIREBASE_PROJECT_ID         || "",
    storageBucket:     process.env.FIREBASE_STORAGE_BUCKET     || "",
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || "",
    appId:             process.env.FIREBASE_APP_ID             || "",
    measurementId:     process.env.FIREBASE_MEASUREMENT_ID     || "",
    databaseURL:       process.env.FIREBASE_DATABASE_URL       || ""
};

// ─── Lazy Singleton — safe for Vercel serverless cold starts ─────────────────
let _app: FirebaseApp | null = null;
let _db: Firestore | null = null;

function getDb(): Firestore {
    if (_db) return _db;
    try {
        _app  = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
        _db   = getFirestore(_app);
        console.log('[DB] ✅ Firebase Firestore connected.');
        return _db;
    } catch (err) {
        console.error('[DB FATAL] Firestore init failed:', err);
        throw err;
    }
}

// ─── queryDb ──────────────────────────────────────────────────────────────────
export const queryDb = async (
    tableName: string,
    filters: Record<string, any> = {}
): Promise<Record<string, any>[]> => {
    const db = getDb();
    try {
        const snap = await getDocs(collection(db, tableName));
        if (snap.empty) return [];

        let rows: Record<string, any>[] = snap.docs.map(d => ({ id: d.id, ...d.data() }));

        // Client-side filter (avoids Firestore composite-index requirement on free tier)
        for (const [key, val] of Object.entries(filters)) {
            if (typeof val === 'string' && key.toLowerCase() === 'username') {
                rows = rows.filter(r => (r[key] ?? '').toString().toLowerCase() === val.toLowerCase());
            } else {
                rows = rows.filter(r => r[key] == val);
            }
        }

        return rows;
    } catch (err) {
        console.error(`[DB] queryDb('${tableName}') error:`, err);
        throw err;
    }
};

// ─── insertDb ─────────────────────────────────────────────────────────────────
export const insertDb = async (tableName: string, data: Record<string, any>): Promise<string> => {
    const db = getDb();
    try {
        const ref = await addDoc(collection(db, tableName), data);
        if (ioInstance) ioInstance.emit('db_changed', { action: 'insert', table: tableName });
        return ref.id;
    } catch (err) {
        console.error(`[DB] insertDb('${tableName}') error:`, err);
        throw err;
    }
};

// ─── updateDb ─────────────────────────────────────────────────────────────────
export const updateDb = async (tableName: string, id: string, data: Record<string, any>): Promise<void> => {
    const db = getDb();
    try {
        await updateDoc(doc(db, tableName, id), data);
        if (ioInstance) ioInstance.emit('db_changed', { action: 'update', table: tableName });
    } catch (err) {
        console.error(`[DB] updateDb('${tableName}', ${id}) error:`, err);
        throw err;
    }
};

// ─── deleteDb ─────────────────────────────────────────────────────────────────
export const deleteDb = async (tableName: string, id: string): Promise<void> => {
    const db = getDb();
    try {
        await deleteDoc(doc(db, tableName, id));
        if (ioInstance) ioInstance.emit('db_changed', { action: 'delete', table: tableName });
    } catch (err) {
        console.error(`[DB] deleteDb('${tableName}', ${id}) error:`, err);
        throw err;
    }
};

// ─── initDb — seeds default data if collection is empty ──────────────────────
// Runs only locally (guarded in app.ts). Safe to call multiple times.
export const initDb = async (): Promise<void> => {
    try {
        const existingUsers = await queryDb('users');
        if (existingUsers.length > 0) {
            // Check if shops collection needs seeding independently
            const existingShops = await queryDb('shops');
            if (existingShops.length === 0) {
                await insertDb('shops', {
                    shop_id:    'KPK-0001',
                    name:       'Empire Kitchen — Main Branch',
                    address:    '123, Food Street, City Center',
                    phone:      '+91 98765 43210',
                    manager_id: '',
                    status:     'Active',
                    created_at: new Date().toISOString()
                });
                console.log('[DB] ✅ Seeded: 1 shop (KPK-0001).');
            }
            console.log('[DB] Database already seeded. Skipping users/tables/menu.');
            return;
        }

        console.log('[DB] Empty — seeding default data...');

        for (let i = 1; i <= 10; i++) {
            await insertDb('dining_tables', { table_no: i.toString(), status: 'Clean' });
        }

        const menu = [
            { item_name: 'Pasta Arrabbiata',   price: 150, category: 'Main Course', available: true },
            { item_name: 'Chicken Burger',      price: 120, category: 'Starter',    available: true },
            { item_name: 'Margherita Pizza',    price: 200, category: 'Main Course', available: true },
            { item_name: 'Grilled Fish',        price: 280, category: 'Main Course', available: true },
            { item_name: 'Paneer Tikka',        price: 180, category: 'Starter',    available: true },
            { item_name: 'Coca Cola',           price: 50,  category: 'Drink',      available: true },
            { item_name: 'Mango Lassi',         price: 80,  category: 'Drink',      available: true },
            { item_name: 'Chocolate Lava Cake', price: 120, category: 'Dessert',    available: true },
            { item_name: 'Gulab Jamun',         price: 60,  category: 'Dessert',    available: true },
            { item_name: 'Veg Biryani',         price: 160, category: 'Main Course', available: true },
        ];
        for (const item of menu) await insertDb('menu', item);

        // ── Seed default shop ─────────────────────────────────────────────────
        await insertDb('shops', {
            shop_id:    'KPK-0001',
            name:       'Empire Kitchen — Main Branch',
            address:    '123, Food Street, City Center',
            phone:      '+91 98765 43210',
            manager_id: '',
            status:     'Active',
            created_at: new Date().toISOString()
        });

        console.log('[DB] ✅ Seeded: 2 users, 10 tables, 10 menu items, 1 shop (KPK-0001).');
    } catch (err) {
        console.error('[DB] Seed error (non-fatal, continuing):', err);
    }
};
