/* Nexus ERP — Web (full modules). Login disabled (auto admin) + i18n + QR + PDF + installments + coupons + split pay + app lock */
'use strict';
/* ============================ i18n ============================ */
let LANG = 'ar';
function t(ar, en){ return (LANG==='en') ? (en||ar) : ar; }
function applyTheme(){ const s=DB.getOne('settings')||{}; document.documentElement.setAttribute('data-theme', (s.theme==='dark')?'dark':'light'); }
function applyLang(){ document.documentElement.lang = (LANG==='en'?'en':'ar'); document.documentElement.dir = (LANG==='en'?'ltr':'rtl'); applyTheme(); }
/* ============================ HELPERS ============================ */
const $  = (s, r=document) => r.querySelector(s);
const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));
const uid = () => 'id' + Date.now().toString(36) + Math.random().toString(36).slice(2,7);
const esc = (s) => String(s==null?'':s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt = (n) => (Number(n)||0).toLocaleString(LANG==='en'?'en-US':'ar-EG', {maximumFractionDigits:2});
const money = (n) => fmt(n) + ' ' + ((DB.getOne('settings')||{}).currency || 'ج.م');
const nowISO = () => new Date().toISOString();
function fmtDate(iso){ if(!iso) return '—'; return new Date(iso).toLocaleDateString(LANG==='en'?'en-US':'ar-EG'); }
function fmtDateTime(iso){ if(!iso) return '—'; return new Date(iso).toLocaleString(LANG==='en'?'en-US':'ar-EG'); }
function toast(msg){ const e=$('#toastRoot'); const d=document.createElement('div'); d.className='toast'; d.textContent=msg; e.appendChild(d); const raf=(typeof requestAnimationFrame==='function')?requestAnimationFrame:setTimeout; raf(()=>d.classList.add('show')); setTimeout(()=>{d.classList.remove('show'); setTimeout(()=>d.remove(),300);},2200); }
function confirmModal(title, msg, onYes, yesLabel){ openModal(title, `<p>${esc(msg)}</p>`, [ {label:yesLabel||t('تأكيد','Confirm'), cls:'btn-danger', onClick:()=>{ closeModal(); onYes&&onYes(); }}, {label:t('إلغاء','Cancel'), cls:'btn', onClick:closeModal} ]); }
function openModal(title, bodyHtml, footBtns){ const root=$('#modalRoot'); root.innerHTML=`<div class="modal-overlay"><div class="modal"><div class="modal-head"><h3>${esc(title)}</h3><button class="close" onclick="closeModal()">×</button></div><div class="modal-body">${bodyHtml}</div><div class="modal-foot" id="modalFoot"></div></div></div>`; const foot=$('#modalFoot'); (footBtns||[]).forEach(b=>{ const el=document.createElement('button'); el.className='btn '+(b.cls||''); el.textContent=b.label; el.onclick=b.onClick; foot.appendChild(el); }); }
function closeModal(){ if(_scanStream){ try{ _scanStream.getTracks().forEach(t=>t.stop()); }catch(e){} _scanStream=null; } $('#modalRoot').innerHTML=''; }
let _scanStream=null;
function openScanner(targetId){ const hasCam=(typeof navigator!=='undefined' && navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  const body=`<div class="scanner-wrap"><video id="scanVideo" autoplay playsinline ${hasCam?'':'style="display:none"'}></video><div class="scanner-line"></div></div><p class="muted">${t('وجّه الكاميرا للباركود، أو اكتب القيمة يدوياً','Point camera at barcode, or type the value')}</p><label class="btn"><input id="scanManual" autofocus placeholder="${t('الباركود','Barcode')}"><button class="btn" onclick="scanConfirm('${targetId}')">${t('موافق','OK')}</button></label>`;
  openModal(t('مسح الباركود','Scan Barcode'), body, [{label:t('إلغاء','Cancel'),cls:'btn',onClick:closeModal}]);
  if(hasCam){ navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'}}).then(s=>{ _scanStream=s; const v=$('#scanVideo'); if(v) v.srcObject=s; }).catch(()=>{}); }
  const inp=$('#scanManual'); if(inp) inp.addEventListener('keydown',e=>{ if(e.key==='Enter'){ e.preventDefault(); scanConfirm(targetId); } });
}
function scanConfirm(targetId){ const v=$('#scanManual').value.trim(); if(v && targetId && $('#'+targetId)){ $('#'+targetId).value=v; if(targetId==='invItemSearch'){ invItemSearchAC(v); const m=DB.get('products').find(p=>(p.barcode||'')===v||(p.code||'')===v); if(m) invItemSearchPick(m.id); } } closeModal(); }
function downloadFile(name, content, mime='text/plain'){ const blob=new Blob([content],{type:mime}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=name; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),1000); }
function readFileAsText(file){ return new Promise((res,rej)=>{ const r=new FileReader(); r.onload=()=>res(r.result); r.onerror=rej; r.readAsText(file); }); }
function csvEscape(v){ v=v==null?'':String(v); return /[",\n]/.test(v)? '"'+v.replace(/"/g,'""')+'"' : v; }
function toCSV(rows){ return rows.map(r=>r.map(csvEscape).join(',')).join('\n'); }
function parseCSV(text){ const lines=text.split(/\r?\n/).filter(l=>l.trim()); const out=[]; for(const ln of lines){ const row=[]; let cur='',q=false; for(let i=0;i<ln.length;i++){ const c=ln[i]; if(c==='"'){ if(q&&ln[i+1]==='"'){cur+='"';i++;} else q=!q; } else if(c===','&&!q){ row.push(cur); cur=''; } else cur+=c; } row.push(cur); out.push(row); } return out; }
/* ============================ LAYOUT PARTIALS ============================ */
function pdfDoc(){ const J=(window.jspdf&&window.jspdf.jsPDF)?window.jspdf.jsPDF:window.jsPDF; return new J({orientation:'p',unit:'mm',format:'a4'}); }
function exportPDF(filename, lines){ try{ const doc=pdfDoc(); let y=15; lines.forEach(l=>{ if(l===null){ doc.addPage(); y=15; return; } doc.text(String(l), 14, y); y+=7; if(y>285){ doc.addPage(); y=15; } }); doc.save(filename); }catch(e){ toast(t('تعذر إنشاء PDF','PDF failed')); } }
/* ============================ DATA STORE ============================ */
const GLOBAL_KEYS = new Set(['companies','users','settings','branches','audit']);
let _activeCompanyId=null, _activeBranchId=null, _dirty=false, _currentScreenId='dashboard';
function markDirty(){ _dirty=true; }
const DB = {
  _ns(k){ if(GLOBAL_KEYS.has(k) || !_activeCompanyId) return 'erp_'+k; return `erp_${_activeCompanyId}_${k}`; },
  get(k){ try{ return JSON.parse(localStorage.getItem(this._ns(k))) || []; }catch(e){ return []; } },
  set(k,v){ localStorage.setItem(this._ns(k), JSON.stringify(v)); markDirty(); return v; },
  getOne(k){ const v=localStorage.getItem(this._ns(k)); try{ return v===null?null:JSON.parse(v); }catch(e){ return null; } },
  setOne(k,v){ localStorage.setItem(this._ns(k), JSON.stringify(v)); markDirty(); return v; },
  remove(k){ localStorage.removeItem(this._ns(k)); markDirty(); }
};
function setCurrentCompany(cid, bid){ _activeCompanyId=cid; const branches=DB.get('branches').filter(b=>b.companyId===cid); _activeBranchId=bid||(branches[0]&&branches[0].id)||null; DB.setOne('settings', Object.assign({}, DB.getOne('settings')||{}, {activeCompanyId:cid, activeBranchId:_activeBranchId})); }
function getCurrentCompanyId(){ return _activeCompanyId; }
function getCurrentBranchId(){ return _activeBranchId; }
function currentCompany(){ return DB.get('companies').find(c=>c.id===_activeCompanyId); }
function getTaxRate(){ return Number(((DB.getOne('settings')||{}).taxRate)||0); }
/* ============================ SEED ============================ */
function seedData(){ if(DB.getOne('seeded')) return;
  DB.set('categories',[]);
  DB.set('units',[{id:uid(),name:'قطعة'}]);
  DB.set('warehouses',[{id:uid(),name:'المخزن الرئيسي',branchId:null}]);
  DB.set('products',[]);
  DB.set('customers',[]);
  DB.set('suppliers',[]);
  DB.set('invoices',[]); DB.set('purchases',[]); DB.set('purchaseOrders',[]); DB.set('returns',[]); DB.set('expenses',[]); DB.set('movements',[]);
  DB.set('employees',[]); DB.set('quotes',[]); DB.set('trash',[]); DB.set('audit',[]); DB.set('coupons',[]);
  DB.set('customerOrders',[]); DB.set('purchaseRequests',[]); DB.set('debts',[]);
  DB.setOne('seeded',true);
}
function seedCompanyDefaults(cid){ setCurrentCompany(cid);
  if(!DB.getOne('seeded')){
    DB.set('categories',[]); DB.set('units',[{id:uid(),name:'قطعة'}]);
    DB.set('warehouses',[{id:uid(),name:'المخزن الرئيسي',branchId:null}]);
    DB.set('products',[]); DB.set('customers',[]);
    DB.set('suppliers',[]); DB.set('invoices',[]); DB.set('purchases',[]); DB.set('purchaseOrders',[]); DB.set('returns',[]); DB.set('expenses',[]); DB.set('movements',[]); DB.set('employees',[]); DB.set('quotes',[]); DB.set('trash',[]); DB.set('audit',[]); DB.set('coupons',[]);
    DB.set('customerOrders',[]); DB.set('purchaseRequests',[]); DB.set('debts',[]);
    DB.setOne('seeded',true);
  }
  seedAccounts(cid);
}
function seedAccounts(cid){ setCurrentCompany(cid); if(DB.getOne('acc_seeded')) return;
  const A=(id,code,name,type)=>({id,code,name,type,parent:null,balance:0});
  DB.set('accounts',[ A(CFG.ACC.CASH,'1001',t('الصندوق','Cash'),'asset'), A(CFG.ACC.BANK,'1003',t('البنك','Bank'),'asset'), A(CFG.ACC.INVENTORY,'1002',t('المخزون','Inventory'),'asset'), A(CFG.ACC.RECEIVABLE,'1101',t('أرصدة العملاء','Receivables'),'asset'), A(CFG.ACC.COGS,'5001',t('تكلفة البضاعة','COGS'),'expense'), A(CFG.ACC.SALES,'4001',t('المبيعات','Sales'),'income'), A(CFG.ACC.SALES_RET,'4002',t('مرتجع المبيعات','Sales Returns'),'income'), A(CFG.ACC.PAYABLE,'2101',t('أرصدة الموردين','Payables'),'liability'), A(CFG.ACC.PURCHASES,'5002',t('المشتريات','Purchase'),'expense'), A(CFG.ACC.EXPENSES,'5003',t('المصروفات','Expenses'),'expense'), A(CFG.ACC.CAPITAL,'3001',t('رأس المال','Capital'),'equity') ]);
  DB.set('bankAccounts',[{id:uid(),name:'البنك الأهلي',accountId:'acc_bank',balance:0}]);
  DB.set('vouchers',[]); DB.set('journal',[]); DB.setOne('acc_seeded',true);
}
function migrateToCompanies(){ const s=DB.getOne('settings')||{}; if(s.activeCompanyId) return;
  const defId='comp_default'; const existing=DB.get('companies');
  if(!existing.length){ DB.set('companies',[{id:defId,name:(s.companyName||'شركتي'),phone:s.companyPhone||'',taxNo:s.companyTaxNo||'',address:s.companyAddress||'',logo:'',createdAt:nowISO()}]); }
  setCurrentCompany(defId);
  ['categories','units','warehouses','products','customers','suppliers','invoices','purchases','purchaseOrders','returns','expenses','movements','employees','quotes','trash','accounts','bankAccounts','vouchers','journal','coupons'].forEach(k=>{ const raw=localStorage.getItem('erp_'+k); if(raw!==null) localStorage.setItem(`erp_${defId}_${k}`, raw); });
  DB.setOne('settings', Object.assign({}, s, {activeCompanyId:defId}));
  seedAccounts(defId);
}
/* ============================ AUTH ============================ */
const ROLES = { admin:{label:'مدير',perms:'*'}, accountant:{label:'محاسب',perms:['dashboard','sales','purchases','customers','suppliers','accounting','journal','coa','periods','assets','reconcile','costcenters','closing','vat','vouchers','costing','subledger','aging','reports','products','inventory','coupons','returns']}, cashier:{label:'كاشير',perms:['dashboard','sales','products','returns']}, storekeeper:{label:'أمين مخزن',perms:['dashboard','products','inventory']}, delegate:{label:'مندوب',perms:['dashboard','customers','sales','returns']}, employee:{label:'موظف',perms:['dashboard']} };
let currentUser=null;
function roleLabel(r){ return (ROLES[r]&&ROLES[r].label)||r; }
function hasPerm(p){ if(!currentUser) return false; const perms=(ROLES[currentUser.role]&&ROLES[currentUser.role].perms)||[]; if(perms==='*'||perms.includes('*')) return true; return perms.includes(p); }
function canPost(){ if(!currentUser) return true; const role=currentUser.role; if(role==='admin'||role==='accountant'||role==='storekeeper') return true; return false; }
function requirePost(){ if(!canPost()){ toast(t('ليس لديك صلاحية الترحيل — احفظ كمسودة فقط','No posting permission — save as draft only')); return false; } return true; }
async function hashPw(pw, salt){ if(typeof crypto!=='undefined' && crypto.subtle){ try{ const enc=new TextEncoder(); const km=await crypto.subtle.importKey('raw', enc.encode(pw), 'PBKDF2', false, ['deriveBits']); const bits=await crypto.subtle.deriveBits({name:'PBKDF2', salt:enc.encode(salt), iterations:100000, hash:'SHA-256'}, km, 256); return Array.from(new Uint8Array(bits)).map(b=>b.toString(16).padStart(2,'0')).join(''); }catch(e){} } return 'plain:'+pw; }
async function verifyPw(pw, u){ if(u.hash){ const h=await hashPw(pw, u.salt||''); return h===u.hash; } return (u.password||'')===pw; }
async function doLogin(){ return {ok:false,msg:'login disabled'}; }
function logoutUser(){ /* login system removed: app auto-opens as admin */ }
async function ensureAdmin(){ let users=DB.get('users'); if(!users.length){ const salt=String(Math.random()).slice(2); const hash=await hashPw('admin', salt); DB.set('users',[{id:uid(),name:'المدير',username:'admin',email:'admin@nexus.com',phone:'000',hash,salt,role:'admin',active:true}]); }   if(DB.get('users').length===1){ const u=DB.get('users'); for(const [uname,name,role,pw] of [['cashier','كاشير','cashier','cashier123'],['accountant','محاسب','accountant','accountant123']]){ const salt=String(Math.random()).slice(2); const hash=await hashPw(pw,salt); u.push({id:uid(),name,username:uname,email:'',phone:'',hash,salt,role,active:true}); } DB.set('users',u); } const s=DB.getOne('settings')||{}; if(!s.companyName) DB.setOne('settings', Object.assign({}, s, {companyName:'شركتي',currency:'ج.م',taxRate:0,defaultDiscount:0,printSize:'80mm',lang:'ar',theme:'light',pin:''})); }
function ensureBranch(){ const branches=DB.get('branches'); const cid=_activeCompanyId||(DB.getOne('settings')||{}).activeCompanyId; if(!branches.length){ DB.set('branches',[{id:uid(),name:t('الفرع الرئيسي','Main Branch'),manager:'',companyId:cid||null}]); } const s=DB.getOne('settings')||{}; const active=DB.get('branches').find(b=>b.companyId===cid); if(active) s.activeBranchId=active.id; s.activeCompanyId=cid; DB.setOne('settings',s); }
function renderLogin(){ /* login system removed */ }
/* ============================ APP LOCK ============================ */
function showLock(next){ const ov=$('#lockOverlay'); ov.classList.remove('hidden'); $('#lockError').textContent=''; $('#lockPin').value=''; window._afterLock=next; setTimeout(()=>{ try{$('#lockPin').focus();}catch(e){} },50); }
function submitLock(){ const pin=($('#lockPin').value||''); const set=DB.getOne('settings')||{}; if(pin===set.pin){ $('#lockOverlay').classList.add('hidden'); const n=window._afterLock; window._afterLock=null; n&&n(); } else { $('#lockError').textContent=t('رمز غير صحيح','Wrong PIN'); } }
/* ============================ AUDIT ============================ */
function logAudit(action, details){ try{ const list=DB.get('audit'); list.unshift({id:uid(),time:nowISO(),user:(currentUser&&currentUser.name)||t('النظام','System'),action,details:details||''}); if(list.length>2000) list.length=2000; DB.set('audit',list); }catch(e){} }
/* ============================ COMPANIES ============================ */
function renderCompaniesContainer(){   $('#screen').innerHTML=`<div class="screen">${pageHead(t('الشركات','Companies'),{icon:'🏢',sub:t('إدارة الشركات والفروع','Manage companies & branches'),actions:`<button class="btn" onclick="openCompanyModal()">＋ ${t('شركة جديدة','New Company')}</button>`})}
  ${panel({flush:true, body:'<div id="companiesWrap"></div>'})}</div>`;
  renderCompaniesList(); applyLang(); }
function renderCompaniesList(){ const wrap=$('#companiesWrap'); const list=DB.get('companies'); if(!list.length){ wrap.innerHTML=`<p>${t('لا توجد شركات','No companies')}</p>`; return; }
  wrap.innerHTML=`<table class="tbl"><thead><tr><th>${t('الاسم','Name')}</th><th>${t('الهاتف','Phone')}</th><th>${t('الرقم الضريبي','Tax No')}</th><th></th></tr></thead><tbody>${list.map(c=>`<tr><td>${esc(c.name)}</td><td>${esc(c.phone)}</td><td>${esc(c.taxNo)}</td><td><button class="btn" onclick="openCompanyModal('${c.id}')">${t('تعديل','Edit')}</button> <button class="btn btn-danger" onclick="deleteCompany('${c.id}')">${t('حذف','Delete')}</button> <button class="btn" onclick="selectCompany('${c.id}')">${t('فتح','Open')}</button></td></tr>`).join('')}</tbody></table>`; }
function openCompanyModal(id){ const c=id?DB.get('companies').find(x=>x.id===id):null; openModal(t('شركة','Company'), `<div class="form-grid">
  <label>${t('الاسم','Name')}<input id="cmpName" value="${esc(c?c.name:'')}"></label>
  <label>${t('الهاتف','Phone')}<input id="cmpPhone" value="${esc(c?c.phone:'')}"></label>
  <label>${t('الرقم الضريبي','Tax No')}<input id="cmpTax" value="${esc(c?c.taxNo:'')}"></label>
  <label>${t('العنوان','Address')}<input id="cmpAddr" value="${esc(c?c.address:'')}"></label>
  <label>${t('الشعار (URL)','Logo URL')}<input id="cmpLogo" value="${esc(c?c.logo:'')}"></label></div>`,
  [{label:t('حفظ','Save'),cls:'btn-primary',onClick:()=>{ const name=$('#cmpName').value.trim(); if(!name){toast(t('الاسم مطلوب','Name required'));return;} let list=DB.get('companies'); if(c){ c.name=name; c.phone=$('#cmpPhone').value; c.taxNo=$('#cmpTax').value; c.address=$('#cmpAddr').value; c.logo=$('#cmpLogo').value; } else { list.push({id:uid(),name,phone:$('#cmpPhone').value,taxNo:$('#cmpTax').value,address:$('#cmpAddr').value,logo:$('#cmpLogo').value,createdAt:nowISO()}); } DB.set('companies',list); seedCompanyDefaults(c?c.id:list[list.length-1].id); closeModal(); renderCompaniesList(); }},
   {label:t('إلغاء','Cancel'),cls:'btn',onClick:closeModal}]); }
function deleteCompany(id){ confirmModal(t('حذف','Delete'), t('حذف الشركة وكل بياناتها؟','Delete company and all its data?'), ()=>{ const list=DB.get('companies').filter(x=>x.id!==id); DB.set('companies',list); ['categories','units','warehouses','products','customers','suppliers','invoices','purchases','purchaseOrders','returns','expenses','movements','employees','quotes','trash','accounts','bankAccounts','vouchers','journal','coupons'].forEach(k=>DB.remove(k)); DB.remove('acc_seeded'); DB.remove('seeded'); if(_activeCompanyId===id){ _activeCompanyId=null; renderCompaniesContainer(); } else renderCompaniesList(); }); }
function selectCompany(id){ setCurrentCompany(id); if(!DB.getOne('acc_seeded')) seedAccounts(id); renderShell(); }
/* ============================ BRANCH ============================ */
function renderBranchScreen(){ const branches=DB.get('branches').filter(b=>b.companyId===_activeCompanyId); const def=DB.get('users').find(u=>u.id===(currentUser&&currentUser.id)); $('#screen').innerHTML=`<div class="screen">${pageHead(t('الفروع','Branches'),{icon:'🏢',sub:t('فروع الشركة النشطة','Branches of the active company'),actions:`<button class="btn" onclick="openBranchModal()">＋ ${t('فرع جديد','New Branch')}</button>`})}
  ${panel({flush:true, body:'<div id="branchWrap"></div>'})}</div>`; $('#branchWrap').innerHTML=branches.length?`<table class="tbl"><thead><tr><th>${t('الاسم','Name')}</th><th>${t('المدير','Manager')}</th><th></th></tr></thead><tbody>${branches.map(b=>`<tr><td>${esc(b.name)}</td><td>${esc(b.manager||'')}</td><td><button class="btn" onclick="openBranchModal('${b.id}')">${t('تعديل','Edit')}</button> <button class="btn btn-danger" onclick="deleteBranch('${b.id}')">${t('حذف','Delete')}</button> <button class="btn" onclick="setActiveBranch('${b.id}')">${t('تفعيل','Activate')}</button></td></tr>`).join('')}</tbody></table>`:`<p>${t('لا فروع','No branches')}</p>`; applyLang(); }
function openBranchModal(id){ const b=id?DB.get('branches').find(x=>x.id===id):null; openModal(t('فرع','Branch'), `<div class="form-grid"><label>${t('الاسم','Name')}<input id="brName" value="${esc(b?b.name:'')}"></label><label>${t('المدير','Manager')}<input id="brMgr" value="${esc(b?b.manager:'')}"></label></div>`, [{label:t('حفظ','Save'),cls:'btn-primary',onClick:()=>{ const name=$('#brName').value.trim(); if(!name){toast(t('الاسم مطلوب','Name required'));return;} let list=DB.get('branches'); if(b){ b.name=$('#brName').value; b.manager=$('#brMgr').value; } else list.push({id:uid(),name,manager:$('#brMgr').value,companyId:_activeCompanyId}); DB.set('branches',list); closeModal(); renderBranchScreen(); }},{label:t('إلغاء','Cancel'),cls:'btn',onClick:closeModal}]); }
function deleteBranch(id){ confirmModal(t('حذف','Delete'), t('حذف الفرع؟','Delete branch?'), ()=>{ DB.set('branches', DB.get('branches').filter(x=>x.id!==id)); if(_activeBranchId===id){ const b=DB.get('branches').filter(x=>x.companyId===_activeCompanyId)[0]; setActiveBranch(b?b.id:null); } renderBranchScreen(); }); }
function setActiveBranch(id){ setCurrentCompany(_activeCompanyId,id); renderShell(); }
/* ============================ NAV ============================ */
function navItems(){ return [
  {id:'dashboard',icon:'📊',label:t('الرئيسية','Dashboard'),perm:'dashboard'},
  {id:'sales',icon:'🧾',label:t('المبيعات','Sales'),perm:'sales'},
  {id:'customerOrders',icon:'📋',label:t('طلبات العملاء','Orders'),perm:'sales'},
  {id:'purchases',icon:'🛒',label:t('المشتريات','Purchases'),perm:'purchases'},
  {id:'purchaseRequests',icon:'📋',label:t('طلبات الشراء','Purch. Req'),perm:'purchases'},
  {id:'purchaseorders',icon:'📝',label:t('أوامر الشراء','PO'),perm:'purchases'},
  {id:'returns',icon:'↩️',label:t('المرتجعات','Returns'),perm:'returns'},
  {id:'customers',icon:'👥',label:t('العملاء','Customers'),perm:'customers'},
  {id:'suppliers',icon:'🏭',label:t('الموردون','Suppliers'),perm:'suppliers'},
  {id:'directory',icon:'📒',label:t('الدليل','Directory'),perm:'customers'},
  {id:'products',icon:'📦',label:t('المنتجات','Products'),perm:'products'},
  {id:'inventory',icon:'🏬',label:t('المخزون','Inventory'),perm:'inventory'},
  {id:'expenses',icon:'💰',label:t('المصروفات','Expenses'),perm:'reports'},
  {id:'debts',icon:'💳',label:t('الديون','Debts'),perm:'customers'},
  {id:'profits',icon:'📈',label:t('الأرباح','Profits'),perm:'reports'},
  {id:'coupons',icon:'🏷️',label:t('الكوبونات','Coupons'),perm:'coupons'},
  {id:'costing',icon:'⚖️',label:t('التسعير','Costing'),perm:'accounting'},
  {id:'employees',icon:'🧑‍💼',label:t('الموظفون','Employees'),perm:'employees'},
  {id:'companies',icon:'🏢',label:t('الشركات','Companies'),perm:'*'},
  {id:'branch',icon:'📍',label:t('الفروع','Branches'),perm:'*'},
  {id:'reports',icon:'📈',label:t('التقارير','Reports'),perm:'reports'},
  {id:'audit',icon:'🛡️',label:t('سجل التدقيق','Audit Log'),perm:'*'},
  {id:'trash',icon:'🗑️',label:t('المحذوفات','Trash'),perm:'*'},
  {id:'settings',icon:'⚙️',label:t('الإعدادات','Settings'),perm:'*'}
]; }
function renderShell(){ const app=$('#app'); const comp=currentCompany();   const nav=navItems().filter(n=>hasPerm(n.perm));
  app.classList.remove('hidden');
  const activeBranch=(DB.get('branches').find(b=>b.id===getCurrentBranchId())||{}).name||'—';
  app.innerHTML=`<header class="topbar"><button class="btn icon-btn" onclick="toggleSidebar()" title="${t('فتح/غلق القائمة','Toggle menu')}" aria-label="${t('فتح/غلق القائمة','Toggle menu')}">☰</button><div class="brand">${esc(comp?comp.name:'')}</div>
    <button class="pill" onclick="openSwitchModal()" title="${t('تبديل الشركة/الفرع','Switch company/branch')}">🏢 ${esc(comp?comp.name:'—')} · ${esc(activeBranch)}</button>
    <div class="top-actions">
      <button class="btn" id="langBtn">${LANG==='en'?'عربي':'EN'}</button>
      <span class="who">${esc((currentUser&&currentUser.name)||'')} (${roleLabel(currentUser&&currentUser.role)})</span>
    </div></header>
    <div class="layout"><nav class="sidebar">${nav.map(n=>`<button class="nav-item" data-id="${n.id}">${n.icon} <span>${n.label}</span></button>`).join('')}</nav>
    <div class="drawer-overlay" id="drawerOverlay" onclick="closeSidebar()"></div>
    <main id="screen" class="content"></main></div>`;
  $$('.nav-item').forEach(b=>b.onclick=()=>{ if(window.matchMedia('(max-width:768px)').matches) closeSidebar(); renderScreen(b.dataset.id); });
  $('#langBtn').onclick=()=>{ LANG=(LANG==='ar')?'en':'ar'; const s=DB.getOne('settings')||{}; DB.setOne('settings',Object.assign({},s,{lang:LANG})); applyLang(); renderShell(); };
  applyLang();
  renderScreen('dashboard');
}
function toggleSidebar(){
  const sb=$('.sidebar'); if(!sb) return;
  if(window.matchMedia('(max-width:768px)').matches){
    sb.classList.toggle('open');
    const ov=$('#drawerOverlay'); if(ov) ov.classList.toggle('show', sb.classList.contains('open'));
  } else {
    sb.classList.toggle('collapsed');
  }
}
function closeSidebar(){
  const sb=$('.sidebar'); if(sb) sb.classList.remove('open');
  const ov=$('#drawerOverlay'); if(ov) ov.classList.remove('show');
}
function openSwitchModal(){ const comps=DB.get('companies'); const branches=DB.get('branches').filter(b=>b.companyId===_activeCompanyId);
  openModal(t('الشركة / الفرع','Company / Branch'), `<label>${t('الشركة','Company')}<select id="swComp" onchange="openSwitchModal()">${comps.map(c=>`<option value="${c.id}" ${c.id===_activeCompanyId?'selected':''}>${esc(c.name)}</option>`).join('')}</select></label><label>${t('الفرع','Branch')}<select id="swBranch">${branches.map(b=>`<option value="${b.id}" ${b.id===getCurrentBranchId()?'selected':''}>${esc(b.name)}</option>`).join('')}</select></label>`, [{label:t('تطبيق','Apply'),cls:'btn-primary',onClick:()=>{ setCurrentCompany($('#swComp').value,$('#swBranch').value); closeModal(); renderShell(); }},{label:t('إلغاء','Cancel'),cls:'btn',onClick:closeModal}]); }
function currentScreenId(){ return _currentScreenId; }
function renderScreen(id){   const map={dashboard:renderDashboard,sales:renderSalesList,customerOrders:renderCustomerOrders,purchases:renderPurchases,purchaseRequests:renderPurchaseRequests,purchaseorders:renderPurchaseOrders,returns:renderReturns,customers:renderCustomers,suppliers:renderSuppliers,directory:renderDirectory,products:renderProducts,inventory:renderInventory,expenses:renderExpenses,debts:renderDebts,profits:renderProfits,coupons:renderCouponsScreen,accounting:renderAccounting,journal:renderJournalScreen,coa:renderAccountsScreen,periods:renderPeriodsScreen,assets:renderAssetsScreen,reconcile:renderReconcileScreen,costcenters:renderCostCentersScreen,closing:renderClosingScreen,vat:renderVatScreen,vouchers:renderVouchersScreen,costing:renderCostingScreen,subledger:renderSubledgersScreen,aging:renderAgingScreen,employees:renderEmployees,companies:renderCompaniesContainer,branch:renderBranchScreen,reports:renderReports,audit:renderAudit,trash:renderRecycleBin,settings:renderSettings}; if(id!=='dashboard' && !hasPerm(id)) id='dashboard'; _currentScreenId=id; const fn=map[id]||renderDashboard; fn();   $$('.nav-item').forEach(b=>b.classList.toggle('active',b.dataset.id===id));
  enhanceTablesForMobile(); loadFocusCustomizations(); }
function enhanceTablesForMobile(){
  if(!window.matchMedia('(max-width:560px)').matches) return;
  $$('.tbl').forEach(tbl=>{
    const heads=[...tbl.querySelectorAll('thead th')].map(th=>th.textContent.trim());
    tbl.querySelectorAll('tbody tr').forEach(tr=>{
      [...tr.children].forEach((td,i)=>{ if(!td.hasAttribute('data-label')) td.setAttribute('data-label', heads[i]||''); });
    });
  });
}
/* ============================ DASHBOARD ============================ */
function renderDashboard(){ const app=$('#app'); const products=DB.get('products'); const invoices=DB.get('invoices'); const customers=DB.get('customers'); const suppliers=DB.get('suppliers');
  const today=new Date().toISOString().slice(0,10); const salesToday=invoices.filter(i=>i.type==='sale'&&(i.createdAt||'').slice(0,10)===today); const revToday=salesToday.reduce((s,i)=>s+i.total,0);
  const purchases=DB.get('purchases'); const purToday=purchases.filter(p=>(p.createdAt||'').slice(0,10)===today); const costToday=purToday.reduce((s,p)=>s+p.total,0);
  const pending=invoices.filter(i=>i.type==='sale'&&(i.status!=='cancelled')&&((i.total||0)-(i.paid||0))>0.01);
  const cogsToday=salesToday.reduce((s,i)=>s+(i.items||[]).reduce((a,it)=>a+(it.qty*(it.buying||0)),0),0);
  const grossToday=revToday-cogsToday;
  const d7=new Date(); d7.setDate(d7.getDate()-7); const from=d7.toISOString().slice(0,10);
  const agg={}; invoices.filter(i=>i.type==='sale'&&(i.createdAt||'').slice(0,10)>=from).forEach(i=>(i.items||[]).forEach(it=>{ if(!agg[it.productId]) agg[it.productId]={name:it.name,qty:0,total:0}; agg[it.productId].qty+=it.qty; agg[it.productId].total+=it.subtotal; }));
  const top=Object.values(agg).sort((a,b)=>b.qty-a.qty).slice(0,5);
  let cash=0; DB.get('journal').forEach(j=>(j.lines||[]).forEach(l=>{ if(l.accountId===CFG.ACC.CASH) cash=DEC.add(cash, DEC.sub(l.debit||0, l.credit||0)); }));
  const low=products.filter(p=>(p.qty||0)<=(p.minQty||0)); const out=products.filter(p=>(p.qty||0)<=0);
  $('#screen').innerHTML=`<div class="screen">${pageHead(t('لوحة التحكم','Dashboard'),{icon:'📊',sub:t('نظرة عامة على أداء المتجر','Store performance at a glance')})}
    <div class="cards">
      <div class="card"><div class="card-v">${money(revToday)}</div><div class="card-l">${t('مبيعات اليوم','Today Sales')}</div></div>
      <div class="card"><div class="card-v">${money(costToday)}</div><div class="card-l">${t('مشتريات اليوم','Today Purchases')}</div></div>
      <div class="card"><div class="card-v">${pending.length}</div><div class="card-l">${t('فواتير معلّقة','Pending Invoices')}</div></div>
      <div class="card"><div class="card-v">${customers.length}</div><div class="card-l">${t('العملاء','Customers')}</div></div>
      <div class="card"><div class="card-v">${suppliers.length}</div><div class="card-l">${t('الموردون','Suppliers')}</div></div>
      <div class="card"><div class="card-v">${products.length}</div><div class="card-l">${t('المنتجات','Products')}</div></div>
      <div class="card good"><div class="card-v">${money(grossToday)}</div><div class="card-l">${t('ربح اليوم','Today Profit')}</div></div>
      <div class="card cash"><div class="card-v">${money(cash)}</div><div class="card-l">${t('النقدية بالصندوق','Cash in Drawer')}</div></div>
    </div>
    <div class="dashboard-top"><h3>${t('الأكثر مبيعاً (7 أيام)','Top Sellers (7d)')}</h3>${top.length?`<ol class="top-list">${top.map(p=>`<li><span>${esc(p.name)}</span><span>${fmt(p.qty)} · ${money(p.total)}</span></li>`).join('')}</ol>`:`<p class="muted">${t('لا مبيعات','No sales yet')}</p>`}</div>
    <div class="trend"><h3>${t('اتجاه المبيعات (14 يوم)','Sales Trend (14d)')}</h3>${salesTrendSVG()}</div>
    <div class="dash-charts">
      <div class="chart-card"><h4>${t('المبيعات مقابل المشتريات','Sales vs Purchases')}</h4>${donutSVG([{label:t('المبيعات','Sales'),v:revToday,cost:0,color:'var(--primary)'},{label:t('المشتريات','Purchases'),v:costToday,color:'#ef4444'}])}</div>
      <div class="chart-card"><h4>${t('طريقة الدفع','Payment Method')}</h4>${donutSVG((function(){ const cash=invoices.filter(i=>i.type==='sale'&&i.payment!=='credit').reduce((s,i)=>s+i.total,0); const credit=invoices.filter(i=>i.type==='sale'&&i.payment==='credit').reduce((s,i)=>s+i.total,0); return [{label:t('نقدي','Cash'),v:cash,color:'#16a34a'},{label:t('آجل','Credit'),v:credit,color:'#d97706'}]; })())}</div>
    </div>
    <div class="dashboard-warn"><h3>${t('تنبيهات','Alerts')}</h3>
      ${!openingDone()?`<p>🚀 <button class="btn btn-primary" onclick="openOpeningBalances()">${t('ابدأ: اضبط الرصيد الافتتاحي','Start: set opening balances')}</button> — ${t('حدد النقدية والمخزون قبل البدء','Set cash & stock before you start')}</p>`:''}
      ${low.length?`<p>⚠️ ${t('منتجات تحت الحد الأدنى','Low stock')}: ${low.map(p=>esc(p.name)).join('، ')}</p>`:''}
      ${out.length?`<p>🔴 ${t('منتجات نفذت','Out of stock')}: ${out.map(p=>esc(p.name)).join('، ')}</p>`:''}
      ${openingDone()&&!low.length&&!out.length?`<p>${t('لا تنبيهات','No alerts')}</p>`:''}
    </div></div>`; applyLang(); }
function salesTrendSVG(){ const days=14; const map={}; const keys=[]; for(let i=days-1;i>=0;i--){ const d=new Date(); d.setDate(d.getDate()-i); const k=d.toISOString().slice(0,10); map[k]=0; keys.push(k); } DB.get('invoices').filter(i=>i.type==='sale').forEach(i=>{ const k=(i.createdAt||'').slice(0,10); if(k in map) map[k]+=i.total; }); const vals=keys.map(k=>map[k]); const max=Math.max(1,...vals); const w=560,h=130,pad=14; const bw=(w-pad*2)/days; let bars=''; vals.forEach((v,idx)=>{ const bh=Math.max(2,(v/max)*(h-pad*2-14)); const x=pad+idx*bw; const y=h-pad-14-bh; bars+=`<rect x="${x+2}" y="${y}" width="${Math.max(2,bw-4)}" height="${bh}" rx="3" style="fill:var(--primary)" opacity="${v>0?0.9:0.12}"><title>${fmtDate(keys[idx])}: ${money(v)}</title></rect>`; }); let labels=''; const step=Math.ceil(days/7); keys.forEach((k,idx)=>{ if(idx%step===0){ labels+=`<text x="${pad+idx*bw+bw/2}" y="${h-2}" font-size="9" text-anchor="middle" style="fill:var(--muted)">${k.slice(5)}</text>`; } }); return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" class="trend-svg" width="100%" height="130">${bars}${labels}</svg>`; }
function donutSVG(segments, size){ size=size||150; const r=size/2-10, cx=size/2, cy=size/2; const total=segments.reduce((s,x)=>s+(x.v>0?x.v:0),0)||1; let a0=-Math.PI/2; let arcs=''; segments.forEach(seg=>{ const v=seg.v>0?seg.v:0; const a1=a0+(v/total)*Math.PI*2; if(a1-a0>0.0001){ const x0=cx+r*Math.cos(a0), y0=cy+r*Math.sin(a0), x1=cx+r*Math.cos(a1), y1=cy+r*Math.sin(a1); const large=(a1-a0)>Math.PI?1:0; arcs+=`<path d="M ${cx} ${cy} L ${x0.toFixed(2)} ${y0.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${x1.toFixed(2)} ${y1.toFixed(2)} Z" style="fill:${seg.color}" stroke="var(--panel)" stroke-width="2"><title>${esc(seg.label)}: ${money(seg.v)}</title></path>`; } a0=a1; }); const leg=segments.map(s=>`<div class="donut-leg"><span class="dot" style="background:${s.color}"></span>${esc(s.label)} <b>${money(s.v)}</b></div>`).join(''); return `<div class="donut-wrap"><svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${arcs}<text x="${cx}" y="${cy-4}" text-anchor="middle" style="fill:var(--muted);font-size:11">${t('الإجمالي','Total')}</text><text x="${cx}" y="${cy+12}" text-anchor="middle" style="font-size:12;font-weight:700">${money(total)}</text></svg><div class="donut-leg-box">${leg}</div></div>`; }
/* ============================ PRODUCTS ============================ */
function renderProducts(){ const app=$('#app'); const products=DB.get('products'); const cats=DB.get('categories'); const units=DB.get('units');
  $('#screen').innerHTML=`<div class="screen">${pageHead(t('المنتجات','Products'),{sub:t('إدارة الأصناف والأسعار','Manage items, prices & stock'),actions:`<button class="btn" onclick="importProducts()">${t('استيراد','Import')}</button><button class="btn" onclick="exportProducts()">${t('تصدير','Export')}</button><button class="btn btn-primary" onclick="openProductModal()">＋ ${t('منتج جديد','New Product')}</button>`})}
    <div class="filters"><div class="field-inline"><input id="prodSearch" placeholder="${t('بحث أو مسح باركود','Search or scan barcode')}" oninput="renderProducts()"><button class="voice-btn btn sm" onclick="startVoiceSearch('prodSearch')" title="${t('بحث صوتي','Voice search')}">🎤</button><button class="btn sm" onclick="openScanner('prodSearch')" title="${t('مسح باركود','Scan barcode')}">📷</button></div><select id="prodCat" onchange="renderProducts()">${['',...cats.map(c=>c.name)].map(v=>`<option ${v?'':'selected'} value="${esc(v)}">${esc(v||t('كل التصنيفات','All categories'))}</option>`).join('')}</select></div>
    ${panel({flush:true, body:'<div id="prodWrap"></div>'})}</div>`;
  const q=($('#prodSearch').value||'').toLowerCase(); const cat=$('#prodCat').value;
  let list=products.filter(p=>(!q||(p.name||'').toLowerCase().includes(q)||(p.code||'').toLowerCase().includes(q)||(p.barcode||'').includes(q)));
  if(cat) list=list.filter(p=>p.category===cat);
  $('#prodWrap').innerHTML=`<table class="tbl"><thead><tr><th>${t('اسم','Name')}</th><th>${t('كود','Code')}</th><th>${t('تصنيف','Category')}</th><th>${t('شراء','Buy')}</th><th>${t('بيع','Sell')}</th><th>${t('كمية','Qty')}</th><th></th></tr></thead><tbody>${list.map(p=>`<tr><td>${esc(p.name)}</td><td>${esc(p.code)}</td><td>${esc(p.category)}</td><td>${fmt(p.buyingPrice)}</td><td>${fmt(p.sellingPrice)}</td><td>${fmt(p.qty)}</td><td><button class="btn" onclick="openProductModal('${p.id}')">${t('تعديل','Edit')}</button> <button class="btn btn-danger" onclick="deleteProduct('${p.id}')">${t('حذف','Delete')}</button> <button class="btn" onclick="showProductCode('${p.id}')">${t('باركود','Barcode')}</button></td></tr>`).join('')}</tbody></table>`; applyLang(); }
function openProductModal(id){ const p=id?DB.get('products').find(x=>x.id===id):null; const cats=DB.get('categories'); const units=DB.get('units');
  const imgField=`<div class="form-field"><span class="lbl">${t('الصورة','Image')}</span><div class="field-inline"><input id="pImage" value="${esc(p?p.image:'')}" placeholder="URL"><button class="btn sm" onclick="captureCamera('pImage')">${t('كاميرا','Camera')}</button></div></div>`;
  openModal(t('منتج','Product'), `<div class="form-grid">
    <div class="form-field"><span class="lbl">${t('الاسم','Name')}</span><input id="pName" value="${esc(p?p.name:'')}"></div>${imgField}
    <div class="form-field"><span class="lbl">${t('الباركود','Barcode')}</span><div class="field-inline"><input id="pBarcode" value="${esc(p?p.barcode:'')}"><button class="btn" onclick="openScanner('pBarcode')">📷 ${t('مسح','Scan')}</button></div></div>
    <div class="form-field"><span class="lbl">${t('التصنيف','Category')}</span><input id="pCat" list="catList" value="${esc(p?p.category:'')}"><datalist id="catList">${cats.map(c=>`<option value="${esc(c.name)}">`).join('')}</datalist></div>
    <div class="form-field"><span class="lbl">${t('الوحدة','Unit')}</span><input id="pUnit" list="unitList" value="${esc(p?p.unit:'')}"><datalist id="unitList">${units.map(u=>`<option value="${esc(u.name)}">`).join('')}</datalist></div>
    <div class="form-field"><span class="lbl">${t('سعر الشراء','Buy')}</span><input id="pBuy" type="number" value="${p?p.buyingPrice:0}"></div>
    <div class="form-field"><span class="lbl">${t('سعر البيع','Sell')}</span><input id="pSell" type="number" value="${p?p.sellingPrice:0}"></div>
    <div class="form-field"><span class="lbl">${t('أدنى كمية','Min Qty')}</span><input id="pMin" type="number" value="${p?p.minQty:0}"></div>
    <div class="form-field"><span class="lbl">${t('الكمية','Qty')}</span><input id="pQty" type="number" value="${p?p.qty:0}"></div>
    <div class="form-field"><span class="lbl">${t('الضريبة %','Tax %')}</span><input id="pTax" type="number" value="${p?p.tax:0}"></div>
    <div class="form-field"><span class="lbl">${t('خصم افتراضي %','Disc %')}</span><input id="pDisc" type="number" value="${p?p.defaultDiscount:0}"></div>
  </div>`, [{label:t('حفظ','Save'),cls:'btn-primary',onClick:()=>{ const name=$('#pName').value.trim(); if(!name){toast(t('الاسم مطلوب','Name required'));return;} const prd=DB.get('products'); const obj={name,barcode:$('#pBarcode').value,code:$('#pBarcode').value,category:$('#pCat').value,unit:$('#pUnit').value,buyingPrice:Number($('#pBuy').value)||0,sellingPrice:Number($('#pSell').value)||0,minQty:Number($('#pMin').value)||0,qty:Number($('#pQty').value)||0,tax:Number($('#pTax').value)||0,defaultDiscount:Number($('#pDisc').value)||0,qrcode:$('#pBarcode').value}; const vres=Validate.schema({buyingPrice:{type:'number',min:0,label:t('سعر الشراء','Buy')},sellingPrice:{type:'number',min:0,label:t('سعر البيع','Sell')},qty:{type:'number',min:0,label:t('الكمية','Qty')},minQty:{type:'number',min:0,label:t('أدنى كمية','Min Qty')},tax:{type:'number',min:0,max:100,label:t('الضريبة','Tax')}}, obj); if(!Validate.report(vres)) return; if(p){ const before={name:p.name,code:p.code,buyingPrice:p.buyingPrice,sellingPrice:p.sellingPrice,qty:p.qty,minQty:p.minQty}; Object.assign(p,obj); logAudit(t('تعديل منتج','Edit product'), p.name, {type:CFG.AUDIT.EDIT, ref:p.id, changes:diffChanges(before, obj, {name:t('الاسم','Name'),code:t('الكود','Code'),buyingPrice:t('شراء','Buy'),sellingPrice:t('بيع','Sell'),qty:t('كمية','Qty'),minQty:t('أدنى','Min')})}); } else { obj.id=uid(); obj.status='active'; obj.createdAt=nowISO(); prd.push(obj); logAudit(t('إضافة منتج','Add product'), obj.name, {type:CFG.AUDIT.ADD, ref:obj.id}); } DB.set('products',prd); closeModal(); renderProducts(); }},{label:t('إلغاء','Cancel'),cls:'btn',onClick:closeModal}]); }
function deleteProduct(id){ confirmModal(t('حذف','Delete'), t('حذف المنتج؟','Delete product?'), ()=>{ const p=DB.get('products').find(x=>x.id===id); DB.set('products',DB.get('products').filter(x=>x.id!==id)); if(p) logAudit(t('حذف منتج','Delete product'), p.name+' ('+p.code+')', {type:CFG.AUDIT.DELETE, ref:p.id}); renderProducts(); }); }
function showProductCode(id){ const p=DB.get('products').find(x=>x.id===id); openModal(t('باركود/QR','Barcode/QR'), `<div class="text-center"><div>${qrSVG(p.qrcode||p.barcode||p.code)}</div><div class="mono mt-sm">${esc(p.barcode||p.code)}</div><button class="btn" onclick="window.print()">${t('طباعة','Print')}</button></div>`, [{label:t('إغلاق','Close'),cls:'btn',onClick:closeModal}]); }
function importProducts(){ const inp=document.createElement('input'); inp.type='file'; inp.accept='.csv'; inp.onchange=async()=>{ const txt=await readFileAsText(inp.files[0]); const rows=parseCSV(txt); if(rows.length<2){toast(t('ملف فارغ','Empty file'));return;} const head=rows[0].map(h=>h.trim()); const prods=DB.get('products'); rows.slice(1).forEach(r=>{ const o={}; head.forEach((h,i)=>o[h]=r[i]); prods.push({id:uid(),name:o.name||'',code:o.code||'',barcode:o.barcode||'',category:o.category||'',unit:o.unit||'',buyingPrice:Number(o.buyingPrice)||0,sellingPrice:Number(o.sellingPrice)||0,wholesalePrice:Number(o.wholesalePrice)||0,minQty:Number(o.minQty)||0,qty:Number(o.qty)||0,tax:Number(o.tax)||0,defaultDiscount:Number(o.defaultDiscount)||0,location:o.location||'',qrcode:o.qrcode||o.barcode||'',status:'active',createdAt:nowISO()}); }); DB.set('products',prods); toast(t('تم الاستيراد','Imported')); renderProducts(); }; inp.click(); }
function exportProducts(){ const rows=[['name','code','barcode','category','unit','buyingPrice','sellingPrice','qty','tax','location']]; DB.get('products').forEach(p=>rows.push([p.name,p.code,p.barcode,p.category,p.unit,p.buyingPrice,p.sellingPrice,p.qty,p.tax,p.location])); downloadFile('products.csv', toCSV(rows),'text/csv'); }
function importCustomers(){ importCSVGeneric('customers', ['name','phone','email','address','taxNo','creditLimit','notes'], (o)=>({id:uid(),name:o.name||'',phone:o.phone||'',email:o.email||'',address:o.address||'',taxNo:o.taxNo||'',creditLimit:Number(o.creditLimit)||0,balance:0,points:0,notes:o.notes||''}), ()=>renderCustomers()); }
function exportCustomers(){ const rows=[['name','phone','email','address','taxNo','creditLimit','balance']]; DB.get('customers').forEach(c=>rows.push([c.name,c.phone,c.email,c.address,c.taxNo,c.creditLimit,c.balance])); downloadFile('customers.csv', toCSV(rows),'text/csv'); }
function importSuppliers(){ importCSVGeneric('suppliers', ['name','phone','email','address','notes'], (o)=>({id:uid(),name:o.name||'',phone:o.phone||'',email:o.email||'',address:o.address||'',balance:0,notes:o.notes||''}), ()=>renderSuppliers()); }
function exportSuppliers(){ const rows=[['name','phone','email','address','balance']]; DB.get('suppliers').forEach(s=>rows.push([s.name,s.phone,s.email,s.address,s.balance])); downloadFile('suppliers.csv', toCSV(rows),'text/csv'); }
function importCSVGeneric(key, fields, mapFn, after){ const inp=document.createElement('input'); inp.type='file'; inp.accept='.csv'; inp.onchange=async()=>{ try{ const txt=await readFileAsText(inp.files[0]); const rows=parseCSV(txt); if(rows.length<2){toast(t('ملف فارغ','Empty file'));return;} const head=rows[0].map(h=>h.trim()); const arr=DB.get(key); rows.slice(1).forEach(r=>{ const o={}; head.forEach((h,i)=>o[h]=r[i]); if(!o.name) return; const obj=mapFn(o); arr.push(obj); }); DB.set(key,arr); toast(t('تم الاستيراد','Imported')+' ('+arr.length+')'); after&&after(); }catch(e){ toast(t('فشل الاستيراد','Import failed')); } }; inp.click(); }
/* ============================ COUPONS ============================ */
function getCoupon(code){ const c=DB.get('coupons').find(x=>(x.code||'').toUpperCase()===(code||'').toUpperCase()&&x.active!==false); if(!c) return null; if(c.expires&&new Date(c.expires)<new Date()) return null; if(c.maxUses&&(c.uses||0)>=c.maxUses) return null; return c; }
function openCouponModal(id){ const c=id?DB.get('coupons').find(x=>x.id===id):null; openModal(t('كوبون','Coupon'), `<div class="form-grid"><label>${t('الكود','Code')}<input id="cpCode" value="${esc(c?c.code:'')}"></label><label>${t('نوع','Type')}<select id="cpType"><option value="percent" ${c&&c.type==='percent'?'selected':''}>%</option><option value="amount" ${c&&c.type==='amount'?'selected':''}>${t('مبلغ','Amount')}</option></select></label><label>${t('القيمة','Value')}<input id="cpVal" type="number" value="${c?c.value:0}"></label><label>${t('حد أقصى استخدام','Max Uses')}<input id="cpMax" type="number" value="${c?c.maxUses:0}"></label><label>${t('ينتهي','Expires')}<input id="cpExp" type="date" value="${c?c.expires:''}"></label><label><input type="checkbox" id="cpActive" ${c?c.active!==false:'checked'}> ${t('مفعل','Active')}</label></div>`, [{label:t('حفظ','Save'),cls:'btn-primary',onClick:()=>{ const code=$('#cpCode').value.trim(); if(!code){toast(t('الكود مطلوب','Code required'));return;} let list=DB.get('coupons'); if(c){ Object.assign(c,{code,type:$('#cpType').value,value:Number($('#cpVal').value)||0,maxUses:Number($('#cpMax').value)||0,expires:$('#cpExp').value||'',active:$('#cpActive').checked}); } else list.push({id:uid(),code,type:$('#cpType').value,value:Number($('#cpVal').value)||0,maxUses:Number($('#cpMax').value)||0,expires:$('#cpExp').value||'',uses:0,active:$('#cpActive').checked}); DB.set('coupons',list); closeModal(); if($('#screen')._coupons) renderCouponsScreen(); }},{label:t('إلغاء','Cancel'),cls:'btn',onClick:closeModal}]); }
function renderCouponsScreen(){ $('#screen')._coupons=true; $('#screen').innerHTML=`<div class="screen">${pageHead(t('الكوبونات','Coupons'),{sub:t('خصومات وتخفيضات المبيعات','Discounts & promotions'),actions:`<button class="btn btn-primary" onclick="openCouponModal()">＋ ${t('كوبون جديد','New Coupon')}</button>`})}
  ${panel({flush:true, body:`<table class="tbl"><thead><tr><th>${t('الكود','Code')}</th><th>${t('النوع','Type')}</th><th>${t('القيمة','Value')}</th><th>${t('الاستخدامات','Uses')}</th><th></th></tr></thead><tbody>${DB.get('coupons').map(c=>`<tr><td>${esc(c.code)}</td><td>${c.type==='percent'?'%':t('مبلغ','Amount')}</td><td>${fmt(c.value)}</td><td>${c.uses||0}/${c.maxUses||'∞'}</td><td><button class="btn" onclick="openCouponModal('${c.id}')">${t('تعديل','Edit')}</button></td></tr>`).join('')}</tbody></table>`})}</div>`; applyLang(); }
function applyCouponToCart(cart, coupon){ let disc=0; if(!coupon) return {disc:0}; const subtotal=cart.reduce((s,i)=>s+i.subtotal,0); if(coupon.type==='percent') disc=subtotal*(coupon.value/100); else disc=Math.min(coupon.value,subtotal); return {disc}; }
/* ============================ CUSTOMERS ============================ */
function renderCustomers(){ const list=DB.get('customers');   $('#screen').innerHTML=`<div class="screen">${pageHead(t('العملاء','Customers'),{sub:t('العملاء والرصيد والأرصدة الآجلة','Customers, balances & receivables'),actions:`<button class="btn btn-primary" onclick="openCustomerModal()">＋ ${t('عميل جديد','New Customer')}</button><button class="btn" onclick="importCustomers()">${t('استيراد CSV','Import CSV')}</button><button class="btn" onclick="exportCustomers()">${t('تصدير CSV','Export CSV')}</button>`})}
  <div class="filters"><div class="field-inline"><input id="custSearch" placeholder="${t('بحث بالاسم أو الهاتف','Search name or phone')}" oninput="filterCustomersList()"><button class="voice-btn btn sm" onclick="startVoiceSearch('custSearch')">🎤</button></div></div>
  ${panel({flush:true, body:`<table class="tbl"><thead><tr><th>${t('الاسم','Name')}</th><th>${t('الهاتف','Phone')}</th><th>${t('الرصيد','Balance')}</th><th>${t('النقاط','Points')}</th><th></th></tr></thead><tbody>${list.map(c=>`<tr><td>${esc(c.name)}</td><td>${esc(c.phone)}</td><td>${fmt(c.balance)}</td><td>${fmt(c.points)}</td><td><button class="btn" onclick="openCustomerModal('${c.id}')">${t('تعديل','Edit')}</button> <button class="btn" onclick="customerStatement('${c.id}')">${t('كشف حساب','Statement')}</button> <button class="btn btn-danger" onclick="deleteCustomer('${c.id}')">${t('حذف','Delete')}</button></td></tr>`).join('')}</tbody></table>`})}</div>`; applyLang(); }
function filterCustomersList(){ const q=(($('#custSearch').value||'').toLowerCase()); document.querySelectorAll('#screen .tbl tbody tr').forEach(r=>{ r.style.display=r.textContent.toLowerCase().includes(q)?'':'none'; }); }
function openCustomerModal(id){ const c=id?DB.get('customers').find(x=>x.id===id):null; openModal(t('عميل','Customer'), `<div class="form-grid"><label>${t('الاسم','Name')}<input id="cName" value="${esc(c?c.name:'')}"></label><label>${t('الهاتف','Phone')}<input id="cPhone" value="${esc(c?c.phone:'')}"></label><label>${t('البريد','Email')}<input id="cEmail" value="${esc(c?c.email:'')}"></label><label>${t('العنوان','Address')}<input id="cAddr" value="${esc(c?c.address:'')}"></label><label>${t('الرقم الضريبي','Tax No')}<input id="cTax" value="${esc(c?c.taxNo:'')}"></label><label>${t('حد الائتمان','Credit Limit')}<input id="cLimit" type="number" value="${c?c.creditLimit:0}"></label><label>${t('النقاط','Points')}<input id="cPoints" type="number" value="${c?c.points:0}"></label>  </div>`, [{label:t('حفظ','Save'),cls:'btn-primary',onClick:()=>{ const name=$('#cName').value.trim(); if(!name){toast(t('الاسم مطلوب','Name required'));return;} let list=DB.get('customers'); if(c){ const before={name:c.name,phone:c.phone,creditLimit:c.creditLimit,points:c.points}; Object.assign(c,{name,phone:$('#cPhone').value,email:$('#cEmail').value,address:$('#cAddr').value,taxNo:$('#cTax').value,creditLimit:Number($('#cLimit').value)||0,points:Number($('#cPoints').value)||0}); logAudit(t('تعديل عميل','Edit customer'), c.name, {type:CFG.AUDIT.EDIT, ref:c.id, changes:diffChanges(before, c, {name:t('الاسم','Name'),phone:t('الهاتف','Phone'),creditLimit:t('حد الائتمان','Credit limit'),points:t('النقاط','Points')})}); } else { const o={id:uid(),name,phone:$('#cPhone').value,email:$('#cEmail').value,address:$('#cAddr').value,taxNo:$('#cTax').value,creditLimit:Number($('#cLimit').value)||0,points:Number($('#cPoints').value)||0,balance:0,notes:''}; list.push(o); logAudit(t('إضافة عميل','Add customer'), o.name, {type:CFG.AUDIT.ADD, ref:o.id}); } DB.set('customers',list); closeModal(); renderCustomers(); }},{label:t('إلغاء','Cancel'),cls:'btn',onClick:closeModal}]); }
function deleteCustomer(id){ confirmModal(t('حذف','Delete'), t('حذف العميل؟','Delete customer?'), ()=>{ const c=DB.get('customers').find(x=>x.id===id); DB.set('customers',DB.get('customers').filter(x=>x.id!==id)); if(c) logAudit(t('حذف عميل','Delete customer'), c.name, {type:CFG.AUDIT.DELETE, ref:c.id}); renderCustomers(); }); }
/* ============================ SUPPLIERS ============================ */
function renderSuppliers(){ const list=DB.get('suppliers'); $('#screen').innerHTML=`<div class="screen">${pageHead(t('الموردون','Suppliers'),{sub:t('الموردون والأرصدة المستحقة','Suppliers & payables'),actions:`<button class="btn btn-primary" onclick="openSupplierModal()">＋ ${t('مورد جديد','New Supplier')}</button><button class="btn" onclick="importSuppliers()">${t('استيراد CSV','Import CSV')}</button><button class="btn" onclick="exportSuppliers()">${t('تصدير CSV','Export CSV')}</button>`})}
  <div class="filters"><div class="field-inline"><input id="supSearch" placeholder="${t('بحث بالاسم أو الهاتف','Search name or phone')}" oninput="filterSuppliersList()"><button class="voice-btn btn sm" onclick="startVoiceSearch('supSearch')">🎤</button></div></div>
  ${panel({flush:true, body:`<table class="tbl"><thead><tr><th>${t('الاسم','Name')}</th><th>${t('الهاتف','Phone')}</th><th>${t('الرصيد','Balance')}</th><th></th></tr></thead><tbody>${list.map(s=>`<tr><td>${esc(s.name)}</td><td>${esc(s.phone)}</td><td>${fmt(s.balance)}</td><td><button class="btn" onclick="openSupplierModal('${s.id}')">${t('تعديل','Edit')}</button> <button class="btn" onclick="supplierStatement('${s.id}')">${t('كشف حساب','Statement')}</button> <button class="btn btn-danger" onclick="deleteSupplier('${s.id}')">${t('حذف','Delete')}</button></td></tr>`).join('')}</tbody></table>`})}</div>`; applyLang(); }
function filterSuppliersList(){ const q=(($('#supSearch').value||'').toLowerCase()); document.querySelectorAll('#screen .tbl tbody tr').forEach(r=>{ r.style.display=r.textContent.toLowerCase().includes(q)?'':'none'; }); }
function openSupplierModal(id){ const s=id?DB.get('suppliers').find(x=>x.id===id):null; openModal(t('مورد','Supplier'), `<div class="form-grid"><label>${t('الاسم','Name')}<input id="sName" value="${esc(s?s.name:'')}"></label><label>${t('الهاتف','Phone')}<input id="sPhone" value="${esc(s?s.phone:'')}"></label><label>${t('البريد','Email')}<input id="sEmail" value="${esc(s?s.email:'')}"></label><label>${t('العنوان','Address')}<input id="sAddr" value="${esc(s?s.address:'')}"></label>  </div>`, [{label:t('حفظ','Save'),cls:'btn-primary',onClick:()=>{ const name=$('#sName').value.trim(); if(!name){toast(t('الاسم مطلوب','Name required'));return;} let list=DB.get('suppliers'); if(s){ const before={name:s.name,phone:s.phone}; Object.assign(s,{name,phone:$('#sPhone').value,email:$('#sEmail').value,address:$('#sAddr').value}); logAudit(t('تعديل مورد','Edit supplier'), s.name, {type:CFG.AUDIT.EDIT, ref:s.id, changes:diffChanges(before, s, {name:t('الاسم','Name'),phone:t('الهاتف','Phone')})}); } else { const o={id:uid(),name,phone:$('#sPhone').value,email:$('#sEmail').value,address:$('#sAddr').value,balance:0,notes:''}; list.push(o); logAudit(t('إضافة مورد','Add supplier'), o.name, {type:CFG.AUDIT.ADD, ref:o.id}); } DB.set('suppliers',list); closeModal(); renderSuppliers(); }},{label:t('إلغاء','Cancel'),cls:'btn',onClick:closeModal}]); }
function deleteSupplier(id){ confirmModal(t('حذف','Delete'), t('حذف المورد؟','Delete supplier?'), ()=>{ const s=DB.get('suppliers').find(x=>x.id===id); DB.set('suppliers',DB.get('suppliers').filter(x=>x.id!==id)); if(s) logAudit(t('حذف مورد','Delete supplier'), s.name, {type:CFG.AUDIT.DELETE, ref:s.id}); renderSuppliers(); }); }
function customerStatement(id){ partyStatement('customer', id); }
function supplierStatement(id){ partyStatement('supplier', id); }
/* ============================ PARTY STATEMENT (كشف حساب) ============================ */
function buildPartyLedger(kind, id){
  const isCust=kind==='customer';
  const arr=[];
  if(isCust){
    DB.get('invoices').forEach(i=>{ if(i.customerId===id && i.type==='sale'){ arr.push({date:(i.createdAt||'').slice(0,10), code:i.code, desc:t('فاتورة بيع','Sale'), debit:i.total||0, credit:0, ref:i.id}); } });
    DB.get('returns').forEach(r=>{ if(r.customerId===id){ arr.push({date:(r.createdAt||'').slice(0,10), code:r.code, desc:t('مرتجع','Return'), debit:0, credit:r.total||0, ref:r.id}); } });
  } else {
    DB.get('purchases').forEach(p=>{ if(p.supplierId===id){ arr.push({date:(p.createdAt||'').slice(0,10), code:p.code, desc:t('فاتورة شراء','Purchase'), debit:0, credit:p.total||0, ref:p.id}); } });
  }
  DB.get('journal').forEach(j=>{ (j.lines||[]).forEach(l=>{ const c=isCust?CFG.ACC.RECEIVABLE:CFG.ACC.PAYABLE; if(l.accountId===c){ const isDebit=l.debit>0; arr.push({date:j.date, code:j.desc||'', desc:t('قيد','Entry'), debit:isDebit?0:l.debit, credit:isDebit?l.credit:0, ref:j.id}); } }); });
  arr.sort((a,b)=>(a.date||'').localeCompare(b.date||''));
  let bal=0; arr.forEach(e=>{ bal=DEC.add(bal, DEC.sub(e.debit,e.credit)); e.balance=bal; });
  return arr;
}
function partyStatement(kind, id){ const isCust=kind==='customer'; const party=isCust?DB.get('customers').find(x=>x.id===id):DB.get('suppliers').find(x=>x.id===id); if(!party) return; const rows=buildPartyLedger(kind, id); const comp=currentCompany()||{}; const s=DB.getOne('settings')||{};
  const body=`<div class="stmt">
    <div class="stmt-head"><h3>${esc(party.name)}</h3><div class="muted">${isCust?t('كشف حساب عميل','Customer Statement'):t('كشف حساب مورد','Supplier Statement')} — ${fmtDate(new Date().toISOString().slice(0,10))}</div>
    <div class="muted">${esc((comp.name||s.companyName||'')+(party.phone?' · '+party.phone:''))}</div></div>
    <table class="tbl"><thead><tr><th>${t('التاريخ','Date')}</th><th>${t('المرجع','Ref')}</th><th>${t('البيان','Desc')}</th><th>${t('مدين','Debit')}</th><th>${t('دائن','Credit')}</th><th>${t('الرصيد','Balance')}</th></tr></thead><tbody>${rows.length?rows.map(e=>`<tr><td>${fmtDate(e.date)}</td><td>${esc(e.code)}</td><td>${esc(e.desc)}</td><td>${e.debit?money(e.debit):''}</td><td>${e.credit?money(e.credit):''}</td><td class="${e.balance<0?'neg':''}">${money(e.balance)}</td></tr>`).join(''):`<tr><td colspan="6" class="empty">${t('لا حركات','No transactions')}</td></tr>`}</tbody><tfoot><tr><td colspan="5" class="stmt-tot">${t('الرصيد الحالي','Current Balance')}</td><td class="stmt-tot ${party.balance<0?'neg':''}">${money(party.balance||0)}</td></tr></tfoot></table></div>`;
  openModal(t('كشف حساب','Statement')+' · '+esc(party.name), body, [{label:'🖨️ '+t('طباعة','Print'),cls:'btn',onClick:()=>{ const w=window.open('','_blank'); if(w){ w.document.write('<html dir="'+(LANG==='en'?'ltr':'rtl')+'" lang="'+(LANG==='en'?'en':'ar')+'"><head><title>'+esc(party.name)+'</title><link rel="stylesheet" href="print.css"></head><body class="stmt-print">'+body+'</body></html>'); w.document.close(); setTimeout(()=>w.print(),120); } }},
   {label:'PDF',cls:'btn',onClick:()=>{ try{ const doc=pdfDoc(); doc.setFontSize(14); doc.text(t('كشف حساب','Statement')+' - '+party.name,10,16); doc.setFontSize(9); let y=28; doc.text(fmtDate(new Date().toISOString().slice(0,10)),10,24); const head=[t('التاريخ','Date'),t('المرجع','Ref'),t('البيان','Desc'),t('مدين','Debit'),t('دائن','Credit'),t('الرصيد','Balance')]; const rr=rows.map(e=>[fmtDate(e.date),e.code,e.desc,e.debit?fmt(e.debit):'',e.credit?fmt(e.credit):'',fmt(e.balance)]); rr.push(['','',t('الرصيد الحالي','Balance'),'','',fmt(party.balance||0)]); exportTablePDFBody(doc,y,head,rr); doc.save('statement_'+party.name+'.pdf'); }catch(e){ toast(t('تعذر إنشاء PDF','PDF failed')); } }},
   {label:t('إغلاق','Close'),cls:'btn',onClick:closeModal}]);
  logAudit(t('كشف حساب','Statement'), (isCust?t('عميل','Customer'):t('مورد','Supplier'))+': '+party.name, {type:CFG.AUDIT.OTHER});
}
function exportTablePDFBody(doc,y,headers,rows){ const startX=10; const pageW=doc.internal.pageSize.getWidth(); const cols=headers.length; const avail=pageW-startX-10; const cw=headers.map(()=>avail/cols); const drawHead=()=>{ let x=startX; doc.setFillColor(59,91,219); doc.setTextColor(255,255,255); headers.forEach((h,i)=>{ doc.rect(x,y,cw[i],7,'F'); doc.text(String(h==null?'':h),x+2,y+5); x+=cw[i]; }); doc.setTextColor(0,0,0); y+=7; }; drawHead(); rows.forEach(r=>{ if(y>280){ doc.addPage(); y=16; drawHead(); } let x=startX; r.forEach((c,i)=>{ doc.rect(x,y,cw[i],7); doc.text(String(c==null?'':c),x+2,y+5); x+=cw[i]; }); y+=7; }); }
/* ============================ INVENTORY ============================ */
function renderInventory(){ const products=DB.get('products'); const whs=DB.get('warehouses'); const movs=DB.get('movements').slice(-50).reverse(); const whCols=whs.map(w=>`<th>${esc(w.name)}</th>`).join('');
  const totalItems=products.length;
  const purchaseValue=products.reduce((s,p)=>s+(p.qty||0)*(p.buyingPrice||0),0);
  const sellValue=products.reduce((s,p)=>s+(p.qty||0)*(p.sellingPrice||0),0);
  const lowStock=products.filter(p=>(p.qty||0)<=(p.minQty||0)&&p.status!=='inactive').length;
  const bento=`<div class="bento-grid"><div class="bento-card accent"><div class="bento-val">${totalItems}</div><div class="bento-lbl">${t('إجمالي الأصناف','Total Items')}</div></div><div class="bento-card"><div class="bento-val">${money(purchaseValue)}</div><div class="bento-lbl">${t('قيمة المخزون (شراء)','Purchase Value')}</div></div><div class="bento-card"><div class="bento-val">${money(sellValue)}</div><div class="bento-lbl">${t('القيمة البيعية','Selling Value')}</div></div><div class="bento-card ${lowStock>0?'dark':''}"><div class="bento-val">${lowStock}</div><div class="bento-lbl">${t('أصناف منخفضة','Low Stock')}</div></div></div>`;
  $('#screen').innerHTML=`<div class="screen">${pageHead(t('المخزون','Inventory'),{icon:'📦',sub:t('أرصدة المخازن والحركات','Stock by warehouse & movements'),actions:`<button class="btn" onclick="openAdjustModal()">${t('تسوية','Adjust')}</button><button class="btn" onclick="openTransferModal()">${t('نقل','Transfer')}</button><button class="btn btn-primary" onclick="openStocktakeModal()">${t('جرد','Stocktake')}</button>`})}
  ${bento}
  ${panel({flush:true, body:`<table class="tbl"><thead><tr><th>${t('المنتج','Product')}</th>${whCols}<th>${t('الإجمالي','Total')}</th><th>${t('الحالة','Status')}</th><th></th></tr></thead><tbody>${products.map(p=>{ const low=(p.qty||0)<=(p.minQty||0); const cells=whs.map(w=>`<td class="${whStock(p,w.id)<=(p.minQty||0)?'qty-low':''}">${fmt(whStock(p,w.id))}</td>`).join(''); return `<tr><td>${esc(p.name)}</td>${cells}<td class="${low?'qty-low':''}">${fmt(p.qty)}</td><td>${low?('⚠️ '+t('منخفض','Low')):(p.status==='active'?t('نشط','Active'):t('معطل','Inactive'))}</td><td><button class="btn sm" onclick="adjStockInline('${p.id}',1)">＋</button> <button class="btn sm" onclick="adjStockInline('${p.id}',-1)">−</button> <button class="btn sm" onclick="shareProductAsImage('${p.id}')">🖼️</button></td></tr>`; }).join('')}</tbody></table>`})}
  <div class="section-title">${t('حركة المخزون','Movements')}</div>${panel({flush:true, body:`<table class="tbl"><thead><tr><th>${t('التاريخ','Date')}</th><th>${t('المنتج','Product')}</th><th>${t('النوع','Type')}</th><th>${t('الكمية','Qty')}</th><th>${t('من/إلى','From/To')}</th></tr></thead><tbody>${movs.map(m=>{ const p=products.find(x=>x.id===m.productId); return `<tr><td>${fmtDateTime(m.time)}</td><td>${esc(p?p.name:'')}</td><td>${esc(m.type)}</td><td>${fmt(m.qty)}</td><td>${esc(m.wh||'')}</td></tr>`; }).join('')}</tbody></table>`})}</div>`; applyLang(); }
function adjStockInline(pid,delta){
  const products=DB.get('products');
  const p=products.find(x=>x.id===pid);
  if(!p) return;
  const newQty=Math.max(0,(p.qty||0)+delta);
  adjStock(p,newQty-(p.qty||0),defaultWhId());
  DB.set('products',products);
  const movements=DB.get('movements');
  movements.push({id:uid(),time:nowISO(),productId:pid,type:delta>0?t('إضافة','Add'):t('خصم','Remove'),qty:delta,wh:'',note:''});
  DB.set('movements',movements);
  renderInventory();
}
function shareProductAsImage(id){
  const p=DB.get('products').find(x=>x.id===id); if(!p) return;
  openModal(t('مشاركة المنتج','Share Product'),`<div id="prodShareCard" style="padding:20px;text-align:center;background:var(--panel);border-radius:var(--radius)"><h3>${esc(p.name)}</h3><p>${t('الكود','Code')}: ${esc(p.code||p.barcode||'')}</p><p>${t('شراء','Buy')}: ${money(p.buyingPrice)} · ${t('بيع','Sell')}: ${money(p.sellingPrice)}</p><p>${t('الكمية','Qty')}: ${fmt(p.qty)}</p><p>${t('التصنيف','Category')}: ${esc(p.category||'')}</p></div>`,[{label:t('مشاركة','Share'),cls:'btn-primary',onClick:()=>{closeModal();shareAsJPG('prodShareCard',p.name);}},{label:t('إغلاق','Close'),cls:'btn',onClick:closeModal}]);
}
function openAdjustModal(){ const reasons=[['count',t('جرد','Count')],['loss',t('فاقد','Loss')],['damage',t('تالف','Damage')],['found',t('موجود إضافي','Found')],['correction',t('تصحيح','Correction')]];
  openModal(t('تسوية مخزون','Stock Adjust'), `<div class="form-grid"><label>${t('المنتج','Product')}<select id="adjProd">${DB.get('products').map(p=>`<option value="${p.id}">${esc(p.name)}</option>`).join('')}</select></label><label>${t('الكمية الصحيحة','Correct Qty')}<input id="adjQty" type="number" value="0"></label><label>${t('نوع التسوية','Type')}<select id="adjType">${reasons.map(r=>`<option value="${r[0]}">${r[1]}</option>`).join('')}</select></label><label>${t('السبب','Reason')}<input id="adjReason" value="${t('جرد','Count')}"></label></div>`, [{label:t('تطبيق','Apply'),cls:'btn-primary',onClick:()=>{ const products=DB.get('products'); const pid=$('#adjProd').value; const p=products.find(x=>x.id===pid); if(!p) return; const q=Number($('#adjQty').value)||0; const diff=q-(p.qty||0); const cost=p.buyingPrice||0; const val=Math.abs(diff)*cost; const type=$('#adjType').value; const reason=$('#adjReason').value||type; if(!p.stockByWh)p.stockByWh={};p.stockByWh[defaultWhId()]=q;recountQty(p); DB.set('products',products); const movements=DB.get('movements'); movements.push({id:uid(),time:nowISO(),productId:pid,type:t('تسوية','Adjust'),qty:diff,wh:'',note:(reason+' / '+type)}); DB.set('movements',movements);
    if(diff!==0){ const J=DB.get('journal'); const d=new Date().toISOString().slice(0,10); const lines=diff<0?[{accountId:CFG.ACC.LOSS,debit:val,credit:0},{accountId:CFG.ACC.INVENTORY,debit:0,credit:val}]:[{accountId:CFG.ACC.INVENTORY,debit:val,credit:0},{accountId:CFG.ACC.ADJUST,debit:0,credit:val}]; J.push({id:uid(),date:d,desc:t('تسوية','Adjust')+' '+p.name,lines:normalizeLines(lines),ref:'adj_'+pid}); DB.set('journal',J); }
    logAudit(t('تسوية مخزون','Stock adjust'),p.name+' ('+reason+')'); closeModal(); renderInventory(); }},{label:t('إلغاء','Cancel'),cls:'btn',onClick:closeModal}]); }
function openStocktakeModal(){ const whs=DB.get('warehouses'); const def=whs[0]?whs[0].id:'';
  const rows=DB.get('products').filter(p=>p.status!=='inactive').map(p=>`<tr class="stk-row" data-name="${(p.name||'').toLowerCase().replace(/"/g,'')}"><td>${esc(p.name)}</td><td class="stk-cur">${fmt(whStock(p,def))}</td><td><input id="stk_${p.id}" type="number" value="${fmt(whStock(p,def))}" class="stk-input" data-id="${p.id}"></td></tr>`).join('');
  openModal(t('جرد المخزون','Stocktake'), `<div class="form-grid"><label>${t('المخزن','Warehouse')}<select id="stkWh" onchange="stkReloadCur()">${whs.map(w=>`<option value="${w.id}">${esc(w.name)}</option>`).join('')}</select></label><input id="stkSearch" placeholder="${t('بحث عن صنف','Search item')}" oninput="stkFilter(this.value)" class="field-min-w"><span class="muted">${t('أدخل الكمية الفعلية المعدودة لكل صنف، ثم طبّق الفروق','Enter actual counted qty per item, then apply differences')}</span></div><div class="stk-scroll"><table class="tbl stk-tbl"><thead><tr><th>${t('المنتج','Product')}</th><th>${t('الحالي','Current')}</th><th>${t('المعدود','Counted')}</th></tr></thead><tbody id="stkBody">${rows}</tbody></table></div>`, [
    {label:t('تطبيق الفروق','Apply Differences'),cls:'btn-primary',onClick:()=>{ const wh=$('#stkWh').value; const products=DB.get('products'); const movements=DB.get('movements'); const J=DB.get('journal'); const d=new Date().toISOString().slice(0,10); let n=0;
      products.forEach(p=>{ if(p.status==='inactive') return; const inp=$('#stk_'+p.id); if(!inp) return; const counted=Number(inp.value)||0; const cur=whStock(p,wh); const diff=counted-cur; if(diff===0) return; adjStock(p,diff,wh); movements.push({id:uid(),time:nowISO(),productId:p.id,type:t('جرد','Stocktake'),qty:diff,wh:(whs.find(w=>w.id===wh)||{}).name||'',note:t('جرد','Stocktake')}); const val=Math.abs(diff)*(p.buyingPrice||0); if(val>0){ const lines=diff<0?[{accountId:CFG.ACC.LOSS,debit:val,credit:0},{accountId:CFG.ACC.INVENTORY,debit:0,credit:val}]:[{accountId:CFG.ACC.INVENTORY,debit:val,credit:0},{accountId:CFG.ACC.ADJUST,debit:0,credit:val}]; J.push({id:uid(),date:d,desc:t('جرد','Stocktake')+' '+p.name,lines:normalizeLines(lines),ref:'stk_'+p.id}); } n++; });
      DB.set('products',products); DB.set('movements',movements); DB.set('journal',J);
      logAudit(t('جرد المخزون','Stocktake'), (whs.find(w=>w.id===wh)||{}).name||'', {type:CFG.AUDIT.OTHER, changes:{items:n}}); closeModal(); renderInventory(); toast(t('تم الجرد','Stocktake done')+': '+n); }},
    {label:t('إلغاء','Cancel'),cls:'btn',onClick:closeModal}]);
}
function stkReloadCur(){ const wh=$('#stkWh').value; DB.get('products').filter(p=>p.status!=='inactive').forEach(p=>{ const inp=$('#stk_'+p.id); if(inp) inp.value=fmt(whStock(p,wh)); }); }
function stkFilter(q){ const v=(q||'').toLowerCase(); $$('.stk-row').forEach(r=>{ r.style.display=(!v||(r.dataset.name||'').indexOf(v)>=0)?'':'none'; }); }
/* ============================ MULTI-WAREHOUSE STOCK ============================ */
function defaultWhId(){ const whs=DB.get('warehouses'); return (whs[0]&&whs[0].id)||null; }
function ensureStockByWh(){ const whs=DB.get('warehouses'); const def=whs[0]&&whs[0].id; const products=DB.get('products'); let changed=false;
  products.forEach(p=>{ if(!p.stockByWh || typeof p.stockByWh!=='object'){ p.stockByWh={}; if(def!=null) p.stockByWh[def]=p.qty||0; changed=true; } if(def!=null && p.stockByWh[def]==null && !(p.qty>0)) p.stockByWh[def]=0; });
  if(changed) DB.set('products',products); return products; }
function whStock(p, whId){ if(!p.stockByWh) return (p.qty||0); return Number(p.stockByWh[whId||defaultWhId()]||0); }
function recountQty(p){ let s=0; if(p.stockByWh) Object.keys(p.stockByWh).forEach(k=>s+=Number(p.stockByWh[k])||0); else s=p.qty||0; p.qty=s; }
function adjStock(p, delta, whId){ if(!p.stockByWh) p.stockByWh={}; const w=whId||defaultWhId(); p.stockByWh[w]=(Number(p.stockByWh[w]||0))+delta; if(p.stockByWh[w]<0) p.stockByWh[w]=0; recountQty(p); }
function openTransferModal(){ const whs=DB.get('warehouses'); if(whs.length<2){ toast(t('أضف مخزنين على الأقل للنقل','Add at least two warehouses to transfer')); return; }
  const defWh=whs[0].id;
  openModal(t('نقل بين المخازن','Transfer'), `<div class="form-grid"><label>${t('المنتج','Product')}<select id="trProd" onchange="trWhInfo()">${DB.get('products').map(p=>`<option value="${p.id}">${esc(p.name)}</option>`).join('')}</select></label><div id="trInfo" class="muted text-muted-sm"></div><label>${t('من','From')}<select id="trFrom">${whs.map(w=>`<option value="${w.id}">${esc(w.name)}</option>`).join('')}</select></label><label>${t('إلى','To')}<select id="trTo">${whs.map(w=>`<option value="${w.id}">${esc(w.name)}</option>`).join('')}</select></label><label>${t('الكمية','Qty')}<input id="trQty" type="number" value="1" min="1"></label></div>`, [{label:t('نقل','Transfer'),cls:'btn-primary',onClick:()=>{ const pid=$('#trProd').value; const from=$('#trFrom').value; const to=$('#trTo').value; const q=Math.floor(Number($('#trQty').value)||0); const products=DB.get('products'); const p=products.find(x=>x.id===pid); if(!p) return; if(from===to){ toast(t('اختر مخزنين مختلفين','Choose different warehouses')); return; } if(q<=0){ toast(t('الكمية يجب أن تكون أكبر من صفر','Qty must be > 0')); return; } if(whStock(p,from)<q){ toast(t('رصيد غير كافٍ في المصدر','Insufficient stock at source')); return; }
    adjStock(p,-q,from); adjStock(p,q,to); DB.set('products',products);
    const movements=DB.get('movements'); const fromName=(whs.find(w=>w.id===from)||{}).name; const toName=(whs.find(w=>w.id===to)||{}).name; movements.push({id:uid(),time:nowISO(),productId:pid,type:t('نقل','Transfer'),qty:q,wh:(fromName+' → '+toName)}); DB.set('movements',movements);
    logAudit(t('نقل مخزون','Stock transfer'), p.name+' ('+fromName+' → '+toName+', '+fmt(q)+')', {type:CFG.AUDIT.OTHER}); toast(t('تم النقل','Transferred')); closeModal(); renderInventory(); }},{label:t('إلغاء','Cancel'),cls:'btn',onClick:closeModal}]);
  setTimeout(trWhInfo,30); }
function trWhInfo(){ const pid=$('#trProd'); if(!pid) return; const p=DB.get('products').find(x=>x.id===pid.value); const box=$('#trInfo'); if(!p||!box) return; const whs=DB.get('warehouses'); box.innerHTML=whs.map(w=>esc(w.name)+': '+fmt(whStock(p,w.id))).join(' · '); }
/* ============================ SALES / POS ============================ */
let _cart=[], _coupon=null, _editingSaleId=null, _payType='cash', _paidInput=0, _totalsOpen=true, _invDisc=0;
function renderSales(editId){ if(editId) _editingSaleId=editId; _cart=[]; _coupon=null; _invDisc=0; let editInv=null;
  if(_editingSaleId){ editInv=DB.get('invoices').find(x=>x.id===_editingSaleId)||null; if(editInv){ _cart=editInv.items.map(it=>({id:it.productId,code:it.code,name:it.name,buying:it.buying,selling:it.price,qty:it.qty,disc:Number(it.disc)||0,tax:Number(it.tax)||0}));     if(editInv.coupon){ const c=getCoupon(editInv.coupon); if(c) _coupon=c; } } }
  if(editInv && $('#posNotes')) $('#posNotes').value=editInv.notes||'';
  const products=DB.get('products').filter(p=>p.status!=='inactive'); const cats=[...new Set(products.map(p=>p.category))];
  const banner=editInv?`<div class="edit-banner">${t('تعديل فاتورة','Editing invoice')} <b>${esc(editInv.code)}</b> <button class="btn sm" onclick="cancelSaleEdit()">${t('إلغاء','Cancel')}</button></div>`:'';
   $('#screen').innerHTML=`<div class="screen pos-center">${banner}<div class="pos-mid"><div class="pos-head">
      <div class="pos-paybar">
        <div class="toggle"><button class="btn ${_payType==='cash'?'btn-primary':''}" onclick="setPayType('cash')">${t('نقدي','Cash')}</button><button class="btn ${_payType==='credit'?'btn-primary':''}" onclick="setPayType('credit')">${t('آجل','Credit')}</button></div>
        <button class="btn btn-primary" data-sell onclick="saveSale(_payType)">${t('حفظ','Save')}</button>
      </div>
      <div class="pos-head-row">
        <div class="pos-cust"><label>${t('العميل','Customer')}</label><input id="posCust" list="posCustList" placeholder="${t('بحث عن عميل','Search customer')}" value="${editInv?esc(editInv.customerName||''):''}" oninput="setCustFromName('posCust','posCustId','customers')"><input type="hidden" id="posCustId" value="${editInv?editInv.customerId:''}"><datalist id="posCustList">${DB.get('customers').map(c=>`<option value="${esc(c.name)}">`).join('')}</datalist></div>
        <div class="pos-notes"><label>${t('ملاحظات','Notes')}</label><input id="posNotes" placeholder="${t('ملاحظات','Notes')}"></div>
      </div>
      <div class="pos-search"><input id="posSearch" placeholder="${t('بحث عن منتج وإضافته للفاتورة (F2)','Search product & add to invoice (F2)')}" oninput="posSearch(this.value)" onkeydown="posSearchKey(event)"><button class="btn" onclick="openBarcodeScan()">📷</button><div id="posAC" class="pos-ac"></div></div>
      <div class="pos-coupon"><input id="posCoupon" placeholder="${t('كوبون','Coupon')}"><button class="btn" onclick="applyCoupon()">${t('تطبيق','Apply')}</button></div>
    </div>
      <div class="pos-cart-wrap"><table class="tbl pos-cart" id="posCart"><thead><tr><th>${t('الصنف','Item')}</th><th>${t('الوحدة','Unit')}</th><th>${t('الكمية','Qty')}</th><th>${t('السعر','Price')}</th><th>${t('خصم%','Disc%')}</th><th>${t('الإجمالي','Total')}</th></tr></thead><tbody id="posCartBody"></tbody></table></div>
      <div class="pos-foot fixed-foot"><div class="pos-totals" id="posTotals"></div></div>
    </div></div>`;
    if(editInv && $('#posCust')) $('#posCust').value=editInv.customerName||'';
   window._posFilter=''; renderCart(); posRenderPaid();
    if($('#posProdSearch')) $('#posProdSearch').focus(); applyLang(); if(window._posKey) document.removeEventListener('keydown',window._posKey); window._posKey=posKeyHandler; document.addEventListener('keydown',posKeyHandler); if(window._bcKey) document.removeEventListener('keydown',window._bcKey); window._bcKey=bcKey; document.addEventListener('keydown',bcKey); }
function cancelSaleEdit(){ _editingSaleId=null; renderSales(); }
function posFilter(c){ window._posFilter=c; }
function setCustFromName(inputId,hiddenId,arr){ const v=($('#'+inputId).value||'').trim(); const rec=DB.get(arr).find(r=>r.name===v); $('#'+hiddenId).value=rec?rec.id:''; }
function posSearch(v){ const s=$('#posSearch'); if(!v){ posAutocomplete(''); return; } const r=DB.get('products').filter(p=>(p.barcode||'')===v.trim()||(p.code||'').toLowerCase()===v.trim().toLowerCase()); if(r.length===1){ addToCart(r[0].id); if(s) s.value=''; posAutocomplete(''); } else { posAutocomplete(v); } }
function posAutocomplete(v){ const box=$('#posAC'); if(!box) return; if(!v){ box.style.display='none'; box.innerHTML=''; return; } const q=v.toLowerCase(); const list=DB.get('products').filter(p=>p.status!=='inactive' && ((p.name||'').toLowerCase().includes(q)||(p.barcode||'').includes(v)||(p.code||'').toLowerCase().includes(q))).slice(0,8); if(!list.length){ box.style.display='none'; box.innerHTML=''; return; } box.innerHTML=list.map(p=>`<div class="ac-item" data-id="${p.id}" onclick="posAcPick('${p.id}')"><div class="ac-name">${esc(p.name)}</div><div class="ac-meta">${money(p.sellingPrice)} · ${t('متاح','Av')}: ${fmt(p.qty)}</div></div>`).join(''); box.style.display='block'; }
function posAcPick(id){ addToCart(id); const s=$('#posSearch'); if(s){ s.value=''; s.focus(); } posAutocomplete(''); }
function posSearchKey(e){ if(e.key==='ArrowDown'||e.key==='Enter'){ const box=$('#posAC'); if(box&&box.style.display!=='none'){ const first=box.querySelector('.ac-item'); if(first){ e.preventDefault(); posAcPick(first.getAttribute('data-id')); } } } }
function posKeyHandler(e){ if(!$('#posProdSearch')) return; if($('#modalRoot')&&$('#modalRoot').childElementCount>0) return; if(e.key==='F2'){ e.preventDefault(); $('#posProdSearch').focus(); } else if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s'){ e.preventDefault(); if(_cart.length) quickCash(0); } else if(e.key==='Escape'){ if(_cart.length){ _cart=[]; renderCart(); posAutocomplete(''); } } }
/* Barcode scanner: scanner acts as keyboard, types code then Enter. When POS search not focused, buffer keystrokes and add on Enter. */
let _bcBuf='', _bcTimer=null;
function bcKey(e){ if(e.metaKey||e.ctrlKey||e.altKey) return;
  if(e.key==='Enter'){ const code=_bcBuf.trim(); _bcBuf=''; if(code){ const p=DB.get('products').find(x=>(x.barcode||'')===code||(x.code||'')===code||(x.code||'')===code.toLowerCase()); if(p){ addToCart(p.id); if($('#posSearch')) $('#posSearch').value=''; toast(t('تمت الإضافة','Added')+' · '+p.name); } else { toast(t('باركود غير معروف','Unknown barcode')+' '+code); } } return; }
  if(e.key && e.key.length===1){ const t=e.target; const typing=t&&(t.tagName==='INPUT'||t.tagName==='TEXTAREA'||t.tagName==='SELECT'); if(typing){ _bcBuf=''; return; } _bcBuf+=e.key; clearTimeout(_bcTimer); _bcTimer=setTimeout(()=>{_bcBuf='';}, 600); } }
/* Auto-lock after inactivity when a PIN is set */
let _idleTimer=null;
function resetIdle(){ if(_idleTimer) clearTimeout(_idleTimer); const s=DB.getOne('settings')||{}; if(!s.pin) return; const mins=Number(s.autoLockMin)||5; _idleTimer=setTimeout(()=>{ const ov=$('#lockOverlay'); if(ov && !ov.classList.contains('hidden')) return; if($('#modalRoot')&&$('#modalRoot').childElementCount>0) return; showLock(renderShell); }, mins*60000); }
function posRenderGrid(q){ q=q||$('#posProdSearch').value||''; const list=DB.get('products').filter(p=>p.status!=='inactive').filter(p=>!window._posFilter||p.category===window._posFilter).filter(p=>(!q)||(p.name||'').toLowerCase().includes(q.toLowerCase())||(p.barcode||'').includes(q));   $('#posGrid').innerHTML=list.map(p=>`<button class="pos-item${p.qty<=0?' out':''}" onclick="addToCart('${p.id}')"><div class="pi-name">${esc(p.name)}</div><div class="pi-price">${money(p.sellingPrice)}</div><div class="pi-qty">${t('متاح','Av')}: ${fmt(p.qty)}</div></button>`).join(''); }
function addToCart(id){ const p=DB.get('products').find(x=>x.id===id); if(!p) return; const line=_cart.find(i=>i.id===id); const cur=line?line.qty:0; if((p.qty||0)<=cur){ toast(t('رصيد غير كافٍ','Insufficient stock')+': '+p.name); return; } if(line){ line.qty++; } else { _cart.push({id,code:p.code,name:p.name,buying:p.buyingPrice,selling:p.sellingPrice,qty:1,disc:Number(p.defaultDiscount)||0,tax:Number(p.tax)||0}); } renderCart(); try{ playAddSound(); }catch(e){} }
function changeQty(id,d){ const l=_cart.find(i=>i.id===id); if(l){ l.qty+=d; if(l.qty<=0) _cart=_cart.filter(i=>i.id!==id); } renderCart(); }
function setLineField(id,field,val){ const l=_cart.find(i=>i.id===id); if(l) l[field]=Number(val)||0; renderCart(); }
function setInvDisc(v){ _invDisc=Number(v)||0; renderCart(); }
function applyCoupon(){ const code=$('#posCoupon').value.trim(); if(!code){ _coupon=null; toast(t('أُلغي الكوبون','Coupon cleared')); renderCart(); return; } const c=getCoupon(code); if(!c){ toast(t('كوبون غير صالح','Invalid coupon')); return; } _coupon=c; toast(t('تم التطبيق','Applied')); renderCart(); }
function cartTotals(){ const subtotal=DEC.sum(_cart.map(i=>DEC.mul(i.selling,i.qty))); const discAmt=DEC.sum(_cart.map(i=>DEC.mul(DEC.mul(i.selling,i.qty), i.disc/100))); let couponDisc=0; if(_coupon){ couponDisc=applyCouponToCart(_cart,_coupon).disc; } couponDisc=DEC.round(couponDisc); const invDiscAmt=DEC.mul(subtotal, _invDisc/100); const afterDisc=DEC.sub(DEC.sub(DEC.sub(subtotal, discAmt), couponDisc), invDiscAmt); const taxRate=getTaxRate(); const tax=DEC.mul(afterDisc, taxRate/100); const total=DEC.add(afterDisc,tax); return {subtotal,discAmt,couponDisc,invDiscAmt,tax,total}; }
function renderCart(){ const tt=cartTotals(); const prods=DB.get('products'); $('#posCartBody').innerHTML=_cart.map(i=>{ const av=(prods.find(x=>x.id===i.id)||{}).qty||0; const warn=i.qty>av?' class="cart-warn"':''; const unit=(prods.find(x=>x.id===i.id)||{}).unit||''; return `<tr${warn}><td>${esc(i.name)}</td><td>${esc(unit)}</td><td><button class="btn sm" onclick="changeQty('${i.id}',-1)">-</button> ${i.qty} <button class="btn sm" onclick="changeQty('${i.id}',1)">+</button></td><td>${money(i.selling)}</td><td><input class="mini" type="number" value="${i.disc}" oninput="setLineField('${i.id}','disc',this.value)">%</td><td>${money(i.selling*i.qty)}</td><td><button class="btn sm btn-danger" onclick="changeQty('${i.id}',-999)">×</button></td></tr>`; }).join('')||`<tr><td colspan="7">${t('السلة فارغة','Empty cart')}</td></tr>`;
  let details=`<div><span>${t('المجموع','Subtotal')}</span><span>${money(tt.subtotal)}</span></div><div class="disc-row"><span>${t('خصم','Discount')}</span><input class="mini tot-disc" id="invDisc" type="number" value="${_invDisc}" oninput="setInvDisc(this.value)"></div><div><span>${t('ضريبة','Tax')} ${getTaxRate()}%</span><span>${money(tt.tax)}</span></div>`;
  if(_payType==='credit'){ details+=`<div class="pay-field"><label>${t('المبلغ المدفوع','Paid')}</label><input id="posPaid" type="number" oninput="posRenderPaid()"></div><div class="pos-grand remain"><span>${t('المتبقي','Remaining')}</span><span id="posRemain">${money(tt.total)}</span></div>`}
  let html=`<div class="tot-details" id="totDetails" style="display:${_totalsOpen?'block':'none'}">${details}</div>`;
  html+=`<div class="pos-grand tot-row"><span>${t('الإجمالي','Total')}</span><span>${money(tt.total)}</span><button class="tot-arrow" type="button" onclick="toggleTotals()">${_totalsOpen?'▲':'▼'}</button></div>`;
  if(_coupon) html+=`<div class="coupon-tag">🎟️ ${esc(_coupon.code)} ${t('-','-')} ${money(tt.couponDisc)}</div>`;
  $('#posTotals').innerHTML=html; posRenderPaid(); }
function toggleTotals(){ _totalsOpen=!_totalsOpen; const d=$('#totDetails'); if(d) d.style.display=_totalsOpen?'block':'none'; const a=document.querySelector('.tot-arrow'); if(a) a.textContent=_totalsOpen?'▲':'▼'; }
function setPayType(t){ _payType=t; const btns=document.querySelectorAll('.toggle .btn'); if(btns.length){ btns[0].classList.toggle('btn-primary',t==='cash'); btns[1].classList.toggle('btn-primary',t==='credit'); } if(t==='cash'){ _paidInput=0; } renderCart(); }
function posRenderPaid(){ const tt=cartTotals(); const paidEl=$('#posPaid'); const paid=paidEl?(Number(paidEl.value)||0):0; _paidInput=paid; const rem=Math.max(0,tt.total-paid); const remEl=$('#posRemain'); if(remEl) remEl.textContent=(paid>0&&rem<=0)?t('مدفوع بالكامل','Fully paid'):money(rem); }
function openBarcodeScan(){ openModal(t('مسح الباركود','Scan Barcode'), `<p>${t('أدخل الباركود يدويًا أو عبر كاميرا','Enter barcode manually or via camera')}</p><input id="scanInput" class="full" onkeydown="if(event.key==='Enter'){addByBarcode(this.value);}"><button class="btn" onclick="addByBarcode($('#scanInput').value)">${t('إضافة','Add')}</button>`, [{label:t('إغلاق','Close'),cls:'btn',onClick:closeModal}]); }
function addByBarcode(code){ const p=DB.get('products').find(x=>(x.barcode||'')===code.trim()||(x.code||'')===code.trim()); if(p){ addToCart(p.id); closeModal(); } else toast(t('غير موجود','Not found')); }
function openSplitPay(){ const tt=cartTotals(); openModal(t('تقسيم الدفع','Split Payment'), `<div id="splitRows"></div><div class="split-add"><select id="splitType"><option value="cash">${t('نقد','Cash')}</option><option value="card">${t('بطاقة','Card')}</option><option value="wallet">${t('محفظة','Wallet')}</option><option value="credit">${t('آجل','Credit')}</option></select><input id="splitAmt" type="number" placeholder="${t('المبلغ','Amount')}"><button class="btn" onclick="addSplitRow()">${t('إضافة','Add')}</button></div><div id="splitTotal"></div>`, [{label:t('تأكيد الدفع','Confirm'),cls:'btn-primary',onClick:()=>{ window._splits=window._splits||[]; const sum=window._splits.reduce((s,x)=>s+x.amt,0); if(Math.abs(sum-tt.total)>0.01){ toast(t('المبلغ لا يطابق الإجمالي','Amount mismatch')); return; } closeModal(); finishSaleWithSplits(window._splits); }},{label:t('إلغاء','Cancel'),cls:'btn',onClick:closeModal}]); renderSplitTotal(); }
function addSplitRow(){ const amt=Number($('#splitAmt').value)||0; const type=$('#splitType').value; window._splits=window._splits||[]; window._splits.push({type,amt}); renderSplitRows(); renderSplitTotal(); $('#splitAmt').value=''; }
function renderSplitRows(){ $('#splitRows').innerHTML=(window._splits||[]).map((s,i)=>`<div>${s.type} : ${money(s.amt)} <button class="btn sm btn-danger" onclick="removeSplit(${i})">×</button></div>`).join(''); }
function removeSplit(i){ window._splits.splice(i,1); renderSplitRows(); renderSplitTotal(); }
function renderSplitTotal(){ const sum=(window._splits||[]).reduce((s,x)=>s+x.amt,0); $('#splitTotal').innerHTML=`<div>${t('المدفوع','Paid')}: ${money(sum)} / ${money(cartTotals().total)}</div>`; }
function finishSaleWithSplits(splits){ const inv=buildSaleInvoice('split'); inv.payments=splits; inv.paid=splits.reduce((s,x)=>s+x.amt,0); inv.change=0; finalizeSale(inv, splits.some(s=>s.type==='credit')); }
function openInstallment(){ const tt=cartTotals(); openModal(t('تقسيط','Installment'), `<div class="form-grid"><label>${t('عدد الأقساط','Months')}<input id="insCount" type="number" value="3"></label><label>${t('الدفعة الأولى','Down Payment')}<input id="insDown" type="number" value="0"></label><label>${t('الفائدة %','Interest %')}<input id="insInt" type="number" value="0"></label><label>${t('تاريخ البداية','Start')}<input id="insStart" type="date" value="${new Date().toISOString().slice(0,10)}"></label></div><div id="insPreview"></div>`, [{label:t('موافق','OK'),cls:'btn-primary',onClick:()=>{ const count=Number($('#insCount').value)||1; const down=Number($('#insDown').value)||0; const interest=Number($('#insInt').value)||0; const start=$('#insStart').value; const schedule=buildSchedule(tt.total-down,count,interest,start); $('#insPreview').innerHTML='<table class="tbl"><thead><tr><th>#</th><th>'+t('التاريخ','Date')+'</th><th>'+t('المبلغ','Amount')+'</th></tr></thead><tbody>'+schedule.map((s,i)=>`<tr><td>${i+1}</td><td>${fmtDate(s.date)}</td><td>${money(s.amount)}</td></tr>`).join('')+'</tbody></table>'; window._installment={schedule,down}; toast(t('تمت جدولة التقسيط','Scheduled')); closeModal(); finalizeInstallmentSale(); }},{label:t('إلغاء','Cancel'),cls:'btn',onClick:closeModal}]); }
function buildSchedule(principal,count,interest,start){ const total=principal*(1+interest/100); const per=total/count; const arr=[]; const d=new Date(start); for(let i=0;i<count;i++){ const dt=new Date(d); dt.setMonth(d.getMonth()+i); arr.push({date:dt.toISOString().slice(0,10),amount:per}); } return arr; }
function finalizeInstallmentSale(){ const inv=buildSaleInvoice('installment'); const ins=window._installment; inv.down=ins.down; inv.installment=ins.schedule; inv.paid=ins.down; inv.remaining=inv.total-ins.down; inv.due=ins.schedule[0]?ins.schedule[0].date:null; finalizeSale(inv,true); }
function buildSaleInvoice(type){ const t=cartTotals(); const custId=$('#posCustId').value||DB.get('customers')[0].id; const cust=DB.get('customers').find(c=>c.id===custId)||DB.get('customers')[0];   const code=nextNumber('INV','INV-',6); const notes=$('#posNotes')?$('#posNotes').value.trim():''; return {id:uid(),code,type:'sale',customerId:custId,customerName:cust?cust.name:'',notes,branchId:_activeBranchId,companyId:_activeCompanyId,payment:type,items:_cart.map(i=>({productId:i.id,code:i.code,name:i.name,qty:i.qty,price:i.selling,buying:i.buying,disc:i.disc,tax:i.tax,subtotal:i.selling*i.qty})),subtotal:t.subtotal,discount:t.discAmt+couponDisc2(t)+t.invDiscAmt,tax:t.tax,total:t.total,coupon:_coupon?_coupon.code:null,createdAt:nowISO(),status:'completed'}; }
function couponDisc2(t){ return t.couponDisc||0; }
function saveSale(type){ if(!_cart.length){ toast(t('السلة فارغة','Empty cart')); return; } _payType=type||'cash'; const tt=cartTotals(); const paid=type==='credit'?(_paidInput||0):tt.total; const inv=buildSaleInvoice(type); inv.paid=paid; inv.change=Math.max(0,paid-tt.total); if(type==='credit'){ inv.remaining=Math.max(0,tt.total-paid); } finalizeSale(inv, type==='credit'); }
function quickCash(paidInput){ const t=cartTotals(); const paid=paidInput>0?paidInput:t.total; const inv=buildSaleInvoice('cash'); inv.paid=paid; inv.change=Math.max(0,paid-t.total); finalizeSale(inv,false); }
function finalizeSale(inv, credit){
  if(isPeriodLocked(periodOf(inv.createdAt))){ toast(t('الفترة مقفلة لا يمكن الترحيل','Period locked - cannot post')); return; }
  if(_editingSaleId){ const old=DB.get('invoices').find(x=>x.id===_editingSaleId); if(old){
    reverseSale(old);
    const movements=DB.get('movements').filter(m=>m.note!==old.code);
    inv.items.forEach(it=>{ movements.push({id:uid(),time:nowISO(),productId:it.productId,type:t('بيع','Sale'),qty:-it.qty,wh:'',note:inv.code}); });
    DB.set('movements',movements);
    Object.assign(inv,{id:old.id,code:old.code,createdAt:old.createdAt,payment:old.payment,status:old.status||'completed',updatedAt:nowISO()});
    if(old.payment==='cash'||!old.payment){ inv.paid=inv.total; inv.change=Math.max(0,inv.paid-inv.total); }
    else { inv.paid=old.paid; inv.payments=old.payments; inv.installment=old.installment; inv.down=old.down; inv.remaining=old.remaining; inv.due=old.due; }
    applySale(inv);
    const invoices=DB.get('invoices'); const k=invoices.findIndex(x=>x.id===old.id); if(k>=0) invoices[k]=inv; DB.set('invoices',invoices);
    logAudit(t('تعديل فاتورة','Edit invoice'), inv.code+' '+money(inv.total), {type:CFG.AUDIT.EDIT, ref:inv.id});
    window._splits=null; window._installment=null; _editingSaleId=null; renderSales(); toast(t('تم حفظ التعديل','Saved')+' '+inv.code); printInvoice(inv);
    return;
  } }
  const products=DB.get('products'); const movements=DB.get('movements'); inv.items.forEach(it=>{ const p=products.find(x=>x.id===it.productId); if(p){ adjStock(p,-it.qty, inv?inv.warehouseId:null); } movements.push({id:uid(),time:nowISO(),productId:it.productId,type:t('بيع','Sale'),qty:-it.qty,wh:'',note:inv.code}); }); DB.set('products',products); DB.set('movements',movements);
  const invoices=DB.get('invoices'); invoices.push(inv); DB.set('invoices',invoices);
  if(_coupon){ const coupons=DB.get('coupons'); const c=coupons.find(x=>x.code===_coupon.code); if(c) c.uses=(c.uses||0)+1; DB.set('coupons',coupons); }
  const customers=DB.get('customers'); const cust=customers.find(c=>c.id===inv.customerId); if(cust&&credit){ cust.balance=(cust.balance||0)+inv.total-inv.paid; } DB.set('customers',customers);
  postSaleJournals(inv, credit);
  logAudit(t('فاتورة بيع','Sale invoice'), inv.code+' '+money(inv.total), {type:CFG.AUDIT.ADD, ref:inv.id});
  window._splits=null; window._installment=null; renderSales(); toast(t('تم البيع','Sold')+' '+inv.code); shareInvoiceModal(inv); }
function renderSalesList(){ const invs=DB.get('invoices').filter(i=>i.type==='sale').map(i=>({kind:'inv',createdAt:i.createdAt,code:i.code,id:i.id,customerName:i.customerName,customerId:i.customerId,date:i.createdAt,total:i.total,paid:i.paid||0,payment:i.payment,raw:i}));
  const rets=DB.get('returns').map(r=>{ const cust=DB.get('customers').find(c=>c.id===r.customerId); return {kind:'ret',createdAt:r.createdAt,code:r.code,id:r.id,customerName:cust?cust.name:(r.invoiceCode||''),customerId:r.customerId,date:r.createdAt,total:-(r.total||0),paid:0,payment:'return',raw:r}; });
  const rows=invs.concat(rets).sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||''));
  const netTotal=rows.reduce((s,r)=>s+r.total,0);
  const invTotal=invs.reduce((s,i)=>s+i.total,0);
  const retTotal=rets.reduce((s,r)=>s+r.total,0);
  const today=new Date().toISOString().slice(0,10);
  const todaySales=invs.filter(i=>(i.createdAt||'').startsWith(today));
  const todayTotal=todaySales.reduce((s,i)=>s+i.total,0);
  const todayCount=todaySales.length;
  const bento=`<div class="bento-grid"><div class="bento-card accent"><div class="bento-val">${money(todayTotal)}</div><div class="bento-lbl">${t('مبيعات اليوم','Today Sales')}</div></div><div class="bento-card"><div class="bento-val">${todayCount}</div><div class="bento-lbl">${t('فواتير اليوم','Today Invoices')}</div></div><div class="bento-card"><div class="bento-val">${rows.length}</div><div class="bento-lbl">${t('العدد في القائمة','List Count')}</div></div><div class="bento-card dark"><div class="bento-val">${money(netTotal)}</div><div class="bento-lbl">${t('إجمالي القائمة','List Total')}</div></div></div>`;
  const body=rows.length?`<table class="tbl" id="salesTbl"><thead><tr><th><input type="checkbox" id="salesAll" onchange="toggleAllBulk('sales',this.checked)"></th><th onclick="sortSalesTable('code')">${t('الكود','Code')} ↕</th><th onclick="sortSalesTable('customer')">${t('العميل','Customer')} ↕</th><th onclick="sortSalesTable('date')">${t('التاريخ','Date')} ↕</th><th onclick="sortSalesTable('total')">${t('الإجمالي','Total')} ↕</th><th>${t('المدفوع','Paid')}</th><th>${t('الدفع','Payment')}</th><th></th></tr></thead><tbody>${rows.map(r=>{ const isRet=r.kind==='ret';
    return `<tr class="${isRet?'ret-row':''}" data-id="${r.id}" data-kind="${r.kind}"><td><input type="checkbox" class="bulk-cb" value="${r.id}"></td><td>${esc(r.code)}</td><td>${esc(r.customerName||'')}${isRet?`<div class="ret-tag">${t('مرتجع','Return')}</div>`:''}</td><td>${fmtDateTime(r.date)}</td><td class="${isRet?'neg':''}">${money(r.total)}</td><td>${money(r.paid)}</td><td>${isRet?`<span class="ret-tag">${t('مرتجع','Return')}</span>`:(r.payment==='credit'?t('آجل','Credit'):t('نقدي','Cash'))}</td><td>${threeDotsMenu([
      {icon:'📝',label:t('تعديل','Edit'),onClick:isRet?`deleteReturn('${r.id}')`:`renderInvoiceScreen('sale','${r.id}')`},
      {icon:'🖨️',label:t('طباعة','Print'),onClick:isRet?`printReturn(DB.get('returns').find(x=>x.id==='${r.id}'))`:`printInvoice(DB.get('invoices').find(x=>x.id==='${r.id}'))`},
      {icon:'📄',label:'PDF',onClick:isRet?'':`printInvoicePDF(DB.get('invoices').find(x=>x.id==='${r.id}'))`},
      {icon:'🖼️',label:'JPG',onClick:isRet?'':`shareAsJPG('invShareArea','${r.code}')`},
      {icon:'💬',label:'WhatsApp',onClick:isRet?'':`shareInvoiceWhatsApp(DB.get('invoices').find(x=>x.id==='${r.id}'))`},
      {icon:'🗑️',label:t('حذف','Delete'),cls:'danger',onClick:isRet?`deleteReturn('${r.id}')`:`deleteInvoice('${r.id}')`}
    ])}</td></tr>`; }).join('')}</tbody></table>`:`<div class="empty">${t('لا توجد فواتير مبيعات بعد','No sales invoices yet')}</div>`;
  const bulkBar=`<div class="bulk-bar" id="salesBulkBar" style="display:none"><span id="salesBulkCount">0</span> ${t('محدد','selected')} <button class="btn btn-danger btn-sm" onclick="bulkDeleteSales()">🗑️ ${t('حذف','Delete')}</button> <button class="btn btn-sm" onclick="bulkExportSalesPDF()">📄 PDF</button> <button class="btn btn-sm" onclick="clearBulk('sales')">✕ ${t('إلغاء التحديد','Deselect')}</button></div>`;
  const df=dateFilterPop('salesDate');
  $('#screen').innerHTML=`<div class="screen">${pageHead(t('المبيعات','Sales'),{icon:'🧾',sub:`${t('إجمالي المبيعات','Total Sales')}: ${money(invTotal)} · ${t('المرتجعات','Returns')}: ${money(retTotal)} · ${t('الصافي','Net')}: ${money(netTotal)}`,actions:`<button class="btn btn-primary" onclick="renderInvoiceScreen('sale')">＋ ${t('فاتورة جديدة','New Sale')}</button>`})}
    ${bento}
    <div class="filters"><div class="field-inline"><input id="salesSearch" placeholder="${t('بحث بالكود أو العميل','Search code or customer')}" oninput="filterSalesList()"><button class="voice-btn btn sm" onclick="startVoiceSearch('salesSearch')">🎤</button></div>${df}<button class="btn" onclick="exportSalesCSV()">📥 CSV</button><button class="btn" onclick="bulkExportSalesPDF()">📄 PDF</button></div>
    ${bulkBar}
    ${panel({flush:true, body:body})}</div>`;
  applyLang(); }
function filterSalesList(){
  const q=(($('#salesSearch').value||'').toLowerCase());
  const dfEl=document.querySelector('[data-filter="salesDate"]');
  const dateVal=dfEl?dfEl.value:'all';
  const rows=document.querySelectorAll('#salesTbl tbody tr');
  const now=new Date();
  rows.forEach(r=>{
    let show=true;
    if(q){ const txt=r.textContent.toLowerCase(); if(!txt.includes(q)) show=false; }
    if(show && dateVal && dateVal!=='all'){
      const d=r.cells[3]?r.cells[3].textContent:'';
      const rDate=new Date(d);
      if(dateVal==='today') show=rDate.toDateString()===now.toDateString();
      else if(dateVal==='yesterday'){ const y=new Date(now); y.setDate(y.getDate()-1); show=rDate.toDateString()===y.toDateString(); }
      else if(dateVal==='thisMonth') show=rDate.getMonth()===now.getMonth()&&rDate.getFullYear()===now.getFullYear();
    }
    r.style.display=show?'':'none';
  });
}
function sortSalesTable(col){
  const tbl=document.getElementById('salesTbl'); if(!tbl) return;
  const tbody=tbl.querySelector('tbody');
  const arr=Array.from(tbody.querySelectorAll('tr'));
  const idx={code:1,customer:2,date:3,total:4}[col]||1;
  arr.sort((a,b)=>{
    let va=a.cells[idx]?a.cells[idx].textContent.trim():'';
    let vb=b.cells[idx]?b.cells[idx].textContent.trim():'';
    if(col==='total') return parseFloat(va.replace(/[^0-9.\-]/g,''))-parseFloat(vb.replace(/[^0-9.\-]/g,''));
    return va.localeCompare(vb,'ar');
  });
  arr.forEach(r=>tbody.appendChild(r));
}
function toggleAllBulk(screen,checked){
  document.querySelectorAll('#'+screen+'Tbl .bulk-cb').forEach(cb=>{cb.checked=checked;});
  updateBulkBar(screen);
}
function updateBulkBar(screen){
  const checked=document.querySelectorAll('#'+screen+'Tbl .bulk-cb:checked').length;
  const bar=document.getElementById(screen+'BulkBar');
  const cnt=document.getElementById(screen+'BulkCount');
  if(bar) bar.style.display=checked>0?'flex':'none';
  if(cnt) cnt.textContent=checked;
}
function clearBulk(screen){
  document.querySelectorAll('#'+screen+'Tbl .bulk-cb').forEach(cb=>{cb.checked=false;});
  updateBulkBar(screen);
}
function bulkDeleteSales(){
  const ids=Array.from(document.querySelectorAll('#salesTbl .bulk-cb:checked')).map(cb=>cb.value);
  if(!ids.length) return;
  confirmModal(t('حذف محدد','Delete Selected'),t('حذف '+ids.length+' فواتير؟','Delete '+ids.length+' invoices?'),()=>{
    ids.forEach(id=>{ const inv=DB.get('invoices').find(x=>x.id===id); if(inv) reverseSale(inv); });
    DB.set('invoices',DB.get('invoices').filter(i=>!ids.includes(i.id)));
    logAudit(t('حذف محدد','Bulk Delete'),ids.length+' invoices');
    renderSalesList(); toast(t('تم الحذف','Deleted'));
  });
}
function bulkExportSalesPDF(){
  const ids=Array.from(document.querySelectorAll('#salesTbl .bulk-cb:checked')).map(cb=>cb.value);
  const invs=DB.get('invoices').filter(i=>ids.includes(i.id));
  if(!invs.length){ toast(t('لا فواتير محددة','No invoices selected')); return; }
  const lines=invs.map(i=>[i.code,i.customerName||'',fmtDateTime(i.createdAt),money(i.total),i.payment==='credit'?t('آجل','Credit'):t('نقدي','Cash')]);
  exportPDF(t('المبيعات','Sales')+'.pdf',[t('الكود','Code'),t('العميل','Customer'),t('التاريخ','Date'),t('الإجمالي','Total'),t('الدفع','Payment')],lines);
}
function exportSalesCSV(){
  const invs=DB.get('invoices').filter(i=>i.type==='sale');
  const rows=[['code','customer','date','total','paid','payment']];
  invs.forEach(i=>rows.push([i.code,i.customerName||'',(i.createdAt||'').slice(0,10),i.total,i.paid||0,i.payment]));
  downloadFile('sales.csv',toCSV(rows),'text/csv');
}
function printReturn(r){ if(!r) return; const comp=currentCompany()||{}; const s=DB.getOne('settings')||{}; const html=`<div class="receipt"><h3 class="r-title">${esc(comp.name||s.companyName||'')}</h3>${r.invoiceCode?`<div class="r-sub">${t('فاتورة أصلية','Original')}: ${esc(r.invoiceCode)}</div>`:''}<hr><div class="r-row"><span>${t('مرتجع','Return')}</span><span>${esc(r.code)}</span></div><div class="r-row"><span>${t('التاريخ','Date')}</span><span>${fmtDateTime(r.createdAt)}</span></div><hr>${r.items.map(it=>`<div class="r-item"><span>${esc((DB.get('products').find(p=>p.id===it.productId)||{}).name||'')} ×${it.qty}</span><span>${money(it.price*it.qty)}</span></div>`).join('')}<hr><div class="r-total"><span>${t('الإجمالي','Total')}</span><span>${money(r.total)}</span></div>${r.reason?`<div class="r-sub">${esc(r.reason)}</div>`:''}</div>`; const w=window.open('','_blank'); if(w){ w.document.write('<html><head><title>'+esc(r.code)+'</title><link rel="stylesheet" href="print.css"></head><body>'+html+'</body></html>'); w.document.close(); } }
function deleteReturn(id){ confirmModal(t('حذف المرتجع','Delete Return'), t('حذف المرتجع وترحيل العكس؟','Delete return and reverse?'), ()=>{ const r=DB.get('returns').find(x=>x.id===id); if(!r) return; const products=DB.get('products'); (r.items||[]).forEach(it=>{ const p=products.find(x=>x.id===it.productId); if(p) adjStock(p,-it.qty, inv?inv.warehouseId:null); }); DB.set('products',products); DB.set('journal',DB.get('journal').filter(j=>j.ref!==id)); DB.set('returns',DB.get('returns').filter(x=>x.id!==id)); const orig=DB.get('invoices').find(x=>x.id===r.invoiceId); if(orig&&orig.payment==='credit'){ const customers=DB.get('customers'); const c=customers.find(x=>x.id===r.customerId); if(c){ c.balance=(c.balance||0)+(r.total||0); } DB.set('customers',customers); } logAudit(t('حذف مرتجع','Delete return'),r.code); renderSalesList(); toast(t('تم الحذف','Deleted')); }); }
function deleteInvoice(id){ confirmModal(t('حذف الفاتورة','Delete Invoice'), t('هل تريد حذف الفاتورة وترحيل الفارق؟','Delete invoice and reverse its effects?'), ()=>{ const inv=DB.get('invoices').find(x=>x.id===id); if(!inv) return; const products=DB.get('products'); (inv.items||[]).forEach(it=>{ const p=products.find(x=>x.id===it.productId); if(p) adjStock(p,it.qty, inv?inv.warehouseId:null); }); DB.set('products',products); DB.set('journal',DB.get('journal').filter(j=>j.ref!==id));     DB.set('invoices',DB.get('invoices').filter(x=>x.id!==id)); const customers=DB.get('customers'); const cust=customers.find(c=>c.id===inv.customerId); if(cust&&inv.payment==='credit'){ cust.balance=DEC.sub(cust.balance||0, DEC.sub(inv.total||0, inv.paid||0)); DB.set('customers',customers); } logAudit(t('حذف فاتورة','Delete invoice'), inv.code, {type:CFG.AUDIT.DELETE, ref:id}); renderSalesList(); toast(t('تم الحذف','Deleted')); }); }
function reverseSale(inv){ const products=DB.get('products'); (inv.items||[]).forEach(it=>{ const p=products.find(x=>x.id===it.productId); if(p) adjStock(p,it.qty, inv?inv.warehouseId:null); }); DB.set('products',products); DB.set('journal',DB.get('journal').filter(j=>j.ref!==inv.id)); const customers=DB.get('customers'); const cust=customers.find(c=>c.id===inv.customerId); if(cust&&inv.payment==='credit'){ cust.balance=(cust.balance||0)-((inv.total||0)-(inv.paid||0)); DB.set('customers',customers); } }
function applySale(inv){ const products=DB.get('products'); (inv.items||[]).forEach(it=>{ const p=products.find(x=>x.id===it.productId); if(p) adjStock(p,-it.qty, inv?inv.warehouseId:null); }); DB.set('products',products); postSaleJournals(inv, inv.payment==='credit'); const customers=DB.get('customers'); const cust=customers.find(c=>c.id===inv.customerId); if(cust&&inv.payment==='credit'){ cust.balance=(cust.balance||0)+((inv.total||0)-(inv.paid||0)); DB.set('customers',customers); } }
function postSaleJournals(inv, credit){ const J=DB.get('journal'); const d=new Date().toISOString().slice(0,10);
  const cashId=CFG.ACC.CASH; const salesId=CFG.ACC.SALES; const cogs=CFG.ACC.COGS; const invAcc=CFG.ACC.INVENTORY; const rec=CFG.ACC.RECEIVABLE;
  const lines=[]; lines.push({accountId:cashId, debit:DEC.round(inv.paid), credit:0}); if(credit){ lines.push({accountId:rec, debit:DEC.round(DEC.sub(inv.total,inv.paid)), credit:0}); }
  lines.push({accountId:salesId, debit:0, credit:DEC.round(inv.subtotal)});
  if(inv.tax>0){ lines.push({accountId:CFG.ACC.VAT_OUT, debit:0, credit:DEC.round(inv.tax)}); }
  if(inv.discount>0){ lines.push({accountId:salesId, debit:DEC.round(inv.discount), credit:0}); }
  J.push({id:uid(),date:d,desc:t('بيع','Sale')+' '+inv.code,lines:normalizeLines(lines),ref:inv.id}); DB.set('journal',J);
  const cogsLines=inv.items.map(it=>{ const used=consumeCostLayers(it.productId,it.qty,productCostMethod(it.productId)); return {accountId:cogs, debit:Math.max(0,used), credit:0, _cogs:used}; }); const cogsTotal=DEC.sum(cogsLines,'_cogs'); cogsLines.push({accountId:invAcc, debit:0, credit:cogsTotal}); J.push({id:uid(),date:d,desc:t('تكلفة بيع','COGS')+' '+inv.code,lines:normalizeLines(cogsLines),ref:inv.id}); DB.set('journal',J); }
function normalizeLines(lines){ const m={}; lines.forEach(l=>{ m[l.accountId]=m[l.accountId]||{accountId:l.accountId,debit:0,credit:0}; m[l.accountId].debit=DEC.add(m[l.accountId].debit, l.debit); m[l.accountId].credit=DEC.add(m[l.accountId].credit, l.credit); }); return Object.values(m); }
function printInvoice(inv){ const html=receiptHTML(inv); const w=window.open('','_blank'); if(w){ w.document.write('<html><head><title>'+esc(inv.code)+'</title><link rel="stylesheet" href="print.css"></head><body>'+html+'<script>window.onload=function(){setTimeout(function(){window.print();},120);}<\/script></body></html>'); w.document.close(); } }
function printInvoicePDF(inv){ try{ const doc=pdfDoc(); const W=80; doc.internal.pageSize.setSize(W, 297); let y=10; const L=4; doc.setFontSize(9); const line=(t,x)=>{ doc.text(String(t),x==null?L:x,y); y+=4.4; }; const comp=currentCompany()||{}; const s=DB.getOne('settings')||{}; line(comp.name||s.companyName||'',L); (comp.address?line(comp.address,L):0); const taxNo=s.taxNumber||comp.taxNo||''; if(taxNo) line(t('الرقم الضريبي','Tax No')+': '+taxNo,L); y+=2; line(t('فاتورة','Invoice')+': '+inv.code,L); line(t('التاريخ','Date')+': '+fmtDateTime(inv.createdAt),L); line(t('العميل','Customer')+': '+(inv.customerName||'—'),L); y+=2; (inv.items||[]).forEach(i=>{ line(esc(i.name),L); line('  '+fmt(i.qty)+' x '+money(i.price)+' = '+money((i.price||0)*(i.qty||0)),L); }); y+=2; if(inv.subtotal) line(t('المجموع الفرعي','Subtotal')+': '+money(inv.subtotal),L); if(inv.discount) line(t('خصم','Discount')+': '+money(inv.discount),L); if(inv.tax) line(t('ضريبة','Tax')+': '+money(inv.tax),L); line(t('الإجمالي','Total')+': '+money(inv.total),L); line(t('المدفوع','Paid')+': '+money(inv.paid),L); if(inv.payment==='credit') line(t('المتبقي','Remaining')+': '+money(inv.remaining!=null?inv.remaining:Math.max(0,(inv.total||0)-(inv.paid||0))),L); doc.save(inv.code+'.pdf'); }catch(e){ toast(t('تعذر إنشاء PDF','PDF failed')); } }
function shareInvoiceWhatsApp(inv){ const cust=DB.get('customers').find(c=>c.id===inv.customerId); const lines=[t('فاتورة','Invoice')+': '+inv.code+' — '+money(inv.total)]; (inv.items||[]).forEach(i=>lines.push('• '+i.name+' ('+fmt(i.qty)+' × '+money(i.price)+')')); if(cust&&cust.phone) lines.unshift(t('عميل','Customer')+': '+cust.name); const url='https://wa.me/'+encodeURIComponent((cust&&cust.phone||'').replace(/[^0-9]/g,''))+'?text='+encodeURIComponent(lines.join('\n')); window.open(url,'_blank'); }
function shareInvoiceModal(inv){ openModal(t('مشاركة الفاتورة','Share Invoice')+' '+esc(inv.code), `<p>${t('اختر طريقة المشاركة','Choose how to share')}</p>`, [{label:t('طباعة','Print'),cls:'btn',onClick:()=>{closeModal();printInvoice(inv);}},{label:'PDF',cls:'btn',onClick:()=>{closeModal();printInvoicePDF(inv);}},{label:'🖼️ JPG',cls:'btn',onClick:()=>{closeModal();shareAsJPG('invShareArea',inv.code);}},{label:'🖨️ '+t('بلوتوث','Bluetooth'),cls:'btn',onClick:()=>{closeModal();printInvoiceBT(inv);}},{label:'WhatsApp',cls:'btn-primary',onClick:()=>{closeModal();shareInvoiceWhatsApp(inv);}}]); }
function renderReturns(){ const invs=DB.get('invoices').filter(i=>i.type==='sale').slice().sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||'')); const rets=DB.get('returns').slice().sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||''));
  $('#screen').innerHTML=`<div class="screen">${pageHead(t('المرتجعات','Returns'),{icon:'↩️',sub:t('إدارة مرتجعات المبيعات','Manage sales returns')})}
    <div class="section-title">${t('سجل المرتجعات','Returns Log')}</div>
    ${panel({flush:true, body: rets.length?`<table class="tbl"><thead><tr><th>${t('كود المرتجع','Return')}</th><th>${t('الفاتورة الأصلية','Original')}</th><th>${t('التاريخ','Date')}</th><th>${t('القيمة','Value')}</th><th>${t('السبب','Reason')}</th></tr></thead><tbody>${rets.map(r=>{const o=DB.get('invoices').find(x=>x.id===r.invoiceId);return `<tr><td>${esc(r.code)}</td><td>${o?esc(o.code):'—'}</td><td>${fmtDateTime(r.createdAt)}</td><td>${money(r.total)}</td><td>${esc(r.reason||'')}</td></tr>`;}).join('')}</tbody></table>`:`<div class="empty">${t('لا مرتجعات','No returns')}</div>`})}
    <div class="section-title">${t('إنشاء مرتجع','New Return')}</div>
    ${panel({flush:true, body:`<table class="tbl"><thead><tr><th>${t('الفاتورة','Invoice')}</th><th>${t('العميل','Customer')}</th><th>${t('الإجمالي','Total')}</th><th></th></tr></thead><tbody>${invs.map(i=>`<tr><td>${esc(i.code)}</td><td>${esc(i.customerName)}</td><td>${money(i.total)}</td><td><button class="btn" onclick="openReturn('${i.id}')">${t('إرجاع','Return')}</button></td></tr>`).join('')}</tbody></table>`})}
  </div>`; applyLang(); }
