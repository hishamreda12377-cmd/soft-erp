const DB_KEY = 'mohasebSoftDB';

function getDB() {
    const raw = localStorage.getItem(DB_KEY);
    if (raw) {
        try { return JSON.parse(raw); } catch(e) {}
    }
    return {
        bills: [], customers: [], suppliers: [], items: [], expenses: [],
        offers: [], orders: [], settings: { theme: 'light', currency: 'ر.س', tax: 0, company: '' },
        users: [], accounts: [], journals: [], vouchers: [],
        currencies: [], branches: [], adjustments: []
    };
}

function saveDB(db) {
    localStorage.setItem(DB_KEY, JSON.stringify(db));
}

// ====== صفحة تسجيل الدخول ======
const DEFAULT_PASSWORD = '1';

function showLogin() {
    document.getElementById('loginScreen').style.display = 'flex';
    document.getElementById('mainScreen').classList.remove('screen-active');
    document.getElementById('loginPassword').value = '';
    document.getElementById('loginError').textContent = '';
}

function hideLogin() {
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('mainScreen').classList.add('screen-active');
}

function handleLogin() {
    const pwd = document.getElementById('loginPassword').value;
    const db = getDB();
    const savedPwd = db.settings.password || DEFAULT_PASSWORD;
    if (pwd === savedPwd) {
        hideLogin();
        initApp();
    } else {
        document.getElementById('loginError').textContent = 'كلمة المرور غير صحيحة';
        document.getElementById('loginPassword').value = '';
    }
}

function handleLogout() {
    document.getElementById('sidebar').classList.add('closed');
    showLogin();
}

function initApp() {
    const userEl = document.getElementById('currentUser');
    if (userEl) userEl.textContent = '👤 مدير النظام';
    loadSettings();
    loadAllData();
    showScreen('dashboard');
}

// ====== التنقل ======
let currentScreen = 'dashboard';

function toggleSidebar() {
    const sb = document.getElementById('sidebar');
    sb.classList.toggle('closed');
    document.getElementById('sidebarOverlay').classList.toggle('show', !sb.classList.contains('closed'));
}

function showScreen(name) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const page = document.getElementById('page-' + name);
    if (page) page.classList.add('active');
    currentScreen = name;
    document.getElementById('sidebar').classList.add('closed');
    document.getElementById('sidebarOverlay').classList.remove('show');
    window.scrollTo(0, 0);
    const titleEl = document.querySelector('#page-' + name + ' h3');
    document.getElementById('pageTitle').textContent = titleEl ? titleEl.textContent : 'محاسب سوفت';
    switch (name) {
        case 'dashboard': loadDashboard(); break;
        case 'sales': renderBillsList('sale'); break;
        case 'purchases': renderBillsList('purchase'); break;
        case 'customers': renderParties('customers'); break;
        case 'suppliers': renderParties('suppliers'); break;
        case 'inventory': renderInventory(); break;
        case 'expenses': renderExpenses(); break;
        case 'offers': renderOffers(); break;
        case 'orders': renderOrders(); break;
        case 'reports': document.getElementById('reportResult').style.display = 'none'; break;
        case 'accounts': renderAccounts(); break;
        case 'journals': renderJournals(); break;
        case 'vouchers': renderVouchers(); break;
        case 'currencies': renderCurrencies(); break;
        case 'branches': renderBranches(); break;
        case 'adjustments': renderAdjustments(); break;
        case 'settings': loadSettings(); closeSettingsSection(); break;
        case 'inventoryBalance': renderInventoryBalance(); break;
    }
}

