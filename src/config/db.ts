/**
 * db.ts — Firebase Firestore client SDK with graceful in-memory fallback.
 *
 * The app runs locally without Firebase credentials for development and demos.
 * When valid Firebase config is present, it uses Firestore; otherwise it falls back
 * to an in-memory store so the app still starts and works reliably.
 */

import { randomUUID } from 'crypto';
import dotenv from 'dotenv';
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

dotenv.config();

let ioInstance: any = null;
export const setIo = (io: any) => { ioInstance = io; };

const firebaseConfig = {
    apiKey:            process.env.FIREBASE_API_KEY            || '',
    authDomain:        process.env.FIREBASE_AUTH_DOMAIN        || '',
    projectId:         process.env.FIREBASE_PROJECT_ID         || '',
    storageBucket:     process.env.FIREBASE_STORAGE_BUCKET     || '',
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || '',
    appId:             process.env.FIREBASE_APP_ID             || '',
    measurementId:     process.env.FIREBASE_MEASUREMENT_ID     || '',
    databaseURL:       process.env.FIREBASE_DATABASE_URL       || ''
};

const hasFirebaseConfig = () => Boolean(
    firebaseConfig.projectId &&
    firebaseConfig.apiKey &&
    firebaseConfig.appId &&
    firebaseConfig.authDomain
);

let useFirebase = process.env.USE_FIREBASE === 'true' && hasFirebaseConfig();
const localDbStore: Record<string, Record<string, any>[]> = {};
let fallbackWarned = false;
let initDbPromise: Promise<void> | null = null;

const markFirebaseUnavailable = (err: any) => {
    const message = err && err.message ? String(err.message) : String(err || '');
    const shouldFallback = /INVALID_ARGUMENT|Could not reach Cloud Firestore|Failed to fetch|offline|permission|not found|unreachable/i.test(message);
    if (shouldFallback) {
        useFirebase = false;
        if (!fallbackWarned) {
            console.warn('[DB] Firebase is unavailable or invalid. Switching to in-memory fallback mode.');
            fallbackWarned = true;
        }
    }
    return shouldFallback;
};

const ensureLocalCollection = (tableName: string) => {
    if (!localDbStore[tableName]) localDbStore[tableName] = [];
    return localDbStore[tableName];
};

const applyLocalFilters = (rows: Record<string, any>[], filters: Record<string, any> = {}) => {
    let result = [...rows];
    for (const [key, val] of Object.entries(filters)) {
        if (val === undefined || val === null || val === '') continue;
        result = result.filter((row) => {
            if (typeof val === 'string' && key.toLowerCase() === 'username') {
                return (row[key] ?? '').toString().toLowerCase() === val.toLowerCase();
            }
            return row[key] == val;
        });
    }
    return result;
};

let _app: FirebaseApp | null = null;
let _db: Firestore | null = null;

function getDb(): Firestore | null {
    if (!useFirebase) {
        if (!fallbackWarned) {
            console.warn('[DB] Firebase config not found. Using in-memory fallback store.');
            fallbackWarned = true;
        }
        return null;
    }

    if (_db) return _db;
    try {
        _app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
        _db = getFirestore(_app);
        console.log('[DB] ✅ Firebase Firestore connected.');
        return _db;
    } catch (err) {
        markFirebaseUnavailable(err);
        return null;
    }
}

export const queryDb = async (
    tableName: string,
    filters: Record<string, any> = {}
): Promise<Record<string, any>[]> => {
    const db = getDb();
    if (!db) {
        const rows = ensureLocalCollection(tableName);
        return applyLocalFilters(rows, filters);
    }

    try {
        const snap = await getDocs(collection(db, tableName));
        if (snap.empty) return [];

        let rows: Record<string, any>[] = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        for (const [key, val] of Object.entries(filters)) {
            if (val === undefined || val === null || val === '') continue;
            if (typeof val === 'string' && key.toLowerCase() === 'username') {
                rows = rows.filter(r => (r[key] ?? '').toString().toLowerCase() === val.toLowerCase());
            } else {
                rows = rows.filter(r => r[key] == val);
            }
        }

        return rows;
    } catch (err) {
        if (markFirebaseUnavailable(err)) {
            return applyLocalFilters(ensureLocalCollection(tableName), filters);
        }
        console.warn(`[DB] queryDb('${tableName}') failed, using memory fallback:`, err);
        return applyLocalFilters(ensureLocalCollection(tableName), filters);
    }
};

export const insertDb = async (tableName: string, data: Record<string, any>): Promise<string> => {
    const db = getDb();
    if (!db) {
        const rows = ensureLocalCollection(tableName);
        const item = { ...data, id: randomUUID() };
        rows.push(item);
        if (ioInstance) ioInstance.emit('db_changed', { action: 'insert', table: tableName });
        return item.id;
    }

    try {
        const ref = await addDoc(collection(db, tableName), data);
        if (ioInstance) ioInstance.emit('db_changed', { action: 'insert', table: tableName });
        return ref.id;
    } catch (err) {
        if (markFirebaseUnavailable(err)) {
            const rows = ensureLocalCollection(tableName);
            const item = { ...data, id: randomUUID() };
            rows.push(item);
            if (ioInstance) ioInstance.emit('db_changed', { action: 'insert', table: tableName });
            return item.id;
        }
        console.warn(`[DB] insertDb('${tableName}') failed, using memory fallback:`, err);
        const rows = ensureLocalCollection(tableName);
        const item = { ...data, id: randomUUID() };
        rows.push(item);
        if (ioInstance) ioInstance.emit('db_changed', { action: 'insert', table: tableName });
        return item.id;
    }
};

