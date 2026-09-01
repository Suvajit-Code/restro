import { Request, Response } from 'express';
import { queryDb, insertDb, updateDb } from '../config/db';

// ─── Home Redirect ─────────────────────────────────────────────────────────────
export const home = (req: Request, res: Response) => {
    if (req.session && req.session.userId) {
        const role = (req.session.role || '').toLowerCase();
        const roleMap: Record<string, string> = {
            admin:   '/admin',
            shop:    '/shop',
            worker:  '/worker_ui',
            cook:    '/cook_ui',
            cleaner: '/cleaner_ui',
        };
        return res.redirect(roleMap[role] || '/worker_ui');
    }
    return res.redirect('/login');
};

// ─── Login ─────────────────────────────────────────────────────────────────────
export const login = async (req: Request, res: Response) => {
    const username = (req.body.username || '').trim();
    const password = (req.body.password || '').trim();
    const roleReq  = (req.body.login_role || '').trim();
    const shopIdIn = (req.body.shop_id || '').trim().toUpperCase();

    try {
        const rows = await queryDb('users', { username });
        const user = rows[0];

        if (!user) {
            req.flash('messages', { category: 'danger', text: `Username '${username}' not found.` } as any);
            return res.redirect('/login');
        }

        if (user.password !== password) {
            req.flash('messages', { category: 'danger', text: 'Incorrect Password.' } as any);
            return res.redirect('/login');
        }

        // Role-specific access guard
        if (['shop', 'admin'].includes(roleReq.toLowerCase())) {
            if (user.role.toLowerCase() !== roleReq.toLowerCase()) {
                req.flash('messages', { category: 'danger', text: `Access Denied. You are not a registered ${roleReq}.` } as any);
                return res.redirect('/login');
            }
        } else {
            // Staff path: block shop/admin from using the staff login form
            if (['shop', 'admin'].includes(user.role.toLowerCase())) {
                req.flash('messages', { category: 'danger', text: 'Please use the dedicated Shop/Admin buttons below.' } as any);
                return res.redirect('/login');
            }
        }

        // ── Shop ID validation for staff (non-shop, non-admin) ─────────────────
        if (!['shop', 'admin'].includes(user.role.toLowerCase())) {
            if (!shopIdIn) {
                req.flash('messages', { category: 'danger', text: 'Staff must enter their Shop ID to login.' } as any);
                return res.redirect('/login');
            }
            const shops = await queryDb('shops', { shop_id: shopIdIn });
            if (shops.length === 0) {
                req.flash('messages', { category: 'danger', text: `Shop ID '${shopIdIn}' not found. Contact your Admin.` } as any);
                return res.redirect('/login');
            }
            if (user.shop_id && user.shop_id.toUpperCase() !== shopIdIn) {
                req.flash('messages', { category: 'danger', text: `You are not registered under Shop '${shopIdIn}'.` } as any);
                return res.redirect('/login');
            }
            if (!user.shop_id) {
                await updateDb('users', user.id, { shop_id: shopIdIn });
            }
        }

        // Status check
        if (user.status !== 'Active' && user.role.toLowerCase() !== 'admin') {
            req.flash('messages', { category: 'danger', text: `Account ${user.status}! Please wait for Admin approval.` } as any);
            return res.redirect('/login');
        }

        // ── Set session ────────────────────────────────────────────────────────
        req.session.userId       = user.id;
        req.session.role         = user.role;
        req.session.name         = user.full_name || user.username;
        req.session.shopId       = user.shop_id || shopIdIn || '';
        req.session.profile_pic  = user.profile_pic || 'default.jpg';
        req.session.mobile       = user.mobile || 'N/A';
        req.session.email        = user.email || 'N/A';
        req.session.address      = user.address || 'N/A';
        req.session.custom_id    = user.custom_id || '';

        const attId = await insertDb('attendance', {
            user_id:    user.id,
            login_time: new Date().toISOString()
        });
        req.session.attendanceId = attId;

        return res.redirect('/');
    } catch (e: any) {
        console.error('[Login Error]', e);
        req.flash('messages', { category: 'danger', text: 'Database Error. Please try again.' } as any);
        return res.redirect('/login');
    }
};

// ─── Logout ────────────────────────────────────────────────────────────────────
export const logout = async (req: Request, res: Response) => {
    if (req.session && req.session.attendanceId) {
        try {
            await updateDb('attendance', req.session.attendanceId as string, {
                logout_time: new Date().toISOString()
            });
        } catch (e) { console.error('[Logout Error]', e); }
    }
    req.session = null;
    res.clearCookie('session');
    res.clearCookie('session.sig');
    res.redirect('/login');
};

// ─── Register ──────────────────────────────────────────────────────────────────
export const register = async (req: Request, res: Response) => {
    try {
        const username = (req.body.username || '').trim();
        const password = (req.body.password || '').trim();
        const fullname = (req.body.fullname || '').trim();
        const mobile   = (req.body.mobile || '').trim();
        const email    = (req.body.email || '').trim();
        const address  = (req.body.address || '').trim();
        const role     = req.body.role || 'Worker';
        const shopId   = (req.body.shop_id || '').trim().toUpperCase();
        
        let profilePic = 'default.jpg';
        if (req.file && req.file.buffer) {
            const b64 = req.file.buffer.toString('base64');
            const mimeType = req.file.mimetype;
            const dataUri = `data:${mimeType};base64,${b64}`;
            profilePic = await insertDb('images', { data: dataUri, created_at: new Date().toISOString() });
        }

        if (!username || !password || !fullname || !shopId) {
            return res.json({ success: false, message: 'All fields including Shop ID are required.' });
        }

        // Validate shop exists
        const shops = await queryDb('shops', { shop_id: shopId });
        if (shops.length === 0) {
            return res.json({ success: false, message: `Shop ID '${shopId}' does not exist. Ask your Admin for a valid Shop ID.` });
        }

        const existing = await queryDb('users', { username });
        if (existing.length > 0) {
            return res.json({ success: false, message: 'Username already taken. Choose another.' });
        }

        const allUsers  = await queryDb('users');
        const roleUsers = allUsers.filter((u: any) => (u.role || '').toLowerCase() === role.toLowerCase());
        const custom_id = `${role}/${(roleUsers.length + 1).toString().padStart(4, '0')}`;

        await insertDb('users', {
            custom_id,
            username,
            password,
            role,
            full_name:   fullname,
            mobile,
            email,
            address,
            profile_pic: profilePic,
            shop_id:     shopId,
            status:      'PendingShop', // Added this so it routes to Shop Manager first!
            created_at:  new Date().toISOString()
        });

        return res.json({ success: true });
    } catch (e: any) {
        return res.json({ success: false, message: e.message });
    }
};