function openReturn(id){ const inv=DB.get('invoices').find(x=>x.id===id); if(!inv) return;
  openModal(t('إرجاع','Return')+' '+esc(inv.code), `<div id="retItems">${inv.items.map(it=>`<div>${esc(it.name)} (${t('متاح','Av')}: ${it.qty}) <input class="mini" id="ret_${it.productId}" type="number" value="0" min="0" max="${it.qty}"></div>`).join('')}</div><label>${t('سبب المرتجع','Reason')}<input id="retReason" placeholder="..."></label>`, [{label:t('تأكيد','Confirm'),cls:'btn-primary',onClick:()=>{ const products=DB.get('products'); let total=0; const details=[]; inv.items.forEach(it=>{ const q=Number($('#ret_'+it.productId).value)||0; if(q>0){ const p=products.find(x=>x.id===it.productId); if(p) p.qty=(p.qty||0)+q; total+=it.price*q; details.push({productId:it.productId,qty:q,price:it.price}); } });     if(!details.length){ toast(t('أدخل الكمية','Enter qty')); return; } DB.set('products',products); const code=nextNumber('RET','R-',6); total=DEC.sum(details.map(it=>DEC.mul(it.price,it.qty))); const ret={id:uid(),code,type:'return',invoiceId:id,invoiceCode:inv.code,customerId:inv.customerId,total,reason:$('#retReason').value||'',items:details,createdAt:nowISO()}; const returns=DB.get('returns'); returns.push(ret); DB.set('returns',returns);
    const rate=getTaxRate()/100; const vat=DEC.mul(total,(rate/(1+rate))); const net=DEC.sub(total,vat);
    const J=DB.get('journal'); const d=new Date().toISOString().slice(0,10);
    const lines=[{accountId:CFG.ACC.SALES,debit:DEC.round(net),credit:0},{accountId:CFG.ACC.VAT_OUT,debit:DEC.round(vat),credit:0}];
    if(inv.payment==='credit'){ const customers=DB.get('customers'); const cust=customers.find(c=>c.id===inv.customerId); if(cust){ cust.balance=DEC.sub(cust.balance||0, total); } DB.set('customers',customers); lines.push({accountId:CFG.ACC.RECEIVABLE,debit:0,credit:DEC.round(total)}); }
    else { lines.push({accountId:CFG.ACC.CASH,debit:0,credit:DEC.round(total)}); }
    details.forEach(it=>{ addPurchaseLayer(it.productId,it.qty,it.price); });
    J.push({id:uid(),date:d,desc:t('مرتجع','Return')+' '+inv.code,lines:normalizeLines(lines),ref:ret.id});
    DB.set('journal',J); logAudit(t('مرتجع','Return'),inv.code); closeModal(); renderReturns(); toast(t('تم المرتجع','Returned')); }},{label:t('إلغاء','Cancel'),cls:'btn',onClick:closeModal}]); }