// ====== الأدوات المساعدة ======
function todayStr() { return new Date().toISOString().split('T')[0]; }
function nowStr() { return new Date().toISOString(); }
function genId() { return Date.now().toString(36) + Math.random().toString(36).substr(2, 5); }
function fmtNum(n) { return parseFloat(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

function toggleAccordion(el) {
    el.classList.toggle('open');
    const body = el.nextElementSibling;
    if (body) body.classList.toggle('open');
}

function currency() {
    const db = getDB();
    return db.settings.currency || 'ر.س';
}

// ====== الإعدادات ======
function loadSettings() {
    const db = getDB();
    const s = db.settings || {};
    document.getElementById('settingsCompany').value = s.company || '';
    document.getElementById('settingsPhone').value = s.phone || '';
    document.getElementById('settingsAddress').value = s.address || '';
    document.getElementById('settingsTax').value = s.tax || 0;
    document.getElementById('settingsCurrency').value = s.currency || 'ر.س';
    const theme = s.theme || 'light';
    document.documentElement.setAttribute('data-theme', theme === 'dark' ? 'dark' : 'light');
    document.getElementById('themeToggle').innerHTML = theme === 'dark'
        ? '<i class="fas fa-sun"></i> الوضع النهاري'
        : '<i class="fas fa-moon"></i> الوضع الليلي';
}

function saveSetting(key, val) {
    const db = getDB();
    if (!db.settings) db.settings = {};
    db.settings[key] = val;
    saveDB(db);
}

function openSettingsSection(section) {
    document.querySelectorAll('.settings-list, .settings-section').forEach(el => el.style.display = 'none');
    const sectionMap = {
        'personal': 'settingsSectionPersonal',
        'print': 'settingsSectionPrint',
        'security': 'settingsSectionSecurity',
        'users': 'settingsSectionUsers',
        'categories': 'settingsSectionCategories',
        'groups': 'settingsSectionGroups',
        'units': 'settingsSectionUnits',
        'backup': 'settingsSectionBackup',
        'thermal': 'settingsSectionThermal',
        'tax': 'settingsSectionTax',
        'barcode': 'settingsSectionBarcode',
        'notifications': 'settingsSectionNotifications',
        'other': 'settingsSectionOther',
        'subscription': 'settingsSectionSubscription'
    };
    const elId = sectionMap[section];
    if (elId && document.getElementById(elId)) {
        document.getElementById(elId).style.display = 'block';
    } else {
        alert('هذه الميزة قيد التطوير');
        document.querySelector('.settings-list').style.display = 'block';
    }
}

function closeSettingsSection() {
    document.querySelectorAll('.settings-section').forEach(el => el.style.display = 'none');
    document.querySelector('.settings-list').style.display = 'block';
}

function toggleTheme() {
    const db = getDB();
    if (!db.settings) db.settings = {};
    const current = db.settings.theme || 'light';
    const next = current === 'light' ? 'dark' : 'light';
    db.settings.theme = next;
    saveDB(db);
    loadSettings();
}

// ====== لوحة التحكم ======
function loadDashboard() {
}

// ====== الفواتير ======
function toggleBillsContext(e, type) {
    e.stopPropagation();
    const ctxId = type === 'sale' ? 'salesContextMenu' : 'purchasesContextMenu';
    document.getElementById(ctxId).classList.toggle('show');
}

function filterBillsAdvanced() {
    document.querySelectorAll('.context-menu').forEach(c => c.classList.remove('show'));
}

function printBillsList(type) {
    document.querySelectorAll('.context-menu').forEach(c => c.classList.remove('show'));
    window.print();
}

function printBillsThermal() {
    document.querySelectorAll('.context-menu').forEach(c => c.classList.remove('show'));
    alert('جاري التجهيز للطباعة الحرارية...');
}

function renderBillsList(type) {
    const db = getDB();
    const isSale = type === 'sale';
    const searchId = isSale ? 'salesSearchInput' : 'purchasesSearchInput';
    const listId = isSale ? 'salesList' : 'purchasesList';
    const totalId = isSale ? 'salesTotalAmount' : 'purchasesTotalAmount';

    const search = (document.getElementById(searchId) ? document.getElementById(searchId).value : '').trim();
    let list = db.bills.filter(b => b.type === type);
    if (search) {
        const q = search.toLowerCase();
        list = list.filter(b => b.no.toLowerCase().includes(q) || (b.partyName || '').toLowerCase().includes(q));
    }
    list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const container = document.getElementById(listId);
    if (!container) return;
    if (list.length === 0) {
        container.innerHTML = isSale
            ? '<p class="muted" style="padding:2rem;text-align:center;">لا توجد فواتير مبيعات بعد</p>'
            : '<p class="muted" style="padding:2rem;text-align:center;">لا توجد فواتير مشتريات بعد</p>';
        document.getElementById(totalId).textContent = '0.00';
        return;
    }
    let total = 0;
    let html = '';
    list.forEach(b => {
        total += parseFloat(b.total || 0);
        html += `<div class="bills-table-row" onclick="viewBill('${b.id}')">
            <span class="col-num">${b.no}</span>
            <span class="col-date">${b.date}</span>
            <span class="col-name">${b.partyName || '-'}</span>
            <span class="col-amount">${fmtNum(b.total)}</span>
            <span class="col-currency">${currency()}</span>
        </div>`;
    });
    container.innerHTML = html;
    document.getElementById(totalId).textContent = fmtNum(total);
}

function renderBills() { renderBillsList('sale'); renderBillsList('purchase'); }

document.addEventListener('click', function() {
    document.querySelectorAll('.context-menu').forEach(c => c.classList.remove('show'));
});

function openBillForm(data) {
    const modal = document.getElementById('billFormModal');
    const db = getDB();
    
    // Handle both string type and data object
    let billType, billData;
    if (typeof data === 'string') {
        billType = data;
        billData = null;
    } else {
        billData = data;
        billType = data ? data.type : 'sale';
    }
    
    const titleText = billType === 'sale' ? 'فاتورة بيع' : 'فاتورة شراء';
    document.getElementById('billFormTitle').textContent = billData ? 'فاتورة رقم ' + billData.no : titleText;
    document.getElementById('billNo').value = billData ? billData.no : (billType === 'sale' ? 'SALE-' : 'PUR-') + String(db.bills.length + 1).padStart(4, '0');
    document.getElementById('billDate').value = billData ? billData.date : todayStr();
    
    // Warehouse selector
    const whSel = document.getElementById('billWarehouse');
    whSel.innerHTML = (db.branches || []).map(b => `<option value="${b.id}" ${billData && billData.warehouseId === b.id ? 'selected' : ''}>${b.name}</option>`).join('') || '<option value="">لا يوجد مخازن</option>';
    
    // Currency selector
    const curSel = document.getElementById('billCurrency');
    const cur = currency();
    curSel.innerHTML = `<option value="${cur}" selected>${cur}</option>`;
    
    // Party search (customer or supplier)
    const partySearch = document.getElementById('billPartySearch');
    const partyHidden = document.getElementById('billParty');
    partySearch.value = '';
    partyHidden.value = '';
    partySearch.placeholder = billType === 'sale' ? 'ابحث عن عميل...' : 'ابحث عن مورد...';
    partySearch.dataset.billType = billType;
    
    // Notes
    document.getElementById('billNotes').value = billData ? (billData.notes || '') : '';
    
    // Credit toggle
    document.getElementById('billCreditToggle').checked = billData ? (billData.credit || false) : false;
    
    // Items
    document.getElementById('billItemsBody').innerHTML = '';
    if (billData && billData.items) {
        billData.items.forEach(it => addBillItemRow(it));
    }
    
    // Totals
    document.getElementById('billDiscount').value = billData ? (billData.discount || 0) : 0;
    document.getElementById('billTax').value = billData ? (billData.tax || 0) : (db.settings.tax || 0);
    document.getElementById('billFees').value = billData ? (billData.fees || 0) : 0;
    document.getElementById('billPaid').value = billData ? (billData.paid || 0) : 0;
    
    // Empty state
    toggleBillEmptyState();
    calcBillTotal();
    
    modal.dataset.editId = billData ? billData.id : '';
    modal.dataset.billType = billType;
    modal.classList.add('open');
}

function toggleBillCredit() {
    // Toggle credit mode - visual feedback only
    const isCredit = document.getElementById('billCreditToggle').checked;
    const paidInput = document.getElementById('billPaid');
    if (isCredit) {
        paidInput.value = 0;
        paidInput.disabled = true;
    } else {
        paidInput.disabled = false;
    }
    calcBillTotal();
}

// ====== Search Functions ======
function searchBillParty() {
    const searchInput = document.getElementById('billPartySearch');
    const resultsDiv = document.getElementById('billPartyResults');
    const query = searchInput.value.trim().toLowerCase();
    const billType = searchInput.dataset.billType || 'sale';
    const db = getDB();
    const list = billType === 'purchase' ? db.suppliers : db.customers;
    
    if (!query) {
        resultsDiv.classList.remove('show');
        return;
    }
    
    const filtered = list.filter(p => 
        (p.name || '').toLowerCase().includes(query) || 
        (p.phone || '').includes(query)
    );
    
    if (filtered.length === 0) {
        resultsDiv.innerHTML = '<div class="search-no-results">لا توجد نتائج</div>';
    } else {
        resultsDiv.innerHTML = filtered.map(p => `
            <div class="search-result-item" onclick="selectBillParty('${p.id}', '${p.name}')">
                <i class="fas fa-user"></i>
                <div class="result-info">
                    <span class="result-name">${p.name}</span>
                    <span class="result-sub">${p.phone || 'لا هاتف'}</span>
                </div>
            </div>
        `).join('');
    }
    resultsDiv.classList.add('show');
}

function selectBillParty(id, name) {
    document.getElementById('billPartySearch').value = name;
    document.getElementById('billParty').value = id;
    document.getElementById('billPartyResults').classList.remove('show');
}

function searchAddItem() {
    const searchInput = document.getElementById('addItemSearch');
    const resultsDiv = document.getElementById('addItemResults');
    const query = searchInput.value.trim().toLowerCase();
    const db = getDB();
    
    if (!query) {
        resultsDiv.classList.remove('show');
        return;
    }
    
    const filtered = db.items.filter(i => 
        (i.name || '').toLowerCase().includes(query) || 
        (i.barcode || '').includes(query)
    );
    
    if (filtered.length === 0) {
        resultsDiv.innerHTML = '<div class="search-no-results">لا توجد نتائج - اضغط Enter للإضافة</div>';
    } else {
        resultsDiv.innerHTML = filtered.map(i => `
            <div class="search-result-item" onclick="selectAddItem('${i.id}', '${i.name}', ${i.price || 0})">
                <i class="fas fa-box"></i>
                <div class="result-info">
                    <span class="result-name">${i.name}</span>
                    <span class="result-sub">${fmtNum(i.price || 0)} ${currency()} | الكمية: ${i.qty || 0}</span>
                </div>
            </div>
        `).join('');
    }
    resultsDiv.classList.add('show');
}

function selectAddItem(id, name, price) {
    document.getElementById('addItemSearch').value = name;
    document.getElementById('addItemId').value = id;
    document.getElementById('addItemPrice').value = price;
    document.getElementById('addItemResults').classList.remove('show');
    calcAddItemTotal();
}

// Close dropdowns when clicking outside
document.addEventListener('click', function(e) {
    if (!e.target.closest('#billPartySearch') && !e.target.closest('#billPartyResults')) {
        document.getElementById('billPartyResults').classList.remove('show');
    }
    if (!e.target.closest('#addItemSearch') && !e.target.closest('#addItemResults')) {
        document.getElementById('addItemResults').classList.remove('show');
    }
});

function toggleBillEmptyState() {
    const cards = document.querySelectorAll('.billv2-item-card');
    const emptyState = document.getElementById('billEmptyState');
    if (emptyState) {
        emptyState.style.display = cards.length === 0 ? 'flex' : 'none';
    }
}

function openAddItemModal() {
    const modal = document.getElementById('addItemModal');
    const searchInput = document.getElementById('addItemSearch');
    const idInput = document.getElementById('addItemId');
    searchInput.value = '';
    idInput.value = '';
    document.getElementById('addItemQty').value = 1;
    document.getElementById('addItemPrice').value = 0;
    document.getElementById('addItemTotal').textContent = '0.00';
    modal.classList.add('open');
    // Auto-focus on search input
    setTimeout(() => searchInput.focus(), 100);
}

function closeAddItemModal() {
    document.getElementById('addItemModal').classList.remove('open');
}

function calcAddItemTotal() {
    const qty = parseFloat(document.getElementById('addItemQty').value) || 0;
    const price = parseFloat(document.getElementById('addItemPrice').value) || 0;
    document.getElementById('addItemTotal').textContent = fmtNum(qty * price);
}

function addBillItemFromModal() {
    const idInput = document.getElementById('addItemId');
    const searchInput = document.getElementById('addItemSearch');
    const id = idInput.value;
    if (!id) { alert('اختر صنفاً'); return; }
    const db = getDB();
    const item = db.items.find(i => i.id === id);
    if (!item) return;
    const qty = parseFloat(document.getElementById('addItemQty').value) || 1;
    const price = parseFloat(document.getElementById('addItemPrice').value) || (item.price || 0);
    addBillItemRow({ itemId: id, itemName: item.name, qty, price, total: qty * price });
    calcBillTotal();
    toggleBillEmptyState();
    
    // Visual feedback: show success toast
    showToast('تمت إضافة الصنف بنجاح', 'success');
    
    // Reset form for next item
    searchInput.value = '';
    idInput.value = '';
    document.getElementById('addItemQty').value = 1;
    document.getElementById('addItemPrice').value = 0;
    document.getElementById('addItemTotal').textContent = '0.00';
    searchInput.focus();
}

function addBillItemRow(data) {
    const container = document.getElementById('billItemsBody');
    const total = (data.qty || 0) * (data.price || 0);
    const card = document.createElement('div');
    card.className = 'billv2-item-card';
    card.dataset.itemId = data.itemId || '';
    card.dataset.itemName = data.itemName || '';
    card.dataset.qty = data.qty || 1;
    card.dataset.price = data.price || 0;
    card.innerHTML = `
        <div class="billv2-item-icon"><i class="fas fa-box"></i></div>
        <div class="billv2-item-info">
            <div class="billv2-item-name">${data.itemName || 'صنف'}</div>
            <div class="billv2-item-meta">
                <span><i class="fas fa-tag"></i> ${fmtNum(data.price || 0)} ر.س/قطعة</span>
            </div>
        </div>
        <div class="billv2-item-total">
            <div class="amount">${fmtNum(total)}</div>
            <div class="qty-display">${data.qty || 1} × ${fmtNum(data.price || 0)}</div>
        </div>
        <div class="billv2-item-actions">
            <button class="btn-edit" onclick="editBillItem(this)" title="تعديل"><i class="fas fa-pen"></i></button>
            <button class="btn-delete" onclick="deleteBillItem(this)" title="حذف"><i class="fas fa-trash-alt"></i></button>
        </div>
    `;
    container.appendChild(card);
    updateBillItemsCount();
}

function editBillItem(btn) {
    const card = btn.closest('.billv2-item-card');
    const currentQty = card.dataset.qty || 1;
    const currentPrice = card.dataset.price || 0;
    const newQty = prompt('الكمية:', currentQty);
    if (newQty === null) return;
    const newPrice = prompt('السعر:', currentPrice);
    if (newPrice === null) return;
    const qty = parseFloat(newQty) || 1;
    const price = parseFloat(newPrice) || 0;
    const total = qty * price;
    card.dataset.qty = qty;
    card.dataset.price = price;
    card.querySelector('.billv2-item-total .amount').textContent = fmtNum(total);
    card.querySelector('.billv2-item-total .qty-display').textContent = `${qty} × ${fmtNum(price)}`;
    card.querySelector('.billv2-item-meta span').innerHTML = `<i class="fas fa-tag"></i> ${fmtNum(price)} ر.س/قطعة`;
    calcBillTotal();
}

function deleteBillItem(btn) {
    const card = btn.closest('.billv2-item-card');
    card.style.transform = 'translateX(-100%)';
    card.style.opacity = '0';
    setTimeout(() => {
        card.remove();
        calcBillTotal();
        toggleBillEmptyState();
        updateBillItemsCount();
    }, 200);
}

function updateBillItemsCount() {
    const count = document.querySelectorAll('.billv2-item-card').length;
    const badge = document.getElementById('billItemsCount');
    if (badge) badge.textContent = count;
}

function updateBillItemRow(input) {
    const card = input.closest('.billv2-item-card');
    if (card) {
        const qty = parseFloat(card.dataset.qty) || 0;
        const price = parseFloat(card.dataset.price) || 0;
        card.querySelector('.billv2-item-total .amount').textContent = fmtNum(qty * price);
    }
    calcBillTotal();
}

function calcBillTotal() {
    const cards = document.querySelectorAll('.billv2-item-card');
    let total = 0;
    cards.forEach(card => {
        const qty = parseFloat(card.dataset.qty) || 0;
        const price = parseFloat(card.dataset.price) || 0;
        total += qty * price;
    });
    const discount = parseFloat(document.getElementById('billDiscount').value) || 0;
    const taxPercent = parseFloat(document.getElementById('billTax').value) || 0;
    const fees = parseFloat(document.getElementById('billFees').value) || 0;
    const paid = parseFloat(document.getElementById('billPaid').value) || 0;
    const afterDiscount = total - discount;
    const taxAmount = afterDiscount * (taxPercent / 100);
    const net = afterDiscount;
    const grandTotal = net + taxAmount + fees;
    const remaining = grandTotal - paid;
    
    // Update compact summary
    const compactEl = document.getElementById('billTotalCompact');
    if (compactEl) compactEl.textContent = fmtNum(Math.max(0, grandTotal)) + ' ' + currency();
    
    // Update full summary
    const subtotalEl = document.getElementById('billSubtotal');
    if (subtotalEl) subtotalEl.textContent = fmtNum(total) + ' ' + currency();
    
    const netEl = document.getElementById('billNetAmount');
    if (netEl) netEl.textContent = fmtNum(Math.max(0, net)) + ' ' + currency();
    
    const totalEl = document.getElementById('billTotal');
    if (totalEl) totalEl.textContent = fmtNum(Math.max(0, grandTotal)) + ' ' + currency();
    
    const remainingEl = document.getElementById('billRemaining');
    if (remainingEl) remainingEl.textContent = fmtNum(Math.max(0, remaining)) + ' ' + currency();
    
    return { total, discount, net: Math.max(0, net), taxPercent, taxAmount, fees, grandTotal: Math.max(0, grandTotal), paid, remaining: Math.max(0, remaining) };
}

function toggleBillv2Summary() {
    const panel = document.getElementById('billv2SummaryPanel');
    const arrow = document.getElementById('billSummaryArrow');
    panel.classList.toggle('open');
    arrow.classList.toggle('rotated');
}

function saveBill() {
    const modal = document.getElementById('billFormModal');
    const no = document.getElementById('billNo').value;
    const date = document.getElementById('billDate').value;
    const billType = modal.dataset.billType || 'sale';
    const partyId = document.getElementById('billParty').value;
    const warehouseId = document.getElementById('billWarehouse').value;
    const notes = document.getElementById('billNotes').value;
    const credit = document.getElementById('billCreditToggle').checked;
    const discount = parseFloat(document.getElementById('billDiscount').value) || 0;
    const taxPercent = parseFloat(document.getElementById('billTax').value) || 0;
    const fees = parseFloat(document.getElementById('billFees').value) || 0;
    const paid = parseFloat(document.getElementById('billPaid').value) || 0;
    const db = getDB();
    const editId = modal.dataset.editId;
    const cards = document.querySelectorAll('.billv2-item-card');
    const items = [];
    let total = 0;
    cards.forEach(card => {
        const qty = parseFloat(card.dataset.qty) || 0;
        const price = parseFloat(card.dataset.price) || 0;
        const itemTotal = qty * price;
        total += itemTotal;
        items.push({ itemId: card.dataset.itemId, itemName: card.dataset.itemName, qty, price, total: itemTotal });
    });
    if (items.length === 0) { alert('أضف صنفاً واحداً على الأقل'); return; }
    let partyName = '-';
    if (partyId) {
        const partyList = billType === 'purchase' ? db.suppliers : db.customers;
        const party = partyList.find(p => p.id === partyId);
        if (party) partyName = party.name;
    }
    const afterDiscount = total - discount;
    const taxAmount = afterDiscount * (taxPercent / 100);
    const grandTotal = afterDiscount + taxAmount + fees;
    
    const billData = { 
        no, date, type: billType, partyId, partyName, warehouseId, notes, credit,
        items, discount, tax: taxPercent, taxAmount, fees, 
        total: Math.max(0, grandTotal), paid, 
        createdAt: nowStr() 
    };
    if (editId) {
        const idx = db.bills.findIndex(b => b.id === editId);
        if (idx >= 0) { db.bills[idx] = { ...db.bills[idx], ...billData }; }
    } else {
        billData.id = genId();
        db.bills.push(billData);
    }
    saveDB(db);
    showToast('تم حفظ الفاتورة بنجاح', 'success');
    closeBillForm();
    renderBills();
    loadDashboard();
}

function deleteBill(id) {
    if (!confirm('هل أنت متأكد من حذف الفاتورة؟')) return;
    const db = getDB();
    db.bills = db.bills.filter(b => b.id !== id);
    saveDB(db);
    renderBills();
    loadDashboard();
}

function viewBill(id) {
    const db = getDB();
    const bill = db.bills.find(b => b.id === id);
    if (!bill) return;
    openBillForm(bill);
}

// ====== العملاء والموردين ======
function renderParties(type) {
    const db = getDB();
    const isCust = type === 'customers';
    const list = isCust ? db.customers : db.suppliers;
    const search = (document.getElementById(type + 'Search').value || '').toLowerCase();
    const filtered = search ? list.filter(p => p.name.toLowerCase().includes(search) || (p.phone || '').includes(search)) : list;
    const container = document.getElementById(type + 'List');
    if (filtered.length === 0) {
        container.innerHTML = '<div class="empty-state"><i class="fas fa-users"></i><p>لا توجد بيانات</p></div>';
        return;
    }
    let html = `<table><thead><tr><th>الاسم</th><th>الهاتف</th><th>العنوان</th><th>البريد</th><th>الرصيد</th><th></th></tr></thead><tbody>`;
    filtered.forEach(p => {
        const balance = calcPartyBalance(p.id, isCust);
        const balClass = balance >= 0 ? 'text-success' : 'text-danger';
        html += `<tr>
            <td><strong>${p.name}</strong></td>
            <td>${p.phone || '-'}</td>
            <td>${p.address || '-'}</td>
            <td>${p.email || '-'}</td>
            <td class="${balClass}">${fmtNum(balance)} ${currency()}</td>
            <td>
                <button onclick="editParty('${p.id}','${isCust ? 'customer' : 'supplier'}')" class="icon-btn"><i class="fas fa-edit"></i></button>
                <button onclick="deleteParty('${p.id}','${isCust ? 'customer' : 'supplier'}')" class="icon-btn" style="color:var(--danger)"><i class="fas fa-trash"></i></button>
            </td>
        </tr>`;
    });
    html += '</tbody></table>';
    container.innerHTML = html;
}

function calcPartyBalance(partyId, isCustomer) {
    const db = getDB();
    const type = isCustomer ? 'sale' : 'purchase';
    return db.bills.filter(b => b.partyId === partyId && b.type === type)
        .reduce((s, b) => s + (b.total || 0), 0);
}

function openPartyForm(type) {
    document.getElementById('partyFormTitle').textContent = type === 'customer' ? 'عميل جديد' : 'مورد جديد';
    document.getElementById('partyType').value = type;
    document.getElementById('partyEditId').value = '';
    document.getElementById('partyName').value = '';
    document.getElementById('partyPhone').value = '';
    document.getElementById('partyAddress').value = '';
    document.getElementById('partyEmail').value = '';
    document.getElementById('partyNotes').value = '';
    document.getElementById('partyFormModal').classList.add('open');
}

function closePartyForm() {
    document.getElementById('partyFormModal').classList.remove('open');
}

function saveParty() {
    const type = document.getElementById('partyType').value;
    const editId = document.getElementById('partyEditId').value;
    const name = document.getElementById('partyName').value.trim();
    if (!name) { alert('يرجى إدخال الاسم'); return; }
    const data = {
        name, phone: document.getElementById('partyPhone').value.trim(),
        address: document.getElementById('partyAddress').value.trim(),
        email: document.getElementById('partyEmail').value.trim(),
        notes: document.getElementById('partyNotes').value.trim()
    };
    const db = getDB();
    const key = type === 'customer' ? 'customers' : 'suppliers';
    if (editId) {
        const idx = db[key].findIndex(p => p.id === editId);
        if (idx >= 0) db[key][idx] = { ...db[key][idx], ...data };
    } else {
        data.id = genId();
        db[key].push(data);
    }
    saveDB(db);
    closePartyForm();
    renderParties(key);
    loadDashboard();
}

function editParty(id, type) {
    const db = getDB();
    const key = type === 'customer' ? 'customers' : 'suppliers';
    const party = db[key].find(p => p.id === id);
    if (!party) return;
    document.getElementById('partyFormTitle').textContent = type === 'customer' ? 'تعديل عميل' : 'تعديل مورد';
    document.getElementById('partyType').value = type;
    document.getElementById('partyEditId').value = id;
    document.getElementById('partyName').value = party.name || '';
    document.getElementById('partyPhone').value = party.phone || '';
    document.getElementById('partyAddress').value = party.address || '';
    document.getElementById('partyEmail').value = party.email || '';
    document.getElementById('partyNotes').value = party.notes || '';
    document.getElementById('partyFormModal').classList.add('open');
}

function deleteParty(id, type) {
    if (!confirm('هل أنت متأكد من الحذف؟')) return;
    const db = getDB();
    const key = type === 'customer' ? 'customers' : 'suppliers';
    db[key] = db[key].filter(p => p.id !== id);
    saveDB(db);
    renderParties(key);
    loadDashboard();
}

// ====== المخزون ======
function renderInventory() {
    const db = getDB();
    const search = (document.getElementById('itemsSearch').value || '').toLowerCase();
    const catFilter = document.getElementById('itemsCategoryFilter').value;
    let list = db.items;
    if (catFilter !== 'all') list = list.filter(it => it.category === catFilter);
    if (search) list = list.filter(it => it.name.toLowerCase().includes(search) || (it.barcode || '').includes(search));
    const catSel = document.getElementById('itemsCategoryFilter');
    const cats = [...new Set(db.items.map(it => it.category).filter(Boolean))];
    catSel.innerHTML = '<option value="all">جميع الأقسام</option>' + cats.map(c => `<option value="${c}" ${c === catFilter ? 'selected' : ''}>${c}</option>`).join('');
    const container = document.getElementById('inventoryList');
    if (list.length === 0) {
        container.innerHTML = '<div class="empty-state"><i class="fas fa-boxes"></i><p>لا توجد أصناف</p></div>';
        return;
    }
    let html = `<table><thead><tr><th>الصنف</th><th>القسم</th><th>الكمية</th><th>السعر</th><th>التكلفة</th><th>القيمة</th><th>الباركود</th><th></th></tr></thead><tbody>`;
    list.forEach(it => {
        const val = (it.qty || 0) * (it.price || 0);
        const lowStock = it.qty <= 5;
        html += `<tr>
            <td><strong>${it.name}</strong> ${lowStock ? '<span class="badge badge-danger" title="مخزون منخفض">!</span>' : ''}</td>
            <td>${it.category || '-'}</td>
            <td class="${lowStock ? 'text-danger' : ''}"><strong>${it.qty || 0}</strong></td>
            <td>${fmtNum(it.price || 0)}</td>
            <td>${fmtNum(it.cost || 0)}</td>
            <td>${fmtNum(val)} ${currency()}</td>
            <td>${it.barcode || '-'}</td>
            <td>
                <button onclick="editItem('${it.id}')" class="icon-btn"><i class="fas fa-edit"></i></button>
                <button onclick="deleteItem('${it.id}')" class="icon-btn" style="color:var(--danger)"><i class="fas fa-trash"></i></button>
            </td>
        </tr>`;
    });
    html += '</tbody></table>';
    container.innerHTML = html;
}

function openItemForm() {
    document.getElementById('itemFormTitle').textContent = 'صنف جديد';
    document.getElementById('itemEditId').value = '';
    document.getElementById('itemName').value = '';
    document.getElementById('itemDesc').value = '';
    document.getElementById('itemPrice').value = '';
    document.getElementById('itemCost').value = '';
    document.getElementById('itemQty').value = 0;
    document.getElementById('itemBarcode').value = '';
    const catSel = document.getElementById('itemCategory');
    const db = getDB();
    const cats = [...new Set(db.items.map(i => i.category).filter(Boolean))];
    catSel.innerHTML = '<option value="">-- بدون قسم --</option>' + cats.map(c => `<option value="${c}">${c}</option>`).join('');
    document.getElementById('itemFormModal').classList.add('open');
}

function closeItemForm() {
    document.getElementById('itemFormModal').classList.remove('open');
}

function saveItem() {
    const editId = document.getElementById('itemEditId').value;
    const name = document.getElementById('itemName').value.trim();
    if (!name) { alert('يرجى إدخال اسم الصنف'); return; }
    const data = {
        name, desc: document.getElementById('itemDesc').value.trim(),
        price: parseFloat(document.getElementById('itemPrice').value) || 0,
        cost: parseFloat(document.getElementById('itemCost').value) || 0,
        qty: parseFloat(document.getElementById('itemQty').value) || 0,
        category: document.getElementById('itemCategory').value,
        barcode: document.getElementById('itemBarcode').value.trim()
    };
    const db = getDB();
    if (editId) {
        const idx = db.items.findIndex(i => i.id === editId);
        if (idx >= 0) db.items[idx] = { ...db.items[idx], ...data };
    } else {
        data.id = genId();
        db.items.push(data);
    }
    saveDB(db);
    closeItemForm();
    renderInventory();
    loadDashboard();
}

function editItem(id) {
    const db = getDB();
    const item = db.items.find(i => i.id === id);
    if (!item) return;
    document.getElementById('itemFormTitle').textContent = 'تعديل صنف';
    document.getElementById('itemEditId').value = id;
    document.getElementById('itemName').value = item.name || '';
    document.getElementById('itemDesc').value = item.desc || '';
    document.getElementById('itemPrice').value = item.price || '';
    document.getElementById('itemCost').value = item.cost || '';
    document.getElementById('itemQty').value = item.qty || 0;
    document.getElementById('itemBarcode').value = item.barcode || '';
    const catSel = document.getElementById('itemCategory');
    const db2 = getDB();
    const cats = [...new Set(db2.items.map(i => i.category).filter(Boolean))];
    catSel.innerHTML = '<option value="">-- بدون قسم --</option>' + cats.map(c => `<option value="${c}" ${c === item.category ? 'selected' : ''}>${c}</option>`).join('');
    document.getElementById('itemFormModal').classList.add('open');
}

function deleteItem(id) {
    if (!confirm('هل أنت متأكد من حذف هذا الصنف؟')) return;
    const db = getDB();
    db.items = db.items.filter(i => i.id !== id);
    saveDB(db);
    renderInventory();
    loadDashboard();
}

// ====== المصروفات ======
function renderExpenses() {
    const db = getDB();
    const search = (document.getElementById('expensesSearch').value || '').toLowerCase();
    let list = db.expenses;
    if (search) list = list.filter(e => e.desc.toLowerCase().includes(search) || (e.notes || '').toLowerCase().includes(search));
    list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const container = document.getElementById('expensesList');
    if (list.length === 0) {
        container.innerHTML = '<div class="empty-state"><i class="fas fa-money-bill-wave"></i><p>لا توجد مصروفات</p></div>';
        return;
    }
    let html = `<table><thead><tr><th>البيان</th><th>المبلغ</th><th>التاريخ</th><th>ملاحظات</th><th></th></tr></thead><tbody>`;
    list.forEach(e => {
        html += `<tr>
            <td><strong>${e.desc}</strong></td>
            <td>${fmtNum(e.amount)} ${currency()}</td>
            <td>${e.date}</td>
            <td>${e.notes || '-'}</td>
            <td>
                <button onclick="editExpense('${e.id}')" class="icon-btn"><i class="fas fa-edit"></i></button>
                <button onclick="deleteExpense('${e.id}')" class="icon-btn" style="color:var(--danger)"><i class="fas fa-trash"></i></button>
            </td>
        </tr>`;
    });
    html += '</tbody></table>';
    container.innerHTML = html;
}

function openExpenseForm() {
    document.getElementById('expenseFormTitle').textContent = 'مصروف جديد';
    document.getElementById('expenseEditId').value = '';
    document.getElementById('expenseDesc').value = '';
    document.getElementById('expenseAmount').value = '';
    document.getElementById('expenseDate').value = todayStr();
    document.getElementById('expenseNotes').value = '';
    document.getElementById('expenseFormModal').classList.add('open');
}

function closeExpenseForm() {
    document.getElementById('expenseFormModal').classList.remove('open');
}

function saveExpense() {
    const editId = document.getElementById('expenseEditId').value;
    const desc = document.getElementById('expenseDesc').value.trim();
    const amount = parseFloat(document.getElementById('expenseAmount').value);
    if (!desc || !amount) { alert('يرجى إدخال البيان والمبلغ'); return; }
    const data = { desc, amount, date: document.getElementById('expenseDate').value || todayStr(), notes: document.getElementById('expenseNotes').value.trim(), createdAt: nowStr() };
    const db = getDB();
    if (editId) {
        const idx = db.expenses.findIndex(e => e.id === editId);
        if (idx >= 0) db.expenses[idx] = { ...db.expenses[idx], ...data };
    } else { data.id = genId(); db.expenses.push(data); }
    saveDB(db);
    closeExpenseForm();
    renderExpenses();
    loadDashboard();
}

function editExpense(id) {
    const db = getDB();
    const exp = db.expenses.find(e => e.id === id);
    if (!exp) return;
    document.getElementById('expenseFormTitle').textContent = 'تعديل مصروف';
    document.getElementById('expenseEditId').value = id;
    document.getElementById('expenseDesc').value = exp.desc || '';
    document.getElementById('expenseAmount').value = exp.amount || '';
    document.getElementById('expenseDate').value = exp.date || todayStr();
    document.getElementById('expenseNotes').value = exp.notes || '';
    document.getElementById('expenseFormModal').classList.add('open');
}

function deleteExpense(id) {
    if (!confirm('هل أنت متأكد من الحذف؟')) return;
    const db = getDB();
    db.expenses = db.expenses.filter(e => e.id !== id);
    saveDB(db);
    renderExpenses();
    loadDashboard();
}

// ====== العروض ======
function renderOffers() {
    const db = getDB();
    const search = (document.getElementById('offersSearch').value || '').toLowerCase();
    let list = db.offers;
    if (search) list = list.filter(o => o.name.toLowerCase().includes(search));
    list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const container = document.getElementById('offersList');
    if (list.length === 0) {
        container.innerHTML = '<div class="empty-state"><i class="fas fa-tags"></i><p>لا توجد عروض</p></div>';
        return;
    }
    const now = todayStr();
    let html = `<table><thead><tr><th>اسم العرض</th><th>الخصم</th><th>تاريخ البداية</th><th>تاريخ النهاية</th><th>الحالة</th><th></th></tr></thead><tbody>`;
    list.forEach(o => {
        const active = o.start <= now && o.end >= now;
        html += `<tr>
            <td><strong>${o.name}</strong></td>
            <td>${o.discount || 0}%</td>
            <td>${o.start}</td>
            <td>${o.end}</td>
            <td><span class="badge ${active ? 'badge-success' : 'badge-danger'}">${active ? 'نشط' : 'منتهي'}</span></td>
            <td>
                <button onclick="editOffer('${o.id}')" class="icon-btn"><i class="fas fa-edit"></i></button>
                <button onclick="deleteOffer('${o.id}')" class="icon-btn" style="color:var(--danger)"><i class="fas fa-trash"></i></button>
            </td>
        </tr>`;
    });
    html += '</tbody></table>';
    container.innerHTML = html;
}

function openOfferForm() {
    document.getElementById('offerFormTitle').textContent = 'عرض جديد';
    document.getElementById('offerEditId').value = '';
    document.getElementById('offerName').value = '';
    document.getElementById('offerStart').value = todayStr();
    document.getElementById('offerEnd').value = todayStr();
    document.getElementById('offerDiscount').value = 0;
    document.getElementById('offerItems').innerHTML = '<p class="muted">اختر الأصناف من شاشة المخزون</p>';
    document.getElementById('offerFormModal').classList.add('open');
}

function closeOfferForm() {
    document.getElementById('offerFormModal').classList.remove('open');
}

function saveOffer() {
    const editId = document.getElementById('offerEditId').value;
    const name = document.getElementById('offerName').value.trim();
    if (!name) { alert('يرجى إدخال اسم العرض'); return; }
    const data = { name, start: document.getElementById('offerStart').value, end: document.getElementById('offerEnd').value, discount: parseFloat(document.getElementById('offerDiscount').value) || 0, createdAt: nowStr() };
    const db = getDB();
    if (editId) {
        const idx = db.offers.findIndex(o => o.id === editId);
        if (idx >= 0) db.offers[idx] = { ...db.offers[idx], ...data };
    } else { data.id = genId(); db.offers.push(data); }
    saveDB(db);
    closeOfferForm();
    renderOffers();
}

function editOffer(id) {
    const db = getDB();
    const offer = db.offers.find(o => o.id === id);
    if (!offer) return;
    document.getElementById('offerFormTitle').textContent = 'تعديل عرض';
    document.getElementById('offerEditId').value = id;
    document.getElementById('offerName').value = offer.name || '';
    document.getElementById('offerStart').value = offer.start || todayStr();
    document.getElementById('offerEnd').value = offer.end || todayStr();
    document.getElementById('offerDiscount').value = offer.discount || 0;
    document.getElementById('offerItems').innerHTML = '<p class="muted">اختر الأصناف من شاشة المخزون</p>';
    document.getElementById('offerFormModal').classList.add('open');
}

function deleteOffer(id) {
    if (!confirm('هل أنت متأكد من الحذف؟')) return;
    const db = getDB();
    db.offers = db.offers.filter(o => o.id !== id);
    saveDB(db);
    renderOffers();
}

// ====== الطلبيات ======
function renderOrders() {
    const db = getDB();
    const search = (document.getElementById('ordersSearch').value || '').toLowerCase();
    let list = db.orders;
    if (search) list = list.filter(o => (o.supplierName || '').toLowerCase().includes(search));
    list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const container = document.getElementById('ordersList');
    if (list.length === 0) {
        container.innerHTML = '<div class="empty-state"><i class="fas fa-clipboard-list"></i><p>لا توجد طلبيات</p></div>';
        return;
    }
    const statusMap = { pending: 'قيد الانتظار', approved: 'تم الموافقة', received: 'تم الاستلام', cancelled: 'ملغي' };
    const statusBadge = { pending: 'badge-warning', approved: 'badge-info', received: 'badge-success', cancelled: 'badge-danger' };
    let html = `<table><thead><tr><th>المورد</th><th>التاريخ</th><th>البنود</th><th>الحالة</th><th></th></tr></thead><tbody>`;
    list.forEach(o => {
        html += `<tr>
            <td><strong>${o.supplierName || '-'}</strong></td>
            <td>${o.date}</td>
            <td>${(o.items || []).length}</td>
            <td><span class="badge ${statusBadge[o.status] || 'badge-warning'}">${statusMap[o.status] || o.status}</span></td>
            <td>
                <button onclick="editOrder('${o.id}')" class="icon-btn"><i class="fas fa-edit"></i></button>
                <button onclick="deleteOrder('${o.id}')" class="icon-btn" style="color:var(--danger)"><i class="fas fa-trash"></i></button>
            </td>
        </tr>`;
    });
    html += '</tbody></table>';
    container.innerHTML = html;
}

function openOrderForm() {
    document.getElementById('orderFormTitle').textContent = 'طلبية جديدة';
    document.getElementById('orderEditId').value = '';
    document.getElementById('orderDate').value = todayStr();
    document.getElementById('orderStatus').value = 'pending';
    document.getElementById('orderItemsBody').innerHTML = '';
    const db = getDB();
    const suppSel = document.getElementById('orderSupplier');
    suppSel.innerHTML = '<option value="">-- اختر مورد --</option>' + db.suppliers.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
    const itemSel = document.getElementById('orderItemSelect');
    itemSel.innerHTML = '<option value="">-- اختر صنف --</option>' + db.items.map(it => `<option value="${it.id}">${it.name}</option>`).join('');
    document.getElementById('orderFormModal').classList.add('open');
}

function closeOrderForm() {
    document.getElementById('orderFormModal').classList.remove('open');
}

function addOrderItem() {
    const sel = document.getElementById('orderItemSelect');
    const id = sel.value;
    if (!id) { alert('اختر صنفاً'); return; }
    const db = getDB();
    const item = db.items.find(i => i.id === id);
    if (!item) return;
    const qty = parseFloat(document.getElementById('orderItemQty').value) || 1;
    const tbody = document.getElementById('orderItemsBody');
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${item.name}</td><td><input type="number" value="${qty}" min="1" style="width:70px"></td><td><button onclick="this.closest('tr').remove()" class="icon-btn" style="color:var(--danger)"><i class="fas fa-times"></i></button></td>`;
    tr.dataset.itemId = item.id;
    tr.dataset.itemName = item.name;
    tbody.appendChild(tr);
    document.getElementById('orderItemQty').value = 1;
}

function saveOrder() {
    const editId = document.getElementById('orderEditId').value;
    const supplierId = document.getElementById('orderSupplier').value;
    const date = document.getElementById('orderDate').value;
    const status = document.getElementById('orderStatus').value;
    const db = getDB();
    const supplier = db.suppliers.find(s => s.id === supplierId);
    const rows = document.querySelectorAll('#orderItemsBody tr');
    const items = [];
    rows.forEach(tr => {
        const qty = parseFloat(tr.querySelector('input[type="number"]').value) || 1;
        items.push({ itemId: tr.dataset.itemId, itemName: tr.dataset.itemName, qty });
    });
    if (items.length === 0) { alert('أضف صنفاً واحداً على الأقل'); return; }
    const data = { supplierId, supplierName: supplier ? supplier.name : '-', date, status, items, createdAt: nowStr() };
    if (editId) {
        const idx = db.orders.findIndex(o => o.id === editId);
        if (idx >= 0) db.orders[idx] = { ...db.orders[idx], ...data };
    } else { data.id = genId(); db.orders.push(data); }
    saveDB(db);
    closeOrderForm();
    renderOrders();
}

function editOrder(id) {
    const db = getDB();
    const order = db.orders.find(o => o.id === id);
    if (!order) return;
    document.getElementById('orderFormTitle').textContent = 'تعديل طلبية';
    document.getElementById('orderEditId').value = id;
    document.getElementById('orderDate').value = order.date || todayStr();
    document.getElementById('orderStatus').value = order.status || 'pending';
    const suppSel = document.getElementById('orderSupplier');
    suppSel.innerHTML = '<option value="">-- اختر مورد --</option>' + db.suppliers.map(s => `<option value="${s.id}" ${s.id === order.supplierId ? 'selected' : ''}>${s.name}</option>`).join('');
    const itemSel = document.getElementById('orderItemSelect');
    itemSel.innerHTML = '<option value="">-- اختر صنف --</option>' + db.items.map(it => `<option value="${it.id}">${it.name}</option>`).join('');
    const tbody = document.getElementById('orderItemsBody');
    tbody.innerHTML = '';
    if (order.items) order.items.forEach(it => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${it.itemName}</td><td><input type="number" value="${it.qty}" min="1" style="width:70px"></td><td><button onclick="this.closest('tr').remove()" class="icon-btn" style="color:var(--danger)"><i class="fas fa-times"></i></button></td>`;
        tr.dataset.itemId = it.itemId;
        tr.dataset.itemName = it.itemName;
        tbody.appendChild(tr);
    });
    document.getElementById('orderFormModal').classList.add('open');
}

