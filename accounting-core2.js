/* Nexus ERP - Accounting Core 2 (Essential): Inventory costing (FIFO/avg), VAT,
   Receipt/Payment vouchers, Sub-ledgers & aging. Follows existing app patterns. */
'use strict';
/* ===================== INVENTORY COSTING ===================== */
function renderCostingScreen(){ ensureCostLayers(); const products=DB.get('products'); $('#screen').innerHTML=`<div class="screen">${pageHead(t('تسعير المخزون','Inventory Costing'),{icon:'📦',sub:t('طريقة التسعير الافتراضية','Default costing method')})}
  ${panel({body:`<label>${t('الطريقة الافتراضية','Default Method')}<select id="costMethod" onchange="setDefaultCosting(this.value)">${['fifo','avg'].map(m=>`<option value="${m}" ${(DB.getOne('settings')||{}).costingMethod===m?'selected':''}>${m==='fifo'?t('الوارد أولاً صادر أولاً','FIFO'):t('متوسط مرجح','Weighted Avg')}</option>`).join('')}</select></label>`})}
  ${panel({flush:true, body:`<table class="tbl"><thead><tr><th>${t('المنتج','Product')}</th><th>${t('الكمية','Qty')}</th><th>${t('التكلفة الحالية','Current Cost')}</th><th>${t('قيمة المخزون','Stock Value')}</th></tr></thead><tbody>${products.map(p=>`<tr><td>${esc(p.name)}</td><td>${fmt(p.qty)}</td><td>${money(productCurrentCost(p.id))}</td><td>${money(productCurrentCost(p.id)*(p.qty||0))}</td></tr>`).join('')}</tbody></table>`})}</div>`; applyLang(); }
function setDefaultCosting(v){ const s=DB.getOne('settings')||{}; s.costingMethod=v; DB.setOne('settings',s); renderCostingScreen(); toast(t('تم الحفظ','Saved')); }
function setProductCosting(pid,v){ const p=DB.get('products').find(x=>x.id===pid); if(p){ p.costingMethod=v; DB.set('products',DB.get('products')); } renderCostingScreen(); }
/* ===================== VAT ===================== */
function ensureVatAccounts(){ let accounts=DB.get('accounts'); const e=(id,code,name,type,parent)=>{ if(!accounts.find(a=>a.id===id)) accounts.push({id,code,name,type,parent:parent||null,balance:0}); };
  e('acc_vat_out','2201',t('ضريبة المخرجات','Output VAT'),'liability','acc_liab_root');
  e('acc_vat_in','1203',t('ضريبة المدخلات','Input VAT'),'asset','acc_asset_root');
  DB.set('accounts',accounts); }
function renderVatScreen(){ ensureVatAccounts(); const J=DB.get('journal').filter(j=>j.status!=='draft'&&j.status!=='pending'); let out=0,inp=0; J.forEach(j=>j.lines.forEach(l=>{ if(l.accountId===CFG.ACC.VAT_OUT) out=DEC.add(out,(l.credit||0)-(l.debit||0)); if(l.accountId===CFG.ACC.VAT_IN) inp=DEC.add(inp,(l.debit||0)-(l.credit||0)); })); const payable=out-inp;
  $('#screen').innerHTML=`<div class="screen">${pageHead(t('ضريبة القيمة المضافة','VAT'),{icon:'🧮',sub:t('إقرار ضريبي','Tax return'),actions:`<button class="btn" onclick="exportVatReturn()">${t('تصدير إقرار','Export Return')}</button>`})}
  <div class="kpi-grid">
    <div class="kpi"><span>${t('ضريبة المخرجات','Output VAT')}</span><b>${money(out)}</b></div>
    <div class="kpi"><span>${t('ضريبة المدخلات','Input VAT')}</span><b>${money(inp)}</b></div>
    <div class="kpi"><span>${t('الضريبة المستحقة','VAT Payable')}</span><b class="${payable>=0?'text-pos':'text-neg'}">${money(payable)}</b></div>
  </div>
  <p class="muted">${t('الضريبة المستحقة = المخرجات − المدخلات. موجب = مستحقة للهيئة، سالب = رصيد لصالحك','VAT payable = output − input')}</p></div>`; applyLang(); window._vat={out,inp,payable}; }