/* ============================ PURCHASES ============================ */
function renderPurchases(){ const list=DB.get('purchases'); const total=list.reduce((s,p)=>s+(p.total||0),0);
  const today=new Date().toISOString().slice(0,10);
  const todayPurchases=list.filter(p=>(p.createdAt||'').startsWith(today));
  const todayTotal=todayPurchases.reduce((s,p)=>s+(p.total||0),0);
  const todayCount=todayPurchases.length;
  const bento=`<div class="bento-grid"><div class="bento-card accent"><div class="bento-val">${money(todayTotal)}</div><div class="bento-lbl">${t('مشتريات اليوم','Today Purchases')}</div></div><div class="bento-card"><div class="bento-val">${todayCount}</div><div class="bento-lbl">${t('فواتير اليوم','Today Invoices')}</div></div><div class="bento-card"><div class="bento-val">${list.length}</div><div class="bento-lbl">${t('العدد في القائمة','List Count')}</div></div><div class="bento-card dark"><div class="bento-val">${money(total)}</div><div class="bento-lbl">${t('إجمالي القائمة','List Total')}</div></div></div>`;
  const body=list.length?`<table class="tbl" id="purchaseTbl"><thead><tr><th><input type="checkbox" id="purchaseAll" onchange="toggleAllBulk('purchase',this.checked)"></th><th onclick="sortTable('purchaseTbl',1)">${t('الكود','Code')} ↕</th><th onclick="sortTable('purchaseTbl',2)">${t('المورد','Supplier')} ↕</th><th onclick="sortTable('purchaseTbl',3)">${t('الإجمالي','Total')} ↕</th><th onclick="sortTable('purchaseTbl',4)">${t('التاريخ','Date')} ↕</th><th></th></tr></thead><tbody>${list.map(p=>`<tr data-id="${p.id}"><td><input type="checkbox" class="bulk-cb" value="${p.id}"></td><td>${esc(p.code)}</td><td>${esc(p.supplierName)}</td><td>${money(p.total)}</td><td>${fmtDate(p.createdAt)}</td><td>${threeDotsMenu([
    {icon:'📝',label:t('تعديل','Edit'),onClick:`renderInvoiceScreen('purchase','${p.id}')`},
    {icon:'🖨️',label:t('طباعة','Print'),onClick:`printInvoice(DB.get('purchases').find(x=>x.id==='${p.id}'))`},
    {icon:'📄',label:'PDF',onClick:`printInvoicePDF(DB.get('purchases').find(x=>x.id==='${p.id}'))`},
    {icon:'🖨️',label:'BT',onClick:`printPurchaseBt('${p.id}')`},
    {icon:'🗑️',label:t('حذف','Delete'),cls:'danger',onClick:`deletePurchase('${p.id}')`}
  ])}</td></tr>`).join('')}</tbody></table>`:`<div class="empty">${t('لا فواتير شراء','No purchases')}</div>`;
  const bulkBar=`<div class="bulk-bar" id="purchaseBulkBar" style="display:none"><span id="purchaseBulkCount">0</span> ${t('محدد','selected')} <button class="btn btn-danger btn-sm" onclick="bulkDeletePurchases()">🗑️ ${t('حذف','Delete')}</button> <button class="btn btn-sm" onclick="bulkExportPurchasesPDF()">📄 PDF</button> <button class="btn btn-sm" onclick="clearBulk('purchase')">✕ ${t('إلغاء التحديد','Deselect')}</button></div>`;
  const df=dateFilterPop('purchaseDate');
  $('#screen').innerHTML=`<div class="screen">${pageHead(t('المشتريات','Purchases'),{icon:'🛒',sub:`${t('إجمالي المشتريات','Total Purchases')}: ${money(total)} · ${t('العدد','Count')}: ${list.length}`,actions:`<button class="btn btn-primary" onclick="renderInvoiceScreen('purchase')">＋ ${t('فاتورة شراء','New Purchase')}</button>`})}
    ${bento}
    <div class="filters"><div class="field-inline"><input id="purchaseSearch" placeholder="${t('بحث بالكود أو المورد','Search code or supplier')}" oninput="filterPurchasesList()"><button class="voice-btn btn sm" onclick="startVoiceSearch('purchaseSearch')">🎤</button></div>${df}<button class="btn" onclick="exportPurchasesCSV()">📥 CSV</button></div>
    ${bulkBar}
    ${panel({flush:true, body})}</div>`; applyLang(); }
