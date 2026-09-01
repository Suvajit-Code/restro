async function loadData() {
    try {
        const response = await fetch('/api/admin/data');
        const data = await response.json();

        // 1. USERS
        const userList = document.getElementById('user-list');
        if (userList) {
            window.usersMap = {};
            window.allUsers = data.users;
            if (data.users.length === 0) {
                userList.innerHTML = '<tr><td colspan="7" class="text-center text-muted p-3">No users found.</td></tr>';
            } else {
                let usersHtml = '';
                data.users.forEach(u => {
                    window.usersMap[u.id] = u;
                    const cId = u.custom_id || '#' + u.id.substring(0, 6);
                    const pic = u.profile_pic || 'default.jpg';
                    const name = u.full_name || u.username;
                    const statusBadge = u.status === 'Verified' ? 'info' : (u.status === 'Active' ? 'success' : (u.status === 'Blocked' ? 'danger' : 'secondary'));
                    const shopBadge = u.shop_id || '—';
                    const sRem = u.shop_remark && (u.status === 'Blocked' || u.status === 'Pending') 
                        ? `<div class="small ${u.status === 'Blocked' ? 'text-danger' : 'text-warning'} mt-1"><i class="fas ${u.status === 'Blocked' ? 'fa-exclamation-triangle' : 'fa-info-circle'}"></i> Shop: ${u.shop_remark}</div>` 
                        : '';

                    const roleRoutes = { worker: '/worker_ui', cook: '/cook_ui', cleaner: '/cleaner_ui', shop: '/shop', admin: '/admin' };
                    const dashLink = (roleRoutes[u.role.toLowerCase()] || '#') + '?shop_id=' + (u.shop_id || '');
                    
                    usersHtml += `
                        <tr>
                            <td><span class="badge bg-dark border border-secondary fw-bold text-warning">${cId}</span></td>
                            <td><img src="/static/uploads/${pic}" onclick="openImageModal(this.src)" style="width:38px;height:38px;border-radius:50%;object-fit:cover;border:2px solid #555;cursor:pointer;" title="Click to view full image"></td>
                            <td>
                                <div class="fw-bold text-white mb-1">${name}</div>
                                <div class="small text-secondary">@${u.username}</div>
                            </td>
                            <td><span class="badge bg-info">${shopBadge}</span></td>
                            <td>
                                <span class="badge bg-secondary mb-1">${u.role}</span><br>
                                <span class="badge bg-${statusBadge}">${u.status}</span>
                                ${sRem}
                            </td>
                            <td><div class="small text-light">${u.admin_remark || '<span class="text-secondary">N/A</span>'}</div></td>
                            <td>
                                <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:4px;min-width:180px;">
                                    <button onclick="openAdminViewModal('${u.id}')" class="btn btn-glass-3d primary p-0" title="View & Edit" style="font-size:10px;font-weight:700;line-height:1.2;height:24px;"><i class="fas fa-id-card me-1"></i>VIEW</button>
                                    <button onclick="openChangeRole('${u.id}', '${u.role}')" class="btn btn-glass-3d info p-0" title="Change Role" style="font-size:10px;font-weight:700;line-height:1.2;height:24px;"><i class="fas fa-user-tag me-1"></i>ROLE</button>
                                    ${['Verified','Blocked','Pending','PendingShop','TempBlocked','Rejected'].includes(u.status)
                                        ? `<button onclick="act('Approve','${u.id}')" class="btn btn-glass-3d success p-0" style="font-size:10px;font-weight:700;line-height:1.2;height:24px;"><i class="fas fa-check-circle me-1"></i>OK</button>`
                                        : `<button onclick="act('Block','${u.id}')" class="btn btn-glass-3d secondary p-0" style="font-size:10px;font-weight:700;line-height:1.2;height:24px;"><i class="fas fa-ban me-1"></i>BLOCK</button>`}
                                    <button onclick="openReject('${u.id}')" class="btn btn-glass-3d warning p-0" style="font-size:10px;font-weight:700;line-height:1.2;height:24px;"><i class="fas fa-times-circle me-1"></i>REJECT</button>
                                    <button onclick="openTempBlock('${u.id}')" class="btn btn-glass-3d secondary p-0" style="font-size:10px;font-weight:700;line-height:1.2;height:24px;"><i class="fas fa-clock me-1"></i>T-BLK</button>
                                    <button onclick="act('DeleteUser','${u.id}')" class="btn btn-glass-3d danger p-0" style="font-size:10px;font-weight:700;line-height:1.2;height:24px;"><i class="fas fa-trash-alt me-1"></i>DEL</button>
                                </div>
                            </td>
                        </tr>`;
                });
                userList.innerHTML = usersHtml;
            }
        }

        // 2. SHOPS
        const shopsList = document.getElementById('shops-list');
        if (data.shops && shopsList) {
            window.shopsMap = {};
            shopsList.innerHTML = data.shops.length === 0
                ? '<tr><td colspan="7" class="text-center text-muted p-3">No shops yet. Create one above.</td></tr>'
                : data.shops.map(s => {
                    window.shopsMap[s.id] = s;
                    return `
                    <tr>
                        <td><span class="badge bg-info fs-6 fw-bold">${s.shop_id}</span></td>
                        <td class="fw-bold text-white">${s.name}</td>
                        <td class="small text-secondary">${s.address || '—'}</td>
                        <td class="small">${s.phone || '—'}</td>
                        <td><span class="badge bg-${s.status === 'Active' ? 'success' : s.status === 'TempClosed' ? 'warning' : 'secondary'}">${s.status || 'Active'}</span></td>
                        <td class="small text-secondary">${s.created_at ? new Date(s.created_at).toLocaleDateString() : '-'}</td>
                        <td><button onclick="viewShop('${s.id}')" class="btn btn-outline-info btn-sm"><i class="fas fa-eye me-1"></i> View</button></td>
                    </tr>`;
                }).join('');
        }

        // 3. SHOP CONTROL
        const liveEl = document.getElementById('live-orders-list');
        const billEl = document.getElementById('bill-list');
        if (liveEl) {
            const liveOrders = data.orders.filter(o => o.status !== 'Billed');
            liveEl.innerHTML = liveOrders.length > 0
                ? liveOrders.map(o => `<tr><td class="fw-bold text-warning">T-${o.table_number}</td><td>#${o.id.substring(0, 6)}</td><td><span class="badge bg-info">${o.shop_id || '—'}</span></td><td><span class="badge bg-secondary">${o.status}</span>${o.revert_reason && o.status === 'Reverted' ? `<br><small class="text-danger" style="font-size:0.65rem;"><i class="fas fa-info-circle"></i> ${o.revert_reason}</small>` : ''}</td></tr>`).join('')
                : '<tr><td colspan="4" class="text-center text-muted p-3">Kitchen is Clear ✓</td></tr>';
        }
        if (billEl) {
            const bills = data.orders.filter(o => o.status === 'Billed');
            billEl.innerHTML = bills.length > 0
                ? bills.map(o => `<tr><td>#${o.id.substring(0, 6)}</td><td>T-${o.table_number}</td><td class="text-success fw-bold">₹${o.total_amount}</td><td><a href="/view_bill/${o.id}" target="_blank" class="btn btn-sm btn-outline-info"><i class="fas fa-print"></i></a></td></tr>`).join('')
                : '<tr><td colspan="4" class="text-center text-muted p-3">No Transactions</td></tr>';
        }

        // 4. ATTENDANCE
        const attEl = document.getElementById('att-list');
        if (attEl) {
            window.allAttendance = data.attendance || [];
            
            // Set current month/year if not set
            const mSel = document.getElementById('att-month');
            const ySel = document.getElementById('att-year');
            if (mSel && ySel && !window.attFilterInit) {
                const now = new Date();
                mSel.value = now.getMonth();
                ySel.value = now.getFullYear();
                window.attFilterInit = true;
            }
            if (typeof filterAttendance === 'function') filterAttendance();
        }

        // 5. MENU
        const menuCount = document.getElementById('menu-count');
        const menuList = document.getElementById('menu-list');
        if (menuCount) menuCount.innerText = data.menu.length + ' Items';
        if (menuList) {
            menuList.innerHTML = data.menu.map(m => `
                <tr>
                    <td>${m.item_name}</td>
                    <td class="text-warning fw-bold">₹${m.price}</td>
                    <td><span class="badge bg-secondary">${m.category || 'Food'}</span></td>
                    <td class="text-end">
                        <button onclick="openEditMenu('${m.id}', '${m.item_name}', '${m.price}', '${m.category}')" class="btn btn-sm btn-outline-warning border-0"><i class="fas fa-edit"></i></button>
                        <button onclick="act('DeleteItem','${m.id}')" class="btn btn-sm btn-outline-danger border-0"><i class="fas fa-trash-alt"></i></button>
                    </td>
                </tr>`).join('');
        }

        // 6. ORDERS — rich rendering
        window.allOrders = data.orders;
        renderOrderHistory(data.orders);

        // 7. SHOP MODE — Access View
        renderShopModeAccess(data.orders);

        // 8. SHOP MODE — Cook View
        renderAdminKitchen(data.orders);

    } catch (err) {
        console.error('Error loading admin data:', err);
    }
}
// Modal Actions
let rejectModal, tempBlockModal, editMenuModal;
function openReject(id) {
    document.getElementById('reject-user-id').value = id;
    if(!rejectModal) rejectModal = new bootstrap.Modal(document.getElementById('rejectModal'));
    rejectModal.show();
}
function submitReject() {
    const id = document.getElementById('reject-user-id').value;
    const reason = document.getElementById('reject-reason').value;
    act('RejectUser', id, { reason });
    rejectModal.hide();
}