function deleteOrder(id) {
    if (!confirm('هل أنت متأكد من الحذف؟')) return;
    const db = getDB();
    db.orders = db.orders.filter(o => o.id !== id);
    saveDB(db);
    renderOrders();
}

// ====== الدليل المحاسبي ======
function getDefaultAccounts() {
    return [
        { id: 'acc_assets', name: 'الأصول', type: 'main', parentId: null, balance: 0 },
        { id: 'acc_cash', name: 'الصندوق', type: 'sub', parentId: 'acc_assets', balance: 0 },
        { id: 'acc_bank', name: 'البنك', type: 'sub', parentId: 'acc_assets', balance: 0 },
        { id: 'acc_receivable', name: 'حسابات مدينة', type: 'sub', parentId: 'acc_assets', balance: 0 },
        { id: 'acc_inventory', name: 'المخزون', type: 'sub', parentId: 'acc_assets', balance: 0 },
        { id: 'acc_liabilities', name: 'الإلتزامات', type: 'main', parentId: null, balance: 0 },
        { id: 'acc_payable', name: 'حسابات دائنة', type: 'sub', parentId: 'acc_liabilities', balance: 0 },
        { id: 'acc_loans', name: 'قروض', type: 'sub', parentId: 'acc_liabilities', balance: 0 },
        { id: 'acc_equity', name: 'حقوق الملكية', type: 'main', parentId: null, balance: 0 },
        { id: 'acc_capital', name: 'رأس المال', type: 'sub', parentId: 'acc_equity', balance: 0 },
        { id: 'acc_retained', name: 'الأرباح المحتجزة', type: 'sub', parentId: 'acc_equity', balance: 0 },
        { id: 'acc_revenue', name: 'الإيرادات', type: 'main', parentId: null, balance: 0 },
        { id: 'acc_sales', name: 'المبيعات', type: 'sub', parentId: 'acc_revenue', balance: 0 },
        { id: 'acc_other_income', name: 'إيرادات أخرى', type: 'sub', parentId: 'acc_revenue', balance: 0 },
        { id: 'acc_expenses_main', name: 'المصروفات', type: 'main', parentId: null, balance: 0 },
        { id: 'acc_purchases', name: 'المشتريات', type: 'sub', parentId: 'acc_expenses_main', balance: 0 },
        { id: 'acc_op_expenses', name: 'مصروفات تشغيلية', type: 'sub', parentId: 'acc_expenses_main', balance: 0 }
    ];
}

