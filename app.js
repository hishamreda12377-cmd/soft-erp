// ==================== DATA STORE ====================
const DB = {
    get(k) { try { return JSON.parse(localStorage.getItem('erp_' + k)) || []; } catch { return []; } },
    set(k, v) {
        localStorage.setItem('erp_' + k, JSON.stringify(v));
        DB._autoBackup();
    },
    getOne(k) { try { return JSON.parse(localStorage.getItem('erp_' + k)); } catch { return null; } },
    setOne(k, v) {
        localStorage.setItem('erp_' + k, JSON.stringify(v));
        DB._autoBackup();
    },
    _backupKey: 'erp_backup_snapshot',
    _dataKeys: ['products','customers','suppliers','warehouses','expenses','invoices','movements','users','settings','categories','units','heldInvoices','heldPurchases','inventoryCounts','trash','profile','seeded','quotes'],
    _autoBackup() {
        try {
            const snapshot = {};
            this._dataKeys.forEach(k => {
                const v = localStorage.getItem('erp_' + k);
                if (v) snapshot[k] = v;
            });
            localStorage.setItem(this._backupKey, JSON.stringify(snapshot));
        } catch {}
    },
    _restoreBackup() {
        try {
            const snap = JSON.parse(localStorage.getItem(this._backupKey));
            if (!snap) return false;
            let restored = 0;
            this._dataKeys.forEach(k => {
                if (snap[k] && !localStorage.getItem('erp_' + k)) {
                    localStorage.setItem('erp_' + k, snap[k]);
                    restored++;
                }
            });
            return restored > 0;
        } catch { return false; }
    }
};

function uid() { return Date.now().toString(36) + Math.random().toString(36).substr(2, 9); }
function getTaxRate() { return 0; }
function fmt(n) { return (n || 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',') + ' ج.م'; }
function itemNet(it) { return (it.unitPrice||0) * (it.quantity||0) - (it.discount||0); }
function itemCost(it) { if (it.buy != null) return it.buy; const p = (window.__erpProducts || DB.get('products')).find(x => x.id === it.productId); return p ? (p.buyingPrice||0) : 0; }
function fmtDate(d) { const dt = new Date(d); return `${dt.getFullYear()}/${String(dt.getMonth()+1).padStart(2,'0')}/${String(dt.getDate()).padStart(2,'0')}`; }
function fmtDateTime(d) { const dt = new Date(d); return `${fmtDate(d)} ${String(dt.getHours()).padStart(2,'0')}:${String(dt.getMinutes()).padStart(2,'0')}`; }
function todayStr() { return new Date().toISOString().split('T')[0]; }

let _barcodeScanner = null;
function openBarcodeScanner(mode) {
    if (typeof Html5Qrcode === 'undefined') { toast('مكتبة المسح غير متوفرة', 'error'); return; }
    const modal = document.getElementById('modalOverlay');
    document.getElementById('modalTitle').textContent = '📸 مسح الباركود';
    document.getElementById('modalBody').innerHTML = `
        <div style="text-align:center">
            <div id="barcodeScannerView" style="width:100%;max-width:400px;margin:0 auto;border-radius:var(--radius);overflow:hidden"></div>
            <p style="font-size:12px;color:var(--text-secondary);margin-top:8px">وجّه الكاميرا نحو الباركود</p>
            <button class="btn btn-sm btn-outline" onclick="closeBarcodeScanner()" style="margin-top:8px"><span class="material-icons-round" style="font-size:14px">close</span> إغلاق</button>
        </div>`;
    document.getElementById('modalFooter').innerHTML = '';
    modal.classList.add('show');
    modal.onclick = (e) => { if (e.target === modal) closeBarcodeScanner(); };

    setTimeout(() => {
        try {
            _barcodeScanner = new Html5Qrcode('barcodeScannerView');
            _barcodeScanner.start(
                { facingMode: 'environment' },
                { fps: 10, qrbox: { width: 250, height: 150 }, aspectRatio: 1.5 },
                (decodedText) => {
                    closeBarcodeScanner();
                    if (mode === 'pos') {
                        const searchInput = document.getElementById('posSearch');
                        if (searchInput) { searchInput.value = decodedText; searchPOSProducts(decodedText); }
                    } else {
                        const searchInput = document.getElementById('purSearch');
                        if (searchInput) { searchInput.value = decodedText; searchPurProducts(decodedText); }
                    }
                },
                () => {}
            );
        } catch (err) {
            document.getElementById('barcodeScannerView').innerHTML = '<p style="color:var(--error);padding:20px">تعذر فتح الكاميرا. تأكد من إذن الكاميرا.</p>';
        }
    }, 300);
}

function closeBarcodeScanner() {
    if (_barcodeScanner) {
        _barcodeScanner.stop().catch(() => {});
        _barcodeScanner.clear();
        _barcodeScanner = null;
    }
    closeModal();
}

let customDateFrom = '';
let customDateTo = '';
function dateFilterBar(prefix) {
    return `<div style="display:flex;gap:8px;align-items:center;margin-bottom:12px">
        <label style="font-size:12px;color:var(--text-secondary);font-weight:700;white-space:nowrap">الفترة:</label>
        <select class="form-control" id="${prefix}DateFilter" onchange="onDateFilterChange('${prefix}')" style="font-size:13px;padding:6px 10px;width:auto;min-width:140px">
            <option value="all" selected>الكل</option>
            <option value="today">اليوم</option>
            <option value="thisMonth">هذا الشهر</option>
            <option value="custom">تاريخ مخصص...</option>
        </select>
        <span id="${prefix}DateRangeLabel" style="font-size:11px;color:var(--text-secondary)"></span>
    </div>`;
}
function onDateFilterChange(prefix) {
    const val = document.getElementById(prefix+'DateFilter')?.value;
    if (val === 'custom') {
        openModal('تاريخ مخصص', `
            <div class="form-group"><label>من تاريخ</label><input type="date" class="form-control" id="${prefix}CustomFrom" value="${customDateFrom}"></div>
            <div class="form-group"><label>إلى تاريخ</label><input type="date" class="form-control" id="${prefix}CustomTo" value="${customDateTo}"></div>
        `, `<button class="btn btn-primary" onclick="applyCustomDate('${prefix}')">تطبيق</button><button class="btn btn-outline" onclick="closeModal()">إلغاء</button>`);
    } else {
        customDateFrom = ''; customDateTo = '';
        applyDateFilter(prefix, val);
    }
}
function applyCustomDate(prefix) {
    customDateFrom = document.getElementById(prefix+'CustomFrom')?.value || '';
    customDateTo = document.getElementById(prefix+'CustomTo')?.value || '';
    if (!customDateFrom || !customDateTo) return;
    closeModal();
    applyDateFilter(prefix, 'custom');
}
function applyDateFilter(prefix, rangeKey) {
    const label = document.getElementById(prefix+'DateRangeLabel');
    const body = document.getElementById(prefix+'TableBody');
    if (!body) return;
    let sum = 0;
    if (rangeKey === 'all') {
        if (label) label.textContent = '';
        body.querySelectorAll('tr[data-date]').forEach(tr => { tr.style.display = ''; sum += parseFloat(tr.dataset.total || 0); });
    } else {
        let from, to;
        const now = new Date();
        const sod = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        if (rangeKey === 'today') {
            from = sod; to = new Date();
            if (label) label.textContent = `${now.getFullYear()}/${String(now.getMonth()+1).padStart(2,'0')}/${String(now.getDate()).padStart(2,'0')}`;
        } else if (rangeKey === 'thisMonth') {
            from = new Date(now.getFullYear(), now.getMonth(), 1); to = new Date();
            if (label) label.textContent = `${now.getFullYear()}/${String(now.getMonth()+1).padStart(2,'0')}`;
        } else if (rangeKey === 'custom') {
            from = new Date(customDateFrom); to = new Date(customDateTo); to.setHours(23,59,59,999);
            if (label) label.textContent = `${customDateFrom} → ${customDateTo}`;
        } else { return; }
        body.querySelectorAll('tr[data-date]').forEach(tr => {
            const d = new Date(tr.dataset.date);
            const show = d >= from && d <= to;
            tr.style.display = show ? '' : 'none';
            if (show) sum += parseFloat(tr.dataset.total || 0);
        });
    }
    const totalEl = document.getElementById(prefix+'FilteredTotal');
    if (totalEl) totalEl.textContent = fmt(sum);
}

function nextInvoiceNumber() {
    const invoices = DB.get('invoices');
    let max = 0;
    invoices.forEach(inv => {
        const num = parseInt(inv.invoiceNumber);
        if (!isNaN(num) && num > max) max = num;
    });
    return String(max + 1);
}
function nextQuoteNumber() {
    const quotes = DB.get('quotes');
    let max = 0;
    quotes.forEach(q => { const num = parseInt(q.quoteNumber); if (!isNaN(num) && num > max) max = num; });
    return String(max + 1);
}

// ==================== SEED DATA ====================
function seedData() {
    if (DB.getOne('seeded')) return;
    DB.set('categories', [
        { id:uid(), name:'بدون تصنيف' },
    ]);
    DB.set('units', [
        { id:uid(), name:'قطعة' },
        { id:uid(), name:'علبة' },
        { id:uid(), name:'كرتونة' },
    ]);
    DB.set('products', []);
    DB.set('customers', []);
    DB.set('suppliers', []);
    DB.set('warehouses', [
        { id:'wh1', name:'المخزن الرئيسي', location:'المستودع الرئيسي', isDefault:true },
    ]);
    DB.set('expenses', []);
    DB.set('invoices', []);
    DB.set('movements', []);
    DB.set('users', [
        { id:'u1', username:'admin', password:'123456', name:'المدير', role:'admin', active:true },
    ]);
    DB.set('settings', { companyName:'', currency:'ج.م', darkMode:false, storeName:'', storePhone:'', storeAddress:'', bluetoothThermal:false, thermalWidth:80, receiptHeader:'', receiptFooter:'', taxNumber:'', tgToken:'', tgChatId:'', autoBackup:false });
    DB.set('heldInvoices', []);
    DB.set('heldPurchases', []);
    DB.set('inventoryCounts', []);
    DB.setOne('seeded', true);
}

// ==================== AUTH ====================
let currentUser = { id:'u1', username:'admin', name:'المدير', role:'admin', active:true };

function canDo(action) {
    if (!currentUser) return false;
    if (currentUser.role === 'admin') return true;
    const perms = {
        cashier: ['pos','products_view','customers_view','suppliers_view','inventory_view','purchases_view'],
        viewer: ['products_view','customers_view','suppliers_view','inventory_view','purchases_view','reports_view']
    };
    return (perms[currentUser.role] || []).includes(action);
}

// ==================== NAVIGATION ====================
let currentScreen = 'dashboard';

function showScreen(name) {
    currentScreen = name;
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.querySelector(`[data-screen="${name}"]`)?.classList.add('active');
    closeSidebar();
    renderScreen(name);
}

function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('open');
    document.getElementById('sidebarOverlay').classList.toggle('show');
}

function closeSidebar() {
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('sidebarOverlay').classList.remove('show');
}

function toggleTheme() {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    document.documentElement.setAttribute('data-theme', isDark ? '' : 'dark');
    document.getElementById('themeIcon').textContent = isDark ? 'dark_mode' : 'light_mode';
    const s = DB.getOne('settings') || {}; s.darkMode = !isDark; DB.setOne('settings', s);
}

function renderScreen(name) {
    const area = document.getElementById('contentArea');
    const screens = {
        dashboard: renderDashboard, pos: renderPOS, products: renderProducts,
        purchases: renderPurchases, customers: renderCustomers, suppliers: renderSuppliers,
        inventory: renderInventory, warehouses: renderWarehouses, expenses: renderExpenses,
        reports: renderReports, movements: renderMovements, profitloss: renderProfitLoss,
        users: renderUsers, settings: renderSettings, profile: renderProfile, trash: renderTrash, returns: renderReturns, invoices: renderInvoices, quotes: renderQuotes,
        inventoryCounts: renderInventoryCounts, purchaseOrders: renderPurchaseOrders, profitReport: renderProfitReport,
    };
    (screens[name] || renderDashboard)(area);
}

// ==================== MODAL ====================
function openModal(title, bodyHtml, footerHtml) {
    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalBody').innerHTML = bodyHtml;
    document.getElementById('modalFooter').innerHTML = footerHtml || '';
    document.getElementById('modalOverlay').classList.add('show');
}
function closeModal() { document.getElementById('modalOverlay').classList.remove('show'); }

function confirmModal(message, onConfirm, btnText) {
    openModal('تأكيد', `<div style="text-align:center;padding:8px 0"><span class="material-icons-round" style="font-size:48px;color:var(--accent)">warning</span><p style="margin-top:8px;font-size:14px">${message}</p></div>`,
        `<button class="btn btn-danger" onclick="window._confirmAction();closeModal()">${btnText||'نعم، تأكيد'}</button><button class="btn btn-outline" onclick="closeModal()">إلغاء</button>`);
    window._confirmAction = onConfirm;
}

function moveToTrash(type, id, renderFn) {
    const trash = DB.getOne('trash') || [];
    let item = null;
    if (type === 'invoice') {
        const inv = DB.get('invoices').find(i => i.id === id);
        if (inv) { item = { ...inv, _trashType: 'invoice', _deletedAt: new Date().toISOString() }; }
    } else if (type === 'product') {
        const p = DB.get('products').find(x => x.id === id);
        if (p) { item = { ...p, _trashType: 'product', _deletedAt: new Date().toISOString() }; }
    } else if (type === 'customer') {
        const c = DB.get('customers').find(x => x.id === id);
        if (c) { item = { ...c, _trashType: 'customer', _deletedAt: new Date().toISOString() }; }
    } else if (type === 'supplier') {
        const s = DB.get('suppliers').find(x => x.id === id);
        if (s) { item = { ...s, _trashType: 'supplier', _deletedAt: new Date().toISOString() }; }
    } else if (type === 'category') {
        const c = DB.get('categories').find(x => x.id === id);
        if (c) { item = { ...c, _trashType: 'category', _deletedAt: new Date().toISOString() }; }
    } else if (type === 'expense') {
        const e = DB.get('expenses').find(x => x.id === id);
        if (e) { item = { ...e, _trashType: 'expense', _deletedAt: new Date().toISOString() }; }
    } else if (type === 'warehouse') {
        const w = DB.get('warehouses').find(x => x.id === id);
        if (w) { item = { ...w, _trashType: 'warehouse', _deletedAt: new Date().toISOString() }; }
    } else if (type === 'user') {
        const u = DB.get('users').find(x => x.id === id);
        if (u) { item = { ...u, _trashType: 'user', _deletedAt: new Date().toISOString() }; }
    }
    if (item) { trash.unshift(item); DB.setOne('trash', trash); }
}

function restoreFromTrash(idx) {
    const trash = DB.getOne('trash') || [];
    const item = trash[idx];
    if (!item) return;
    const t = item._trashType;
    delete item._trashType; delete item._deletedAt;
    if (t === 'invoice') { const arr = DB.get('invoices'); arr.unshift(item); DB.set('invoices', arr); }
    else if (t === 'product') { const arr = DB.get('products'); arr.push(item); DB.set('products', arr); }
    else if (t === 'customer') { const arr = DB.get('customers'); arr.push(item); DB.set('customers', arr); }
    else if (t === 'supplier') { const arr = DB.get('suppliers'); arr.push(item); DB.set('suppliers', arr); }
    else if (t === 'category') { const arr = DB.get('categories'); arr.push(item); DB.set('categories', arr); }
    else if (t === 'expense') { const arr = DB.get('expenses'); arr.push(item); DB.set('expenses', arr); }
    else if (t === 'warehouse') { const arr = DB.get('warehouses'); arr.push(item); DB.set('warehouses', arr); }
    else if (t === 'user') { const arr = DB.get('users'); arr.push(item); DB.set('users', arr); }
    trash.splice(idx, 1); DB.setOne('trash', trash);
    toast('تم الاستعادة'); renderTrash(document.getElementById('contentArea'));
}

function permanentDelete(idx) {
    const trash = DB.getOne('trash') || [];
    trash.splice(idx, 1); DB.setOne('trash', trash);
    toast('تم الحذف نهائياً'); renderTrash(document.getElementById('contentArea'));
}

function renderTrash(area) {
    const trash = DB.getOne('trash') || [];
    const typeLabels = { invoice:'فاتورة', product:'منتج', customer:'عميل', supplier:'مورد', category:'تصنيف', expense:'مصروف', warehouse:'مخزن', user:'مستخدم' };
    area.innerHTML = `
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">
            <button class="btn btn-sm btn-outline" onclick="showScreen('settings')"><span class="material-icons-round">arrow_forward</span></button>
            <h2 style="font-size:18px;font-weight:800"><span class="material-icons-round" style="vertical-align:middle;color:var(--error)">delete</span> سلة المحذوفات (${trash.length})</h2>
        </div>
        ${trash.length===0?'<div style="text-align:center;padding:40px;color:var(--text-secondary)"><span class="material-icons-round" style="font-size:48px">delete_sweep</span><p style="margin-top:8px">السلة فارغة</p></div>':
        `<div class="section-card"><div class="table-container"><table><thead><tr><th>النوع</th><th>الاسم</th><th>التاريخ</th><th>إجراءات</th></tr></thead><tbody>
        ${trash.map((item,i)=>{
            const name = item.name || item.customerName || item.description || item.username || '-';
            const date = item._deletedAt ? fmtDateTime(item._deletedAt) : '-';
            return `<tr><td><span class="badge badge-warning">${typeLabels[item._trashType]||item._trashType}</span></td><td><strong>${name}</strong></td><td>${date}</td><td style="display:flex;gap:4px"><button class="btn btn-sm btn-primary" onclick="restoreFromTrash(${i})" title="استعادة"><span class="material-icons-round">restore</span></button><button class="btn btn-sm btn-danger" onclick="permanentDelete(${i})" title="حذف نهائي"><span class="material-icons-round">delete_forever</span></button></td></tr>`;
        }).join('')}
        </tbody></table></div>
        <button class="btn btn-danger btn-block" onclick="confirmModal('هل تريد تفريغ السلة بالكامل؟ لن يمكن التراجع',function(){DB.setOne('trash',[]);toast('تم التفريغ');renderTrash(document.getElementById('contentArea'))})" style="margin-top:8px"><span class="material-icons-round">delete_sweep</span> تفريغ السلة</button>
        </div>`}`;
}

function renderProfile(area) {
    const u = currentUser || {};
    const roleLabel = u.role==='admin'?'مدير':u.role==='cashier'?'كاشير':'مشاهد';
    const profile = DB.getOne('profile') || {};
    area.innerHTML = `
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:16px">
            <button class="btn btn-sm btn-outline" onclick="showScreen('settings')"><span class="material-icons-round">arrow_forward</span></button>
            <h2 style="font-size:18px;font-weight:800">بياناتي الشخصية</h2>
        </div>
        <div style="text-align:center;margin-bottom:20px">
            <div class="user-avatar" style="width:70px;height:70px;font-size:24px;margin:0 auto 8px;background:var(--primary);color:#fff">${(u.name||'م').charAt(0)}</div>
            <div style="font-size:16px;font-weight:700">${u.name||''}</div>
            <div style="font-size:12px;color:var(--text-secondary)">${roleLabel}</div>
        </div>
        <div class="section-card" style="max-width:500px;margin:0 auto">
            <div class="form-group"><label>الاسم الكامل</label><input class="form-control" id="profileFullName" value="${u.name||''}"></div>
            <div class="form-group"><label>اسم المستخدم</label><input class="form-control" id="profileUsername" value="${u.username||''}"></div>
            <div class="form-group"><label>كلمة المرور</label><input class="form-control" type="password" id="profilePassword" placeholder="اترك فارغاً إذا لا تغيير"></div>
            <div class="form-group"><label>البريد الإلكتروني</label><input class="form-control" type="email" id="profileEmail" value="${profile.email||''}" placeholder="example@email.com"></div>
            <div class="form-group"><label>رقم الهاتف</label><input class="form-control" type="tel" id="profilePhone" value="${profile.phone||''}" placeholder="01xxxxxxxxx"></div>
            <div class="form-group"><label>العنوان</label><input class="form-control" id="profileAddress" value="${profile.address||''}" placeholder="العنوان"></div>
            <div class="form-group"><label>المسمى الوظيفي</label><input class="form-control" id="profileJobTitle" value="${profile.jobTitle||''}" placeholder="مثال: مدير عام"></div>
            <button class="btn btn-primary btn-block" onclick="saveProfile()" style="margin-top:8px"><span class="material-icons-round">save</span> حفظ البيانات</button>
        </div>`;
}

function saveProfile() {
    const name = document.getElementById('profileFullName')?.value?.trim();
    const username = document.getElementById('profileUsername')?.value?.trim();
    const password = document.getElementById('profilePassword')?.value;
    const email = document.getElementById('profileEmail')?.value?.trim();
    const phone = document.getElementById('profilePhone')?.value?.trim();
    const address = document.getElementById('profileAddress')?.value?.trim();
    const jobTitle = document.getElementById('profileJobTitle')?.value?.trim();
    if (!name || !username) { toast('الاسم واسم المستخدم مطلوبين','error'); return; }
    const users = DB.get('users') || [];
    const u = users.find(x => x.id === currentUser.id);
    if (u) {
        u.name = name;
        u.username = username;
        if (password) u.password = password;
        DB.set('users', users);
    }
    currentUser.name = name;
    currentUser.username = username;
    document.getElementById('sidebarUserName').textContent = name;
    DB.setOne('profile', { email, phone, address, jobTitle });
    toast('تم حفظ البيانات');
    renderProfile(document.getElementById('contentArea'));
}

function toast(msg, type = 'success') {
    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    el.innerHTML = `<span class="material-icons-round">${type==='success'?'check_circle':type==='error'?'error':'warning'}</span>${msg}`;
    document.getElementById('toastContainer').appendChild(el);
    setTimeout(() => el.remove(), 3000);
}

function filterList(q, id) {
    q = q.toLowerCase();
    document.querySelectorAll(`#${id} .section-card, #${id} .inv-card`).forEach(el => {
        el.style.display = el.textContent.toLowerCase().includes(q) ? '' : 'none';
    });
}

// ==================== NOTIFICATIONS ====================
function getNotifications() {
    const products = DB.get('products');
    const notifs = [];
    const today = new Date();
    products.forEach(p => {
        if (p.quantity <= p.minQuantity && p.isActive) notifs.push({ icon:'warning_amber', text:`نقص مخزون: ${p.name} (${p.quantity} متبقي)`, color:'var(--warning)' });
        if (p.expiryDate) {
            const exp = new Date(p.expiryDate);
            const days = Math.ceil((exp - today) / (1000*60*60*24));
            if (days <= 0) notifs.push({ icon:'event_busy', text:`منتهي الصلاحية: ${p.name}`, color:'var(--error)' });
            else if (days <= 30) notifs.push({ icon:'schedule', text:`قت انتهاء قريب: ${p.name} (${days} يوم)`, color:'var(--accent)' });
        }
    });
    return notifs;
}

function showNotifications() {
    const notifs = getNotifications();
    if (notifs.length === 0) { openModal('التنبيهات', '<div class="empty-state"><span class="material-icons-round">notifications_off</span><h3>لا توجد تنبيهات</h3></div>'); return; }
    openModal('التنبيهات', notifs.map(n => `<div style="display:flex;align-items:center;gap:10px;padding:10px;border-bottom:1px solid var(--border)"><span class="material-icons-round" style="color:${n.color}">${n.icon}</span><span style="font-size:13px">${n.text}</span></div>`).join(''));
}

function updateNotifBadge() {
    const count = getNotifications().length;
    const badge = document.getElementById('notifBadge');
    badge.textContent = count;
    badge.style.display = count > 0 ? 'flex' : 'none';
}

// ==================== DASHBOARD ====================
function renderDashboard(area) {
    const products = DB.get('products');
    const invoices = DB.get('invoices');
    const customers = DB.get('customers');
    const suppliers = DB.get('suppliers');
    const expenses = DB.get('expenses');
    const today = new Date(); today.setHours(0,0,0,0);
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const todaySales = invoices.filter(i => i.type==='sale' && new Date(i.createdAt)>=today);
    const monthSales = invoices.filter(i => i.type==='sale' && new Date(i.createdAt)>=monthStart);
    const monthPurchases = invoices.filter(i => i.type==='purchase' && new Date(i.createdAt)>=monthStart);
    const monthExpenses = expenses.filter(e => new Date(e.date)>=monthStart);
    const todayTotal = todaySales.reduce((s,i) => s + (i.isReturn ? -Math.abs(i.total) : i.total), 0);
    const monthTotal = monthSales.reduce((s,i) => s + (i.isReturn ? -Math.abs(i.total) : i.total), 0);
    const monthPurTotal = monthPurchases.reduce((s,i) => s + (i.isReturn ? -Math.abs(i.total) : i.total), 0);
    const monthExpTotal = monthExpenses.reduce((s,e) => s+e.amount, 0);
    const profit = monthTotal - monthPurTotal - monthExpTotal;
    const invValue = products.reduce((s,p) => s+(p.buyingPrice*p.quantity), 0);
    const lowStock = products.filter(p => p.quantity<=p.minQuantity && p.isActive);
    const notifs = getNotifications();

    const dailyData = [];
    for (let i=6; i>=0; i--) {
        const d = new Date(today); d.setDate(d.getDate()-i);
        const dayStr = `${d.getMonth()+1}/${d.getDate()}`;
        const dayTotal = invoices.filter(inv => inv.type==='sale' && new Date(inv.createdAt).toDateString()===d.toDateString()).reduce((s,i) => s + (i.isReturn ? -Math.abs(i.total) : i.total), 0);
        dailyData.push({ label:dayStr, value:dayTotal });
    }

    area.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
            <div>
                <h2 style="font-size:18px;font-weight:800;color:var(--text);line-height:1.3">مرحباً ${currentUser?.name || ''} 👋</h2>
                <p style="color:var(--text-muted);font-size:12px;margin-top:2px">إليك ملخص أداء اليوم</p>
            </div>
        </div>
        ${notifs.length>0 ? `<div class="warning-banner" onclick="showNotifications()" style="cursor:pointer"><span class="material-icons-round">notifications_active</span><div><strong>يوجد ${notifs.length} تنبيه</strong><br><span style="font-size:11px;color:var(--text-muted)">اضغط للمراجعة</span></div></div>` : ''}
        <div class="stats-grid">
            <div class="stat-card" onclick="showScreen('pos')"><div class="icon" style="background:rgba(37,99,235,0.1)"><span class="material-icons-round" style="color:#2563EB">point_of_sale</span></div><div class="label">مبيعات اليوم</div><div class="value">${fmt(todayTotal)}</div><div class="subtitle" style="color:#2563EB">${todaySales.length} فاتورة</div></div>
            <div class="stat-card" onclick="showScreen('profitloss')"><div class="icon" style="background:rgba(16,185,129,0.1)"><span class="material-icons-round" style="color:#10B981">account_balance_wallet</span></div><div class="label">أرباح الشهر</div><div class="value" style="color:${profit>=0?'#10B981':'#EF4444'}">${fmt(profit)}</div></div>
            <div class="stat-card" onclick="showScreen('purchases')"><div class="icon" style="background:rgba(139,92,246,0.1)"><span class="material-icons-round" style="color:#8B5CF6">shopping_cart</span></div><div class="label">المشتريات</div><div class="value">${fmt(monthPurTotal)}</div></div>
            <div class="stat-card" onclick="showScreen('expenses')"><div class="icon" style="background:rgba(239,68,68,0.1)"><span class="material-icons-round" style="color:#EF4444">receipt_long</span></div><div class="label">المصروفات</div><div class="value">${fmt(monthExpTotal)}</div></div>
            <div class="stat-card" onclick="showScreen('inventory')"><div class="icon" style="background:rgba(20,184,166,0.1)"><span class="material-icons-round" style="color:#14B8A6">warehouse</span></div><div class="label">قيمة المخزون</div><div class="value">${fmt(invValue)}</div></div>
            ${lowStock.length>0 ? `<div class="stat-card" onclick="showScreen('inventory')" style="border:1.5px solid rgba(239,68,68,0.3)"><div class="icon" style="background:rgba(239,68,68,0.1)"><span class="material-icons-round" style="color:#EF4444">warning</span></div><div class="label">نقص مخزون</div><div class="value" style="color:#EF4444">${lowStock.length} صنف</div></div>` : ''}
        </div>
        <div style="display:flex;gap:8px;margin-bottom:14px;overflow-x:auto;padding-bottom:4px;-webkit-overflow-scrolling:touch">
            <button onclick="posMode='invoice';cart=[];posCustomerId='';posCustomerName='';cartDiscount=0;editingInvoiceId=null;editingIsReturn=false;showScreen('pos')" style="flex-shrink:0;display:flex;align-items:center;gap:6px;padding:10px 16px;border-radius:var(--radius);border:none;background:var(--gradient-primary);color:white;font-size:12px;font-weight:700;cursor:pointer;box-shadow:0 3px 10px rgba(37,99,235,0.3)"><span class="material-icons-round" style="font-size:18px">add_shopping_cart</span> بيع جديد</button>
            <button onclick="purMode='invoice';purCart=[];purSupplierId='';purSupplierName='';purDiscount=0;editingPurInvoiceId=null;editingPurIsReturn=false;showScreen('purchases')" style="flex-shrink:0;display:flex;align-items:center;gap:6px;padding:10px 16px;border-radius:var(--radius);border:none;background:linear-gradient(135deg,#8B5CF6,#7C3AED);color:white;font-size:12px;font-weight:700;cursor:pointer;box-shadow:0 3px 10px rgba(139,92,246,0.3)"><span class="material-icons-round" style="font-size:18px">shopping_cart</span> مشتريات</button>
            <button onclick="openProductModal();showScreen('products')" style="flex-shrink:0;display:flex;align-items:center;gap:6px;padding:10px 16px;border-radius:var(--radius);border:none;background:linear-gradient(135deg,#10B981,#059669);color:white;font-size:12px;font-weight:700;cursor:pointer;box-shadow:0 3px 10px rgba(16,185,129,0.3)"><span class="material-icons-round" style="font-size:18px">inventory_2</span> إضافة صنف</button>
            <button onclick="showScreen('reports')" style="flex-shrink:0;display:flex;align-items:center;gap:6px;padding:10px 16px;border-radius:var(--radius);border:none;background:linear-gradient(135deg,#F59E0B,#D97706);color:white;font-size:12px;font-weight:700;cursor:pointer;box-shadow:0 3px 10px rgba(245,158,11,0.3)"><span class="material-icons-round" style="font-size:18px">bar_chart</span> التقارير</button>
            <button onclick="showScreen('purchaseOrders')" style="flex-shrink:0;display:flex;align-items:center;gap:6px;padding:10px 16px;border-radius:var(--radius);border:none;background:linear-gradient(135deg,#F43F5E,#E11D48);color:white;font-size:12px;font-weight:700;cursor:pointer;box-shadow:0 3px 10px rgba(244,63,94,0.3)"><span class="material-icons-round" style="font-size:18px">assignment</span> طلب شراء</button>
        </div>
        <div class="section-card">
            <div class="section-header"><h3>📈 مبيعات آخر 7 أيام</h3></div>
            <div class="chart-container"><canvas id="salesChart"></canvas></div>
        </div>
    `;
    setTimeout(() => {
        const ctx = document.getElementById('salesChart');
        if (ctx) new Chart(ctx, { type:'bar', data:{ labels:dailyData.map(d=>d.label), datasets:[{ label:'المبيعات', data:dailyData.map(d=>d.value), backgroundColor:'rgba(37,99,235,0.8)', borderRadius:6, barThickness:24 }] }, options:{ responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}}, scales:{ y:{beginAtZero:true,grid:{color:'rgba(0,0,0,0.05)'}}, x:{grid:{display:false}} } } });
    }, 100);
    updateNotifBadge();
}

// ==================== POS ====================
let cart = [];
let curTax = 0;
let posCustomerId = '';
let posCustomerName = '';
let posMode = 'list';
let heldInvoices = [];
let cartDiscount = 0;
let cartDiscountType = 'amount';
let posPaymentMethod = 'cash';
let posNotes = '';
let editingInvoiceId = null;
let editingIsReturn = false;

function renderPOS(area) {
    const saleInvoices = DB.get('invoices').filter(i => i.type==='sale');
    const held = DB.getOne('heldInvoices') || [];
    const totalSales = saleInvoices.reduce((s,i) => s + (i.isReturn ? -Math.abs(i.total) : i.total), 0);

    if (posMode === 'list') {
        area.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;flex-wrap:wrap;gap:6px">
                <div style="display:flex;align-items:center;gap:6px">
                    <button class="btn btn-sm btn-outline" onclick="showScreen('dashboard')"><span class="material-icons-round" style="font-size:16px">arrow_forward</span></button>
                    <h2 style="font-size:16px;font-weight:800"><span class="material-icons-round" style="color:var(--primary);vertical-align:middle;font-size:18px">point_of_sale</span> نقطة البيع</h2>
                </div>
                <div style="display:flex;gap:4px;align-items:center">
                    <button class="btn btn-sm btn-outline" onclick="exportSalesCSV()"><span class="material-icons-round" style="font-size:14px">file_download</span> CSV</button>
                    <button class="btn btn-sm btn-outline" onclick="exportSalesPDF()"><span class="material-icons-round" style="font-size:14px">picture_as_pdf</span> PDF</button>
                    <button class="btn btn-sm btn-primary" onclick="posMode='invoice';cart=[];posCustomerId='';posCustomerName='';cartDiscount=0;editingInvoiceId=null;editingIsReturn=false;renderPOS(document.getElementById('contentArea'))"><span class="material-icons-round">add</span> جديدة</button>
                </div>
            </div>
            <div class="section-card" style="margin-bottom:12px"><div style="display:flex;justify-content:space-between;align-items:center"><span style="color:var(--text-secondary)">إجمالي المبيعات (${saleInvoices.length} فاتورة)</span><span style="font-size:20px;font-weight:800;color:var(--primary)" id="saleFilteredTotal">${fmt(totalSales)}</span></div></div>
            ${dateFilterBar('sale')}
            ${held.length > 0 ? `<div class="section-card"><div class="section-header"><h3>فواتير معلقة (${held.length})</h3></div><div class="held-list">${held.map((h,i) => `<div class="held-item" onclick="resumeHeld(${i})"><div><strong>${h.customerName || 'بدون عميل'}</strong><br><small style="color:var(--text-secondary)">${h.items.length} منتج - ${fmt(h.total)}</small></div><div style="display:flex;gap:4px"><button class="btn btn-sm btn-primary" onclick="event.stopPropagation();resumeHeld(${i})"><span class="material-icons-round" style="font-size:14px">play_arrow</span></button><button class="btn btn-sm btn-danger" onclick="event.stopPropagation();removeHeld(${i})"><span class="material-icons-round" style="font-size:14px">delete</span></button></div></div>`).join('')}</div></div>` : ''}
            <div style="display:flex;gap:6px;margin-bottom:8px;flex-wrap:wrap">
                <input class="form-control" id="saleSearch" placeholder="بحث برقم الفاتورة أو العميل..." oninput="filterInvoiceList('sale')" style="flex:1;min-width:140px;padding:7px 10px">
                <select class="form-control" id="saleStatus" onchange="filterInvoiceList('sale')" style="min-width:110px;padding:7px 10px">
                    <option value="all">كل الحالات</option>
                    <option value="paid">مدفوعة</option>
                    <option value="partial">جزئية</option>
                    <option value="pending">آجلة</option>
                    <option value="return">مرتجع</option>
                </select>
            </div>
            <div class="section-card"><div class="section-header"><h3>فواتير البيع (${saleInvoices.length})</h3></div>
                <div class="table-container"><table id="saleTable"><thead><tr>
                    <th data-sortkey="num" data-sorttype="num" style="cursor:pointer">رقم</th>
                    <th data-sortkey="party" data-sorttype="str" style="cursor:pointer">العميل</th>
                    <th data-sortkey="total" data-sorttype="num" style="text-align:left;cursor:pointer">الإجمالي</th>
                    <th data-sortkey="date" data-sorttype="date" style="text-align:left;cursor:pointer">التاريخ</th>
                    <th>إجراءات</th>
                </tr></thead><tbody id="saleTableBody">
                ${saleInvoices.length===0 ? '<tr><td colspan="5" style="text-align:center;padding:30px;color:var(--text-secondary)">لا توجد فواتير</td></tr>' :
                saleInvoices.map(i => {
                    const isReturn = i.isReturn;
                    const totalDisplay = isReturn ? -Math.abs(i.total) : i.total;
                    const totalColor = isReturn ? 'var(--error)' : 'var(--primary)';
                    const statusVal = isReturn ? 'return' : (i.status||'paid');
                    return `<tr data-search="${(i.invoiceNumber||'')+' '+(i.customerName||'نقدي')}" data-status="${statusVal}" data-total="${totalDisplay}" style="cursor:pointer" onclick="editInvoice('${i.id}')">
                        <td data-sort="${i.invoiceNumber}"><strong>${i.invoiceNumber}</strong>${isReturn?' <span class="badge badge-danger" style="font-size:9px">مرتجع</span>':''}</td>
                        <td data-sort="${i.customerName||'نقدي'}">${i.customerName||'نقدي'}</td>
                        <td data-sort="${i.total}" style="font-weight:700;color:${totalColor}">${fmt(totalDisplay)}</td>
                        <td data-sort="${i.createdAt}">${fmtDate(i.createdAt)}</td>
                        <td style="white-space:nowrap">
                            <button class="btn btn-xs btn-outline" onclick="event.stopPropagation();viewInvoice('${i.id}')" title="عرض"><span class="material-icons-round" style="font-size:14px">visibility</span></button>
                            <button class="btn btn-xs btn-danger" onclick="event.stopPropagation();confirmModal('حذف الفاتورة؟', ()=>deleteInvoice('${i.id}'))" title="حذف"><span class="material-icons-round" style="font-size:14px">delete</span></button>
                        </td>
                    </tr>`;
                }).join('')}
                </tbody></table></div></div>`;
        enableTableSort('saleTable');
        return;
    }

    area.innerHTML = `
        <div style="display:flex;flex-direction:column;height:calc(100vh - var(--topbar-height) - 24px);height:calc(100dvh - var(--topbar-height) - 24px);gap:6px">
            <!-- Header Bar -->
            <div style="background:var(--card);border-radius:var(--radius);box-shadow:var(--shadow);border:1px solid var(--border-light)">
                <!-- Top Row: Actions -->
                <div style="padding:8px 10px;display:flex;gap:5px;align-items:center;flex-wrap:wrap;border-bottom:1px solid var(--border-light)">
                    <div style="display:flex;gap:4px;flex:1;min-width:0">
                        <button class="btn btn-sm btn-primary" onclick="${editingInvoiceId?`saveEditSale('${editingInvoiceId}')`:'saveSaleDirect()'}"><span class="material-icons-round" style="font-size:14px">save</span> حفظ</button>
                        ${editingInvoiceId?'':`<button class="btn btn-sm btn-outline" onclick="saveQuote()"><span class="material-icons-round" style="font-size:14px">request_quote</span> عرض سعر</button>`}
                        ${editingInvoiceId?`<button class="btn btn-sm btn-success" onclick="saveEditSale('${editingInvoiceId}',true)"><span class="material-icons-round" style="font-size:14px">print</span> حفظ + طباعة</button>`:''}
                        ${editingInvoiceId?`<button class="btn btn-sm btn-outline" onclick="printInvoiceById('${editingInvoiceId}')"><span class="material-icons-round" style="font-size:14px">print</span></button>`:`<button class="btn btn-sm btn-outline" onclick="printCurrentPosCart()"><span class="material-icons-round" style="font-size:14px">print</span></button>`}
                        ${editingInvoiceId?`<label class="return-checkbox" style="display:flex;align-items:center;gap:4px;font-size:10px;cursor:pointer;padding:4px 8px;border-radius:var(--radius-sm);border:1.5px solid ${editingIsReturn?'var(--error)':'var(--border)'};background:${editingIsReturn?'rgba(239,68,68,0.08)':'var(--surface)'};color:${editingIsReturn?'var(--error)':'var(--text-secondary)'};transition:var(--transition)"><input type="checkbox" ${editingIsReturn?'checked':''} onchange="editingIsReturn=this.checked;renderPOS(document.getElementById('contentArea'))" style="display:none"><span class="material-icons-round" style="font-size:15px">${editingIsReturn?'check_box':'check_box_outline_blank'}</span> مرتجع</label>`:''}
                    </div>
                    <div style="display:flex;gap:4px;align-items:center">
                        <select class="form-control" id="posPayMethod" onchange="posPaymentMethod=this.value;updatePosPayUI()" style="min-width:90px;padding:5px 10px;font-size:11px;border-radius:var(--radius-sm);font-weight:600">
                            <option value="cash" ${posPaymentMethod==='cash'?'selected':''}>💵 نقدي</option>
                            <option value="credit" ${posPaymentMethod==='credit'?'selected':''}>📋 آجل</option>
                        </select>
                        <button class="btn btn-sm btn-outline" onclick="holdInvoice()" title="تعليق الفاتورة" style="padding:4px 8px"><span class="material-icons-round" style="font-size:15px">pause_circle</span></button>
                        <button class="btn btn-sm btn-outline" onclick="posMode='list';editingInvoiceId=null;editingIsReturn=false;renderPOS(document.getElementById('contentArea'))" title="العودة للقائمة" style="padding:4px 8px"><span class="material-icons-round" style="font-size:15px">arrow_forward</span> الفواتير</button>
                    </div>
                </div>
                <!-- Second Row: Customer + Notes -->
                <div style="padding:8px 10px 4px;display:flex;gap:6px;align-items:flex-end;flex-wrap:wrap">
                    <div style="flex:1;min-width:100px">
                        <label style="font-size:9px;color:var(--text-muted);margin-bottom:2px;display:block;font-weight:600">العميل</label>
                        <div style="position:relative">
                            <input class="form-control" placeholder="اسم العميل..." id="posCustomerInput" value="${posCustomerName}" oninput="searchPosCustomer(this.value)" onfocus="searchPosCustomer(this.value)" autocomplete="off" style="padding:6px 10px;font-size:12px;border-radius:var(--radius-sm)">
                            <div id="posCustomerDropdown" style="display:none;position:absolute;top:100%;right:0;left:0;background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-sm);max-height:150px;overflow-y:auto;z-index:50;box-shadow:var(--shadow-lg);margin-top:2px"></div>
                        </div>
                    </div>
                    <div style="flex:1;min-width:80px">
                        <label style="font-size:9px;color:var(--text-muted);margin-bottom:2px;display:block;font-weight:600">ملاحظات</label>
                        <input class="form-control" placeholder="ملاحظات..." id="posNotesInput" value="${posNotes}" oninput="posNotes=this.value" style="padding:6px 10px;font-size:12px;border-radius:var(--radius-sm)">
                    </div>
                </div>
                <!-- Third Row: Product Search -->
                <div style="padding:0 10px 8px;position:relative;display:flex;gap:6px;align-items:center">
                    <button onclick="openBarcodeScanner('pos')" style="flex-shrink:0;width:36px;height:36px;border-radius:var(--radius-sm);border:1px solid var(--border);background:var(--surface);color:var(--primary);display:flex;align-items:center;justify-content:center;cursor:pointer" title="مسح بالكاميرا"><span class="material-icons-round" style="font-size:20px">qr_code_scanner</span></button>
                    <div style="flex:1;position:relative">
                        <input class="form-control" placeholder="🔍 ابحث عن صنف أو امسح باركود..." id="posSearch" oninput="searchPOSProducts(this.value)" onfocus="searchPOSProducts(this.value)" autocomplete="off" style="padding:6px 10px;font-size:12px;border-radius:var(--radius-sm)">
                        <div id="posProductsDropdown" style="display:none;position:absolute;top:100%;right:0;left:0;background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-sm);max-height:200px;overflow-y:auto;z-index:50;box-shadow:var(--shadow-lg);margin-top:2px"></div>
                    </div>
                </div>
            </div>

            <!-- Cart Items -->
            <div style="flex:1;overflow-y:auto;background:var(--card);border-radius:var(--radius);box-shadow:var(--shadow);border:1px solid var(--border-light);padding:6px;min-height:0" id="posCartArea">
                <div id="cartItems">
                    <div class="empty-state" style="padding:24px 12px"><span class="material-icons-round" style="font-size:40px;opacity:0.15">shopping_basket</span><h3 style="margin-top:6px">السلة فارغة</h3><p>ابحث عن منتج أو امسح الباركود</p></div>
                </div>
            </div>

            <!-- Bottom: Total Bar -->
            <div style="background:var(--card);border-radius:var(--radius);box-shadow:var(--shadow-md);border:1px solid var(--border-light);overflow:hidden">
                <!-- Expandable Details -->
                <div id="posDetailsExpand" style="display:none;padding:10px;border-bottom:1px solid var(--border-light);background:var(--bg)">
                    <div style="margin-bottom:8px">
                        <label style="font-size:10px;font-weight:600;color:var(--text-secondary);display:block;margin-bottom:3px">الخصم</label>
                        <input class="form-control" type="number" id="cartDiscountInput" value="${cartDiscount||''}" onchange="updateCartDiscount(this.value)" style="padding:6px 10px;font-size:12px;border-radius:var(--radius-sm)">
                    </div>
                    <div style="margin-bottom:8px">
                        <label style="font-size:10px;font-weight:600;color:var(--text-secondary);display:block;margin-bottom:3px">الضريبة (رقم)</label>
                        <input class="form-control" type="number" id="cartTaxInput" value="${curTax||''}" onchange="updateCartTax(this.value)" style="padding:6px 10px;font-size:12px;border-radius:var(--radius-sm)">
                    </div>
                    <div style="display:flex;justify-content:space-between;margin-bottom:4px;font-size:11px"><span style="color:var(--text-muted)">المجموع الفرعي</span><span id="cartSubtotal" style="font-weight:600">0.00 ج.م</span></div>
                    <div style="display:flex;justify-content:space-between;margin-bottom:4px;font-size:11px"><span style="color:var(--text-muted)">الخصم</span><span style="color:var(--error);font-weight:600" id="cartDiscountDisplay">0.00 ج.م</span></div>
                    <div style="display:flex;justify-content:space-between;margin-bottom:4px;font-size:11px"><span style="color:var(--text-muted)">الضريبة</span><span id="cartTax" style="font-weight:600">0.00 ج.م</span></div>
                    <div id="posCreditFields" style="display:none;border-top:1px solid var(--border-light);padding-top:6px;margin-top:4px">
                        <div class="form-group" style="margin-bottom:4px"><label style="font-size:10px;font-weight:600">المبلغ المدفوع</label><input class="form-control" type="number" id="posPaidInput" value="0" onchange="updatePosCredit()" oninput="updatePosCredit()" style="padding:5px 8px;font-size:12px;border-radius:var(--radius-sm)"></div>
                        <div style="display:flex;justify-content:space-between;font-size:12px;padding:4px 0"><span style="color:var(--text-muted);font-weight:600">المتبقي</span><span id="posRemaining" style="color:var(--error);font-weight:800;font-size:13px">0.00 ج.م</span></div>
                    </div>
                </div>
                <!-- Total Row -->
                <div onclick="togglePosDetails()" style="display:flex;align-items:center;justify-content:space-between;padding:12px 14px;cursor:pointer;user-select:none;background:linear-gradient(135deg, var(--primary) 0%, #1D4ED8 100%);color:white">
                    <div style="display:flex;align-items:center;gap:8px">
                        <span class="material-icons-round" style="font-size:22px;opacity:0.8">shopping_cart</span>
                        <div>
                            <div style="font-size:11px;opacity:0.8;font-weight:500">الإجمالي</div>
                            <div style="font-size:20px;font-weight:800;line-height:1.1" id="cartTotal">0.00 ج.م</div>
                        </div>
                    </div>
                    <div style="display:flex;align-items:center;gap:8px">
                        <div style="text-align:left">
                            <div style="font-size:10px;opacity:0.7" id="cartCount">0 أصناف</div>
                        </div>
                        <span class="material-icons-round" id="posDetailsArrow" style="opacity:0.7;transition:transform 0.2s;font-size:20px">expand_less</span>
                    </div>
                </div>
            </div>
        </div>`;
    setTimeout(() => document.getElementById('posSearch')?.focus(), 100);
    updateCart();
}

function searchPosCustomer(q) {
    const dd = document.getElementById('posCustomerDropdown');
    if (!dd) return;
    const customers = DB.get('customers');
    const list = q ? customers.filter(c => c.name.includes(q)||(c.phone||'').includes(q)) : customers.slice(0,8);
    dd.style.display = 'block';
    dd.innerHTML =
        (list.length===0 ? `<div style="padding:8px;color:var(--text-secondary);font-size:11px;text-align:center">لا توجد نتائج</div>` :
        list.map(c => `<div style="padding:6px 10px;cursor:pointer;border-bottom:1px solid var(--border);font-size:11px" onclick="selectPosCustomer('${c.id}','${c.name}')"><strong>${c.name}</strong><br><small style="color:var(--text-secondary)">${c.phone||''} ${c.balance?`| رصيد: ${fmt(c.balance)}`:''}</small></div>`).join(''));
}

function selectPosCustomer(id, name) {
    posCustomerId = id; posCustomerName = name;
    const inp = document.getElementById('posCustomerInput');
    if (inp) inp.value = name;
    const dd = document.getElementById('posCustomerDropdown');
    if (dd) dd.style.display = 'none';
}

function searchPOSProducts(q) {
    const dd = document.getElementById('posProductsDropdown');
    if (!dd) return;
    q = q.trim();
    if (!q) { dd.style.display = 'none'; return; }

    const products = DB.get('products').filter(p => p.isActive && p.quantity > 0);
    const barcodeMatch = products.find(p => p.barcode && p.barcode === q);
    if (barcodeMatch) {
        addToCart(barcodeMatch.id, barcodeMatch.sellingPrice, 1);
        document.getElementById('posSearch').value = '';
        dd.style.display = 'none';
        return;
    }
    const found = products.filter(p => p.name.toLowerCase().includes(q.toLowerCase()) || (p.barcode||'').includes(q));
    if (found.length === 0) {
        window._posNewName = q;
        dd.innerHTML = '<div onclick="quickAddProduct()" style="padding:10px;cursor:pointer;color:var(--primary);font-size:12px;font-weight:700;text-align:center;border:1px dashed var(--border);border-radius:var(--radius-sm);margin:4px">➕ إضافة صنف جديد: «' + q.replace(/</g,'&lt;') + '»</div>';
        dd.style.display = 'block'; return;
    }

    found.sort((a, b) => a.name.localeCompare(b.name, 'ar'));

    dd.innerHTML = found.map(p => {
        const isLow = p.quantity <= p.minQuantity;
        return `<div onclick="addToCart('${p.id}',${p.sellingPrice},1);document.getElementById('posSearch').value='';document.getElementById('posProductsDropdown').style.display='none'" style="display:flex;align-items:center;gap:8px;padding:8px 10px;cursor:pointer;border-bottom:1px solid var(--border);transition:background 0.15s" onmouseenter="this.style.background='var(--bg)'" onmouseleave="this.style.background='transparent'">
            <div style="width:32px;height:32px;border-radius:6px;background:rgba(37,99,235,0.1);color:var(--primary);display:flex;align-items:center;justify-content:center;font-weight:800;font-size:12px;flex-shrink:0;${p.image?'background-image:url('+p.image+');background-size:cover':''}">${p.image?'':p.name.charAt(0)}</div>
            <div style="flex:1;min-width:0">
                <div style="font-weight:700;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${p.name}</div>
                <div style="font-size:10px;color:var(--text-secondary)">${p.unit||'قطعة'} | ${isLow?'<span style=color:var(--error)>نقص</span>':`متوفر: ${p.quantity}`}</div>
            </div>
            <div style="font-weight:800;font-size:12px;color:var(--primary);flex-shrink:0">${fmt(p.sellingPrice)}</div>
        </div>`;
    }).join('');
    dd.style.display = 'block';
}

function togglePosDetails() {
    const el = document.getElementById('posDetailsExpand');
    const arrow = document.getElementById('posDetailsArrow');
    if (!el) return;
    const isOpen = el.style.display !== 'none';
    el.style.display = isOpen ? 'none' : 'block';
    if (arrow) arrow.style.transform = isOpen ? 'rotate(180deg)' : 'rotate(0deg)';
}

function quickAddProduct() {
    const name = (window._posNewName || '').trim();
    if (!name) return;
    const cats = DB.get('categories') || [];
    const defCat = (cats.find(c => c.name === 'بدون تصنيف')) || cats[0] || { id: 'wh1' };
    const units = DB.get('units') || [];
    const defUnit = units[0] ? units[0].name : 'قطعة';
    openModal('إضافة صنف سريعة', `
        <div style="font-size:12px;color:var(--text-secondary);margin-bottom:10px">${name.replace(/</g,'&lt;')}</div>
        <div class="form-group"><label>سعر البيع</label><input type="number" id="qaPrice" class="form-control" value="0" style="padding:8px 10px"></div>
        <div class="form-group"><label>سعر التكلفة (اختياري)</label><input type="number" id="qaCost" class="form-control" value="0" style="padding:8px 10px"></div>
        <div class="form-group"><label>باركود (اختياري)</label><input id="qaBarcode" class="form-control" value="" style="padding:8px 10px"></div>
        <div class="form-group"><label>الوحدة</label><input id="qaUnit" class="form-control" value="${defUnit}" style="padding:8px 10px"></div>
    `, `<button class="btn btn-primary" onclick="confirmQuickAdd()"><span class="material-icons-round">add</span> إضافة للسلة</button><button class="btn btn-outline" onclick="closeModal()">إلغاء</button>`);
    setTimeout(() => { const e = document.getElementById('qaPrice'); if (e) e.focus(); }, 100);
}

function confirmQuickAdd() {
    const name = (window._posNewName || '').trim();
    const price = parseFloat(document.getElementById('qaPrice') && document.getElementById('qaPrice').value) || 0;
    const cost = parseFloat(document.getElementById('qaCost') && document.getElementById('qaCost').value) || 0;
    const barcode = (document.getElementById('qaBarcode') && document.getElementById('qaBarcode').value || '').trim();
    const unit = (document.getElementById('qaUnit') && document.getElementById('qaUnit').value || '').trim() || 'قطعة';
    if (!name) return;
    const products = DB.get('products');
    const cat = (DB.get('categories').find(c => c.name === 'بدون تصنيف')) || DB.get('categories')[0] || {};
    const p = {
        id: uid(), name, barcode, unit,
        units: [{ name: unit, factor: 1, price: price }],
        image: '', costPrice: cost, sellingPrice: price, quantity: 0, minQuantity: 0,
        categoryId: cat.id, warehouseId: 'wh1', isActive: true
    };
    products.unshift(p);
    DB.set('products', products);
    addToCart(p.id, price, 1);
    closeModal();
    const s = document.getElementById('posSearch'); if (s) s.value = '';
    const dd = document.getElementById('posProductsDropdown'); if (dd) dd.style.display = 'none';
    toast('تمت إضافة الصنف للسلة', 'success');
}

function addToCart(productId, price, qty) {
    const products = DB.get('products');
    const product = products.find(p => p.id === productId);
    if (!product) return;
    price = price || product.sellingPrice;
    qty = qty || 1;
    const existing = cart.find(c => c.productId===productId && c.unitPrice===price);
    if (existing) {
        if (existing.quantity + qty > product.quantity) { toast('لا يوجد مخزون كافٍ','warning'); return; }
        existing.quantity += qty;
    } else {
        if (qty > product.quantity) { toast('لا يوجد مخزون كافٍ','warning'); return; }
        cart.push({ productId:product.id, productName:product.name, unitPrice:price, quantity:qty, discount:0, taxRate:getTaxRate(), buy: product.buyingPrice||0 });
    }
    updateCart();
}

function addUnitToCart(productId, unitIdx) {
    const products = DB.get('products');
    const product = products.find(p => p.id === productId);
    if (!product || !product.units || !product.units[unitIdx]) return;
    const unit = product.units[unitIdx];
    addToCart(productId, unit.price, unit.factor);
}

function removeFromCart(idx) { cart.splice(idx,1); updateCart(); }
function updateCartQty(idx, change) {
    cart[idx].quantity += change;
    if (cart[idx].quantity <= 0) cart.splice(idx,1);
    updateCart();
}
function updateCartItemDiscount(idx, val) {
    cart[idx].discount = parseFloat(val) || 0;
    updateCart();
}
function clearCart() { cart=[]; posCustomerId=''; posCustomerName=''; cartDiscount=0; curTax=0; const inp=document.getElementById('posCustomerInput'); if(inp) inp.value=''; updateCart(); }
function updateCartDiscount(val) { cartDiscount = parseFloat(val)||0; updateCart(); }
function updateCartDiscountType(val) { cartDiscountType = val; updateCart(); }
function updateCartTax(val) { curTax = parseFloat(val)||0; updateCart(); }

function updatePosPayUI() {
    const creditFields = document.getElementById('posCreditFields');
    if (creditFields) creditFields.style.display = posPaymentMethod === 'credit' ? '' : 'none';
    if (posPaymentMethod === 'credit') updatePosCredit();
}

function updatePosCredit() {
    const taxRate = getTaxRate();
    const subtotal = cart.reduce((s,i) => s+i.unitPrice*i.quantity, 0);
    const itemDiscounts = cart.reduce((s,i) => s+(i.discount||0),0);
    let invDiscount = cartDiscountType==='percent'?(subtotal-itemDiscounts)*cartDiscount/100:cartDiscount;
    const taxable = subtotal - itemDiscounts - invDiscount;
    const tax = curTax || 0;
    const total = taxable + tax;
    const paid = parseFloat(document.getElementById('posPaidInput')?.value)||0;
    const remaining = total - paid;
    const remEl = document.getElementById('posRemaining');
    if (remEl) { remEl.textContent = fmt(remaining); remEl.style.color = remaining > 0 ? 'var(--error)' : 'var(--success)'; }
}

function saveSaleDirect() {
    if (cart.length===0) { toast('السلة فارغة','error'); return; }
    const taxRate = getTaxRate();
    const subtotal = cart.reduce((s,i) => s+i.unitPrice*i.quantity, 0);
    const itemDiscounts = cart.reduce((s,i) => s+(i.discount||0),0);
    let invDiscount = cartDiscountType==='percent'?(subtotal-itemDiscounts)*cartDiscount/100:cartDiscount;
    const taxable = subtotal - itemDiscounts - invDiscount;
    const tax = curTax || 0;
    const total = taxable + tax;
    const method = posPaymentMethod;
    let paidAmount = 0;
    if (method === 'credit') {
        paidAmount = parseFloat(document.getElementById('posPaidInput')?.value)||0;
    } else {
        paidAmount = total;
    }

    if (method==='credit' && !posCustomerId) { toast('اختر عميل للبيع الآجل','error'); return; }

    const remaining = total - paidAmount;
    const status = paidAmount >= total ? 'paid' : method==='credit'?'pending':'partial';

    const invoice = {
        id:uid(), invoiceNumber:nextInvoiceNumber(), items:[...cart],
        subtotal, discount:invDiscount+itemDiscounts, taxAmount:tax, total,
        paidAmount, remainingAmount:remaining,
        paymentMethod: method==='cash'?'نقدي':'آجل',
        status, type:'sale', customerId:posCustomerId,
        customerName:posCustomerName==='عميلنقدي'?'':posCustomerName,
        notes: posNotes || '',
        createdBy: currentUser?.username || '',
        createdAt:new Date().toISOString()
    };

    const invoices = DB.get('invoices');
    invoices.unshift(invoice);
    DB.set('invoices', invoices);

    const products = DB.get('products');
    const movements = DB.get('movements') || [];
    cart.forEach(item => {
        const p = products.find(x => x.id===item.productId);
        if (p) {
            p.quantity = Math.max(0, p.quantity - item.quantity);
            movements.unshift({ id:uid(), productId:p.id, productName:p.name, type:'sale', quantity:-item.quantity, invoiceNumber:invoice.invoiceNumber, date:new Date().toISOString() });
        }
    });
    DB.set('products', products);
    DB.set('movements', movements);

    if (method==='credit' && posCustomerId) {
        const customers = DB.get('customers');
        const cust = customers.find(c => c.id===posCustomerId);
        if (cust) { cust.balance = (cust.balance||0) + remaining; DB.set('customers', customers); }
    }

    if (posCustomerId) {
        const customers = DB.get('customers');
        const cust = customers.find(c => c.id===posCustomerId);
        if (cust) { cust.loyaltyPoints = (cust.loyaltyPoints||0) + Math.floor(total/10); DB.set('customers', customers); }
    }

    cart=[]; posCustomerId=''; posCustomerName=''; cartDiscount=0; cartDiscountType='amount'; posPaymentMethod='cash'; posNotes='';
    toast('تم حفظ الفاتورة','success');
    window._lastInvoice = invoice;
    openModal('تم الحفظ', `
        <div style="text-align:center;padding:8px 0">
            <span class="material-icons-round" style="font-size:48px;color:var(--success)">check_circle</span>
            <p style="margin-top:8px;font-size:14px">فاتورة رقم <strong>${invoice.invoiceNumber}</strong></p>
            <p style="font-size:12px;color:var(--text-secondary)">${fmt(invoice.total)}</p>
        </div>
        `, `<button class="btn btn-primary" onclick="confirmPrint('${invoice.id}');closeModal()"><span class="material-icons-round">print</span> طباعة إيصال</button><button class="btn btn-success" onclick="shareInvoiceWhatsapp('${invoice.id}');closeModal()"><span class="material-icons-round">share</span> واتساب</button><button class="btn btn-outline" onclick="closeModal()">إغلاق</button>`);
    setTimeout(()=>showScreen('invoices'),100);
}

function saveQuote() {
    if (cart.length===0) { toast('السلة فارغة','error'); return; }
    const subtotal = cart.reduce((s,i)=>s+i.unitPrice*i.quantity,0);
    const itemDiscounts = cart.reduce((s,i)=>s+(i.discount||0),0);
    const invDiscount = cartDiscountType==='percent'?(subtotal-itemDiscounts)*cartDiscount/100:cartDiscount;
    const taxable = subtotal - itemDiscounts - invDiscount;
    const tax = curTax || 0;
    const total = taxable + tax;
    const quote = {
        id:uid(), quoteNumber:nextQuoteNumber(), items:[...cart],
        subtotal, discount:invDiscount+itemDiscounts, taxAmount:tax, total,
        customerId:posCustomerId, customerName:posCustomerName==='عميلنقدي'?'':posCustomerName,
        notes:posNotes||'', status:'quote', createdAt:new Date().toISOString()
    };
    const quotes = DB.get('quotes'); quotes.unshift(quote); DB.set('quotes', quotes);
    cart=[]; posCustomerId=''; posCustomerName=''; cartDiscount=0; cartDiscountType='amount'; posPaymentMethod='cash'; posNotes='';
    toast('تم حفظ عرض السعر','success');
    setTimeout(()=>showScreen('quotes'),100);
}
function convertQuoteToInvoice(id) {
    const quotes = DB.get('quotes');
    const q = quotes.find(x=>x.id===id);
    if (!q) return;
    if (q.status==='converted') { toast('هذه العرض حولت بالفعل','error'); return; }
    cart = q.items.map(it=>({ productId:it.productId, productName:it.productName, unitPrice:it.unitPrice, quantity:it.quantity, discount:it.discount||0, taxRate:getTaxRate(), buy: it.buy || it.unitPrice }));
    posCustomerId = q.customerId||''; posCustomerName = q.customerName||'عميلنقدي';
    cartDiscountType='amount'; cartDiscount=0; curTax = q.taxAmount||0;
    posMode='invoice'; editingInvoiceId=null; editingIsReturn=false;
    DB.set('quotes', quotes.map(x=>x.id===id?{...x,status:'converted'}:x));
    showScreen('pos'); updateCart();
    toast('تم تحميل العرض كفاتورة — اضغط حفظ');
}
function renderQuotes(area) {
    const quotes = DB.get('quotes');
    const open = quotes.filter(q=>q.status!=='converted').sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
    area.innerHTML = `
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:10px">
            <button class="btn btn-sm btn-outline" onclick="showScreen('dashboard')"><span class="material-icons-round" style="font-size:16px">arrow_forward</span></button>
            <h2 style="font-size:16px;font-weight:800"><span class="material-icons-round" style="vertical-align:middle;color:var(--primary);font-size:18px">request_quote</span> عروض الأسعار والطلبيات</h2>
        </div>
        ${open.length===0?'<div style="text-align:center;padding:40px;color:var(--text-secondary)"><span class="material-icons-round" style="font-size:48px">description</span><p style="margin-top:8px">لا توجد عروض أسعار</p></div>':
        `<div class="section-card"><div class="table-container"><table id="quotesTable"><thead><tr><th>رقم</th><th>العميل</th><th>الإجمالي</th><th>التاريخ</th><th>إجراءات</th></tr></thead><tbody>
        ${open.map(q=>`<tr>
            <td><strong>${q.quoteNumber}</strong></td>
            <td>${q.customerName||'نقدي'}</td>
            <td style="font-weight:700">${fmt(q.total)}</td>
            <td>${fmtDate(q.createdAt)}</td>
            <td style="white-space:nowrap">
                <button class="btn btn-xs btn-primary" onclick="convertQuoteToInvoice('${q.id}')" title="تحويل لفاتورة"><span class="material-icons-round" style="font-size:14px">receipt_long</span></button>
                <button class="btn btn-xs btn-outline" onclick="printQuote('${q.id}')" title="طباعة"><span class="material-icons-round" style="font-size:14px">print</span></button>
                <button class="btn btn-xs btn-danger" onclick="confirmModal('حذف عرض السعر؟', ()=>deleteQuote('${q.id}'))" title="حذف"><span class="material-icons-round" style="font-size:14px">delete</span></button>
            </td>
        </tr>`).join('')}
        </tbody></table></div>`}`;
}
function deleteQuote(id) {
    DB.set('quotes', DB.get('quotes').filter(q=>q.id!==id));
    toast('تم الحذف'); renderScreen(currentScreen);
}
function printQuote(id) {
    const q = DB.get('quotes').find(x=>x.id===id); if (!q) return;
    const inv = { invoiceNumber:'عرض '+q.quoteNumber, createdAt:q.createdAt, customerName:q.customerName||'نقدي', items:q.items, subtotal:q.subtotal, discount:q.discount, taxAmount:q.taxAmount, total:q.total, paidAmount:0, remainingAmount:q.total };
    printReceipt(inv);
}

function saveEditSale(id, printAfter) {
    if (cart.length===0) { toast('السلة فارغة','error'); return; }
    const invoices = DB.get('invoices');
    const idx = invoices.findIndex(i => i.id === id);
    if (idx < 0) return;
    const oldInv = invoices[idx];

    const products = DB.get('products');
    oldInv.items.forEach(item => { const p = products.find(x => x.id === item.productId); if (p) p.quantity += (oldInv.isReturn ? -item.quantity : item.quantity); });

    const taxRate = getTaxRate();
    const subtotal = cart.reduce((s,i) => s+i.unitPrice*i.quantity, 0);
    const itemDiscounts = cart.reduce((s,i) => s+(i.discount||0),0);
    let invDiscount = cartDiscountType==='percent'?(subtotal-itemDiscounts)*cartDiscount/100:cartDiscount;
    const taxable = subtotal - itemDiscounts - invDiscount;
    const tax = curTax || 0;
    const total = taxable + tax;
    const method = posPaymentMethod;
    let paidAmount = method==='cash' ? total : parseFloat(document.getElementById('posPaidInput')?.value)||0;
    if (method==='credit' && !posCustomerId) { toast('اختر عميل للبيع الآجل','error'); return; }
    const remaining = total - paidAmount;
    const status = paidAmount >= total ? 'paid' : method==='credit'?'pending':'partial';

    oldInv.items = [...cart];
    oldInv.subtotal = subtotal;
    oldInv.discount = invDiscount + itemDiscounts;
    oldInv.taxAmount = tax;
    oldInv.total = total;
    oldInv.paidAmount = paidAmount;
    const oldRemainingAmt = oldInv.remainingAmount || 0;
    oldInv.remainingAmount = remaining;
    oldInv.paymentMethod = method==='cash'?'نقدي':'آجل';
    oldInv.status = status;
    oldInv.customerId = posCustomerId;
    oldInv.customerName = posCustomerName==='عميلنقدي'?'':posCustomerName;
    oldInv.notes = posNotes || '';
    oldInv.isReturn = editingIsReturn;

    if (editingIsReturn) {
        cart.forEach(item => { const p = products.find(x => x.id===item.productId); if (p) p.quantity += item.quantity; });
    } else {
        cart.forEach(item => { const p = products.find(x => x.id===item.productId); if (p) p.quantity = Math.max(0, p.quantity - item.quantity); });
    }
    DB.set('products', products);

    if (posCustomerId) {
        const customers = DB.get('customers');
        const c = customers.find(x => x.id===posCustomerId);
        if (c) {
            c.balance = (c.balance||0) - oldRemainingAmt + remaining;
            DB.set('customers', customers);
        }
    }

    DB.set('invoices', invoices);
    cart=[]; posCustomerId=''; posCustomerName=''; cartDiscount=0; cartDiscountType='amount'; posPaymentMethod='cash'; posNotes=''; editingInvoiceId=null;
    toast('تم تحديث الفاتورة','success');

    if (printAfter) {
        window._lastInvoice = oldInv;
        openModal('تم الحفظ والطباعة', `
            <div style="text-align:center;padding:8px 0">
                <span class="material-icons-round" style="font-size:48px;color:var(--success)">check_circle</span>
                <p style="margin-top:8px;font-size:14px">فاتورة رقم <strong>${oldInv.invoiceNumber}</strong></p>
                <p style="font-size:12px;color:var(--text-secondary)">${fmt(oldInv.total)}</p>
            </div>
    `, `<button class="btn btn-primary" onclick="printReceipt(window._lastInvoice);closeModal()"><span class="material-icons-round">print</span> طباعة إيصال</button><button class="btn btn-success" onclick="shareInvoiceWhatsapp('${oldInv.id}');closeModal()"><span class="material-icons-round">share</span> واتساب</button><button class="btn btn-outline" onclick="closeModal()">إغلاق</button>`);
    }
    setTimeout(()=>showScreen('invoices'),100);
}

function printCurrentPosCart() {
    if (!cart.length) { toast('السلة فارغة', 'error'); return; }
    const s = DB.getOne('settings') || {};
    const subtotal = cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
    const itemDiscounts = cart.reduce((sum, item) => sum + (item.discount || 0), 0);
    const invDiscount = cartDiscountType === 'percent' ? (subtotal - itemDiscounts) * cartDiscount / 100 : cartDiscount;
    const taxable = subtotal - itemDiscounts - invDiscount;
    const tax = curTax || 0;
    const total = taxable + tax;
    const inv = {
        invoiceNumber: 'مسودة', createdAt: new Date().toISOString(), customerName: posCustomerName || 'نقدي',
        items: cart.map(item => ({ productName: item.name, quantity: item.quantity, unitPrice: item.unitPrice, discount: item.discount || 0 })),
        subtotal: taxable, discount: invDiscount, taxAmount: tax, total, paidAmount: 0, remainingAmount: total
    };
    printReceipt(inv);
}

function printReceipt(inv) {
    if (!inv) return;
    const s = DB.getOne('settings') || {};
    if (s.bluetoothThermal) {
        if (!btChar) { toast('الطابعة الحرارية غير متصلة — فعّل الاتصال من الإعدادات', 'error'); return; }
        printThermalReceipt(inv, 'sale');
        return;
    }
    openSaleWindow(inv);
}
function openSaleWindow(inv) {
    if (!inv) return;
    const s = DB.getOne('settings') || {};
    const logoHtml = s.storeLogo ? `<img src="${s.storeLogo}" style="width:60px;height:60px;object-fit:contain;margin-bottom:4px;border-radius:8px">` : `<div style="width:50px;height:50px;margin:0 auto 4px;border-radius:50%;background:linear-gradient(135deg,#2563EB,#7C3AED);display:flex;align-items:center;justify-content:center"><span style="font-size:20px;color:white;font-weight:800">${(s.storeName||s.companyName||'م')[0]}</span></div>`;
    const itemsHtml = inv.items.map(item => {
        const lineTotal = item.unitPrice * item.quantity - (item.discount||0);
        const discText = item.discount > 0 ? `\n  <span style="color:#EF4444;font-size:10px">خصم: -${fmt(item.discount)}</span>` : '';
        return `<div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:3px;border-bottom:1px dotted #eee;padding-bottom:3px"><div style="flex:1"><div style="font-weight:600">${item.productName}</div><div style="font-size:10px;color:#666">${item.quantity} × ${fmt(item.unitPrice)}${discText}</div></div><div style="font-weight:700">${fmt(lineTotal)}</div></div>`;
    }).join('');
    const receiptHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>إيصال</title><style>
        @page{size:80mm auto;margin:0}
        body{font-family:'Cairo','Courier New',monospace;text-align:center;padding:8px 6px;max-width:302px;margin:0 auto;font-size:12px;color:#1a1a1a}
        .line{border-top:1px dashed #ccc;margin:6px 0}
        .total{font-size:15px;font-weight:bold;border-top:2px solid #000;margin-top:6px;padding-top:6px}
        .footer{margin-top:8px;font-size:10px;color:#888;border-top:1px dashed #ccc;padding-top:6px}
    </style></head><body>
        ${logoHtml}
        <h2 style="font-size:15px;margin:0;font-weight:800">${s.storeName||s.companyName||''}</h2>
        <p style="margin:2px 0;font-size:10px;color:#666">${s.storePhone||''}${s.storePhone&&s.storeAddress?' | ':''}${s.storeAddress||''}</p>
        <div class="line"></div>
        <div style="display:flex;justify-content:space-between;font-size:11px"><div style="text-align:right"><strong>فاتورة #${inv.invoiceNumber}</strong></div><div>${fmtDate(inv.createdAt)}</div></div>
        <div style="text-align:right;font-size:11px;color:#666;margin-top:2px">العميل: ${inv.customerName||'نقدي'}</div>
        <div style="text-align:right;font-size:11px;color:#666">الدفع: ${inv.paymentMethod==='cash'?'نقداً':'آجل'}</div>
        <div class="line"></div>
        ${itemsHtml}
        <div class="line"></div>
        <div style="display:flex;justify-content:space-between;font-size:11px"><span>المجموع الفرعي</span><span>${fmt(inv.subtotal||inv.total)}</span></div>
        ${inv.discount>0?`<div style="display:flex;justify-content:space-between;font-size:11px"><span>الخصم</span><span style="color:#EF4444">-${fmt(inv.discount)}</span></div>`:''}
        ${inv.taxAmount>0?`<div style="display:flex;justify-content:space-between;font-size:11px"><span>الضريبة</span><span>${fmt(inv.taxAmount)}</span></div>`:''}
        <div class="total" style="display:flex;justify-content:space-between"><span>الإجمالي</span><span>${fmt(inv.total)}</span></div>
        <div style="display:flex;justify-content:space-between;font-size:11px;margin-top:3px"><span>المدفوع</span><span style="font-weight:600">${fmt(inv.paidAmount)}</span></div>
        ${inv.remainingAmount>0?`<div style="display:flex;justify-content:space-between;font-size:11px;color:#EF4444"><span>المتبقي</span><span style="font-weight:700">${fmt(inv.remainingAmount)}</span></div>`:''}
        <div class="footer">
            <p style="margin:0">شكراً لزيارتكم</p>
            <p style="margin:2px 0 0;font-size:9px">${s.storeName||''} | ${fmtDateTime(inv.createdAt)}</p>
        </div>
        <script>window.onload=function(){window.print();setTimeout(()=>window.close(),500)}<\/script>
    </body></html>`;
    const w = window.open('','_blank');
    w.document.write(receiptHtml);
    w.document.close();
}

function printInvoiceById(id) {
    const inv = DB.get('invoices').find(i=>i.id===id);
    if (inv) printReceipt(inv);
}

function confirmPrint(invId) {
    const inv = DB.get('invoices').find(i=>i.id===invId);
    if (inv) printReceipt(inv);
}

function printPurchaseInvoiceById(id) {
    const inv = DB.get('invoices').find(i=>i.id===id);
    if (inv) printPurchaseReceipt(inv);
}

function shareInvoiceWhatsapp(id) {
    const inv = DB.get('invoices').find(i=>i.id===id);
    if (!inv) { toast('الفاتورة غير موجودة','error'); return; }
    const type = inv.type==='purchase' ? 'فاتورة شراء' : 'فاتورة بيع';
    const R = '‏';
    let txt = `${R}*${type} #${inv.invoiceNumber}*\n`;
    txt += `التاريخ: ${fmtDate(inv.createdAt)}\n`;
    txt += `الطرف: ${inv.customerName || (inv.type==='purchase'?'—':'نقدي')}\n`;
    txt += `————————\n`;
    (inv.items||[]).forEach(it => {
        const line = it.unitPrice*it.quantity - (it.discount||0);
        txt += `${it.productName} × ${it.quantity} @ ${fmt(it.unitPrice)}${it.discount>0?` (خصم ${fmt(it.discount)})`:''} = ${fmt(line)}\n`;
    });
    txt += `————————\n`;
    if (inv.discount>0) txt += `الخصم: ${fmt(inv.discount)}\n`;
    if (inv.taxAmount>0) txt += `الضريبة: ${fmt(inv.taxAmount)}\n`;
    txt += `الإجمالي: ${fmt(inv.total)}\n`;
    if (inv.remainingAmount>0) txt += `المتبقي: ${fmt(inv.remainingAmount)}\n`;
    const url = 'https://api.whatsapp.com/send?text=' + encodeURIComponent(txt);
    window.open(url, '_blank');
}

function updateCart() {
    const el = document.getElementById('cartItems');
    if (!el) return;

    if (cart.length===0) {
        el.innerHTML = '<div class="empty-state" style="padding:32px 16px"><span class="material-icons-round" style="font-size:44px;opacity:0.12">shopping_basket</span><h3 style="margin-top:6px">السلة فارغة</h3><p>ابحث عن منتج أو امسح الباركود</p></div>';
    } else {
        el.innerHTML = cart.map((item,i) => `
            <div style="display:flex;align-items:center;gap:6px;padding:8px;background:var(--bg);border-radius:var(--radius-sm);margin-bottom:4px;border:1px solid var(--border-light);transition:var(--transition)">
                <div style="flex:1;min-width:0">
                    <div style="font-weight:700;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--text)">${item.productName}</div>
                    <div style="font-size:10px;color:var(--text-muted);margin-top:1px">
                        ${fmt(item.unitPrice)} للقطعة${item.discount>0?` <span style="color:var(--error);font-weight:600">-${fmt(item.discount)}</span>`:''}
                    </div>
                </div>
                <div style="display:flex;align-items:center;gap:2px;flex-shrink:0;background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-sm);padding:2px">
                    <button class="qty-btn" onclick="updateCartQty(${i},-1)" style="width:24px;height:24px;border:none;background:transparent;color:var(--primary);font-size:14px;cursor:pointer;border-radius:4px;display:flex;align-items:center;justify-content:center;font-weight:700">-</button>
                    <span style="font-weight:800;min-width:20px;text-align:center;font-size:13px;color:var(--text)">${item.quantity}</span>
                    <button class="qty-btn" onclick="updateCartQty(${i},1)" style="width:24px;height:24px;border:none;background:transparent;color:var(--primary);font-size:14px;cursor:pointer;border-radius:4px;display:flex;align-items:center;justify-content:center;font-weight:700">+</button>
                </div>
                <div style="font-weight:800;font-size:13px;color:var(--primary);min-width:65px;text-align:left;flex-shrink:0">${fmt((item.unitPrice*item.quantity)-item.discount)}</div>
                <button onclick="removeFromCart(${i})" style="background:none;border:none;color:var(--text-muted);cursor:pointer;padding:4px;border-radius:4px;transition:var(--transition);flex-shrink:0" onmouseover="this.style.color='var(--error)'" onmouseout="this.style.color='var(--text-muted)'"><span class="material-icons-round" style="font-size:16px">close</span></button>
            </div>`).join('');
    }
    const taxRate = getTaxRate();
    const subtotal = cart.reduce((s,i) => s + i.unitPrice*i.quantity, 0);
    const itemDiscounts = cart.reduce((s,i) => s + (i.discount||0), 0);
    let invDiscount = 0;
    if (cartDiscountType==='percent') invDiscount = (subtotal-itemDiscounts) * cartDiscount / 100;
    else invDiscount = cartDiscount;
    const taxable = subtotal - itemDiscounts - invDiscount;
    const tax = curTax || 0;
    const total = taxable + tax;

    const countEl = document.getElementById('cartCount');
    if (countEl) countEl.textContent = cart.length + ' أصناف';
    const sub = document.getElementById('cartSubtotal');
    if (sub) sub.textContent = fmt(subtotal);
    const disc = document.getElementById('cartDiscountDisplay');
    if (disc) disc.textContent = fmt(itemDiscounts + invDiscount);
    const taxEl = document.getElementById('cartTax');
    if (taxEl) taxEl.textContent = fmt(tax);
    const totalEl = document.getElementById('cartTotal');
    if (totalEl) totalEl.textContent = fmt(total);
    if (posPaymentMethod === 'credit') updatePosCredit();
}

// ==================== HOLD INVOICE ====================
function holdInvoice() {
    if (cart.length===0) { toast('السلة فارغة','error'); return; }
    const held = DB.getOne('heldInvoices') || [];
    const subtotal = cart.reduce((s,i) => s+i.unitPrice*i.quantity, 0);
    const itemDiscounts = cart.reduce((s,i) => s+(i.discount||0), 0);
    let invDiscount = cartDiscountType==='percent'?(subtotal-itemDiscounts)*cartDiscount/100:cartDiscount;
    const taxable = subtotal - itemDiscounts - invDiscount;
    const total = taxable + (curTax||0);
    held.push({ items:[...cart], customerId:posCustomerId, customerName:posCustomerName, discount:cartDiscount, discountType:cartDiscountType, tax:curTax||0, total, createdAt:new Date().toISOString() });
    DB.setOne('heldInvoices', held);
    cart=[]; posCustomerId=''; posCustomerName=''; cartDiscount=0; curTax=0; cartDiscountType='amount';
    toast('تم تعليق الفاتورة');
    renderPOS(document.getElementById('contentArea'));
}

function resumeHeld(idx) {
    const held = DB.getOne('heldInvoices') || [];
    const h = held[idx];
    if (!h) return;
    cart = [...h.items];
    posCustomerId = h.customerId || '';
    posCustomerName = h.customerName || '';
    cartDiscount = h.discount || 0;
    cartDiscountType = h.discountType || 'amount';
    curTax = h.tax || 0;
    held.splice(idx,1);
    DB.setOne('heldInvoices', held);
    posMode = 'invoice';
    posPaymentMethod = 'cash';
    renderPOS(document.getElementById('contentArea'));
}

function removeHeld(idx) {
    const held = DB.getOne('heldInvoices') || [];
    held.splice(idx,1);
    DB.setOne('heldInvoices', held);
    renderPOS(document.getElementById('contentArea'));
}

// ==================== PAYMENT MODAL ====================
function openPaymentModal() {
    if (cart.length===0) { toast('السلة فارغة','error'); return; }
    const taxRate = getTaxRate();
    const subtotal = cart.reduce((s,i) => s+i.unitPrice*i.quantity, 0);
    const itemDiscounts = cart.reduce((s,i) => s+(i.discount||0),0);
    let invDiscount = cartDiscountType==='percent'?(subtotal-itemDiscounts)*cartDiscount/100:cartDiscount;
    const taxable = subtotal - itemDiscounts - invDiscount;
    const tax = curTax || 0;
    const total = taxable + tax;

    openModal('إتمام البيع', `
        <div style="text-align:center;margin-bottom:16px"><div style="font-size:13px;color:var(--text-secondary)">الإجمالي</div><div style="font-size:28px;font-weight:800;color:var(--primary)">${fmt(total)}</div></div>
        <div class="payment-methods" id="paymentMethods">
            <div class="payment-method active" onclick="selectPayment('cash',this)"><span class="material-icons-round">payments</span><div class="label">نقدي</div></div>
            <div class="payment-method" onclick="selectPayment('card',this)"><span class="material-icons-round">credit_card</span><div class="label">بطاقة</div></div>
            <div class="payment-method" onclick="selectPayment('check',this)"><span class="material-icons-round">receipt</span><div class="label">شيك</div></div>
            <div class="payment-method" onclick="selectPayment('credit',this)"><span class="material-icons-round">schedule</span><div class="label">آجل</div></div>
        </div>
        <div id="paymentCashSection">
            <div class="form-group"><label>المبلغ المدفوع</label><input class="form-control" type="number" id="paidAmount" value="${total.toFixed(2)}" onchange="calcChange()" oninput="calcChange()"></div>
            <div style="display:flex;justify-content:space-between;padding:8px 0;border-top:1px solid var(--border);font-size:14px"><span>المتبقي للعميل:</span><strong id="changeAmount" style="color:var(--success)">0.00 ج.م</strong></div>
        </div>
        <div id="paymentCreditSection" style="display:none">
            <div class="form-group"><label>اسم العميل (مطلوب للآجل)</label><input class="form-control" id="creditCustomerName" value="${posCustomerName}"></div>
            <div style="padding:10px;background:rgba(245,158,11,0.1);border-radius:8px;font-size:12px;color:var(--accent)"><span class="material-icons-round" style="font-size:16px;vertical-align:middle">info</span> سيتم تسجيل المبلغ كدين على حساب العميل</div>
        </div>
    `, `<button class="btn btn-success btn-block" onclick="completeSale()"><span class="material-icons-round">check_circle</span> تأكيد البيع</button>`);
    window._payMethod = 'cash'; window._payTotal = total;
    setTimeout(() => calcChange(), 100);
}

function selectPayment(method, el) {
    document.querySelectorAll('.payment-method').forEach(e => e.classList.remove('active'));
    el.classList.add('active');
    window._payMethod = method;
    document.getElementById('paymentCashSection').style.display = method==='credit'?'none':'block';
    document.getElementById('paymentCreditSection').style.display = method==='credit'?'block':'none';
    if (method==='credit') document.getElementById('paidAmount').value = '0';
    else document.getElementById('paidAmount').value = window._payTotal.toFixed(2);
    calcChange();
}

function calcChange() {
    const paid = parseFloat(document.getElementById('paidAmount')?.value)||0;
    const total = window._payTotal || 0;
    const change = paid - total;
    const el = document.getElementById('changeAmount');
    if (el) { el.textContent = change>=0 ? fmt(change) : fmt(Math.abs(change))+' (المتبقي)'; el.style.color = change>=0?'var(--success)':'var(--error)'; }
}

function completeSale() {
    if (cart.length===0) { toast('السلة فارغة','error'); return; }
    const taxRate = getTaxRate();
    const subtotal = cart.reduce((s,i) => s+i.unitPrice*i.quantity, 0);
    const itemDiscounts = cart.reduce((s,i) => s+(i.discount||0),0);
    let invDiscount = cartDiscountType==='percent'?(subtotal-itemDiscounts)*cartDiscount/100:cartDiscount;
    const taxable = subtotal - itemDiscounts - invDiscount;
    const tax = curTax || 0;
    const total = taxable + tax;
    const paidAmount = parseFloat(document.getElementById('paidAmount')?.value)||0;
    const method = window._payMethod || 'cash';

    if (method==='credit' && !posCustomerId) { toast('اختر عميل للبيع الآجل','error'); return; }

    const invoice = {
        id:uid(), invoiceNumber:nextInvoiceNumber(), items:[...cart],
        subtotal, discount:invDiscount+itemDiscounts, taxAmount:tax, total,
        paidAmount: method==='credit'?0:paidAmount,
        remainingAmount: method==='credit'?total:Math.max(0,total-paidAmount),
        paymentMethod: method==='cash'?'نقدي':method==='card'?'بطاقة':method==='check'?'شيك':'آجل',
        status: paidAmount>=total?'paid':method==='credit'?'pending':'partial',
        type:'sale', customerId:posCustomerId,
        customerName:posCustomerName==='عميلنقدي'?'':posCustomerName,
        createdBy: currentUser?.username || '',
        createdAt:new Date().toISOString()
    };

    const invoices = DB.get('invoices');
    invoices.unshift(invoice);
    DB.set('invoices', invoices);

    // Update stock & log movements
    const products = DB.get('products');
    const movements = DB.get('movements') || [];
    cart.forEach(item => {
        const p = products.find(x => x.id===item.productId);
        if (p) {
            p.quantity = Math.max(0, p.quantity - item.quantity);
            movements.unshift({ id:uid(), productId:p.id, productName:p.name, type:'sale', quantity:-item.quantity, invoiceNumber:invoice.invoiceNumber, date:new Date().toISOString() });
        }
    });
    DB.set('products', products);
    DB.set('movements', movements);

    // Update customer balance
    if (method==='credit' && posCustomerId) {
        const customers = DB.get('customers');
        const cust = customers.find(c => c.id===posCustomerId);
        if (cust) { cust.balance = (cust.balance||0) + (total - paidAmount); DB.set('customers', customers); }
    }

    // Loyalty points
    if (posCustomerId) {
        const customers = DB.get('customers');
        const cust = customers.find(c => c.id===posCustomerId);
        if (cust) { cust.loyaltyPoints = (cust.loyaltyPoints||0) + Math.floor(total/10); DB.set('customers', customers); }
    }

    closeModal();
    cart=[]; posCustomerId=''; posCustomerName=''; cartDiscount=0;

    // Simulate cash drawer
    if (method==='cash') toast('تم فتح درج النقود');

    toast('تم إتمام البيع بنجاح');
    posMode = 'list';
    renderPOS(document.getElementById('contentArea'));
}

// ==================== EDIT/DELETE INVOICES ====================
function deleteInvoice(id) {
    confirmModal('هل أنت متأكد من حذف هذه الفاتورة؟ سيتم رد المنتجات للمخزون', function() {
    const invoices = DB.get('invoices');
    const inv = invoices.find(i => i.id === id);
    if (!inv) return;
    moveToTrash('invoice', id);

    // Return stock
    if (inv.type === 'sale') {
        const products = DB.get('products');
        if (inv.isReturn) {
            inv.items.forEach(item => { const p = products.find(x => x.id === item.productId); if (p) p.quantity = Math.max(0, p.quantity - item.quantity); });
        } else {
            inv.items.forEach(item => { const p = products.find(x => x.id === item.productId); if (p) p.quantity += item.quantity; });
        }
        DB.set('products', products);
        // Reverse customer balance for credit
        if ((inv.paymentMethod === 'آجل' || inv.paymentMethod === 'credit') && inv.customerId) {
            const customers = DB.get('customers');
            const c = customers.find(x => x.id === inv.customerId);
            if (c) { c.balance = (c.balance || 0) - (inv.remainingAmount||0); DB.set('customers', customers); }
        }
    } else if (inv.type === 'purchase') {
        const products = DB.get('products');
        if (inv.isReturn) {
            inv.items.forEach(item => { const p = products.find(x => x.id === item.productId); if (p) p.quantity += item.quantity; });
        } else {
            inv.items.forEach(item => { const p = products.find(x => x.id === item.productId); if (p) p.quantity = Math.max(0, p.quantity - item.quantity); });
        }
        DB.set('products', products);
        if (inv.customerId) {
            const suppliers = DB.get('suppliers');
            const s = suppliers.find(x => x.id === inv.customerId);
            if (s) { s.balance = (s.balance || 0) - (inv.remainingAmount||0); DB.set('suppliers', suppliers); }
        }
    }

    // Remove movement logs
    const movements = DB.get('movements') || [];
    DB.set('movements', movements.filter(m => m.invoiceNumber !== inv.invoiceNumber));

    DB.set('invoices', invoices.filter(i => i.id !== id));
    toast('تم حذف الفاتورة');
    renderScreen(currentScreen);
    });
}

function editInvoice(id) {
    const invoices = DB.get('invoices');
    const inv = invoices.find(i => i.id === id);
    if (!inv) return;

    if (inv.type === 'sale') {
        cart = inv.items.map(item => ({ productId: item.productId, productName: item.productName, unitPrice: item.unitPrice, quantity: item.quantity, discount: item.discount || 0, taxRate: 0, buy: item.buy || item.unitPrice }));
        posCustomerId = inv.customerId || '';
        posCustomerName = inv.customerName || '';
        cartDiscount = inv.discount || 0;
        cartDiscountType = 'amount';
        posPaymentMethod = inv.paymentMethod === 'نقدي' ? 'cash' : 'credit';
        posNotes = inv.notes || '';
        editingInvoiceId = id;
        editingIsReturn = inv.isReturn || false;
        posMode = 'invoice';
        renderPOS(document.getElementById('contentArea'));
        const pp = document.getElementById('posPaidInput'); if (pp) pp.value = inv.paidAmount||0;
        updatePosCredit();
    } else {
        purCart = inv.items.map(item => ({ productId: item.productId, productName: item.productName, unitPrice: item.unitPrice, quantity: item.quantity, discount: item.discount || 0, taxRate: 0, buy: item.buy || item.unitPrice }));
        purSupplierId = inv.customerId || '';
        purSupplierName = inv.customerName || '';
        purDiscount = inv.discount || 0;
        purDiscountType = 'amount';
        purPaymentMethod = inv.paymentMethod === 'نقدي' ? 'cash' : 'credit';
        purNotes = inv.notes || '';
        editingPurInvoiceId = id;
        editingPurIsReturn = inv.isReturn || false;
        purMode = 'invoice';
        renderPurchases(document.getElementById('contentArea'));
        const pp2 = document.getElementById('purPaidInput'); if (pp2) pp2.value = inv.paidAmount||0;
        updatePurCredit();
    }
    closeSidebar();
}

// ==================== PRODUCTS ====================
function renderProducts(area) {
    const products = DB.get('products');
    const categories = DB.get('categories');
    const warehouses = DB.get('warehouses');

    area.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;flex-wrap:wrap;gap:6px">
            <div style="display:flex;align-items:center;gap:6px">
                <button class="btn btn-sm btn-outline" onclick="showScreen('dashboard')"><span class="material-icons-round" style="font-size:16px">arrow_forward</span></button>
                <h2 style="font-size:16px;font-weight:800">الأصناف</h2>
            </div>
            <div style="display:flex;gap:4px;align-items:center">
                <button class="btn btn-sm btn-outline" onclick="openCategoryModal()"><span class="material-icons-round" style="font-size:14px">label</span> التصنيفات</button>
                <button class="btn btn-sm btn-outline" onclick="openUnitModal()"><span class="material-icons-round" style="font-size:14px">straighten</span> الوحدات</button>
                <button class="btn btn-sm btn-outline" onclick="exportInventoryCSV()"><span class="material-icons-round" style="font-size:14px">file_download</span> CSV</button>
                <button class="btn btn-sm btn-outline" onclick="exportInventoryPDF()"><span class="material-icons-round" style="font-size:14px">picture_as_pdf</span> PDF</button>
                ${canDo('pos')?`<button class="btn btn-sm btn-primary" onclick="openProductModal()"><span class="material-icons-round">add</span> إضافة</button>`:''}
            </div>
        </div>
        <div style="margin-bottom:10px"><input class="form-control" placeholder="بحث بالاسم أو الباركود..." oninput="filterProducts(this.value)" id="productSearch" style="font-size:13px;padding:8px 12px"></div>
        ${categories.length>0?`<div class="filter-tabs"><button class="filter-tab active" onclick="filterByCategory(null,this)">الكل</button>${categories.map(c=>`<button class="filter-tab" onclick="filterByCategory('${c.id}',this)">${c.name}</button>`).join('')}</div>`:''}
        <div class="inventory-cards" id="inventoryCards">${products.map(p => {
            const cat = categories.find(c=>c.id===p.categoryId);
            const wh = warehouses.find(w=>w.id===p.warehouseId);
            const isLow = p.quantity<=p.minQuantity;
            let expiryHtml = '';
            if (p.expiryDate) {
                const days = Math.ceil((new Date(p.expiryDate)-new Date())/(1000*60*60*24));
                if (days<=0) expiryHtml = '<span class="expiry-badge">منتهي الصلاحية</span>';
                else if (days<=30) expiryHtml = `<span class="expiry-badge">ينتهي خلال ${days} يوم</span>`;
            }
            return `<div class="inv-card ${isLow?'low':''}" data-name="${p.name}" data-barcode="${p.barcode||''}" data-category="${p.categoryId}">
                <div class="inv-header">
                    <div style="display:flex;align-items:center;gap:8px;flex:1">
                        ${p.image?`<div style="width:40px;height:40px;border-radius:8px;background-image:url(${p.image});background-size:cover;flex-shrink:0"></div>`:''}
                        <div class="inv-name">${p.name}</div>
                    </div>
                    ${expiryHtml}
                </div>
                <div class="inv-details"><span>شراء: ${fmt(p.buyingPrice)}</span><span>بيع: ${fmt(p.sellingPrice)}</span><span style="color:${isLow?'var(--error)':'var(--success)'};font-weight:700">كمية: ${p.quantity}</span></div>
                <div class="inv-details" style="margin-top:4px"><span>${cat?cat.name:''}</span><span>${wh?wh.name:''}</span><span>${p.unit||'قطعة'}</span></div>
                ${canDo('pos')?`<div style="margin-top:8px;display:flex;gap:4px"><button class="btn btn-sm btn-outline" onclick="openProductModal('${p.id}')">تعديل</button><button class="btn btn-sm btn-danger" onclick="deleteProduct('${p.id}')">حذف</button></div>`:''}
            </div>`;
        }).join('')}</div>
        <div class="section-card"><div class="table-container"><table><thead><tr><th>المنتج</th><th>الشراء</th><th>البيع</th><th>المخزون</th><th>المخزن</th>${canDo('pos')?'<th>إجراءات</th>':''}</tr></thead><tbody id="productsTableBody">
        ${products.map(p => {
            const cat = categories.find(c=>c.id===p.categoryId);
            const wh = warehouses.find(w=>w.id===p.warehouseId);
            const isLow = p.quantity<=p.minQuantity;
            return `<tr data-name="${p.name}" data-barcode="${p.barcode||''}" data-category="${p.categoryId}">
                <td><strong>${p.name}</strong><br><small style="color:var(--text-secondary)">${cat?cat.name:''}</small></td>
                <td>${fmt(p.buyingPrice)}</td><td>${fmt(p.sellingPrice)}</td>
                <td><span class="badge ${isLow?'badge-danger':'badge-success'}">${p.quantity}</span></td>
                <td>${wh?wh.name:'-'}</td>
                ${canDo('pos')?`<td><button class="btn btn-sm btn-outline" onclick="openProductModal('${p.id}')"><span class="material-icons-round">edit</span></button> <button class="btn btn-sm btn-danger" onclick="deleteProduct('${p.id}')"><span class="material-icons-round">delete</span></button></td>`:''}
            </tr>`;
        }).join('')}
        </tbody></table></div></div>`;
}

function openCategoryModal() {
    const categories = DB.get('categories');
    const products = DB.get('products');
    openModal('إدارة التصنيفات', `
        <div style="margin-bottom:12px;display:flex;gap:6px">
            <input class="form-control" id="newCatName" placeholder="اسم التصنيف الجديد" style="flex:1">
            <button class="btn btn-primary" onclick="addCategory()"><span class="material-icons-round">add</span></button>
        </div>
        <div id="categoriesList">
            ${categories.length===0?'<div style="text-align:center;padding:20px;color:var(--text-secondary);font-size:13px">لا توجد تصنيفات بعد</div>':
            categories.map(c => {
                const count = products.filter(p=>p.categoryId===c.id).length;
                return `<div style="display:flex;align-items:center;gap:8px;padding:10px;border-bottom:1px solid var(--border)">
                    <span style="flex:1;font-size:13px;font-weight:600">${c.name}</span>
                    <span style="font-size:11px;color:var(--text-secondary)">${count} منتج</span>
                    <button class="btn btn-sm btn-outline" onclick="editCategory('${c.id}','${c.name}')"><span class="material-icons-round">edit</span></button>
                    <button class="btn btn-sm btn-danger" onclick="deleteCategory('${c.id}')"><span class="material-icons-round">delete</span></button>
                </div>`;
            }).join('')}
        </div>
    `);
}

function addCategory() {
    const name = document.getElementById('newCatName')?.value.trim();
    if (!name) { toast('أدخل اسم التصنيف','error'); return; }
    const categories = DB.get('categories');
    if (categories.find(c=>c.name===name)) { toast('التصنيف موجود مسبقاً','error'); return; }
    categories.push({ id:uid(), name });
    DB.set('categories', categories);
    openCategoryModal();
    toast('تمت الإضافة');
}

function editCategory(id, oldName) {
    const newName = prompt('اسم التصنيف الجديد:', oldName);
    if (!newName || newName.trim() === '' || newName === oldName) return;
    const categories = DB.get('categories');
    const cat = categories.find(c=>c.id===id);
    if (cat) { cat.name = newName.trim(); DB.set('categories', categories); openCategoryModal(); toast('تم التعديل'); }
}

function deleteCategory(id) {
    const products = DB.get('products');
    const count = products.filter(p=>p.categoryId===id).length;
    if (count > 0) { toast(`لا يمكن حذف التصنيف - يوجد ${count} منتج مرتبط به`,'error'); return; }
    confirmModal('هل أنت متأكد من الحذف؟', function() {
        moveToTrash('category', id);
        DB.set('categories', DB.get('categories').filter(c=>c.id!==id));
        openCategoryModal(); toast('تم الحذف');
    });
}

function openUnitModal() {
    const units = DB.get('units');
    const products = DB.get('products');
    openModal('إدارة الوحدات', `
        <div style="margin-bottom:12px;display:flex;gap:6px">
            <input class="form-control" id="newUnitName" placeholder="اسم الوحدة الجديدة (مثل: علبة)" style="flex:1">
            <button class="btn btn-primary" onclick="addUnit()"><span class="material-icons-round">add</span></button>
        </div>
        <div id="unitsList">
            ${units.length===0?'<div style="text-align:center;padding:20px;color:var(--text-secondary);font-size:13px">لا توجد وحدات بعد</div>':
            units.map(u => {
                const count = products.filter(p=>p.unit===u.name).length;
                return `<div style="display:flex;align-items:center;gap:8px;padding:10px;border-bottom:1px solid var(--border)">
                    <span style="flex:1;font-size:13px;font-weight:600">${u.name}</span>
                    <span style="font-size:11px;color:var(--text-secondary)">${count} منتج</span>
                    <button class="btn btn-sm btn-outline" onclick="editUnit('${u.id}','${u.name}')"><span class="material-icons-round">edit</span></button>
                    <button class="btn btn-sm btn-danger" onclick="deleteUnit('${u.id}')"><span class="material-icons-round">delete</span></button>
                </div>`;
            }).join('')}
        </div>
    `);
}

function addUnit() {
    const name = document.getElementById('newUnitName')?.value.trim();
    if (!name) { toast('أدخل اسم الوحدة','error'); return; }
    const units = DB.get('units');
    if (units.find(u=>u.name===name)) { toast('الوحدة موجودة مسبقاً','error'); return; }
    units.push({ id:uid(), name });
    DB.set('units', units);
    openUnitModal();
    toast('تمت الإضافة');
}

function editUnit(id, oldName) {
    const newName = prompt('اسم الوحدة الجديد:', oldName);
    if (!newName || newName.trim() === '' || newName === oldName) return;
    const units = DB.get('units');
    if (units.find(u=>u.name===newName.trim())) { toast('الوحدة موجودة مسبقاً','error'); return; }
    const u = units.find(x=>x.id===id);
    if (u) {
        const old = u.name;
        u.name = newName.trim();
        DB.set('units', units);
        const products = DB.get('products');
        products.forEach(p => { if (p.unit===old) p.unit=newName.trim(); });
        DB.set('products', products);
        openUnitModal(); toast('تم التعديل');
    }
}

function deleteUnit(id) {
    const units = DB.get('units');
    const u = units.find(x=>x.id===id);
    if (!u) return;
    const count = DB.get('products').filter(p=>p.unit===u.name).length;
    if (count > 0) { toast(`لا يمكن حذف الوحدة - يوجد ${count} منتج مرتبط بها`,'error'); return; }
    confirmModal('هل أنت متأكد من الحذف؟', function() {
        DB.set('units', units.filter(x=>x.id!==id));
        openUnitModal(); toast('تم الحذف');
    });
}

function filterProducts(q) {
    q = q.toLowerCase();
    document.querySelectorAll('#productsTableBody tr').forEach(tr => { tr.style.display = (tr.dataset.name?.toLowerCase().includes(q)||tr.dataset.barcode?.includes(q)) ? '' : 'none'; });
    document.querySelectorAll('#inventoryCards .inv-card').forEach(c => { c.style.display = c.textContent.toLowerCase().includes(q) ? '' : 'none'; });
}

function filterByCategory(catId, btn) {
    document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
    document.querySelectorAll('#productsTableBody tr').forEach(tr => { tr.style.display = (!catId||tr.dataset.category===catId)?'':'none'; });
    document.querySelectorAll('#inventoryCards .inv-card').forEach(c => { c.style.display = (!catId||c.dataset.category===catId)?'':'none'; });
}

function openProductModal(id) {
    const products = DB.get('products');
    const categories = DB.get('categories');
    const warehouses = DB.get('warehouses');
    const units = DB.get('units');
    let unitList = units.length ? units.map(u=>u.name) : ['قطعة','علبة','كرتونة'];
    const p = id ? products.find(x=>x.id===id) : null;
    if (p && p.unit && !unitList.includes(p.unit)) unitList = [p.unit, ...unitList];

    openModal(p ? 'تعديل المنتج' : 'إضافة منتج جديد', `
        <div class="form-group"><label>اسم المنتج *</label><input class="form-control" id="pName" value="${p?p.name:''}"></div>
        <div class="form-row">
            <div class="form-group"><label>الباركود</label><input class="form-control" id="pBarcode" value="${p?p.barcode||'':''}"></div>
            <div class="form-group"><label>التصنيف</label><select class="form-control" id="pCategory">${categories.map(c=>`<option value="${c.id}" ${p&&p.categoryId===c.id?'selected':''}>${c.name}</option>`).join('')}</select></div>
        </div>
        <div class="form-row">
            <div class="form-group"><label>سعر الشراء *</label><input class="form-control" type="number" id="pBuy" value="${p?p.buyingPrice:''}"></div>
            <div class="form-group"><label>سعر البيع *</label><input class="form-control" type="number" id="pSell" value="${p?p.sellingPrice:''}"></div>
        </div>
        <div class="form-row">
            <div class="form-group"><label>الكمية</label><input class="form-control" type="number" id="pQty" value="${p?p.quantity:0}"></div>
            <div class="form-group"><label>الحد الأدنى</label><input class="form-control" type="number" id="pMin" value="${p?p.minQuantity:5}"></div>
        </div>
        <div class="form-row">
            <div class="form-group"><label>الوحدة</label><select class="form-control" id="pUnit">${unitList.map(u=>`<option ${p&&p.unit===u?'selected':''}>${u}</option>`).join('')}${!p&&unitList.length?'<option selected>قطعة</option>':''}</select></div>
            <div class="form-group"><label>المخزن</label><select class="form-control" id="pWarehouse">${warehouses.map(w=>`<option value="${w.id}" ${(p&&p.warehouseId===w.id)||(!p&&w.isDefault)?'selected':''}>${w.name}${w.isDefault?' (افتراضي)':''}</option>`).join('')}</select></div>
        </div>
        <div class="form-group"><label>تاريخ انتهاء الصلاحية</label><input class="form-control" type="date" id="pExpiry" value="${p?p.expiryDate||'':''}"></div>
        <div class="form-group"><label>صورة المنتج</label>
            <div style="display:flex;align-items:center;gap:8px">
                <div id="pImagePreview" style="width:60px;height:60px;border-radius:8px;border:1px solid var(--border);display:flex;align-items:center;justify-content:center;overflow:hidden;background:var(--bg)">${p&&p.image?`<img src="${p.image}" style="width:100%;height:100%;object-fit:cover">`:'<span class="material-icons-round" style="color:var(--text-secondary)">image</span>'}</div>
                <div><input type="file" id="pImage" accept="image/*" onchange="previewProductImage(this)" style="display:none"><button class="btn btn-sm btn-outline" onclick="document.getElementById('pImage').click()"><span class="material-icons-round">add_photo_alternate</span> اختر صورة</button></div>
            </div>
        </div>
    `, `<button class="btn btn-primary" onclick="saveProduct('${id||''}')">حفظ</button><button class="btn btn-outline" onclick="closeModal()">إلغاء</button>`);
    if (p) document.getElementById('pUnit').value = p.unit||'قطعة';
}

function previewProductImage(input) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function(e) {
            document.getElementById('pImagePreview').innerHTML = `<img src="${e.target.result}" style="width:100%;height:100%;object-fit:cover">`;
            window._productImage = e.target.result;
        };
        reader.readAsDataURL(input.files[0]);
    }
}

function saveProduct(id) {
    const name = document.getElementById('pName').value.trim();
    if (!name) { toast('أدخل اسم المنتج','error'); return; }
    const products = DB.get('products');
    const existingImage = id ? (products.find(p=>p.id===id))?.image : '';
    const data = {
        name, barcode:document.getElementById('pBarcode').value.trim(),
        categoryId:document.getElementById('pCategory').value,
        buyingPrice:parseFloat(document.getElementById('pBuy').value)||0,
        sellingPrice:parseFloat(document.getElementById('pSell').value)||0,
        quantity:parseInt(document.getElementById('pQty').value)||0,
        minQuantity:parseInt(document.getElementById('pMin').value)||5,
        unit:document.getElementById('pUnit').value,
        warehouseId:document.getElementById('pWarehouse').value,
        expiryDate:document.getElementById('pExpiry').value,
        image: window._productImage || existingImage || '',
        isActive:true,
    };
    window._productImage = null;
    if (id) { const idx=products.findIndex(p=>p.id===id); if(idx>=0) products[idx]={...products[idx],...data}; }
    else products.push({ id:uid(), ...data, units:[{name:data.unit,factor:1,price:data.sellingPrice}], createdAt:new Date().toISOString() });
    DB.set('products', products);
    closeModal(); toast(id?'تم التحديث':'تمت الإضافة');
    renderProducts(document.getElementById('contentArea'));
}

function deleteProduct(id) {
    confirmModal('هل أنت متأكد من حذف هذا المنتج؟', function() {
        moveToTrash('product', id);
        DB.set('products', DB.get('products').filter(p=>p.id!==id));
        toast('تم الحذف'); renderProducts(document.getElementById('contentArea'));
    });
}

// ==================== PURCHASES ====================
let purCart = [];
let purSupplierId = '';
let purSupplierName = '';
let purMode = 'list';
let purDiscount = 0;
let purDiscountType = 'amount';
let purPaymentMethod = 'cash';
let purNotes = '';
let editingPurInvoiceId = null;
let poContext = null;
let editingPurIsReturn = false;

function renderPurchases(area) {
    const purchaseInvoices = DB.get('invoices').filter(i=>i.type==='purchase');
    const held = DB.getOne('heldPurchases') || [];
    const totalPurchases = purchaseInvoices.reduce((s,i) => s + (i.isReturn ? -Math.abs(i.total) : i.total), 0);

    if (purMode==='list') {
        area.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;flex-wrap:wrap;gap:6px">
                <div style="display:flex;align-items:center;gap:6px">
                    <button class="btn btn-sm btn-outline" onclick="showScreen('dashboard')"><span class="material-icons-round" style="font-size:16px">arrow_forward</span></button>
                    <h2 style="font-size:16px;font-weight:800"><span class="material-icons-round" style="color:#8B5CF6;vertical-align:middle;font-size:18px">shopping_cart</span> ${poContext?'طلب شراء':'المشتريات'}</h2>
                </div>
                <div style="display:flex;gap:4px;align-items:center">
                    <button class="btn btn-sm btn-outline" onclick="exportPurchasesCSV()"><span class="material-icons-round" style="font-size:14px">file_download</span> CSV</button>
                    <button class="btn btn-sm btn-outline" onclick="exportPurchasesPDF()"><span class="material-icons-round" style="font-size:14px">picture_as_pdf</span> PDF</button>
                    <button class="btn btn-sm btn-primary" style="background:#8B5CF6" onclick="purMode='invoice';purCart=[];purSupplierId='';purSupplierName='';purDiscount=0;purDiscountType='amount';editingPurInvoiceId=null;editingPurIsReturn=false;poContext=null;renderPurchases(document.getElementById('contentArea'))"><span class="material-icons-round">add</span> جديدة</button>
                </div>
            </div>
            <div class="section-card" style="margin-bottom:12px"><div style="display:flex;justify-content:space-between;align-items:center"><span style="color:var(--text-secondary)">إجمالي المشتريات (${purchaseInvoices.length} فاتورة)</span><span style="font-size:20px;font-weight:800;color:#8B5CF6" id="purFilteredTotal">${fmt(totalPurchases)}</span></div></div>
            ${dateFilterBar('pur')}
            ${held.length>0?`<div class="section-card"><div class="section-header"><h3>فواتير معلقة (${held.length})</h3></div><div class="held-list">${held.map((h,i)=>`<div class="held-item" onclick="resumePurHeld(${i})"><div><strong>${h.supplierName||'بدون مورد'}</strong><br><small style="color:var(--text-secondary)">${h.items.length} منتج - ${fmt(h.total)}</small></div><div style="display:flex;gap:4px"><button class="btn btn-sm btn-primary" onclick="event.stopPropagation();resumePurHeld(${i})"><span class="material-icons-round" style="font-size:14px">play_arrow</span></button><button class="btn btn-sm btn-danger" onclick="event.stopPropagation();removePurHeld(${i})"><span class="material-icons-round" style="font-size:14px">delete</span></button></div></div>`).join('')}</div></div>`:''}
            <div style="display:flex;gap:6px;margin-bottom:8px;flex-wrap:wrap">
                <input class="form-control" id="purSearch" placeholder="بحث برقم الفاتورة أو المورد..." oninput="filterInvoiceList('pur')" style="flex:1;min-width:140px;padding:7px 10px">
                <select class="form-control" id="purStatus" onchange="filterInvoiceList('pur')" style="min-width:110px;padding:7px 10px">
                    <option value="all">كل الحالات</option>
                    <option value="paid">مدفوعة</option>
                    <option value="partial">جزئية</option>
                    <option value="pending">آجلة</option>
                    <option value="return">مرتجع</option>
                </select>
            </div>
            <div class="section-card"><div class="section-header"><h3>فواتير الشراء (${purchaseInvoices.length})</h3></div>
                <div class="table-container"><table id="purTable"><thead><tr>
                    <th data-sortkey="num" data-sorttype="num" style="cursor:pointer">رقم</th>
                    <th data-sortkey="party" data-sorttype="str" style="cursor:pointer">المورد</th>
                    <th data-sortkey="total" data-sorttype="num" style="text-align:left;cursor:pointer">الإجمالي</th>
                    <th data-sortkey="date" data-sorttype="date" style="text-align:left;cursor:pointer">التاريخ</th>
                    <th>إجراءات</th>
                </tr></thead><tbody id="purTableBody">
                ${purchaseInvoices.length===0 ? '<tr><td colspan="5" style="text-align:center;padding:30px;color:var(--text-secondary)">لا توجد فواتير</td></tr>' :
                purchaseInvoices.map(i => {
                    const isReturn = i.isReturn;
                    const totalDisplay = isReturn ? -Math.abs(i.total) : i.total;
                    const totalColor = isReturn ? 'var(--error)' : '#8B5CF6';
                    const statusVal = isReturn ? 'return' : (i.status||'paid');
                    return `<tr data-search="${(i.invoiceNumber||'')+' '+(i.customerName||'-')}" data-status="${statusVal}" data-total="${totalDisplay}" style="cursor:pointer" onclick="editInvoice('${i.id}')">
                        <td data-sort="${i.invoiceNumber}"><strong>${i.invoiceNumber}</strong>${isReturn?' <span class="badge badge-danger" style="font-size:9px">مرتجع</span>':''}</td>
                        <td data-sort="${i.customerName||'-'}">${i.customerName||'-'}</td>
                        <td data-sort="${i.total}" style="font-weight:700;color:${totalColor}">${fmt(totalDisplay)}</td>
                        <td data-sort="${i.createdAt}">${fmtDate(i.createdAt)}</td>
                        <td style="white-space:nowrap">
                            <button class="btn btn-xs btn-outline" onclick="event.stopPropagation();viewInvoice('${i.id}')" title="عرض"><span class="material-icons-round" style="font-size:14px">visibility</span></button>
                            <button class="btn btn-xs btn-danger" onclick="event.stopPropagation();confirmModal('حذف الفاتورة؟', ()=>deleteInvoice('${i.id}'))" title="حذف"><span class="material-icons-round" style="font-size:14px">delete</span></button>
                        </td>
                    </tr>`;
                }).join('')}
                </tbody></table></div></div>`;
        enableTableSort('purTable');
        return;
    }

    area.innerHTML = `
        <div style="display:flex;flex-direction:column;height:calc(100vh - var(--topbar-height) - 24px);height:calc(100dvh - var(--topbar-height) - 24px);gap:6px">
            <!-- Header Bar -->
            <div style="background:var(--card);border-radius:var(--radius);box-shadow:var(--shadow);border:1px solid var(--border-light)">
                <!-- Top Row: Actions -->
                <div style="padding:8px 10px;display:flex;gap:5px;align-items:center;flex-wrap:wrap;border-bottom:1px solid var(--border-light)">
                    <div style="display:flex;gap:4px;flex:1;min-width:0">
                        <button class="btn btn-sm btn-primary" style="background:linear-gradient(135deg,#8B5CF6,#7C3AED)" onclick="${poContext?`savePOFromPurchases('${poContext}')`:(editingPurInvoiceId?`saveEditPurchase('${editingPurInvoiceId}')`:'savePurDirect()')}"><span class="material-icons-round" style="font-size:14px">save</span> حفظ${poContext?' طلب':''}</button>
                        ${editingPurInvoiceId?`<button class="btn btn-sm btn-success" onclick="saveEditPurchase('${editingPurInvoiceId}',true)"><span class="material-icons-round" style="font-size:14px">print</span> حفظ + طباعة</button>`:''}
                        ${poContext && poContext!=='new'?`<button class="btn btn-sm btn-outline" onclick="convertToPurchase('${poContext}')"><span class="material-icons-round" style="font-size:14px">shopping_cart</span> تحويل لفاتورة شراء</button>`:''}
                        ${editingPurInvoiceId?`<button class="btn btn-sm btn-outline" onclick="printPurchaseInvoiceById('${editingPurInvoiceId}')"><span class="material-icons-round" style="font-size:14px">print</span></button>`:`<button class="btn btn-sm btn-outline" onclick="printCurrentPurCart()"><span class="material-icons-round" style="font-size:14px">print</span></button>`}
                        ${editingPurInvoiceId?`<label class="return-checkbox" style="display:flex;align-items:center;gap:4px;font-size:10px;cursor:pointer;padding:4px 8px;border-radius:var(--radius-sm);border:1.5px solid ${editingPurIsReturn?'var(--error)':'var(--border)'};background:${editingPurIsReturn?'rgba(239,68,68,0.08)':'var(--surface)'};color:${editingPurIsReturn?'var(--error)':'var(--text-secondary)'};transition:var(--transition)"><input type="checkbox" ${editingPurIsReturn?'checked':''} onchange="editingPurIsReturn=this.checked;renderPurchases(document.getElementById('contentArea'))" style="display:none"><span class="material-icons-round" style="font-size:15px">${editingPurIsReturn?'check_box':'check_box_outline_blank'}</span> مرتجع</label>`:''}
                    </div>
                    <div style="display:flex;gap:4px;align-items:center">
                        <select class="form-control" id="purPayMethod" onchange="purPaymentMethod=this.value;updatePurPayUI()" style="min-width:90px;padding:5px 10px;font-size:11px;border-radius:var(--radius-sm);font-weight:600">
                            <option value="cash" ${purPaymentMethod==='cash'?'selected':''}>💵 نقدي</option>
                            <option value="credit" ${purPaymentMethod==='credit'?'selected':''}>📋 آجل</option>
                        </select>
                        <button class="btn btn-sm btn-outline" onclick="holdPurchase()" title="تعليق الفاتورة" style="padding:4px 8px"><span class="material-icons-round" style="font-size:15px">pause_circle</span></button>
                        <button class="btn btn-sm btn-outline" onclick="if(poContext){poContext=null;showScreen('purchaseOrders');return;} purMode='list';editingPurInvoiceId=null;editingPurIsReturn=false;renderPurchases(document.getElementById('contentArea'))" title="العودة للقائمة" style="padding:4px 8px"><span class="material-icons-round" style="font-size:15px">arrow_forward</span> ${poContext?'طلبات الشراء':'الفواتير'}</button>
                    </div>
                </div>
                <!-- Second Row: Supplier + Notes -->
                <div style="padding:8px 10px 4px;display:flex;gap:6px;align-items:flex-end;flex-wrap:wrap">
                    <div style="flex:1;min-width:100px">
                        <label style="font-size:9px;color:var(--text-muted);margin-bottom:2px;display:block;font-weight:600">المورد</label>
                        <div style="position:relative">
                            <input class="form-control" placeholder="اسم المورد..." id="purSupplierInput" value="${purSupplierName}" oninput="searchPurSupplier(this.value)" onfocus="searchPurSupplier(this.value)" autocomplete="off" style="padding:6px 10px;font-size:12px;border-radius:var(--radius-sm)">
                            <div id="purSupplierDropdown" style="display:none;position:absolute;top:100%;right:0;left:0;background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-sm);max-height:150px;overflow-y:auto;z-index:50;box-shadow:var(--shadow-lg);margin-top:2px"></div>
                        </div>
                    </div>
                    <div style="flex:1;min-width:80px">
                        <label style="font-size:9px;color:var(--text-muted);margin-bottom:2px;display:block;font-weight:600">ملاحظات</label>
                        <input class="form-control" placeholder="ملاحظات..." id="purNotesInput" value="${purNotes}" oninput="purNotes=this.value" style="padding:6px 10px;font-size:12px;border-radius:var(--radius-sm)">
                    </div>
                </div>
                <!-- Third Row: Product Search -->
                <div style="padding:0 10px 8px;position:relative;display:flex;gap:6px;align-items:center">
                    <button onclick="openBarcodeScanner('pur')" style="flex-shrink:0;width:36px;height:36px;border-radius:var(--radius-sm);border:1px solid var(--border);background:var(--surface);color:#8B5CF6;display:flex;align-items:center;justify-content:center;cursor:pointer" title="مسح بالكاميرا"><span class="material-icons-round" style="font-size:20px">qr_code_scanner</span></button>
                    <div style="flex:1;position:relative">
                        <input class="form-control" placeholder="🔍 ابحث عن صنف أو امسح باركود..." id="purSearch" oninput="searchPurProducts(this.value)" onfocus="searchPurProducts(this.value)" autocomplete="off" style="padding:6px 10px;font-size:12px;border-radius:var(--radius-sm)">
                        <div id="purProductsDropdown" style="display:none;position:absolute;top:100%;right:0;left:0;background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-sm);max-height:200px;overflow-y:auto;z-index:50;box-shadow:var(--shadow-lg);margin-top:2px"></div>
                    </div>
                </div>
            </div>

            <!-- Cart Items -->
            <div style="flex:1;overflow-y:auto;background:var(--card);border-radius:var(--radius);box-shadow:var(--shadow);border:1px solid var(--border-light);padding:6px;min-height:0" id="purCartArea">
                <div id="purCartItems">
                    <div class="empty-state" style="padding:32px 16px"><span class="material-icons-round" style="font-size:44px;opacity:0.12">shopping_basket</span><h3 style="margin-top:6px">السلة فارغة</h3><p>ابحث عن منتج أو امسح الباركود</p></div>
                </div>
            </div>

            <!-- Bottom: Total Bar -->
            <div style="background:var(--card);border-radius:var(--radius);box-shadow:var(--shadow-md);border:1px solid var(--border-light);overflow:hidden">
                <!-- Expandable Details -->
                <div id="purDetailsExpand" style="display:none;padding:10px;border-bottom:1px solid var(--border-light);background:var(--bg)">
                    <div style="margin-bottom:8px">
                        <label style="font-size:10px;font-weight:600;color:var(--text-secondary);display:block;margin-bottom:3px">الخصم</label>
                        <input class="form-control" type="number" id="purDiscountInput" value="${purDiscount||''}" onchange="updatePurDiscountInput(this.value)" style="padding:6px 10px;font-size:12px;border-radius:var(--radius-sm)">
                    </div>
                    <div style="margin-bottom:8px">
                        <label style="font-size:10px;font-weight:600;color:var(--text-secondary);display:block;margin-bottom:3px">الضريبة (رقم)</label>
                        <input class="form-control" type="number" id="purTaxInput" value="${curTax||''}" onchange="updatePurTaxInput(this.value)" style="padding:6px 10px;font-size:12px;border-radius:var(--radius-sm)">
                    </div>
                    <div style="display:flex;justify-content:space-between;margin-bottom:4px;font-size:11px"><span style="color:var(--text-muted)">المجموع الفرعي</span><span id="purSubtotal" style="font-weight:600">0.00 ج.م</span></div>
                    <div style="display:flex;justify-content:space-between;margin-bottom:4px;font-size:11px"><span style="color:var(--text-muted)">الخصم</span><span style="color:var(--error);font-weight:600" id="purDiscountDisplay">0.00 ج.م</span></div>
                    <div style="display:flex;justify-content:space-between;margin-bottom:4px;font-size:11px"><span style="color:var(--text-muted)">الضريبة</span><span id="purTax" style="font-weight:600">0.00 ج.م</span></div>
                    <div id="purCreditFields" style="display:none;border-top:1px solid var(--border-light);padding-top:6px;margin-top:4px">
                        <div class="form-group" style="margin-bottom:4px"><label style="font-size:10px;font-weight:600">المبلغ المدفوع</label><input class="form-control" type="number" id="purPaidInput" value="0" onchange="updatePurCredit()" oninput="updatePurCredit()" style="padding:5px 8px;font-size:12px;border-radius:var(--radius-sm)"></div>
                        <div style="display:flex;justify-content:space-between;font-size:12px;padding:4px 0"><span style="color:var(--text-muted);font-weight:600">المتبقي</span><span id="purRemaining" style="color:var(--error);font-weight:800;font-size:13px">0.00 ج.م</span></div>
                    </div>
                </div>
                <!-- Total Row -->
                <div onclick="togglePurDetails()" style="display:flex;align-items:center;justify-content:space-between;padding:12px 14px;cursor:pointer;user-select:none;background:linear-gradient(135deg, #8B5CF6 0%, #7C3AED 100%);color:white">
                    <div style="display:flex;align-items:center;gap:8px">
                        <span class="material-icons-round" style="font-size:22px;opacity:0.8">shopping_cart</span>
                        <div>
                            <div style="font-size:11px;opacity:0.8;font-weight:500">الإجمالي</div>
                            <div style="font-size:20px;font-weight:800;line-height:1.1" id="purTotal">0.00 ج.م</div>
                        </div>
                    </div>
                    <div style="display:flex;align-items:center;gap:8px">
                        <div style="text-align:left">
                            <div style="font-size:10px;opacity:0.7" id="purCartCount">0 أصناف</div>
                        </div>
                        <span class="material-icons-round" id="purDetailsArrow" style="opacity:0.7;transition:transform 0.2s;font-size:20px">expand_less</span>
                    </div>
                </div>
            </div>
        </div>`;
    setTimeout(() => { document.getElementById('purSearch')?.focus(); updatePurCart(); }, 100);
}

function searchPurSupplier(q) {
    const dd = document.getElementById('purSupplierDropdown');
    if (!dd) return;
    const suppliers = DB.get('suppliers');
    const list = q ? suppliers.filter(s=>s.name.includes(q)||(s.phone||'').includes(q)) : suppliers.slice(0,8);
    dd.style.display = 'block';
    dd.innerHTML = `<div style="padding:6px;cursor:pointer;color:var(--text-secondary);font-size:11px;border-bottom:1px solid var(--border)" onclick="selectPurSupplier('','')">بدون مورد</div>` +
        (list.length===0?'<div style="padding:8px;color:var(--text-secondary);font-size:11px;text-align:center">لا توجد نتائج</div>':
        list.map(s=>`<div style="padding:6px 10px;cursor:pointer;border-bottom:1px solid var(--border);font-size:11px" onclick="selectPurSupplier('${s.id}','${s.name}')"><strong>${s.name}</strong><br><small style="color:var(--text-secondary)">${s.phone||''} ${s.balance?`| رصيد: ${fmt(s.balance)}`:''}</small></div>`).join(''));
}

function selectPurSupplier(id, name) { purSupplierId=id; purSupplierName=name; const inp=document.getElementById('purSupplierInput'); if(inp) inp.value=name; const dd=document.getElementById('purSupplierDropdown'); if(dd) dd.style.display='none'; }

function searchPurProducts(q) {
    const dd = document.getElementById('purProductsDropdown');
    if (!dd) return;
    q = q.trim();
    if (!q) { dd.style.display = 'none'; return; }

    const products = DB.get('products');
    const barcodeMatch = products.find(p => p.barcode && p.barcode === q);
    if (barcodeMatch) {
        addToPurCart(barcodeMatch.id);
        document.getElementById('purSearch').value = '';
        dd.style.display = 'none';
        return;
    }
    const found = products.filter(p => p.name.toLowerCase().includes(q.toLowerCase()) || (p.barcode||'').includes(q));
    if (found.length === 0) { dd.innerHTML = '<div style="padding:12px;color:var(--text-secondary);font-size:12px;text-align:center">لا توجد نتائج</div>'; dd.style.display = 'block'; return; }

    found.sort((a, b) => a.name.localeCompare(b.name, 'ar'));

    dd.innerHTML = found.map(p => {
        const isLow = p.quantity <= p.minQuantity;
        return `<div onclick="addToPurCart('${p.id}');document.getElementById('purSearch').value='';document.getElementById('purProductsDropdown').style.display='none'" style="display:flex;align-items:center;gap:8px;padding:8px 10px;cursor:pointer;border-bottom:1px solid var(--border);transition:background 0.15s" onmouseenter="this.style.background='var(--bg)'" onmouseleave="this.style.background='transparent'">
            <div style="width:32px;height:32px;border-radius:6px;background:rgba(139,92,246,0.1);color:#8B5CF6;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:12px;flex-shrink:0;${p.image?'background-image:url('+p.image+');background-size:cover':''}">${p.image?'':p.name.charAt(0)}</div>
            <div style="flex:1;min-width:0">
                <div style="font-weight:700;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${p.name}</div>
                <div style="font-size:10px;color:var(--text-secondary)">${p.unit||'قطعة'} | ${isLow?'<span style=color:var(--error)>نقص</span>':`متوفر: ${p.quantity}`}</div>
            </div>
            <div style="font-weight:800;font-size:12px;color:#8B5CF6;flex-shrink:0">${fmt(p.buyingPrice)}</div>
        </div>`;
    }).join('');
    dd.style.display = 'block';
}

function togglePurDetails() {
    const el = document.getElementById('purDetailsExpand');
    const arrow = document.getElementById('purDetailsArrow');
    if (!el) return;
    const isOpen = el.style.display !== 'none';
    el.style.display = isOpen ? 'none' : 'block';
    if (arrow) arrow.style.transform = isOpen ? 'rotate(180deg)' : 'rotate(0deg)';
}

function updatePurDiscountInput(val) { purDiscount = parseFloat(val)||0; updatePurCart(); }
function updatePurTaxInput(val) { curTax = parseFloat(val)||0; updatePurCart(); }

function addToPurCart(productId) {
    const products = DB.get('products');
    const product = products.find(p=>p.id===productId);
    if (!product) return;
    const existing = purCart.find(c=>c.productId===productId);
    if (existing) existing.quantity++;
    else purCart.push({ productId:product.id, productName:product.name, unitPrice:product.buyingPrice, quantity:1, discount:0, taxRate:getTaxRate(), buy: product.buyingPrice||0 });
    updatePurCart();
}

function removeFromPurCart(idx) { purCart.splice(idx,1); updatePurCart(); }
function updatePurCartQty(idx, change) { purCart[idx].quantity+=change; if(purCart[idx].quantity<=0) purCart.splice(idx,1); updatePurCart(); }
function updatePurCartItemDiscount(idx, val) { purCart[idx].discount = parseFloat(val)||0; updatePurCart(); }
function clearPurCart() { purCart=[]; purSupplierId=''; purSupplierName=''; purDiscount=0; curTax=0; purDiscountType='amount'; purPaymentMethod='cash'; const inp=document.getElementById('purSupplierInput'); if(inp) inp.value=''; updatePurCart(); }

function updatePurCart() {
    const el = document.getElementById('purCartItems');
    if (!el) return;

    if (purCart.length===0) {
        el.innerHTML = '<div class="empty-state" style="padding:32px 16px"><span class="material-icons-round" style="font-size:44px;opacity:0.12">shopping_basket</span><h3 style="margin-top:6px">السلة فارغة</h3><p>ابحث عن منتج أو امسح الباركود</p></div>';
    } else {
        el.innerHTML = purCart.map((item,i) => `
            <div style="display:flex;align-items:center;gap:6px;padding:8px;background:var(--bg);border-radius:var(--radius-sm);margin-bottom:4px;border:1px solid var(--border-light);transition:var(--transition)">
                <div style="flex:1;min-width:0">
                    <div style="font-weight:700;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--text)">${item.productName}</div>
                    <div style="font-size:10px;color:var(--text-muted);margin-top:1px">
                        ${fmt(item.unitPrice)} للقطعة${item.discount>0?` <span style="color:var(--error);font-weight:600">-${fmt(item.discount)}</span>`:''}
                    </div>
                </div>
                <div style="display:flex;align-items:center;gap:2px;flex-shrink:0;background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-sm);padding:2px">
                    <button class="qty-btn" onclick="updatePurCartQty(${i},-1)" style="width:24px;height:24px;border:none;background:transparent;color:#8B5CF6;font-size:14px;cursor:pointer;border-radius:4px;display:flex;align-items:center;justify-content:center;font-weight:700">-</button>
                    <span style="font-weight:800;min-width:20px;text-align:center;font-size:13px;color:var(--text)">${item.quantity}</span>
                    <button class="qty-btn" onclick="updatePurCartQty(${i},1)" style="width:24px;height:24px;border:none;background:transparent;color:#8B5CF6;font-size:14px;cursor:pointer;border-radius:4px;display:flex;align-items:center;justify-content:center;font-weight:700">+</button>
                </div>
                <div style="font-weight:800;font-size:13px;color:#8B5CF6;min-width:65px;text-align:left;flex-shrink:0">${fmt((item.unitPrice*item.quantity)-item.discount)}</div>
                <button onclick="removeFromPurCart(${i})" style="background:none;border:none;color:var(--text-muted);cursor:pointer;padding:4px;border-radius:4px;transition:var(--transition);flex-shrink:0" onmouseover="this.style.color='var(--error)'" onmouseout="this.style.color='var(--text-muted)'"><span class="material-icons-round" style="font-size:16px">close</span></button>
            </div>`).join('');
    }
    const taxRate = getTaxRate();
    const subtotal = purCart.reduce((s,i) => s + i.unitPrice*i.quantity, 0);
    const itemDiscounts = purCart.reduce((s,i) => s + (i.discount||0), 0);
    let invDiscount = 0;
    if (purDiscountType==='percent') invDiscount = (subtotal-itemDiscounts) * purDiscount / 100;
    else invDiscount = purDiscount;
    const taxable = subtotal - itemDiscounts - invDiscount;
    const tax = curTax || 0;
    const total = taxable + tax;

    const countEl = document.getElementById('purCartCount');
    if (countEl) countEl.textContent = purCart.length + ' أصناف';
    const sub = document.getElementById('purSubtotal');
    if (sub) sub.textContent = fmt(subtotal);
    const disc = document.getElementById('purDiscountDisplay');
    if (disc) disc.textContent = fmt(itemDiscounts + invDiscount);
    const taxEl = document.getElementById('purTax');
    if (taxEl) taxEl.textContent = fmt(tax);
    const totalEl = document.getElementById('purTotal');
    if (totalEl) totalEl.textContent = fmt(total);
    if (purPaymentMethod === 'credit') updatePurCredit();
}

function holdPurchase() {
    if (purCart.length===0) { toast('السلة فارغة','error'); return; }
    const held = DB.getOne('heldPurchases')||[];
    const subtotal = purCart.reduce((s,i) => s+i.unitPrice*i.quantity, 0);
    const itemDiscounts = purCart.reduce((s,i) => s+(i.discount||0), 0);
    let invDiscount = purDiscountType==='percent'?(subtotal-itemDiscounts)*purDiscount/100:purDiscount;
    const taxable = subtotal - itemDiscounts - invDiscount;
    const total = taxable + (curTax||0);
    held.push({ items:[...purCart], supplierId:purSupplierId, supplierName:purSupplierName, discount:purDiscount, discountType:purDiscountType, tax:curTax||0, total, createdAt:new Date().toISOString() });
    DB.setOne('heldPurchases', held);
    purCart=[]; purSupplierId=''; purSupplierName=''; purDiscount=0; curTax=0; purDiscountType='amount';
    toast('تم تعليق فاتورة الشراء');
    renderPurchases(document.getElementById('contentArea'));
}

function resumePurHeld(idx) {
    const held = DB.getOne('heldPurchases')||[];
    const h = held[idx]; if (!h) return;
    purCart=[...h.items]; purSupplierId=h.supplierId||''; purSupplierName=h.supplierName||''; purDiscount=h.discount||0; purDiscountType=h.discountType||'amount'; curTax = h.tax||0;
    held.splice(idx,1); DB.setOne('heldPurchases', held);
    purMode='invoice'; purPaymentMethod='cash'; renderPurchases(document.getElementById('contentArea'));
}

function removePurHeld(idx) { const held=DB.getOne('heldPurchases')||[]; held.splice(idx,1); DB.setOne('heldPurchases',held); renderPurchases(document.getElementById('contentArea')); }

function updatePurPayUI() {
    const creditFields = document.getElementById('purCreditFields');
    if (creditFields) creditFields.style.display = purPaymentMethod === 'credit' ? '' : 'none';
    if (purPaymentMethod === 'credit') updatePurCredit();
}

function updatePurCredit() {
    const taxRate = getTaxRate();
    const subtotal = purCart.reduce((s,i) => s+i.unitPrice*i.quantity, 0);
    const itemDiscounts = purCart.reduce((s,i) => s+(i.discount||0),0);
    let invDiscount = purDiscountType==='percent'?(subtotal-itemDiscounts)*purDiscount/100:purDiscount;
    const taxable = subtotal - itemDiscounts - invDiscount;
    const tax = curTax || 0;
    const total = taxable + tax;
    const paid = parseFloat(document.getElementById('purPaidInput')?.value)||0;
    const remaining = total - paid;
    const remEl = document.getElementById('purRemaining');
    if (remEl) { remEl.textContent = fmt(remaining); remEl.style.color = remaining > 0 ? 'var(--error)' : 'var(--success)'; }
}

function savePurDirect() {
    if (purCart.length===0) { toast('السلة فارغة','error'); return; }
    const taxRate = getTaxRate();
    const subtotal = purCart.reduce((s,i) => s+i.unitPrice*i.quantity, 0);
    const itemDiscounts = purCart.reduce((s,i) => s+(i.discount||0),0);
    let invDiscount = purDiscountType==='percent'?(subtotal-itemDiscounts)*purDiscount/100:purDiscount;
    const taxable = subtotal - itemDiscounts - invDiscount;
    const tax = curTax || 0;
    const total = taxable + tax;
    const method = purPaymentMethod;
    let paidAmount = 0;
    if (method === 'credit') {
        paidAmount = parseFloat(document.getElementById('purPaidInput')?.value)||0;
    } else {
        paidAmount = total;
    }

    if (method==='credit' && !purSupplierId) { toast('اختر مورد للشراء الآجل','error'); return; }

    const remaining = total - paidAmount;
    const status = paidAmount >= total ? 'paid' : method==='credit'?'pending':'partial';

    const invoice = {
        id:uid(), invoiceNumber:nextInvoiceNumber(), items:[...purCart],
        subtotal, discount:invDiscount+itemDiscounts, taxAmount:tax, total,
        paidAmount, remainingAmount:remaining,
        paymentMethod: method==='cash'?'نقدي':'آجل',
        status, type:'purchase',
        customerId:purSupplierId, customerName:purSupplierName, notes:purNotes||'', createdBy:currentUser?.username||'',
        createdAt:new Date().toISOString()
    };
    const invoices = DB.get('invoices'); invoices.unshift(invoice); DB.set('invoices', invoices);

    const products = DB.get('products');
    const movements = DB.get('movements')||[];
    purCart.forEach(item => {
        const p = products.find(x=>x.id===item.productId);
        if (p) { p.quantity += item.quantity; movements.unshift({ id:uid(), productId:p.id, productName:p.name, type:'purchase', quantity:item.quantity, invoiceNumber:invoice.invoiceNumber, date:new Date().toISOString() }); }
    });
    DB.set('products', products);
    DB.set('movements', movements);

    if (method==='credit' && purSupplierId) { const suppliers=DB.get('suppliers'); const s=suppliers.find(x=>x.id===purSupplierId); if(s) { s.balance=(s.balance||0)+remaining; DB.set('suppliers',suppliers); } }

    purCart=[]; purSupplierId=''; purSupplierName=''; purDiscount=0; purDiscountType='amount'; purPaymentMethod='cash'; purNotes='';
    toast('تم حفظ فاتورة الشراء','success');
    window._lastPurInvoice = invoice;
    openModal('تم الحفظ', `
        <div style="text-align:center;padding:8px 0">
            <span class="material-icons-round" style="font-size:48px;color:var(--success)">check_circle</span>
            <p style="margin-top:8px;font-size:14px">فاتورة شراء رقم <strong>${invoice.invoiceNumber}</strong></p>
            <p style="font-size:12px;color:var(--text-secondary)">${fmt(invoice.total)}</p>
        </div>
        `, `<button class="btn btn-primary" onclick="confirmPrint('${invoice.id}');closeModal()"><span class="material-icons-round">print</span> طباعة إيصال</button><button class="btn btn-success" onclick="shareInvoiceWhatsapp('${invoice.id}');closeModal()"><span class="material-icons-round">share</span> واتساب</button><button class="btn btn-outline" onclick="closeModal()">إغلاق</button>`);
    setTimeout(()=>renderPurchases(document.getElementById('contentArea')),100);
}

function completePurchase() { savePurDirect(); }

function saveEditPurchase(id, printAfter) {
    if (purCart.length===0) { toast('السلة فارغة','error'); return; }
    const invoices = DB.get('invoices');
    const idx = invoices.findIndex(i => i.id === id);
    if (idx < 0) return;
    const oldInv = invoices[idx];

    const products = DB.get('products');
    oldInv.items.forEach(item => { const p = products.find(x => x.id === item.productId); if (p) p.quantity = Math.max(0, p.quantity - item.quantity); });

    const taxRate = getTaxRate();
    const subtotal = purCart.reduce((s,i) => s+i.unitPrice*i.quantity, 0);
    const itemDiscounts = purCart.reduce((s,i) => s+(i.discount||0),0);
    let invDiscount = purDiscountType==='percent'?(subtotal-itemDiscounts)*purDiscount/100:purDiscount;
    const taxable = subtotal - itemDiscounts - invDiscount;
    const tax = curTax || 0;
    const total = taxable + tax;
    const method = purPaymentMethod;
    let paidAmount = method==='cash' ? total : parseFloat(document.getElementById('purPaidInput')?.value)||0;
    if (method==='credit' && !purSupplierId) { toast('اختر مورد للشراء الآجل','error'); return; }
    const remaining = total - paidAmount;
    const status = paidAmount >= total ? 'paid' : method==='credit'?'pending':'partial';

    oldInv.items = [...purCart];
    oldInv.subtotal = subtotal;
    oldInv.discount = invDiscount + itemDiscounts;
    oldInv.taxAmount = tax;
    oldInv.total = total;
    oldInv.paidAmount = paidAmount;
    const oldRemainingAmt = oldInv.remainingAmount || 0;
    oldInv.remainingAmount = remaining;
    oldInv.paymentMethod = method==='cash'?'نقدي':'آجل';
    oldInv.status = status;
    oldInv.customerId = purSupplierId;
    oldInv.customerName = purSupplierName;
    oldInv.notes = purNotes || '';
    oldInv.isReturn = editingPurIsReturn;

    if (editingPurIsReturn) {
        purCart.forEach(item => { const p = products.find(x => x.id===item.productId); if (p) p.quantity += item.quantity; });
    } else {
        purCart.forEach(item => { const p = products.find(x => x.id===item.productId); if (p) p.quantity = Math.max(0, p.quantity - item.quantity); });
    }
    DB.set('products', products);

    if (purSupplierId) {
        const suppliers = DB.get('suppliers');
        const s = suppliers.find(x => x.id===purSupplierId);
        if (s) {
            s.balance = (s.balance||0) + oldRemainingAmt - remaining;
            DB.set('suppliers', suppliers);
        }
    }

    DB.set('invoices', invoices);
    purCart=[]; purSupplierId=''; purSupplierName=''; purDiscount=0; purDiscountType='amount'; purPaymentMethod='cash'; purNotes=''; editingPurInvoiceId=null;
    toast('تم تحديث فاتورة الشراء','success');

    if (printAfter) {
        window._lastPurInvoice = oldInv;
        openModal('تم الحفظ والطباعة', `
            <div style="text-align:center;padding:8px 0">
                <span class="material-icons-round" style="font-size:48px;color:var(--success)">check_circle</span>
                <p style="margin-top:8px;font-size:14px">فاتورة شراء رقم <strong>${oldInv.invoiceNumber}</strong></p>
                <p style="font-size:12px;color:var(--text-secondary)">${fmt(oldInv.total)}</p>
            </div>
    `, `<button class="btn btn-primary" onclick="printPurchaseInvoiceById('${oldInv.id}');closeModal()"><span class="material-icons-round">print</span> طباعة</button><button class="btn btn-success" onclick="shareInvoiceWhatsapp('${oldInv.id}');closeModal()"><span class="material-icons-round">share</span> واتساب</button><button class="btn btn-outline" onclick="closeModal()">إغلاق</button>`);
    }
    setTimeout(()=>renderPurchases(document.getElementById('contentArea')),100);
}

function printCurrentPurCart() {
    if (!purCart.length) { toast('السلة فارغة', 'error'); return; }
    const s = DB.getOne('settings') || {};
    const subtotal = purCart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
    const itemDiscounts = purCart.reduce((sum, item) => sum + (item.discount || 0), 0);
    const invDiscount = purDiscountType === 'percent' ? (subtotal - itemDiscounts) * purDiscount / 100 : purDiscount;
    const taxable = subtotal - itemDiscounts - invDiscount;
    const tax = curTax || 0;
    const total = taxable + tax;
    const inv = {
        invoiceNumber: 'مسودة', createdAt: new Date().toISOString(), customerName: purSupplierName || '-',
        items: purCart.map(item => ({ productName: item.name, quantity: item.quantity, unitPrice: item.unitPrice, discount: item.discount || 0 })),
        subtotal: taxable, discount: invDiscount, taxAmount: tax, total, paidAmount: 0, remainingAmount: total
    };
    printPurchaseReceipt(inv);
}

function printPurchaseReceipt(inv) {
    if (!inv) return;
    const s = DB.getOne('settings') || {};
    if (s.bluetoothThermal) {
        if (!btChar) { toast('الطابعة الحرارية غير متصلة — فعّل الاتصال من الإعدادات', 'error'); return; }
        printThermalReceipt(inv, 'purchase'); return;
    }
    openPurchaseWindow(inv);
}
function openPurchaseWindow(inv) {
    if (!inv) return;
    const s = DB.getOne('settings') || {};
    const logoHtml = s.storeLogo ? `<img src="${s.storeLogo}" style="width:60px;height:60px;object-fit:contain;margin-bottom:4px;border-radius:8px">` : `<div style="width:50px;height:50px;margin:0 auto 4px;border-radius:50%;background:linear-gradient(135deg,#8B5CF6,#7C3AED);display:flex;align-items:center;justify-content:center"><span style="font-size:20px;color:white;font-weight:800">${(s.storeName||s.companyName||'م')[0]}</span></div>`;
    const itemsHtml = inv.items.map(item => {
        const lineTotal = item.unitPrice * item.quantity - (item.discount||0);
        const discText = item.discount > 0 ? `\n  <span style="color:#EF4444;font-size:10px">خصم: -${fmt(item.discount)}</span>` : '';
        return `<div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:3px;border-bottom:1px dotted #eee;padding-bottom:3px"><div style="flex:1"><div style="font-weight:600">${item.productName}</div><div style="font-size:10px;color:#666">${item.quantity} × ${fmt(item.unitPrice)}${discText}</div></div><div style="font-weight:700">${fmt(lineTotal)}</div></div>`;
    }).join('');
    const receiptHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>إيصال شراء</title><style>
        @page{size:80mm auto;margin:0}
        body{font-family:'Cairo','Courier New',monospace;text-align:center;padding:8px 6px;max-width:302px;margin:0 auto;font-size:12px;color:#1a1a1a}
        .line{border-top:1px dashed #ccc;margin:6px 0}
        .total{font-size:15px;font-weight:bold;border-top:2px solid #000;margin-top:6px;padding-top:6px}
        .footer{margin-top:8px;font-size:10px;color:#888;border-top:1px dashed #ccc;padding-top:6px}
    </style></head><body>
        ${logoHtml}
        <h2 style="font-size:15px;margin:0;font-weight:800">${s.storeName||s.companyName||''}</h2>
        <p style="margin:2px 0;font-size:10px;color:#666">فاتورة شراء</p>
        <div class="line"></div>
        <div style="display:flex;justify-content:space-between;font-size:11px"><div style="text-align:right"><strong>شراء #${inv.invoiceNumber}</strong></div><div>${fmtDate(inv.createdAt)}</div></div>
        <div style="text-align:right;font-size:11px;color:#666;margin-top:2px">المورد: ${inv.customerName||'-'}</div>
        <div class="line"></div>
        ${itemsHtml}
        <div class="line"></div>
        ${inv.discount>0?`<div style="display:flex;justify-content:space-between;font-size:11px"><span>الخصم</span><span style="color:#EF4444">-${fmt(inv.discount)}</span></div>`:''}
        ${inv.taxAmount>0?`<div style="display:flex;justify-content:space-between;font-size:11px"><span>الضريبة</span><span>${fmt(inv.taxAmount)}</span></div>`:''}
        <div class="total" style="display:flex;justify-content:space-between"><span>الإجمالي</span><span>${fmt(inv.total)}</span></div>
        <div style="display:flex;justify-content:space-between;font-size:11px;margin-top:3px"><span>المدفوع</span><span style="font-weight:600">${fmt(inv.paidAmount)}</span></div>
        ${inv.remainingAmount>0?`<div style="display:flex;justify-content:space-between;font-size:11px;color:#EF4444"><span>المتبقي</span><span style="font-weight:700">${fmt(inv.remainingAmount)}</span></div>`:''}
        <div class="footer">
            <p style="margin:0">${s.storeName||''}</p>
            <p style="margin:2px 0 0;font-size:9px">${fmtDateTime(inv.createdAt)}</p>
        </div>
        <script>window.onload=function(){window.print();setTimeout(()=>window.close(),500)}<\/script>
    </body></html>`;
    const w = window.open('','_blank');
    w.document.write(receiptHtml);
    w.document.close();
}

// ==================== CUSTOMERS ====================
function renderCustomers(area) {
    const customers = DB.get('customers');
    area.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;flex-wrap:wrap;gap:6px">
            <div style="display:flex;align-items:center;gap:6px">
                <button class="btn btn-sm btn-outline" onclick="showScreen('dashboard')"><span class="material-icons-round" style="font-size:16px">arrow_forward</span></button>
                <h2 style="font-size:16px;font-weight:800">العملاء</h2>
            </div>
            <div style="display:flex;gap:4px;align-items:center">
                <button class="btn btn-sm btn-outline" onclick="exportCustomersCSV()"><span class="material-icons-round" style="font-size:14px">file_download</span> CSV</button>
                <button class="btn btn-sm btn-outline" onclick="exportCustomersPDF()"><span class="material-icons-round" style="font-size:14px">picture_as_pdf</span> PDF</button>
                <button class="btn btn-sm btn-primary" onclick="openCustomerModal()"><span class="material-icons-round">person_add</span> إضافة</button>
            </div>
        </div>
        <div style="margin-bottom:10px"><input class="form-control" placeholder="بحث..." oninput="filterList(this.value,'customersList')" style="font-size:13px;padding:8px 12px"></div>
        <div id="customersList">${customers.map(c=>`<div class="section-card" style="margin-bottom:8px;padding:12px">
            <div style="display:flex;align-items:center;gap:10px">
                <div class="user-avatar" style="width:40px;height:40px;font-size:14px;flex-shrink:0">${c.name.charAt(0)}</div>
                <div style="flex:1;min-width:0">
                    <strong>${c.name}</strong><br><small style="color:var(--text-secondary)">${c.phone||''}</small>
                    <div style="display:flex;gap:4px;margin-top:4px;flex-wrap:wrap">
                        ${c.balance!==0?`<span class="badge ${c.balance>0?'badge-danger':'badge-success'}">الرصيد: ${fmt(c.balance)}</span>`:''}
                        <span class="badge badge-info">نقاط: ${c.loyaltyPoints||0}</span>
                    </div>
                </div>
                <div style="display:flex;gap:4px;flex-shrink:0">
                    <button class="btn btn-sm btn-outline" onclick="showCustomerStatement('${c.id}')" title="كشف حساب"><span class="material-icons-round" style="font-size:14px">receipt_long</span></button>
                    <button class="btn btn-sm btn-outline" onclick="openCustomerModal('${c.id}')"><span class="material-icons-round">edit</span></button>
                    <button class="btn btn-sm btn-danger" onclick="deleteCustomer('${c.id}')"><span class="material-icons-round">delete</span></button>
                </div>
            </div>
        </div>`).join('')}</div>`;
}

function openCustomerModal(id) {
    const customers = DB.get('customers');
    const c = id ? customers.find(x=>x.id===id) : null;
    openModal(c?'تعديل العميل':'إضافة عميل', `
        <div class="form-group"><label>اسم العميل *</label><input class="form-control" id="cName" value="${c?c.name:''}"></div>
        <div class="form-group"><label>الهاتف</label><input class="form-control" id="cPhone" value="${c?c.phone||'':''}"></div>
        <div class="form-group"><label>البريد</label><input class="form-control" id="cEmail" value="${c?c.email||'':''}"></div>
    `, `<button class="btn btn-primary" onclick="saveCustomer('${id||''}')">حفظ</button><button class="btn btn-outline" onclick="closeModal()">إلغاء</button>`);
}

function saveCustomer(id) {
    const name = document.getElementById('cName').value.trim();
    if (!name) { toast('أدخل اسم العميل','error'); return; }
    const customers = DB.get('customers');
    const data = { name, phone:document.getElementById('cPhone').value.trim(), email:document.getElementById('cEmail').value.trim() };
    if (id) { const idx=customers.findIndex(c=>c.id===id); if(idx>=0) customers[idx]={...customers[idx],...data}; }
    else customers.push({ id:uid(), ...data, balance:0, loyaltyPoints:0, createdAt:new Date().toISOString() });
    DB.set('customers',customers); closeModal(); toast('تم الحفظ');
    renderCustomers(document.getElementById('contentArea'));
}

function deleteCustomer(id) {
    confirmModal('هل أنت متأكد من حذف هذا العميل؟', function() {
        moveToTrash('customer', id);
        DB.set('customers', DB.get('customers').filter(c=>c.id!==id)); toast('تم الحذف');
        renderCustomers(document.getElementById('contentArea'));
    });
}

function showCustomerStatement(custId) {
    const customers = DB.get('customers');
    const c = customers.find(x=>x.id===custId);
    if (!c) return;
    const invoices = DB.get('invoices').filter(i => i.type==='sale' && i.customerId===custId);
    invoices.sort((a,b) => new Date(a.createdAt)-new Date(b.createdAt));

    let runningBalance = 0;
    const rows = [];
    invoices.forEach(inv => {
        const amount = inv.isReturn ? -Math.abs(inv.total) : inv.total;
        const paid = inv.paidAmount || 0;
        runningBalance += amount - paid;
        rows.push({ date:inv.createdAt, type:inv.isReturn?'مرتجع':'فاتورة مبيعات', number:inv.invoiceNumber, amount, paid, remaining:inv.remainingAmount||0, balance:runningBalance });
    });

    const totalInvoices = invoices.filter(i=>!i.isReturn).reduce((s,i)=>s+i.total,0);
    const totalReturns = invoices.filter(i=>i.isReturn).reduce((s,i)=>s+Math.abs(i.total),0);
    const totalPaid = invoices.reduce((s,i)=>s+(i.paidAmount||0),0);

        const tableRows = rows.map(r => `<tr><td data-sort="${r.date}">${fmtDate(r.date)}</td><td data-sort="${r.type}">${r.type}</td><td data-sort="${r.number}">#${r.number}</td><td style="font-weight:700;color:${r.amount<0?'var(--error)':'var(--primary)'}" data-sort="${r.amount}">${fmt(r.amount)}</td><td style="color:var(--success)" data-sort="${r.paid}">${fmt(r.paid)}</td><td style="color:var(--error);font-weight:700" data-sort="${r.remaining}">${fmt(r.remaining)}</td></tr>`).join('');

    const area = document.getElementById('contentArea');
    area.innerHTML = `
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:10px">
            <button class="btn btn-sm btn-outline" onclick="renderCustomers(document.getElementById('contentArea'))"><span class="material-icons-round" style="font-size:16px">arrow_forward</span></button>
            <h2 style="font-size:16px;font-weight:800">كشف حساب العميل</h2>
        </div>
        <div class="section-card" style="margin-bottom:12px">
            <div style="display:flex;align-items:center;gap:12px">
                <div class="user-avatar" style="width:48px;height:48px;font-size:16px;flex-shrink:0">${c.name.charAt(0)}</div>
                <div style="flex:1">
                    <div style="font-weight:800;font-size:15px">${c.name}</div>
                    <div style="font-size:12px;color:var(--text-secondary)">${c.phone||''} ${c.email?' · '+c.email:''}</div>
                </div>
                <div style="text-align:left">
                    <div style="font-size:11px;color:var(--text-secondary)">الرصيد الحالي</div>
                    <div style="font-weight:800;font-size:18px;color:${c.balance>0?'var(--error)':'var(--success)'}">${fmt(c.balance)}</div>
                </div>
            </div>
        </div>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:12px">
            <div class="stat-card"><div class="label">إجمالي الفواتير</div><div class="value">${fmt(totalInvoices)}</div></div>
            <div class="stat-card"><div class="label">المرتجعات</div><div class="value" style="color:var(--error)">${fmt(totalReturns)}</div></div>
            <div class="stat-card"><div class="label">المدفوعات</div><div class="value" style="color:var(--success)">${fmt(totalPaid)}</div></div>
        </div>
        <div class="section-card">
            <div class="section-header"><h3>تفاصيل الفواتير والمدفوعات</h3><button class="btn btn-sm btn-outline" onclick="printCustomerStatement('${custId}')"><span class="material-icons-round" style="font-size:14px">print</span> طباعة</button></div>
            <div class="table-container"><table><thead><tr><th>التاريخ</th><th>النوع</th><th>رقم</th><th>المبلغ</th><th>المدفوع</th><th>المتبقي</th></tr></thead><tbody>
            ${rows.length===0?'<tr><td colspan="6" style="text-align:center;padding:24px;color:var(--text-secondary)">لا توجد فواتير</td></tr>':tableRows}
            </tbody></table></div>
        </div>`;
}

function printCustomerStatement(custId) {
    const customers = DB.get('customers');
    const c = customers.find(x=>x.id===custId);
    if (!c) return;
    const s = DB.getOne('settings') || {};
    const invoices = DB.get('invoices').filter(i => i.type==='sale' && i.customerId===custId);
    invoices.sort((a,b) => new Date(a.createdAt)-new Date(b.createdAt));
    const logoHtml = s.storeLogo ? `<img src="${s.storeLogo}" style="width:50px;height:50px;object-fit:contain;margin-bottom:4px;border-radius:8px">` : '';

    let runningBalance = 0;
    const tableRows = invoices.map(inv => {
        const amount = inv.isReturn ? -Math.abs(inv.total) : inv.total;
        const paid = inv.paidAmount || 0;
        runningBalance += amount - paid;
        return `<tr style="font-size:11px;border-bottom:1px solid #eee"><td style="padding:4px">${fmtDate(inv.createdAt)}</td><td style="padding:4px">${inv.isReturn?'مرتجع':'فاتورة'}</td><td style="padding:4px">#${inv.invoiceNumber}</td><td style="padding:4px;text-align:left;font-weight:600">${fmt(amount)}</td><td style="padding:4px;text-align:left;color:green">${fmt(paid)}</td><td style="padding:4px;text-align:left;color:red;font-weight:700">${fmt(runningBalance)}</td></tr>`;
    }).join('');

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>كشف حساب ${c.name}</title><style>
        @page{size:A4;margin:15mm}body{font-family:'Cairo',Arial,sans-serif;font-size:11px;color:#1a1a1a;margin:0;padding:15mm}
        .header{text-align:center;margin-bottom:15px;border-bottom:2px solid #000;padding-bottom:10px}
        table{width:100%;border-collapse:collapse}th{background:#f0f0f0;padding:6px;text-align:right;font-size:10px;border-bottom:2px solid #000}
        td{padding:4px;text-align:right;font-size:11px}.summary{display:flex;justify-content:space-around;margin-top:15px;padding:10px;background:#f9f9f9;border-radius:8px}
        .summary-item{text-align:center}.summary-item .label{font-size:10px;color:#666}.summary-item .value{font-size:16px;font-weight:800}
    </style></head><body>
        <div class="header">${logoHtml}<h2 style="margin:5px 0">${s.storeName||s.companyName||''}</h2><p style="margin:0;color:#666">كشف حساب العميل: ${c.name}</p><p style="margin:2px 0;color:#888;font-size:10px">تاريخ الطباعة: ${fmtDateTime(new Date().toISOString())}</p></div>
        <div class="summary">
            <div class="summary-item"><div class="label">إجمالي الفواتير</div><div class="value">${fmt(invoices.filter(i=>!i.isReturn).reduce((s,i)=>s+i.total,0))}</div></div>
            <div class="summary-item"><div class="label">المرتجعات</div><div class="value" style="color:red">${fmt(invoices.filter(i=>i.isReturn).reduce((s,i)=>s+Math.abs(i.total),0))}</div></div>
            <div class="summary-item"><div class="label">المدفوعات</div><div class="value" style="color:green">${fmt(invoices.reduce((s,i)=>s+(i.paidAmount||0),0))}</div></div>
            <div class="summary-item"><div class="label">الرصيد</div><div class="value" style="color:${c.balance>0?'red':'green'}">${fmt(c.balance)}</div></div>
        </div>
        <table><thead><tr><th>التاريخ</th><th>النوع</th><th>رقم</th><th style="text-align:left">المبلغ</th><th style="text-align:left">المدفوع</th><th style="text-align:left">المتبقي</th></tr></thead><tbody>${tableRows}</tbody></table>
        <script>window.onload=function(){window.print();setTimeout(()=>window.close(),500)}<\/script>
    </body></html>`;
    const w = window.open('','_blank');
    w.document.write(html); w.document.close();
}

// ==================== SUPPLIERS ====================
function renderSuppliers(area) {
    const suppliers = DB.get('suppliers');
    area.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;flex-wrap:wrap;gap:6px">
            <div style="display:flex;align-items:center;gap:6px">
                <button class="btn btn-sm btn-outline" onclick="showScreen('dashboard')"><span class="material-icons-round" style="font-size:16px">arrow_forward</span></button>
                <h2 style="font-size:16px;font-weight:800">الموردين</h2>
            </div>
            <div style="display:flex;gap:4px;align-items:center">
                <button class="btn btn-sm btn-outline" onclick="exportSuppliersCSV()"><span class="material-icons-round" style="font-size:14px">file_download</span> CSV</button>
                <button class="btn btn-sm btn-outline" onclick="exportSuppliersPDF()"><span class="material-icons-round" style="font-size:14px">picture_as_pdf</span> PDF</button>
                <button class="btn btn-sm btn-primary" onclick="openSupplierModal()"><span class="material-icons-round">local_shipping</span> إضافة</button>
            </div>
        </div>
        <div style="margin-bottom:10px"><input class="form-control" placeholder="بحث..." oninput="filterList(this.value,'suppliersList')" style="font-size:13px;padding:8px 12px"></div>
        <div id="suppliersList">${suppliers.map(s=>`<div class="section-card" style="margin-bottom:8px;padding:12px">
            <div style="display:flex;align-items:center;gap:10px">
                <div class="user-avatar" style="width:40px;height:40px;font-size:14px;background:#B45309;flex-shrink:0">${s.name.charAt(0)}</div>
                <div style="flex:1;min-width:0"><strong>${s.name}</strong><br><small style="color:var(--text-secondary)">${s.phone||''}</small>
                    ${s.balance!==0?`<div style="margin-top:4px"><span class="badge ${s.balance>0?'badge-danger':'badge-success'}">الرصيد: ${fmt(s.balance)}</span></div>`:''}
                </div>
                <div style="display:flex;gap:4px;flex-shrink:0">
                    <button class="btn btn-sm btn-outline" onclick="showSupplierStatement('${s.id}')" title="كشف حساب"><span class="material-icons-round" style="font-size:14px">receipt_long</span></button>
                    <button class="btn btn-sm btn-outline" onclick="openSupplierModal('${s.id}')"><span class="material-icons-round">edit</span></button>
                    <button class="btn btn-sm btn-danger" onclick="deleteSupplier('${s.id}')"><span class="material-icons-round">delete</span></button>
                </div>
            </div>
        </div>`).join('')}</div>`;
}

function openSupplierModal(id) {
    const suppliers = DB.get('suppliers');
    const s = id ? suppliers.find(x=>x.id===id) : null;
    openModal(s?'تعديل المورد':'إضافة مورد', `
        <div class="form-group"><label>اسم المورد *</label><input class="form-control" id="sName" value="${s?s.name:''}"></div>
        <div class="form-group"><label>الهاتف</label><input class="form-control" id="sPhone" value="${s?s.phone||'':''}"></div>
    `, `<button class="btn btn-primary" onclick="saveSupplier('${id||''}')">حفظ</button><button class="btn btn-outline" onclick="closeModal()">إلغاء</button>`);
}

function saveSupplier(id) {
    const name = document.getElementById('sName').value.trim();
    if (!name) { toast('أدخل اسم المورد','error'); return; }
    const suppliers = DB.get('suppliers');
    const data = { name, phone:document.getElementById('sPhone').value.trim() };
    if (id) { const idx=suppliers.findIndex(s=>s.id===id); if(idx>=0) suppliers[idx]={...suppliers[idx],...data}; }
    else suppliers.push({ id:uid(), ...data, balance:0, createdAt:new Date().toISOString() });
    DB.set('suppliers',suppliers); closeModal(); toast('تم الحفظ');
    renderSuppliers(document.getElementById('contentArea'));
}

function deleteSupplier(id) {
    confirmModal('هل أنت متأكد من حذف هذا المورد؟', function() {
        moveToTrash('supplier', id);
        DB.set('suppliers', DB.get('suppliers').filter(s=>s.id!==id)); toast('تم الحذف');
        renderSuppliers(document.getElementById('contentArea'));
    });
}

function showSupplierStatement(supId) {
    const suppliers = DB.get('suppliers');
    const s = suppliers.find(x=>x.id===supId);
    if (!s) return;
    const invoices = DB.get('invoices').filter(i => i.type==='purchase' && i.customerId===supId);
    invoices.sort((a,b) => new Date(a.createdAt)-new Date(b.createdAt));

    let runningBalance = 0;
    const rows = [];
    invoices.forEach(inv => {
        const amount = inv.isReturn ? -Math.abs(inv.total) : inv.total;
        const paid = inv.paidAmount || 0;
        runningBalance += amount - paid;
        rows.push({ date:inv.createdAt, type:inv.isReturn?'مرتجع':'فاتورة شراء', number:inv.invoiceNumber, amount, paid, remaining:inv.remainingAmount||0, balance:runningBalance });
    });

    const totalInvoices = invoices.filter(i=>!i.isReturn).reduce((s,i)=>s+i.total,0);
    const totalReturns = invoices.filter(i=>i.isReturn).reduce((s,i)=>s+Math.abs(i.total),0);
    const totalPaid = invoices.reduce((s,i)=>s+(i.paidAmount||0),0);

    const tableRows = rows.map(r => `<tr><td>${fmtDate(r.date)}</td><td>${r.type}</td><td>#${r.number}</td><td style="font-weight:700;color:${r.amount<0?'var(--error)':'#8B5CF6'}">${fmt(r.amount)}</td><td style="color:var(--success)">${fmt(r.paid)}</td><td style="color:var(--error);font-weight:700">${fmt(r.remaining)}</td></tr>`).join('');

    const area = document.getElementById('contentArea');
    area.innerHTML = `
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:10px">
            <button class="btn btn-sm btn-outline" onclick="renderSuppliers(document.getElementById('contentArea'))"><span class="material-icons-round" style="font-size:16px">arrow_forward</span></button>
            <h2 style="font-size:16px;font-weight:800">كشف حساب المورد</h2>
        </div>
        <div class="section-card" style="margin-bottom:12px">
            <div style="display:flex;align-items:center;gap:12px">
                <div class="user-avatar" style="width:48px;height:48px;font-size:16px;background:#B45309;flex-shrink:0">${s.name.charAt(0)}</div>
                <div style="flex:1">
                    <div style="font-weight:800;font-size:15px">${s.name}</div>
                    <div style="font-size:12px;color:var(--text-secondary)">${s.phone||''}</div>
                </div>
                <div style="text-align:left">
                    <div style="font-size:11px;color:var(--text-secondary)">الرصيد الحالي</div>
                    <div style="font-weight:800;font-size:18px;color:${s.balance>0?'var(--error)':'var(--success)'}">${fmt(s.balance)}</div>
                </div>
            </div>
        </div>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:12px">
            <div class="stat-card"><div class="label">إجمالي المشتريات</div><div class="value">${fmt(totalInvoices)}</div></div>
            <div class="stat-card"><div class="label">المرتجعات</div><div class="value" style="color:var(--error)">${fmt(totalReturns)}</div></div>
            <div class="stat-card"><div class="label">المدفوعات</div><div class="value" style="color:var(--success)">${fmt(totalPaid)}</div></div>
        </div>
        <div class="section-card">
            <div class="section-header"><h3>تفاصيل الفواتير والمدفوعات</h3><button class="btn btn-sm btn-outline" onclick="printSupplierStatement('${supId}')"><span class="material-icons-round" style="font-size:14px">print</span> طباعة</button></div>
            <div class="table-container"><table id="supStmtTable"><thead><tr><th data-sortkey="date" data-sorttype="date" style="cursor:pointer">التاريخ</th><th data-sortkey="type" data-sorttype="str" style="cursor:pointer">النوع</th><th data-sortkey="num" data-sorttype="num" style="cursor:pointer">رقم</th><th data-sortkey="amount" data-sorttype="num" style="text-align:left;cursor:pointer">المبلغ</th><th data-sortkey="paid" data-sorttype="num" style="text-align:left;cursor:pointer">المدفوع</th><th data-sortkey="rem" data-sorttype="num" style="text-align:left;cursor:pointer">المتبقي</th></tr></thead><tbody>
            ${rows.length===0?'<tr><td colspan="6" style="text-align:center;padding:24px;color:var(--text-secondary)">لا توجد فواتير</td></tr>':tableRows}
            </tbody></table></div>
        </div>`;
    enableTableSort('supStmtTable');
}

function printSupplierStatement(supId) {
    const suppliers = DB.get('suppliers');
    const s = suppliers.find(x=>x.id===supId);
    if (!s) return;
    const st = DB.getOne('settings') || {};
    const invoices = DB.get('invoices').filter(i => i.type==='purchase' && i.customerId===supId);
    invoices.sort((a,b) => new Date(a.createdAt)-new Date(b.createdAt));
    const logoHtml = st.storeLogo ? `<img src="${st.storeLogo}" style="width:50px;height:50px;object-fit:contain;margin-bottom:4px;border-radius:8px">` : '';

    let runningBalance = 0;
    const tableRows = invoices.map(inv => {
        const amount = inv.isReturn ? -Math.abs(inv.total) : inv.total;
        const paid = inv.paidAmount || 0;
        runningBalance += amount - paid;
        return `<tr style="font-size:11px;border-bottom:1px solid #eee"><td style="padding:4px">${fmtDate(inv.createdAt)}</td><td style="padding:4px">${inv.isReturn?'مرتجع':'شراء'}</td><td style="padding:4px">#${inv.invoiceNumber}</td><td style="padding:4px;text-align:left;font-weight:600">${fmt(amount)}</td><td style="padding:4px;text-align:left;color:green">${fmt(paid)}</td><td style="padding:4px;text-align:left;color:red;font-weight:700">${fmt(runningBalance)}</td></tr>`;
    }).join('');

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>كشف حساب ${s.name}</title><style>
        @page{size:A4;margin:15mm}body{font-family:'Cairo',Arial,sans-serif;font-size:11px;color:#1a1a1a;margin:0;padding:15mm}
        .header{text-align:center;margin-bottom:15px;border-bottom:2px solid #000;padding-bottom:10px}
        table{width:100%;border-collapse:collapse}th{background:#f0f0f0;padding:6px;text-align:right;font-size:10px;border-bottom:2px solid #000}
        td{padding:4px;text-align:right;font-size:11px}.summary{display:flex;justify-content:space-around;margin-top:15px;padding:10px;background:#f9f9f9;border-radius:8px}
        .summary-item{text-align:center}.summary-item .label{font-size:10px;color:#666}.summary-item .value{font-size:16px;font-weight:800}
    </style></head><body>
        <div class="header">${logoHtml}<h2 style="margin:5px 0">${st.storeName||st.companyName||''}</h2><p style="margin:0;color:#666">كشف حساب المورد: ${s.name}</p><p style="margin:2px 0;color:#888;font-size:10px">تاريخ الطباعة: ${fmtDateTime(new Date().toISOString())}</p></div>
        <div class="summary">
            <div class="summary-item"><div class="label">إجمالي المشتريات</div><div class="value">${fmt(invoices.filter(i=>!i.isReturn).reduce((s,i)=>s+i.total,0))}</div></div>
            <div class="summary-item"><div class="label">المرتجعات</div><div class="value" style="color:red">${fmt(invoices.filter(i=>i.isReturn).reduce((s,i)=>s+Math.abs(i.total),0))}</div></div>
            <div class="summary-item"><div class="label">المدفوعات</div><div class="value" style="color:green">${fmt(invoices.reduce((s,i)=>s+(i.paidAmount||0),0))}</div></div>
            <div class="summary-item"><div class="label">الرصيد</div><div class="value" style="color:${s.balance>0?'red':'green'}">${fmt(s.balance)}</div></div>
        </div>
        <table><thead><tr><th>التاريخ</th><th>النوع</th><th>رقم</th><th style="text-align:left">المبلغ</th><th style="text-align:left">المدفوع</th><th style="text-align:left">المتبقي</th></tr></thead><tbody>${tableRows}</tbody></table>
        <script>window.onload=function(){window.print();setTimeout(()=>window.close(),500)}<\/script>
    </body></html>`;
    const w = window.open('','_blank');
    w.document.write(html); w.document.close();
}

// ==================== INVENTORY ====================
function renderInventory(area) {
    const allProducts = DB.get('products');
    const warehouses = DB.get('warehouses');
    const selectedWh = window._invWarehouse || 'all';
    const products = selectedWh === 'all' ? allProducts : allProducts.filter(p => p.warehouseId === selectedWh);
    const lowStock = products.filter(p=>p.quantity<=p.minQuantity&&p.isActive);
    const totalBuyValue = products.reduce((s,p) => s + p.buyingPrice*p.quantity, 0);
    const totalSellValue = products.reduce((s,p) => s + p.sellingPrice*p.quantity, 0);
    const totalQty = products.reduce((s,p) => s + p.quantity, 0);
    const showAllOption = warehouses.length > 1;

    area.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;flex-wrap:wrap;gap:6px">
            <div style="display:flex;align-items:center;gap:6px">
                <button class="btn btn-sm btn-outline" onclick="showScreen('dashboard')"><span class="material-icons-round" style="font-size:16px">arrow_forward</span></button>
                <h2 style="font-size:16px;font-weight:800">المخزون</h2>
            </div>
            <div style="display:flex;gap:4px;align-items:center">
                <button class="btn btn-sm btn-outline" onclick="exportInventoryCSV()"><span class="material-icons-round" style="font-size:14px">file_download</span> CSV</button>
                <button class="btn btn-sm btn-outline" onclick="exportInventoryPDF()"><span class="material-icons-round" style="font-size:14px">picture_as_pdf</span> PDF</button>
            </div>
        </div>
        <div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap;align-items:center">
            <div class="section-card" style="flex:1;min-width:120px;margin-bottom:0;padding:12px">
                <div style="font-size:11px;color:var(--text-secondary)">إجمالي الكمية</div>
                <div style="font-size:18px;font-weight:800;color:var(--text)">${totalQty}</div>
            </div>
            <div class="section-card" style="flex:1;min-width:120px;margin-bottom:0;padding:12px">
                <div style="font-size:11px;color:var(--text-secondary)">قيمة الشراء</div>
                <div style="font-size:18px;font-weight:800;color:var(--primary)">${fmt(totalBuyValue)}</div>
            </div>
            <div class="section-card" style="flex:1;min-width:120px;margin-bottom:0;padding:12px">
                <div style="font-size:11px;color:var(--text-secondary)">قيمة البيع</div>
                <div style="font-size:18px;font-weight:800;color:var(--success)">${fmt(totalSellValue)}</div>
            </div>
            <div style="min-width:130px">
                <select class="form-control" onchange="window._invWarehouse=this.value;renderInventory(document.getElementById('contentArea'))" style="font-size:13px;padding:8px 12px">
                    ${showAllOption?`<option value="all" ${selectedWh==='all'?'selected':''}>كل المخازن</option>`:''}
                    ${warehouses.map(w=>`<option value="${w.id}" ${selectedWh===w.id?'selected':''}>${w.name}</option>`).join('')}
                </select>
            </div>
        </div>
        ${lowStock.length>0?`<div class="warning-banner"><span class="material-icons-round">warning_amber</span><div><strong>تنبيه: ${lowStock.length} منتج بكمية منخفضة</strong><br><span style="font-size:12px;color:var(--text-secondary)">${lowStock.map(p=>p.name).join('، ')}</span>
            ${canDo('pos')?`<button class="btn btn-sm btn-primary" style="margin-top:6px" onclick="createPOfromLowStock()">طلب شراء</button>`:''}</div></div>`:''}
        <div class="inventory-cards">${products.map(p=>{const wh=warehouses.find(w=>w.id===p.warehouseId);const isLow=p.quantity<=p.minQuantity;
        return`<div class="inv-card ${isLow?'low':''}"><div class="inv-header"><div class="inv-name">${p.name}</div></div><div class="inv-details"><span>شراء: ${fmt(p.buyingPrice)}</span><span>بيع: ${fmt(p.sellingPrice)}</span><span style="color:${isLow?'var(--error)':'var(--success)'};font-weight:700">كمية: ${p.quantity}</span><span>${wh?wh.name:''}</span></div></div>`;}).join('')}</div>
        <div class="section-card"><div class="table-container"><table id="inventoryTable"><thead><tr><th data-sortkey="name" data-sorttype="str" style="cursor:pointer">المنتج</th><th data-sortkey="buy" data-sorttype="num" style="text-align:left;cursor:pointer">شراء</th><th data-sortkey="sell" data-sorttype="num" style="text-align:left;cursor:pointer">بيع</th><th data-sortkey="qty" data-sorttype="num" style="text-align:left;cursor:pointer">الكمية</th><th data-sortkey="buyv" data-sorttype="num" style="text-align:left;cursor:pointer">قيمة شراء</th><th data-sortkey="sellv" data-sorttype="num" style="text-align:left;cursor:pointer">قيمة بيع</th><th data-sortkey="wh" data-sorttype="str" style="cursor:pointer">المخزن</th></tr></thead><tbody>
        ${products.map(p=>{const wh=warehouses.find(w=>w.id===p.warehouseId);const isLow=p.quantity<=p.minQuantity;
        return`<tr><td data-sort="${p.name}"><strong>${p.name}</strong></td><td data-sort="${p.buyingPrice}">${fmt(p.buyingPrice)}</td><td style="color:var(--primary);font-weight:700" data-sort="${p.sellingPrice}">${fmt(p.sellingPrice)}</td><td style="font-weight:700;color:${isLow?'var(--error)':'var(--primary)'}" data-sort="${p.quantity}">${p.quantity}</td><td data-sort="${p.buyingPrice*p.quantity}">${fmt(p.buyingPrice*p.quantity)}</td><td style="color:var(--success);font-weight:700" data-sort="${p.sellingPrice*p.quantity}">${fmt(p.sellingPrice*p.quantity)}</td><td data-sort="${wh?wh.name:'-'}">${wh?wh.name:'-'}</td></tr>`;}).join('')}
        </tbody></table></div></div>`;
    enableTableSort('inventoryTable');
}

function createPOfromLowStock() {
    const products = DB.get('products').filter(p=>p.quantity<=p.minQuantity&&p.isActive);
    if (products.length===0) { toast('لا توجد منتجات ناقصة'); return; }
    purMode='invoice'; purCart=[]; purSupplierId=''; purSupplierName='';
    products.forEach(p => { purCart.push({ productId:p.id, productName:p.name, unitPrice:p.buyingPrice, quantity:p.minQuantity-p.quantity+10 }); });
    showScreen('purchases');
    toast(`تم إنشاء طلب شراء لـ ${products.length} منتج`);
}

// ==================== WAREHOUSES ====================
function renderWarehouses(area) {
    const warehouses = DB.get('warehouses');
    const products = DB.get('products');
    area.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;flex-wrap:wrap;gap:6px">
            <div style="display:flex;align-items:center;gap:6px">
                <button class="btn btn-sm btn-outline" onclick="showScreen('dashboard')"><span class="material-icons-round" style="font-size:16px">arrow_forward</span></button>
                <h2 style="font-size:16px;font-weight:800">المخازن</h2>
            </div>
            <div style="display:flex;gap:4px">
                ${warehouses.length>=2?`<button class="btn btn-sm btn-outline" onclick="openTransferScreen()"><span class="material-icons-round" style="font-size:14px">swap_horiz</span> تحويل</button>`:''}
                <button class="btn btn-sm btn-primary" onclick="openWarehouseModal()"><span class="material-icons-round">add</span> إضافة</button>
            </div>
        </div>
        ${warehouses.map(w=>{
            const whProducts = products.filter(p=>p.warehouseId===w.id);
            const totalValue = whProducts.reduce((s,p)=>s+p.buyingPrice*p.quantity,0);
            const lowCount = whProducts.filter(p=>p.quantity<=p.minQuantity).length;
            return`<div class="wh-card"><div style="display:flex;justify-content:space-between;align-items:start">
                <div><div class="wh-name">${w.name} ${w.isDefault?'<span class="badge badge-info">افتراضي</span>':''}</div><div class="wh-loc"><span class="material-icons-round" style="font-size:14px;vertical-align:middle">location_on</span> ${w.location||'غير محدد'}</div></div>
                <div style="display:flex;gap:4px">${w.isDefault?'':`<button class="btn btn-sm btn-outline" onclick="openWarehouseModal('${w.id}')"><span class="material-icons-round">edit</span></button><button class="btn btn-sm btn-danger" onclick="deleteWarehouse('${w.id}')"><span class="material-icons-round">delete</span></button>`}</div>
            </div>
            <div class="wh-stats"><div class="wh-stat">المنتجات: <strong>${whProducts.length}</strong></div><div class="wh-stat">القيمة: <strong>${fmt(totalValue)}</strong></div>${lowCount>0?`<div class="wh-stat" style="color:var(--error)">نقص: <strong>${lowCount}</strong></div>`:''}</div></div>`;
        }).join('')}`;
}

let transferCart = [];
let transferFrom = '';
let transferTo = '';

function openTransferScreen() {
    const warehouses = DB.get('warehouses');
    if (warehouses.length < 2) { toast('يجب أن يكون هناك مخزنين على الأقل','error'); return; }
    transferCart = [];
    transferFrom = warehouses[0]?.id || '';
    transferTo = warehouses[1]?.id || '';
    renderTransferScreen(document.getElementById('contentArea'));
}

function renderTransferScreen(area) {
    const warehouses = DB.get('warehouses');
    const products = DB.get('products');
    const fromProducts = products.filter(p => p.warehouseId === transferFrom);
    area.innerHTML = `
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">
            <button class="btn btn-sm btn-outline" onclick="renderWarehouses(document.getElementById('contentArea'))"><span class="material-icons-round">arrow_forward</span></button>
            <h2 style="font-size:18px;font-weight:800"><span class="material-icons-round" style="vertical-align:middle">swap_horiz</span> تحويل مخزني</h2>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">
            <div style="flex:1;min-width:140px">
                <label style="font-size:11px;color:var(--text-secondary);display:block;margin-bottom:2px">تحويل من</label>
                <select class="form-control" id="transferFrom" onchange="transferFrom=this.value;renderTransferScreen(document.getElementById('contentArea'))" style="font-size:13px">
                    ${warehouses.map(w=>`<option value="${w.id}" ${w.id===transferFrom?'selected':''}>${w.name}</option>`).join('')}
                </select>
            </div>
            <div style="flex:1;min-width:140px">
                <label style="font-size:11px;color:var(--text-secondary);display:block;margin-bottom:2px">تحويل إلى</label>
                <select class="form-control" id="transferTo" onchange="transferTo=this.value" style="font-size:13px">
                    ${warehouses.map(w=>`<option value="${w.id}" ${w.id===transferTo?'selected':''}>${w.name}</option>`).join('')}
                </select>
            </div>
        </div>
        <div style="position:relative;margin-bottom:12px">
            <input class="form-control" placeholder="🔍 ابحث عن منتج..." id="transferSearch" oninput="searchTransferProducts(this.value)" style="padding:8px 12px;font-size:13px">
            <div id="transferDropdown" style="display:none;position:absolute;top:100%;right:0;left:0;background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-sm);max-height:200px;overflow-y:auto;z-index:50;box-shadow:var(--shadow-lg);margin-top:4px"></div>
        </div>
        <div class="section-card">
            <div style="font-size:13px;font-weight:700;margin-bottom:8px">المنتجات المحددة (${transferCart.length})</div>
            ${transferCart.length===0?'<div style="text-align:center;padding:20px;color:var(--text-secondary)">لم تُحدد أي منتج بعد</div>':''}
            ${transferCart.length>0?`<div class="table-container"><table><thead><tr><th>المنتج</th><th>متوفر</th><th>الكمية</th><th></th></tr></thead><tbody>
            ${transferCart.map((item,i)=>`<tr>
                <td><strong>${item.productName}</strong></td>
                <td>${item.available}</td>
                <td><input type="number" class="form-control" value="${item.quantity}" min="1" max="${item.available}" onchange="updateTransferQty(${i},this.value)" style="width:70px;padding:4px 8px;font-size:12px"></td>
                <td><button class="btn btn-sm btn-danger" onclick="transferCart.splice(${i},1);renderTransferScreen(document.getElementById('contentArea'))"><span class="material-icons-round">close</span></button></td>
            </tr>`).join('')}
            </tbody></table></div>`:''}
            <button class="btn btn-primary btn-block" onclick="executeTransfer()" style="margin-top:8px" ${transferCart.length===0?'disabled':''}><span class="material-icons-round">swap_horiz</span> تنفيذ التحويل</button>
        </div>`;
}

function searchTransferProducts(q) {
    const dd = document.getElementById('transferDropdown');
    if (!dd) return;
    q = q.trim();
    if (!q) { dd.style.display = 'none'; return; }
    const products = DB.get('products');
    const fromProducts = products.filter(p => p.warehouseId === transferFrom);
    const found = fromProducts.filter(p => p.name.toLowerCase().includes(q.toLowerCase()) || (p.barcode||'').includes(q));
    dd.style.display = 'block';
    if (found.length === 0) { dd.innerHTML = '<div style="padding:10px;color:var(--text-secondary);font-size:12px">لا توجد نتائج</div>'; return; }
    dd.innerHTML = found.map(p => {
        const inCart = transferCart.find(c => c.productId === p.id);
        return `<div style="padding:8px 12px;cursor:pointer;border-bottom:1px solid var(--border);font-size:12px;${inCart?'opacity:0.5':''}" onclick="${inCart?'':'addTransferItem(\''+p.id+'\')'}">
            <strong>${p.name}</strong> <span style="color:var(--text-secondary)">متوفر: ${p.quantity}</span>
        </div>`;
    }).join('');
}

function addTransferItem(productId) {
    const products = DB.get('products');
    const p = products.find(x => x.id === productId);
    if (!p) return;
    if (transferCart.find(c => c.productId === productId)) return;
    transferCart.push({ productId: p.id, productName: p.name, quantity: 1, available: p.quantity });
    document.getElementById('transferDropdown').style.display = 'none';
    document.getElementById('transferSearch').value = '';
    renderTransferScreen(document.getElementById('contentArea'));
}

function updateTransferQty(idx, val) {
    const qty = parseInt(val) || 1;
    transferCart[idx].quantity = Math.min(qty, transferCart[idx].available);
    renderTransferScreen(document.getElementById('contentArea'));
}

function executeTransfer() {
    if (transferCart.length === 0) { toast('حدد منتجات أولاً','error'); return; }
    if (transferFrom === transferTo) { toast('يجب أن يكون المخزن مختلف','error'); return; }
    const products = DB.get('products');
    const movements = DB.get('movements') || [];
    let anyError = false;
    transferCart.forEach(item => {
        const p = products.find(x => x.id === item.productId);
        if (!p || p.quantity < item.quantity) { anyError = true; return; }
    });
    if (anyError) { toast('كمية غير كافية في المخزن المصدر','error'); return; }
    const fromName = DB.get('warehouses').find(w=>w.id===transferFrom)?.name||'';
    const toName = DB.get('warehouses').find(w=>w.id===transferTo)?.name||'';
    transferCart.forEach(item => {
        const p = products.find(x => x.id === item.productId);
        if (p) {
            p.quantity -= item.quantity;
            movements.unshift({ id:uid(), productId:p.id, productName:p.name, type:'transfer', quantity:-item.quantity, invoiceNumber:'تحويل', date:new Date().toISOString(), fromWarehouse:fromName, toWarehouse:toName, transferQty:item.quantity });
        }
    });
    DB.set('products', products);
    DB.set('movements', movements);
    toast(`تم التحويل من ${fromName} إلى ${toName}`);
    transferCart = [];
    renderWarehouses(document.getElementById('contentArea'));
}

function openWarehouseModal(id) {
    const warehouses = DB.get('warehouses');
    const w = id ? warehouses.find(x=>x.id===id) : null;
    openModal(w?'تعديل المخزن':'إضافة مخزن', `
        <div class="form-group"><label>اسم المخزن *</label><input class="form-control" id="whName" value="${w?w.name:''}"></div>
        <div class="form-group"><label>الموقع</label><input class="form-control" id="whLocation" value="${w?w.location||'':''}"></div>
    `, `<button class="btn btn-primary" onclick="saveWarehouse('${id||''}')">حفظ</button><button class="btn btn-outline" onclick="closeModal()">إلغاء</button>`);
}

function saveWarehouse(id) {
    const name = document.getElementById('whName').value.trim();
    if (!name) { toast('أدخل اسم المخزن','error'); return; }
    const warehouses = DB.get('warehouses');
    const data = { name, location:document.getElementById('whLocation').value.trim() };
    if (id) { const idx=warehouses.findIndex(w=>w.id===id); if(idx>=0) warehouses[idx]={...warehouses[idx],...data}; }
    else warehouses.push({ id:uid(), ...data });
    DB.set('warehouses',warehouses); closeModal(); toast('تم الحفظ');
    renderWarehouses(document.getElementById('contentArea'));
}

function deleteWarehouse(id) {
    const warehouses = DB.get('warehouses');
    const wh = warehouses.find(w=>w.id===id);
    if (wh?.isDefault) { toast('لا يمكن حذف المخزن الافتراضي','error'); return; }
    confirmModal('هل أنت متأكد من حذف هذا المخزن؟', function() {
        moveToTrash('warehouse', id);
        DB.set('warehouses', warehouses.filter(w=>w.id!==id)); toast('تم الحذف');
        renderWarehouses(document.getElementById('contentArea'));
    });
}

// ==================== PURCHASE ORDERS ====================
function renderPurchaseOrders(area) {
    const orders = DB.get('purchaseOrders');
    const suppliers = DB.get('suppliers');
    const products = DB.get('products');
    area.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;flex-wrap:wrap;gap:6px">
            <div style="display:flex;align-items:center;gap:6px">
                <button class="btn btn-sm btn-outline" onclick="showScreen('dashboard')"><span class="material-icons-round" style="font-size:16px">arrow_forward</span></button>
                <h2 style="font-size:16px;font-weight:800">طلبات الشراء</h2>
            </div>
            <button class="btn btn-sm btn-primary" onclick="openPOEditor()"><span class="material-icons-round">add</span> طلب جديد</button>
        </div>
        <div style="margin-bottom:10px"><input class="form-control" placeholder="بحث..." oninput="filterList(this.value,'poList')" style="font-size:13px;padding:8px 12px"></div>
        <div id="poList">${orders.length===0?'<div class="section-card" style="text-align:center;padding:32px;color:var(--text-secondary)"><span class="material-icons-round" style="font-size:40px;display:block;margin-bottom:8px">assignment</span>لا توجد طلبات شراء</div>':orders.map(o=>{
            const sup = suppliers.find(s=>s.id===o.supplierId);
            const statusColors = {draft:'#6B7280',sent:'#2563EB',confirmed:'#059669',received:'#10B981',cancelled:'#EF4444'};
            const statusLabels = {draft:'مسودة',sent:'مرسل',confirmed:'مؤكد',received:'مستلم',cancelled:'ملغي'};
            const itemsCount = (o.items||[]).length;
            return `<div class="section-card" style="margin-bottom:8px;padding:12px">
                <div style="display:flex;align-items:center;gap:10px">
                    <div class="user-avatar" style="width:40px;height:40px;font-size:14px;background:#8B5CF6;flex-shrink:0">${o.orderNumber}</div>
                    <div style="flex:1;min-width:0"><strong>طلب #${o.orderNumber}</strong><br>
                        <small style="color:var(--text-secondary)">${sup?sup.name:'—'} | ${itemsCount} صنف | ${fmt(o.total||0)}</small><br>
                        <span class="badge" style="background:${statusColors[o.status]||'#6B7280'}22;color:${statusColors[o.status]||'#6B7280'};font-size:10px;margin-top:2px">${statusLabels[o.status]||o.status}</span>
                    </div>
                    <div style="display:flex;gap:4px;flex-shrink:0">
                        ${o.status!=='received'&&o.status!=='cancelled'?`<button class="btn btn-sm btn-outline" onclick="convertToPurchase('${o.id}')" title="تحويل لفاتورة شراء وتحديث المخزون"><span class="material-icons-round" style="font-size:14px">shopping_cart</span> تحويل</button>`:''}
                        <button class="btn btn-sm btn-outline" onclick="openPOEditor('${o.id}')"><span class="material-icons-round">edit</span></button>
                        <button class="btn btn-sm btn-danger" onclick="deletePurchaseOrder('${o.id}')"><span class="material-icons-round">delete</span></button>
                    </div>
                </div>
            </div>`;
        }).join('')}</div>`;
}

function openPurchaseOrderModal(id) {
    const orders = DB.get('purchaseOrders');
    const o = id ? orders.find(x=>x.id===id) : null;
    const suppliers = DB.get('suppliers');
    const products = DB.get('products');
    const suppliersHtml = suppliers.map(s => `<option value="${s.id}" ${o&&o.supplierId===s.id?'selected':''}>${s.name}</option>`).join('');
    const statuses = [{val:'draft',label:'مسودة'},{val:'sent',label:'مرسل'},{val:'confirmed',label:'مؤكد'},{val:'received',label:'مستلم'},{val:'cancelled',label:'ملغي'}];
    const statusHtml = statuses.map(s => `<option value="${s.val}" ${o&&o.status===s.val?'selected':''}>${s.label}</option>`).join('');
    const items = o ? o.items : [{productId:'',quantity:1,unitPrice:0}];
    const itemsHtml = items.map((item,i) => {
        const prods = products.map(p => `<option value="${p.id}" ${item.productId===p.id?'selected':''}>${p.name} (${p.barcode||''}) - ${fmt(p.buyingPrice)}</option>`).join('');
        return `<div class="po-item" style="display:grid;grid-template-columns:1fr 60px 80px auto;gap:6px;align-items:center;margin-bottom:6px">
            <select class="form-control po-prod" style="font-size:12px;padding:6px">${prods}</select>
            <input class="form-control po-qty" type="number" value="${item.quantity}" min="1" style="font-size:12px;padding:6px">
            <input class="form-control po-price" type="number" value="${item.unitPrice}" step="0.01" style="font-size:12px;padding:6px">
            <button class="btn btn-sm btn-danger" onclick="this.parentElement.remove()" style="padding:4px"><span class="material-icons-round" style="font-size:14px">close</span></button>
        </div>`;
    }).join('');

    openModal(o?'تعديل طلب شراء':'طلب شراء جديد', `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
            <div class="form-group"><label>رقم الطلب</label><input class="form-control" id="poNumber" value="${o?o.orderNumber:(orders.length?Math.max(...orders.map(x=>x.orderNumber))+1:1)}" ${o?'disabled':''}></div>
            <div class="form-group"><label>المورد *</label><select class="form-control" id="poSupplier"><option value="">اختر مورد</option>${suppliersHtml}</select></div>
        </div>
        <div class="form-group"><label>الحالة</label><select class="form-control" id="poStatus">${statusHtml}</select></div>
        <div class="form-group"><label>ملاحظات</label><textarea class="form-control" id="poNotes" rows="2">${o?o.notes||'':''}</textarea></div>
        <div class="form-group">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px"><label style="margin:0">الأصناف</label><button class="btn btn-sm btn-outline" onclick="addPOItem()"><span class="material-icons-round" style="font-size:14px">add</span></button></div>
            <div id="poItemsContainer">${itemsHtml}</div>
        </div>
    `, `<button class="btn btn-primary" onclick="savePurchaseOrder('${id||''}')">حفظ</button><button class="btn btn-outline" onclick="closeModal()">إلغاء</button>`);
}

function addPOItem() {
    const products = DB.get('products');
    const prods = products.map(p => `<option value="${p.id}">${p.name} (${p.barcode||''}) - ${fmt(p.buyingPrice)}</option>`).join('');
    const div = document.createElement('div');
    div.className = 'po-item';
    div.style.cssText = 'display:grid;grid-template-columns:1fr 60px 80px auto;gap:6px;align-items:center;margin-bottom:6px';
    div.innerHTML = `
        <select class="form-control po-prod" style="font-size:12px;padding:6px"><option value="">اختر صنف</option>${prods}</select>
        <input class="form-control po-qty" type="number" value="1" min="1" style="font-size:12px;padding:6px">
        <input class="form-control po-price" type="number" value="0" step="0.01" style="font-size:12px;padding:6px">
        <button class="btn btn-sm btn-danger" onclick="this.parentElement.remove()" style="padding:4px"><span class="material-icons-round" style="font-size:14px">close</span></button>`;
    document.getElementById('poItemsContainer').appendChild(div);
}

function savePurchaseOrder(id) {
    const supplierId = document.getElementById('poSupplier').value;
    if (!supplierId) { toast('اختر مورد', 'error'); return; }
    const itemsEls = document.querySelectorAll('.po-item');
    if (itemsEls.length === 0) { toast('أضف صنف واحد على الأقل', 'error'); return; }
    const items = [];
    itemsEls.forEach(el => {
        const productId = el.querySelector('.po-prod').value;
        const quantity = parseInt(el.querySelector('.po-qty').value)||0;
        const unitPrice = parseFloat(el.querySelector('.po-price').value)||0;
        if (productId && quantity > 0) items.push({productId, quantity, unitPrice, total: quantity * unitPrice});
    });
    const total = items.reduce((s,i) => s + i.total, 0);
    const orders = DB.get('purchaseOrders');
    const orderNumber = parseInt(document.getElementById('poNumber').value);
    const notes = document.getElementById('poNotes').value.trim();
    const status = document.getElementById('poStatus').value;

    if (id) {
        const idx = orders.findIndex(o=>o.id===id);
        if (idx !== -1) { orders[idx].supplierId = supplierId; orders[idx].items = items; orders[idx].total = total; orders[idx].notes = notes; orders[idx].status = status; }
    } else {
        orders.push({ id:'po'+Date.now(), orderNumber, supplierId, items, total, notes, status, createdAt: new Date().toISOString() });
    }
    DB.set('purchaseOrders', orders);
    toast('تم حفظ طلب الشراء');
    closeModal();
    renderPurchaseOrders(document.getElementById('contentArea'));
}

function deletePurchaseOrder(id) {
    confirmModal('هل أنت متأكد من حذف هذا الطلب؟', function() {
        const orders = DB.get('purchaseOrders').filter(o=>o.id!==id);
        DB.set('purchaseOrders', orders);
        toast('تم الحذف');
        renderPurchaseOrders(document.getElementById('contentArea'));
    });
}

function openPOEditor(poId) {
    const orders = DB.get('purchaseOrders');
    const o = poId ? orders.find(x=>x.id===poId) : null;
    const products = DB.get('products');
    purCart = o ? o.items.map(i=>({ productId:i.productId, productName:(products.find(p=>p.id===i.productId)||{}).name||'', unitPrice:i.unitPrice, quantity:i.quantity, discount:0, taxRate:0 })) : [];
    purSupplierId = o?o.supplierId:'';
    purSupplierName = o?o.supplierName:'';
    purDiscount = 0; purDiscountType='amount'; purPaymentMethod='cash'; purNotes = o?o.notes||'':'';
    poContext = poId || 'new';
    purMode='invoice';
    showScreen('purchases');
}

function savePOFromPurchases(poId) {
    if (purCart.length===0) { toast('السلة فارغة','error'); return; }
    if (!purSupplierId) { toast('اختر مورد','error'); return; }
    const subtotal = purCart.reduce((s,i)=>s+i.unitPrice*i.quantity,0);
    const itemDiscounts = purCart.reduce((s,i)=>s+(i.discount||0),0);
    const invDiscount = purDiscountType==='percent'?(subtotal-itemDiscounts)*purDiscount/100:purDiscount;
    const taxable = subtotal - itemDiscounts - invDiscount;
    const tax = curTax||0;
    const total = taxable + tax;
    const items = purCart.map(i=>({ productId:i.productId, quantity:i.quantity, unitPrice:i.unitPrice, total:i.unitPrice*i.quantity }));
    const orders = DB.get('purchaseOrders');
    const idx = orders.findIndex(o=>o.id===poId);
    const orderNumber = idx>=0 ? orders[idx].orderNumber : (orders.length?Math.max(...orders.map(x=>x.orderNumber))+1:1);
    const data = { supplierId:purSupplierId, supplierName:purSupplierName, items, total, taxAmount:tax, discount:invDiscount+itemDiscounts, notes:purNotes||'', status:'draft', createdAt:new Date().toISOString() };
    if (idx>=0) Object.assign(orders[idx], data);
    else orders.push({ id:'po'+Date.now(), orderNumber, ...data });
    DB.set('purchaseOrders', orders);
    poContext=null; purCart=[]; purSupplierId=''; purSupplierName=''; purDiscount=0; curTax=0; purDiscountType='amount'; purPaymentMethod='cash'; purNotes='';
    toast('تم حفظ طلب الشراء');
    showScreen('purchaseOrders');
}

function convertToPurchase(poId) {
    const orders = DB.get('purchaseOrders');
    const o = orders.find(x=>x.id===poId);
    if (!o) return;
    if (o.status==='received'||o.status==='cancelled') { toast('تم تحويل هذا الطلب مسبقاً','warning'); return; }
    confirmModal('تحويل الطلب لفاتورة شراء وتحديث المخزون؟', function() {
        const products = DB.get('products');
        const items = (o.items||[]).map(i=>({ productId:i.productId, productName:(products.find(p=>p.id===i.productId)||{}).name||'', unitPrice:i.unitPrice, quantity:i.quantity, discount:0, taxRate:0 }));
        const subtotal = items.reduce((s,i)=>s+i.unitPrice*i.quantity,0);
        const invoice = {
            id:uid(), invoiceNumber:nextInvoiceNumber(), items,
            subtotal, discount:0, taxAmount:0, total:subtotal,
            paidAmount:0, remainingAmount:subtotal,
            paymentMethod:'نقدي', status:'paid', type:'purchase',
            customerId:o.supplierId, customerName:o.supplierName,
            notes:(o.notes||'')+` (من طلب شراء #${o.orderNumber})`, createdBy:currentUser?.username||'',
            createdAt:new Date().toISOString()
        };
        const invoices = DB.get('invoices'); invoices.unshift(invoice); DB.set('invoices', invoices);
        const prods = DB.get('products');
        const movements = DB.get('movements')||[];
        items.forEach(item=>{ const p=prods.find(x=>x.id===item.productId); if(p){ p.quantity += item.quantity; movements.unshift({ id:uid(), productId:p.id, productName:p.name, type:'purchase', quantity:item.quantity, invoiceNumber:invoice.invoiceNumber, date:new Date().toISOString() }); } });
        DB.set('products', prods); DB.set('movements', movements);
        o.status='received'; DB.set('purchaseOrders', orders);
        toast('تم تحويل الطلب لفاتورة شراء وتحديث المخزون','success');
        renderPurchaseOrders(document.getElementById('contentArea'));
    });
}

// ==================== EXPENSES ====================
function renderExpenses(area) {
    const expenses = DB.get('expenses');
    const total = expenses.reduce((s,e)=>s+e.amount,0);
    area.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;flex-wrap:wrap;gap:6px">
            <div style="display:flex;align-items:center;gap:6px">
                <button class="btn btn-sm btn-outline" onclick="showScreen('dashboard')"><span class="material-icons-round" style="font-size:16px">arrow_forward</span></button>
                <h2 style="font-size:16px;font-weight:800">المصروفات</h2>
            </div>
            <div style="display:flex;gap:4px;align-items:center">
                <button class="btn btn-sm btn-outline" onclick="exportExpensesCSV()"><span class="material-icons-round" style="font-size:14px">file_download</span> CSV</button>
                <button class="btn btn-sm btn-outline" onclick="exportExpensesPDF()"><span class="material-icons-round" style="font-size:14px">picture_as_pdf</span> PDF</button>
                <button class="btn btn-sm btn-primary" onclick="openExpenseModal()"><span class="material-icons-round">add</span> إضافة</button>
            </div>
        </div>
        <div class="section-card" style="margin-bottom:12px"><div style="display:flex;justify-content:space-between;align-items:center"><span style="color:var(--text-secondary)">الإجمالي</span><span style="font-size:18px;font-weight:800;color:var(--error)" id="expFilteredTotal">${fmt(total)}</span></div></div>
        ${dateFilterBar('exp')}
        <div class="section-card"><div class="table-container"><table id="expensesTable"><thead><tr><th data-sortkey="desc" data-sorttype="str" style="cursor:pointer">الوصف</th><th data-sortkey="total" data-sorttype="num" style="text-align:left;cursor:pointer">المبلغ</th><th data-sortkey="date" data-sorttype="date" style="cursor:pointer">التاريخ</th><th data-sortkey="act" data-sorttype="str" style="cursor:pointer">إجراءات</th></tr></thead><tbody id="expTableBody">
        ${expenses.map(e=>`<tr data-date="${e.date}" data-total="${e.amount}" style="cursor:pointer" onclick="openExpenseModal('${e.id}')"><td data-sort="${e.description||'-'}"><strong>${e.description||'-'}</strong>${e.notes?`<br><small style="color:var(--text-secondary)">${e.notes}</small>`:''}</td><td style="font-weight:700;color:var(--error)" data-sort="${e.amount}">${fmt(e.amount)}</td><td data-sort="${e.date}">${fmtDate(e.date)}</td><td data-sort="x"><button class="btn btn-sm btn-danger" onclick="event.stopPropagation();deleteExpense('${e.id}')"><span class="material-icons-round">delete</span></button></td></tr>`).join('')}
        </tbody></table></div></div>`;
    enableTableSort('expensesTable');
}

function openExpenseModal(id) {
    const expenses = DB.get('expenses');
    const e = id ? expenses.find(x=>x.id===id) : null;
    const dateVal = e ? new Date(e.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
    openModal(e?'تعديل مصروف':'إضافة مصروف', `
        <div class="form-group"><label>الوصف *</label><input class="form-control" id="expDesc" value="${e?e.description||'':''}" placeholder="وصف المصروف"></div>
        <div class="form-group"><label>المبلغ *</label><input class="form-control" type="number" id="expAmount" value="${e?e.amount:''}"></div>
        <div class="form-group"><label>التاريخ</label><input class="form-control" type="date" id="expDate" value="${dateVal}"></div>
        <div class="form-group"><label>ملاحظات</label><input class="form-control" id="expNotes" value="${e?e.notes||'':''}" placeholder="ملاحظات إضافية"></div>
    `, `<button class="btn btn-primary" onclick="saveExpense('${id||''}')">حفظ</button><button class="btn btn-outline" onclick="closeModal()">إلغاء</button>`);
}

function saveExpense(id) {
    const amount = parseFloat(document.getElementById('expAmount').value);
    const desc = document.getElementById('expDesc').value.trim();
    if (!amount) { toast('أدخل المبلغ','error'); return; }
    if (!desc) { toast('أدخل الوصف','error'); return; }
    const dateVal = document.getElementById('expDate').value;
    const date = dateVal ? new Date(dateVal).toISOString() : new Date().toISOString();
    const notes = document.getElementById('expNotes').value.trim();
    const expenses = DB.get('expenses');
    const data = { amount, description:desc, notes, date };
    if (id) { const idx=expenses.findIndex(e=>e.id===id); if(idx>=0) expenses[idx]={...expenses[idx],...data}; }
    else expenses.push({ id:uid(), ...data, createdAt:new Date().toISOString() });
    DB.set('expenses',expenses); closeModal(); toast('تم الحفظ');
    renderExpenses(document.getElementById('contentArea'));
}

function deleteExpense(id) {
    confirmModal('هل أنت متأكد من حذف هذا المصروف؟', function() {
        moveToTrash('expense', id);
        DB.set('expenses', DB.get('expenses').filter(e=>e.id!==id)); toast('تم الحذف');
        renderExpenses(document.getElementById('contentArea'));
    });
}

// ==================== INVENTORY COUNTS (الجرد) ====================
let countMode = 'list'; // list, new, summary
let currentCountId = null;

function renderInventoryCounts(area) {
    const counts = (DB.get('inventoryCounts') || []).sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));
    if (countMode === 'new') return renderNewCount(area);
    if (countMode === 'summary') return renderCountSummary(area);

    area.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;flex-wrap:wrap;gap:6px">
            <div style="display:flex;align-items:center;gap:6px">
                <button class="btn btn-sm btn-outline" onclick="showScreen('dashboard')"><span class="material-icons-round" style="font-size:16px">arrow_forward</span></button>
                <h2 style="font-size:16px;font-weight:800">الجرد</h2>
            </div>
            <button class="btn btn-sm btn-primary" onclick="startNewCount()"><span class="material-icons-round">add</span> جرد جديد</button>
        </div>
        ${counts.length === 0 ? `<div class="empty-state"><span class="material-icons-round">inventory</span><h3>لا يوجد جرد</h3><p>ابدأ جرد جديد لضبط المخزون</p></div>` : ''}
        ${counts.map(c => {
            const incCount = c.items.filter(i => i.adjustedDiff > 0).length;
            const decCount = c.items.filter(i => i.adjustedDiff < 0).length;
            const noChange = c.items.filter(i => i.adjustedDiff === 0).length;
            return `<div class="section-card" style="cursor:pointer" onclick="viewCount('${c.id}')">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
                    <div style="display:flex;align-items:center;gap:6px">
                        <span class="material-icons-round" style="color:${c.status==='posted'?'var(--success)':'var(--warning)'};font-size:20px">${c.status==='posted'?'check_circle':'pending'}</span>
                        <div>
                            <div style="font-weight:700;font-size:13px">${c.countNumber}</div>
                            <div style="font-size:10px;color:var(--text-muted)">${fmtDateTime(c.createdAt)}</div>
                        </div>
                    </div>
                    <div style="display:flex;align-items:center;gap:6px">
                        <span class="badge ${c.status==='posted'?'badge-success':'badge-warning'}">${c.status==='posted'?'مرحل':'مسودة'}</span>
                        <button class="remove-btn" onclick="event.stopPropagation();deleteCount('${c.id}')" style="padding:4px;border-radius:6px" title="حذف"><span class="material-icons-round" style="font-size:16px;color:var(--error)">delete</span></button>
                    </div>
                </div>
                <div style="display:flex;gap:8px;font-size:10px;color:var(--text-secondary);flex-wrap:wrap">
                    <span>${c.items.length} صنف</span>
                    ${incCount>0?`<span style="color:var(--success)">↑ ${incCount} زيادة</span>`:''}
                    ${decCount>0?`<span style="color:var(--error)">↓ ${decCount} نقص</span>`:''}
                    ${noChange>0?`<span>= ${noChange} بدون تغيير</span>`:''}
                </div>
            </div>`;
        }).join('')}
    `;
}

function startNewCount() {
    const products = DB.get('products').filter(p => p.isActive);
    if (products.length === 0) { toast('لا يوجد أصناف للجرد','error'); return; }
    const counts = DB.get('inventoryCounts') || [];
    const countNum = counts.length + 1;
    const count = {
        id: uid(),
        countNumber: 'جرد #' + countNum,
        status: 'draft',
        createdAt: new Date().toISOString(),
        items: products.map(p => ({
            productId: p.id,
            productName: p.name,
            barcode: p.barcode || '',
            unit: p.unit || 'قطعة',
            systemQty: p.quantity,
            actualQty: p.quantity,
            difference: 0,
            adjustedDiff: 0
        }))
    };
    counts.push(count);
    DB.set('inventoryCounts', counts);
    currentCountId = count.id;
    countMode = 'new';
    renderInventoryCounts(document.getElementById('contentArea'));
}

function renderNewCount(area) {
    const counts = DB.get('inventoryCounts') || [];
    const count = counts.find(c => c.id === currentCountId);
    if (!count) { countMode = 'list'; renderInventoryCounts(area); return; }

    area.innerHTML = `
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:10px">
            <button class="btn btn-sm btn-outline" onclick="countMode='list';renderInventoryCounts(document.getElementById('contentArea'))"><span class="material-icons-round" style="font-size:16px">arrow_forward</span></button>
            <h2 style="font-size:16px;font-weight:800">${count.countNumber}</h2>
        </div>
        <div style="display:flex;gap:6px;margin-bottom:10px;flex-wrap:wrap">
            <button class="btn btn-sm btn-primary" onclick="saveCountDraft()"><span class="material-icons-round" style="font-size:14px">save</span> حفظ</button>
            <button class="btn btn-sm btn-success" onclick="calculateDifferences()"><span class="material-icons-round" style="font-size:14px">calculate</span> حساب الفوارق</button>
        </div>
        <div style="margin-bottom:10px"><input class="form-control" placeholder="بحث بالاسم أو الباركود..." oninput="filterCountProducts(this.value)" id="countSearch" style="font-size:12px;padding:7px 10px"></div>
        <div id="countProductsList">
            ${count.items.map((item, idx) => `
                <div class="count-item" data-idx="${idx}" style="display:flex;align-items:center;gap:6px;padding:8px;background:var(--card);border-radius:var(--radius-sm);margin-bottom:4px;border:1px solid var(--border-light)">
                    <div style="flex:1;min-width:0">
                        <div style="font-size:11px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${item.productName}</div>
                        <div style="font-size:9px;color:var(--text-muted)">${item.barcode || ''}</div>
                    </div>
                    <div style="text-align:center;min-width:50px">
                        <div style="font-size:9px;color:var(--text-muted)">النظام</div>
                        <div style="font-size:12px;font-weight:700;color:var(--primary)">${item.systemQty}</div>
                    </div>
                    <div style="text-align:center;min-width:60px">
                        <div style="font-size:9px;color:var(--text-muted)">الفعلي</div>
                        <input type="number" min="0" value="${item.actualQty}" onchange="updateCountQty(${idx}, this.value)" style="width:55px;padding:4px;border:1.5px solid var(--border);border-radius:6px;text-align:center;font-size:12px;font-weight:600;font-family:inherit;background:var(--surface);color:var(--text)">
                    </div>
                    <button class="remove-btn" onclick="removeCountItem(${idx})" style="padding:4px;border-radius:6px" title="حذف"><span class="material-icons-round" style="font-size:16px;color:var(--error)">close</span></button>
                </div>
            `).join('')}
        </div>
    `;
}

function updateCountQty(idx, val) {
    const counts = DB.get('inventoryCounts') || [];
    const count = counts.find(c => c.id === currentCountId);
    if (!count) return;
    count.items[idx].actualQty = parseInt(val) || 0;
    count.items[idx].difference = count.items[idx].actualQty - count.items[idx].systemQty;
    DB.set('inventoryCounts', counts);
}

function removeCountItem(idx) {
    const counts = DB.get('inventoryCounts') || [];
    const count = counts.find(c => c.id === currentCountId);
    if (!count) return;
    const item = count.items[idx];
    if (!item) return;

    if (count.status === 'posted' && item.adjustedDiff !== 0) {
        confirmModal('سيتم عكس تأثير هذا الصنف على المخزون. متابعة؟', function() {
            const products = DB.get('products');
            const movements = DB.get('movements') || [];
            const pIdx = products.findIndex(p => p.id === item.productId);
            if (pIdx >= 0) {
                const p = products[pIdx];
                const oldQty = p.quantity;
                p.quantity -= item.adjustedDiff;
                if (p.quantity < 0) p.quantity = 0;
                products[pIdx] = {...p};
                movements.push({
                    id: uid(), productId: p.id, productName: p.name,
                    type: 'adjustment',
                    quantity: -item.adjustedDiff,
                    fromQty: oldQty,
                    toQty: p.quantity,
                    date: new Date().toISOString(),
                    note: count.countNumber + ' (حذف صنف من الجرد)'
                });
                DB.set('products', products);
                DB.set('movements', movements);
            }
            count.items.splice(idx, 1);
            DB.set('inventoryCounts', counts);
            toast('تم حذف الصنف وعكس التأثير');
            renderInventoryCounts(document.getElementById('contentArea'));
        });
    } else {
        count.items.splice(idx, 1);
        DB.set('inventoryCounts', counts);
        toast('تم الحذف');
        renderInventoryCounts(document.getElementById('contentArea'));
    }
}

function filterCountProducts(query) {
    const q = query.toLowerCase();
    document.querySelectorAll('.count-item').forEach(el => {
        const idx = parseInt(el.dataset.idx);
        const counts = DB.get('inventoryCounts') || [];
        const count = counts.find(c => c.id === currentCountId);
        if (!count) return;
        const item = count.items[idx];
        const match = item.productName.toLowerCase().includes(q) || (item.barcode||'').includes(q);
        el.style.display = match ? 'flex' : 'none';
    });
}

function saveCountDraft() {
    toast('تم الحفظ');
    countMode = 'list';
    renderInventoryCounts(document.getElementById('contentArea'));
}

function calculateDifferences() {
    const counts = DB.get('inventoryCounts') || [];
    const count = counts.find(c => c.id === currentCountId);
    if (!count) return;
    count.items.forEach(item => {
        item.difference = item.actualQty - item.systemQty;
        item.adjustedDiff = item.difference;
    });
    DB.set('inventoryCounts', counts);
    countMode = 'summary';
    renderInventoryCounts(document.getElementById('contentArea'));
}

function renderCountSummary(area) {
    const counts = DB.get('inventoryCounts') || [];
    const count = counts.find(c => c.id === currentCountId);
    if (!count) { countMode = 'list'; renderInventoryCounts(area); return; }

    const increases = count.items.filter(i => i.adjustedDiff > 0).sort((a,b) => b.adjustedDiff - a.adjustedDiff);
    const decreases = count.items.filter(i => i.adjustedDiff < 0).sort((a,b) => a.adjustedDiff - b.adjustedDiff);
    const noChange = count.items.filter(i => i.adjustedDiff === 0);

    area.innerHTML = `
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:10px">
            <button class="btn btn-sm btn-outline" onclick="countMode='new';renderInventoryCounts(document.getElementById('contentArea'))"><span class="material-icons-round" style="font-size:16px">arrow_forward</span></button>
            <h2 style="font-size:16px;font-weight:800">ملخص الفوارق - ${count.countNumber}</h2>
        </div>
        <div style="display:flex;gap:6px;margin-bottom:10px;flex-wrap:wrap">
            <button class="btn btn-sm btn-primary" onclick="countMode='new';renderInventoryCounts(document.getElementById('contentArea'))"><span class="material-icons-round" style="font-size:14px">edit</span> تعديل</button>
            <button class="btn btn-sm btn-success" onclick="postInventoryCount()"><span class="material-icons-round" style="font-size:14px">check_circle</span> ترحيل الفوارق</button>
            <button class="btn btn-sm btn-outline" onclick="transferCountToPurchase()"><span class="material-icons-round" style="font-size:14px">shopping_cart</span> نقل العجز لسلة الشراء</button>
        </div>
        <div class="stats-grid" style="grid-template-columns:1fr 1fr 1fr;margin-bottom:10px">
            <div class="stat-card" style="cursor:default"><div class="label">زيادة</div><div class="value" style="color:var(--success)">${increases.length}</div></div>
            <div class="stat-card" style="cursor:default"><div class="label">نقص</div><div class="value" style="color:var(--error)">${decreases.length}</div></div>
            <div class="stat-card" style="cursor:default"><div class="label">بدون تغيير</div><div class="value">${noChange.length}</div></div>
        </div>
        ${increases.length > 0 ? `
            <div class="section-card">
                <div class="section-header"><h3 style="color:var(--success)"><span class="material-icons-round" style="font-size:16px">trending_up</span> زيادة (${increases.length})</h3></div>
                ${increases.map((item, idx) => `
                    <div style="display:flex;align-items:center;gap:6px;padding:8px;border-bottom:1px solid var(--border-light)">
                        <div style="flex:1;min-width:0">
                            <div style="font-size:11px;font-weight:600">${item.productName}</div>
                            <div style="font-size:9px;color:var(--text-muted)">${item.systemQty} → ${item.actualQty}</div>
                        </div>
                        <div style="display:flex;align-items:center;gap:4px">
                            <span style="font-size:11px;color:var(--success);font-weight:700">+${item.adjustedDiff}</span>
                            <input type="number" min="0" max="${item.adjustedDiff}" value="${item.adjustedDiff}" onchange="updateAdjustedDiff('inc', ${count.items.indexOf(item)}, this.value)" style="width:45px;padding:3px;border:1px solid var(--border);border-radius:4px;text-align:center;font-size:10px;font-family:inherit;background:var(--surface)">
                        </div>
                        <button class="remove-btn" onclick="removeCountItem(${count.items.indexOf(item)})" style="padding:2px;border-radius:4px" title="حذف"><span class="material-icons-round" style="font-size:14px;color:var(--error)">close</span></button>
                    </div>
                `).join('')}
            </div>
        ` : ''}
        ${decreases.length > 0 ? `
            <div class="section-card">
                <div class="section-header"><h3 style="color:var(--error)"><span class="material-icons-round" style="font-size:16px">trending_down</span> نقص (${decreases.length})</h3></div>
                ${decreases.map((item, idx) => `
                    <div style="display:flex;align-items:center;gap:6px;padding:8px;border-bottom:1px solid var(--border-light)">
                        <div style="flex:1;min-width:0">
                            <div style="font-size:11px;font-weight:600">${item.productName}</div>
                            <div style="font-size:9px;color:var(--text-muted)">${item.systemQty} → ${item.actualQty}</div>
                        </div>
                        <div style="display:flex;align-items:center;gap:4px">
                            <span style="font-size:11px;color:var(--error);font-weight:700">${item.adjustedDiff}</span>
                            <input type="number" min="${item.adjustedDiff}" max="0" value="${item.adjustedDiff}" onchange="updateAdjustedDiff('dec', ${count.items.indexOf(item)}, this.value)" style="width:45px;padding:3px;border:1px solid var(--border);border-radius:4px;text-align:center;font-size:10px;font-family:inherit;background:var(--surface)">
                        </div>
                        <button class="remove-btn" onclick="removeCountItem(${count.items.indexOf(item)})" style="padding:2px;border-radius:4px" title="حذف"><span class="material-icons-round" style="font-size:14px;color:var(--error)">close</span></button>
                    </div>
                `).join('')}
            </div>
        ` : ''}
        ${noChange.length > 0 ? `
            <div class="section-card">
                <div class="section-header"><h3><span class="material-icons-round" style="font-size:16px">remove</span> بدون تغيير (${noChange.length})</h3></div>
                ${noChange.map(item => `
                    <div style="display:flex;align-items:center;gap:6px;padding:6px 8px;border-bottom:1px solid var(--border-light)">
                        <div style="flex:1;min-width:0"><div style="font-size:11px;font-weight:500">${item.productName}</div></div>
                        <span style="font-size:11px;color:var(--text-muted)">${item.systemQty}</span>
                    </div>
                `).join('')}
            </div>
        ` : ''}
    `;
}

function updateAdjustedDiff(type, idx, val) {
    const counts = DB.get('inventoryCounts') || [];
    const count = counts.find(c => c.id === currentCountId);
    if (!count) return;
    const num = parseInt(val) || 0;
    if (type === 'inc') {
        count.items[idx].adjustedDiff = Math.min(num, count.items[idx].difference);
    } else {
        count.items[idx].adjustedDiff = Math.max(num, count.items[idx].difference);
    }
    DB.set('inventoryCounts', counts);
}

function postInventoryCount() {
    const counts = DB.get('inventoryCounts') || [];
    const count = counts.find(c => c.id === currentCountId);
    if (!count) return;

    const products = DB.get('products');
    const movements = DB.get('movements') || [];
    let hasChanges = false;

    count.items.forEach(item => {
        const computed = (item.actualQty || 0) - (item.systemQty || 0);
        const diff = item.adjustedDiff !== 0 ? item.adjustedDiff : computed;
        item.difference = computed;
        item.adjustedDiff = diff;
        if (diff === 0) return;
        hasChanges = true;
        const pIdx = products.findIndex(p => p.id === item.productId);
        if (pIdx < 0) return;
        const p = products[pIdx];
        const oldQty = p.quantity;
        p.quantity += item.adjustedDiff;
        if (p.quantity < 0) p.quantity = 0;
        products[pIdx] = {...p};
        movements.push({
            id: uid(), productId: p.id, productName: p.name,
            type: 'adjustment',
            quantity: item.adjustedDiff,
            fromQty: oldQty,
            toQty: p.quantity,
            date: new Date().toISOString(),
            note: count.countNumber + (item.adjustedDiff > 0 ? ' (زيادة)' : ' (نقص)')
        });
    });

    if (hasChanges) {
        DB.set('products', products);
        DB.set('movements', movements);
    }

    count.status = 'posted';
    count.postedAt = new Date().toISOString();
    DB.set('inventoryCounts', counts);
    currentCountId = null;
    countMode = 'list';
    toast('تم ترحيل الفوارق بنجاح');
    renderInventoryCounts(document.getElementById('contentArea'));
}

function transferCountToPurchase() {
    const counts = DB.get('inventoryCounts') || [];
    const count = counts.find(c => c.id === currentCountId);
    if (!count) return;
    const products = DB.get('products');
    let added = 0;
    (count.items || []).forEach(item => {
        const shortage = (item.systemQty || 0) - (item.actualQty || 0);
        if (shortage <= 0) return;
        const p = products.find(x => x.id === item.productId);
        if (!p) return;
        const existing = purCart.find(c => c.productId === p.id);
        if (existing) existing.quantity += shortage;
        else purCart.push({ id: 'pci' + Date.now() + Math.random(), productId: p.id, productName: p.name, unitPrice: p.buyingPrice || p.cost || 0, quantity: shortage, discount: 0, taxRate: getTaxRate() });
        added++;
    });
    if (added === 0) { toast('لا توجد عجزات تحتاج شراء', 'error'); return; }
    toast('تم نقل ' + added + ' صنف لسلة الشراء');
    showScreen('purchases');
}

function viewCount(id) {
    const counts = DB.get('inventoryCounts') || [];
    const count = counts.find(c => c.id === id);
    if (!count) return;
    currentCountId = id;
    if (count.status === 'posted') {
        countMode = 'summary';
    } else {
        countMode = 'new';
    }
    renderInventoryCounts(document.getElementById('contentArea'));
}

function deleteCount(id) {
    const counts = DB.get('inventoryCounts') || [];
    const count = counts.find(c => c.id === id);
    if (!count) return;

    if (count.status === 'posted') {
        confirmModal('سيتم عكس تأثير جميع فوارق هذا الجرد على المخزون. متابعة؟', function() {
            const products = DB.get('products');
            const movements = DB.get('movements') || [];
            count.items.forEach(item => {
                if (item.adjustedDiff === 0) return;
                const pIdx = products.findIndex(p => p.id === item.productId);
                if (pIdx < 0) return;
                const p = products[pIdx];
                const oldQty = p.quantity;
                p.quantity -= item.adjustedDiff;
                if (p.quantity < 0) p.quantity = 0;
                products[pIdx] = {...p};
                movements.push({
                    id: uid(), productId: p.id, productName: p.name,
                    type: 'adjustment',
                    quantity: -item.adjustedDiff,
                    fromQty: oldQty,
                    toQty: p.quantity,
                    date: new Date().toISOString(),
                    note: count.countNumber + ' (حذف جرد كامل)'
                });
            });
            DB.set('products', products);
            DB.set('movements', movements);
            const idx = counts.findIndex(c => c.id === id);
            counts.splice(idx, 1);
            DB.set('inventoryCounts', counts);
            toast('تم حذف الجرد وعكس الفوارق');
            renderInventoryCounts(document.getElementById('contentArea'));
        });
    } else {
        confirmModal('هل تريد حذف هذا الجرد؟', function() {
            const idx = counts.findIndex(c => c.id === id);
            counts.splice(idx, 1);
            DB.set('inventoryCounts', counts);
            toast('تم الحذف');
            renderInventoryCounts(document.getElementById('contentArea'));
        });
    }
}

// ==================== REPORTS ====================
function renderReports(area) {
    const products = DB.get('products');
    const invoices = DB.get('invoices');
    const customers = DB.get('customers');
    const suppliers = DB.get('suppliers');
    const expenses = DB.get('expenses');
    const sales = invoices.filter(i=>i.type==='sale');
    const purchases = invoices.filter(i=>i.type==='purchase');
    const today = new Date();
    const monthStart = new Date(today.getFullYear(),today.getMonth(),1);
    const mSales = sales.filter(i=>new Date(i.createdAt)>=monthStart);
    const mPurchases = purchases.filter(i=>new Date(i.createdAt)>=monthStart);
    const mExpenses = expenses.filter(e=>new Date(e.date)>=monthStart);
    const totalSales = mSales.reduce((s,i)=>s + (i.isReturn ? -Math.abs(i.total) : i.total),0);
    const totalPurchases = mPurchases.reduce((s,i)=>s + (i.isReturn ? -Math.abs(i.total) : i.total),0);
    const totalExpenses = mExpenses.reduce((s,e)=>s+e.amount,0);

    area.innerHTML = `
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:10px">
            <button class="btn btn-sm btn-outline" onclick="showScreen('dashboard')"><span class="material-icons-round" style="font-size:16px">arrow_forward</span></button>
            <h2 style="font-size:16px;font-weight:800">التقارير</h2>
        </div>
        <div class="stats-grid">
            <div class="stat-card"><div class="icon" style="background:rgba(37,99,235,0.1)"><span class="material-icons-round" style="color:var(--primary)">trending_up</span></div><div class="label">مبيعات الشهر</div><div class="value">${fmt(totalSales)}</div></div>
            <div class="stat-card"><div class="icon" style="background:rgba(139,92,246,0.1)"><span class="material-icons-round" style="color:#8B5CF6">shopping_cart</span></div><div class="label">مشتريات الشهر</div><div class="value">${fmt(totalPurchases)}</div></div>
            <div class="stat-card"><div class="icon" style="background:rgba(239,68,68,0.1)"><span class="material-icons-round" style="color:var(--error)">receipt_long</span></div><div class="label">مصروفات الشهر</div><div class="value">${fmt(totalExpenses)}</div></div>
            <div class="stat-card"><div class="icon" style="background:rgba(16,185,129,0.1)"><span class="material-icons-round" style="color:var(--success)">account_balance_wallet</span></div><div class="label">صافي الربح</div><div class="value" style="color:${(totalSales-totalPurchases-totalExpenses)>=0?'var(--success)':'var(--error)'}">${fmt(totalSales-totalPurchases-totalExpenses)}</div></div>
        </div>
        <div class="section-card"><div class="section-header"><h3>أكثر المنتجات مبيعاً</h3></div>
        ${(() => { const prodSales = {}; sales.forEach(inv => inv.items.forEach(item => { prodSales[item.productId] = (prodSales[item.productId]||{name:item.productName,qty:0,total:0}); prodSales[item.productId].qty += item.quantity; prodSales[item.productId].total += itemNet(item); })); return Object.values(prodSales).sort((a,b)=>b.total-a.total).slice(0,5).map(p=>`<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border);font-size:13px"><span>${p.name} (${p.qty} وحدة)</span><strong style="color:var(--primary)">${fmt(p.total)}</strong></div>`).join('')||'<div style="padding:16px;color:var(--text-secondary);text-align:center">لا توجد بيانات</div>'; })()}
        </div>
        <div class="section-card" style="margin-top:12px"><div class="section-header"><h3>تقارير الأرباح التفصيلية</h3></div>
            <button class="btn btn-sm btn-primary" style="width:100%" onclick="window._profitTab='item';showScreen('profitReport')"><span class="material-icons-round" style="font-size:16px">insights</span> تقرير الأرباح حسب الصنف / العميل / المورد</button>
        </div>`;
}

// ==================== PROFIT REPORT (by item/customer/supplier) ====================
function renderProfitReport(area) {
    const tab = window._profitTab || 'item';
    const products = DB.get('products');
    const invoices = DB.get('invoices');
    const sales = invoices.filter(i=>i.type==='sale' && !i.isReturn);
    const purchases = invoices.filter(i=>i.type==='purchase' && !i.isReturn);
    const costOf = (it) => itemCost(it);

    let rows = [];
    if (tab === 'item') {
        const map = {};
        sales.forEach(inv => inv.items.forEach(it => {
            if (!map[it.productId]) map[it.productId] = { label:it.productName, sub:'', revenue:0, cost:0, qty:0 };
            map[it.productId].revenue += itemNet(it);
            map[it.productId].cost += it.quantity * costOf(it);
            map[it.productId].qty += it.quantity;
        }));
        rows = Object.values(map).map(r => ({ ...r, sub:'', profit: r.revenue - r.cost }));
    } else if (tab === 'customer') {
        const map = {};
        sales.forEach(inv => {
            const id = inv.customerId || 'walkin';
            if (!map[id]) map[id] = { label:inv.customerName||'عميل نقدي', sub:'', revenue:0, cost:0, count:0 };
            map[id].revenue += inv.total;
            map[id].count += 1;
            inv.items.forEach(it => map[id].cost += it.quantity * costOf(it));
        });
        rows = Object.values(map).map(r => ({ ...r, sub:'', profit: r.revenue - r.cost }));
    } else {
        const map = {};
        purchases.forEach(inv => {
            const id = inv.customerId || 'none';
            if (!map[id]) map[id] = { label:inv.customerName||'—', sub:'', cost:0, count:0, qty:0 };
            map[id].cost += inv.total;
            map[id].count += 1;
            inv.items.forEach(it => map[id].qty += it.quantity);
        });
        rows = Object.values(map).map(r => {
            let soldRev = 0, soldCost = 0;
            sales.forEach(inv => inv.items.forEach(it => { if ((products.find(x=>x.id===it.productId)||{}).supplierId === r.id) { soldRev += itemNet(it); soldCost += it.quantity * costOf(it); } }));
            return { ...r, sub:'', revenue:soldRev, profit: soldRev - soldCost };
        });
    }
    if (!window._profitSort) window._profitSort = { key:'profit', dir:'desc' };
    _sortState['profitTable'] = window._profitSort;

    const totalRev = rows.reduce((s,r)=>s+(r.revenue||0),0);
    const totalCost = rows.reduce((s,r)=>s+(r.cost||0),0);
    const totalProfit = totalRev - totalCost;
    const profitPct = totalRev>0 ? (totalProfit/totalRev*100) : 0;

    const tabs = [['item','حسب الصنف'],['customer','حسب العميل'],['supplier','حسب المورد']];
    const isSup = tab==='supplier';
    const hasCount = tab==='customer';
    const hasQty = tab!=='customer';
    const colLabel = tab==='item'?'الصنف':tab==='customer'?'العميل':'المورد';
    const colCount = 3 + (hasCount?1:0) + (hasQty?1:0);

    const tableRows = rows.map(r => {
        const pct = (r.revenue||0)>0 ? (r.profit/(r.revenue)*100) : 0;
        return `<tr>
            <td data-sort="${r.label}"><strong>${r.label}</strong><br><small style="color:var(--text-secondary)">${r.sub}</small></td>
            ${hasCount?`<td style="text-align:left" data-sort="${r.count||0}">${r.count||0}</td>`:''}
            ${hasQty?`<td style="text-align:left" data-sort="${r.qty||0}">${fmt(r.qty||0)}</td>`:''}
            <td style="text-align:left;font-weight:700" data-sort="${r.revenue||0}">${fmt(r.revenue||0)}</td>
            <td style="text-align:left;color:var(--error)" data-sort="${r.cost||0}">${fmt(r.cost||0)}</td>
            <td style="text-align:left;font-weight:800;color:${r.profit>=0?'var(--success)':'var(--error)'}" data-sort="${r.profit||0}">${fmt(r.profit||0)}</td>
            <td style="text-align:left;color:${r.profit>=0?'var(--success)':'var(--error)'}" data-sort="${pct}">${(r.revenue||0)>0?pct.toFixed(1)+'%':'—'}</td>
        </tr>`;
    }).join('');

    area.innerHTML = `
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:10px">
            <button class="btn btn-sm btn-outline" onclick="showScreen('reports')"><span class="material-icons-round" style="font-size:16px">arrow_forward</span></button>
            <h2 style="font-size:16px;font-weight:800">تقرير الأرباح التفصيلي</h2>
        </div>
        <div style="display:flex;gap:6px;margin-bottom:12px;overflow-x:auto;padding-bottom:4px">
            ${tabs.map(t=>`<button class="btn btn-sm ${tab===t[0]?'btn-primary':'btn-outline'}" onclick="window._profitTab='${t[0]}';window._profitSort=null;renderProfitReport(document.getElementById('contentArea'))">${t[1]}</button>`).join('')}
        </div>
        <div class="stats-grid" style="grid-template-columns:repeat(3,1fr);margin-bottom:12px">
            <div class="stat-card"><div class="label">${isSup?'المشتريات':'المبيعات'}</div><div class="value">${fmt(totalRev||totalCost)}</div></div>
            <div class="stat-card"><div class="label">إجمالي التكلفة</div><div class="value" style="color:var(--error)">${fmt(totalCost)}</div></div>
            <div class="stat-card"><div class="label">صافي الربح</div><div class="value" style="color:${totalProfit>=0?'var(--success)':'var(--error)'}">${fmt(totalProfit)} (${profitPct.toFixed(1)}%)</div></div>
        </div>
        <div class="section-card">
            <div class="section-header"><h3>${tab==='item'?'الأرباح حسب الصنف':tab==='customer'?'الأرباح حسب العميل':'الأرباح والمشتريات حسب المورد'}</h3>
                <div style="display:flex;gap:4px">
                    <button class="btn btn-sm btn-outline" onclick="exportProfitReportCSV()"><span class="material-icons-round" style="font-size:14px">file_download</span> CSV</button>
                    <button class="btn btn-sm btn-outline" onclick="printProfitReport()"><span class="material-icons-round" style="font-size:14px">print</span> طباعة</button>
                </div>
            </div>
            <div class="table-container"><table id="profitTable"><thead><tr>
                <th data-sortkey="label" data-sorttype="str" style="cursor:pointer">${colLabel}</th>
                ${hasCount?`<th data-sortkey="count" data-sorttype="num" style="text-align:left;cursor:pointer">الفواتير</th>`:''}
                ${hasQty?`<th data-sortkey="qty" data-sorttype="num" style="text-align:left;cursor:pointer">الكمية</th>`:''}
                <th data-sortkey="revenue" data-sorttype="num" style="text-align:left;cursor:pointer">${isSup?'المباع (تقديري)':'المبيعات'}</th>
                <th data-sortkey="cost" data-sorttype="num" style="text-align:left;cursor:pointer">التكلفة</th>
                <th data-sortkey="profit" data-sorttype="num" style="text-align:left;cursor:pointer">الربح</th>
                <th data-sortkey="pct" data-sorttype="num" style="text-align:left;cursor:pointer">نسبة الربح</th>
            </tr></thead><tbody>
            ${rows.length===0?`<tr><td colspan="${colCount}" style="text-align:center;padding:30px;color:var(--text-secondary)">لا توجد بيانات</td></tr>`:tableRows}
            </tbody></table></div>
        </div>`;
    enableTableSort('profitTable');
}

function exportProfitReportCSV() {
    const tab = window._profitTab || 'item';
    const products = DB.get('products');
    const invoices = DB.get('invoices');
    const sales = invoices.filter(i=>i.type==='sale' && !i.isReturn);
    const purchases = invoices.filter(i=>i.type==='purchase' && !i.isReturn);
    const costOf = (it) => itemCost(it);
    let rows = [];
    if (tab==='item') {
        const map = {};
        sales.forEach(inv => inv.items.forEach(it => { if(!map[it.productId]) map[it.productId]={l:it.productName,r:0,c:0,q:0}; map[it.productId].r+=itemNet(it); map[it.productId].c+=it.quantity*costOf(it); map[it.productId].q+=it.quantity; }));
        rows = Object.values(map).map(r=>({l:r.l,sub:r.q+' وحدة',rev:r.r,cost:r.c,profit:r.r-r.c}));
    } else if (tab==='customer') {
        const map = {};
        sales.forEach(inv => { const id=inv.customerId||'walkin'; if(!map[id]) map[id]={l:inv.customerName||'عميل نقدي',r:0,c:0,n:0}; map[id].r+=inv.total; map[id].n++; inv.items.forEach(it=>map[id].c+=it.quantity*costOf(it)); });
        rows = Object.values(map).map(r=>({l:r.l,sub:r.n+' فاتورة',rev:r.r,cost:r.c,profit:r.r-r.c}));
    } else {
        const map = {};
        purchases.forEach(inv => { const id=inv.customerId||'none'; if(!map[id]) map[id]={l:inv.customerName||'—',cost:0,n:0,q:0}; map[id].cost+=inv.total; map[id].n++; inv.items.forEach(it=>map[id].q+=it.quantity); });
        rows = Object.values(map).map(r=>{ let sr=0,sc=0; sales.forEach(inv=>inv.items.forEach(it=>{ if((products.find(x=>x.id===it.productId)||{}).supplierId===r.id){sr+=itemNet(it);sc+=it.quantity*costOf(it);} })); return {l:r.l,sub:r.n+' فاتورة | '+r.q+' وحدة',rev:sr,cost:r.c,profit:sr-sc}; });
    }
    let csv = 'الكيان;التفاصيل;المبيعات;التكلفة;الربح;نسبة الربح\r\n';
    rows.forEach(r => { const pct=(r.rev||0)>0?(r.profit/r.rev*100):0; csv += `${r.l};${r.sub};${r.rev||0};${r.cost||0};${r.profit||0};${(r.rev||0)>0?pct.toFixed(1)+'%':'—'}\r\n`; });
    downloadCSV(csv, `تقرير_الأرباح_${tab}.csv`);
}

function printProfitReport() {
    const tab = window._profitTab || 'item';
    const st = DB.getOne('settings') || {};
    const products = DB.get('products');
    const invoices = DB.get('invoices');
    const sales = invoices.filter(i=>i.type==='sale' && !i.isReturn);
    const purchases = invoices.filter(i=>i.type==='purchase' && !i.isReturn);
    const costOf = (it) => itemCost(it);
    let rows = [];
    if (tab==='item') { const map={}; sales.forEach(inv=>inv.items.forEach(it=>{ if(!map[it.productId]) map[it.productId]={l:it.productName,r:0,c:0,q:0}; map[it.productId].r+=itemNet(it); map[it.productId].c+=it.quantity*costOf(it); map[it.productId].q+=it.quantity; })); rows=Object.values(map).map(r=>({...r,profit:r.r-r.c})); }
    else if (tab==='customer') { const map={}; sales.forEach(inv=>{ const id=inv.customerId||'walkin'; if(!map[id]) map[id]={l:inv.customerName||'عميل نقدي',r:0,c:0,n:0}; map[id].r+=inv.total; map[id].n++; inv.items.forEach(it=>map[id].c+=it.quantity*costOf(it)); }); rows=Object.values(map).map(r=>({...r,sub:r.n+' فاتورة',profit:r.r-r.c})); }
    else { const map={}; purchases.forEach(inv=>{ const id=inv.customerId||'none'; if(!map[id]) map[id]={l:inv.customerName||'—',cost:0,n:0,q:0}; map[id].cost+=inv.total; map[id].n++; inv.items.forEach(it=>map[id].q+=it.quantity); }); rows=Object.values(map).map(r=>{ let sr=0,sc=0; sales.forEach(inv=>inv.items.forEach(it=>{ if((products.find(x=>x.id===it.productId)||{}).supplierId===r.id){sr+=itemNet(it);sc+=it.quantity*costOf(it);} })); return {...r,sub:r.n+' فاتورة | '+r.q+' وحدة',rev:sr,profit:sr-sc}; }); }
    rows.sort((a,b)=>b.profit-a.profit);
    const totalRev=rows.reduce((s,r)=>s+(r.rev||0),0), totalCost=rows.reduce((s,r)=>s+(r.cost||0),0), totalProfit=totalRev-totalCost;
    const title = tab==='item'?'تقرير الأرباح حسب الصنف':tab==='customer'?'تقرير الأرباح حسب العميل':'تقرير الأرباح والمشتريات حسب المورد';
    const body = rows.map(r=>`<tr style="font-size:11px;border-bottom:1px solid #eee"><td style="padding:4px">${r.l}</td><td style="padding:4px;text-align:left;font-weight:600">${fmt(r.rev||0)}</td><td style="padding:4px;text-align:left;color:red">${fmt(r.cost||0)}</td><td style="padding:4px;text-align:left;font-weight:700;color:${r.profit>=0?'green':'red'}">${fmt(r.profit||0)}</td></tr>`).join('');
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title><style>@page{size:A4;margin:15mm}body{font-family:'Cairo',Arial,sans-serif;font-size:11px;color:#1a1a1a;margin:0;padding:15mm}table{width:100%;border-collapse:collapse}th{background:#f0f0f0;padding:6px;text-align:right;font-size:10px;border-bottom:2px solid #000}td{padding:4px;text-align:right}.sum{display:flex;justify-content:space-around;margin-top:12px;padding:10px;background:#f9f9f9;border-radius:8px}.sum div{text-align:center}.sum .v{font-size:16px;font-weight:800}</style></head><body>
        <h2 style="text-align:center;margin:0 0 4px">${st.storeName||st.companyName||''}</h2>
        <h3 style="text-align:center;margin:0 0 10px;color:#555">${title}</h3>
        <div class="sum"><div><div style="font-size:10px;color:#666">${tab==='supplier'?'المشتريات':'المبيعات'}</div><div class="v">${fmt(totalRev||totalCost)}</div></div><div><div style="font-size:10px;color:#666">التكلفة</div><div class="v" style="color:red">${fmt(totalCost)}</div></div><div><div style="font-size:10px;color:#666">صافي الربح</div><div class="v" style="color:${totalProfit>=0?'green':'red'}">${fmt(totalProfit)}</div></div></div>
        <table style="margin-top:12px"><thead><tr><th>الكيان</th><th style="text-align:left">${tab==='supplier'?'المباع تقديري':'المبيعات'}</th><th style="text-align:left">التكلفة</th><th style="text-align:left">الربح</th></tr></thead><tbody>${body}</tbody></table>
        <script>window.onload=function(){window.print();setTimeout(()=>window.close(),500)}<\/script></body></html>`;
    const w = window.open('','_blank'); w.document.write(html); w.document.close();
}

// ==================== MOVEMENTS ====================
function renderMovements(area) {
    const movements = (DB.get('movements') || []).sort((a,b) => a.productName.localeCompare(b.productName, 'ar'));
    area.innerHTML = `
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:10px">
            <button class="btn btn-sm btn-outline" onclick="showScreen('dashboard')"><span class="material-icons-round" style="font-size:16px">arrow_forward</span></button>
            <h2 style="font-size:16px;font-weight:800">حركة الأصناف</h2>
        </div>
        <div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap">
            <div style="flex:1;min-width:150px"><input class="form-control" placeholder="بحث بالمنتج..." id="movSearch" oninput="filterMovements()" style="font-size:13px;padding:8px 12px"></div>
            <div style="min-width:120px"><select class="form-control" id="movTypeFilter" onchange="filterMovements()" style="font-size:12px;padding:6px 10px"><option value="sale">بيع</option><option value="purchase">شراء</option><option value="transfer">تحويل</option><option value="adjustment">جرد</option></select></div>
        </div>
        <div class="section-card"><div class="table-container"><table id="movementsTable"><thead><tr><th data-sortkey="date" data-sorttype="date" style="cursor:pointer">التاريخ</th><th data-sortkey="name" data-sorttype="str" style="cursor:pointer">المنتج</th><th data-sortkey="type" data-sorttype="str" style="cursor:pointer">النوع</th><th data-sortkey="qty" data-sorttype="num" style="text-align:left;cursor:pointer">الكمية</th><th data-sortkey="inv" data-sorttype="str" style="cursor:pointer">رقم الفاتورة</th></tr></thead><tbody id="movementsBody">
        ${movements.length===0?'<tr><td colspan="5" style="text-align:center;padding:30px;color:var(--text-secondary)">لا توجد حركات بعد</td></tr>':
        movements.map(m=>`<tr data-name="${m.productName}" data-type="${m.type}"><td data-sort="${m.date}">${fmtDateTime(m.date)}</td><td data-sort="${m.productName}"><strong>${m.productName}</strong></td><td data-sort="${m.type}"><span class="badge ${m.type==='sale'?'badge-danger':m.type==='purchase'?'badge-success':m.type==='adjustment'?'badge-warning':'badge-info'}">${m.type==='sale'?'بيع':m.type==='purchase'?'شراء':m.type==='adjustment'?'جرد':'تحويل'}</span></td><td style="font-weight:700;color:${m.quantity>0?'var(--success)':'var(--error)'}" data-sort="${m.quantity}">${m.quantity>0?'+':''}${m.quantity}</td><td data-sort="${m.invoiceNumber||m.note||'-'}">${m.invoiceNumber||m.note||'-'}</td></tr>`).join('')}
        </tbody></table></div></div>`;
    enableTableSort('movementsTable');
}

function filterMovements() {
    const q = (document.getElementById('movSearch')?.value || '').toLowerCase();
    const type = document.getElementById('movTypeFilter')?.value || '';
    document.querySelectorAll('#movementsBody tr').forEach(tr => {
        const name = tr.dataset.name?.toLowerCase() || '';
        const matchType = tr.dataset.type === type;
        const matchSearch = !q || name.includes(q);
        tr.style.display = matchType && matchSearch ? '' : 'none';
    });
}

// ==================== RETURNS ====================
function renderReturns(area) {
    const invoices = DB.get('invoices');
    const saleReturns = invoices.filter(i => i.type === 'sale' && i.isReturn);
    const purReturns = invoices.filter(i => i.type === 'purchase' && i.isReturn);
    const totalSaleRet = saleReturns.reduce((s,i) => s + i.total, 0);
    const totalPurRet = purReturns.reduce((s,i) => s + i.total, 0);
    const allReturns = [...saleReturns, ...purReturns].sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));
    area.innerHTML = `
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:10px">
            <button class="btn btn-sm btn-outline" onclick="showScreen('dashboard')"><span class="material-icons-round" style="font-size:16px">arrow_forward</span></button>
            <h2 style="font-size:16px;font-weight:800"><span class="material-icons-round" style="vertical-align:middle;color:var(--accent);font-size:18px">undo</span> المرتجعات</h2>
        </div>
        <div class="stats-grid" style="grid-template-columns:1fr 1fr;margin-bottom:12px">
            <div class="stat-card"><div class="label">مرتجعات البيع</div><div class="value" style="color:var(--error)">${fmt(totalSaleRet)}</div><div class="subtitle">${saleReturns.length} مرتجع</div></div>
            <div class="stat-card"><div class="label">مرتجعات الشراء</div><div class="value" style="color:var(--success)">${fmt(totalPurRet)}</div><div class="subtitle">${purReturns.length} مرتجع</div></div>
        </div>
        ${allReturns.length===0?'<div style="text-align:center;padding:40px;color:var(--text-secondary)"><span class="material-icons-round" style="font-size:48px">inbox</span><p style="margin-top:8px">لا توجد مرتجعات</p></div>':
        `<div class="section-card"><div class="table-container"><table id="returnsTable"><thead><tr><th data-sortkey="num" data-sorttype="num" style="cursor:pointer">رقم</th><th data-sortkey="type" data-sorttype="str" style="cursor:pointer">النوع</th><th data-sortkey="party" data-sorttype="str" style="cursor:pointer">${saleReturns.length>0?'العميل':'المورد'}</th><th data-sortkey="total" data-sorttype="num" style="text-align:left;cursor:pointer">الإجمالي</th><th data-sortkey="date" data-sorttype="date" style="cursor:pointer">التاريخ</th></tr></thead><tbody>
        ${allReturns.slice(0,50).map(i => `<tr style="cursor:pointer" onclick="editInvoice('${i.id}')"><td data-sort="${i.invoiceNumber}"><strong>${i.invoiceNumber}</strong></td><td data-sort="${i.type}"><span class="badge ${i.type==='sale'?'badge-danger':'badge-success'}">${i.type==='sale'?'بيع':'شراء'}</span></td><td data-sort="${i.customerName||'-'}">${i.customerName||'-'}</td><td style="font-weight:700;color:var(--error)" data-sort="${-Math.abs(i.total)}">${fmt(-Math.abs(i.total))}</td><td data-sort="${i.createdAt}">${fmtDate(i.createdAt)}</td></tr>`).join('')}
         </tbody></table></div>`}`;
    enableTableSort('returnsTable');
}

function renderInvoices(area) {
    window._invCache = window._invCache || {};
    const invoices = DB.get('invoices').filter(i => i.type === 'sale').sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    invoices.forEach(i => { window._invCache[i.id] = i; });
    area.innerHTML = `
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:10px">
            <button class="btn btn-sm btn-outline" onclick="showScreen('dashboard')"><span class="material-icons-round" style="font-size:16px">arrow_forward</span></button>
            <h2 style="font-size:16px;font-weight:800"><span class="material-icons-round" style="vertical-align:middle;color:var(--primary);font-size:18px">receipt_long</span> المبيعات</h2>
        </div>
        <div style="margin-bottom:10px"><input class="form-control" id="invSearch" placeholder="بحث برقم الفاتورة أو العميل..." oninput="filterInvoices()"></div>
        <div class="section-card"><div class="table-container"><table id="invoicesTable"><thead><tr>
            <th data-sortkey="num" data-sorttype="num" style="cursor:pointer">رقم</th>
            <th data-sortkey="party" data-sorttype="str" style="cursor:pointer">العميل</th>
            <th data-sortkey="total" data-sorttype="num" style="text-align:left;cursor:pointer">الإجمالي</th>
            <th data-sortkey="paid" data-sorttype="num" style="text-align:left;cursor:pointer">المدفوع</th>
            <th data-sortkey="rem" data-sorttype="num" style="text-align:left;cursor:pointer">المتبقي</th>
            <th data-sortkey="status" data-sorttype="str" style="cursor:pointer">الحالة</th>
            <th data-sortkey="date" data-sorttype="date" style="cursor:pointer">التاريخ</th>
            <th>إجراءات</th>
        </tr></thead><tbody id="invoicesBody">
        ${invoices.map(i => `<tr data-search="${(i.invoiceNumber || '') + ' ' + (i.customerName || '')}">
            <td data-sort="${i.invoiceNumber}"><strong>${i.invoiceNumber}</strong>${i.isReturn ? ' <span class="badge badge-danger" style="font-size:9px">مرتجع</span>' : ''}</td>
            <td data-sort="${i.customerName || 'نقدي'}">${i.customerName || 'نقدي'}</td>
            <td style="font-weight:700" data-sort="${i.total}">${fmt(i.total)}</td>
            <td data-sort="${i.paidAmount || 0}">${fmt(i.paidAmount || 0)}</td>
            <td data-sort="${i.remainingAmount || 0}" style="color:${i.remainingAmount > 0 ? 'var(--error)' : 'inherit'}">${fmt(i.remainingAmount || 0)}</td>
            <td data-sort="${i.status}"><span class="badge ${i.status === 'paid' ? 'badge-success' : (i.status === 'pending' ? 'badge-danger' : 'badge-warning')}">${i.status === 'paid' ? 'مدفوع' : (i.status === 'pending' ? 'آجل' : 'جزئي')}</span></td>
            <td data-sort="${i.createdAt}">${fmtDate(i.createdAt)}</td>
            <td style="white-space:nowrap">
                <button class="btn btn-xs btn-outline" onclick="viewInvoice('${i.id}')"><span class="material-icons-round" style="font-size:14px">visibility</span></button>
                <button class="btn btn-xs btn-primary" onclick="printReceipt(window._invCache['${i.id}'])"><span class="material-icons-round" style="font-size:14px">print</span></button>
                <button class="btn btn-xs btn-success" onclick="shareInvoiceWhatsapp('${i.id}')"><span class="material-icons-round" style="font-size:14px">share</span></button>
                <button class="btn btn-xs btn-outline" onclick="processReturn('${i.id}')"><span class="material-icons-round" style="font-size:14px">undo</span></button>
                <button class="btn btn-xs btn-danger" onclick="confirmModal('حذف الفاتورة؟', ()=>deleteInvoice('${i.id}'))"><span class="material-icons-round" style="font-size:14px">delete</span></button>
            </td>
        </tr>`).join('')}
        </tbody></table></div>`;
    enableTableSort('invoicesTable');
}

function filterInvoices() {
    const q = (document.getElementById('invSearch') ? document.getElementById('invSearch').value : '').trim().toLowerCase();
    document.querySelectorAll('#invoicesBody tr').forEach(tr => {
        const s = (tr.dataset.search || '').toLowerCase();
        tr.style.display = (!q || s.indexOf(q) !== -1) ? '' : 'none';
    });
}

function filterInvoiceList(prefix) {
    const q = (document.getElementById(prefix + 'Search') ? document.getElementById(prefix + 'Search').value : '').trim().toLowerCase();
    const st = (document.getElementById(prefix + 'Status') ? document.getElementById(prefix + 'Status').value : 'all');
    let sum = 0;
    document.querySelectorAll('#' + prefix + 'TableBody tr').forEach(tr => {
        const s = (tr.dataset.search || '').toLowerCase();
        const status = tr.dataset.status || '';
        const okQ = !q || s.indexOf(q) !== -1;
        const okS = st === 'all' || status === st;
        tr.style.display = (okQ && okS) ? '' : 'none';
        if (okQ && okS) sum += parseFloat(tr.dataset.total || 0);
    });
    const el = document.getElementById(prefix + 'FilteredTotal');
    if (el) el.textContent = fmt(sum);
}

function viewInvoice(id) {
    const inv = DB.get('invoices').find(i => i.id === id);
    if (!inv) return;
    const items = (inv.items || []).map(it => `<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border);font-size:13px"><span>${it.productName} × ${it.quantity}</span><span>${fmt((it.unitPrice * it.quantity) - (it.discount || 0))}</span></div>`).join('');
    openModal('فاتورة #' + inv.invoiceNumber, `
        <div style="font-size:13px">
            <div style="color:var(--text-secondary);margin-bottom:6px">${inv.customerName || 'نقدي'} | ${fmtDateTime(inv.createdAt)}</div>
            ${items}
            <div style="display:flex;justify-content:space-between;padding:6px 0;font-size:13px"><span>المجموع الفرعي</span><strong>${fmt(inv.subtotal || inv.total)}</strong></div>
            ${inv.discount > 0 ? `<div style="display:flex;justify-content:space-between;padding:6px 0;font-size:13px"><span>الخصم</span><strong style="color:var(--error)">${fmt(inv.discount)}</strong></div>` : ''}
            ${inv.taxAmount > 0 ? `<div style="display:flex;justify-content:space-between;padding:6px 0;font-size:13px"><span>الضريبة</span><strong>${fmt(inv.taxAmount)}</strong></div>` : ''}
            <div style="display:flex;justify-content:space-between;padding:8px 0;border-top:1px solid var(--border);font-size:15px"><span>الإجمالي</span><strong>${fmt(inv.total || 0)}</strong></div>
        </div>
    `, `<button class="btn btn-primary" onclick="printReceipt(window._invCache['${inv.id}']);closeModal()"><span class="material-icons-round">print</span> طباعة</button><button class="btn btn-success" onclick="shareInvoiceWhatsapp('${inv.id}');closeModal()"><span class="material-icons-round">share</span> واتساب</button><button class="btn btn-outline" onclick="closeModal()">إغلاق</button>`);
}

function processReturn(invoiceId) {
    const invoices = DB.get('invoices');
    const inv = invoices.find(i => i.id === invoiceId);
    if (!inv) { toast('الفاتورة غير موجودة','error'); return; }
    const items = inv.items.map(item => `<div style="display:flex;align-items:center;gap:8px;padding:8px;background:var(--bg);border-radius:8px;margin-bottom:6px">
        <div style="flex:1"><strong style="font-size:13px">${item.productName}</strong><br><small style="color:var(--text-secondary)">الكمية: ${item.quantity} | السعر: ${fmt(item.unitPrice)}</small></div>
        <input type="number" class="form-control ret-qty" data-product="${item.productId}" data-price="${item.unitPrice}" data-max="${item.quantity}" value="0" min="0" max="${item.quantity}" style="width:60px;padding:4px 8px;font-size:12px;text-align:center">
    </div>`).join('');
    openModal('مرتجع الفاتورة رقم ' + inv.invoiceNumber, `
        <div style="margin-bottom:8px;font-size:12px;color:var(--text-secondary)">حدد الكمية المرتجعة لكل منتج (0 = لا مرتجع)</div>
        ${items}
        <div style="display:flex;justify-content:space-between;margin-top:8px;padding-top:8px;border-top:1px solid var(--border);font-size:14px"><span>إجمالي المرتجع:</span><strong id="returnTotal" style="color:var(--error)">0.00 ج.م</strong></div>
    `, `<button class="btn btn-primary" onclick="confirmReturn('${invoiceId}','${inv.type}')">تأكيد المرتجع</button><button class="btn btn-outline" onclick="closeModal()">إلغاء</button>`);
    setTimeout(() => {
        document.querySelectorAll('.ret-qty').forEach(inp => inp.addEventListener('input', calcReturnTotal));
    }, 100);
}

function calcReturnTotal() {
    let total = 0;
    document.querySelectorAll('.ret-qty').forEach(inp => {
        const qty = parseInt(inp.value) || 0;
        const price = parseFloat(inp.dataset.price) || 0;
        total += qty * price;
    });
    const el = document.getElementById('returnTotal');
    if (el) el.textContent = fmt(total);
}

function confirmReturn(invoiceId, invoiceType) {
    const invoices = DB.get('invoices');
    const inv = invoices.find(i => i.id === invoiceId);
    if (!inv) return;
    const returns = DB.get('returns') || [];
    const products = DB.get('products');
    const movements = DB.get('movements') || [];
    let returnTotal = 0;
    let anyReturn = false;
    document.querySelectorAll('.ret-qty').forEach(inp => {
        const qty = parseInt(inp.value) || 0;
        if (qty <= 0) return;
        const productId = inp.dataset.product;
        const price = parseFloat(inp.dataset.price) || 0;
        const p = products.find(x => x.id === productId);
        if (p) {
            if (invoiceType === 'sale') {
                p.quantity += qty;
                movements.unshift({ id:uid(), productId:p.id, productName:p.name, type:'sale_return', quantity:qty, invoiceNumber:'مرتجع '+inv.invoiceNumber, date:new Date().toISOString() });
            } else {
                p.quantity = Math.max(0, p.quantity - qty);
                movements.unshift({ id:uid(), productId:p.id, productName:p.name, type:'purchase_return', quantity:-qty, invoiceNumber:'مرتجع '+inv.invoiceNumber, date:new Date().toISOString() });
            }
            returnTotal += qty * price;
            anyReturn = true;
            returns.unshift({ id:uid(), type:invoiceType==='sale'?'sale':'purchase', productId, productName:p.name, quantity:qty, total:qty*price, invoiceNumber:inv.invoiceNumber, date:new Date().toISOString() });
        }
    });
    if (!anyReturn) { toast('حدد كمية مرتجعة أولاً','error'); return; }
    DB.set('products', products);
    DB.set('movements', movements);
    DB.set('returns', returns);
    // Update customer/supplier balance for credit
    if (inv.paymentMethod === 'آجل' && inv.customerId) {
        if (invoiceType === 'sale') {
            const customers = DB.get('customers');
            const c = customers.find(x => x.id === inv.customerId);
            if (c) { c.balance = (c.balance || 0) - returnTotal; DB.set('customers', customers); }
        } else {
            const suppliers = DB.get('suppliers');
            const s = suppliers.find(x => x.id === inv.customerId);
            if (s) { s.balance = (s.balance || 0) - returnTotal; DB.set('suppliers', suppliers); }
        }
    }
    closeModal();
    toast('تم استلام المرتجع');
    renderScreen(currentScreen);
}

// ==================== PROFIT & LOSS ====================
function renderProfitLoss(area) {
    const invoices = DB.get('invoices');
    const expenses = DB.get('expenses');
    const products = DB.get('products');
    const today = new Date();

    const periods = [
        { label:'اليوم', start:new Date(today.getFullYear(),today.getMonth(),today.getDate()) },
        { label:'هذا الأسبوع', start:new Date(today.getTime()-7*24*60*60*1000) },
        { label:'هذا الشهر', start:new Date(today.getFullYear(),today.getMonth(),1) },
        { label:'هذا العام', start:new Date(today.getFullYear(),0,1) },
    ];

    area.innerHTML = `
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:10px">
            <button class="btn btn-sm btn-outline" onclick="showScreen('dashboard')"><span class="material-icons-round" style="font-size:16px">arrow_forward</span></button>
            <h2 style="font-size:16px;font-weight:800">حساب الأرباح وخسائر</h2>
        </div>
        <div class="stats-grid">
        ${periods.map(p => {
            const sales = invoices.filter(i=>i.type==='sale'&&new Date(i.createdAt)>=p.start).reduce((s,i)=>s + (i.isReturn ? -Math.abs(i.total) : i.total),0);
            const purchases = invoices.filter(i=>i.type==='purchase'&&new Date(i.createdAt)>=p.start).reduce((s,i)=>s + (i.isReturn ? -Math.abs(i.total) : i.total),0);
            const exp = expenses.filter(e=>new Date(e.date)>=p.start).reduce((s,e)=>s+e.amount,0);
            const profit = sales - purchases - exp;
            return`<div class="stat-card"><div class="label" style="margin-bottom:8px;font-weight:700">${p.label}</div>
                <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border);font-size:13px"><span style="color:var(--text-secondary)">المبيعات</span><strong>${fmt(sales)}</strong></div>
                <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border);font-size:13px"><span style="color:var(--text-secondary)">المشتريات</span><strong style="color:var(--error)">${fmt(purchases)}</strong></div>
                <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border);font-size:13px"><span style="color:var(--text-secondary)">المصروفات</span><strong style="color:var(--error)">${fmt(exp)}</strong></div>
                <div style="display:flex;justify-content:space-between;padding:8px 0;font-size:15px;font-weight:800"><span>صافي الربح</span><strong style="color:${profit>=0?'var(--success)':'var(--error)'}">${fmt(profit)}</strong></div>
            </div>`;
        }).join('')}
        </div>`;
}

// ==================== USERS ====================
function renderUsers(area) {
    const users = DB.get('users');
    area.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;flex-wrap:wrap;gap:6px">
            <div style="display:flex;align-items:center;gap:6px">
                <button class="btn btn-sm btn-outline" onclick="showScreen('settings')"><span class="material-icons-round" style="font-size:16px">arrow_forward</span></button>
                <h2 style="font-size:16px;font-weight:800">المستخدمين والصلاحيات</h2>
            </div>
            ${currentUser?.role==='admin'?`<button class="btn btn-sm btn-primary" onclick="openUserModal()"><span class="material-icons-round">person_add</span> إضافة</button>`:''}
        </div>
        ${users.map(u=>`<div class="section-card" style="margin-bottom:8px;padding:12px">
            <div style="display:flex;align-items:center;gap:10px">
                <div class="user-avatar" style="width:40px;height:40px;font-size:14px;flex-shrink:0;${u.role==='admin'?'background:#8B5CF6':u.role==='cashier'?'background:var(--primary)':'background:var(--text-secondary)'}">${u.name.charAt(0)}</div>
                <div style="flex:1;min-width:0"><strong>${u.name}</strong><br><small style="color:var(--text-secondary)">${u.username}</small>
                    <div style="margin-top:4px"><span class="role-badge ${u.role==='admin'?'role-admin':u.role==='cashier'?'role-cashier':'role-viewer'}">${u.role==='admin'?'مدير':u.role==='cashier'?'كاشير':'مشاهد'}</span>
                    <span class="badge ${u.active?'badge-success':'badge-danger'}" style="margin-right:4px">${u.active?'نشط':'معطل'}</span></div>
                </div>
                ${currentUser?.role==='admin'?`<div style="display:flex;gap:4px;flex-shrink:0">
                    <button class="btn btn-sm btn-outline" onclick="openUserModal('${u.id}')"><span class="material-icons-round">edit</span></button>
                    ${u.username!=='admin'?`<button class="btn btn-sm btn-danger" onclick="deleteUser('${u.id}')"><span class="material-icons-round">delete</span></button>`:''}
                </div>`:''}
            </div>
        </div>`).join('')}
        <div class="section-card" style="margin-top:16px"><div class="section-header"><h3>الصلاحيات حسب الدور</h3></div>
        <div style="font-size:12px;line-height:2">
            <strong>مدير:</strong> جميع الصلاحيات (إدارة كاملة)<br>
            <strong>كاشير:</strong> نقطة البيع، عرض الأصناف، عرض العملاء والموردين<br>
            <strong>مشاهد:</strong> عرض فقط (لا يمكنه التعديل أو الحذف)
        </div></div>`;
}

function openUserModal(id) {
    const users = DB.get('users');
    const u = id ? users.find(x=>x.id===id) : null;
    openModal(u?'تعديل المستخدم':'إضافة مستخدم', `
        <div class="form-group"><label>الاسم *</label><input class="form-control" id="uName" value="${u?u.name:''}"></div>
        <div class="form-group"><label>اسم المستخدم *</label><input class="form-control" id="uUsername" value="${u?u.username:''}" ${u?'readonly':''}></div>
        <div class="form-group"><label>كلمة المرور ${u?'(اتركها فارغة للإبقاء)' :'*'}</label><input class="form-control" type="password" id="uPassword" value=""></div>
        <div class="form-group"><label>الدور</label><select class="form-control" id="uRole"><option value="admin" ${u&&u.role==='admin'?'selected':''}>مدير</option><option value="cashier" ${u&&u.role==='cashier'?'selected':''}>كاشير</option><option value="viewer" ${u&&u.role==='viewer'?'selected':''}>مشاهد</option></select></div>
        <div class="form-group"><label>الحالة</label><label class="toggle"><input type="checkbox" id="uActive" ${!u||u.active?'checked':''}><span class="slider"></span></label></div>
    `, `<button class="btn btn-primary" onclick="saveUser('${id||''}')">حفظ</button><button class="btn btn-outline" onclick="closeModal()">إلغاء</button>`);
}

function saveUser(id) {
    const name = document.getElementById('uName').value.trim();
    const username = document.getElementById('uUsername').value.trim();
    const password = document.getElementById('uPassword').value;
    if (!name||!username) { toast('أدخل الاسم واسم المستخدم','error'); return; }
    const users = DB.get('users');
    if (id) {
        const idx=users.findIndex(u=>u.id===id);
        if(idx>=0) { users[idx].name=name; users[idx].role=document.getElementById('uRole').value; users[idx].active=document.getElementById('uActive').checked; if(password) users[idx].password=password; }
    } else {
        if (!password) { toast('أدخل كلمة المرور','error'); return; }
        if (users.find(u=>u.username===username)) { toast('اسم المستخدم موجود مسبقاً','error'); return; }
        users.push({ id:uid(), username, password, name, role:document.getElementById('uRole').value, active:document.getElementById('uActive').checked });
    }
    DB.set('users',users); closeModal(); toast('تم الحفظ');
    renderUsers(document.getElementById('contentArea'));
}

function deleteUser(id) {
    confirmModal('هل أنت متأكد من حذف هذا المستخدم؟', function() {
        moveToTrash('user', id);
        DB.set('users', DB.get('users').filter(u=>u.id!==id)); toast('تم الحذف');
        renderUsers(document.getElementById('contentArea'));
    });
}

// ==================== SETTINGS ====================
function renderSettings(area) {
    const s = DB.getOne('settings') || {};
    const trashCount = (DB.getOne('trash') || []).length;
    area.innerHTML = `
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:10px">
            <button class="btn btn-sm btn-outline" onclick="showScreen('dashboard')"><span class="material-icons-round" style="font-size:16px">arrow_forward</span></button>
            <h2 style="font-size:16px;font-weight:800">الإعدادات</h2>
        </div>
        <div class="settings-section"><div class="settings-card">
            <div class="settings-item" style="cursor:pointer" onclick="showScreen('profile')">
                <div style="display:flex;align-items:center;gap:10px">
                    <span class="material-icons-round" style="color:var(--primary);font-size:22px">person</span>
                    <div class="item-label" style="font-weight:700;font-size:14px">بياناتي الشخصية</div>
                </div>
                <span class="material-icons-round" style="color:var(--text-secondary)">chevron_left</span>
            </div>
            <div class="settings-item" style="cursor:pointer" onclick="showScreen('trash')">
                <div style="display:flex;align-items:center;gap:10px">
                    <span class="material-icons-round" style="color:var(--error);font-size:22px">delete</span>
                    <div class="item-label" style="font-weight:700;font-size:14px">سلة المحذوفات ${trashCount>0?`<span class="badge badge-danger" style="margin-right:4px">${trashCount}</span>`:''}</div>
                </div>
                <span class="material-icons-round" style="color:var(--text-secondary)">chevron_left</span>
            </div>
        </div></div>
        <div class="settings-section"><h3>بيانات النشاط</h3><div class="settings-card">
            <div class="settings-item"><div><div class="item-label">اسم النشاط</div></div><input class="form-control" style="width:100%" value="${s.companyName||''}" onchange="updateSetting('companyName',this.value)"></div>
            <div class="settings-item"><div><div class="item-label">اسم المحل</div></div><input class="form-control" style="width:100%" value="${s.storeName||''}" onchange="updateSetting('storeName',this.value)"></div>
            <div class="settings-item"><div><div class="item-label">لوجو المحل</div><div class="item-sublabel">يظهر في إيصالات الطباعة</div></div>
                <div style="display:flex;align-items:center;gap:8px;width:100%">
                    ${s.storeLogo?`<div style="width:48px;height:48px;border-radius:8px;border:1px solid var(--border);overflow:hidden;flex-shrink:0"><img src="${s.storeLogo}" style="width:100%;height:100%;object-fit:cover"></div>`:`<div style="width:48px;height:48px;border-radius:8px;border:1px dashed var(--border);display:flex;align-items:center;justify-content:center;flex-shrink:0;color:var(--text-muted)"><span class="material-icons-round" style="font-size:20px">image</span></div>`}
                    <div style="flex:1"><input type="file" accept="image/*" id="storeLogoInput" style="display:none" onchange="uploadStoreLogo(this)"><button class="btn btn-sm btn-outline" onclick="document.getElementById('storeLogoInput').click()"><span class="material-icons-round" style="font-size:14px">upload</span> ${s.storeLogo?'تغيير':'رفع'} اللوجو</button>${s.storeLogo?`<button class="btn btn-sm btn-danger" style="margin-top:4px" onclick="updateSetting('storeLogo','');renderSettings(document.getElementById('contentArea'))"><span class="material-icons-round" style="font-size:14px">delete</span> حذف</button>`:''}</div>
                </div>
            </div>
            <div class="settings-item"><div><div class="item-label">هاتف المحل</div></div><input class="form-control" style="width:100%" value="${s.storePhone||''}" onchange="updateSetting('storePhone',this.value)"></div>
            <div class="settings-item"><div><div class="item-label">العنوان</div></div><input class="form-control" style="width:100%" value="${s.storeAddress||''}" onchange="updateSetting('storeAddress',this.value)"></div>
            <div class="settings-item"><div><div class="item-label">العملة</div></div><select class="form-control" style="width:100%" onchange="updateSetting('currency',this.value)"><option ${s.currency==='ج.م'?'selected':''}>ج.م</option><option ${s.currency==='ر.س'?'selected':''}>ر.س</option><option ${s.currency==='د.إ'?'selected':''}>د.إ</option><option ${s.currency==='$'?'selected':''}>$</option></select></div>
        </div></div>
        <div class="settings-section"><h3>العرض</h3><div class="settings-card">
            <div class="settings-item"><div><div class="item-label">الوضع الليلي</div></div><label class="toggle"><input type="checkbox" ${s.darkMode?'checked':''} onchange="updateSetting('darkMode',this.checked);toggleTheme()"><span class="slider"></span></label></div>
        </div></div>
        <div class="settings-section"><h3>الطابعة الحرارية (بلوتوث)</h3><div class="settings-card">
            <div class="settings-item"><div><div class="item-label">تفعيل الطباعة الحرارية</div><div class="item-sublabel">طباعة الفواتير على طابعة بلوتوث حرارية (58 أو 80مم)</div></div><label class="toggle"><input type="checkbox" ${s.bluetoothThermal?'checked':''} onchange="updateSetting('bluetoothThermal',this.checked);renderSettings(document.getElementById('contentArea'))"><span class="slider"></span></label></div>
            ${s.bluetoothThermal?`
            <div class="settings-item"><div><div class="item-label">عرض الورق</div><div class="item-sublabel">58مم (قديمة) أو 80مم (حديثة)</div></div><select class="form-input" style="max-width:130px" onchange="updateSetting('thermalWidth', parseInt(this.value));renderSettings(document.getElementById('contentArea'))"><option value="80" ${s.thermalWidth!==58?'selected':''}>80 ملم</option><option value="58" ${s.thermalWidth===58?'selected':''}>58 ملم</option></select></div>
            <div class="settings-item"><div><div class="item-label">حالة الطابعة</div></div><span class="badge ${btChar?'badge-success':'badge-danger'}">${btChar?('متصلة: '+btPrinterName):'غير متصلة'}</span></div>
            <div style="display:flex;flex-direction:column;gap:8px;padding:4px 0">
                <button class="btn btn-sm btn-primary" onclick="connectBluetoothPrinter()"><span class="material-icons-round" style="font-size:14px">bluetooth</span> اختر الطابعة</button>
                ${btChar?`<button class="btn btn-sm btn-outline" onclick="disconnectBluetoothPrinter()"><span class="material-icons-round" style="font-size:14px">link_off</span> قطع الاتصال</button>`:''}
                <button class="btn btn-sm btn-outline" onclick="testThermalPrint()"><span class="material-icons-round" style="font-size:14px">print</span> طباعة تجريبية</button>
            </div>
            <div class="settings-item"><div><div class="item-sublabel" style="font-size:11px;color:var(--text-muted);line-height:1.6">ملاحظة: يتطلب متصفح Chrome/Edge واتصال آمن (https أو localhost). يفضّل الطابعات الصينية بشعار BLE‏ 49535343. عند التفعيل تتحول "طباعة" تلقائياً للطابعة الحرارية.</div></div></div>
            `:''}
        </div></div>
        <div class="settings-section"><h3>تخصيص الإيصال</h3><div class="settings-card">
            <div class="settings-item" style="flex-direction:column;align-items:stretch;gap:6px"><div class="item-label">رسالة الترويسة (تحت اسم المحل)</div><input class="form-control" style="width:100%" value="${s.receiptHeader||''}" onchange="updateSetting('receiptHeader',this.value)" placeholder="مثال: ✦ أهلاً وسهلاً ✦"></div>
            <div class="settings-item" style="flex-direction:column;align-items:stretch;gap:6px"><div class="item-label">رسالة التذييل / الشكر</div><input class="form-control" style="width:100%" value="${s.receiptFooter||''}" onchange="updateSetting('receiptFooter',this.value)" placeholder="مثال: شكراً لتعاملكم معنا"></div>
            <div class="settings-item" style="flex-direction:column;align-items:stretch;gap:6px"><div class="item-label">الرقم الضريبي</div><input class="form-control" style="width:100%" value="${s.taxNumber||''}" onchange="updateSetting('taxNumber',this.value)" placeholder="مثال: 123456789"></div>
        </div></div>
        <div class="settings-section"><h3>النسخ الاحتياطي</h3><div class="settings-card">
            <div class="settings-item"><div><div class="item-label">تصدير البيانات</div><div class="item-sublabel">حفظ نسخة احتياطية كملف JSON</div></div><button class="btn btn-sm btn-primary" onclick="exportBackup()"><span class="material-icons-round">download</span> تصدير</button></div>
            <div class="settings-item"><div><div class="item-label">استيراد البيانات</div><div class="item-sublabel">استعادة من ملف احتياطي</div></div><div><input type="file" id="importFile" accept=".json" style="display:none" onchange="importBackup(this)"><button class="btn btn-sm btn-outline" onclick="document.getElementById('importFile').click()"><span class="material-icons-round">upload</span> استيراد</button></div></div>
            <div class="settings-item"><div><div class="item-label">مسح جميع البيانات</div><div class="item-sublabel">حذف كل شيء والبدء من جديد</div></div><button class="btn btn-sm btn-danger" onclick="confirmModal('سيتم حذف جميع البيانات نهائياً! هل أنت متأكد؟',function(){localStorage.clear();location.reload()})"><span class="material-icons-round">delete_forever</span> مسح الكل</button></div>
            <div style="height:1px;background:var(--border);margin:10px 0"></div>
            <div class="settings-item"><div><div class="item-label">نسخ احتياطي تلقائي للتلجرام</div><div class="item-sublabel">إرسال نسخة JSON للسحابة عبر بوت التلجرام</div></div><label class="toggle"><input type="checkbox" ${s.autoBackup?'checked':''} onchange="updateSetting('autoBackup',this.checked);renderSettings(document.getElementById('contentArea'))"><span class="slider"></span></label></div>
            <div class="settings-item" style="flex-direction:column;align-items:stretch;gap:6px"><div class="item-label">توكن البوت (Bot Token)</div><input class="form-control" style="width:100%" value="${s.tgToken||''}" onchange="updateSetting('tgToken',this.value)" placeholder="123456:ABCdefGhIjKlMnOp"></div>
            <div class="settings-item" style="flex-direction:column;align-items:stretch;gap:6px"><div class="item-label">معرف المحادثة (Chat ID)</div><input class="form-control" style="width:100%" value="${s.tgChatId||''}" onchange="updateSetting('tgChatId',this.value)" placeholder="987654321"></div>
            <div class="settings-item"><div><div class="item-label">إرسال النسخة الآن</div></div><button class="btn btn-sm btn-primary" onclick="telegramBackup()"><span class="material-icons-round">cloud_upload</span> إرسال للتلجرام</button></div>
        </div></div>
        <div class="settings-section"><h3>عن النظام</h3><div class="settings-card">
            <div class="settings-item"><div><div class="item-label">محاسب برو</div><div class="item-sublabel">الإصدار 2.0 - نظام ERP ونقاط البيع الشامل</div></div></div>
        </div></div>`;
}

function updateSetting(key, value) {
    const s = DB.getOne('settings')||{}; s[key]=value; DB.setOne('settings',s); toast('تم الحفظ');
    if (key === 'autoBackup') setupAutoBackup();
}
let _autoBackupTimer = null;
function setupAutoBackup() {
    if (_autoBackupTimer) { clearInterval(_autoBackupTimer); _autoBackupTimer = null; }
    const s = DB.getOne('settings') || {};
    if (s.autoBackup) {
        _autoBackupTimer = setInterval(() => { const ss = DB.getOne('settings')||{}; if (ss.autoBackup) telegramBackup(); }, 5*60*1000);
        setTimeout(() => { const ss = DB.getOne('settings')||{}; if (ss.autoBackup) telegramBackup(); }, 8000);
    }
}

function uploadStoreLogo(input) {
    const file = input.files[0];
    if (!file) return;
    if (file.size > 500 * 1024) { toast('الصورة كبيرة جداً (الحد الأقصى 500KB)', 'error'); return; }
    const reader = new FileReader();
    reader.onload = (e) => {
        updateSetting('storeLogo', e.target.result);
        renderSettings(document.getElementById('contentArea'));
        toast('تم رفع اللوجو');
    };
    reader.readAsDataURL(file);
}

function buildBackupJSON() {
    const data = {};
    const allKeys = ['products','customers','suppliers','warehouses','expenses','invoices','movements','users','settings','categories','units','heldInvoices','heldPurchases','inventoryCounts','trash','profile','seeded','quotes'];
    allKeys.forEach(k => {
        const v = DB.getOne(k);
        if (v !== undefined && v !== null) data[k] = v;
        else { const arr = DB.get(k); if (arr && arr.length > 0) data[k] = arr; }
    });
    return JSON.stringify(data, null, 2);
}
function exportBackup() {
    const blob = new Blob([buildBackupJSON()], {type:'application/json'});
    const a = document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=`backup-${todayStr()}.json`; a.click();
    toast('تم التصدير بنجاح');
}
async function telegramBackup() {
    const s = DB.getOne('settings') || {};
    if (!s.tgToken || !s.tgChatId) { toast('ادخل بيانات التلجرام (التوكن ومعرف المحادثة) في الإعدادات', 'error'); return false; }
    const blob = new Blob([buildBackupJSON()], {type:'application/json'});
    const fd = new FormData();
    fd.append('chat_id', s.tgChatId);
    fd.append('document', blob, `backup-${todayStr()}.json`);
    fd.append('caption', 'محاسب برو - نسخة احتياطية');
    try {
        const r = await fetch('https://api.telegram.org/bot' + s.tgToken + '/sendDocument', { method:'POST', body: fd });
        const j = await r.json();
        if (j && j.ok) { toast('تم النسخ الاحتياطي للتلجرام', 'success'); return true; }
        toast('فشل النسخ: ' + (j && j.description ? j.description : ''), 'error'); return false;
    } catch (e) { toast('تعذر الاتصال بالتلجرام', 'error'); return false; }
}

function importBackup(input) {
    const file = input.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = JSON.parse(e.target.result);
            const allKeys = ['products','customers','suppliers','warehouses','expenses','invoices','movements','users','settings','categories','units','heldInvoices','heldPurchases','inventoryCounts','trash','profile','seeded','quotes'];
            allKeys.forEach(k => localStorage.removeItem('erp_'+k));
            Object.keys(data).forEach(k => { if(Array.isArray(data[k])) DB.set(k,data[k]); else DB.setOne(k,data[k]); });
            toast('تم الاستيراد بنجاح'); location.reload();
        } catch { toast('خطأ في الملف','error'); }
    };
    reader.readAsText(file);
}

// ==================== INIT ====================
// Auto-restore backup if data is missing
DB._restoreBackup();

seedData();

// Ensure warehouses exist
const whCheck = DB.get('warehouses');
if (whCheck.length === 0) {
    DB.set('warehouses', [
        { id:'wh1', name:'المخزن الرئيسي', location:'المستودع الرئيسي', isDefault:true },
        { id:'wh2', name:'فرع 1', location:'شارع الملك فهد' },
    ]);
}

// Ensure main warehouse is default
const whList = DB.get('warehouses');
const mainWh = whList.find(w => w.id === 'wh1');
if (mainWh && !mainWh.isDefault) { mainWh.isDefault = true; DB.set('warehouses', whList); }
if (!mainWh) { whList.unshift({ id:'wh1', name:'المخزن الرئيسي', location:'المستودع الرئيسي', isDefault:true }); DB.set('warehouses', whList); }

// Assign products without warehouse to main warehouse
const prods = DB.get('products');
let prodsChanged = false;
prods.forEach(p => { if (!p.warehouseId) { p.warehouseId = 'wh1'; prodsChanged = true; } });
if (prodsChanged) DB.set('products', prods);

// Ensure default "بدون تصنيف" category exists
const catsInit = DB.get('categories');
if (!catsInit.find(c => c.name === 'بدون تصنيف')) { catsInit.push({ id:uid(), name:'بدون تصنيف' }); DB.set('categories', catsInit); }
const uncat = DB.get('categories').find(c => c.name === 'بدون تصنيف');
prods.forEach(p => { if (!p.categoryId) { p.categoryId = uncat.id; prodsChanged = true; } });
if (prodsChanged) DB.set('products', prods);

// One-time cleanup: keep only "بدون تصنيف" and reassign its products
if (!DB.getOne('mig_clean_categories')) {
    const allCats = DB.get('categories');
    if (allCats.length > 1 && uncat) {
        DB.set('categories', [uncat]);
        const ps = DB.get('products');
        let changed = false;
        ps.forEach(p => { if (p.categoryId !== uncat.id) { p.categoryId = uncat.id; changed = true; } });
        if (changed) DB.set('products', ps);
    }
    DB.setOne('mig_clean_categories', true);
}

setupAutoBackup();

// ==================== BLUETOOTH THERMAL PRINTER (58mm ESC/POS) ====================
let btDevice = null, btChar = null, btServer = null, btPrinterName = '';
const BT_SERVICE = '49535343-fe7d-4ae5-8fa9-9fafd205e455';
const BT_CHAR = '49535343-8841-43f4-a8d4-ecbe34729bb8';
const BT_SERVICES = [
    '49535343-fe7d-4ae5-8fa9-9fafd205e455',
    '0000ff00-0000-1000-8000-00805f9b34fb',
    '0000ffe0-0000-1000-8000-00805f9b34fb',
    'e7810a5d-dcaf-31c3-94bb-1a3b8cd83698',
    '000018f0-0000-1000-8000-00805f9b34fb',
    '00001810-0000-1000-8000-00805f9b34fb',
    '0000fee0-0000-1000-8000-00805f9b34fb'
];
const BT_CHARS = [
    '49535343-8841-43f4-a8d4-ecbe34729bb8',
    '49535343-1fb2-4ed1-9a36-cccf0a1f59be',
    '49535343-4c8a-39b3-2f49-511cff07cf81',
    '0000ff01-0000-1000-8000-00805f9b34fb',
    '0000ff02-0000-1000-8000-00805f9b34fb',
    '0000ff03-0000-1000-8000-00805f9b34fb',
    '0000ffe1-0000-1000-8000-00805f9b34fb',
    '0000ffe2-0000-1000-8000-00805f9b34fb',
    'e7810a5e-dcaf-31c3-94bb-1a3b8cd83698',
    '0000fee1-0000-1000-8000-00805f9b34fb'
];

function isThermalOn() { const s = DB.getOne('settings') || {}; return s.bluetoothThermal === true && !!btChar; }

function renderSettingsIfOpen() {
    const a = document.getElementById('contentArea');
    if (a && a.innerHTML.indexOf('الطابعة الحرارية') !== -1) renderSettings(a);
}

async function connectBluetoothPrinter() {
    if (!('bluetooth' in navigator)) { toast('المتصفح لا يدعم البلوتوث (استخدم Chrome/Edge)', 'error'); return; }
    const opts = { acceptAllDevices: true, optionalServices: BT_SERVICES };
    try {
        toast('اختر الطابعة من القائمة...');
        const device = await navigator.bluetooth.requestDevice(opts);
        await finishBtConnect(device);
    } catch (e) {
        if (e && e.name === 'NotFoundError') toast('لم يتم اختيار طابعة', 'error');
        else toast('تعذر التوصيل: ' + (e.message || e.name || ''), 'error');
    }
}

async function finishBtConnect(device) {
    const server = await device.gatt.connect();
    let char = null;
    const findChar = async (sv) => {
        for (const ch of BT_CHARS) {
            try { const c = await sv.getCharacteristic(ch); if (c) return c; } catch (e) {}
        }
        try {
            const all = await sv.getCharacteristics();
            let best = null;
            for (const c of all) {
                const p = c.properties || {};
                if (p.writeWithoutResponse) { best = c; break; }
                if (p.write && !best) best = c;
            }
            if (best) return best;
        } catch (e) {}
        return null;
    };
    for (const s of BT_SERVICES) {
        try {
            const sv = await server.getPrimaryService(s);
            const c = await findChar(sv);
            if (c) { char = c; break; }
        } catch (e) {}
    }
    if (!char) {
        try {
            const services = await server.getPrimaryServices();
            console.log('[BT] services found:', services.map(s => s.uuid));
            for (const sv of services) {
                try {
                    const c = await findChar(sv);
                    if (c) { char = c; break; }
                } catch (e) {}
            }
        } catch (e) { console.log('[BT] getPrimaryServices failed:', e); }
    }
    if (!char) {
        try { await device.gatt.disconnect(); } catch (e) {}
        btChar = null;
        toast('الطابعة غير مدعومة (لم يُعثر على خاصية كتابة). قد تكون بلوتوث كلاسيك SPP ولا تدعم المتصفح الطباعة عليها', 'error');
        return;
    }
    btDevice = device; btServer = server; btChar = char; btPrinterName = device.name || 'طابعة';
    const s = DB.getOne('settings') || {}; s.btPrinterName = btPrinterName; DB.setOne('settings', s);
    device.addEventListener('gattserverdisconnected', () => { btChar = null; toast('انقطع اتصال الطابعة'); renderSettingsIfOpen(); });
    toast('تم التوصيل: ' + btPrinterName);
    renderSettingsIfOpen();
}

async function ensureBtPrinter() {
    if (btChar) return true;
    if (!('bluetooth' in navigator)) return false;
    const opts = { acceptAllDevices: true, optionalServices: BT_SERVICES };
    try {
        const device = await navigator.bluetooth.requestDevice(opts);
        await finishBtConnect(device);
        return true;
    } catch (e) { return false; }
}

function disconnectBluetoothPrinter() {
    if (btDevice && btDevice.gatt && btDevice.gatt.connected) btDevice.gatt.disconnect();
    btChar = null; btDevice = null; toast('تم قطع الاتصال');
}

async function sendBtData(bytes) {
    if (!btChar) throw new Error('no printer');
    let mtu = 20;
    try { if (btServer && btServer.mtu) mtu = btServer.mtu; } catch (e) {}
    const CHUNK = Math.max(1, mtu - 3);
    const useNoResponse = () => {
        try { return !!(btChar.properties && btChar.properties.writeWithoutResponse); } catch (e) { return false; }
    };
    if (useNoResponse()) {
        let i = 0;
        const nextChunk = () => {
            if (i >= bytes.length) return null;
            const s = i; i += CHUNK;
            return bytes.subarray(s, Math.min(s + CHUNK, bytes.length));
        };
        const CONC = 8;
        const worker = async () => {
            let sl;
            while ((sl = nextChunk())) {
                try { await btChar.writeValue(sl); }
                catch (e) { try { await btChar.writeValueWithResponse(sl); } catch (e2) {} }
            }
        };
        await Promise.all(Array.from({ length: CONC }, worker));
    } else {
        for (let i = 0; i < bytes.length; i += CHUNK) {
            const sl = bytes.subarray(i, Math.min(i + CHUNK, bytes.length));
            try { await btChar.writeValueWithResponse(sl); } catch (e) {}
        }
    }
}

function canvasToEscPos(canvas) {
    const width = canvas.width;
    const height = canvas.height;
    const img = canvas.getContext('2d').getImageData(0, 0, width, height).data;
    const bytesPerRow = Math.ceil(width / 8);
    const h = Math.ceil(height / 8) * 8;
    const cmds = [0x1B, 0x40];
    cmds.push(0x1D, 0x76, 0x30, 0x00,
        width & 0xFF, (width >> 8) & 0xFF,
        h & 0xFF, (h >> 8) & 0xFF);
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < bytesPerRow; x++) {
            let b = 0;
            for (let bi = 0; bi < 8; bi++) {
                const xx = x * 8 + bi;
                let bit = 0;
                if (xx < width && y < height) {
                    const idx = (y * width + xx) * 4;
                    const a = img[idx + 3];
                    const lum = img[idx] * 0.299 + img[idx + 1] * 0.587 + img[idx + 2] * 0.114;
                    bit = (a < 128 || lum > 140) ? 0 : 1;
                }
                b |= (bit << (7 - bi));
            }
            cmds.push(b);
        }
    }
    cmds.push(0x0A, 0x0A, 0x0A, 0x1D, 0x56, 0x00);
    return new Uint8Array(cmds);
}

async function drawReceiptCanvas(inv, type) {
    const st = DB.getOne('settings') || {};
    const W = (st.thermalWidth === 58) ? 384 : 576;
    try { if (document.fonts && document.fonts.ready) await document.fonts.ready; } catch (e) {}
    const tmp = document.createElement('canvas'); tmp.width = W; tmp.height = 4600;
    const ctx = tmp.getContext('2d');
    ctx.direction = 'rtl';
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, 4600);
    let y = 8; const pad = 10;
    function txt(str, x, align, font, color) {
        ctx.fillStyle = color || '#000'; ctx.font = font || '16px Cairo, Tahoma, Arial, "Noto Sans Arabic", sans-serif';
        ctx.textAlign = align || 'right'; ctx.textBaseline = 'top'; ctx.fillText(str, x, y);
    }
    function divider() {
        ctx.strokeStyle = '#999'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(pad, y + 6); ctx.lineTo(W - pad, y + 6); ctx.stroke(); y += 14;
    }
    if (st.storeLogo) {
        try {
            const im = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = st.storeLogo; });
            const lw = 56, lh = 56; ctx.drawImage(im, W / 2 - lw / 2, y, lw, lh); y += lh + 6;
        } catch (e) {}
    } else {
        const letter = (st.storeName || st.companyName || 'م')[0];
        ctx.fillStyle = '#2563EB'; ctx.beginPath(); ctx.arc(W / 2, y + 22, 22, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.font = 'bold 24px Cairo, Tahoma, Arial, "Noto Sans Arabic", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(letter, W / 2, y + 23); ctx.textAlign = 'right'; ctx.textBaseline = 'top'; y += 50;
    }
    ctx.textAlign = 'center'; ctx.fillStyle = '#000'; ctx.font = 'bold 17px Cairo, Tahoma, Arial, "Noto Sans Arabic", sans-serif';
    ctx.fillText(st.storeName || st.companyName || 'المحل', W / 2, y); y += 23;
    ctx.font = '10px Cairo, Tahoma, Arial, "Noto Sans Arabic", sans-serif'; ctx.fillStyle = '#555';
    if (st.storePhone) { ctx.fillText(st.storePhone, W / 2, y); y += 14; }
    if (st.storeAddress) { ctx.fillText(st.storeAddress, W / 2, y); y += 14; }
    if (st.receiptHeader) { ctx.fillText(st.receiptHeader, W / 2, y); y += 14; }
    ctx.textAlign = 'right'; ctx.fillStyle = '#000'; y += 4;
    divider();
    ctx.font = 'bold 15px Cairo, Tahoma, Arial, "Noto Sans Arabic", sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(type === 'sale' ? 'فاتورة مبيعات' : 'فاتورة مشتريات', W / 2, y); y += 20;
    ctx.textAlign = 'right'; ctx.font = '11px Cairo, Tahoma, Arial, "Noto Sans Arabic", sans-serif'; ctx.fillStyle = '#333';
    txt('رقم الفاتورة: #' + (inv.invoiceNumber || ''), W - pad, 'right', '12px Cairo, Tahoma, Arial, "Noto Sans Arabic", sans-serif'); y += 16;
    txt('التاريخ: ' + (inv.createdAt ? fmtDateTime(inv.createdAt) : ''), W - pad, 'right', '11px Cairo, Tahoma, Arial, "Noto Sans Arabic", sans-serif'); y += 16;
    const party = type === 'sale' ? (inv.customerName || 'نقدي') : (inv.customerName || '-');
    txt((type === 'sale' ? 'العميل: ' : 'المورد: ') + party, W - pad, 'right', '11px Cairo, Tahoma, Arial, "Noto Sans Arabic", sans-serif'); y += 16;
    divider();
    ctx.font = '12px Cairo, Tahoma, Arial, "Noto Sans Arabic", sans-serif';
    (inv.items || []).forEach(it => {
        const name = it.productName || '';
        const lineTotal = (it.unitPrice * it.quantity - (it.discount || 0));
        txt(name, W - pad, 'right', '12px Cairo, Tahoma, Arial, "Noto Sans Arabic", sans-serif');
        txt(fmt(lineTotal), pad, 'left', '12px Cairo, Tahoma, Arial, "Noto Sans Arabic", sans-serif'); y += 16;
        ctx.font = '10px Cairo, Tahoma, Arial, "Noto Sans Arabic", sans-serif'; ctx.fillStyle = '#777';
        txt(it.quantity + ' × ' + fmt(it.unitPrice) + (it.discount > 0 ? ('  خصم -' + fmt(it.discount)) : ''), W - pad, 'right', '10px Cairo, Tahoma, Arial, "Noto Sans Arabic", sans-serif');
        ctx.fillStyle = '#333'; ctx.font = '12px Cairo, Tahoma, Arial, "Noto Sans Arabic", sans-serif'; y += 14;
    });
    divider();
    function tline(label, val, big, color) {
        const f = big ? 'bold 14px Cairo, Tahoma, Arial, "Noto Sans Arabic", sans-serif' : '12px Cairo, Tahoma, Arial, "Noto Sans Arabic", sans-serif';
        ctx.font = f; ctx.fillStyle = color || '#000';
        txt(label, W - pad, 'right', f);
        txt(fmt(val), pad, 'left', f); y += (big ? 20 : 16);
    }
    tline('المجموع الفرعي', inv.subtotal || inv.total);
    if (inv.discount > 0) tline('الخصم', -inv.discount, false, '#EF4444');
    if (inv.taxAmount > 0) tline('الضريبة', inv.taxAmount);
    tline('الإجمالي', inv.total || 0, true);
    if (inv.paidAmount != null && inv.paidAmount !== undefined) tline('المدفوع', inv.paidAmount);
    if (inv.remainingAmount > 0) tline('المتبقي', inv.remainingAmount, false, '#EF4444');
    divider();
    ctx.textAlign = 'center'; ctx.fillStyle = '#555'; ctx.font = '11px Cairo, Tahoma, Arial, "Noto Sans Arabic", sans-serif';
    if (st.taxNumber) { ctx.fillText('الرقم الضريبي: ' + st.taxNumber, W / 2, y); y += 15; }
    if (st.receiptFooter) { ctx.fillText(st.receiptFooter, W / 2, y); y += 15; }
    else { ctx.fillText('شكراً لتعاملكم معنا', W / 2, y); y += 15; }
    ctx.fillText(st.storeName || '', W / 2, y); y += 18;
    const out = document.createElement('canvas'); out.width = W; out.height = y + 6;
    out.getContext('2d').drawImage(tmp, 0, 0);
    return out;
}

async function printThermalReceipt(inv, type, fallback) {
    if (!btChar && !(await ensureBtPrinter())) { if (fallback) fallback(); return; }
    try {
        const canvas = await drawReceiptCanvas(inv, type);
        const bytes = canvasToEscPos(canvas);
        await sendBtData(bytes);
        toast('تم الإرسال للطابعة');
    } catch (e) {
        btChar = null;
        toast('تعذر الطباعة الحرارية: ' + (e.message || e.name || '') + ' — استخدم الطباعة العادية', 'error');
        if (fallback) fallback();
    }
}

function testThermalPrint() {
    const inv = {
        invoiceNumber: '١', createdAt: new Date().toISOString(), customerName: 'عميل نقدي',
        items: [
            { productName: 'صنف تجريبي أ', quantity: 2, unitPrice: 15, discount: 0 },
            { productName: 'صنف تجريبي ب', quantity: 1, unitPrice: 25, discount: 5 }
        ],
        subtotal: 50, discount: 5, taxAmount: 0, total: 50, paidAmount: 50, remainingAmount: 0
    };
    printThermalReceipt(inv, 'sale');
}

// ==================== GENERIC TABLE SORTING ====================
let _sortState = {};
function enableTableSort(tableId) {
    const table = document.getElementById(tableId);
    if (!table) return;
    const headers = table.querySelectorAll('thead th');
    headers.forEach((th, idx) => {
        if (!th.dataset.sortkey) return;
        th.style.cursor = 'pointer'; th.style.userSelect = 'none';
        if (th._sortBound) return;
        th._sortBound = true;
        th.addEventListener('click', () => {
            const key = th.dataset.sortkey, type = th.dataset.sorttype || 'str';
            const cur = _sortState[tableId];
            let dir = 'asc';
            if (cur && cur.key === key) dir = cur.dir === 'asc' ? 'desc' : 'asc';
            _sortState[tableId] = { key, dir };
            sortTableRows(table, idx, type, dir);
            updateSortArrows(table, headers, idx, dir);
        });
    });
    const cur = _sortState[tableId];
    if (cur) {
        const idx = Array.from(headers).findIndex(h => h.dataset.sortkey === cur.key);
        if (idx >= 0) { sortTableRows(table, idx, headers[idx].dataset.sorttype || 'str', cur.dir); updateSortArrows(table, headers, idx, cur.dir); }
    }
}
function sortTableRows(table, colIdx, type, dir) {
    const tbody = table.querySelector('tbody');
    if (!tbody) return;
    const rowsArr = Array.from(tbody.querySelectorAll('tr'));
    rowsArr.sort((a, b) => {
        const av = getCellSortVal(a, colIdx), bv = getCellSortVal(b, colIdx);
        let r;
        if (type === 'num') r = (parseFloat(av) || 0) - (parseFloat(bv) || 0);
        else if (type === 'date') r = (new Date(av).getTime() || 0) - (new Date(bv).getTime() || 0);
        else r = String(av).localeCompare(String(bv), 'ar');
        return dir === 'asc' ? r : -r;
    });
    rowsArr.forEach(r => tbody.appendChild(r));
}
function getCellSortVal(tr, idx) {
    const td = tr.children[idx];
    if (!td) return '';
    if (td.dataset.sort !== undefined) return td.dataset.sort;
    return td.textContent.trim();
}
function updateSortArrows(table, headers, idx, dir) {
    headers.forEach((th, i) => {
        const old = th.querySelector('.sort-arrow');
        if (old) old.remove();
        if (i === idx && th.dataset.sortkey) {
            const ar = document.createElement('span');
            ar.className = 'sort-arrow'; ar.style.marginRight = '4px';
            ar.textContent = dir === 'asc' ? '▲' : '▼';
            th.insertBefore(ar, th.firstChild);
        }
    });
}

// ==================== EXPORT UTILITIES ====================
function downloadCSV(rawCsv, filename) {
    const blob = new Blob(['\uFEFF' + rawCsv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename.endsWith('.csv') ? filename : filename + '.csv';
    link.click();
    URL.revokeObjectURL(link.href);
}

function exportToCSV(headers, rows, filename) {
    const sep = ';';
    const csvContent = '\uFEFF' + [headers.join(sep), ...rows.map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(sep))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename + '.csv';
    link.click();
    URL.revokeObjectURL(link.href);
}

function exportToPDF(title, headers, rows, filename) {
    let html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title><style>
        body{font-family:'Cairo',sans-serif;padding:20px;font-size:12px}
        h2{text-align:center;margin-bottom:16px;color:#1E293B}
        table{width:100%;border-collapse:collapse}
        th,td{padding:8px;border:1px solid #E2E8F0;text-align:right;font-size:11px}
        th{background:#F1F5F9;font-weight:700;color:#64748B}
        td{color:#1E293B}
        tr:nth-child(even){background:#F8FAFC}
        .footer{text-align:center;margin-top:16px;font-size:10px;color:#94A3B8}
    </style></head><body>
        <h2>${title}</h2>
        <table><thead><tr>${headers.map(h=>`<th>${h}</th>`).join('')}</tr></thead>
        <tbody>${rows.map(r=>`<tr>${r.map(c=>`<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table>
        <div class="footer">تم التصدير في: ${new Date().toLocaleString('ar-EG')}</div>
        <script>window.onload=function(){window.print();window.close()}<\/script>
    </body></html>`;
    const w = window.open('','_blank');
    w.document.write(html);
    w.document.close();
}

function exportInventoryCSV() {
    const products = DB.get('products');
    const categories = DB.get('categories');
    const warehouses = DB.get('warehouses');
    const headers = ['المنتج', 'الباركود', 'التصنيف', 'المخزن', 'الشراء', 'البيع', 'الكمية', 'الحد الأدنى', 'الوحدة', 'انتهاء الصلاحية'];
    const rows = products.map(p => {
        const cat = categories.find(c=>c.id===p.categoryId);
        const wh = warehouses.find(w=>w.id===p.warehouseId);
        return [p.name, p.barcode||'', cat?.name||'', wh?.name||'', p.buyingPrice, p.sellingPrice, p.quantity, p.minQuantity, p.unit||'قطعة', p.expiryDate||''];
    });
    exportToCSV(headers, rows, 'المخزون');
}

function exportInventoryPDF() {
    const products = DB.get('products');
    const categories = DB.get('categories');
    const warehouses = DB.get('warehouses');
    const headers = ['المنتج', 'الباركود', 'التصنيف', 'المخزن', 'الشراء', 'البيع', 'الكمية', 'الحد الأدنى'];
    const rows = products.map(p => {
        const cat = categories.find(c=>c.id===p.categoryId);
        const wh = warehouses.find(w=>w.id===p.warehouseId);
        return [p.name, p.barcode||'', cat?.name||'', wh?.name||'', fmt(p.buyingPrice), fmt(p.sellingPrice), p.quantity, p.minQuantity];
    });
    exportToPDF('تقرير المخزون', headers, rows, 'المخزون');
}

function exportSalesCSV() {
    const invoices = DB.get('invoices').filter(i=>i.type==='sale');
    const headers = ['رقم الفاتورة', 'العميل', 'الإجمالي', 'المدفوع', 'المتبقي', 'الحالة', 'مرتجع', 'التاريخ'];
    const rows = invoices.map(i => [i.invoiceNumber, i.customerName||'نقدي', i.total, i.paidAmount, i.remainingAmount, i.status==='paid'?'مدفوع':'جزئي', i.isReturn?'نعم':'لا', fmtDate(i.createdAt)]);
    exportToCSV(headers, rows, 'فواتير البيع');
}

function exportSalesPDF() {
    const invoices = DB.get('invoices').filter(i=>i.type==='sale');
    const headers = ['رقم', 'العميل', 'الإجمالي', 'المدفوع', 'المتبقي', 'الحالة', 'مرتجع', 'التاريخ'];
    const rows = invoices.map(i => [i.invoiceNumber, i.customerName||'نقدي', fmt(i.total), fmt(i.paidAmount), fmt(i.remainingAmount), i.status==='paid'?'مدفوع':'جزئي', i.isReturn?'نعم':'لا', fmtDate(i.createdAt)]);
    exportToPDF('فواتير البيع', headers, rows, 'فواتير البيع');
}

function exportPurchasesCSV() {
    const invoices = DB.get('invoices').filter(i=>i.type==='purchase');
    const headers = ['رقم الفاتورة', 'المورد', 'الإجمالي', 'المدفوع', 'المتبقي', 'الحالة', 'مرتجع', 'التاريخ'];
    const rows = invoices.map(i => [i.invoiceNumber, i.customerName||'-', i.total, i.paidAmount, i.remainingAmount, i.status==='paid'?'مدفوع':'جزئي', i.isReturn?'نعم':'لا', fmtDate(i.createdAt)]);
    exportToCSV(headers, rows, 'فواتير الشراء');
}

function exportPurchasesPDF() {
    const invoices = DB.get('invoices').filter(i=>i.type==='purchase');
    const headers = ['رقم', 'المورد', 'الإجمالي', 'المدفوع', 'المتبقي', 'الحالة', 'مرتجع', 'التاريخ'];
    const rows = invoices.map(i => [i.invoiceNumber, i.customerName||'-', fmt(i.total), fmt(i.paidAmount), fmt(i.remainingAmount), i.status==='paid'?'مدفوع':'جزئي', i.isReturn?'نعم':'لا', fmtDate(i.createdAt)]);
    exportToPDF('فواتير الشراء', headers, rows, 'فواتير الشراء');
}

function exportExpensesCSV() {
    const expenses = DB.get('expenses');
    const headers = ['الوصف', 'المبلغ', 'التاريخ', 'ملاحظات'];
    const rows = expenses.map(e => [e.description||'-', e.amount, fmtDate(e.date), e.notes||'']);
    exportToCSV(headers, rows, 'المصروفات');
}

function exportExpensesPDF() {
    const expenses = DB.get('expenses');
    const headers = ['الوصف', 'المبلغ', 'التاريخ', 'ملاحظات'];
    const rows = expenses.map(e => [e.description||'-', fmt(e.amount), fmtDate(e.date), e.notes||'']);
    exportToPDF('تقرير المصروفات', headers, rows, 'المصروفات');
}

function exportCustomersCSV() {
    const customers = DB.get('customers');
    const headers = ['الاسم', 'الهاتف', 'الرصيد', 'نقاط الولاء'];
    const rows = customers.map(c => [c.name, c.phone||'', c.balance||0, c.loyaltyPoints||0]);
    exportToCSV(headers, rows, 'العملاء');
}

function exportCustomersPDF() {
    const customers = DB.get('customers');
    const headers = ['الاسم', 'الهاتف', 'الرصيد', 'نقاط الولاء'];
    const rows = customers.map(c => [c.name, c.phone||'', fmt(c.balance||0), c.loyaltyPoints||0]);
    exportToPDF('تقرير العملاء', headers, rows, 'العملاء');
}

function exportSuppliersCSV() {
    const suppliers = DB.get('suppliers');
    const headers = ['الاسم', 'الهاتف', 'الرصيد'];
    const rows = suppliers.map(s => [s.name, s.phone||'', s.balance||0]);
    exportToCSV(headers, rows, 'الموردين');
}

function exportSuppliersPDF() {
    const suppliers = DB.get('suppliers');
    const headers = ['الاسم', 'الهاتف', 'الرصيد'];
    const rows = suppliers.map(s => [s.name, s.phone||'', fmt(s.balance||0)]);
    exportToPDF('تقرير الموردين', headers, rows, 'الموردين');
}

const savedTheme = DB.getOne('settings');
if (savedTheme?.darkMode) {
    document.documentElement.setAttribute('data-theme', 'dark');
    setTimeout(() => { const ic=document.getElementById('themeIcon'); if(ic) ic.textContent='light_mode'; }, 0);
}

document.getElementById('sidebarUserName').textContent = currentUser.name;
document.getElementById('sidebarUserRole').textContent = 'مدير النظام';
showScreen('dashboard');