function openTempBlock(id) {
    document.getElementById('temp-block-user-id').value = id;
    if(!tempBlockModal) tempBlockModal = new bootstrap.Modal(document.getElementById('tempBlockModal'));
    tempBlockModal.show();
}
function submitTempBlock() {
    const id = document.getElementById('temp-block-user-id').value;
    const hours = document.getElementById('temp-block-hours').value;
    const reason = document.getElementById('temp-block-reason').value;
    act('TempBlock', id, { hours, reason });
    tempBlockModal.hide();
}

function openEditMenu(id, name, price, category) {
    document.getElementById('edit-menu-id').value = id;
    document.getElementById('edit-menu-name').value = name;
    document.getElementById('edit-menu-price').value = price;
    document.getElementById('edit-menu-category').value = category;
    if(!editMenuModal) editMenuModal = new bootstrap.Modal(document.getElementById('editItemModal'));
    editMenuModal.show();
}

function submitEditMenu() {
    const id = document.getElementById('edit-menu-id').value;
    const name = document.getElementById('edit-menu-name').value;
    const price = document.getElementById('edit-menu-price').value;
    const category = document.getElementById('edit-menu-category').value;
    act('EditItem', id, { name, price, category });
    editMenuModal.hide();
}

let editOrderModalObj;
function openEditOrder(id, table, total, status, itemsEnc) {
    document.getElementById('edit-order-id').value = id;
    document.getElementById('edit-order-table').value = table;
    document.getElementById('edit-order-total').value = total;
    document.getElementById('edit-order-status').value = status;
    try {
        const decoded = decodeURIComponent(itemsEnc);
        document.getElementById('edit-order-items').value = decoded;
    } catch(e) {
        document.getElementById('edit-order-items').value = '[]';
    }
    
    if(!editOrderModalObj) editOrderModalObj = new bootstrap.Modal(document.getElementById('editOrderModal'));
    editOrderModalObj.show();
}