function renderAccounts() {
    const db = getDB();
    if (!db.accounts || db.accounts.length === 0) {
        db.accounts = getDefaultAccounts();
        saveDB(db);
    }
    const container = document.getElementById('accountsList');
    const search = (document.getElementById('accountsSearch').value || '').toLowerCase();
    let filtered = db.accounts;
    if (search) filtered = filtered.filter(a => a.name.toLowerCase().includes(search));
    const tree = buildAccountTree(filtered);
    let html = `<div class="card-header">
        <h3>الدليل المحاسبي</h3>
        <button onclick="openAccountForm()" class="btn btn-primary btn-sm"><i class="fas fa-plus"></i> حساب جديد</button>
    </div>`;
    if (tree.length === 0) {
        html += '<div class="empty-state"><i class="fas fa-book"></i><p>لا توجد حسابات</p></div>';
    } else {
        html += `<ul class="account-tree">${renderAccountTree(tree, filtered)}</ul>`;
    }
    container.innerHTML = html;
}

function buildAccountTree(accounts) {
    const map = {};
    const roots = [];
    accounts.forEach(a => { map[a.id] = { ...a, children: [] }; });
    accounts.forEach(a => {
        if (a.parentId && map[a.parentId]) {
            map[a.parentId].children.push(map[a.id]);
        } else if (!a.parentId) {
            roots.push(map[a.id]);
        }
    });
    return roots;
}