function filterPurchasesList(){
  const q=(($('#purchaseSearch').value||'').toLowerCase());
  const dfEl=document.querySelector('[data-filter="purchaseDate"]');
  const dateVal=dfEl?dfEl.value:'all';
  const rows=document.querySelectorAll('#purchaseTbl tbody tr');
  const now=new Date();
  rows.forEach(r=>{
    let show=true;
    if(q){ const txt=r.textContent.toLowerCase(); if(!txt.includes(q)) show=false; }
    if(show && dateVal && dateVal!=='all'){
      const d=r.cells[4]?r.cells[4].textContent:'';
      const rDate=new Date(d);
      if(dateVal==='today') show=rDate.toDateString()===now.toDateString();
      else if(dateVal==='yesterday'){ const y=new Date(now); y.setDate(y.getDate()-1); show=rDate.toDateString()===y.toDateString(); }
      else if(dateVal==='thisMonth') show=rDate.getMonth()===now.getMonth()&&rDate.getFullYear()===now.getFullYear();
    }
    r.style.display=show?'':'none';
  });
}
function sortTable(tblId,colIdx){
  const tbl=document.getElementById(tblId); if(!tbl) return;
  const tbody=tbl.querySelector('tbody');
  const arr=Array.from(tbody.querySelectorAll('tr'));
  arr.sort((a,b)=>{
    let va=a.cells[colIdx]?a.cells[colIdx].textContent.trim():'';
    let vb=b.cells[colIdx]?b.cells[colIdx].textContent.trim():'';
    if(colIdx===3) return parseFloat(va.replace(/[^0-9.\-]/g,''))-parseFloat(vb.replace(/[^0-9.\-]/g,''));
    return va.localeCompare(vb,'ar');
  });
  arr.forEach(r=>tbody.appendChild(r));
}
function bulkDeletePurchases(){
  const ids=Array.from(document.querySelectorAll('#purchaseTbl .bulk-cb:checked')).map(cb=>cb.value);
  if(!ids.length) return;
  confirmModal(t('حذف محدد','Delete Selected'),t('حذف '+ids.length+' فواتير شراء؟','Delete '+ids.length+' purchase invoices?'),()=>{
    ids.forEach(id=>{ const p=DB.get('purchases').find(x=>x.id===id); if(p) reversePurchase(p); });
    DB.set('purchases',DB.get('purchases').filter(p=>!ids.includes(p.id)));
    logAudit(t('حذف محدد','Bulk Delete'),ids.length+' purchases');
    renderPurchases(); toast(t('تم الحذف','Deleted'));
  });
}
function bulkExportPurchasesPDF(){
  const ids=Array.from(document.querySelectorAll('#purchaseTbl .bulk-cb:checked')).map(cb=>cb.value);
  const list=DB.get('purchases').filter(p=>ids.includes(p.id));
  if(!list.length){ toast(t('لا فواتير محددة','No purchases selected')); return; }
  const lines=list.map(p=>[p.code,p.supplierName||'',fmtDate(p.createdAt),money(p.total)]);
  exportPDF(t('المشتريات','Purchases')+'.pdf',[t('الكود','Code'),t('المورد','Supplier'),t('التاريخ','Date'),t('الإجمالي','Total')],lines);
}
function exportPurchasesCSV(){ const rows=[['code','supplier','total','date']]; DB.get('purchases').forEach(p=>rows.push([p.code,p.supplierName||'',p.total,(p.createdAt||'').slice(0,10)])); downloadFile('purchases.csv',toCSV(rows),'text/csv'); }
function printPurchaseBt(id){ const p=DB.get('purchases').find(x=>x.id===id); if(p) printInvoiceBT(p); }
function renderPurchaseOrders(){ const orders=DB.get('purchaseOrders'); $('#screen').innerHTML=`<div class="screen">${pageHead(t('أوامر الشراء','Purchase Orders'),{icon:'📋',sub:`${t('العدد','Count')}: ${orders.length}`,actions:`<button class="btn btn-primary" onclick="renderInvoiceScreen('po')">＋ ${t('أمر شراء','New PO')}</button>`})}
  ${panel({flush:true, body: orders.length?`<table class="tbl"><thead><tr><th>${t('الكود','Code')}</th><th>${t('المورد','Supplier')}</th><th>${t('الحالة','Status')}</th><th>${t('التاريخ','Date')}</th><th></th></tr></thead><tbody>${orders.map(o=>`<tr><td>${esc(o.code)}</td><td>${esc(o.supplierName)}</td><td>${esc(o.status)}</td><td>${fmtDate(o.createdAt)}</td><td><button class="btn sm" onclick="receivePO('${o.id}')">${t('استلام','Receive')}</button> <button class="btn sm btn-danger" onclick="deletePO('${o.id}')">🗑️</button></td></tr>`).join('')}</tbody></table>`:`<div class="empty">${t('لا أوامر شراء','No POs')}</div>`})}</div>`; applyLang(); }
