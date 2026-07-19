/* Nexus ERP — Accounting Core 2 (Essential): Inventory costing (FIFO/avg), VAT,
   Receipt/Payment vouchers, Sub-ledgers & aging. Follows existing app patterns. */
'use strict';
/* ============================ INVENTORY COSTING ============================ */
/* Each product keeps costLayers: [{qty, cost, date}] (FIFO) and a costingMethod.
   On purchase -> push layer. On sale -> consume FIFO. COGS = consumed layers. */
function getCostLayers(pid){ return (DB.get('stockLayers').find(l=>l.productId===pid)||{}).layers||[]; }
function setCostLayers(pid, layers){ const all=DB.get('stockLayers'); const i=all.findIndex(l=>l.productId===pid); if(i>=0) all[i].layers=layers; else all.push({productId:pid,layers}); DB.set('stockLayers',all); }
function ensureCostLayers(){ if(!DB.getOne('costLayers_seeded')){ DB.get('products').forEach(p=>{ if(!getCostLayers(p.id).length && (p.qty||0)>0){ setCostLayers(p.id,[{qty:p.qty,cost:p.buyingPrice||0,date:nowISO()}]); } }); DB.setOne('costLayers_seeded',true); } }
function addPurchaseLayer(pid, qty, cost){ if(qty<=0) return; const layers=getCostLayers(pid); layers.push({qty,cost,date:nowISO()}); setCostLayers(pid,layers); }
function consumeCostLayers(pid, qty, method){ let layers=getCostLayers(pid); let remaining=qty; let cogs=0; const m=(method||'fifo').toLowerCase();
  if(m==='avg'){ const totalQty=layers.reduce((s,l)=>s+l.qty,0); const totalCost=layers.reduce((s,l)=>s+l.qty*l.cost,0); const avg=totalQty>0?totalCost/totalQty:0; cogs=avg*qty; layers=[{qty:Math.max(0,totalQty-qty),cost:avg,date:nowISO()}]; }
  else { /* FIFO */ for(const l of layers){ if(remaining<=0) break; const take=Math.min(l.qty,remaining); cogs+=take*l.cost; l.qty-=take; remaining-=take; } layers=layers.filter(l=>l.qty>0.0001); }
  setCostLayers(pid,layers); return cogs; }
function productCostMethod(pid){ const p=DB.get('products').find(x=>x.id===pid); return (p&&p.costingMethod)||(DB.getOne('settings')||{}).costingMethod||'fifo'; }
function productCurrentCost(pid){ const layers=getCostLayers(pid); const method=productCostMethod(pid); if(method==='avg'){ const tq=layers.reduce((s,l)=>s+l.qty,0); const tc=layers.reduce((s,l)=>s+l.qty*l.cost,0); return tq>0?tc/tq:0; } let latest=0; layers.forEach(l=>{ if(l.qty>0) latest=l.cost; }); return latest; }
function renderCostingScreen(){ ensureCostLayers(); const products=DB.get('products'); $('#screen').innerHTML=`<div class="screen"><div class="toolbar"><h2>${t('تسعير المخزون','Inventory Costing')}</h2>
  <label>${t('الطريقة الافتراضية','Default Method')}<select id="costMethod" onchange="setDefaultCosting(this.value)">${['fifo','avg'].map(m=>`<option value="${m}" ${(DB.getOne('settings')||{}).costingMethod===m?'selected':''}>${m==='fifo'?t('الوارد أولاً صادر أولاً','FIFO'):t('متوسط مرجح','Weighted Avg')}</option>`).join('')}</select></label></div>
  <table class="tbl"><thead><tr><th>${t('المنتج','Product')}</th><th>${t('الكمية','Qty')}</th><th>${t('التكلفة الحالية','Current Cost')}</th><th>${t('قيمة المخزون','Stock Value')}</th></tr></thead><tbody>${products.map(p=>`<tr><td>${esc(p.name)}</td><td>${fmt(p.qty)}</td><td>${money(productCurrentCost(p.id))}</td><td>${money(productCurrentCost(p.id)*(p.qty||0))}</td></tr>`).join('')}</tbody></table></div>`; applyLang(); }