function renderAccountTree(nodes, allAccounts) {
    let html = '';
    nodes.forEach(n => {
        const hasChildren = n.children.length > 0;
        const isMain = n.type === 'main';
        html += `<li>
            <span class="toggle-icon" onclick="toggleAccountChildren(this)">${hasChildren ? '<i class="fas fa-chevron-down"></i>' : '<i class="fas fa-circle" style="font-size:6px"></i>'}</span>
            <span class="acc-icon"><i class="fas ${isMain ? 'fa-folder-open' : 'fa-file-invoice'}"></i></span>
            <span class="acc-name" style="font-weight:${isMain ? '700' : '400'}">${n.name}</span>
            <span class="acc-balance">${fmtNum(calcAccountBalance(n.id))} ${currency()}</span>
            <button onclick="event.stopPropagation();openAccountForm('${n.id}')" class="icon-btn" title="تعديل"><i class="fas fa-edit"></i></button>
            <button onclick="event.stopPropagation();deleteAccount('${n.id}')" class="icon-btn" title="حذف" style="color:var(--danger)"><i class="fas fa-trash"></i></button>
        </li>`;
        if (hasChildren) {
            html += `<li class="children">${renderAccountTree(n.children, allAccounts)}</li>`;
        }
    });
    return html;
}

function toggleAccountChildren(el) {
    const li = el.closest('li');
    const children = li.nextElementSibling;
    if (children && children.classList.contains('children')) {
        children.classList.toggle('hidden');
        el.querySelector('i').className = children.classList.contains('hidden') ? 'fas fa-chevron-left' : 'fas fa-chevron-down';
    }
}

function calcAccountBalance(accId) {
    const db = getDB();
    let balance = 0;
    (db.journals || []).forEach(j => {
        (j.entries || []).forEach(e => {
            if (e.accountId === accId) {
                balance += (e.debit || 0) - (e.credit || 0);
            }
        });
    });
    return balance;
}

function openAccountForm(editId) {
    const db = getDB();
    document.getElementById('accountFormTitle').textContent = editId ? 'تعديل حساب' : 'حساب جديد';
    document.getElementById('accountEditId').value = editId || '';
    if (editId) {
        const acc = db.accounts.find(a => a.id === editId);
        if (acc) {
            document.getElementById('accountName').value = acc.name || '';
            document.getElementById('accountType').value = acc.type || 'sub';
            document.getElementById('accountParent').value = acc.parentId || '';
        }
    } else {
        document.getElementById('accountName').value = '';
        document.getElementById('accountType').value = 'sub';
        document.getElementById('accountParent').value = '';
    }
    const parentSel = document.getElementById('accountParent');
    parentSel.innerHTML = '<option value="">-- بدون (حساب رئيسي) --</option>' +
        db.accounts.filter(a => a.id !== editId).map(a => `<option value="${a.id}" ${a.id === (editId ? db.accounts.find(x => x.id === editId)?.parentId : '') ? 'selected' : ''}>${a.name}</option>`).join('');
    document.getElementById('accountFormModal').classList.add('open');
}

function closeAccountForm() {
    document.getElementById('accountFormModal').classList.remove('open');
}

function saveAccount() {
    const editId = document.getElementById('accountEditId').value;
    const name = document.getElementById('accountName').value.trim();
    if (!name) { alert('يرجى إدخال اسم الحساب'); return; }
    const type = document.getElementById('accountType').value;
    const parentId = document.getElementById('accountParent').value || null;
    const db = getDB();
    if (editId) {
        const idx = db.accounts.findIndex(a => a.id === editId);
        if (idx >= 0) db.accounts[idx] = { ...db.accounts[idx], name, type, parentId };
    } else {
        db.accounts.push({ id: genId(), name, type, parentId, balance: 0 });
    }
    saveDB(db);
    closeAccountForm();
    renderAccounts();
}

function deleteAccount(id) {
    const db = getDB();
    if (db.accounts.some(a => a.parentId === id)) {
        alert('لا يمكن حذف حساب رئيسي يحتوي على حسابات فرعية');
        return;
    }
    if (!confirm('هل أنت متأكد من حذف هذا الحساب؟')) return;
    db.accounts = db.accounts.filter(a => a.id !== id);
    saveDB(db);
    renderAccounts();
}

// ====== قيود يومية ======
function renderJournals() {
    const db = getDB();
    const search = (document.getElementById('journalsSearch').value || '').toLowerCase();
    let list = db.journals || [];
    if (search) list = list.filter(j => j.desc.toLowerCase().includes(search) || j.no.toLowerCase().includes(search));
    list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const container = document.getElementById('journalsList');
    if (list.length === 0) {
        container.innerHTML = '<div class="empty-state"><i class="fas fa-journal-whills"></i><p>لا توجد قيود يومية</p></div>';
        return;
    }
    let html = `<table><thead><tr><th>رقم القيد</th><th>البيان</th><th>التاريخ</th><th>مدين</th><th>دائن</th><th></th></tr></thead><tbody>`;
    list.forEach(j => {
        const totalDebit = (j.entries || []).reduce((s, e) => s + (e.debit || 0), 0);
        const totalCredit = (j.entries || []).reduce((s, e) => s + (e.credit || 0), 0);
        html += `<tr>
            <td><strong>${j.no}</strong></td>
            <td>${j.desc}</td>
            <td>${j.date}</td>
            <td>${fmtNum(totalDebit)} ${currency()}</td>
            <td>${fmtNum(totalCredit)} ${currency()}</td>
            <td>
                <button onclick="viewJournal('${j.id}')" class="icon-btn"><i class="fas fa-eye"></i></button>
                <button onclick="deleteJournal('${j.id}')" class="icon-btn" style="color:var(--danger)"><i class="fas fa-trash"></i></button>
            </td>
        </tr>`;
    });
    html += '</tbody></table>';
    container.innerHTML = html;
}

function openJournalForm() {
    const db = getDB();
    document.getElementById('journalFormTitle').textContent = 'قيد يومي جديد';
    document.getElementById('journalEditId').value = '';
    document.getElementById('journalNo').value = 'JRN-' + String((db.journals || []).length + 1).padStart(4, '0');
    document.getElementById('journalDate').value = todayStr();
    document.getElementById('journalDesc').value = '';
    document.getElementById('journalEntries').innerHTML = '';
    addJournalEntryRow();
    calcJournalTotal();
    document.getElementById('journalFormModal').classList.add('open');
}

function closeJournalForm() {
    document.getElementById('journalFormModal').classList.remove('open');
}

function addJournalEntryRow(data) {
    const db = getDB();
    const container = document.getElementById('journalEntries');
    const div = document.createElement('div');
    div.className = 'journal-entry-row';
    const accOpts = '<option value="">-- اختر حساب --</option>' +
        db.accounts.map(a => `<option value="${a.id}" ${data && data.accountId === a.id ? 'selected' : ''}>${a.name}</option>`).join('');
    div.innerHTML = `
        <select onchange="calcJournalTotal()">${accOpts}</select>
        <input type="number" placeholder="مدين" min="0" step="0.01" value="${data ? (data.debit || '') : ''}" oninput="calcJournalTotal()">
        <input type="number" placeholder="دائن" min="0" step="0.01" value="${data ? (data.credit || '') : ''}" oninput="calcJournalTotal()">
        <input type="text" placeholder="ملاحظة" style="width:100px;font-size:0.85rem" value="${data ? (data.notes || '') : ''}">
        <button onclick="this.closest('.journal-entry-row').remove();calcJournalTotal()" class="icon-btn" style="color:var(--danger)"><i class="fas fa-times"></i></button>
    `;
    container.appendChild(div);
}

function calcJournalTotal() {
    const rows = document.querySelectorAll('#journalEntries .journal-entry-row');
    let totalDebit = 0, totalCredit = 0;
    rows.forEach(r => {
        const inputs = r.querySelectorAll('input[type="number"]');
        totalDebit += parseFloat(inputs[0].value) || 0;
        totalCredit += parseFloat(inputs[1].value) || 0;
    });
    document.getElementById('journalDebitTotal').textContent = fmtNum(totalDebit);
    document.getElementById('journalCreditTotal').textContent = fmtNum(totalCredit);
    const diff = totalDebit - totalCredit;
    const balanceEl = document.getElementById('journalBalance');
    if (Math.abs(diff) < 0.01) {
        balanceEl.innerHTML = '<span class="badge badge-success">متزن</span>';
    } else {
        balanceEl.innerHTML = `<span class="badge badge-danger">غير متزن (الفارق: ${fmtNum(diff)} ${currency()})</span>`;
    }
    return { totalDebit, totalCredit };
}

function saveJournal() {
    const editId = document.getElementById('journalEditId').value;
    const no = document.getElementById('journalNo').value;
    const date = document.getElementById('journalDate').value;
    const desc = document.getElementById('journalDesc').value.trim();
    if (!desc) { alert('يرجى إدخال بيان القيد'); return; }
    const rows = document.querySelectorAll('#journalEntries .journal-entry-row');
    const entries = [];
    rows.forEach(r => {
        const sel = r.querySelector('select');
        const inputs = r.querySelectorAll('input[type="number"]');
        const notesInput = r.querySelector('input[type="text"]');
        const accountId = sel.value;
        const debit = parseFloat(inputs[0].value) || 0;
        const credit = parseFloat(inputs[1].value) || 0;
        const notes = notesInput ? notesInput.value : '';
        if (accountId && (debit > 0 || credit > 0)) {
            const acc = getDB().accounts.find(a => a.id === accountId);
            entries.push({ accountId, accountName: acc ? acc.name : '-', debit, credit, notes });
        }
    });
    if (entries.length === 0) { alert('أضف قيداً واحداً على الأقل'); return; }
    const { totalDebit, totalCredit } = calcJournalTotal();
    if (Math.abs(totalDebit - totalCredit) >= 0.01) { alert('القيد غير متزن. يجب أن يتساوى مجموع المدين والدائن'); return; }
    const db = getDB();
    const data = { no, date, desc, entries, createdAt: nowStr() };
    if (editId) {
        const idx = (db.journals || []).findIndex(j => j.id === editId);
        if (idx >= 0) db.journals[idx] = { ...db.journals[idx], ...data };
    } else {
        data.id = genId();
        if (!db.journals) db.journals = [];
        db.journals.push(data);
    }
    saveDB(db);
    closeJournalForm();
    renderJournals();
}

function viewJournal(id) {
    const db = getDB();
    const journal = (db.journals || []).find(j => j.id === id);
    if (!journal) return;
    document.getElementById('journalFormTitle').textContent = 'عرض قيد رقم ' + journal.no;
    document.getElementById('journalEditId').value = id;
    document.getElementById('journalNo').value = journal.no;
    document.getElementById('journalDate').value = journal.date;
    document.getElementById('journalDesc').value = journal.desc;
    document.getElementById('journalEntries').innerHTML = '';
    (journal.entries || []).forEach(e => addJournalEntryRow(e));
    calcJournalTotal();
    document.getElementById('journalFormModal').classList.add('open');
}

function deleteJournal(id) {
    if (!confirm('هل أنت متأكد من حذف القيد؟')) return;
    const db = getDB();
    db.journals = (db.journals || []).filter(j => j.id !== id);
    saveDB(db);
    renderJournals();
}

// ====== سندات قبض/صرف ======
function renderVouchers() {
    const db = getDB();
    const search = (document.getElementById('vouchersSearch').value || '').toLowerCase();
    let list = db.vouchers || [];
    if (search) list = list.filter(v => v.desc.toLowerCase().includes(search) || v.no.toLowerCase().includes(search));
    list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const container = document.getElementById('vouchersList');
    if (list.length === 0) {
        container.innerHTML = '<div class="empty-state"><i class="fas fa-file-alt"></i><p>لا توجد سندات</p></div>';
        return;
    }
    let html = `<table><thead><tr><th>رقم السند</th><th>النوع</th><th>البيان</th><th>المبلغ</th><th>التاريخ</th><th></th></tr></thead><tbody>`;
    list.forEach(v => {
        const isReceipt = v.type === 'receipt';
        html += `<tr>
            <td><strong>${v.no}</strong></td>
            <td><span class="badge ${isReceipt ? 'badge-success' : 'badge-danger'}">${isReceipt ? 'قبض' : 'صرف'}</span></td>
            <td>${v.desc}</td>
            <td class="${isReceipt ? 'text-success' : 'text-danger'}"><strong>${fmtNum(v.amount)} ${currency()}</strong></td>
            <td>${v.date}</td>
            <td>
                <button onclick="editVoucher('${v.id}')" class="icon-btn" style="color:var(--primary)"><i class="fas fa-edit"></i></button>
                <button onclick="deleteVoucher('${v.id}')" class="icon-btn" style="color:var(--danger)"><i class="fas fa-trash"></i></button>
            </td>
        </tr>`;
    });
    html += '</tbody></table>';
    container.innerHTML = html;
}

function openVoucherForm() {
    const db = getDB();
    document.getElementById('voucherFormTitle').textContent = 'سند جديد';
    document.getElementById('voucherEditId').value = '';
    document.getElementById('voucherNo').value = 'VCH-' + String((db.vouchers || []).length + 1).padStart(4, '0');
    document.getElementById('voucherDate').value = todayStr();
    document.getElementById('voucherType').value = 'receipt';
    document.getElementById('voucherDesc').value = '';
    document.getElementById('voucherAmount').value = '';
    document.getElementById('voucherPartyName').value = '';
    const accSel = document.getElementById('voucherAccount');
    accSel.innerHTML = '<option value="">-- اختر حساب --</option>' +
        db.accounts.map(a => `<option value="${a.id}">${a.name}</option>`).join('');
    document.getElementById('voucherFormModal').classList.add('open');
}