function receivePO(id){ const o=DB.get('purchaseOrders').find(x=>x.id===id); if(!o) return; renderInvoiceScreen('purchase'); setTimeout(()=>{ const sel=$('#invParty'); if(sel) sel.value=o.supplierName||''; invSetParty('invParty','invPartyId','suppliers'); },50); toast(t('أدخل فاتورة الشراء للأمر','Create purchase invoice for PO')+' '+o.code); }
function deletePO(id){ confirmModal(t('حذف','Delete'), t('حذف أمر الشراء؟','Delete PO?'), ()=>{ DB.set('purchaseOrders',DB.get('purchaseOrders').filter(x=>x.id!==id)); renderPurchaseOrders(); }); }
/* ============================ PURCHASE POS (mirrors sales POS) ============================ */
let _pcart=[], _pfilter='';
function renderPurchasePOS(editId){ _pcart=[]; _pfilter=''; const products=DB.get('products'); const cats=[...new Set(products.map(p=>p.category))];
  let editInv=null; if(editId){ editInv=DB.get('purchases').find(x=>x.id===editId)||null; if(editInv){ _pcart=editInv.items.map(it=>({id:it.productId,code:it.code,name:it.name,buying:it.price,selling:it.price,qty:it.qty})); } }
  $('#screen').innerHTML=`<div class="screen pos-center"><div class="pos-mid"><div class="pos-head">
      <div class="pos-head-row">
        <div class="pos-cust"><label>${t('المورد','Supplier')}</label><input id="pSupp" list="pSuppList" placeholder="${t('بحث عن مورد','Search supplier')}" value="${editInv?esc(editInv.supplierName||''):''}" oninput="setCustFromName('pSupp','pSuppId','suppliers')"><input type="hidden" id="pSuppId" value="${editInv?editInv.supplierId:''}"><datalist id="pSuppList">${DB.get('suppliers').map(s=>`<option value="${esc(s.name)}">`).join('')}</datalist></div>
        <div class="pos-notes"><label>${t('ملاحظات','Notes')}</label><input id="pNotes" placeholder="${t('ملاحظات','Notes')}"></div>
      </div>
      <div class="pos-search"><input id="pSearch" placeholder="${t('بحث عن منتج وإضافته للفاتورة','Search product & add to invoice')}" oninput="pSearch(this.value)"><div id="pAC" class="pos-ac"></div></div>
    </div>
      <div class="pos-cart-wrap"><table class="tbl pos-cart" id="pCart"></table></div>
      <div class="pos-foot"><div class="pos-totals" id="pTotals"></div>
      <div class="pos-actions"><button class="btn" onclick="renderPurchases()">${t('إلغاء','Cancel')}</button><button class="btn btn-primary" data-psave onclick="savePurchase()">${t('حفظ شراء','Save Purchase')}</button></div></div>
    </div></div>`;
  if(editInv && $('#pSupp')) $('#pSupp').value=editInv.supplierName||'';
  if(editInv && $('#pNotes')) $('#pNotes').value=editInv.notes||'';
  pRenderCart(); applyLang(); if($('#pSearch')) $('#pSearch').focus(); }
