import { Router, Request, Response } from 'express';
import {
    getAdminData, adminAction, cleanTable, getTables,
    getCookOrders, placeOrder, shopAction, shopActionAPI, viewBill
} from '../controllers/adminController';
import { queryDb, updateDb } from '../config/db';

const router = Router();

const isLoggedIn    = (req:any,res:any,next:any) => { if(!req.session?.userId) return res.status(401).json({error:'Not logged in'}); next(); };
const isAdmin       = (req:any,res:any,next:any) => { if((req.session?.role||'').toLowerCase() !== 'admin') return res.status(403).json({error:'Unauthorized'}); next(); };
const isShopOrAdmin = (req:any,res:any,next:any) => { if(!['admin','shop'].includes((req.session?.role||'').toLowerCase())) return res.status(403).json({error:'Unauthorized'}); next(); };

// ─── Admin ───────────────────────────────────────────────────────────────────
router.get('/admin/data',    isAdmin, getAdminData);
router.post('/admin/action', isAdmin, adminAction);

// ─── Shops list ──────────────────────────────────────────────────────────────
router.get('/shops', isAdmin, async (req:Request, res:Response) => {
    try { res.json(await queryDb('shops')); }
    catch (e:any) { res.status(500).json({ error: e.message }); }
});

// ─── Shop actions (form-based) ────────────────────────────────────────────────
router.post('/shop/action',  isShopOrAdmin, shopAction);

// ─── Shop actions (AJAX/JSON) ─────────────────────────────────────────────────
router.post('/shop/action/api', isShopOrAdmin, shopActionAPI);

// ─── Shop details API (filtered by session shopId) ───────────────────────────
router.get('/shop/details', isShopOrAdmin, async (req:Request, res:Response) => {
    try {
        const shopId = (req.session?.role === 'Admin' && req.session?.admin_shop_id) ? req.session.admin_shop_id : (req.session?.shopId || '');
        const [shops, users, orders] = await Promise.all([
            shopId ? queryDb('shops', { shop_id: shopId }) : [],
            queryDb('users'), queryDb('orders'),
        ]);
        const shop  = shops[0] || null;
        const staff = users.filter((u:any) =>
            (u.shop_id||'').toUpperCase() === shopId.toUpperCase() &&
            !['admin','shop'].includes((u.role||'').toLowerCase())
        );
        const shopOrders = shopId ? orders.filter((o:any) => (o.shop_id||'') === shopId) : orders;
        res.json({ shop, staff, orders: shopOrders });
    } catch (e:any) { res.status(500).json({ error: e.message }); }
});

// ─── Cook orders ──────────────────────────────────────────────────────────────
router.get('/cook/orders', isLoggedIn, getCookOrders);

// ─── Cook update ──────────────────────────────────────────────────────────────
router.post('/cook/update', isLoggedIn, async (req:Request, res:Response) => {
    try {
        const { id, status } = req.body;
        if (!id || !status) return res.json({ success: false, error: 'Missing id or status' });
        await updateDb('orders', id, { status });
        res.json({ success: true });
    } catch (e:any) { res.status(500).json({ success: false, error: e.message }); }
});

// ─── Menu ────────────────────────────────────────────────────────────────────
router.get('/menu', isLoggedIn, async (req:Request, res:Response) => {
    try { 
        const shopId = (req.session?.role === 'Admin' && req.session?.admin_shop_id) ? req.session.admin_shop_id : req.session?.shopId;
        const allMenu = await queryDb('menu');
        // Filter: global items (no shop_id or 'GLOBAL') or matches user's shop_id
        const filteredMenu = allMenu.filter((m:any) => !m.shop_id || m.shop_id === 'GLOBAL' || m.shop_id === shopId);
        res.json(filteredMenu); 
    }
    catch (e:any) { res.status(500).json({ error: e.message }); }
});

// ─── Tables & Orders ─────────────────────────────────────────────────────────
router.get('/tables',       isLoggedIn, getTables);
router.post('/clean_table', isLoggedIn, cleanTable);
router.post('/place_order', isLoggedIn, placeOrder);

// ─── Worker resubmit order (reverted → New) ───────────────────────────────────
router.post('/order/resubmit', isLoggedIn, async (req:Request, res:Response) => {
    try {
        const { id, items, total_amount, table_number } = req.body;
        
        const updateData: any = { status: 'New', revert_reason: '' };
        if (items) updateData.items = typeof items === 'string' ? items : JSON.stringify(items);
        if (total_amount !== undefined) updateData.total_amount = total_amount;
        if (table_number) updateData.table_number = table_number;
        
        await updateDb('orders', id, updateData);
        res.json({ success: true });
    } catch (e:any) { res.json({ success: false, error: e.message }); }
});

// ─── Worker history ──────────────────────────────────────────────────────────
router.get('/worker/history', isLoggedIn, async (req:Request, res:Response) => {
    try {
        const workerId = req.session?.userId;
        const orders = await queryDb('orders', { worker_id: workerId });
        orders.sort((a,b) => (b.created_at||'').localeCompare(a.created_at||''));
        res.json(orders.slice(0,50));
    } catch (e:any) { res.status(500).json({ error: e.message }); }
});

// ─── Worker attendance ───────────────────────────────────────────────────────
router.get('/worker/attendance', isLoggedIn, async (req:Request, res:Response) => {
    try {
        const workerId = req.session?.userId;
        const att = await queryDb('attendance', { user_id: workerId });
        att.sort((a,b) => (b.login_time||'').localeCompare(a.login_time||''));
        res.json(att.slice(0,30));
    } catch (e:any) { res.status(500).json({ error: e.message }); }
});

// ─── Attendance remark update ─────────────────────────────────────────────────
router.post('/attendance/update', isLoggedIn, async (req:Request, res:Response) => {
    try {
        const attId = req.session?.attendanceId as string;
        const { remark } = req.body;
        if (!attId) return res.json({ status: 'error', message: 'No active attendance session' });
        await updateDb('attendance', attId, { remark });
        res.json({ status: 'success' });
    } catch (e:any) { res.status(500).json({ status: 'error', message: e.message }); }
});

export default router;