function closeVoucherForm() {
    document.getElementById('voucherFormModal').classList.remove('open');
}

function saveVoucher() {
    const editId = document.getElementById('voucherEditId').value;
    const no = document.getElementById('voucherNo').value;
    const date = document.getElementById('voucherDate').value;
    const type = document.getElementById('voucherType').value;
    const desc = document.getElementById('voucherDesc').value.trim();
    const amount = parseFloat(document.getElementById('voucherAmount').value);
    const partyName = document.getElementById('voucherPartyName').value.trim();
    const accountId = document.getElementById('voucherAccount').value;
    if (!desc || !amount) { alert('يرجى إدخال البيان والمبلغ'); return; }
    const db = getDB();
    const account = db.accounts.find(a => a.id === accountId);
    const data = { no, date, type, desc, amount, partyName, accountId: accountId || '', accountName: account ? account.name : '', createdAt: nowStr() };
    if (editId) {
        const idx = (db.vouchers || []).findIndex(v => v.id === editId);
        if (idx >= 0) db.vouchers[idx] = { ...db.vouchers[idx], ...data };
    } else {
        data.id = genId();
        if (!db.vouchers) db.vouchers = [];
        db.vouchers.push(data);
    }
    saveDB(db);
    closeVoucherForm();
    renderVouchers();
}

function deleteVoucher(id) {
    if (!confirm('هل أنت متأكد من حذف السند؟')) return;
    const db = getDB();
    db.vouchers = (db.vouchers || []).filter(v => v.id !== id);
    saveDB(db);
    renderVouchers();
}

function editVoucher(id) {
    const db = getDB();
    const v = (db.vouchers || []).find(v => v.id === id);
    if (!v) return;
    document.getElementById('voucherFormTitle').textContent = 'تعديل السند';
    document.getElementById('voucherEditId').value = v.id;
    document.getElementById('voucherNo').value = v.no;
    document.getElementById('voucherDate').value = v.date;
    document.getElementById('voucherType').value = v.type;
    document.getElementById('voucherDesc').value = v.desc;
    document.getElementById('voucherAmount').value = v.amount;
    document.getElementById('voucherPartyName').value = v.partyName || '';
    const accSel = document.getElementById('voucherAccount');
    accSel.innerHTML = '<option value="">-- اختر حساب --</option>' +
        db.accounts.map(a => `<option value="${a.id}" ${a.id === v.accountId ? 'selected' : ''}>${a.name}</option>`).join('');
    document.getElementById('voucherFormModal').classList.add('open');
}

// ====== العملات ======
function renderCurrencies() {
    const db = getDB();
    let list = db.currencies || [];
    const container = document.getElementById('currenciesList');
    if (list.length === 0) {
        const defaultCurrencies = [
            { id: 'cur_usd', name: 'دولار أمريكي', code: 'USD', symbol: '$', rate: 3.75 },
            { id: 'cur_eur', name: 'يورو', code: 'EUR', symbol: '€', rate: 4.05 },
            { id: 'cur_egp', name: 'جنيه مصري', code: 'EGP', symbol: 'ج.م', rate: 0.12 }
        ];
        db.currencies = defaultCurrencies;
        saveDB(db);
        list = defaultCurrencies;
    }
    let html = `<table><thead><tr><th>الاسم</th><th>الرمز</th><th>سعر الصرف</th><th>القيمة بالعملة المحلية</th><th></th></tr></thead><tbody>`;
    list.forEach(c => {
        html += `<tr>
            <td><strong>${c.name}</strong></td>
            <td>${c.symbol || c.code}</td>
            <td>${fmtNum(c.rate)}</td>
            <td>${c.rate ? fmtNum(1 / c.rate) : '-'} ${currency()}</td>
            <td>
                <button onclick="editCurrency('${c.id}')" class="icon-btn"><i class="fas fa-edit"></i></button>
                <button onclick="deleteCurrency('${c.id}')" class="icon-btn" style="color:var(--danger)"><i class="fas fa-trash"></i></button>
            </td>
        </tr>`;
    });
    html += '</tbody></table>';
    container.innerHTML = html;
}

function openCurrencyForm() {
    document.getElementById('currencyFormTitle').textContent = 'عملة جديدة';
    document.getElementById('currencyEditId').value = '';
    document.getElementById('currencyName').value = '';
    document.getElementById('currencyCode').value = '';
    document.getElementById('currencySymbol').value = '';
    document.getElementById('currencyRate').value = '';
    document.getElementById('currencyFormModal').classList.add('open');
}

function closeCurrencyForm() {
    document.getElementById('currencyFormModal').classList.remove('open');
}

function saveCurrency() {
    const editId = document.getElementById('currencyEditId').value;
    const name = document.getElementById('currencyName').value.trim();
    const code = document.getElementById('currencyCode').value.trim().toUpperCase();
    const symbol = document.getElementById('currencySymbol').value.trim();
    const rate = parseFloat(document.getElementById('currencyRate').value);
    if (!name || !code || !rate) { alert('يرجى إدخال جميع البيانات'); return; }
    const db = getDB();
    if (editId) {
        const idx = (db.currencies || []).findIndex(c => c.id === editId);
        if (idx >= 0) db.currencies[idx] = { ...db.currencies[idx], name, code, symbol, rate };
    } else {
        if (!db.currencies) db.currencies = [];
        db.currencies.push({ id: genId(), name, code, symbol, rate });
    }
    saveDB(db);
    closeCurrencyForm();
    renderCurrencies();
}

function editCurrency(id) {
    const db = getDB();
    const cur = (db.currencies || []).find(c => c.id === id);
    if (!cur) return;
    document.getElementById('currencyFormTitle').textContent = 'تعديل عملة';
    document.getElementById('currencyEditId').value = id;
    document.getElementById('currencyName').value = cur.name || '';
    document.getElementById('currencyCode').value = cur.code || '';
    document.getElementById('currencySymbol').value = cur.symbol || '';
    document.getElementById('currencyRate').value = cur.rate || '';
    document.getElementById('currencyFormModal').classList.add('open');
}

function deleteCurrency(id) {
    if (!confirm('هل أنت متأكد من حذف العملة؟')) return;
    const db = getDB();
    db.currencies = (db.currencies || []).filter(c => c.id !== id);
    saveDB(db);
    renderCurrencies();
}

// ====== المخازن ======
function renderBranches() {
    const db = getDB();
    let list = db.branches || [];
    const container = document.getElementById('branchesList');
    if (list.length === 0) {
        container.innerHTML = '<div class="empty-state"><i class="fas fa-warehouse"></i><p>لا توجد مخازن</p></div>';
        return;
    }
    let html = `<table><thead><tr><th>اسم المخزن</th><th>العنوان</th><th>الهاتف</th><th>عدد الأصناف</th><th></th></tr></thead><tbody>`;
    list.forEach(b => {
        html += `<tr>
            <td><strong>${b.name}</strong></td>
            <td>${b.address || '-'}</td>
            <td>${b.phone || '-'}</td>
            <td>${b.itemCount || 0}</td>
            <td>
                <button onclick="editBranch('${b.id}')" class="icon-btn"><i class="fas fa-edit"></i></button>
                <button onclick="deleteBranch('${b.id}')" class="icon-btn" style="color:var(--danger)"><i class="fas fa-trash"></i></button>
            </td>
        </tr>`;
    });
    html += '</tbody></table>';
    container.innerHTML = html;
}

function openBranchForm() {
    document.getElementById('branchFormTitle').textContent = 'مخزن جديد';
    document.getElementById('branchEditId').value = '';
    document.getElementById('branchName').value = '';
    document.getElementById('branchAddress').value = '';
    document.getElementById('branchPhone').value = '';
    document.getElementById('branchFormModal').classList.add('open');
}

function closeBranchForm() {
    document.getElementById('branchFormModal').classList.remove('open');
}

function saveBranch() {
    const editId = document.getElementById('branchEditId').value;
    const name = document.getElementById('branchName').value.trim();
    if (!name) { alert('يرجى إدخال اسم المخزن'); return; }
    const data = { name, address: document.getElementById('branchAddress').value.trim(), phone: document.getElementById('branchPhone').value.trim(), itemCount: 0 };
    const db = getDB();
    if (editId) {
        const idx = (db.branches || []).findIndex(b => b.id === editId);
        if (idx >= 0) db.branches[idx] = { ...db.branches[idx], ...data };
    } else {
        data.id = genId();
        if (!db.branches) db.branches = [];
        db.branches.push(data);
    }
    saveDB(db);
    closeBranchForm();
    renderBranches();
}

function editBranch(id) {
    const db = getDB();
    const branch = (db.branches || []).find(b => b.id === id);
    if (!branch) return;
    document.getElementById('branchFormTitle').textContent = 'تعديل مخزن';
    document.getElementById('branchEditId').value = id;
    document.getElementById('branchName').value = branch.name || '';
    document.getElementById('branchAddress').value = branch.address || '';
    document.getElementById('branchPhone').value = branch.phone || '';
    document.getElementById('branchFormModal').classList.add('open');
}

function deleteBranch(id) {
    if (!confirm('هل أنت متأكد من حذف المخزن؟')) return;
    const db = getDB();
    db.branches = (db.branches || []).filter(b => b.id !== id);
    saveDB(db);
    renderBranches();
}

// ====== التسويات المخزنية ======
function renderAdjustments() {
    const db = getDB();
    let list = db.adjustments || [];
    list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const container = document.getElementById('adjustmentsList');
    if (list.length === 0) {
        container.innerHTML = '<div class="empty-state"><i class="fas fa-balance-scale"></i><p>لا توجد تسويات مخزنية</p></div>';
        return;
    }
    let html = `<table><thead><tr><th>رقم العملية</th><th>الصنف</th><th>الكمية قبل</th><th>الكمية بعد</th><th>الفرق</th><th>السبب</th><th>التاريخ</th><th></th></tr></thead><tbody>`;
    list.forEach(a => {
        const diff = a.newQty - a.oldQty;
        const isIncrease = diff >= 0;
        html += `<tr>
            <td><strong>${a.no}</strong></td>
            <td><strong>${a.itemName}</strong></td>
            <td>${a.oldQty}</td>
            <td>${a.newQty}</td>
            <td class="${isIncrease ? 'text-success' : 'text-danger'}">${isIncrease ? '+' : ''}${diff}</td>
            <td>${a.reason || '-'}</td>
            <td>${a.date}</td>
            <td>
                <button onclick="deleteAdjustment('${a.id}')" class="icon-btn" style="color:var(--danger)"><i class="fas fa-trash"></i></button>
            </td>
        </tr>`;
    });
    html += '</tbody></table>';
    container.innerHTML = html;
}

function openAdjustmentForm() {
    const db = getDB();
    document.getElementById('adjFormTitle').textContent = 'تسوية مخزنية';
    document.getElementById('adjEditId').value = '';
    document.getElementById('adjNo').value = 'ADJ-' + String((db.adjustments || []).length + 1).padStart(4, '0');
    document.getElementById('adjDate').value = todayStr();
    document.getElementById('adjReason').value = '';
    const itemSel = document.getElementById('adjItem');
    itemSel.innerHTML = '<option value="">-- اختر صنف --</option>' +
        db.items.map(i => `<option value="${i.id}">${i.name} (الكمية: ${i.qty || 0})</option>`).join('');
    itemSel.onchange = function() {
        const item = db.items.find(i => i.id === this.value);
        if (item) {
            document.getElementById('adjOldQty').value = item.qty || 0;
            document.getElementById('adjNewQty').value = item.qty || 0;
        }
    };
    document.getElementById('adjOldQty').value = 0;
    document.getElementById('adjNewQty').value = 0;
    document.getElementById('adjFormModal').classList.add('open');
}

function closeAdjustmentForm() {
    document.getElementById('adjFormModal').classList.remove('open');
}

function saveAdjustment() {
    const editId = document.getElementById('adjEditId').value;
    const no = document.getElementById('adjNo').value;
    const date = document.getElementById('adjDate').value;
    const itemId = document.getElementById('adjItem').value;
    const oldQty = parseFloat(document.getElementById('adjOldQty').value) || 0;
    const newQty = parseFloat(document.getElementById('adjNewQty').value) || 0;
    const reason = document.getElementById('adjReason').value.trim();
    if (!itemId) { alert('اختر صنفاً'); return; }
    const db = getDB();
    const item = db.items.find(i => i.id === itemId);
    if (!item) return;
    const data = { no, date, itemId, itemName: item.name, oldQty, newQty, reason, createdAt: nowStr() };
    if (editId) {
        const idx = (db.adjustments || []).findIndex(a => a.id === editId);
        if (idx >= 0) db.adjustments[idx] = { ...db.adjustments[idx], ...data };
    } else {
        data.id = genId();
        if (!db.adjustments) db.adjustments = [];
        db.adjustments.push(data);
        item.qty = newQty;
    }
    saveDB(db);
    closeAdjustmentForm();
    renderAdjustments();
    renderInventory();
}