function pFilter(c){ _pfilter=c; }
function pSearch(v){ const q=(v||'').toLowerCase(); const box=$('#pAC'); if(!box) return; if(!v){ box.style.display='none'; box.innerHTML=''; return; } const list=DB.get('products').filter(p=>p.status!=='inactive'&&((p.name||'').toLowerCase().includes(q)||(p.barcode||'').includes(v)||(p.code||'').toLowerCase().includes(q))).slice(0,8); if(!list.length){ box.style.display='none'; box.innerHTML=''; return; } box.innerHTML=list.map(p=>`<div class="ac-item" data-id="${p.id}" onclick="pAcPick('${p.id}')"><div class="ac-name">${esc(p.name)}</div><div class="ac-meta">${money(p.buyingPrice)} · ${t('متاح','Av')}: ${fmt(p.qty)}</div></div>`).join(''); box.style.display='block'; }
function pAcPick(id){ pAddToCart(id); const s=$('#pSearch'); if(s){ s.value=''; s.focus(); } const box=$('#pAC'); if(box){ box.style.display='none'; box.innerHTML=''; } }
function pAddToCart(id){ const p=DB.get('products').find(x=>x.id===id); if(!p) return; const line=_pcart.find(i=>i.id===id); if(line){ line.qty++; } else { _pcart.push({id,code:p.code,name:p.name,buying:p.buyingPrice,selling:p.buyingPrice,qty:1}); } pRenderCart(); }
function pChangeQty(id,d){ const l=_pcart.find(i=>i.id===id); if(l){ l.qty+=d; if(l.qty<=0) _pcart=_pcart.filter(i=>i.id!==id); } pRenderCart(); }
function pSetBuy(id,val){ const l=_pcart.find(i=>i.id===id); if(l) l.buying=Number(val)||0; pRenderCart(); }
function pCartTotals(){ return {subtotal:_pcart.reduce((s,i)=>s+i.buying*i.qty,0), count:_pcart.reduce((s,i)=>s+i.qty,0)}; }
function pRenderCart(){ const tt=pCartTotals(); $('#pCart').innerHTML=_pcart.map(i=>`<tr><td>${esc(i.name)}</td><td><button class="btn sm" onclick="pChangeQty('${i.id}',-1)">-</button> ${i.qty} <button class="btn sm" onclick="pChangeQty('${i.id}',1)">+</button></td><td><input class="mini" type="number" value="${i.buying}" onchange="pSetBuy('${i.id}',this.value)"></td><td>${money(i.buying*i.qty)}</td><td><button class="btn sm btn-danger" onclick="pChangeQty('${i.id}',-999)">×</button></td></tr>`).join('')||`<tr><td colspan="5">${t('السلة فارغة','Empty cart')}</td></tr>`;
  $('#pTotals').innerHTML=`<div><span>${t('العدد','Count')}</span><span>${tt.count}</span></div><div class="pos-grand"><span>${t('الإجمالي','Total')}</span><span>${money(tt.subtotal)}</span></div>`; }
function savePurchase(){ if(!_pcart.length){ toast(t('السلة فارغة','Empty cart')); return; } if(!requirePost()) return; if(isPeriodLocked(periodOf(nowISO()))){ toast(t('الفترة مقفلة لا يمكن الترحيل','Period locked - cannot post')); return; }   const suppId=$('#pSuppId').value||DB.get('suppliers')[0].id; const supp=DB.get('suppliers').find(s=>s.id===suppId); const notes=$('#pNotes')?$('#pNotes').value.trim():'';   const items=_pcart.map(i=>({productId:i.id,code:i.code,name:i.name,qty:i.qty,price:i.buying})); const total=DEC.sum(items.map(i=>DEC.mul(i.qty,i.price))); const inv={id:uid(),code:nextNumber('PU','PU-',6),type:'purchase',supplierId:suppId,supplierName:supp?supp.name:'',notes,items,total,createdAt:nowISO()};   const purchases=DB.get('purchases'); purchases.push(inv); DB.set('purchases',purchases); applyPurchase(inv); logAudit(t('فاتورة شراء','Purchase'),inv.code, {type:CFG.AUDIT.ADD, ref:inv.id}); _pcart=[]; renderPurchases(); toast(t('تم الحفظ','Saved')+' '+inv.code); }
/* ============================ PURCHASE ORDER POS ============================ */
let _pocart=[], _pofilter='';
function renderPurchaseOrderPOS(editId){ _pocart=[]; _pofilter=''; const products=DB.get('products'); const cats=[...new Set(products.map(p=>p.category))];
  let editPO=null; if(editId){ editPO=DB.get('purchaseOrders').find(x=>x.id===editId)||null; if(editPO){ _pocart=editPO.items.map(it=>({id:it.productId,code:it.code,name:it.name,qty:it.qty})); } }
  $('#screen').innerHTML=`<div class="screen pos-center"><div class="pos-mid"><div class="pos-head">
      <div class="pos-head-row">
        <div class="pos-cust"><label>${t('المورد','Supplier')}</label><input id="poSupp2" list="poSuppList" placeholder="${t('بحث عن مورد','Search supplier')}" value="${editPO?esc(editPO.supplierName||''):''}" oninput="setCustFromName('poSupp2','poSuppId','suppliers')"><input type="hidden" id="poSuppId" value="${editPO?editPO.supplierId:''}"><datalist id="poSuppList">${DB.get('suppliers').map(s=>`<option value="${esc(s.name)}">`).join('')}</datalist></div>
        <div class="pos-notes"><label>${t('ملاحظات','Notes')}</label><input id="poNotes" placeholder="${t('ملاحظات','Notes')}"></div>
      </div>
      <div class="pos-search"><input id="poSearch" placeholder="${t('بحث عن منتج وإضافته للأمر','Search product & add to order')}" oninput="poSearch2(this.value)"><div id="poAC" class="pos-ac"></div></div>
    </div>
      <div class="pos-cart-wrap"><table class="tbl pos-cart" id="poCart"></table></div>
      <div class="pos-foot"><div class="pos-totals" id="poTotals"></div>
      <div class="pos-actions"><button class="btn" onclick="renderPurchaseOrders()">${t('إلغاء','Cancel')}</button><button class="btn btn-primary" data-posave onclick="savePurchaseOrder()">${t('حفظ أمر','Save PO')}</button></div></div>
    </div></div>`;
  if(editPO && $('#poSupp2')) $('#poSupp2').value=editPO.supplierName||'';
  if(editPO && $('#poNotes')) $('#poNotes').value=editPO.notes||'';
  poRenderCart2(); applyLang(); if($('#poSearch')) $('#poSearch').focus(); }
function poFilter2(c){ _pofilter=c; }
function poSearch2(v){ const q=(v||'').toLowerCase(); const box=$('#poAC'); if(!box) return; if(!v){ box.style.display='none'; box.innerHTML=''; return; } const list=DB.get('products').filter(p=>p.status!=='inactive'&&((p.name||'').toLowerCase().includes(q)||(p.barcode||'').includes(v)||(p.code||'').toLowerCase().includes(q))).slice(0,8); if(!list.length){ box.style.display='none'; box.innerHTML=''; return; } box.innerHTML=list.map(p=>`<div class="ac-item" data-id="${p.id}" onclick="poAcPick('${p.id}')"><div class="ac-name">${esc(p.name)}</div><div class="ac-meta">${t('متاح','Av')}: ${fmt(p.qty)}</div></div>`).join(''); box.style.display='block'; }
function poAcPick(id){ poAddToCart(id); const s=$('#poSearch'); if(s){ s.value=''; s.focus(); } const box=$('#poAC'); if(box){ box.style.display='none'; box.innerHTML=''; } }
function poAddToCart(id){ const p=DB.get('products').find(x=>x.id===id); if(!p) return; const line=_pocart.find(i=>i.id===id); if(line){ line.qty++; } else { _pocart.push({id,code:p.code,name:p.name,qty:1}); } poRenderCart2(); }
function poChangeQty(id,d){ const l=_pocart.find(i=>i.id===id); if(l){ l.qty+=d; if(l.qty<=0) _pocart=_pocart.filter(i=>i.id!==id); } poRenderCart2(); }
function poRenderCart2(){ const count=_pocart.reduce((s,i)=>s+i.qty,0); $('#poCart').innerHTML=_pocart.map(i=>`<tr><td>${esc(i.name)}</td><td><button class="btn sm" onclick="poChangeQty('${i.id}',-1)">-</button> ${i.qty} <button class="btn sm" onclick="poChangeQty('${i.id}',1)">+</button></td><td><button class="btn sm btn-danger" onclick="poChangeQty('${i.id}',-999)">×</button></td></tr>`).join('')||`<tr><td colspan="3">${t('السلة فارغة','Empty cart')}</td></tr>`;
  $('#poTotals').innerHTML=`<div class="pos-grand"><span>${t('العدد','Count')}</span><span>${fmt(count)}</span></div>`; }
function savePurchaseOrder(){ if(!_pocart.length){ toast(t('السلة فارغة','Empty cart')); return; } const suppId=$('#poSuppId').value||DB.get('suppliers')[0].id; const supp=DB.get('suppliers').find(s=>s.id===suppId); const notes=$('#poNotes')?$('#poNotes').value.trim():''; const items=_pocart.map(i=>({productId:i.id,code:i.code,name:i.name,qty:i.qty})); const po={id:uid(),code:nextNumber('PO','PO-',6),supplierId:suppId,supplierName:supp?supp.name:'',notes,items,status:'pending',createdAt:nowISO()};   const poArr=DB.get('purchaseOrders'); poArr.push(po); DB.set('purchaseOrders',poArr); logAudit(t('أمر شراء','PO'),po.code, {type:CFG.AUDIT.ADD, ref:po.id}); _pocart=[]; renderPurchaseOrders(); toast(t('تم الحفظ','Saved')+' '+po.code); }
function openPurchaseModal(editId){ const products=DB.get('products'); const editInv=editId?DB.get('purchases').find(x=>x.id===editId):null; const title=editInv?(t('تعديل فاتورة شراء','Edit Purchase')+' '+esc(editInv.code)):t('فاتورة شراء','Purchase Invoice');
  openModal(title, `<div class="form-grid"><label>${t('المورد','Supplier')}<select id="puSupp">${DB.get('suppliers').map(s=>`<option value="${s.id}">${esc(s.name)}</option>`).join('')}</select></label></div><div id="puItems"></div><div id="puTotals"></div>`, [{label:t('حفظ','Save'),cls:'btn-primary',onClick:()=>{ const suppId=$('#puSupp').value; const supp=DB.get('suppliers').find(s=>s.id===suppId); const items=$$('#puItems .pu-row').map(row=>{ const pid=row.querySelector('[data-p]').value; const p=products.find(x=>x.id===pid); return {productId:pid,code:p.code,name:p.name,qty:Number(row.querySelector('[data-q]').value)||0,price:Number(row.querySelector('[data-pr]').value)||0}; }); if(!items.length||items.some(i=>!i.qty)){ toast(t('أدخل الكميات','Enter qty')); return; } const total=items.reduce((s,i)=>s+i.qty*i.price,0);
    if(editInv){ reversePurchase(editInv); const newInv=Object.assign({},editInv,{supplierId:suppId,supplierName:supp?supp.name:'',items,total,updatedAt:nowISO()}); applyPurchase(newInv); const arr=DB.get('purchases'); const k=arr.findIndex(x=>x.id===editInv.id); if(k>=0) arr[k]=newInv; DB.set('purchases',arr); logAudit(t('تعديل فاتورة شراء','Edit purchase'),newInv.code, {type:CFG.AUDIT.EDIT, ref:newInv.id}); closeModal(); renderPurchases(); toast(t('تم الحفظ','Saved')); }
    else { if(!requirePost()) return; if(isPeriodLocked(periodOf(nowISO()))){ toast(t('الفترة مقفلة لا يمكن الترحيل','Period locked - cannot post')); return; } const code=nextNumber('PU','PU-',6); const inv={id:uid(),code,type:'purchase',supplierId:suppId,supplierName:supp?supp.name:'',items,total,createdAt:nowISO()}; const purchases=DB.get('purchases'); purchases.push(inv); DB.set('purchases',purchases); applyPurchase(inv); logAudit(t('فاتورة شراء','Purchase'),inv.code, {type:CFG.AUDIT.ADD, ref:inv.id}); closeModal(); renderPurchases(); toast(t('تم الحفظ','Saved')); } }},{label:t('إلغاء','Cancel'),cls:'btn',onClick:closeModal}]);
  const box=$('#puItems'); box.innerHTML='';
  if(editInv){ editInv.items.forEach(it=>{ addPuItem(); const row=box.lastElementChild; row.querySelector('[data-p]').value=it.productId; row.querySelector('[data-q]').value=it.qty; row.querySelector('[data-pr]').value=it.price; }); $('#puSupp').value=editInv.supplierId; } else { addPuItem(); }
  puRecalc(); }
function addPuItem(){ const row=document.createElement('div'); row.className='pu-row'; row.innerHTML=`<select data-p>${DB.get('products').map(p=>`<option value="${p.id}">${esc(p.name)}</option>`).join('')}</select><input data-q type="number" placeholder="${t('كمية','Qty')}" value="1"><input data-pr type="number" placeholder="${t('سعر','Price')}" value="0" onchange="puRecalc()">`; $('#puItems').appendChild(row); puRecalc(); }
function puRecalc(){ let total=0; $$('#puItems .pu-row').forEach(r=>{ total+=(Number(r.querySelector('[data-q]').value)||0)*(Number(r.querySelector('[data-pr]').value)||0); }); $('#puTotals').innerHTML=`<b>${t('الإجمالي','Total')}: ${money(total)}</b>`; }
function openPurchaseOrderModal(){ const products=DB.get('products'); openModal(t('أمر شراء','Purchase Order'), `<div class="form-grid"><label>${t('المورد','Supplier')}<select id="poSupp">${DB.get('suppliers').map(s=>`<option value="${s.id}">${esc(s.name)}</option>`).join('')}</select></label></div><div id="poItems"></div>`, [{label:t('حفظ','Save'),cls:'btn-primary',onClick:()=>{ const suppId=$('#poSupp').value; const supp=DB.get('suppliers').find(s=>s.id===suppId); const items=$$('#poItems .po-row').map(row=>({productId:row.querySelector('[data-p]').value,name:(DB.get('products').find(x=>x.id===row.querySelector('[data-p]').value)||{}).name,qty:Number(row.querySelector('[data-q]').value)||0})); const po={id:uid(),code:nextNumber('PO','PO-',6),supplierId:suppId,supplierName:supp?supp.name:'',items,status:'pending',createdAt:nowISO()};     const poArr=DB.get('purchaseOrders'); poArr.push(po); DB.set('purchaseOrders',poArr); logAudit(t('أمر شراء','PO'),po.code, {type:CFG.AUDIT.ADD, ref:po.id}); closeModal(); renderPurchases(); }},{label:t('إلغاء','Cancel'),cls:'btn',onClick:closeModal}]); $('#poItems').innerHTML=''; addPoItem(); }
function addPoItem(){ const row=document.createElement('div'); row.className='po-row'; row.innerHTML=`<select data-p>${DB.get('products').map(p=>`<option value="${p.id}">${esc(p.name)}</option>`).join('')}</select><input data-q type="number" placeholder="${t('كمية','Qty')}" value="1">`; $('#poItems').appendChild(row); }
function reversePurchase(inv){ const products=DB.get('products'); (inv.items||[]).forEach(it=>{ const p=products.find(x=>x.id===it.productId); if(p) adjStock(p,-it.qty, inv?inv.warehouseId:null); }); DB.set('products',products); DB.set('journal',DB.get('journal').filter(j=>j.ref!==inv.id)); const supps=DB.get('suppliers'); const s=supps.find(x=>x.id===inv.supplierId); if(s){ s.balance=(s.balance||0)-(inv.total||0); DB.set('suppliers',supps); } }
function applyPurchase(inv){ const products=DB.get('products'); (inv.items||[]).forEach(it=>{ const p=products.find(x=>x.id===it.productId); if(p){ adjStock(p,it.qty, inv?inv.warehouseId:null); p.buyingPrice=it.price; } addPurchaseLayer(it.productId,it.qty,it.price); }); DB.set('products',products);
  const supps=DB.get('suppliers'); const s=supps.find(x=>x.id===inv.supplierId); if(s){ s.balance=(s.balance||0)+(inv.total||0); DB.set('suppliers',supps); }
  const rate=getTaxRate()/100; const net=rate>0?inv.total/(1+rate):inv.total; const vat=inv.total-net;
  const J=DB.get('journal'); const d=new Date().toISOString().slice(0,10);
  const lines=[{accountId:CFG.ACC.INVENTORY,debit:DEC.round(net),credit:0},{accountId:CFG.ACC.VAT_IN,debit:DEC.round(vat),credit:0},{accountId:CFG.ACC.PAYABLE,debit:0,credit:DEC.round(inv.total)}];
  if(vat>0) lines.push({accountId:CFG.ACC.PURCHASES,debit:DEC.round(net),credit:0}); else lines.push({accountId:CFG.ACC.PURCHASES,debit:DEC.round(inv.total),credit:0});
  J.push({id:uid(),date:d,desc:t('شراء','Purchase')+' '+inv.code,lines:normalizeLines(lines),ref:inv.id}); DB.set('journal',J); }
function deletePurchase(id){ confirmModal(t('حذف','Delete'), t('حذف فاتورة الشراء وترحيل العكس؟','Delete purchase and reverse?'), ()=>{ const p=DB.get('purchases').find(x=>x.id===id); if(!p) return; reversePurchase(p); DB.set('purchases',DB.get('purchases').filter(x=>x.id!==id));     if(p) logAudit(t('حذف فاتورة شراء','Delete purchase'), p.code, {type:CFG.AUDIT.DELETE, ref:id}); renderPurchases(); }); }
/* ============================ ACCOUNTING ============================ */
function renderAccounting(){ const accounts=DB.get('accounts'); const balances=computeBalances(); $('#screen').innerHTML=`<div class="screen">${pageHead(t('الحسابات','Accounting'),{icon:'🧮',sub:t('دليل الحسابات والقيود والتقارير','Chart of accounts, entries & reports'),actions:`<button class="btn btn-primary" onclick="openOpeningBalances()">${t('رصيد افتتاحي','Opening Balances')}</button><button class="btn" onclick="openAccountModal()">${t('حساب جديد','New Account')}</button><button class="btn" onclick="openVoucherModal()">${t('قيد يدوي','Voucher')}</button>`})}
  ${panel({title:t('دليل الحسابات','Chart of Accounts'), flush:true, body:`<table class="tbl"><thead><tr><th>${t('الكود','Code')}</th><th>${t('الحساب','Account')}</th><th>${t('النوع','Type')}</th><th>${t('الرصيد','Balance')}</th></tr></thead><tbody>${accounts.map(a=>`<tr><td>${esc(a.code)}</td><td>${esc(a.name)}</td><td>${esc(a.type)}</td><td>${money(balances[a.id]||0)}</td></tr>`).join('')}</tbody></table>`})}
  ${panel({title:t('التقارير المحاسبية','Financial Reports'), tools:`<button class="btn" onclick="reportTrialBalanceFull()">${t('ميزان مراجعة','Trial Balance')}</button><button class="btn" onclick="reportLedger()">${t('دفتر أستاذ','Ledger')}</button><button class="btn" onclick="reportBalanceSheet()">${t('مركز مالي','Balance Sheet')}</button><button class="btn" onclick="reportIncome()">${t('أرباح وخسائر','P&L')}</button><button class="btn" onclick="renderCashFlowScreen()">${t('التدفقات النقدية','Cash Flow')}</button>`})}
  ${panel({title:t('الوحدات المحاسبية','Accounting Modules'), tools:`<button class="btn" onclick="renderJournalScreen()">${t('القيود اليومية','Journal')}</button>
      <button class="btn" onclick="renderAccountsScreen()">${t('دليل الحسابات','Chart of Accounts')}</button>
      <button class="btn" onclick="renderPeriodsScreen()">${t('الفترات المحاسبية','Periods')}</button>
      <button class="btn" onclick="renderSeqScreen()">${t('تسلسل المستندات','Sequences')}</button>
      <button class="btn" onclick="renderAssetsScreen()">${t('الأصول الثابتة','Fixed Assets')}</button>
      <button class="btn" onclick="renderReconcileScreen()">${t('التسوية البنكية','Reconcile')}</button>
      <button class="btn" onclick="renderCostCentersScreen()">${t('مراكز التكلفة','Cost Centers')}</button>
      <button class="btn" onclick="renderClosingScreen()">${t('إقفال الفترة','Closing')}</button>
      <button class="btn" onclick="renderVatScreen()">${t('ضريبة القيمة المضافة','VAT')}</button>
       <button class="btn" onclick="renderVouchersScreen()">${t('السندات','Vouchers')}</button>
       <button class="btn" onclick="renderTransferVoucherScreen()">${t('تحويل نقدية','Transfer')}</button>
       <button class="btn" onclick="renderCollectionScreen()">${t('تحصيل الآجل','Credit Collection')}</button>
      <button class="btn" onclick="renderCostingScreen()">${t('تسعير المخزون','Costing')}</button>
      <button class="btn" onclick="renderSubledgersScreen()">${t('الدفاتر المساعدة','Sub-ledgers')}</button>
      <button class="btn" onclick="renderAgingScreen()">${t('التقرير العمري','Aging')}</button>`})}</div>`; applyLang(); }
