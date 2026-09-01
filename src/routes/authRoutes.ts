import { Router } from 'express';
import { login, logout, register, home } from '../controllers/authController';
import { viewBill } from '../controllers/adminController';
import { queryDb } from '../config/db';
import multer from 'multer';

const router = Router();
import path from 'path';
const storage = multer.memoryStorage();
const upload = multer({ storage });

router.get('/', home);
router.get('/login',    (req, res) => res.render('login', { messages: req.flash('messages') || [] }));
router.post('/login',   login);
router.get('/logout',   logout);
router.get('/register', (req, res) => res.render('register'));
router.post('/api/register', upload.single('profile_pic'), register);

// ─── Profile Picture Update ───────────────────────────────────────────────────
router.post('/api/update_profile_pic', upload.single('profile_pic'), async (req, res) => {
    if (!req.session?.userId) return res.json({ success: false, message: 'Not logged in' });
    if (!req.file) return res.json({ success: false, message: 'No file uploaded' });
    
    try {
        const { updateDb, insertDb } = await import('../config/db');
        const targetUserId = req.body.target_user_id;

        // Convert buffer to base64
        const b64 = req.file.buffer.toString('base64');
        const mimeType = req.file.mimetype;
        const dataUri = `data:${mimeType};base64,${b64}`;

        // Save to Firebase images collection
        const imgId = await insertDb('images', { data: dataUri, created_at: new Date().toISOString() });

        if (targetUserId) {
            // Admin updating someone else
            if (req.session.role !== 'Admin') {
                return res.json({ success: false, message: 'Only Admins can change other profiles.' });
            }
            await updateDb('users', targetUserId, { profile_pic: imgId });
        } else {
            // User updating themselves
            await updateDb('users', req.session.userId, { profile_pic: imgId });
            req.session.profile_pic = imgId;
        }
        
        res.json({ success: true, filename: imgId });
    } catch (e: any) {
        res.json({ success: false, message: e.message });
    }
});

// ─── Bill View ────────────────────────────────────────────────────────────────
router.get('/view_bill/:id', viewBill);

// ─── Role Guard ───────────────────────────────────────────────────────────────
const checkRole = (roles: string[]) => (req: any, res: any, next: any) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    if (!req.session?.userId) {
        req.flash('messages', { category: 'danger', text: 'Session expired or invalid! Please login again.' } as any);
        return res.redirect('/login');
    }
    if (!roles.includes(req.session.role?.toLowerCase() || '')) return res.redirect('/');
    next();
};

// ─── Admin Panel ──────────────────────────────────────────────────────────────
router.get('/admin', checkRole(['admin']), (req, res) => res.render('admin_panel'));

// ─── Shop Panel ───────────────────────────────────────────────────────────────
router.get('/shop', checkRole(['shop', 'admin']), async (req, res) => {
    try {
        if (req.session?.role === 'Admin' && req.query.shop_id) req.session.admin_shop_id = req.query.shop_id;
        const shopId  = (req.session?.role === 'Admin' && req.session.admin_shop_id) 
            ? req.session.admin_shop_id 
            : (req.session?.shopId || '');
        const users   = await queryDb('users');

        // Filter operational staff for this shop
        const shopStaff = users.filter((u: any) => {
            const role = (u.role || '').toLowerCase();
            if (role === 'admin' || role === 'shop') return false;
            if (shopId) return (u.shop_id || '').toUpperCase() === shopId.toUpperCase();
            return true; // admin sees all
        });

        const activeStaff  = shopStaff.filter((u: any) => u.status === 'Active');
        const pendingStaff = shopStaff.filter((u: any) => u.status === 'PendingShop');

        const menu   = await queryDb('menu');
        const orders = await queryDb('orders');
        const attendance = await queryDb('attendance');

        // Filter orders by shop
        const shopOrders = shopId
            ? orders.filter((o: any) => (o.shop_id || '') === shopId)
            : orders;
            
        // Get shop details
        const shops   = shopId ? await queryDb('shops', { shop_id: shopId }) : [];
        const shopInfo = shops[0] || null;

        let errorMsg = '';
        if (req.query.error === 'username_exists')  errorMsg = '⚠️ Username already exists! Choose a different one.';
        else if (req.query.error === 'missing_fields') errorMsg = '⚠️ Please fill all required fields.';
        else if (req.query.error === 'server_error')   errorMsg = '⚠️ A server error occurred. Please try again.';

        res.render('shop_panel', {
            staff: activeStaff,
            pending_staff: pendingStaff,
            menu,
            orders: shopOrders,
            shopInfo,
            shopId,
            errorMsg,
            attendance
        });
    } catch (error) {
        res.status(500).send(`
            <html><body style="background:#0f172a;color:#f8fafc;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;">
                <div style="text-align:center;"><h2>Database Error</h2><p>Could not load shop dashboard.</p><a href="/" style="color:#38bdf8;">Go Home</a></div>
            </body></html>
        `);
    }
});

// ─── Worker / Cook / Cleaner Panels ──────────────────────────────────────────
router.get('/worker_ui', checkRole(['worker', 'cook', 'cleaner', 'admin', 'shop']), (req, res) => {
    if (req.session?.role === 'Admin' && req.query.shop_id) req.session.admin_shop_id = req.query.shop_id;
    res.render('worker_panel');
});

router.get('/cook_ui', checkRole(['cook', 'admin', 'shop']), async (req, res) => {
    try {
        if (req.session?.role === 'Admin' && req.query.shop_id) req.session.admin_shop_id = req.query.shop_id;
        const orders = await queryDb('orders');
        const active = orders.filter((o: any) => o.status === 'New');
        res.render('cook_panel', { orders: active });
    } catch (error) {
        res.status(500).send(`
            <html><body style="background:#0f172a;color:#f8fafc;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;">
                <div style="text-align:center;"><h2>Database Error</h2><p>Could not load cook panel.</p><a href="/" style="color:#38bdf8;">Go Home</a></div>
            </body></html>
        `);
    }
});

router.get('/cleaner_ui', checkRole(['cleaner', 'admin', 'shop']), (req, res) => {
    if (req.session?.role === 'Admin' && req.query.shop_id) req.session.admin_shop_id = req.query.shop_id;
    res.render('cleaner_panel');
});

export default router;