function deleteAdjustment(id) {
    if (!confirm('هل أنت متأكد من حذف التسوية؟')) return;
    const db = getDB();
    db.adjustments = (db.adjustments || []).filter(a => a.id !== id);
    saveDB(db);
    renderAdjustments();
}

// ====== التقارير ======
function showReportType(type) {
    if (type === 'inventory') {
        showScreen('inventoryBalance');
        renderInventoryBalance();
        return;
    }
    generateReport(type);
}

function hideReportResult() {
    document.getElementById('reportResult').style.display = 'none';
}

function generateReport(type) {
    const db = getDB();
    const resultDiv = document.getElementById('reportResult');
    const titleEl = document.getElementById('reportTitle');
    const contentEl = document.getElementById('reportContent');
    resultDiv.style.display = 'block';
    let title = '', html = '';
    let total = 0;
    const curr = currency();
    switch (type) {
        case 'profit_loss': {
            title = 'تقرير الأرباح والخسائر';
            const totalSales = db.bills.filter(b => b.type === 'sale').reduce((s, b) => s + (b.total || 0), 0);
            const totalPurchases = db.bills.filter(b => b.type === 'purchase').reduce((s, b) => s + (b.total || 0), 0);
            const totalExpenses = db.expenses.reduce((s, e) => s + (e.amount || 0), 0);
            const profit = totalSales - totalPurchases - totalExpenses;
            total = profit;
            html += `<div class="bills-table-row"><span class="col-name">إجمالي المبيعات</span><span class="col-amount">${fmtNum(totalSales)} ${curr}</span></div>`;
            html += `<div class="bills-table-row"><span class="col-name">إجمالي المشتريات</span><span class="col-amount">${fmtNum(totalPurchases)} ${curr}</span></div>`;
            html += `<div class="bills-table-row"><span class="col-name">إجمالي المصروفات</span><span class="col-amount">${fmtNum(totalExpenses)} ${curr}</span></div>`;
            html += `<div class="bills-table-row" style="font-weight:bold;background:var(--gray-100)"><span class="col-name">صافي الأرباح / الخسائر</span><span class="col-amount" style="color:${profit >= 0 ? 'var(--success)' : 'var(--danger)'}">${fmtNum(profit)} ${curr}</span></div>`;
            break;
        }
        case 'inventory': {
            title = 'أرصدة المخزون';
            total = db.items.reduce((s, i) => s + ((i.qty || 0) * (i.price || 0)), 0);
            html += `<div class="bills-table-header"><span class="col-name">الصنف</span><span class="col-num">الكمية</span><span class="col-amount">القيمة</span></div>`;
            db.items.forEach(i => {
                html += `<div class="bills-table-row"><span class="col-name">${i.name}</span><span class="col-num">${i.qty || 0}</span><span class="col-amount">${fmtNum((i.qty || 0) * (i.price || 0))} ${curr}</span></div>`;
            });
            break;
        }
        case 'customer_balance': {
            title = 'أرصدة العملاء';
            html += `<div class="bills-table-header"><span class="col-name">العميل</span><span class="col-num">الهاتف</span><span class="col-amount">المبيعات</span></div>`;
            db.customers.forEach(c => {
                const t = db.bills.filter(b => b.partyId === c.id && b.type === 'sale').reduce((s, b) => s + (b.total || 0), 0);
                total += t;
                html += `<div class="bills-table-row"><span class="col-name">${c.name}</span><span class="col-num">${c.phone || '-'}</span><span class="col-amount">${fmtNum(t)} ${curr}</span></div>`;
            });
            break;
        }
        case 'supplier_balance': {
            title = 'أرصدة الموردين';
            html += `<div class="bills-table-header"><span class="col-name">المورد</span><span class="col-num">الهاتف</span><span class="col-amount">المشتريات</span></div>`;
            db.suppliers.forEach(s => {
                const t = db.bills.filter(b => b.partyId === s.id && b.type === 'purchase').reduce((sum, b) => sum + (b.total || 0), 0);
                total += t;
                html += `<div class="bills-table-row"><span class="col-name">${s.name}</span><span class="col-num">${s.phone || '-'}</span><span class="col-amount">${fmtNum(t)} ${curr}</span></div>`;
            });
            break;
        }
        case 'trial_balance': {
            title = 'ميزان المراجعة';
            const accounts = db.accounts || [];
            let totalDebit = 0, totalCredit = 0;
            html += `<div class="bills-table-header"><span class="col-name">الحساب</span><span class="col-amount">مدين</span><span class="col-amount">دائن</span></div>`;
            accounts.forEach(a => {
                const balance = calcAccountBalance(a.id);
                if (Math.abs(balance) > 0.01) {
                    if (balance > 0) { totalDebit += balance; html += `<div class="bills-table-row"><span class="col-name">${a.name}</span><span class="col-amount">${fmtNum(balance)} ${curr}</span><span class="col-amount">-</span></div>`; }
                    else { totalCredit += Math.abs(balance); html += `<div class="bills-table-row"><span class="col-name">${a.name}</span><span class="col-amount">-</span><span class="col-amount">${fmtNum(Math.abs(balance))} ${curr}</span></div>`; }
                }
            });
            total = totalDebit;
            break;
        }
        case 'journal': {
            title = 'دفتر الأستاذ';
            const journals = db.journals || [];
            html += `<div class="bills-table-header"><span class="col-num">رقم</span><span class="col-date">التاريخ</span><span class="col-name">البيان</span><span class="col-amount">مدين</span><span class="col-amount">دائن</span></div>`;
            journals.sort((a, b) => (a.date || '').localeCompare(b.date || '')).forEach(j => {
                (j.entries || []).forEach(e => {
                    html += `<div class="bills-table-row"><span class="col-num">${j.no}</span><span class="col-date">${j.date}</span><span class="col-name">${e.accountName || '-'}</span><span class="col-amount">${e.debit ? fmtNum(e.debit) : '-'}</span><span class="col-amount">${e.credit ? fmtNum(e.credit) : '-'}</span></div>`;
                });
            });
            break;
        }
        case 'expenses': {
            title = 'تقرير المصروفات';
            total = db.expenses.reduce((s, e) => s + (e.amount || 0), 0);
            html += `<div class="bills-table-header"><span class="col-name">البيان</span><span class="col-date">التاريخ</span><span class="col-amount">المبلغ</span></div>`;
            db.expenses.sort((a, b) => (b.date || '').localeCompare(a.date || '')).forEach(e => {
                html += `<div class="bills-table-row"><span class="col-name">${e.desc}</span><span class="col-date">${e.date}</span><span class="col-amount">${fmtNum(e.amount)} ${curr}</span></div>`;
            });
            break;
        }
        case 'sales': {
            title = 'تقرير المبيعات';
            const sales = db.bills.filter(b => b.type === 'sale');
            total = sales.reduce((s, b) => s + (b.total || 0), 0);
            html += `<div class="bills-table-header"><span class="col-num">رقم</span><span class="col-date">التاريخ</span><span class="col-name">العميل</span><span class="col-amount">الإجمالي</span></div>`;
            sales.sort((a, b) => (b.date || '').localeCompare(a.date || '')).forEach(b => {
                html += `<div class="bills-table-row"><span class="col-num">${b.no}</span><span class="col-date">${b.date}</span><span class="col-name">${b.partyName || '-'}</span><span class="col-amount">${fmtNum(b.total)} ${curr}</span></div>`;
            });
            break;
        }
        case 'purchases': {
            title = 'تقرير المشتريات';
            const purchases = db.bills.filter(b => b.type === 'purchase');
            total = purchases.reduce((s, b) => s + (b.total || 0), 0);
            html += `<div class="bills-table-header"><span class="col-num">رقم</span><span class="col-date">التاريخ</span><span class="col-name">المورد</span><span class="col-amount">الإجمالي</span></div>`;
            purchases.sort((a, b) => (b.date || '').localeCompare(a.date || '')).forEach(b => {
                html += `<div class="bills-table-row"><span class="col-num">${b.no}</span><span class="col-date">${b.date}</span><span class="col-name">${b.partyName || '-'}</span><span class="col-amount">${fmtNum(b.total)} ${curr}</span></div>`;
            });
            break;
        }
        case 'daily_sales': {
            title = 'تقرير يومي';
            const today = todayStr();
            const dailySales = db.bills.filter(b => b.type === 'sale' && b.date === today);
            total = dailySales.reduce((s, b) => s + (b.total || 0), 0);
            html += `<div style="padding:0.5rem 1rem;background:var(--gray-100);border-radius:8px;margin-bottom:0.8rem;text-align:center;">التاريخ: ${today}</div>`;
            html += `<div class="bills-table-header"><span class="col-num">رقم</span><span class="col-name">العميل</span><span class="col-amount">الإجمالي</span></div>`;
            dailySales.forEach(b => {
                html += `<div class="bills-table-row"><span class="col-num">${b.no}</span><span class="col-name">${b.partyName || '-'}</span><span class="col-amount">${fmtNum(b.total)} ${curr}</span></div>`;
            });
            if (dailySales.length === 0) html += '<p class="muted" style="text-align:center;padding:2rem;">لا توجد مبيعات اليوم</p>';
            break;
        }
        case 'monthly_sales': {
            title = 'المبيعات الشهرية';
            const monthlyMap = {};
            db.bills.filter(b => b.type === 'sale').forEach(b => {
                const month = (b.date || '').substring(0, 7);
                if (month) { monthlyMap[month] = (monthlyMap[month] || 0) + (b.total || 0); }
            });
            const months = Object.keys(monthlyMap).sort().reverse();
            total = Object.values(monthlyMap).reduce((a, b) => a + b, 0);
            html += `<div class="bills-table-header"><span class="col-name">الشهر</span><span class="col-amount">الإجمالي</span></div>`;
            months.forEach(m => {
                html += `<div class="bills-table-row"><span class="col-name">${m}</span><span class="col-amount">${fmtNum(monthlyMap[m])} ${curr}</span></div>`;
            });
            if (months.length === 0) html += '<p class="muted" style="text-align:center;padding:2rem;">لا توجد بيانات مبيعات</p>';
            break;
        }
        case 'monthly_purchases': {
            title = 'المشتريات الشهرية';
            const monthlyPMap = {};
            db.bills.filter(b => b.type === 'purchase').forEach(b => {
                const month = (b.date || '').substring(0, 7);
                if (month) { monthlyPMap[month] = (monthlyPMap[month] || 0) + (b.total || 0); }
            });
            const pMonths = Object.keys(monthlyPMap).sort().reverse();
            total = Object.values(monthlyPMap).reduce((a, b) => a + b, 0);
            html += `<div class="bills-table-header"><span class="col-name">الشهر</span><span class="col-amount">الإجمالي</span></div>`;
            pMonths.forEach(m => {
                html += `<div class="bills-table-row"><span class="col-name">${m}</span><span class="col-amount">${fmtNum(monthlyPMap[m])} ${curr}</span></div>`;
            });
            if (pMonths.length === 0) html += '<p class="muted" style="text-align:center;padding:2rem;">لا توجد بيانات مشتريات</p>';
            break;
        }
        case 'item_profits': {
            title = 'أرباح الأصناف';
            const itemProfits = {};
            db.bills.filter(b => b.type === 'sale').forEach(b => {
                (b.items || []).forEach(bi => {
                    if (!itemProfits[bi.itemId]) itemProfits[bi.itemId] = { name: bi.name, sold: 0, revenue: 0, cost: 0 };
                    itemProfits[bi.itemId].sold += (bi.qty || 0);
                    itemProfits[bi.itemId].revenue += (bi.total || 0);
                });
            });
            (db.items || []).forEach(i => {
                if (itemProfits[i.id]) { itemProfits[i.id].cost = itemProfits[i.id].sold * (i.cost || 0); }
            });
            html += `<div class="bills-table-header"><span class="col-name">الصنف</span><span class="col-num">الكمية</span><span class="col-amount">الإيراد</span><span class="col-amount">التكلفة</span><span class="col-amount">الربح</span></div>`;
            Object.values(itemProfits).forEach(p => {
                const profit = p.revenue - p.cost;
                total += profit;
                html += `<div class="bills-table-row"><span class="col-name">${p.name}</span><span class="col-num">${p.sold}</span><span class="col-amount">${fmtNum(p.revenue)}</span><span class="col-amount">${fmtNum(p.cost)}</span><span class="col-amount" style="color:${profit >= 0 ? 'var(--success)' : 'var(--danger)'}">${fmtNum(profit)}</span></div>`;
            });
            if (Object.keys(itemProfits).length === 0) html += '<p class="muted" style="text-align:center;padding:2rem;">لا توجد بيانات أرباح</p>';
            break;
        }
        case 'item_movement': {
            title = 'حركة الأصناف';
            const itemMovements = {};
            (db.items || []).forEach(i => { itemMovements[i.id] = { name: i.name, sold: 0, purchased: 0 }; });
            db.bills.filter(b => b.type === 'sale').forEach(b => {
                (b.items || []).forEach(bi => {
                    if (itemMovements[bi.itemId]) itemMovements[bi.itemId].sold += (bi.qty || 0);
                });
            });
            db.bills.filter(b => b.type === 'purchase').forEach(b => {
                (b.items || []).forEach(bi => {
                    if (itemMovements[bi.itemId]) itemMovements[bi.itemId].purchased += (bi.qty || 0);
                });
            });
            html += `<div class="bills-table-header"><span class="col-name">الصنف</span><span class="col-num">المشتري</span><span class="col-num">المباع</span><span class="col-num">المتبقي</span></div>`;
            Object.values(itemMovements).forEach(m => {
                html += `<div class="bills-table-row"><span class="col-name">${m.name}</span><span class="col-num">${m.purchased}</span><span class="col-num">${m.sold}</span><span class="col-num">${m.purchased - m.sold}</span></div>`;
            });
            if (Object.keys(itemMovements).length === 0) html += '<p class="muted" style="text-align:center;padding:2rem;">لا توجد بيانات حركة أصناف</p>';
            break;
        }
        case 'low_stock': {
            title = 'تنبيه نفاد المخزون';
            const lowStock = (db.items || []).filter(i => (i.qty || 0) < 5);
            html += `<div class="bills-table-header"><span class="col-name">الصنف</span><span class="col-num">الكمية المتبقية</span><span class="col-amount">السعر</span></div>`;
            lowStock.forEach(i => {
                html += `<div class="bills-table-row" style="${(i.qty || 0) === 0 ? 'background:rgba(244,67,54,0.08);' : ''}"><span class="col-name">${i.name}</span><span class="col-num" style="color:${(i.qty || 0) === 0 ? 'var(--danger)' : 'var(--warning)'}">${i.qty || 0}</span><span class="col-amount">${fmtNum(i.price || 0)} ${curr}</span></div>`;
            });
            if (lowStock.length === 0) html += '<p class="muted" style="text-align:center;padding:2rem;">جميع الأصناف متوفرة</p>';
            break;
        }
        case 'accounts': {
            title = 'أرصدة الحسابات';
            const accounts = db.accounts || [];
            html += `<div class="bills-table-header"><span class="col-name">الحساب</span><span class="col-amount">الرصيد</span></div>`;
            accounts.forEach(a => {
                const balance = calcAccountBalance(a.id);
                if (Math.abs(balance) > 0.01) {
                    total += Math.abs(balance);
                    html += `<div class="bills-table-row"><span class="col-name">${a.name}</span><span class="col-amount" style="color:${balance >= 0 ? 'var(--success)' : 'var(--danger)'}">${fmtNum(balance)} ${curr}</span></div>`;
                }
            });
            break;
        }
    }
    titleEl.textContent = title;
    contentEl.innerHTML = html;
    document.getElementById('reportTotalAmount').textContent = fmtNum(total);
}