function submitEditOrder() {
    const id = document.getElementById('edit-order-id').value;
    const table_number = document.getElementById('edit-order-table').value;
    const total_amount = document.getElementById('edit-order-total').value;
    const status = document.getElementById('edit-order-status').value;
    let items = document.getElementById('edit-order-items').value;
    
    try {
        JSON.parse(items); // validate JSON
    } catch (e) {
        return showAlert('error', 'Invalid JSON', 'The items field must be valid JSON.');
    }
    
    // We can use the existing /order/resubmit endpoint that accepts table_number, total_amount, items
    // But wait, the admin endpoint /api/admin/action is safer. Let's add UpdateOrder action.
    fetch('/api/admin/action', {
        method: 'POST', headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ action: 'UpdateOrder', id, table_number, total_amount, status, items })
    }).then(r => r.json()).then(d => {
        if(d.success) {
            showToast('success', 'Order updated successfully!');
            editOrderModalObj.hide();
            loadData();
        } else {
            showAlert('error', 'Error', d.error || 'Failed to update order');
        }
    });
}


function openImageModal(src) {
    let modal = document.getElementById('globalImageModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'globalImageModal';
        modal.innerHTML = `
            <div style="position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(0,0,0,0.85); z-index:999999; display:flex; justify-content:center; align-items:center; backdrop-filter: blur(5px);" onclick="this.style.display='none'">
                <span style="position:absolute; top:20px; right:40px; color:white; font-size:50px; font-weight:bold; cursor:pointer;">&times;</span>
                <img id="globalImageModalImg" src="" style="max-width:90%; max-height:90%; border-radius:12px; box-shadow:0 15px 50px rgba(0,0,0,0.5); object-fit:contain; border:3px solid #38bdf8;" onclick="event.stopPropagation()">
            </div>
        `;
        document.body.appendChild(modal);
    }
    document.getElementById('globalImageModalImg').src = src;
    modal.style.display = 'flex';
}

function saveRemark(id) {
    const val = document.getElementById(`remark-${id}`).value;
    fetch('/api/admin/action', { method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ action:'UpdateRemark', id, remark:val })
    }).then(r=>r.json()).then(d => {
        if(d.success) { 
            const btn=document.querySelector(`#remark-${id}`).nextElementSibling; 
            btn.innerHTML='<i class="fas fa-check text-success"></i>'; 
            setTimeout(()=>{ btn.innerHTML='<i class="fas fa-check"></i>'; },2000); 
            showToast('success', 'Remark saved successfully');
        }
        else showAlert('error', 'Error', 'Error saving remark');
    });
}

// ── ATTENDANCE LOGIC ──────────────────────────────────────────────────────────
function filterAttendance() {
    const attEl = document.getElementById('att-list');
    if (!attEl || !window.allAttendance) return;
    
    const mSel = document.getElementById('att-month');
    const ySel = document.getElementById('att-year');
    const month = mSel ? parseInt(mSel.value) : new Date().getMonth();
    const year = ySel ? parseInt(ySel.value) : new Date().getFullYear();
    
    const filtered = window.allAttendance.filter(a => {
        if (!a.login_time) return false;
        const d = new Date(a.login_time);
        return d.getMonth() === month && d.getFullYear() === year;
    });
    
    // Calculate Attendance Percentage
    let presentCount = 0;
    filtered.forEach(a => {
        const rm = (a.remark || '').toLowerCase();
        if (rm.includes('full') || rm.includes('half') || rm.includes('present') || !a.remark) {
            presentCount++;
        }
    });
    
    const totalDays = new Date(year, month + 1, 0).getDate(); 
    let percent = 0;
    if (window.usersMap) {
        const staffCount = Object.values(window.usersMap).filter(u => u.status === 'Active' && u.role !== 'Admin' && u.role !== 'Shop').length;
        if (staffCount > 0) {
            const expectedRecords = totalDays * staffCount;
            percent = Math.round((presentCount / expectedRecords) * 100);
        }
    }
    const percentEl = document.getElementById('att-percent');
    if (percentEl) {
        percentEl.innerText = (percent > 100 ? 100 : percent) + '%';
        percentEl.className = `badge fs-5 ${percent > 75 ? 'bg-success' : (percent > 50 ? 'bg-warning text-dark' : 'bg-danger')}`;
    }

    const getDuration = (start, end) => {
        if (!start || !end) return '';
        const ms = new Date(end) - new Date(start);
        const hrs = Math.floor(ms / 3600000);
        const mins = Math.floor((ms % 3600000) / 60000);
        return `${hrs}h ${mins}m`;
    };
    
    attEl.innerHTML = filtered.length === 0
        ? '<tr><td colspan="4" class="text-center text-muted p-3">No attendance records for selected month.</td></tr>'
        : filtered.map(a => `
            <tr>
                <td><strong>${a.full_name || 'Unknown'}</strong><br><small class="text-muted">${a.role || '-'}</small></td>
                <td class="small">${(a.remark === 'Absent') ? '-' : (a.login_time ? new Date(a.login_time).toLocaleString() : '-')}</td>
                <td>${(a.remark === 'Absent') ? '<span class="badge bg-danger shadow-sm px-3 py-2">ABSENT</span>' : (a.logout_time ? `<span class="small">${new Date(a.logout_time).toLocaleTimeString()}</span><br><span class="badge bg-primary mt-1"><i class="fas fa-clock"></i> ${getDuration(a.login_time, a.logout_time)}</span>` : '<span class="badge bg-success shadow-sm px-3 py-2"><i class="fas fa-circle text-white me-1" style="font-size: 8px; vertical-align: middle;"></i> ONLINE</span>')}</td>
                <td>
                    <div class="input-group input-group-sm" style="width:230px;">
                        <select id="att-remark-${a.id}" class="form-select bg-dark text-white border-secondary form-select-sm">
                            <option value="Present" ${!a.remark || a.remark==='Present' ? 'selected' : ''}>Present</option>
                            <option value="Full Day" ${a.remark === 'Full Day' ? 'selected' : ''}>Full Day</option>
                            <option value="Half Day" ${a.remark === 'Half Day' ? 'selected' : ''}>Half Day</option>
                            <option value="Emergency Exit" ${a.remark === 'Emergency Exit' ? 'selected' : ''}>Emergency Exit</option>
                            <option value="Absent" ${a.remark === 'Absent' ? 'selected' : ''}>Absent</option>
                        </select>
                        <button class="btn btn-outline-info" onclick="saveAttRemark('${a.id}')" title="Save daily remark"><i class="fas fa-check"></i></button>
                        <button class="btn btn-outline-warning" onclick="openAdminViewModal('${a.user_id}')" title="View Full Month Attendance & Percentage"><i class="fas fa-calendar-alt"></i></button>
                    </div>
                </td>
            </tr>`).join('');
}

