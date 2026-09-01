import { Request, Response } from 'express';
import { queryDb, updateDb, insertDb, deleteDb } from '../config/db';

// ─── getAdminData ─────────────────────────────────────────────────────────────
export const getAdminData = async (req: Request, res: Response) => {
    try {
        const [users, orders, attendance, menu, shops] = await Promise.all([
            queryDb('users'), queryDb('orders'), queryDb('attendance'),
            queryDb('menu'), queryDb('shops'),
        ]);
        orders.sort((a,b) => (b.created_at||'').localeCompare(a.created_at||''));
        attendance.sort((a,b) => (b.login_time||'').localeCompare(a.login_time||''));
        const usersMap: Record<string,any> = {};
        users.forEach(u => (usersMap[u.id] = u));
        const mappedAtt = attendance.map(a => ({
            ...a, full_name: usersMap[a.user_id]?.full_name||'Unknown', role: usersMap[a.user_id]?.role||'Unknown',
        }));
        res.json({ users, orders, attendance: mappedAtt, menu, shops });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
};

// ─── adminAction ──────────────────────────────────────────────────────────────
export const adminAction = async (req: Request, res: Response) => {
    const { action, id: oid, remark, name, price, category } = req.body;
    try {
        if (action === 'Approve') {
            await updateDb('users', oid, { status: 'Active', admin_remark: remark||'' });
        } else if (action === 'RejectUser') {
            await updateDb('users', oid, { status: 'Rejected', admin_remark: req.body.reason||'Rejected by Admin' });
        } else if (action === 'TempBlock') {
            const hours = Number(req.body.hours) || 24;
            const until = new Date(Date.now() + hours * 3600000).toISOString();
            await updateDb('users', oid, { status: 'TempBlocked', admin_remark: req.body.reason||'', temp_block_until: until });
        } else if (action === 'Block') {
            await updateDb('users', oid, { status: 'Blocked', admin_remark: req.body.reason||'Blocked by Admin' });
        } else if (action === 'DeleteUser') {
            await deleteDb('users', oid);
        } else if (action === 'UpdateAttendanceRemark') {
            await updateDb('attendance', oid, { remark });
        } else if (action === 'UpdateRemark') {
            await updateDb('users', oid, { admin_remark: remark||'' });
        } else if (action === 'AddItem') {
            await insertDb('menu', { item_name: name, price: Number(price), category, available: true });
        } else if (action === 'EditItem') {
            await updateDb('menu', oid, { item_name: name, price: Number(price), category });
        } else if (action === 'DeleteItem') {
            await deleteDb('menu', oid);
        } else if (action === 'UpdateFullProfile') {
            const { username, password, mobile, email, address, admin_remark, shop_id, status } = req.body;
            await updateDb('users', oid, { username, password, mobile, email, address, admin_remark, shop_id, status });
        } else if (action === 'UpdateUserDetails') {
            const { full_name, mobile, shop_id, role, status } = req.body;
            await updateDb('users', oid, { full_name, mobile, shop_id, role, status });
        } else if (action === 'CreateStaff') {
            const { username, password, role, fullname, shop_id, address, mobile, email, remark } = req.body;
            const existingUsers = await queryDb('users');
            if (existingUsers.some((u:any) => u.username === username)) {
                return res.json({ success: false, error: 'Username already exists' });
            }
            const roleUsers = existingUsers.filter((u:any) => (u.role||'').toLowerCase() === (role||'').toLowerCase());
            const custom_id = `${role}/${(roleUsers.length+1).toString().padStart(4,'0')}`;
            await insertDb('users', {
                custom_id, username, password, role,
                full_name: fullname, shop_id: (shop_id||'').toUpperCase(),
                address: address||'', mobile: mobile||'', email: email||'', 
                shop_remark: remark||'',
                status: 'Active', created_at: new Date().toISOString()
            });
        } else if (action === 'CreateShop') {
            // Creates shop + manager account in one action
            const { shop_id, shop_name, shop_location, shop_phone,
                    mgr_name, mgr_username, mgr_password, mgr_mobile, mgr_remark } = req.body;
            const cleanId = (shop_id||'').trim().toUpperCase();
            if (!cleanId || !shop_name) return res.json({ success: false, error: 'Shop ID and name are required.' });
            const existing = await queryDb('shops', { shop_id: cleanId });
            if (existing.length > 0) return res.json({ success: false, error: `Shop ID '${cleanId}' already exists.` });
            // Create shop
            await insertDb('shops', {
                shop_id: cleanId, name: shop_name, address: shop_location||'',
                phone: shop_phone||'', status: 'Active', created_at: new Date().toISOString()
            });
            // Create manager user if username provided
            if (mgr_username && mgr_password) {
                const allUsers = await queryDb('users');
                const shopUsers = allUsers.filter((u:any) => (u.role||'').toLowerCase() === 'shop');
                const custom_id = `Shop/${(shopUsers.length+1).toString().padStart(4,'0')}`;
                await insertDb('users', {
                    custom_id, username: mgr_username, password: mgr_password, role: 'Shop',
                    full_name: mgr_name||mgr_username, mobile: mgr_mobile||'',
                    shop_id: cleanId, status: 'Active',
                    admin_remark: mgr_remark||'', created_at: new Date().toISOString()
                });
            }
        } else if (action === 'UpdateShop') {
            const { name, address, phone } = req.body;
            await updateDb('shops', oid, { name, address, phone });
        } else if (action === 'UpdateShopStatus') {
            const { status } = req.body;
            await updateDb('shops', oid, { status });
        } else if (action === 'DeleteShop') {
            await deleteDb('shops', oid);
        } else if (action === 'UpdateOrder') {
            const { table_number, total_amount, status, items } = req.body;
            await updateDb('orders', oid, { table_number, total_amount, status, items });
        } else if (action === 'ChangeRole') {
            const { role } = req.body;
            if (!role) return res.json({ success: false, error: 'Role is required.' });
            const allUsers = await queryDb('users');
            const roleUsers = allUsers.filter((u:any) => (u.role||'').toLowerCase() === role.toLowerCase());
            const newCustomId = `${role}/${(roleUsers.length + 1).toString().padStart(4, '0')}`;
            await updateDb('users', oid, { role, custom_id: newCustomId });
        }
        res.json({ success: true });
    } catch (e: any) {
        console.error('[Admin Action Error]', e);
        res.json({ success: false, error: e.message });
    }
};

// ─── placeOrder ───────────────────────────────────────────────────────────────
export const placeOrder = async (req: Request, res: Response) => {
    const { table, items, total } = req.body;
    const workerId = req.session?.userId;
    const shopId = (req.session?.role === 'Admin' && req.session?.admin_shop_id) ? req.session.admin_shop_id : (req.session?.shopId || '');
    try {
        await insertDb('orders', {
            table_number: table, items: JSON.stringify(items),
            total_amount: total, worker_id: workerId,
            shop_id: shopId, status: 'New',
            created_at: new Date().toISOString()
        });
        const tables = await queryDb('dining_tables', { table_no: table });
        if (tables.length > 0) await updateDb('dining_tables', tables[0].id, { status: 'Reserved' });
        res.json({ status: 'success' });
    } catch (e) { res.status(500).json({ error: 'Server error' }); }
};

// ─── getCookOrders ────────────────────────────────────────────────────────────
export const getCookOrders = async (req: Request, res: Response) => {
    try {
        const orders = await queryDb('orders');
        // Cook sees orders in Cooking stage (approved by shop) and Processing stage
        const active = orders.filter(o => ['Cooking', 'Processing'].includes(o.status));
        res.json(active);
    } catch (e) { res.status(500).json({ error: 'Server error' }); }
};

// ─── getTables ────────────────────────────────────────────────────────────────
export const getTables = async (req: Request, res: Response) => {
    try { res.json(await queryDb('dining_tables')); }
    catch (e) { res.status(500).json({ error: 'Server error' }); }
};

// ─── cleanTable ──────────────────────────────────────────────────────────────
export const cleanTable = async (req: Request, res: Response) => {
    const { id, status } = req.body;
    try {
        const tables = await queryDb('dining_tables', { table_no: id });
        if (tables.length > 0) await updateDb('dining_tables', tables[0].id, { status });
        res.json({ status: 'ok' });
    } catch (e) { res.status(500).json({ error: 'Server error' }); }
};

// ─── shopAction ──────────────────────────────────────────────────────────────
export const shopAction = async (req: Request, res: Response) => {
    const { action, id: oid, remark, name, price, category } = req.body;
    const managerShopId = (req.session?.role === 'Admin' && req.session?.admin_shop_id) ? req.session.admin_shop_id : (req.session?.shopId || '');
    try {
        if (action === 'verify_forward') {
            await updateDb('users', oid, { status: 'Pending', shop_remark: remark||'Verified by Shop' });
        } else if (action === 'reject_user') {
            await updateDb('users', oid, { status: 'Rejected', admin_remark: remark||'Rejected by Shop' });
        } else if (action === 'add_item') {
            await insertDb('menu', { item_name: name, price: Number(price), category, available: true, shop_id: managerShopId });
        } else if (action === 'edit_item') {
            await updateDb('menu', oid, { item_name: name, price: Number(price), category });
        } else if (action === 'approve_order') {
            // Shop approves → goes to Cook
            await updateDb('orders', oid, { status: 'Cooking' });
        } else if (action === 'revert_order') {
            // Shop sends back to Worker with reason
            await updateDb('orders', oid, { status: 'Reverted', revert_reason: remark||'Changes needed' });
        } else if (action === 'generate_bill') {
            // Shop generates bill with payment mode
            const { payment_mode } = req.body;
            await updateDb('orders', oid, {
                status: 'Billed', payment_mode: payment_mode||'Cash',
                billed_at: new Date().toISOString()
            });
            // Free the table
            const orders = await queryDb('orders', { id: oid });
            const ord = orders[0];
            if (ord?.table_number) {
                const tables = await queryDb('dining_tables', { table_no: ord.table_number });
                if (tables.length > 0) await updateDb('dining_tables', tables[0].id, { status: 'Dirty' });
            }
        } else if (action === 'cook') {
            await updateDb('orders', oid, { status: 'Cooking' });
        } else if (action === 'bill') {
            await updateDb('orders', oid, { status: 'Billed', billed_at: new Date().toISOString() });
        } else if (action === 'delete_item') {
            await deleteDb('menu', oid);
        } else if (action === 'update_credentials') {
            const { username, password } = req.body;
            await updateDb('users', oid, { username, password });
        } else if (action === 'create_staff') {
            const { username, password, role, fullname, address, mobile, email, remark } = req.body;
            if (!username || !password || !role || !fullname) return res.redirect('/shop?error=missing_fields');
            const existingUsers = await queryDb('users');
            if (existingUsers.some((u:any) => u.username === username)) return res.redirect('/shop?error=username_exists');
            const roleUsers = existingUsers.filter((u:any) => (u.role||'').toLowerCase() === (role||'').toLowerCase());
            const custom_id = `${role}/${(roleUsers.length+1).toString().padStart(4,'0')}`;
            await insertDb('users', {
                custom_id, username, password, role,
                full_name: fullname, shop_id: managerShopId,
                address: address||'', mobile: mobile||'', email: email||'', 
                shop_remark: remark||'',
                status: 'Pending', created_at: new Date().toISOString()
            });
        }
        res.redirect('/shop');
    } catch (e: any) {
        console.error('[ShopAction Error]', e);
        res.status(500).redirect('/shop?error=server_error');
    }
};

// ─── shopActionAPI — JSON API version for AJAX calls ─────────────────────────
export const shopActionAPI = async (req: Request, res: Response) => {
    const { action, id: oid, payment_mode, remark } = req.body;
    try {
        if (action === 'approve_order') {
            await updateDb('orders', oid, { status: 'Cooking' });
        } else if (action === 'revert_order') {
            await updateDb('orders', oid, { status: 'Reverted', revert_reason: remark||'Changes needed' });
        } else if (action === 'generate_bill') {
            await updateDb('orders', oid, { status: 'Billed', payment_mode: payment_mode||'Cash', billed_at: new Date().toISOString() });
            const orders = await queryDb('orders');
            const ord = orders.find((o:any) => o.id === oid);
            if (ord?.table_number) {
                const tables = await queryDb('dining_tables', { table_no: ord.table_number });
                if (tables.length > 0) await updateDb('dining_tables', tables[0].id, { status: 'Clean' });
            }
        } else if (action === 'edit_item') {
            const { name, price, category } = req.body;
            await updateDb('menu', oid, { item_name: name, price: Number(price), category });
        } else if (action === 'block_user') {
            await updateDb('users', oid, { status: 'Blocked', shop_remark: remark || 'Blocked by Shop Manager' });
        }
        res.json({ success: true });
    } catch (e: any) {
        res.json({ success: false, error: e.message });
    }
};

// ─── viewBill ─────────────────────────────────────────────────────────────────
export const viewBill = async (req: Request, res: Response) => {
    try {
        const orderId = req.params.id;
        const orders  = await queryDb('orders');
        const order   = orders.find((o:any) => o.id === orderId);
        if (!order) {
            return res.status(404).send(`
                <html><body style="background:#0f172a;color:#f8fafc;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;">
                    <div style="text-align:center;"><h2>Not Found</h2><p>Order not found.</p></div>
                </body></html>
            `);
        }
        let orderItems: any[] = [];
        try { orderItems = JSON.parse(order.items); } catch {}
        const shopId = order.shop_id || '';
        const shops  = shopId ? await queryDb('shops', { shop_id: shopId }) : [];
        const shop   = shops[0] || { name: 'Empire Restaurant', address: '123 Food Street', phone: '+91 98765 43210' };
        res.render('bill_template', {
            order: { ...order, order_items: orderItems, table_no: order.table_number, total_price: order.total_amount },
            shop, date: order.created_at
        });
    } catch (e: any) {
        res.status(500).send(`
            <html><body style="background:#0f172a;color:#f8fafc;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;">
                <div style="text-align:center;"><h2>Error</h2><p>Could not load bill.</p></div>
            </body></html>
        `);
    }
};