function setDefaultCosting(v){ const s=DB.getOne('settings')||{}; s.costingMethod=v; DB.setOne('settings',s); renderCostingScreen(); toast(t('تم الحفظ','Saved')); }
function setProductCosting(pid,v){ const p=DB.get('products').find(x=>x.id===pid); if(p){ p.costingMethod=v; DB.set('products',DB.get('products')); } renderCostingScreen(); }
/* ============================ VAT ============================ */
function ensureVatAccounts(){ let accounts=DB.get('accounts'); const e=(id,code,name,type,parent)=>{ if(!accounts.find(a=>a.id===id)) accounts.push({id,code,name,type,parent:parent||null,balance:0}); };
  e('acc_vat_out','2201',t('ضريبة المخرجات','Output VAT'),'liability','acc_liab_root');
  e('acc_vat_in','1203',t('ضريبة المدخلات','Input VAT'),'asset','acc_asset_root');
  DB.set('accounts',accounts); }
function renderVatScreen(){ ensureVatAccounts(); const J=DB.get('journal').filter(j=>j.status!=='draft'&&j.status!=='pending'); let out=0,inp=0; J.forEach(j=>j.lines.forEach(l=>{ if(l.accountId===CFG.ACC.VAT_OUT) out=DEC.add(out,(l.credit||0)-(l.debit||0)); if(l.accountId===CFG.ACC.VAT_IN) inp=DEC.add(inp,(l.debit||0)-(l.credit||0)); })); const payable=out-inp;
  $('#screen').innerHTML=`<div class="screen"><div class="toolbar"><h2>${t('ضريبة القيمة المضافة','VAT')}</h2><button class="btn" onclick="exportVatReturn()">${t('تصدير إقرار','Export Return')}</button></div>
  <div class="kpi-grid">
    <div class="kpi"><span>${t('ضريبة المخرجات','Output VAT')}</span><b>${money(out)}</b></div>
    <div class="kpi"><span>${t('ضريبة المدخلات','Input VAT')}</span><b>${money(inp)}</b></div>
    <div class="kpi"><span>${t('الضريبة المستحقة','VAT Payable')}</span><b style="color:${payable>=0?'green':'#c0392b'}">${money(payable)}</b></div>
  </div>
  <p class="muted">${t('الضريبة المستحقة = المخرجات − المدخلات. موجب = مستحقة للهيئة، سالب = رصيد لصالحك','VAT payable = output − input')}</p></div>`; applyLang(); window._vat={out,inp,payable}; }
function exportVatReturn(){ if(!window._vat){ toast(t('لا بيانات','No data')); return; } const lines=[t('إقرار ضريبة القيمة المضافة','VAT Return'), t('ضريبة المخرجات','Output VAT')+': '+money(window._vat.out), t('ضريبة المدخلات','Input VAT')+': '+money(window._vat.inp), t('الضريبة المستحقة','VAT Payable')+': '+money(window._vat.payable)]; exportPDF('vat_return.pdf',lines); toast(t('تم التصدير','Exported')); }
/* ============================ RECEIPT / PAYMENT VOUCHERS ============================ */
function renderVouchersScreen(){ const V=DB.get('vouchers'); $('#screen').innerHTML=`<div class="screen"><div class="toolbar"><h2>${t('السندات','Vouchers')}</h2><button class="btn btn-primary" onclick="openReceiptVoucher()">${t('سند قبض','Receipt')}</button><button class="btn btn-primary" onclick="openPaymentVoucher()">${t('سند صرف','Payment')}</button></div>
  <table class="tbl"><thead><tr><th>${t('الكود','Code')}</th><th>${t('النوع','Type')}</th><th>${t('التاريخ','Date')}</th><th>${t('الطرف','Party')}</th><th>${t('المبلغ','Amount')}</th><th>${t('الحالة','Status')}</th><th></th></tr></thead><tbody>${V.slice().reverse().map(v=>`<tr><td>${esc(v.code)}</td><td>${v.type==='receipt'?t('قبض','Receipt'):t('صرف','Payment')}</td><td>${fmtDate(v.date)}</td><td>${esc(v.partyName||'')}</td><td>${money(v.amount)}</td><td>${v.status==='approved'?t('معتمد','Approved'):v.status==='pending'?t('بالانتظار','Pending'):t('مسودة','Draft')}</td><td>${v.status==='draft'?`<button class="btn sm" onclick="postVoucher('${v.id}')">${t('ترحيل','Post')}</button>`:`<button class="btn sm" onclick="viewVoucher('${v.id}')">${t('عرض','View')}</button>`} <button class="btn sm btn-danger" onclick="deleteVoucher('${v.id}')">${t('حذف','Delete')}</button></td></tr>`).join('')}</tbody></table></div>`; applyLang(); }