export const updateDb = async (tableName: string, id: string, data: Record<string, any>): Promise<void> => {
    const db = getDb();
    if (!db) {
        const rows = ensureLocalCollection(tableName);
        const index = rows.findIndex(row => row.id === id);
        if (index >= 0) rows[index] = { ...rows[index], ...data };
        if (ioInstance) ioInstance.emit('db_changed', { action: 'update', table: tableName });
        return;
    }

    try {
        await updateDoc(doc(db, tableName, id), data);
        if (ioInstance) ioInstance.emit('db_changed', { action: 'update', table: tableName });
    } catch (err) {
        if (markFirebaseUnavailable(err)) {
            const rows = ensureLocalCollection(tableName);
            const index = rows.findIndex(row => row.id === id);
            if (index >= 0) rows[index] = { ...rows[index], ...data };
            if (ioInstance) ioInstance.emit('db_changed', { action: 'update', table: tableName });
            return;
        }
        console.warn(`[DB] updateDb('${tableName}', ${id}) failed, using memory fallback:`, err);
        const rows = ensureLocalCollection(tableName);
        const index = rows.findIndex(row => row.id === id);
        if (index >= 0) rows[index] = { ...rows[index], ...data };
        if (ioInstance) ioInstance.emit('db_changed', { action: 'update', table: tableName });
    }
};

export const deleteDb = async (tableName: string, id: string): Promise<void> => {
    const db = getDb();
    if (!db) {
        const rows = ensureLocalCollection(tableName);
        const filtered = rows.filter(row => row.id !== id);
        localDbStore[tableName] = filtered;
        if (ioInstance) ioInstance.emit('db_changed', { action: 'delete', table: tableName });
        return;
    }

    try {
        await deleteDoc(doc(db, tableName, id));
        if (ioInstance) ioInstance.emit('db_changed', { action: 'delete', table: tableName });
    } catch (err) {
        if (markFirebaseUnavailable(err)) {
            const rows = ensureLocalCollection(tableName);
            localDbStore[tableName] = rows.filter(row => row.id !== id);
            if (ioInstance) ioInstance.emit('db_changed', { action: 'delete', table: tableName });
            return;
        }
        console.warn(`[DB] deleteDb('${tableName}', ${id}) failed, using memory fallback:`, err);
        const rows = ensureLocalCollection(tableName);
        localDbStore[tableName] = rows.filter(row => row.id !== id);
        if (ioInstance) ioInstance.emit('db_changed', { action: 'delete', table: tableName });
    }
};

export const initDb = async (): Promise<void> => {
    if (initDbPromise) {
        await initDbPromise;
        return;
    }

    initDbPromise = (async () => {
        try {
            const existingUsers = await queryDb('users');
            if (existingUsers.length > 0) {
                const existingShops = await queryDb('shops');
                if (existingShops.length === 0) {
                    await insertDb('shops', {
                        shop_id: 'KPK-0001',
                        name: 'Empire Kitchen — Main Branch',
                        address: '123, Food Street, City Center',
                        phone: '+91 98765 43210',
                        manager_id: '',
                        status: 'Active',
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
                { item_name: 'Pasta Arrabbiata', price: 150, category: 'Main Course', available: true },
                { item_name: 'Chicken Burger', price: 120, category: 'Starter', available: true },
                { item_name: 'Margherita Pizza', price: 200, category: 'Main Course', available: true },
                { item_name: 'Grilled Fish', price: 280, category: 'Main Course', available: true },
                { item_name: 'Paneer Tikka', price: 180, category: 'Starter', available: true },
                { item_name: 'Coca Cola', price: 50, category: 'Drink', available: true },
                { item_name: 'Mango Lassi', price: 80, category: 'Drink', available: true },
                { item_name: 'Chocolate Lava Cake', price: 120, category: 'Dessert', available: true },
                { item_name: 'Gulab Jamun', price: 60, category: 'Dessert', available: true },
                { item_name: 'Veg Biryani', price: 160, category: 'Main Course', available: true }
            ];

            for (const item of menu) await insertDb('menu', item);

            await insertDb('shops', {
                shop_id: 'KPK-0001',
                name: 'Empire Kitchen — Main Branch',
                address: '123, Food Street, City Center',
                phone: '+91 98765 43210',
                manager_id: '',
                status: 'Active',
                created_at: new Date().toISOString()
            });

            await insertDb('users', {
                custom_id: 'Admin/0001',
                username: process.env.DEFAULT_ADMIN_USERNAME || 'admin',
                password: process.env.DEFAULT_ADMIN_PASSWORD || 'admin123',
                role: 'Admin',
                full_name: 'System Administrator',
                shop_id: '',
                status: 'Active',
                created_at: new Date().toISOString()
            });

            await insertDb('users', {
                custom_id: 'Shop/0001',
                username: process.env.DEFAULT_SHOP_USERNAME || 'shop',
                password: process.env.DEFAULT_SHOP_PASSWORD || 'shop123',
                role: 'Shop',
                full_name: 'Main Branch Manager',
                shop_id: 'KPK-0001',
                status: 'Active',
                created_at: new Date().toISOString()
            });

            console.log('[DB] ✅ Seeded default sample data.');
        } catch (err) {
            console.error('[DB] Seed error (non-fatal, continuing):', err);
        }
    })();

    await initDbPromise;
};