function saveAttRemark(id) {
    const val = document.getElementById(`att-remark-${id}`).value;
    fetch('/api/admin/action', { method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ action:'UpdateAttendanceRemark', id, remark:val })
    }).then(r=>r.json()).then(d => {
        if(d.success) { 
            const btn=document.querySelector(`#att-remark-${id}`).nextElementSibling; 
            btn.innerHTML='<i class="fas fa-check text-success"></i>'; 
            setTimeout(()=>{ btn.innerHTML='<i class="fas fa-save"></i>'; },2000); 
            showToast('success', 'Attendance remark saved');
        }
        else showAlert('error', 'Error', 'Error saving attendance remark');
    });
}

function addMenuItem() {
    const name=document.getElementById('new-name').value, price=document.getElementById('new-price').value, cat=document.getElementById('new-cat').value;
    if(!name||!price) return showToast('warning', 'Please fill name and price');
    fetch('/api/admin/action', { method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ action:'AddItem', name, price, category:cat })
    }).then(r=>r.json()).then(()=>{ 
        document.getElementById('new-name').value=''; 
        document.getElementById('new-price').value=''; 
        loadData(); 
        showToast('success', 'Menu Item Added!');
    });
}

function act(action, id, extra = {}) {
    Swal.fire({
        title: 'Are you sure?',
        text: `Do you want to proceed with: ${action}?`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#38bdf8',
        cancelButtonColor: '#d33',
        confirmButtonText: 'Yes, proceed',
        cancelButtonText: 'Cancel',
        reverseButtons: true,
        background: '#1e293b',
        color: '#fff'
    }).then((result) => {
        if(result.isConfirmed) {
            fetch('/api/admin/action', { method:'POST', headers:{'Content-Type':'application/json'},
                body: JSON.stringify({ action, id, ...extra })
            }).then(r=>r.json()).then(d => { 
                if(d.success) {
                    showToast('success', 'Action successful');
                    loadData(); 
                } else {
                    showAlert('error', 'Action Failed', d.error || 'Error');
                }
            });
        }
    });
}