function voucherForm(type){ const isR=type==='receipt'; const parties=isR?DB.get('customers').map(c=>({id:c.id,name:c.name,kind:'customer'})):DB.get('suppliers').map(s=>({id:s.id,name:s.name,kind:'supplier'}));   const cashAcc=isR?CFG.ACC.RECEIVABLE:CFG.ACC.PAYABLE; const counterpart=isR?CFG.ACC.RECEIVABLE:CFG.ACC.PAYABLE; const payAcc=isR?CFG.ACC.CASH:CFG.ACC.CASH;
  openModal(t('سند','Voucher')+' '+(isR?t('قبض','Receipt'):t('صرف','Payment')), `<div class="form-grid">
    <label>${t('الطرف','Party')}<select id="vParty">${parties.map(p=>`<option value="${p.id}|${p.kind}">${esc(p.name)}</option>`).join('')}</select></label>
    <label>${t('طريقة الدفع','Method')}<select id="vMethod"><option value="${CFG.ACC.CASH}">${t('نقدية','Cash')}</option>${DB.get('bankAccounts').map(b=>`<option value="${b.accountId}">${esc(b.name)}</option>`).join('')}</select></label>
    <label>${t('المبلغ','Amount')}<input id="vAmt" type="number" value="0"></label>
    <label>${t('التاريخ','Date')}<input id="vDate" type="date" value="${new Date().toISOString().slice(0,10)}"></label>
    <label>${t('البيان','Desc')}<input id="vDesc" value="${isR?t('تحصيل من عميل','Customer receipt'):t('سداد لمورد','Supplier payment')}"></label>
  </div>`, [{label:t('حفظ','Save'),cls:'btn-primary',onClick:()=>{ const [pid,kind]=$('#vParty').value.split('|'); const amt=Number($('#vAmt').value)||0; if(amt<=0){ toast(t('أدخل المبلغ','Enter amount')); return; } if(isPeriodLocked(periodOf($('#vDate').value))){ toast(t('الفترة مقفلة','Period locked')); return; } const partyName=(kind==='customer'?DB.get('customers'):DB.get('suppliers')).find(x=>x.id===pid); const code=nextNumber(isR?'REC':'PAY',isR?'REC-':'PAY-',5); const v={id:uid(),code,type,partyId:pid,partyKind:kind,partyName:partyName?partyName.name:'',method:$('#vMethod').value,amount:amt,date:$('#vDate').value,desc:$('#vDesc').value,status:'approved',createdAt:nowISO()};
    DB.set('vouchers',DB.get('vouchers').concat(v));
    amt=DEC.round(amt); const lines=[{accountId:$('#vMethod').value,debit:isR?amt:0,credit:isR?0:amt},{accountId:counterpart,debit:isR?0:amt,credit:isR?amt:0}];
    const J=DB.get('journal'); J.push({id:uid(),code,date:$('#vDate').value,desc:$('#vDesc').value,lines:normalizeLines(lines),ref:v.id,status:'approved'}); DB.set('journal',J);
    if(kind==='customer'){ const list=DB.get('customers'); const c=list.find(x=>x.id===pid); if(c) c.balance=DEC.sub(c.balance||0, isR?amt:-amt); DB.set('customers',list); }
    else { const list=DB.get('suppliers'); const s=list.find(x=>x.id===pid); if(s) s.balance=DEC.sub(s.balance||0, isR?amt:-amt); DB.set('suppliers',list); }
    const ba=DB.get('bankAccounts'); const b=ba.find(x=>x.accountId===$('#vMethod').value); if(b){ b.balance=DEC.add(b.balance||0, isR?amt:-amt); DB.set('bankAccounts',ba); }
    logAudit(t('سند','Voucher'),code+' '+money(amt)); closeModal(); renderVouchersScreen(); toast(t('تم الترحيل','Posted')); }},{label:t('إلغاء','Cancel'),cls:'btn',onClick:closeModal}]); }