function printReport() {
    window.print();
}

// ====== إدارة البيانات ======
function exportData() {
    const db = getDB();
    const blob = new Blob([JSON.stringify(db, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'mohaseb_soft_backup_' + todayStr() + '.json';
    a.click();
    URL.revokeObjectURL(url);
}

function importData(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = JSON.parse(e.target.result);
            if (data.bills && data.customers && data.suppliers && data.items) {
                saveDB(data);
                loadAllData();
                alert('تم استيراد البيانات بنجاح');
            } else {
                alert('ملف غير صالح');
            }
        } catch(err) {
            alert('خطأ في قراءة الملف: ' + err.message);
        }
    };
    reader.readAsText(file);
    event.target.value = '';
}

function clearAllData() {
    if (!confirm('هل أنت متأكد؟ سيتم حذف جميع البيانات!')) return;
    localStorage.removeItem(DB_KEY);
    loadAllData();
    alert('تم حذف جميع البيانات');
}

function changePassword() {
    const current = document.getElementById('changeCurrentPwd').value;
    const newPwd = document.getElementById('changeNewPwd').value;
    const confirmPwd = document.getElementById('changeConfirmPwd').value;
    const db = getDB();
    const savedPwd = db.settings.password || DEFAULT_PASSWORD;
    if (current !== savedPwd) { alert('كلمة المرور الحالية غير صحيحة'); return; }
    if (!newPwd || newPwd.length < 3) { alert('كلمة المرور الجديدة يجب أن تكون 3 أحرف على الأقل'); return; }
    if (newPwd !== confirmPwd) { alert('تأكيد كلمة المرور غير متطابق'); return; }
    db.settings.password = newPwd;
    saveDB(db);
    alert('تم تغيير كلمة المرور بنجاح');
    document.getElementById('changeCurrentPwd').value = '';
    document.getElementById('changeNewPwd').value = '';
    document.getElementById('changeConfirmPwd').value = '';
    document.getElementById('passwordChangeModal').classList.remove('open');
}

function loadAllData() {
    loadDashboard();
    renderBills();
    renderParties('customers');
    renderParties('suppliers');
    renderInventory();
    renderExpenses();
    renderOffers();
    renderOrders();
    renderAccounts();
    renderJournals();
    renderVouchers();
    renderCurrencies();
    renderBranches();
    renderAdjustments();
    loadSettings();
    loadPrefs();
}

// ====== الإعدادات المتقدمة (Preferences) ======
function savePref(key, value) {
    const db = getDB();
    if (!db.settings.prefs) db.settings.prefs = {};
    db.settings.prefs[key] = value;
    saveDB(db);
}

function loadPrefs() {
    const db = getDB();
    const prefs = db.settings.prefs || {};
    const prefKeys = ['sellNegative','editDate','defaultCash','avgCost','useWhatsapp',
        'activateSub','enableBarcode','autoPrice','autoQty','updatePrices',
        'hideTaxPurchase','hideTaxSale','showTime','showExpiry'];
    prefKeys.forEach(key => {
        const el = document.querySelector(`[onchange*="${key}"]`);
        if (el && el.type === 'checkbox') el.checked = !!prefs[key];
        if (el && el.tagName === 'SELECT') el.value = prefs[key] || 'QR Code';
    });
    if (document.getElementById('barcodeTypeLabel')) {
        document.getElementById('barcodeTypeLabel').textContent = prefs.barcodeType || 'QR Code';
    }
}

function getPref(key) {
    const db = getDB();
    return (db.settings.prefs || {})[key];
}

// ====== Toast Notification ======
function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = 'toast-notification toast-' + type;
    toast.innerHTML = '<i class="fas fa-' + (type === 'success' ? 'check-circle' : 'exclamation-circle') + '"></i> ' + message;
    document.body.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 2500);
}

// ====== Close Bill Form ======
function closeBillForm() {
    document.getElementById('billFormModal').classList.remove('open');
}

// ====== المخزن المتبقي (Inventory Balance Report) ======
function renderInventoryBalance() {
    const db = getDB();
    const search = (document.getElementById('invBalanceSearch').value || '').toLowerCase();
    const whFilter = document.getElementById('invBalanceWarehouseFilter').value;
    
    // Populate warehouse filter
    const whSel = document.getElementById('invBalanceWarehouseFilter');
    const currentVal = whSel.value;
    whSel.innerHTML = '<option value="all">جميع المخازن</option>' +
        (db.branches || []).map(b => `<option value="${b.id}" ${b.id === currentVal ? 'selected' : ''}>${b.name}</option>`).join('');
    
    let rows = [];
    (db.items || []).forEach(item => {
        const branches = (db.branches || []).length > 0 ? db.branches : [{ id: 'default', name: 'المخزن الرئيسي' }];
        branches.forEach(branch => {
            if (whFilter !== 'all' && branch.id !== whFilter) return;
            const qty = item.qty || 0;
            const cost = item.cost || 0;
            const total = qty * cost;
            if (search) {
                if (!item.name.toLowerCase().includes(search) && !(item.barcode || '').toLowerCase().includes(search) && !branch.name.toLowerCase().includes(search)) return;
            }
            rows.push({ itemId: item.id, itemName: item.name, branchId: branch.id, branchName: branch.name, qty, cost, total, barcode: item.barcode, category: item.category, price: item.price });
        });
    });
    
    rows.sort((a, b) => b.total - a.total);
    
    const container = document.getElementById('invBalanceBody');
    if (rows.length === 0) {
        container.innerHTML = '<div class="inv-balance-empty"><i class="fas fa-box-open"></i><p>لا توجد بيانات مخزون</p></div>';
        document.getElementById('invBalanceGrandTotal').textContent = '0.00';
        return;
    }
    
    let grandTotal = 0;
    let html = '';
    rows.forEach(row => {
        grandTotal += row.total;
        const lowStock = row.qty <= 5;
        html += `<div class="inv-balance-row ${lowStock ? 'low-stock' : ''}" onclick="showItemDetail('${row.itemId}')">
            <span class="col-wh" title="${row.branchName}">${row.branchName}</span>
            <span class="col-item" title="${row.itemName}">${row.itemName}</span>
            <span class="col-qty">${row.qty}</span>
            <span class="col-cost">${fmtNum(row.cost)}</span>
            <span class="col-total">${fmtNum(row.total)} ${currency()}</span>
        </div>`;
    });
    container.innerHTML = html;
    document.getElementById('invBalanceGrandTotal').textContent = fmtNum(grandTotal) + ' ' + currency();
}

function showItemDetail(itemId) {
    const db = getDB();
    const item = db.items.find(i => i.id === itemId);
    if (!item) return;
    
    document.getElementById('itemDetailTitle').textContent = item.name;
    const qty = item.qty || 0;
    const cost = item.cost || 0;
    const price = item.price || 0;
    const stockValue = qty * cost;
    const saleValue = qty * price;
    const profit = saleValue - stockValue;
    
    // Find related bills
    const relatedBills = (db.bills || []).filter(b => 
        (b.items || []).some(i => i.itemId === itemId)
    );
    const lastBill = relatedBills.sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
    
    const content = document.getElementById('itemDetailContent');
    content.innerHTML = `
        <div class="detail-grid">
            <div class="detail-item full">
                <label>اسم الصنف</label>
                <span>${item.name}</span>
            </div>
            <div class="detail-item">
                <label>القسم</label>
                <span>${item.category || '-'}</span>
            </div>
            <div class="detail-item">
                <label>الباركود</label>
                <span>${item.barcode || '-'}</span>
            </div>
            <div class="detail-item highlight">
                <label>الكمية المتوفرة</label>
                <span>${qty} ${item.unit || ''}</span>
            </div>
            <div class="detail-item">
                <label>سعر الشراء (التكلفة)</label>
                <span>${fmtNum(cost)} ${currency()}</span>
            </div>
            <div class="detail-item">
                <label>سعر البيع</label>
                <span>${fmtNum(price)} ${currency()}</span>
            </div>
            <div class="detail-item highlight">
                <label>قيمة المخزون (التكلفة)</label>
                <span>${fmtNum(stockValue)} ${currency()}</span>
            </div>
            <div class="detail-item">
                <label>قيمة المخزون (البيع)</label>
                <span>${fmtNum(saleValue)} ${currency()}</span>
            </div>
            <div class="detail-item" style="${profit >= 0 ? 'color:var(--success)' : 'color:var(--danger)'}">
                <label>الربح المتوقع</label>
                <span>${fmtNum(profit)} ${currency()}</span>
            </div>
            <div class="detail-item full">
                <label>آخر حركة</label>
                <span>${lastBill ? lastBill.no + ' - ' + lastBill.date : 'لا توجد حركات'}</span>
            </div>
        </div>
    `;
    document.getElementById('itemDetailModal').classList.add('open');
}

function closeItemDetailModal() {
    document.getElementById('itemDetailModal').classList.remove('open');
}

function focusInvBalanceSearch() {
    document.getElementById('invBalanceSearch').focus();
}

function toggleInvBalanceMenu() {
    document.getElementById('invBalanceMenu').classList.toggle('show');
}

function closeInvBalanceMenu() {
    document.getElementById('invBalanceMenu').classList.remove('show');
}

function printInvBalancePDF() {
    closeInvBalanceMenu();
    window.print();
}

function printInvBalanceThermal() {
    closeInvBalanceMenu();
    alert('جاري التجهيز للطباعة الحرارية...');
}

function exportInvBalanceCSV() {
    closeInvBalanceMenu();
    const db = getDB();
    let csv = 'المخزن,الصنف,الكمية,التكلفة,المجموع\n';
    (db.items || []).forEach(item => {
        const branches = (db.branches || []).length > 0 ? db.branches : [{ id: 'default', name: 'المخزن الرئيسي' }];
        branches.forEach(branch => {
            const qty = item.qty || 0;
            const cost = item.cost || 0;
            const total = qty * cost;
            csv += `${branch.name},${item.name},${qty},${cost},${total}\n`;
        });
    });
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'inventory_balance_' + todayStr() + '.csv';
    a.click();
    URL.revokeObjectURL(url);
    showToast('تم التصدير بنجاح', 'success');
}

// ====== بدء التطبيق ======
showLogin();