function exportVatReturn(){ if(!window._vat){ toast(t('لا بيانات','No data')); return; } const lines=[t('إقرار ضريبة القيمة المضافة','VAT Return'), t('ضريبة المخرجات','Output VAT')+': '+money(window._vat.out), t('ضريبة المدخلات','Input VAT')+': '+money(window._vat.inp), t('الضريبة المستحقة','VAT Payable')+': '+money(window._vat.payable)]; exportPDF('vat_return.pdf',lines); toast(t('تم التصدير','Exported')); }
/* ===================== RECEIPT / PAYMENT VOUCHERS ===================== */
function renderVouchersScreen(){ const V=DB.get('vouchers'); $('#screen').innerHTML=`<div class="screen">${pageHead(t('السندات','Vouchers'),{icon:'🧾',sub:`${t('العدد','Count')}: ${V.length}`,actions:`<button class="btn btn-primary" onclick="openReceiptVoucher()">＋ ${t('سند قبض','Receipt')}</button><button class="btn btn-primary" onclick="openPaymentVoucher()">＋ ${t('سند صرف','Payment')}</button>`})}
  ${panel({flush:true, body:`<table class="tbl"><thead><tr><th>${t('الكود','Code')}</th><th>${t('النوع','Type')}</th><th>${t('التاريخ','Date')}</th><th>${t('الطرف','Party')}</th><th>${t('المبلغ','Amount')}</th><th>${t('الحالة','Status')}</th><th></th></tr></thead><tbody>${V.slice().reverse().map(v=>`<tr><td>${esc(v.code)}</td><td>${v.type==='receipt'?t('قبض','Receipt'):t('صرف','Payment')}</td><td>${fmtDate(v.date)}</td><td>${esc(v.partyName||'')}</td><td>${money(v.amount)}</td><td>${v.status==='approved'?t('معتمد','Approved'):v.status==='pending'?t('بالانتظار','Pending'):t('مسودة','Draft')}</td><td>${v.status==='draft'?`<button class="btn sm" onclick="postVoucher('${v.id}')">${t('ترحيل','Post')}</button>`:`<button class="btn sm" onclick="viewVoucher('${v.id}')">${t('عرض','View')}</button>`} <button class="btn sm btn-danger" onclick="deleteVoucher('${v.id}')">${t('حذف','Delete')}</button></td></tr>`).join('')}</tbody></table>`})}</div>`; applyLang(); }
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
/* ===================== SUB-LEDGERS & AGING ===================== */
function agingBuckets(rows){ /* rows: [{date, amount, paid, balance}] -> buckets by due age */
  const today=new Date(); const b={current:0,d30:0,d60:0,d90:0,plus:0}; rows.forEach(r=>{ const age=Math.floor((today-new Date(r.date))/86400000); const bal=r.balance; if(bal<=0) return; if(age<=30) b.current+=bal; else if(age<=60) b.d30+=bal; else if(age<=90) b.d60+=bal; else b.plus+=bal; }); return b; }
function renderAgingScreen(){ const parties=DB.get('customers').map(c=>({id:c.id,name:c.name,balance:c.balance||0,kind:'customer'})).concat(DB.get('suppliers').map(s=>({id:s.id,name:s.name,balance:s.balance||0,kind:'supplier'})));
  $('#screen').innerHTML=`<div class="screen">${pageHead(t('تقرير عمري (أرصدة مستحقة)','Aging Report'),{icon:'⏳',sub:t('تحليل الأرصدة حسب العمر','Balances by age')})}
  ${panel({flush:true, body:`<table class="tbl"><thead><tr><th>${t('الطرف','Party')}</th><th>${t('النوع','Type')}</th><th>${t('الرصيد','Balance')}</th></tr></thead><tbody>${parties.filter(p=>p.balance>0.01||p.balance<-0.01).map(p=>`<tr><td>${esc(p.name)}</td><td>${p.kind==='customer'?t('عميل','Customer'):t('مورد','Supplier')}</td><td>${money(p.balance)}</td></tr>`).join('')}</tbody></table>`})}
  <div class="section-title">${t('دفتر أساتذة العملاء','Customer Ledger')}</div><div id="custLedger"></div></div>`; applyLang(); renderSubledger('customer'); }
function renderSubledger(kind){ const ledger=$('#custLedger'); if(!ledger) return; const recs=DB.get('invoices').filter(i=>i.type==='sale').map(i=>({date:i.createdAt,party:i.customerName,desc:i.code,debit:i.total,credit:i.paid||0})); ledger.innerHTML=`<table class="tbl"><thead><tr><th>${t('التاريخ','Date')}</th><th>${t('البيان','Desc')}</th><th>${t('مدين','Debit')}</th><th>${t('دائن','Credit')}</th></tr></thead><tbody>${recs.slice(0,50).map(r=>`<tr><td>${fmtDate(r.date)}</td><td>${esc(r.desc)}</td><td>${money(r.debit)}</td><td>${money(r.credit)}</td></tr>`).join('')}</tbody></table>`; }
function renderSubledgersScreen(){ const accounts=DB.get('accounts'); const control=accounts.filter(a=>a.type==='asset'&&a.id===CFG.ACC.RECEIVABLE); $('#screen').innerHTML=`<div class="screen">${pageHead(t('الدفاتر المساعدة','Sub-ledgers'),{icon:'📒',sub:t('كافة الدفاتر الفرعية','All sub-ledgers')})}
  <div class="report-grid">
    <button class="report-card" onclick="renderAgingScreen()">${t('تقرير عمري','Aging Report')}</button>
    <button class="report-card" onclick="renderSubledgerScreen('customer')">${t('أساتذة العملاء','Customers')}</button>
    <button class="report-card" onclick="renderSubledgerScreen('supplier')">${t('أساتذة الموردين','Suppliers')}</button>
    <button class="report-card" onclick="renderSubledgerScreen('bank')">${t('أساتذة البنوك','Banks')}</button>
  </div><div id="subBody"></div></div>`; applyLang(); }