function openReceiptVoucher(){ voucherForm('receipt'); }
function openPaymentVoucher(){ voucherForm('payment'); }
function postVoucher(){}
function viewVoucher(id){ const v=DB.get('vouchers').find(x=>x.id===id); if(!v) return; openModal(esc(v.code), `<p>${esc(v.desc)} · ${fmtDate(v.date)} · ${money(v.amount)} · ${esc(v.partyName||'')}</p>`, [{label:t('إغلاق','Close'),cls:'btn',onClick:closeModal}]); }
function deleteVoucher(id){ confirmModal(t('حذف','Delete'), t('حذف السند وترحيل العكس؟','Delete voucher and reverse?'), ()=>{ const v=DB.get('vouchers').find(x=>x.id===id); if(!v) return; const sign=v.type==='receipt'?1:-1; if(v.partyKind==='customer'){ const list=DB.get('customers'); const c=list.find(x=>x.id===v.partyId); if(c) c.balance=(c.balance||0)+(sign*v.amount); DB.set('customers',list); } else { const list=DB.get('suppliers'); const s=list.find(x=>x.id===v.partyId); if(s) s.balance=(s.balance||0)+(sign*v.amount); DB.set('suppliers',list); } const ba=DB.get('bankAccounts'); const b=ba.find(x=>x.accountId===v.method); if(b){ b.balance=(b.balance||0)-(sign*v.amount); DB.set('bankAccounts',ba); } DB.set('vouchers',DB.get('vouchers').filter(x=>x.id!==id)); DB.set('journal',DB.get('journal').filter(j=>j.ref!==v.id)); logAudit(t('حذف سند','Delete voucher'),v.code); renderVouchersScreen(); }); }
/* ============================ SUB-LEDGERS & AGING ============================ */
function agingBuckets(rows){ /* rows: [{date, amount, paid, balance}] -> buckets by due age */
  const today=new Date(); const b={current:0,d30:0,d60:0,d90:0,plus:0}; rows.forEach(r=>{ const age=Math.floor((today-new Date(r.date))/86400000); const bal=r.balance; if(bal<=0) return; if(age<=30) b.current+=bal; else if(age<=60) b.d30+=bal; else if(age<=90) b.d60+=bal; else b.plus+=bal; }); return b; }