function openAdminViewModal(id) {
    const u = window.usersMap[id];
    if(!u) return showToast('error', 'User data not found!');
    
    document.getElementById('adminView_id').value = u.id;
    document.getElementById('adminView_pic').src = '/static/uploads/' + (u.profile_pic || 'default.jpg');
    document.getElementById('adminView_name').innerText = u.full_name || u.username;
    document.getElementById('adminView_role').innerText = u.role;
    document.getElementById('adminView_custom_id').innerText = u.custom_id || ('#'+u.id.substring(0,6));
    
    document.getElementById('adminView_username').value = u.username || '';
    document.getElementById('adminView_password').value = u.password || '';
    document.getElementById('adminView_mobile').value = u.mobile || '';
    document.getElementById('adminView_email').value = u.email || '';
    document.getElementById('adminView_shop_id').value = u.shop_id || '';
    document.getElementById('adminView_status').value = u.status || 'Active';
    document.getElementById('adminView_address').value = u.address || '';
    document.getElementById('adminView_shop_remark').value = u.shop_remark || 'No remark';
    document.getElementById('adminView_admin_remark').value = u.admin_remark || '';
    
    // Build Calendar View
    if (window.allAttendance) {
        const cal = document.getElementById('adminView_calendar');
        const monthTxt = document.getElementById('adminView_calMonth');
        const percTxt = document.getElementById('adminView_calPercent');
        
        const now = new Date();
        const y = now.getFullYear(), m = now.getMonth();
        monthTxt.innerText = now.toLocaleString('default', { month: 'long', year: 'numeric' });
        
        const userAtt = window.allAttendance.filter(a => a.user_id === u.id);
        const thisMonthAtt = userAtt.filter(a => {
            if(!a.login_time) return false;
            const d = new Date(a.login_time);
            return d.getFullYear() === y && d.getMonth() === m;
        });
        
        let pCount = 0;
        let html = '';
        const totalDays = new Date(y, m+1, 0).getDate();
        
        // Render 1 to totalDays
        for(let day = 1; day <= totalDays; day++) {
            // Find record for this day
            const record = thisMonthAtt.find(a => new Date(a.login_time).getDate() === day);
            let bg = 'bg-secondary';
            let mark = 'Absent';
            let login = '-', logout = '-';
            let style = '';
            
            if(record) {
                login = new Date(record.login_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                if(record.logout_time) logout = new Date(record.logout_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                
                const rm = (record.remark || '').toLowerCase();
                if(rm.includes('half')) { bg = 'bg-warning text-dark'; mark = 'Half Day'; pCount += 0.5; }
                else if(rm.includes('emergency')) { bg = 'text-white'; mark = 'Emergency Exit'; style='background-color: #ec4899;'; }
                else if(rm.includes('absent')) { bg = 'bg-danger text-white'; mark = 'Absent'; }
                else { bg = 'bg-success text-white'; mark = 'Present'; pCount += 1; }
            } else if (day > now.getDate()) {
                bg = 'bg-dark border border-secondary text-white'; mark = '—';
            } else {
                bg = 'bg-danger text-white'; mark = 'Absent';
            }
            
            html += `
            <div class="card ${bg} text-center p-1" style="width: 80px; font-size: 0.7rem; border-radius: 8px; ${style}">
                <div class="fw-bold fs-6">${day}</div>
                <div style="font-size: 0.6rem; text-transform: uppercase;">${mark}</div>
                <div style="font-size: 0.55rem; margin-top:2px;">IN: ${login}</div>
                <div style="font-size: 0.55rem;">OUT: ${logout}</div>
            </div>`;
        }
        
        cal.innerHTML = html;
        const rate = Math.round((pCount / now.getDate()) * 100);
        percTxt.innerText = (rate > 100 ? 100 : rate) + '% Rate';
    }
    
    new bootstrap.Modal(document.getElementById('adminViewModal')).show();
}

function saveAdminView() {
    const id = document.getElementById('adminView_id').value;
    const username = document.getElementById('adminView_username').value.trim();
    const password = document.getElementById('adminView_password').value.trim();
    const mobile = document.getElementById('adminView_mobile').value.trim();
    const email = document.getElementById('adminView_email').value.trim();
    const shop_id = document.getElementById('adminView_shop_id').value.trim().toUpperCase();
    const status = document.getElementById('adminView_status').value;
    const address = document.getElementById('adminView_address').value.trim();
    const admin_remark = document.getElementById('adminView_admin_remark').value.trim();
    
    fetch('/api/admin/action', { method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ action:'UpdateFullProfile', id, username, password, mobile, email, shop_id, status, address, admin_remark })
    }).then(r=>r.json()).then(d=>{
        if(d.success) { 
            showToast('success', 'Profile Updated successfully!'); 
            bootstrap.Modal.getInstance(document.getElementById('adminViewModal')).hide();
            loadData(); 
        } else {
            showAlert('error', 'Error', d.error);
        }
    });
}

function openCreateUser(role) {
    document.getElementById('new-role').value = role;
    new bootstrap.Modal(document.getElementById('createStaffModal')).show();
}

function createStaff() {
    const fn  = document.getElementById('new-fullname').value.trim();
    const un  = document.getElementById('new-username').value.trim();
    const pw  = document.getElementById('new-password').value.trim();
    const role = document.getElementById('new-role').value;
    const shopId = (document.getElementById('new-shop-id')?.value || '').trim().toUpperCase();
    const address = document.getElementById('new-address')?.value.trim() || '';
    const mobile = document.getElementById('new-mobile')?.value.trim() || '';
    const email = document.getElementById('new-email')?.value.trim() || '';
    const remark = document.getElementById('new-remark')?.value.trim() || '';
    
    if(!fn||!un||!pw) return showToast('warning', 'Please fill Name, Username and Password!');
    fetch('/api/admin/action', { method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ action:'CreateStaff', fullname:fn, username:un, password:pw, role, shop_id:shopId, address, mobile, email, remark })
    }).then(r=>r.json()).then(d=>{
        if(d.success) {
            ['new-fullname','new-username','new-password','new-address','new-mobile','new-email','new-remark'].forEach(id => {
                if(document.getElementById(id)) document.getElementById(id).value='';
            });
            if(document.getElementById('new-shop-id')) document.getElementById('new-shop-id').value='';
            loadData(); showToast('success', 'Staff Created!');
        } else showAlert('error', 'Error', d.error||'Error creating user!');
    });
}

function createShop() {
    const shopId  = (document.getElementById('new-shop-id-create').value||'').trim().toUpperCase();
    const name    = document.getElementById('new-shop-name').value.trim();
    const address = document.getElementById('new-shop-address').value.trim();
    const phone   = document.getElementById('new-shop-phone').value.trim();
    
    // Manager Details
    const mgr_name = document.getElementById('new-mgr-name')?.value.trim();
    const mgr_mobile = document.getElementById('new-mgr-mobile')?.value.trim();
    const mgr_username = document.getElementById('new-mgr-user')?.value.trim();
    const mgr_password = document.getElementById('new-mgr-pass')?.value.trim();
    const mgr_remark = document.getElementById('new-mgr-remark')?.value.trim();

    if(!shopId||!name) return showToast('warning', 'Shop ID and Shop Name are required!');
    fetch('/api/admin/action', { method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ action:'CreateShop', shop_id:shopId, shop_name:name, shop_location:address, shop_phone:phone,
        mgr_name, mgr_mobile, mgr_username, mgr_password, mgr_remark })
    }).then(r=>r.json()).then(d=>{
        if(d.success) {
            ['new-shop-id-create','new-shop-name','new-shop-address','new-shop-phone',
             'new-mgr-name','new-mgr-mobile','new-mgr-user','new-mgr-pass','new-mgr-remark'].forEach(id => {
                const el = document.getElementById(id);
                if(el) el.value='';
             });
            loadData(); showToast('success', `Shop '${shopId}' created successfully!`);
        } else showAlert('error', 'Error', d.error||'Error creating shop!');
    });
}