function computeBalances(){ const accounts=DB.get('accounts'); const map={}; accounts.forEach(a=>map[a.id]=0); const mult={asset:1,expense:1,liability:-1,income:-1,equity:-1}; DB.get('journal').forEach(j=>{ if(j.status==='draft'||j.status==='pending') return; j.lines.forEach(l=>{ const acc=accounts.find(a=>a.id===l.accountId); if(acc){ map[l.accountId]=(map[l.accountId]||0)+l.debit-l.credit; } }); }); return map; }
function openingDone(){ return !!(DB.getOne('settings')||{}).openingDone; }
function openOpeningBalances(){ const products=DB.get('products'); const done=openingDone(); const cash=done?(DB.getOne('settings').openingCash||0):0; openModal(t('الرصيد الافتتاحي','Opening Balances')+(done?' ('+t('مُرحّل سابقاً','posted')+')':''), `<p>${t('أدخل النقدية في الصندوق والجرد الافتتاحي للمخزون. سيتم ترحيل قيد افتتاحي موازن تلقائياً.','Enter cash on hand and opening stock. A balanced opening entry is posted automatically.')}</p><div class="form-grid"><label>${t('النقدية في الصندوق','Cash in Drawer')}<input id="obCash" type="number" value="${cash}"></label></div><h3>${t('جرد افتتاحي للمخزون','Opening Stock')}</h3><table class="tbl"><thead><tr><th>${t('المنتج','Product')}</th><th>${t('الكمية','Qty')}</th><th>${t('تكلفة الوحدة','Cost')}</th></tr></thead><tbody>${products.map(p=>`<tr><td>${esc(p.name)}</td><td><input class="mini" id="obq_${p.id}" type="number" value="${p.qty||0}"></td><td><input class="mini" id="obc_${p.id}" type="number" value="${p.buyingPrice||0}"></td></tr>`).join('')}</tbody></table>`, [{label:t('تأكيد وترحيل','Confirm & Post'),cls:'btn-primary',onClick:()=>{ const cash=Number($('#obCash').value)||0; let invVal=0; const lines=[];     if(cash>0) lines.push({accountId:CFG.ACC.CASH,debit:cash,credit:0});     products.forEach(p=>{ const q=Number($('#obq_'+p.id).value)||0; const c=Number($('#obc_'+p.id).value)||0; if(!p.stockByWh)p.stockByWh={};p.stockByWh[defaultWhId()]=q;recountQty(p); if(q>0){ const v=DEC.mul(q,c); invVal=DEC.add(invVal,v); lines.push({accountId:CFG.ACC.INVENTORY,debit:v,credit:0}); } }); DB.set('products',products);   if(cash>0||invVal>0){ lines.push({accountId:CFG.ACC.CAPITAL,debit:0,credit:DEC.add(cash,invVal)}); const J=DB.get('journal'); const d=new Date().toISOString().slice(0,10); J.push({id:uid(),date:d,desc:t('قيد افتتاحي','Opening Entry'),lines:normalizeLines(lines),ref:null}); DB.set('journal',J); } const s=DB.getOne('settings')||{}; s.openingDone=true; s.openingCash=cash; DB.setOne('settings',s); logAudit(t('رصيد افتتاحي','Opening balance'), t('تم ضبط الأرصدة','Balances set')); closeModal(); renderAccounting(); toast(t('تم ترحيل الرصيد الافتتاحي','Opening balance posted')); }},{label:t('إلغاء','Cancel'),cls:'btn',onClick:closeModal}]); }
function openAccountModal(){ openModal(t('حساب جديد','New Account'), `<div class="form-grid"><label>${t('الاسم','Name')}<input id="acName"></label><label>${t('الكود','Code')}<input id="acCode"></label><label>${t('النوع','Type')}<select id="acType"><option value="asset">${t('أصل','Asset')}</option><option value="liability">${t('التزام','Liability')}</option><option value="income">${t('إيراد','Income')}</option><option value="expense">${t('مصروف','Expense')}</option><option value="equity">${t('حقوق ملكية','Equity')}</option></select></label></div>`, [{label:t('حفظ','Save'),cls:'btn-primary',onClick:()=>{ const name=$('#acName').value.trim(); if(!name){toast(t('الاسم مطلوب','Name required'));return;} const list=DB.get('accounts'); list.push({id:uid(),code:$('#acCode').value||(''+list.length),name,type:$('#acType').value,parent:null,balance:0}); DB.set('accounts',list); closeModal(); renderAccounting(); }},{label:t('إلغاء','Cancel'),cls:'btn',onClick:closeModal}]); }
function openVoucherModal(){ const accounts=DB.get('accounts'); openModal(t('قيد يدوي','Manual Voucher'), `<div class="form-grid"><label>${t('البيان','Desc')}<input id="vDesc"></label><label>${t('التاريخ','Date')}<input id="vDate" type="date" value="${new Date().toISOString().slice(0,10)}"></label></div><div id="vLines"></div><button class="btn" onclick="addVLine()">${t('إضافة سطر','Add line')}</button><div id="vCheck"></div>`, [{label:t('حفظ','Save'),cls:'btn-primary',onClick:()=>{ const lines=$$('#vLines .v-row').map(r=>({accountId:r.querySelector('[data-a]').value,debit:Number(r.querySelector('[data-d]').value)||0,credit:Number(r.querySelector('[data-c]').value)||0}));     const totD=DEC.sum(lines,'debit'); const totC=DEC.sum(lines,'credit'); if(!DEC.eq(totD,totC)){ toast(t('القيد غير متوازن','Unbalanced')); return; } const J=DB.get('journal'); J.push({id:uid(),date:$('#vDate').value,desc:$('#vDesc').value,lines:normalizeLines(lines),ref:null}); DB.set('journal',J); logAudit(t('قيد يدوي','Voucher'),$('#vDesc').value); closeModal(); renderAccounting(); }},{label:t('إلغاء','Cancel'),cls:'btn',onClick:closeModal}]); $('#vLines').innerHTML=''; addVLine(); addVLine(); }
function addVLine(){ const row=document.createElement('div'); row.className='v-row'; row.innerHTML=`<select data-a>${DB.get('accounts').map(a=>`<option value="${a.id}">${esc(a.name)}</option>`).join('')}</select><input data-d type="number" placeholder="${t('مدين','Debit')}" value="0"><input data-c type="number" placeholder="${t('دائن','Credit')}" value="0" onchange="vCheck()">`; $('#vLines').appendChild(row); vCheck(); }
function vCheck(){ let d=0,c=0; $$('#vLines .v-row').forEach(r=>{ d+=(Number(r.querySelector('[data-d]').value)||0); c+=(Number(r.querySelector('[data-c]').value)||0); }); $('#vCheck').innerHTML=`<div>${t('مدين','Debit')}: ${money(d)} | ${t('دائن','Credit')}: ${money(c)} ${Math.abs(d-c)<0.01?'✅':''}</div>`; }
function reportTrialBalance(){ const accounts=DB.get('accounts'); const b=computeBalances(); const rows=[['Code','Account','Debit','Credit']]; let td=0,tc=0; accounts.forEach(a=>{ const v=b[a.id]||0; const deb=v>0?v:0; const cre=v<0?-v:0; td+=deb; tc+=cre; rows.push([a.code,a.name,fmt(deb),fmt(cre)]); }); rows.push(['','Total',fmt(td),fmt(tc)]); downloadFile('trial_balance.csv',toCSV(rows),'text/csv'); exportPDF('trial_balance.pdf',[t('ميزان مراجعة','Trial Balance'),...rows.map(r=>r.join('   '))]); toast(t('تم التصدير','Exported')); }
function reportLedger(){ const accounts=DB.get('accounts'); const J=DB.get('journal'); openModal(t('دفتر أستاذ','Ledger'), `<select id="lgAcc" onchange="reportLedger()">${accounts.map(a=>`<option ${$('#lgAcc')&&$('#lgAcc').value===a.id?'selected':''} value="${a.id}">${esc(a.name)}</option>`).join('')}</select><div id="lgBody"></div>`, [{label:t('إغلاق','Close'),cls:'btn',onClick:closeModal}]); const aid=$('#lgAcc').value; let bal=0; let rows=''; J.forEach(j=>{ const ls=j.lines.filter(l=>l.accountId===aid); ls.forEach(l=>{ bal+=l.debit-l.credit; rows+=`<tr><td>${fmtDate(j.date)}</td><td>${esc(j.desc)}</td><td>${fmt(l.debit)}</td><td>${fmt(l.credit)}</td><td>${fmt(bal)}</td></tr>`; }); }); $('#lgBody').innerHTML=`<table class="tbl"><thead><tr><th>${t('التاريخ','Date')}</th><th>${t('البيان','Desc')}</th><th>${t('مدين','Debit')}</th><th>${t('دائن','Credit')}</th><th>${t('الرصيد','Balance')}</th></tr></thead><tbody>${rows}</tbody></table>`; }
function reportBalanceSheet(){ const from=$('#repFrom')?$('#repFrom').value:''; const to=$('#repTo')?$('#repTo').value:''; const accounts=DB.get('accounts'); const b=computeBalancesRange(from||null,to||null);
  const assets=accounts.filter(a=>a.type==='asset'); const liab=accounts.filter(a=>a.type==='liability'); const eq=accounts.filter(a=>a.type==='equity');
  const assetTotal=assets.reduce((s,a)=>s+(b[a.id]||0),0);
  const liabTotal=liab.reduce((s,a)=>s+-(b[a.id]||0),0);
  const eqTotal=eq.reduce((s,a)=>s+-(b[a.id]||0),0);
  const leTotal=liabTotal+eqTotal;
  const lines=[t('مركز مالي','Balance Sheet')+(from||to?(' ('+from+' → '+to+')'):'')];
  lines.push(t('الأصول','Assets')); assets.forEach(a=>lines.push('  '+a.name+': '+money(b[a.id]||0))); lines.push('  '+t('إجمالي الأصول','Total Assets')+': '+money(assetTotal));
  lines.push(t('الالتزامات','Liabilities')); liab.forEach(a=>lines.push('  '+a.name+': '+money(-(b[a.id]||0)))); lines.push('  '+t('إجمالي الالتزامات','Total Liabilities')+': '+money(liabTotal));
  lines.push(t('حقوق الملكية','Equity')); eq.forEach(a=>lines.push('  '+a.name+': '+money(-(b[a.id]||0)))); lines.push('  '+t('إجمالي حقوق الملكية','Total Equity')+': '+money(eqTotal));
  lines.push(t('إجمالي الالتزامات + حقوق الملكية','Total L+E')+': '+money(leTotal));
  const diff=assetTotal-leTotal;
  lines.push(diff===0?t('القائمة متوازنة','BALANCED'):t('القائمة غير متوازنة','UNBALANCED')+': '+money(diff));
  exportPDF('balance_sheet.pdf',lines); toast(t('تم التصدير','Exported')); }
function computeBalancesRange(from,to){ const accounts=DB.get('accounts'); const map={}; accounts.forEach(a=>map[a.id]=0); DB.get('journal').forEach(j=>{ if(j.status==='draft'||j.status==='pending') return; const d=j.date; if(from && d<from) return; if(to && d>to) return; j.lines.forEach(l=>{ const acc=accounts.find(a=>a.id===l.accountId); if(acc){ map[l.accountId]=(map[l.accountId]||0)+l.debit-l.credit; } }); }); return map; }
function reportIncome(){ const from=$('#repFrom')?$('#repFrom').value:''; const to=$('#repTo')?$('#repTo').value:''; const accounts=DB.get('accounts'); const b=computeBalancesRange(from||null,to||null); const inc=accounts.filter(a=>a.type==='income'); const exp=accounts.filter(a=>a.type==='expense'); const rev=inc.reduce((s,a)=>s+-(b[a.id]||0),0); const cost=exp.reduce((s,a)=>s+(b[a.id]||0),0); const lines=[t('أرباح وخسائر','P&L')+(from||to?(' ('+from+' → '+to+')'):'')+'  •  '+t('الإجمالي','Total')+': '+money(rev-cost),t('الإيرادات','Income')]; inc.forEach(a=>lines.push('  '+a.name+': '+money(-(b[a.id]||0)))); lines.push(t('المصروفات','Expenses')); exp.forEach(a=>lines.push('  '+a.name+': '+money(b[a.id]||0))); lines.push(t('صافي الربح','Net')+': '+money(rev-cost)); exportPDF('pnl.pdf',lines); toast(t('تم التصدير','Exported')); }
/* ============================ EMPLOYEES ============================ */
function renderEmployees(){ const list=DB.get('employees'); $('#screen').innerHTML=`<div class="screen">${pageHead(t('الموظفون','Employees'),{icon:'👥',sub:`${t('العدد','Count')}: ${list.length}`,actions:`<button class="btn btn-primary" onclick="openEmployeeModal()">＋ ${t('موظف جديد','New Employee')}</button>`})}
  ${panel({flush:true, body: `<table class="tbl"><thead><tr><th>${t('الاسم','Name')}</th><th>${t('الوظيفة','Job')}</th><th>${t('الراتب','Salary')}</th><th></th></tr></thead><tbody>${list.map(e=>`<tr><td>${esc(e.name)}</td><td>${esc(e.job)}</td><td>${money(e.salary)}</td><td><button class="btn" onclick="openEmployeeModal('${e.id}')">${t('تعديل','Edit')}</button> <button class="btn btn-danger" onclick="deleteEmployee('${e.id}')">${t('حذف','Delete')}</button></td></tr>`).join('')}</tbody></table>`})}</div>`; applyLang(); }
function openEmployeeModal(id){ const e=id?DB.get('employees').find(x=>x.id===id):null; openModal(t('موظف','Employee'), `<div class="form-grid"><label>${t('الاسم','Name')}<input id="eName" value="${esc(e?e.name:'')}"></label><label>${t('الوظيفة','Job')}<input id="eJob" value="${esc(e?e.job:'')}"></label><label>${t('الراتب','Salary')}<input id="eSalary" type="number" value="${e?e.salary:0}"></label><label>${t('الهاتف','Phone')}<input id="ePhone" value="${esc(e?e.phone:'')}"></label></div>`, [{label:t('حفظ','Save'),cls:'btn-primary',onClick:()=>{ const name=$('#eName').value.trim(); if(!name){toast(t('الاسم مطلوب','Name required'));return;} let list=DB.get('employees'); if(e){ Object.assign(e,{name,job:$('#eJob').value,salary:Number($('#eSalary').value)||0,phone:$('#ePhone').value}); } else list.push({id:uid(),name,job:$('#eJob').value,salary:Number($('#eSalary').value)||0,phone:$('#ePhone').value,hireDate:nowISO()}); DB.set('employees',list); closeModal(); renderEmployees(); }},{label:t('إلغاء','Cancel'),cls:'btn',onClick:closeModal}]); }
function deleteEmployee(id){ confirmModal(t('حذف','Delete'), t('حذف الموظف؟','Delete employee?'), ()=>{ DB.set('employees',DB.get('employees').filter(x=>x.id!==id)); renderEmployees(); }); }
/* ============================ REPORTS ============================ */
function renderReports(){ const types=[['sales',t('المبيعات','Sales')],['purchases',t('المشتريات','Purchases')],['stock',t('المخزون','Stock')],['customers',t('العملاء','Customers')],['suppliers',t('الموردون','Suppliers')],['returns',t('المرتجعات','Returns')],['sales_by_customer',t('مبيعات حسب العميل','Sales by Customer')],['purchases_by_supplier',t('مشتريات حسب المورد','Purchases by Supplier')],['profit_by_customer',t('الربح حسب العميل','Profit by Customer')]];
  const parties=[{id:'',name:t('الكل','All')}].concat(DB.get('customers').map(c=>({id:c.id,name:c.name+' ('+t('عميل','Cust')+')'})),DB.get('suppliers').map(s=>({id:s.id,name:s.name+' ('+t('مورد','Supp')+')'})));
  $('#screen').innerHTML=`<div class="screen">${pageHead(t('التقارير','Reports'),{icon:'📈',sub:t('تقارير مالية وتشغيلية','Financial & operational reports')})}
    ${panel({flush:true, body:`<div class="report-toolbar">
      <label>${t('النوع','Type')}<select id="repType" onchange="runReport()">${types.map(x=>`<option value="${x[0]}">${x[1]}</option>`).join('')}</select></label>
      <label>${t('من','From')}<input type="date" id="repFrom"></label>
      <label>${t('إلى','To')}<input type="date" id="repTo"></label>
      <label>${t('الدفع','Payment')}<select id="repPay"><option value="">${t('الكل','All')}</option><option value="cash">${t('نقدي','Cash')}</option><option value="credit">${t('آجل','Credit')}</option></select></label>
      <label>${t('الطرف','Party')}<select id="repParty">${parties.map(p=>`<option value="${p.id}">${esc(p.name)}</option>`).join('')}</select></label>
      <label>${t('بحث','Search')}<input id="repSearch" placeholder="..."></label>
      <button class="btn btn-primary" onclick="runReport()">${t('عرض','Show')}</button>
      <span class="report-export">
        <button class="btn" onclick="exportReport('excel')">Excel</button>
        <button class="btn" onclick="exportReport('csv')">CSV</button>
        <button class="btn" onclick="exportReport('pdf')">PDF</button>
      </span>
    </div>
    <div id="reportBody"></div>`})}
    <div class="section-title">${t('تقارير سريعة','Quick Reports')}</div>
    <div class="report-grid">
      <button class="report-card" onclick="reportSalesAnalysis()">${t('تحليل المبيعات (نمو)','Sales Analysis')}</button>
      <button class="report-card" onclick="reportTrialBalanceFull()">${t('ميزان المراجعة','Trial Balance')}</button>
      <button class="report-card" onclick="reportBalanceSheet()">${t('مركز مالي','Balance Sheet')}</button>
      <button class="report-card" onclick="reportIncome()">${t('أرباح وخسائر','P&L')}</button>
      <button class="report-card" onclick="gotoReport('sales_by_customer')">${t('مبيعات حسب العميل','Sales by Customer')}</button>
      <button class="report-card" onclick="gotoReport('purchases_by_supplier')">${t('مشتريات حسب المورد','Purchases by Supplier')}</button>
      <button class="report-card" onclick="gotoReport('profit_by_customer')">${t('الربح حسب العميل','Profit by Customer')}</button>
      <button class="report-card" onclick="exportAllData()">${t('نسخ احتياطي','Backup')}</button>
      <button class="report-card" onclick="importAllData()">${t('استرجاع','Restore')}</button>
    </div></div>`; applyLang(); runReport(); }