function renderAgingScreen(){ const parties=DB.get('customers').map(c=>({id:c.id,name:c.name,balance:c.balance||0,kind:'customer'})).concat(DB.get('suppliers').map(s=>({id:s.id,name:s.name,balance:s.balance||0,kind:'supplier'})));
  $('#screen').innerHTML=`<div class="screen"><div class="toolbar"><h2>${t('تقرير عمري (أرصدة مستحقة)','Aging Report')}</h2></div>
  <table class="tbl"><thead><tr><th>${t('الطرف','Party')}</th><th>${t('النوع','Type')}</th><th>${t('الرصيد','Balance')}</th></tr></thead><tbody>${parties.filter(p=>p.balance>0.01||p.balance<-0.01).map(p=>`<tr><td>${esc(p.name)}</td><td>${p.kind==='customer'?t('عميل','Customer'):t('مورد','Supplier')}</td><td>${money(p.balance)}</td></tr>`).join('')}</tbody></table>
  <h3>${t('دفتر أستاذ العملاء','Customer Ledger')}</h3><div id="custLedger"></div></div>`; applyLang(); renderSubledger('customer'); }
function renderSubledger(kind){ const ledger=$('#custLedger'); if(!ledger) return; const recs=DB.get('invoices').filter(i=>i.type==='sale').map(i=>({date:i.createdAt,party:i.customerName,desc:i.code,debit:i.total,credit:i.paid||0})); ledger.innerHTML=`<table class="tbl"><thead><tr><th>${t('التاريخ','Date')}</th><th>${t('البيان','Desc')}</th><th>${t('مدين','Debit')}</th><th>${t('دائن','Credit')}</th></tr></thead><tbody>${recs.slice(0,50).map(r=>`<tr><td>${fmtDate(r.date)}</td><td>${esc(r.desc)}</td><td>${money(r.debit)}</td><td>${money(r.credit)}</td></tr>`).join('')}</tbody></table>`; }
function renderSubledgersScreen(){ const accounts=DB.get('accounts'); const control=accounts.filter(a=>a.type==='asset'&&a.id===CFG.ACC.RECEIVABLE); $('#screen').innerHTML=`<div class="screen"><h2>${t('الدفاتر المساعدة','Sub-ledgers')}</h2>
  <div class="report-grid">
    <button class="report-card" onclick="renderAgingScreen()">${t('تقرير عمري','Aging Report')}</button>
    <button class="report-card" onclick="renderSubledgerScreen('customer')">${t('أستاذ العملاء','Customers')}</button>
    <button class="report-card" onclick="renderSubledgerScreen('supplier')">${t('أستاذ الموردين','Suppliers')}</button>
    <button class="report-card" onclick="renderSubledgerScreen('bank')">${t('أستاذ البنوك','Banks')}</button>
  </div><div id="subBody"></div></div>`; applyLang(); }
function renderSubledgerScreen(type){ const body=$('#subBody'); if(!body) return; let rows=[];
  if(type==='customer'){ DB.get('customers').forEach(c=>{ if(Math.abs(c.balance||0)>0.001) rows.push([c.name,t('عميل','Customer'),fmt(c.balance)]); }); }
  else if(type==='supplier'){ DB.get('suppliers').forEach(s=>{ if(Math.abs(s.balance||0)>0.001) rows.push([s.name,t('مورد','Supplier'),fmt(s.balance)]); }); }
  else { DB.get('bankAccounts').forEach(b=>{ rows.push([b.name,t('بنك','Bank'),fmt(b.balance)]); }); }
  body.innerHTML=`<table class="tbl"><thead><tr><th>${t('الاسم','Name')}</th><th>${t('النوع','Type')}</th><th>${t('الرصيد','Balance')}</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${esc(r[0])}</td><td>${esc(r[1])}</td><td>${money(Number(r[2].replace(/[^0-9.\-]/g,'')||0))}</td></tr>`).join('')}</tbody></table>`; }
/* ============================ SEED ============================ */
function seedAccountingCore2(){ ensureCostLayers(); ensureVatAccounts(); if(!DB.get('stockLayers')) DB.set('stockLayers',[]); if(!DB.get('vouchers')) DB.set('vouchers',[]); if(!DB.getOne('settings').costingMethod) { const s=DB.getOne('settings'); s.costingMethod='fifo'; DB.setOne('settings',s); } }