document.addEventListener('DOMContentLoaded', () => {
    loadData();
    try {
        const socket = io();
        socket.on('db_changed', () => loadData());
    } catch(e) { console.log('Socket.IO not available'); }
});

async function uploadAdminUserProfilePic(input) {
    if (!input.files || !input.files[0]) return;
    const file = input.files[0];
    const formData = new FormData();
    formData.append('profile_pic', file);
    
    // Pass the target user ID being viewed
    const targetUserId = document.getElementById('adminView_id').value;
    if (!targetUserId) {
        return showAlert('error', 'Error', 'No user ID found in view modal.');
    }
    formData.append('target_user_id', targetUserId);
    
    try {
        const loader = document.getElementById('globalLoader');
        if (loader) { loader.style.display = 'flex'; loader.style.visibility = 'visible'; loader.style.opacity = '1'; }
        
        const res = await fetch('/api/update_profile_pic', { method: 'POST', body: formData });
        const data = await res.json();
        
        if (loader) { loader.style.opacity = '0'; setTimeout(() => { loader.style.display = 'none'; }, 200); }
        
        if (data.success) {
            document.getElementById('adminView_pic').src = '/static/uploads/' + data.filename;
            showToast('success', 'User profile picture updated!');
            loadData(); // refresh the background table
        } else {
            showAlert('error', 'Update Failed', data.message);
        }
    } catch (err) {
        showAlert('error', 'Error', 'Failed to upload image.');
    }
}

// --- CHANGE ROLE FUNCTIONS ---------------------------------------------------
let changeRoleModalObj;

function openChangeRole(id, currentRole) {
    document.getElementById('changeRole_user_id').value = id;
    const sel = document.getElementById('changeRole_select');
    sel.value = currentRole;
    if (!changeRoleModalObj) changeRoleModalObj = new bootstrap.Modal(document.getElementById('changeRoleModal'));
    changeRoleModalObj.show();
}

function submitChangeRole() {
    const id   = document.getElementById('changeRole_user_id').value;
    const role = document.getElementById('changeRole_select').value;
    fetch('/api/admin/action', {
        method: 'POST', headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ action: 'ChangeRole', id, role })
    }).then(r => r.json()).then(d => {
        if (d.success) {
            showToast('success', `Role changed to ${role}!`);
            changeRoleModalObj.hide();
            loadData();
        } else {
            showAlert('error', 'Error', d.error || 'Failed to change role');
        }
    });
}

// --- SHOP VIEW/EDIT FUNCTIONS -----------------------------------------------
let shopViewModal;

function viewShop(id) {
    const s = window.shopsMap[id];
    if (!s) return showToast('error', 'Shop not found!');

    document.getElementById('shopView_id').value = s.id;
    document.getElementById('shopView_shop_id').value = s.shop_id || '';
    document.getElementById('shopView_name').value = s.name || '';
    document.getElementById('shopView_phone').value = s.phone || '';
    document.getElementById('shopView_address').value = s.address || '';
    
    const badge = document.getElementById('shopView_status_badge');
    badge.textContent = s.status || 'Active';
    badge.className = 'badge fs-6 ' + (s.status === 'Active' ? 'bg-success' : s.status === 'TempClosed' ? 'bg-warning' : 'bg-secondary');

    const btnClose = document.getElementById('shopView_btn_temp_close');
    const btnReopen = document.getElementById('shopView_btn_reopen');
    if (s.status === 'TempClosed') {
        btnClose.classList.add('d-none');
        btnReopen.classList.remove('d-none');
    } else {
        btnClose.classList.remove('d-none');
        btnReopen.classList.add('d-none');
    }

    const tbody = document.getElementById('shopView_staff_list');
    const staff = (window.allUsers || []).filter(u => u.shop_id && u.shop_id.toUpperCase() === (s.shop_id||'').toUpperCase());
    
    if (staff.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-muted small">No staff assigned to this shop.</td></tr>';
    } else {
        tbody.innerHTML = staff.map(u => {
            const roleBadge = u.role === 'Shop' ? 'bg-warning text-dark' : 'bg-info text-dark';
            const statusCol = u.status === 'Active' ? 'text-success' : (u.status === 'Blocked' ? 'text-danger' : 'text-secondary');
            return `<tr>
                <td class="small text-secondary fw-bold">#${u.id.substring(0, 6)}</td>
                <td class="small text-white">${u.full_name || u.username}</td>
                <td><span class="badge ${roleBadge}">${u.role}</span></td>
                <td class="small ${statusCol}">${u.status}</td>
            </tr>`;
        }).join('');
    }

    if (!shopViewModal) shopViewModal = new bootstrap.Modal(document.getElementById('shopViewModal'));
    shopViewModal.show();
}

function saveShopView() {
    const id = document.getElementById('shopView_id').value;
    const name = document.getElementById('shopView_name').value.trim();
    const phone = document.getElementById('shopView_phone').value.trim();
    const address = document.getElementById('shopView_address').value.trim();

    fetch('/api/admin/action', {
        method: 'POST', headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ action: 'UpdateShop', id, name, phone, address })
    }).then(r=>r.json()).then(res => {
        if(res.success) {
            showToast('success', 'Shop updated successfully!');
            shopViewModal.hide();
            loadData();
        } else showToast('error', res.error || 'Failed to update shop');
    });
}