function gotoReport(type){ $('#repType').value=type; runReport(); }
function runReport(){
  const type=($('#repType')?$('#repType').value:'sales')||'sales';
  const from=$('#repFrom')?$('#repFrom').value:''; const to=$('#repTo')?$('#repTo').value:'';
  const pay=$('#repPay')?$('#repPay').value:''; const party=$('#repParty')?$('#repParty').value:'';
  const q=($('#repSearch')?$('#repSearch').value:'').toLowerCase().trim();
  let headers=[],rows=[],title='',sumIndex=null;
  const d0=from?new Date(from):null, d1=to?new Date(to):null; if(d1) d1.setHours(23,59,59,999);
  const inRange=iso=>{ if(!d0&&!d1) return true; const d=new Date(iso); return (!d0||d>=d0)&&(!d1||d<=d1); };
  const has=(s)=>!q||(s||'').toLowerCase().includes(q);
  if(type==='sales'){ title=t('تقرير المبيعات','Sales Report'); headers=[t('الكود','Code'),t('العميل','Customer'),t('التاريخ','Date'),t('الدفع','Payment'),t('الإجمالي','Total'),t('المدفوع','Paid')]; sumIndex=4;
    DB.get('invoices').filter(i=>i.type==='sale'&&inRange(i.createdAt)).forEach(i=>{ if(pay&&i.payment!==pay) return; if(party&&i.customerId!==party) return; if(!has(i.code+' '+(i.customerName||''))) return; rows.push([i.code,i.customerName,fmtDate(i.createdAt),i.payment==='credit'?t('آجل','Credit'):t('نقدي','Cash'),fmt(i.total),fmt(i.paid||0)]); }); }
  else if(type==='purchases'){ title=t('تقرير المشتريات','Purchases Report'); headers=[t('الكود','Code'),t('المورد','Supplier'),t('التاريخ','Date'),t('الإجمالي','Total')]; sumIndex=3;
    DB.get('purchases').filter(p=>inRange(p.createdAt)).forEach(p=>{ if(party&&p.supplierId!==party) return; if(!has(p.code+' '+(p.supplierName||''))) return; rows.push([p.code,p.supplierName,fmtDate(p.createdAt),fmt(p.total)]); }); }
  else if(type==='stock'){ title=t('تقرير المخزون','Stock Report'); headers=[t('المنتج','Product'),t('الكود','Code'),t('الكمية','Qty'),t('شراء','Buy'),t('بيع','Sell'),t('الموقع','Location')];
    DB.get('products').forEach(p=>{ if(!has(p.name+' '+(p.code||''))) return; rows.push([p.name,p.code,fmt(p.qty),fmt(p.buyingPrice),fmt(p.sellingPrice),p.location||'']); }); }
  else if(type==='customers'){ title=t('تقرير العملاء','Customers Report'); headers=[t('الاسم','Name'),t('الهاتف','Phone'),t('الرصيد','Balance'),t('النقاط','Points')]; sumIndex=2;
    DB.get('customers').forEach(c=>{ if(party&&c.id!==party) return; if(!has(c.name+' '+(c.phone||''))) return; rows.push([c.name,c.phone,fmt(c.balance),fmt(c.points)]); }); }
  else if(type==='suppliers'){ title=t('تقرير الموردين','Suppliers Report'); headers=[t('الاسم','Name'),t('الهاتف','Phone'),t('الرصيد','Balance')]; sumIndex=2;
    DB.get('suppliers').forEach(s=>{ if(party&&s.id!==party) return; if(!has(s.name+' '+(s.phone||''))) return; rows.push([s.name,s.phone,fmt(s.balance)]); }); }
  else if(type==='returns'){ title=t('تقرير المرتجعات','Returns Report'); headers=[t('كود المرتجع','Return'),t('الفاتورة الأصلية','Original'),t('التاريخ','Date'),t('القيمة','Value')]; sumIndex=3;
    DB.get('returns').forEach(r=>{ const o=DB.get('invoices').find(x=>x.id===r.invoiceId); if(party&&o&&o.customerId!==party) return; if(!has(r.code+' '+(o?o.code:''))) return; rows.push([r.code,o?o.code:'—',fmtDate(r.createdAt),fmt(r.total)]); }); }
  else if(type==='sales_by_customer'){ title=t('مبيعات حسب العميل','Sales by Customer'); headers=[t('العميل','Customer'),t('عدد الفواتير','Invoices'),t('الإجمالي','Total'),t('المدفوع','Paid'),t('المتبقي','Remaining')]; sumIndex=2;
    const map={}; DB.get('invoices').filter(i=>i.type==='sale'&&inRange(i.createdAt)).forEach(i=>{ if(pay&&i.payment!==pay) return; if(party&&i.customerId!==party) return; const k=i.customerId; const m=map[k]||(map[k]={name:i.customerName||t('غير معروف','Unknown'),n:0,tot:0,paid:0}); m.n++; m.tot+=i.total||0; m.paid+=(i.paid||0); }); Object.values(map).forEach(m=>{ if(!has(m.name)) return; rows.push([m.name,m.n,fmt(m.tot),fmt(m.paid),fmt(m.tot-m.paid)]); }); }
  else if(type==='purchases_by_supplier'){ title=t('مشتريات حسب المورد','Purchases by Supplier'); headers=[t('المورد','Supplier'),t('عدد الفواتير','Invoices'),t('الإجمالي','Total')]; sumIndex=2;
    const map={}; DB.get('purchases').filter(p=>inRange(p.createdAt)).forEach(p=>{ if(party&&p.supplierId!==party) return; const k=p.supplierId; const m=map[k]||(map[k]={name:p.supplierName||t('غير معروف','Unknown'),n:0,tot:0}); m.n++; m.tot+=p.total||0; }); Object.values(map).forEach(m=>{ if(!has(m.name)) return; rows.push([m.name,m.n,fmt(m.tot)]); }); }
  else if(type==='profit_by_customer'){ title=t('الربح حسب العميل','Profit by Customer'); headers=[t('العميل','Customer'),t('المبيعات','Sales'),t('التكلفة','Cost'),t('الربح','Profit')]; sumIndex=1;
    const map={}; DB.get('invoices').filter(i=>i.type==='sale'&&inRange(i.createdAt)).forEach(i=>{ if(pay&&i.payment!==pay) return; if(party&&i.customerId!==party) return; const k=i.customerId; const m=map[k]||(map[k]={name:i.customerName||t('غير معروف','Unknown'),sales:0,cost:0}); m.sales+=i.total||0; (i.items||[]).forEach(it=>{ m.cost+=(it.buying||0)*(it.qty||0); }); }); Object.values(map).forEach(m=>{ if(!has(m.name)) return; rows.push([m.name,fmt(m.sales),fmt(m.cost),fmt(m.sales-m.cost)]); }); }
  window._reportData={title,headers,rows};
  let sumTxt=''; if(sumIndex!==null){ const s=rows.reduce((a,r)=>a+(Number(String(r[sumIndex]).replace(/[^0-9.\-]/g,'')||0)),0); sumTxt=` · ${t('الإجمالي','Total')}: ${money(s)}`; }
  $('#reportBody').innerHTML=`<div class="report-summary">${esc(title)} — ${t('عدد','Count')}: ${rows.length}${sumTxt}</div>`+(rows.length?`<table class="tbl" id="repTable"><thead><tr>${headers.map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${r.map(c=>`<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`:`<div class="empty">${t('لا نتائج','No results')}</div>`);
  applyLang();
}
function slug(s){ return String(s||'report').replace(/[^a-zA-Z0-9_\u0600-\u06FF]/g,'_'); }
function exportReport(kind){ const d=window._reportData; if(!d||!d.rows){ toast(t('لا بيانات','No data')); return; }
  if(kind==='csv'){ downloadFile(slug(d.title)+'.csv','\uFEFF'+toCSV([d.headers].concat(d.rows)),'text/csv;charset=utf-8'); toast(t('تم التصدير','Exported')); }
  else if(kind==='excel'){ downloadFile(slug(d.title)+'.xls',tableToExcel(d.title,d.headers,d.rows),'application/vnd.ms-excel'); toast(t('تم التصدير','Exported')); }
  else if(kind==='pdf'){ exportTablePDF(d.title,d.headers,d.rows); } }
function exportTablePDF(title,headers,rows){ try{ const doc=pdfDoc(); const pageW=doc.internal.pageSize.getWidth(); const startX=10; let y=24; doc.setFontSize(13); doc.text(title,startX,16); doc.setFontSize(8); doc.text(new Date().toLocaleString(),startX,20);
    const cols=Math.max(headers.length,1); const avail=pageW-startX-10; const cw=headers.map(()=>avail/cols);
    const drawHead=()=>{ let x=startX; doc.setFillColor(59,91,219); doc.setTextColor(255,255,255); headers.forEach((h,i)=>{ doc.rect(x,y,cw[i],7,'F'); doc.text(String(h==null?'':h),x+2,y+5); x+=cw[i]; }); doc.setTextColor(0,0,0); y+=7; };
    drawHead();
    rows.forEach(r=>{ if(y>280){ doc.addPage(); y=16; drawHead(); } let x=startX; r.forEach((c,i)=>{ doc.rect(x,y,cw[i],7); doc.text(String(c==null?'':c),x+2,y+5); x+=cw[i]; }); y+=7; });
    doc.save(slug(title)+'.pdf'); }catch(e){ toast(t('تعذر إنشاء PDF','PDF failed')); } }
function reportSalesAnalysis(){ const invs=DB.get('invoices').filter(i=>i.type==='sale'); const now=new Date(); const today=now.toISOString().slice(0,10); const ym=now.toISOString().slice(0,7); const lm=new Date(now.getFullYear(),now.getMonth()-1,1).toISOString().slice(0,7);
  const sumOn=d=>invs.filter(i=>(i.createdAt||'').slice(0,10)===d).reduce((s,i)=>s+(i.total||0),0);
  const sumOnM=m=>invs.filter(i=>(i.createdAt||'').slice(0,7)===m).reduce((s,i)=>s+(i.total||0),0);
  const todayTot=sumOn(today), thisMonth=sumOnM(ym), lastMonth=sumOnM(lm);
  const growth=lastMonth>0?((thisMonth-lastMonth)/lastMonth*100):(thisMonth>0?100:0);
  const lastMonthDay=sumOn(lm+'-'+today.slice(8));
  $('#screen').innerHTML=`<div class="screen">${pageHead(t('تحليل المبيعات','Sales Analysis'),{icon:'📈',sub:t('مؤشرات الأداء','Performance metrics')})}
    <div class="kpi-grid">
      <div class="kpi"><span>${t('مبيعات اليوم','Today')}</span><b>${money(todayTot)}</b></div>
      <div class="kpi"><span>${t('مبيعات الشهر','This Month')}</span><b>${money(thisMonth)}</b></div>
      <div class="kpi"><span>${t('الشهر الماضي','Last Month')}</span><b>${money(lastMonth)}</b></div>
      <div class="kpi"><span>${t('نمو المبيعات (شهر/شهر)','MoM Growth')}</span><b class="${growth>=0?'text-pos':'text-neg'}">${growth>=0?'▲':'▼'} ${fmt(growth)}%</b></div>
      <div class="kpi"><span>${t('اليوم مقابل نظيره بالشهر الماضي','Today vs Last Month Day')}</span><b>${money(lastMonthDay)}</b></div>
    </div>
    <div class="report-grid"><button class="report-card" onclick="renderReports()">${t('التقارير','Reports')}</button></div></div>`; applyLang(); }
function exportAllData(){ const keys=Object.keys(localStorage).filter(k=>k.startsWith('erp_')); const data={}; keys.forEach(k=>data[k]=localStorage.getItem(k)); downloadFile('nexus_backup.json', JSON.stringify(data,'','2'),'application/json'); toast(t('تم النسخ','Backed up')); }
function importAllData(){ const inp=document.createElement('input'); inp.type='file'; inp.accept='.json'; inp.onchange=async()=>{ try{ const txt=await readFileAsText(inp.files[0]); const data=JSON.parse(txt); Object.keys(data).forEach(k=>localStorage.setItem(k,data[k])); toast(t('تم الاسترجاع','Restored')); boot(); }catch(e){ toast(t('فشل الاسترجاع','Restore failed')); } }; inp.click(); }
/* ============================ AUDIT ============================ */
function renderAudit(){ const list=DB.get('audit'); const typeBadge=(ty)=>{ const map={add:['✅',t('إضافة','Add')],edit:['✏️',t('تعديل','Edit')],delete:['⛔',t('حذف','Delete')],login:['🔑',t('دخول','Login')],sync:['🔄',t('مزامنة','Sync')],other:['•',t('أخرى','Other')]}; const m=map[ty]||map.other; return `<span class="audit-type">${m[0]} ${m[1]}</span>`; }; const changesHtml=(ch)=>{ if(!ch||!ch.length) return ''; return '<div class="audit-changes">'+ch.map(c=>`<div>${esc(c.label)}: <span class="old">${esc(c.old??'—')}</span> → <span class="new">${esc(c.new??'—')}</span></div>`).join('')+'</div>'; };   $('#screen').innerHTML=`<div class="screen">${pageHead(t('سجل التدقيق','Audit Log'),{icon:'🛡️',sub:`${t('العدد','Count')}: ${list.length}`})}
  ${panel({flush:true, body:`<table class="tbl"><thead><tr><th>${t('الوقت','Time')}</th><th>${t('المستخدم','User')}</th><th>${t('النوع','Type')}</th><th>${t('الإجراء','Action')}</th><th>${t('التفاصيل','Details')}</th></tr></thead><tbody>${list.map(a=>`<tr><td>${fmtDateTime(a.time)}</td><td>${esc(a.user)}</td><td>${typeBadge(a.type)}</td><td>${esc(a.action)}</td><td>${esc(a.details)}${changesHtml(a.changes)}</td></tr>`).join('')}</tbody></table>`})}</div>`; applyLang(); }
/* ============================ SETTINGS ============================ */
function renderSettings(){ const s=DB.getOne('settings')||{}; const comp=currentCompany()||{};   $('#screen').innerHTML=`<div class="screen">${pageHead(t('الإعدادات','Settings'),{icon:'⚙️',sub:t('إعدادات النظام والشركة','System & company settings')})}
  <div class="set-section">
    <div class="section-title">${t('بيانات الشركة','Company Info')}</div>
    <p class="set-desc">${t('الاسم والشعار والبيانات الضريبية للشركة','Company name, logo and tax details')}</p>
    <div class="form-grid">
      <label>${t('اسم الشركة','Company')}<input id="setComp" value="${esc(s.companyName||'')}"></label>
      <label>${t('الرقم الضريبي','Tax Number')}<input id="setTaxNo" value="${esc(s.taxNumber||comp.taxNo||'')}"></label>
      <label>${t('شعار المتجر (صورة)','Store Logo')}<input type="file" id="setLogo" accept="image/*" onchange="uploadLogo(this)"> ${s.logo?`<img id="logoPrev" src="${esc(s.logo)}" class="logo-prev">`:''}<input type="hidden" id="setLogoData" value="${esc(s.logo||'')}"></label>
    </div>
  </div>
  <div class="set-section">
    <div class="section-title">${t('الفاتورة والطباعة','Invoice & Print')}</div>
    <p class="set-desc">${t('العملة والضريبة والخصم الافتراضي وإعدادات الإيصال','Currency, tax, default discount and receipt options')}</p>
    <div class="form-grid">
      <label>${t('العملة','Currency')}<input id="setCur" value="${esc(s.currency||'ج.م')}"></label>
      <label>${t('نسبة الضريبة %','Tax %')}<input id="setTax" type="number" value="${s.taxRate||0}"></label>
      <label>${t('خصم افتراضي %','Disc %')}<input id="setDisc" type="number" value="${s.defaultDiscount||0}"></label>
      <label>${t('حجم الطباعة','Print Size')}<select id="setPrint"><option ${s.printSize==='80mm'?'selected':''}>80mm</option><option ${s.printSize==='A4'?'selected':''}>A4</option></select></label>
      <label>${t('لغة الواجهة','Language')}<select id="setLang"><option value="ar" ${LANG==='ar'?'selected':''}>${t('عربي','Arabic')}</option><option value="en" ${LANG==='en'?'selected':''}>${t('إنجليزي','English')}</option></select></label>
      <label>${t('ملاحظة التذييل','Footer Note')}<input id="setNote" value="${esc(s.receiptNote||'')}" placeholder="${t('شكراً لزيارتكم','Thanks for visiting')}"></label>
      <label>${t('الوضع','Theme')}<select id="setTheme"><option value="light" ${(s.theme||'light')==='light'?'selected':''}>${t('فاتح','Light')}</option><option value="dark" ${(s.theme||'light')==='dark'?'selected':''}>${t('داكن','Dark')}</option></select></label>
    </div>
  </div>
  <div class="set-section">
    <div class="section-title">${t('الأمان','Security')}</div>
    <p class="set-desc">${t('رمز قفل التطبيق والقفل التلقائي','App lock PIN and auto lock')}</p>
    <div class="form-grid">
      <label>${t('رمز قفل التطبيق','App Lock PIN')}<input id="setPin" type="password" value="${esc(s.pin||'')}" placeholder="••••"></label>
      <label>${t('قفل تلقائي بعد (دقيقة)','Auto Lock (min)')}<input id="setAutoLock" type="number" value="${s.autoLockMin||5}"></label>
      <div class="set-actions m-0">
        <button class="btn" onclick="openUserModal()">${t('إضافة مستخدم','Add User')}</button>
        <span class="notify-dot ${s.notifications?'on':''}"></span>
        <button class="btn" onclick="enableNotifications()">${t('تفعيل الإشعارات','Enable Notifications')}</button>
      </div>
    </div>
  </div>
  <div class="set-section">
    <div class="section-title">${t('المزامنة والنسخ الاحتياطي','Sync & Backup')}</div>
    <p class="set-desc">${t('إعدادات الخادم والمزامنة التلقائية','Server config and automatic sync')}</p>
    <div class="form-grid">
      <label>${t('رابط الخادم','Server URL')}<input id="setServer" value="${esc(s.serverUrl||'')}" placeholder="http://localhost:3000"></label>
      <label>${t('مستخدم الخادم','Server User')}<input id="setSUser" value="${esc(s.apiUser||'')}"></label>
      <label>${t('كلمة مرور الخادم','Server Pass')}<input id="setSPass" type="password" placeholder="••••"></label>
      <label><input type="checkbox" id="setAutoSync" ${s.autoSync?'checked':''}> ${t('مزامنة تلقائية','Auto Sync')}</label>
    </div>
    <div class="set-actions">
      <button class="btn" onclick="syncNow()">${t('مزامنة الآن','Sync Now')}</button>
      <button class="btn" onclick="serverLoginFromForm()">${t('دخول الخادم','Server Login')}</button>
      <button class="btn" onclick="syncPull()">${t('سحب من الخادم','Pull from Server')}</button>
      <span class="sync-status"></span>
    </div>
    <div class="set-actions mt-sm">
      <button class="btn" onclick="Backup.download()">⬇️ ${t('تصدير نسخة احتياطية','Export Backup')}</button>
      <button class="btn" onclick="Backup.pickAndImport()">⬆️ ${t('استيراد نسخة','Import Backup')}</button>
    </div>
    <div class="form-grid mt-sm">
      <label>${t('نسخ احتياطي تلقائي كل (ساعة)','Auto backup every (hours)')}<input id="setAutoBackup" type="number" min="0" value="${s.autoBackupHours||0}" placeholder="0 = ${t('معطّل','off')}"></label>
      <span class="muted">${t('آخر نسخة','Last backup')}: ${s.lastBackup?fmtDateTime(s.lastBackup):t('لم يُعمل بعد','never')}</span>
    </div>
    <div class="form-grid mt-sm">
      <label>${t('Firebase API Key')}<input id="setFBKey" value="${esc((s.firebaseConfig||{}).apiKey||'')}" placeholder="AIza..."></label>
      <label>${t('Firebase Project ID')}<input id="setFBProj" value="${esc((s.firebaseConfig||{}).projectId||'')}" placeholder="my-project"></label>
    </div>
  </div>
  <div class="set-section">
    <div class="section-title">${t('الأدوات','Tools')}</div>
    <p class="set-desc">${t('تخصيص الواجهة وطباعة بلوتوث والحساب السحابي','UI customization, Bluetooth print, cloud login')}</p>
    <div class="set-actions">
      <button class="btn" onclick="toggleFocusMode()">🎨 ${t('تخصيص الواجهة','Focus Mode')}</button>
      <button class="btn btn-danger" onclick="resetAllUICustomizations()">⟲ ${t('إعادة الواجهة الأصلية','Reset UI to Default')}</button>
      <button class="btn" onclick="connectBluetooth()">🖨️ ${t('طباعة بلوتوث','Bluetooth Print')}</button>
      <button class="btn" onclick="firebaseLogin()">☁️ ${t('دخول سحابي','Cloud Login')}</button>
      <button class="btn" onclick="firebasePush()">⬆️ ${t('رفع سحابي','Cloud Push')}</button>
      <button class="btn" onclick="firebasePull()">⬇️ ${t('سحب سحابي','Cloud Pull')}</button>
    </div>
  </div>
  <div class="set-section">
    <div class="section-title">${t('إدارة البيانات','Data Management')}</div>
    <p class="set-desc">${t('مسح البيانات التجريبية والفواتير والحركات مع الإبقاء على إعدادات الشركة والحسابات والمستخدمين','Clear demo data, invoices and movements while keeping company settings, accounts and users')}</p>
    <div class="set-actions">
      <button class="btn btn-danger" onclick="clearDemoData()">🗑️ ${t('مسح البيانات التجريبية','Clear Demo Data')}</button>
    </div>
  </div>
  <div class="set-users">
    <div class="section-title mt-0">${t('المستخدمون','Users')}</div>
    <table class="tbl"><thead><tr><th>${t('الاسم','Name')}</th><th>${t('الدور','Role')}</th><th></th></tr></thead><tbody>${DB.get('users').map(u=>`<tr><td>${esc(u.name)}</td><td>${roleLabel(u.role)}</td><td><button class="btn btn-danger" onclick="deleteUser('${u.id}')">${t('حذف','Delete')}</button></td></tr>`).join('')}</tbody></table>
  </div>
  <button class="btn btn-primary" onclick="saveSettings()">${t('حفظ','Save')}</button>
  </div>`; applyLang(); bindSettingsAutosave(); }
function uploadLogo(input){ const f=input.files&&input.files[0]; if(!f) return; const r=new FileReader(); r.onload=()=>{ const data=document.getElementById('setLogoData'); if(data) data.value=r.result; let prev=document.getElementById('logoPrev'); if(!prev){ prev=document.createElement('img'); prev.id='logoPrev'; prev.style.height='38px'; prev.style.marginRight='6px'; prev.style.verticalAlign='middle'; input.parentNode.insertBefore(prev, input.nextSibling); } prev.src=r.result; toast(t('تم تحميل الشعار','Logo loaded')); }; r.readAsDataURL(f); }
function saveSettings(silent){ const s=DB.getOne('settings')||{}; s.companyName=$('#setComp').value; s.currency=$('#setCur').value||'ج.م'; s.taxRate=Number($('#setTax').value)||0; s.defaultDiscount=Number($('#setDisc').value)||0; s.printSize=$('#setPrint').value; s.pin=$('#setPin').value||''; s.taxNumber=$('#setTaxNo').value.trim(); s.logo=$('#setLogoData').value; s.receiptNote=$('#setNote').value.trim(); s.autoLockMin=Number($('#setAutoLock').value)||5; s.theme=$('#setTheme').value||'light'; LANG=$('#setLang').value; s.lang=LANG; s.serverUrl=$('#setServer').value.trim(); s.apiUser=$('#setSUser').value.trim(); s.autoSync=$('#setAutoSync').checked; s.autoBackupHours=Number($('#setAutoBackup').value)||0; const fbKey=$('#setFBKey')?$('#setFBKey').value.trim():''; const fbProj=$('#setFBProj')?$('#setFBProj').value.trim():''; if(fbKey||fbProj) s.firebaseConfig={apiKey:fbKey,projectId:fbProj,authDomain:(fbProj+'.firebaseapp.com'),storageBucket:(fbProj+'.appspot.com')}; DB.setOne('settings',s); applyLang(); if(silent){ toast(t('تم الحفظ','Saved')); _setSyncStatus('dirty',t('لم تتم المزامنة','Not synced')); } else { toast(t('تم الحفظ','Saved')); renderShell(); } scheduleAutoBackup(); }
function bindSettingsAutosave(){ const ids=['setComp','setCur','setTax','setDisc','setPrint','setLang','setNote','setTaxNo','setPin','setAutoLock','setServer','setSUser','setAutoSync','setTheme','setAutoBackup']; ids.forEach(id=>{ const el=$('#'+id); if(el){ el.addEventListener('change',()=>saveSettings(true)); el.addEventListener('input',()=>{ if(el.type!=='text'&&el.type!=='password'&&el.tagName!=='SELECT') return; saveSettings(true); }); } }); const logo=$('#setLogo'); if(logo) logo.addEventListener('change',()=>setTimeout(()=>saveSettings(true),50)); }
/* Clear all demo/transactional data for the active company, keeping config (companies, users, settings, branches, accounts, journal, audit). */
function clearDemoData(){ confirmModal(t('مسح البيانات التجريبية','Clear Demo Data'), t('سيتم حذف المنتجات والعملاء والموردين والفواتير والمشتريات والأوامر والحركات والقيود. هل أنت متأكد؟','This deletes products, customers, suppliers, invoices, purchases, POs, movements and entries. Are you sure?'), ()=>{
   ['products','categories','units','warehouses','costCenters','customers','suppliers','invoices','purchases','purchaseOrders','returns','expenses','movements','employees','quotes','trash','coupons','stockLayers','vouchers','journal','bankAccounts','accounts','periods','seq','assets'].forEach(k=>DB.remove(k));
   /* keep accounts seeded so posting still works; re-seed accounts + base lists only if missing */
   if(!DB.get('accounts').length) seedAccounts(_activeCompanyId);
   if(!DB.get('categories').length) DB.set('categories',[]);
   if(!DB.get('units').length) DB.set('units',[{id:uid(),name:'قطعة'}]);
   if(!DB.get('warehouses').length) DB.set('warehouses',[{id:uid(),name:'المخزن الرئيسي',branchId:null}]);
   if(!DB.get('customers').length) DB.set('customers',[]);
   DB.setOne('seeded',true); DB.setOne('acc_seeded', DB.get('accounts').length?true:false);
   logAudit(t('مسح البيانات','Clear data'), t('تم مسح البيانات التجريبية','Demo data cleared'), {type:CFG.AUDIT.OTHER});
   ['sale','purchase','po'].forEach(k=>invClearDraft(k));
   renderSettings(); toast(t('تم مسح البيانات التجريبية','Demo data cleared'));
 }); }
function serverLoginFromForm(){ const u=$('#setSUser').value.trim(); const p=$('#setSPass').value; syncLogin(u,p).then(ok=>{ if(ok) syncPull(); }); }
async function syncNow(){ const ok=await syncPush(); if(!ok){ const s=DB.getOne('settings')||{}; if(!s.apiToken && s.serverUrl){ toast(t('سجّل دخول الخادم أولاً','Login to server first')); } } }
function openUserModal(){ openModal(t('مستخدم','User'), `<div class="form-grid"><label>${t('الاسم','Name')}<input id="uName"></label><label>${t('اسم الدخول','Username')}<input id="uUser"></label><label>${t('كلمة المرور','Password')}<input id="uPass" type="password"></label><label>${t('البريد','Email')}<input id="uEmail"></label><label>${t('الدور','Role')}<select id="uRole">${Object.keys(ROLES).map(r=>`<option value="${r}">${ROLES[r].label}</option>`).join('')}</select></label></div>`, [{label:t('حفظ','Save'),cls:'btn-primary',onClick:async()=>{ const name=$('#uName').value.trim(); if(!name){toast(t('الاسم مطلوب','Name required'));return;} const salt=String(Math.random()).slice(2); const hash=await hashPw($('#uPass').value, salt); const list=DB.get('users'); list.push({id:uid(),name,username:$('#uUser').value,hash,salt,email:$('#uEmail').value,role:$('#uRole').value,active:true}); DB.set('users',list); closeModal(); renderSettings(); }},{label:t('إلغاء','Cancel'),cls:'btn',onClick:closeModal}]); }
function deleteUser(id){ confirmModal(t('حذف','Delete'), t('حذف المستخدم؟','Delete user?'), ()=>{ DB.set('users',DB.get('users').filter(u=>u.id!==id)); renderSettings(); }); }
/* ============================ NOTIFICATIONS ============================ */
let _swReg=null;
function registerSW(){ if(typeof navigator!=='undefined' && 'serviceWorker' in navigator){ navigator.serviceWorker.register('sw.js').then(r=>{_swReg=r;}).catch(()=>{}); } }
async function enableNotifications(){ try{ if(!('Notification' in window)){ toast(t('المتصفح لا يدعم الإشعارات','Notifications unsupported')); return; } const perm=await Notification.requestPermission(); if(perm!=='granted'){ toast(t('تم رفض الإشعارات','Notifications denied')); return; } const s=DB.getOne('settings')||{}; s.notifications=true; DB.setOne('settings',s); toast(t('تم تفعيل الإشعارات','Notifications enabled')); renderSettings(); }catch(e){ toast(t('تعذر التفعيل','Enable failed')); } }
async function notify(title, body){ try{ if('Notification' in window && Notification.permission==='granted'){ if(_swReg&&_swReg.showNotification){ await _swReg.showNotification(title,{body}); return; } new Notification(title,{body}); } }catch(e){} }
function checkNotifications(){ ensureStockByWh(); const products=DB.get('products'); const low=products.filter(p=>(p.qty||0)<=(p.minQty||0)); low.forEach(p=>{ const msg=t('منتج تحت الحد','Low stock')+': '+p.name; toast('⚠️ '+msg); notify(t('تنبيه مخزون','Stock alert'), msg); }); }
/* ============================ SYNC (client) ============================ */
function collectState(){ const out={}; Object.keys(localStorage).filter(k=>k.startsWith('erp_')).forEach(k=>out[k]=localStorage.getItem(k)); return out; }
function applyState(obj){ if(obj&&typeof obj==='object'){ Object.keys(obj).forEach(k=>localStorage.setItem(k,obj[k])); } }
function _serverUrl(){ const s=DB.getOne('settings')||{}; return (s.serverUrl||'').replace(/\/+$/,'')||null; }
async function syncLogin(uname,pass){ const url=_serverUrl(); if(!url){ toast(t('لم يتم تعيين رابط الخادم','Set server URL first')); return false; } try{ const res=await fetch(url+'/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:uname,password:pass})}); const j=await res.json(); if(!j.token) throw 0; const s=DB.getOne('settings')||{}; s.apiToken=j.token; s.apiUser=j.username; DB.setOne('settings',s); toast(t('تم تسجيل الدخول للخادم','Server login OK')); return true; }catch(e){ toast(t('فشل الدخول للخادم','Server login failed')); return false; } }
async function syncPush(){ const s=DB.getOne('settings')||{}; const url=_serverUrl(); if(!url||!s.apiToken){ return false; } try{ const payload=collectState(); const size=JSON.stringify(payload).length; if(size>8*1024*1024){ toast(t('البيانات كبيرة جداً للرفع','Data too large to push')); return false; } const res=await fetch(url+'/api/state',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+s.apiToken},body:JSON.stringify(payload)}); if(!res.ok) throw 0; _dirty=false; _setSyncStatus('ok',t('تمت المزامنة','Synced')); return true; }catch(e){ _setSyncStatus('err',t('فشل المزامنة','Sync failed')); return false; } }
async function syncPull(){ const s=DB.getOne('settings')||{}; const url=_serverUrl(); if(!url||!s.apiToken){ toast(t('الخادم غير مهيأ','Server not configured')); return false; } try{ const res=await fetch(url+'/api/state',{headers:{'Authorization':'Bearer '+s.apiToken}}); const j=await res.json(); if(!res.ok) throw 0; applyState(j); _setSyncStatus('ok',t('تم السحب','Pulled')); boot(); return true; }catch(e){ _setSyncStatus('err',t('فشل السحب','Pull failed')); return false; } }
let _syncTimer=null;
function scheduleSync(){ if(!((DB.getOne('settings')||{}).autoSync)) return; clearTimeout(_syncTimer); _syncTimer=setTimeout(async()=>{ if(_dirty){ await syncPush(); } if((DB.getOne('settings')||{}).autoSync) scheduleSync(); }, 5000); }
let _autoBackupTimer=null;
function scheduleAutoBackup(){ if(_autoBackupTimer){ clearTimeout(_autoBackupTimer); _autoBackupTimer=null; } const hrs=Number((DB.getOne('settings')||{}).autoBackupHours)||0; if(hrs<=0) return; const ms=hrs*3600*1000; _autoBackupTimer=setTimeout(function tick(){ try{ Backup.download(); }catch(e){} if(Number((DB.getOne('settings')||{}).autoBackupHours)||0>0) _autoBackupTimer=setTimeout(tick, ms); }, ms); }
function _setSyncStatus(kind,msg){ const el=document.querySelector('.sync-status'); if(el){ el.className='sync-status '+kind; el.textContent=msg; } }
function updateOnline(){ try{ const bar=$('#offlineBar'); if(!bar) return; if(navigator.onLine) bar.classList.add('hidden'); else bar.classList.remove('hidden'); }catch(e){} }
if(typeof window!=='undefined'){ window.addEventListener('online', ()=>{ updateOnline(); toast(t('عاد الاتصال','Back online')); }); window.addEventListener('offline', ()=>{ updateOnline(); toast(t('انقطع الاتصال','Connection lost')); }); }
/* ============================ BOOT ============================ */
async function boot(){ await ensureAdmin();   migrateToCompanies(); ensureBranch();   if(!DB.getOne('seeded')) seedData();   try{ seedAccountingDefaults(); }catch(e){}
  try{ seedAccountingCore2(); }catch(e){}
  const s=DB.getOne('settings')||{}; LANG=s.lang||'ar'; applyLang();
  registerSW(); updateOnline();
  const sess=localStorage.getItem('erp_session'); if(sess){ try{ currentUser=JSON.parse(sess); }catch(e){} }
  if(!currentUser){ const au=DB.get('users').find(u=>u.role==='admin')||DB.get('users')[0]; currentUser = au ? {id:au.id,name:au.name,role:au.role,username:au.username} : {id:'auto',name:t('المدير','Admin'),role:'admin',username:'admin'}; }
  ensureStockByWh();
  if(s.pin){ showLock(enterApp); } else { enterApp(); }
  try{ scheduleMidnightBackup(); }catch(e){}
}
function enterApp(){ if(!_activeCompanyId){ const comps=DB.get('companies'); if(comps.length){ setCurrentCompany(comps[0].id); if(!DB.getOne('acc_seeded')) seedAccounts(comps[0].id); } }
  renderShell(); checkNotifications(); if((DB.getOne('settings')||{}).autoSync) scheduleSync(); scheduleAutoBackup();
  var _s=DB.getOne('settings')||{}; if(!_s.lastBackup){ _s.lastBackup=new Date().toISOString(); DB.setOne('settings',_s); }
  Backup.remindIfOld(7);
  if(!window._globalListeners){ window._globalListeners=true;
    document.addEventListener('keydown', bcKey);
    window.addEventListener('beforeunload', function(e){ if(_cart && _cart.length){ e.preventDefault(); e.returnValue=''; return ''; } });
    ['mousemove','keydown','click','touchstart'].forEach(ev=>document.addEventListener(ev, resetIdle, {passive:true}));
    resetIdle();
    try{ initKeyboardShortcuts(); }catch(e){}
  } }
document.addEventListener('DOMContentLoaded', boot);