function renderSubledgerScreen(type){ const body=$('#subBody'); if(!body) return; let rows=[];
  if(type==='customer'){ DB.get('customers').forEach(c=>{ if(Math.abs(c.balance||0)>0.001) rows.push([c.name,t('عميل','Customer'),fmt(c.balance)]); }); }
  else if(type==='supplier'){ DB.get('suppliers').forEach(s=>{ if(Math.abs(s.balance||0)>0.001) rows.push([s.name,t('مورد','Supplier'),fmt(s.balance)]); }); }
  else { DB.get('bankAccounts').forEach(b=>{ rows.push([b.name,t('بنك','Bank'),fmt(b.balance)]); }); }
  body.innerHTML=`<table class="tbl"><thead><tr><th>${t('الاسم','Name')}</th><th>${t('النوع','Type')}</th><th>${t('الرصيد','Balance')}</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${esc(r[0])}</td><td>${esc(r[1])}</td><td>${money(Number(r[2].replace(/[^0-9.\-]/g,'')||0))}</td></tr>`).join('')}</tbody></table>`; }
/* ===================== SEED ===================== */
function seedAccountingCore2(){ ensureCostLayers(); ensureVatAccounts(); if(!DB.get('stockLayers')) DB.set('stockLayers',[]); if(!DB.get('vouchers')) DB.set('vouchers',[]); if(!DB.getOne('settings').costingMethod) { const s=DB.getOne('settings'); s.costingMethod='fifo'; DB.setOne('settings',s); } }


/* ===================== TRANSFER VOUCHER (cash <-> bank) ===================== */
function renderTransferVoucherScreen(){ const cashAcc=CFG.ACC.CASH; const banks=DB.get("bankAccounts");
  $("#screen").innerHTML=`<div class="screen">${pageHead(t("تحويل نقدية","Transfer"),{icon:'💸',sub:t("تحويل بين الصندوق والبنوك","Transfer between cash and banks")})}
  <div id="trfWrap"></div></div>`;
  $("#trfWrap").innerHTML=`<div class="form-grid">
    <label>${t("من","From")}<select id="trfFrom">${["<option value=\""+cashAcc+"\">"+t("الصندوق","Cash")+"</option>"].concat(banks.map(b=>`<option value="${b.accountId}">${esc(b.name)}</option>`)).join("")}</select></label>
    <label>${t("إلى","To")}<select id="trfTo">${["<option value=\""+cashAcc+"\">"+t("الصندوق","Cash")+"</option>"].concat(banks.map(b=>`<option value="${b.accountId}">${esc(b.name)}</option>`)).join("")}</select></label>
    <label>${t("المبلغ","Amount")}<input id="trfAmt" type="number" value="0"></label>
    <label>${t("التاريخ","Date")}<input id="trfDate" type="date" value="${new Date().toISOString().slice(0,10)}"></label>
    <label>${t("البيان","Desc")}<input id="trfDesc" value="${t("تحويل","Transfer")}"></label>
  </div><button class="btn btn-primary" onclick="postTransfer()">${t("ترحيل التحويل","Post Transfer")}</button>`;
  applyLang();
}
function postTransfer(){ const from=$("#trfFrom").value; const to=$("#trfTo").value; const amt=DEC.round(Number($("#trfAmt").value)||0); const date=$("#trfDate").value||new Date().toISOString().slice(0,10); const desc=$("#trfDesc").value.trim()||t("تحويل","Transfer");
  if(amt<=0){ toast(t("المبلغ يجب أن يكون أكبر من صفر","Amount must be > 0")); return; }
  if(from===to){ toast(t("اختر حسابين مختلفين","Choose different accounts")); return; }
  if(isPeriodLocked(periodOf(date))){ toast(t("الفترة مقفلة لا يمكن الترحيل","Period locked - cannot post")); return; }
  const J=DB.get("journal"); J.push({id:uid(),code:nextNumber("JV","JV-",5),date,desc,lines:normalizeLines([{accountId:from,debit:0,credit:amt},{accountId:to,debit:amt,credit:0}]),ref:null,status:"approved"}); DB.set("journal",J);
  const ba=DB.get("bankAccounts"); ba.forEach(b=>{ if(b.accountId===from) b.balance=DEC.sub(b.balance||0,amt); if(b.accountId===to) b.balance=DEC.add(b.balance||0,amt); }); DB.set("bankAccounts",ba);
  logAudit(t("تحويل نقدية","Transfer"),desc+" "+money(amt)); renderTransferVoucherScreen(); toast(t("تم التحويل","Transferred")+" "+money(amt));
}
/* ===================== CREDIT COLLECTION (receive payment on credit invoice) ===================== */
function renderCollectionScreen(){ const invs=DB.get("invoices").filter(i=>i.type==="sale"&&DEC.sub(i.total||0,i.paid||0)>0.01).map(i=>({id:i.id,code:i.code,customerName:i.customerName,customerId:i.customerId,total:i.total,paid:i.paid,remaining:DEC.sub(i.total||0,i.paid||0),date:i.createdAt}));
  $("#screen").innerHTML=`<div class="screen">${pageHead(t("تحصيل الأرصدة الآجلة","Credit Collection"),{icon:'💰',sub:t("فواتير آجلة غير محصلة","Uncollected credit invoices")})}
    ${panel({flush:true, body: invs.length?`<table class="tbl"><thead><tr><th>${t("الكود","Code")}</th><th>${t("العميل","Customer")}</th><th>${t("الإجمالي","Total")}</th><th>${t("المدفوع","Paid")}</th><th>${t("المتبقي","Remaining")}</th><th></th></tr></thead><tbody>${invs.map(i=>`<tr><td>${esc(i.code)}</td><td>${esc(i.customerName||"")}</td><td>${money(i.total)}</td><td>${money(i.paid)}</td><td class="neg">${money(i.remaining)}</td><td><button class="btn sm btn-primary" onclick="openCollect('${i.id}')">${t("تحصيل","Collect")}</button></td></tr>`).join("")}</tbody></table>`:`<div class="empty">${t("لا أرصدة آجلة","No receivables")}</div>`})}</div>`;
  applyLang();
}
function openCollect(id){ const inv=DB.get("invoices").find(x=>x.id===id); if(!inv) return; const rem=DEC.sub(inv.total||0,inv.paid||0);
  openModal(t("تحصيل","Collect")+" "+esc(inv.code), `<div class="form-grid">
    <label>${t("طريقة الدفع","Method")}<select id="colMethod"><option value="${CFG.ACC.CASH}">${t("نقدي","Cash")}</option>${DB.get("bankAccounts").map(b=>`<option value="${b.accountId}">${esc(b.name)}</option>`).join("")}</select></label>
    <label>${t("المبلغ","Amount")}<input id="colAmt" type="number" value="${rem}"></label>
    <label>${t("التاريخ","Date")}<input id="colDate" type="date" value="${new Date().toISOString().slice(0,10)}"></label>
  </div>`, [{label:t("تأكيد","Confirm"),cls:"btn-primary",onClick:()=>{ const amt=DEC.round(Number($("#colAmt").value)||0); const method=$("#colMethod").value; const date=$("#colDate").value||new Date().toISOString().slice(0,10);
    if(amt<=0){ toast(t("المبلغ يجب أن يكون أكبر من صفر","Amount must be > 0")); return; }
    if(DEC.gt(amt,rem)){ toast(t("المبلغ أكبر من المتبقي","Amount exceeds remaining")); return; }
    if(isPeriodLocked(periodOf(date))){ toast(t("الفترة مقفلة","Period locked")); return; }
    inv.paid=DEC.add(inv.paid||0,amt); inv.remaining=DEC.sub(inv.total||0,inv.paid);
    const invoices=DB.get("invoices"); const k=invoices.findIndex(x=>x.id===id); if(k>=0) invoices[k]=inv; DB.set("invoices",invoices);
    const cust=DB.get("customers").find(c=>c.id===inv.customerId); if(cust){ cust.balance=DEC.sub(cust.balance||0,amt); DB.set("customers",cust); }
    const J=DB.get("journal"); J.push({id:uid(),code:nextNumber("JV","JV-",5),date,desc:t("تحصيل","Collect")+" "+inv.code,lines:normalizeLines([{accountId:method,debit:amt,credit:0},{accountId:CFG.ACC.RECEIVABLE,debit:0,credit:amt}]),ref:inv.id,status:"approved"}); DB.set("journal",J);
    const ba=DB.get("bankAccounts"); ba.forEach(b=>{ if(b.accountId===method) b.balance=DEC.add(b.balance||0,amt); }); DB.set("bankAccounts",ba);
    logAudit(t("تحصيل آجل","Collect receivable"),inv.code+" "+money(amt)); closeModal(); renderCollectionScreen(); toast(t("تم التحصيل","Collected")+" "+money(amt)); }},{label:t("إلغاء","Cancel"),cls:"btn",onClick:closeModal}]);
}