function actShopView(actionType) {
    const id = document.getElementById('shopView_id').value;
    if (!id) return;
    
    let action = '';
    let msg = '';
    if (actionType === 'delete') {
        action = 'DeleteShop';
        msg = "Are you sure you want to permanently delete this shop?";
    } else if (actionType === 'temp_close') {
        action = 'UpdateShopStatus';
        msg = "Temporarily close this shop? It will pause operations.";
    } else if (actionType === 'reopen') {
        action = 'UpdateShopStatus';
        msg = "Reopen this shop for operations?";
    }

    Swal.fire({
        title: msg,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Yes, proceed',
        reverseButtons: true
    }).then((result) => {
        if (result.isConfirmed) {
            const bodyData = { action, id };
            if (actionType === 'temp_close') bodyData.status = 'TempClosed';
            if (actionType === 'reopen') bodyData.status = 'Active';

            fetch('/api/admin/action', {
                method: 'POST', headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(bodyData)
            }).then(r=>r.json()).then(res => {
                if(res.success) {
                    showToast('success', 'Action completed successfully!');
                    shopViewModal.hide();
                    loadData();
                } else showToast('error', res.error || 'Failed action');
            });
        }
    });
}

// ═══════════════════════════════════════════════════════════
// ORDER HISTORY — Rich Rendering
// ═══════════════════════════════════════════════════════════
const STATUS_COLORS = {
    New: '#4da3ff', Cooking: '#f0a500', Ready: '#00b849',
    Billed: '#20c997', Reverted: '#e74c3c', Cancelled: '#888', Processing: '#9b59b6'
};

function getStatusBadge(status) {
    const color = STATUS_COLORS[status] || '#888';
    return `<span class="badge rounded-pill" style="background:${color};color:#fff;font-size:.72rem;">${status}</span>`;
}

function getItemsPreview(itemsStr) {
    try {
        const arr = JSON.parse(itemsStr || '[]');
        if (!arr.length) return '<span class="text-muted small">—</span>';
        return arr.slice(0, 3).map(i => `<div class="small text-white-50" style="white-space:nowrap;">${i.n || i.name || '?'} <span class="text-warning">×${i.q || i.qty || 1}</span></div>`).join('') +
               (arr.length > 3 ? `<div class="small text-secondary">+${arr.length - 3} more</div>` : '');
    } catch { return '<span class="text-muted small">—</span>'; }
}

function renderOrderHistory(orders) {
    const orderEl = document.getElementById('order-list');
    const badge = document.getElementById('order-count-badge');
    if (!orderEl) return;

    const filterVal = (document.getElementById('order-filter-status')?.value) || 'all';
    const filtered = filterVal === 'all' ? orders : orders.filter(o => o.status === filterVal);
    if (badge) badge.textContent = filtered.length;

    if (filtered.length === 0) {
        orderEl.innerHTML = '<tr><td colspan="8" class="text-center text-muted p-4"><i class="fas fa-receipt fa-2x mb-2 d-block"></i>No orders found.</td></tr>';
        return;
    }

    orderEl.innerHTML = filtered.map(o => {
        const timeStr = o.created_at ? new Date(o.created_at).toLocaleString('en-IN', {day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}) : '—';
        return `<tr>
            <td><span class="badge bg-dark border border-secondary text-warning" style="font-size:.72rem;">#${o.id.substring(0,8)}</span></td>
            <td><span class="badge bg-info text-dark">${o.shop_id || '—'}</span></td>
            <td><span class="fw-bold text-white">T-${o.table_number}</span></td>
            <td>${getItemsPreview(o.items)}</td>
            <td class="fw-bold text-warning">₹${o.total_amount}</td>
            <td>
                ${getStatusBadge(o.status)}
                ${o.revert_reason && o.status === 'Reverted' ? `<br><small class="text-danger" style="font-size:.65rem;"><i class="fas fa-info-circle"></i> ${o.revert_reason}</small>` : ''}
            </td>
            <td class="small text-secondary" style="white-space:nowrap;">${timeStr}</td>
            <td>
                <div class="d-flex gap-1">
                    ${o.status === 'Billed' ? `<a href="/view_bill/${o.id}" target="_blank" class="btn btn-sm btn-glass-3d info px-2" title="Print Bill"><i class="fas fa-print"></i></a>` : ''}
                    <button onclick="openEditOrder('${o.id}','${o.table_number}','${o.total_amount}','${o.status}','${encodeURIComponent(o.items)}')" class="btn btn-sm btn-glass-3d warning px-2" title="Edit"><i class="fas fa-edit"></i></button>
                </div>
            </td>
        </tr>`;
    }).join('');
}

function filterOrderHistory() {
    if (window.allOrders) renderOrderHistory(window.allOrders);
}

// ═══════════════════════════════════════════════════════════
// SHOP MODE — Access View (Live Board)
// ═══════════════════════════════════════════════════════════
function renderShopModeAccess(orders) {
    const liveEl = document.getElementById('shopmode-order-list');
    const liveCount = document.getElementById('sm-live-count');
    const cntNew = document.getElementById('sm-count-new');
    const cntCook = document.getElementById('sm-count-cooking');
    const cntReady = document.getElementById('sm-count-ready');
    const cntBill = document.getElementById('sm-count-billed');
    if (!liveEl) return;

    const activeStatuses = ['New','Cooking','Ready','Processing'];
    const live = orders.filter(o => activeStatuses.includes(o.status));
    const today = new Date().toDateString();
    const billedToday = orders.filter(o => o.status === 'Billed' && new Date(o.created_at||'').toDateString() === today);

    if (cntNew)   cntNew.textContent   = orders.filter(o => o.status === 'New').length;
    if (cntCook)  cntCook.textContent  = orders.filter(o => o.status === 'Cooking').length;
    if (cntReady) cntReady.textContent = orders.filter(o => o.status === 'Ready').length;
    if (cntBill)  cntBill.textContent  = billedToday.length;
    if (liveCount) liveCount.textContent = live.length + ' active';

    if (live.length === 0) {
        liveEl.innerHTML = '<tr><td colspan="6" class="text-center text-muted p-4"><i class="fas fa-check-circle fa-2x mb-2 d-block text-success"></i>All clear — no active orders</td></tr>';
        return;
    }

    liveEl.innerHTML = live.map(o => {
        const isReady = o.status === 'Ready';
        const rowStyle = isReady ? 'background:rgba(0,184,73,.08);border-left:3px solid #00b849;' : '';
        return `<tr style="${rowStyle}">
            <td><span class="fw-bold fs-5 text-white">T-${o.table_number}</span></td>
            <td><span class="badge bg-dark border border-secondary text-warning" style="font-size:.7rem;">#${o.id.substring(0,8)}</span></td>
            <td>${getItemsPreview(o.items)}</td>
            <td class="fw-bold text-warning">₹${o.total_amount}</td>
            <td>${getStatusBadge(o.status)} ${isReady ? '<span class="ms-1" title="Ready to Serve!">🔔</span>' : ''}</td>
            <td>
                <div class="d-flex gap-1">
                    ${o.status === 'New' ? `<button onclick="adminShopAct('approve','${o.id}')" class="btn btn-sm btn-success px-2" title="Send to Cook"><i class="fas fa-fire me-1"></i>Cook</button>` : ''}
                    ${o.status === 'Ready' ? `<button onclick="adminShopAct('bill','${o.id}')" class="btn btn-sm btn-info text-dark px-2 fw-bold" title="Generate Bill"><i class="fas fa-receipt me-1"></i>Bill</button>` : ''}
                    ${o.status === 'New' ? `<button onclick="adminShopAct('revert','${o.id}')" class="btn btn-sm btn-outline-danger px-2" title="Revert"><i class="fas fa-undo"></i></button>` : ''}
                </div>
            </td>
        </tr>`;
    }).join('');
}

function adminShopAct(type, orderId) {
    const actionMap = { approve: 'approve_order', bill: 'generate_bill', revert: 'revert_order' };
    const action = actionMap[type];
    if (!action) return;
    fetch('/api/shop/action/api', {
        method: 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ action, id: orderId, payment_mode: 'Cash' })
    }).then(r => r.json()).then(d => {
        if (d.success) { showToast('success', 'Action done!'); loadData(); }
        else showAlert('error', 'Error', d.error || 'Failed');
    });
}

// ═══════════════════════════════════════════════════════════
// SHOP MODE — Admin Kitchen / Cook View
// ═══════════════════════════════════════════════════════════
function renderAdminKitchen(orders) {
    const board = document.getElementById('admin-kitchen-board');
    if (!board) return;

    const kitchenOrders = orders.filter(o => ['Cooking','Processing','New'].includes(o.status));
    if (kitchenOrders.length === 0) {
        board.innerHTML = `<div class="col-12 text-center p-5 text-secondary">
            <i class="fas fa-utensils fa-3x mb-3 d-block"></i><h4>Kitchen is Clear</h4>
            <p>No active orders in the queue.</p></div>`;
        return;
    }

    board.innerHTML = kitchenOrders.map(o => {
        const isCooking = o.status === 'Cooking';
        const borderColor = isCooking ? '#f0a500' : '#4da3ff';
        let itemsHtml = '—';
        try {
            itemsHtml = JSON.parse(o.items || '[]').map(i =>
                `<li class="list-group-item bg-transparent text-white border-secondary d-flex justify-content-between py-1">
                    <span>${i.n || i.name}</span><span class="badge bg-secondary">×${i.q || i.qty || 1}</span>
                </li>`).join('');
        } catch {}

        return `<div class="col-xl-3 col-lg-4 col-md-6 mb-4">
            <div class="card bg-dark text-white h-100" style="border-top:4px solid ${borderColor};">
                <div class="card-header d-flex justify-content-between align-items-center py-2">
                    <h5 class="m-0">Table ${o.table_number}</h5>
                    ${getStatusBadge(o.status)}
                </div>
                <div class="card-body p-3">
                    <ul class="list-group list-group-flush mb-3">${itemsHtml}</ul>
                    <div class="text-secondary small"><i class="fas fa-store me-1"></i>${o.shop_id || '—'}</div>
                </div>
                <div class="card-footer p-0 border-0">
                    ${!isCooking ? `<button onclick="adminCookAct('${o.id}','Cooking')" class="btn btn-warning w-100 rounded-0 fw-bold"><i class="fas fa-fire me-1"></i>START COOKING</button>` : ''}
                    ${isCooking ? `<button onclick="adminCookAct('${o.id}','Ready')" class="btn btn-success w-100 rounded-0 fw-bold"><i class="fas fa-check-circle me-1"></i>MARK AS READY</button>` : ''}
                </div>
            </div>
        </div>`;
    }).join('');
}

function adminCookAct(orderId, newStatus) {
    fetch('/api/cook/update', {
        method: 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ id: orderId, status: newStatus })
    }).then(r => r.json()).then(d => {
        if (d.success) { showToast('success', `Order marked as ${newStatus}!`); loadData(); }
        else showAlert('error', 'Error', 'Failed to update status');
    });
}

