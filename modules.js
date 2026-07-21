/* ============================================================
   Nexus ERP — New Modules
   Customer Orders, Purchase Requests, Expenses, Debts,
   Profits, Directory, Recycle Bin
   ============================================================ */
'use strict';

/* ============================ CUSTOMER ORDERS ============================ */
function renderCustomerOrders(){
  const orders=(DB.get('customerOrders')||[]).slice().sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||''));
  const pending=orders.filter(o=>o.status!=='transferred');
  const transferred=orders.filter(o=>o.status==='transferred');
  const body=orders.length?`<table class="tbl"><thead><tr><th>${t('رقم الطلب','Order #')}</th><th>${t('العميل','Customer')}</th><th>${t('التاريخ','Date')}</th><th>${t('الإجمالي','Total')}</th><th>${t('الحالة','Status')}</th><th></th></tr></thead><tbody>${orders.map(o=>`<tr class="${o.status==='transferred'?'ret-row':''}"><td>${esc(o.code)}</td><td>${esc(o.customerName||'')}</td><td>${fmtDate(o.createdAt)}</td><td>${money(o.total)}</td><td>${o.status==='transferred'?`<span class="ret-tag">${t('محوّل','Transferred')}</span>`:`<span style="color:var(--warning)">${t('قيد الانتظار','Pending')}</span>`}</td><td>${o.status!=='transferred'?`<button class="btn sm btn-primary" onclick="transferOrderToSale('${o.id}')">${t('تحويل لفاتورة','Convert')}</button> <button class="btn sm btn-danger" onclick="deleteCustomerOrder('${o.id}')">🗑️</button>`:`<button class="btn sm" onclick="deleteCustomerOrder('${o.id}')">🗑️</button>`}</td></tr>`).join('')}</tbody></table>`:`<div class="empty">${t('لا طلبات بعد','No orders yet')}</div>`;
  $('#screen').innerHTML=`<div class="screen">${pageHead(t('طلبات العملاء','Customer Orders'),{icon:'📋',sub:`${t('قيد الانتظار','Pending')}: ${pending.length} · ${t('محوّل','Transferred')}: ${transferred.length}`,actions:`<button class="btn btn-primary" onclick="openCustomerOrderModal()">＋ ${t('طلب جديد','New Order')}</button>`})}
    <div class="filters"><div class="field-inline"><input id="coSearch" placeholder="${t('بحث بالرقم أو العميل','Search order or customer')}" oninput="filterCOList()"><button class="voice-btn btn sm" onclick="startVoiceSearch('coSearch')">🎤</button></div></div>
    ${panel({flush:true,body})}</div>`; applyLang();
}
function filterCOList(){ const q=(($('#coSearch').value||'').toLowerCase()); document.querySelectorAll('#screen .tbl tbody tr').forEach(r=>{ r.style.display=r.textContent.toLowerCase().includes(q)?'':'none'; }); }
function openCustomerOrderModal(){
  const customers=DB.get('customers');
  openModal(t('طلب عميل جديد','New Customer Order'), `<div class="form-grid"><label>${t('العميل','Customer')}<select id="coCust">${customers.map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select></label><label>${t('المنتجات (اسم × كمية × سعر)','Items (name × qty × price)')}<textarea id="coItems" rows="6" placeholder="سماعة × 2 × 500&#10;شاحن × 5 × 50"></textarea></label><label>${t('ملاحظات','Notes')}<input id="coNotes" placeholder="..."></label></div>`, [{label:t('حفظ','Save'),cls:'btn-primary',onClick:()=>{ const custId=$('#coCust').value; const cust=customers.find(c=>c.id===custId); const lines=($('#coItems').value||'').split('\n').filter(l=>l.trim()); let total=0; const items=lines.map(l=>{const p=l.split(/[×x*]/).map(s=>s.trim()); const name=p[0]||''; const qty=Number(p[1])||1; const price=Number(p[2])||0; total+=qty*price; return {name,qty,price};}); const order={id:uid(),code:nextNumber('CO','ORD-',6),customerId:custId,customerName:cust?cust.name:'',items,total,notes:$('#coNotes').value||'',status:'pending',createdAt:nowISO()}; const orders=DB.get('customerOrders')||[]; orders.push(order); DB.set('customerOrders',orders); logAudit(t('طلب عميل','Customer Order'),order.code); closeModal(); renderCustomerOrders(); toast(t('تم الحفظ','Saved'));}},{label:t('إلغاء','Cancel'),cls:'btn',onClick:closeModal}]);
}
function transferOrderToSale(id){
  const orders=DB.get('customerOrders')||[];
  const order=orders.find(o=>o.id===id);
  if(!order||order.status==='transferred') return;
  const cfg=invCfg('sale');
  const inv={id:uid(),code:invNextCode(cfg),type:'sale',customerId:order.customerId,customerName:order.customerName,
    items:(order.items||[]).map(i=>{const p=DB.get('products').find(x=>x.name===i.name); return {productId:p?p.id:'',name:i.name,code:p?p.code:'',qty:i.qty,price:i.price||0,disc:0};}),
    subtotal:order.total,discount:0,tax:0,total:order.total,paid:order.total,payment:'cash',notes:order.notes||'',status:'approved',
    warehouseId:defaultWhId(),createdAt:nowISO()};
  (inv.items||[]).forEach(it=>{ const p=DB.get('products').find(x=>x.id===it.productId); if(p) adjStock(p,-it.qty,inv.warehouseId); });
  const invoices=DB.get('invoices'); invoices.push(inv); DB.set('invoices',invoices);
  postSaleJournals(inv,false);
  order.status='transferred'; order.invoiceId=inv.id; DB.set('customerOrders',orders);
  logAudit(t('تحويل طلب','Convert Order'),order.code+' → '+inv.code);
  renderCustomerOrders(); toast(t('تم التحويل','Transferred')+' → '+inv.code);
}
function deleteCustomerOrder(id){ confirmModal(t('حذف الطلب','Delete Order'),t('هل تريد حذف هذا الطلب؟','Delete this order?'),()=>{ const orders=(DB.get('customerOrders')||[]).filter(o=>o.id!==id); DB.set('customerOrders',orders); logAudit(t('حذف طلب','Delete Order'),id); renderCustomerOrders(); toast(t('تم الحذف','Deleted')); }); }

/* ============================ PURCHASE REQUESTS ============================ */
function renderPurchaseRequests(){
  const reqs=(DB.get('purchaseRequests')||[]).slice().sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||''));
  const pending=reqs.filter(r=>r.status!=='transferred');
  const transferred=reqs.filter(r=>r.status==='transferred');
  const body=reqs.length?`<table class="tbl"><thead><tr><th>${t('رقم الطلب','Req #')}</th><th>${t('المورد','Supplier')}</th><th>${t('التاريخ','Date')}</th><th>${t('الإجمالي','Total')}</th><th>${t('الحالة','Status')}</th><th></th></tr></thead><tbody>${reqs.map(r=>`<tr class="${r.status==='transferred'?'ret-row':''}"><td>${esc(r.code)}</td><td>${esc(r.supplierName||'')}</td><td>${fmtDate(r.createdAt)}</td><td>${money(r.total)}</td><td>${r.status==='transferred'?`<span class="ret-tag">${t('محوّل','Transferred')}</span>`:`<span style="color:var(--warning)">${t('قيد الانتظار','Pending')}</span>`}</td><td>${r.status!=='transferred'?`<button class="btn sm btn-primary" onclick="transferReqToPurchase('${r.id}')">${t('تحويل لشراء','Convert')}</button> <button class="btn sm btn-danger" onclick="deletePurchaseRequest('${r.id}')">🗑️</button>`:`<button class="btn sm" onclick="deletePurchaseRequest('${r.id}')">🗑️</button>`}</td></tr>`).join('')}</tbody></table>`:`<div class="empty">${t('لا طلبات بعد','No requests yet')}</div>`;
  $('#screen').innerHTML=`<div class="screen">${pageHead(t('طلبات الشراء','Purchase Requests'),{icon:'📋',sub:`${t('قيد الانتظار','Pending')}: ${pending.length} · ${t('محوّل','Transferred')}: ${transferred.length}`,actions:`<button class="btn btn-primary" onclick="openPurchaseRequestModal()">＋ ${t('طلب جديد','New Request')}</button>`})}
    <div class="filters"><div class="field-inline"><input id="prSearch" placeholder="${t('بحث بالرقم أو المورد','Search request or supplier')}" oninput="filterPRList()"><button class="voice-btn btn sm" onclick="startVoiceSearch('prSearch')">🎤</button></div></div>
    ${panel({flush:true,body})}</div>`; applyLang();
}
function filterPRList(){ const q=(($('#prSearch').value||'').toLowerCase()); document.querySelectorAll('#screen .tbl tbody tr').forEach(r=>{ r.style.display=r.textContent.toLowerCase().includes(q)?'':'none'; }); }
function openPurchaseRequestModal(){
  const suppliers=DB.get('suppliers');
  openModal(t('طلب شراء جديد','New Purchase Request'), `<div class="form-grid"><label>${t('المورد','Supplier')}<select id="prSup">${suppliers.map(s=>`<option value="${s.id}">${esc(s.name)}</option>`).join('')}</select></label><label>${t('المنتجات (اسم × كمية × سعر)','Items (name × qty × price)')}<textarea id="prItems" rows="6" placeholder="سماعة × 10 × 200&#10;شاحن × 20 × 30"></textarea></label><label>${t('ملاحظات','Notes')}<input id="prNotes" placeholder="..."></label></div>`, [{label:t('حفظ','Save'),cls:'btn-primary',onClick:()=>{ const supId=$('#prSup').value; const sup=suppliers.find(s=>s.id===supId); const lines=($('#prItems').value||'').split('\n').filter(l=>l.trim()); let total=0; const items=lines.map(l=>{const p=l.split(/[×x*]/).map(s=>s.trim()); const name=p[0]||''; const qty=Number(p[1])||1; const price=Number(p[2])||0; total+=qty*price; return {name,qty,price};}); const req={id:uid(),code:nextNumber('PR','REQ-',6),supplierId:supId,supplierName:sup?sup.name:'',items,total,notes:$('#prNotes').value||'',status:'pending',createdAt:nowISO()}; const reqs=DB.get('purchaseRequests')||[]; reqs.push(req); DB.set('purchaseRequests',reqs); logAudit(t('طلب شراء','Purchase Request'),req.code); closeModal(); renderPurchaseRequests(); toast(t('تم الحفظ','Saved'));}},{label:t('إلغاء','Cancel'),cls:'btn',onClick:closeModal}]);
}
function transferReqToPurchase(id){
  const reqs=DB.get('purchaseRequests')||[];
  const req=reqs.find(r=>r.id===id);
  if(!req||req.status==='transferred') return;
  const inv={id:uid(),code:nextNumber('PUR','P-',6),type:'purchase',supplierId:req.supplierId,supplierName:req.supplierName,
    items:(req.items||[]).map(i=>{const p=DB.get('products').find(x=>x.name===i.name); return {productId:p?p.id:'',name:i.name,code:p?p.code:'',qty:i.qty,price:i.price||0,disc:0};}),
    subtotal:req.total,discount:0,tax:0,total:req.total,paid:req.total,payment:'cash',notes:req.notes||'',status:'approved',
    warehouseId:defaultWhId(),createdAt:nowISO()};
  (inv.items||[]).forEach(it=>{ const p=DB.get('products').find(x=>x.id===it.productId); if(p) adjStock(p,it.qty,inv.warehouseId); });
  const purchases=DB.get('purchases'); purchases.push(inv); DB.set('purchases',purchases);
  req.status='transferred'; req.purchaseId=inv.id; DB.set('purchaseRequests',reqs);
  logAudit(t('تحويل طلب شراء','Convert Purchase Req'),req.code+' → '+inv.code);
  renderPurchaseRequests(); toast(t('تم التحويل','Transferred')+' → '+inv.code);
}
function deletePurchaseRequest(id){ confirmModal(t('حذف الطلب','Delete Request'),t('هل تريد حذف هذا الطلب؟','Delete this request?'),()=>{ const reqs=(DB.get('purchaseRequests')||[]).filter(r=>r.id!==id); DB.set('purchaseRequests',reqs); logAudit(t('حذف طلب شراء','Delete Purchase Req'),id); renderPurchaseRequests(); toast(t('تم الحذف','Deleted')); }); }

/* ============================ EXPENSES ============================ */
function renderExpenses(){
  const expenses=(DB.get('expenses')||[]).slice().sort((a,b)=>(b.date||'').localeCompare(a.date||''));
  const total=expenses.reduce((s,e)=>s+(Number(e.amount)||0),0);
  const body=expenses.length?`<table class="tbl" id="expTbl"><thead><tr><th>${t('البيان','Title')}</th><th>${t('المبلغ','Amount')}</th><th>${t('التاريخ','Date')}</th><th>${t('الفئة','Category')}</th><th></th></tr></thead><tbody>${expenses.map(e=>`<tr><td>${esc(e.title)}${e.image?` 📷`:''}</td><td>${money(e.amount)}</td><td>${fmtDate(e.date)}</td><td>${esc(e.category||'')}</td><td><button class="btn sm" onclick="openExpenseModal('${e.id}')">📝</button> <button class="btn sm btn-danger" onclick="deleteExpense('${e.id}')">🗑️</button></td></tr>`).join('')}</tbody></table>`:`<div class="empty">${t('لا مصروفات بعد','No expenses yet')}</div>`;
  const df=dateFilterPop('expDate');
  $('#screen').innerHTML=`<div class="screen">${pageHead(t('المصروفات','Expenses'),{icon:'💰',sub:`${t('الإجمالي','Total')}: ${money(total)}`,actions:`<button class="btn btn-primary" onclick="openExpenseModal()">＋ ${t('مصروف جديد','New Expense')}</button>`})}
    <div class="filters"><div class="field-inline"><input id="expSearch" placeholder="${t('بحث بالبيان','Search title')}" oninput="filterExpensesList()"><button class="voice-btn btn sm" onclick="startVoiceSearch('expSearch')">🎤</button></div>${df}<button class="btn" onclick="exportExpensesCSV()">📥 ${t('تصدير','Export')}</button></div>
    ${panel({flush:true,body})}</div>`; applyLang();
}
function filterExpensesList(){ const q=(($('#expSearch').value||'').toLowerCase()); const dfEl=document.querySelector('[data-filter="expDate"]'); const dateVal=dfEl?dfEl.value:'all'; const now=new Date(); document.querySelectorAll('#expTbl tbody tr').forEach(r=>{ let show=true; if(q){ const txt=r.textContent.toLowerCase(); if(!txt.includes(q)) show=false; } if(show && dateVal && dateVal!=='all'){ const d=r.cells[2]?r.cells[2].textContent:''; const rDate=new Date(d); if(dateVal==='today') show=rDate.toDateString()===now.toDateString(); else if(dateVal==='yesterday'){ const y=new Date(now); y.setDate(y.getDate()-1); show=rDate.toDateString()===y.toDateString(); } else if(dateVal==='thisMonth') show=rDate.getMonth()===now.getMonth()&&rDate.getFullYear()===now.getFullYear(); } r.style.display=show?'':'none'; }); }
function exportExpensesCSV(){ const rows=[['title','amount','date','category']]; (DB.get('expenses')||[]).forEach(e=>rows.push([e.title,e.amount,e.date,e.category||''])); downloadFile('expenses.csv',toCSV(rows),'text/csv'); }
function openExpenseModal(id){
  const e=(DB.get('expenses')||[]).find(x=>x.id===id)||{};
  openModal(id?t('تعديل مصروف','Edit Expense'):t('مصروف جديد','New Expense'), `<div class="form-grid"><label>${t('البيان','Title')}<input id="expTitle" value="${esc(e.title||'')}"></label><label>${t('المبلغ','Amount')}<input id="expAmount" type="number" value="${e.amount||''}"></label><label>${t('التاريخ','Date')}<input id="expDate" type="date" value="${(e.date||'').slice(0,10)||new Date().toISOString().slice(0,10)}"></label><label>${t('الفئة','Category')}<input id="expCat" value="${esc(e.category||'')}" placeholder="${t('Salary,Rent,...','Salary,Rent,...')}"></label><label>${t('الصورة','Image')}<div class="field-inline"><input id="expImage" value="${esc(e.image||'')}" placeholder="URL"><button class="btn sm" onclick="captureCamera('expImage')">${t('كاميرا','Camera')}</button></div></label></div>`, [{label:t('حفظ','Save'),cls:'btn-primary',onClick:()=>{ const exp={id:e.id||uid(),title:$('#expTitle').value||'',amount:Number($('#expAmount').value)||0,date:$('#expDate').value||nowISO().slice(0,10),category:$('#expCat').value||'',image:$('#expImage').value||''}; const expenses=DB.get('expenses')||[]; const idx=expenses.findIndex(x=>x.id===exp.id); if(idx>=0) expenses[idx]=exp; else expenses.push(exp); DB.set('expenses',expenses); logAudit(t('مصروف','Expense'),exp.title); closeModal(); renderExpenses(); toast(t('تم الحفظ','Saved'));}},{label:t('إلغاء','Cancel'),cls:'btn',onClick:closeModal}]);
}
function deleteExpense(id){ confirmModal(t('حذف مصروف','Delete Expense'),t('هل تريد حذف هذا المصروف؟','Delete this expense?'),()=>{ const expenses=(DB.get('expenses')||[]).filter(e=>e.id!==id); DB.set('expenses',expenses); logAudit(t('حذف مصروف','Delete Expense'),id); renderExpenses(); toast(t('تم الحذف','Deleted')); }); }

/* ============================ DEBTS ============================ */
function renderDebts(){
  const invoices=DB.get('invoices');
  const custBalances={};
  invoices.forEach(inv=>{ if(inv.payment!=='credit') return; const cid=inv.customerId; if(!cid) return; if(!custBalances[cid]) custBalances[cid]={name:inv.customerName||'',balance:0,type:'customer',id:cid}; custBalances[cid].balance+=(Number(inv.total)||0)-(Number(inv.paid)||0); });
  const purchases=DB.get('purchases');
  const supBalances={};
  purchases.forEach(p=>{ if(p.payment!=='credit') return; const sid=p.supplierId; if(!sid) return; if(!supBalances[sid]) supBalances[sid]={name:p.supplierName||'',balance:0,type:'supplier',id:sid}; supBalances[sid].balance+=(Number(p.total)||0)-(Number(p.paid)||0); });
  const custList=Object.values(custBalances).filter(d=>d.balance>0);
  const supList=Object.values(supBalances).filter(d=>d.balance>0);
  const totalDebt=custList.reduce((s,d)=>s+d.balance,0)+supList.reduce((s,d)=>s+d.balance,0);
  const activeTab=window._debtTab||'customers';
  const list=activeTab==='customers'?custList:supList;
  const body=list.length?`<table class="tbl"><thead><tr><th>${t('الاسم','Name')}</th><th>${t('الرصيد','Balance')}</th><th></th></tr></thead><tbody>${list.map(d=>`<tr><td>${esc(d.name)}</td><td class="neg">${money(d.balance)}</td><td><button class="btn sm" onclick="customerStatement('${d.id}')">${t('كشف حساب','Statement')}</button> <button class="btn sm" onclick="openAddDebtModal('${d.id}','${d.name}','${d.type}')">＋ ${t('تسجيل دين','Add Debt')}</button></td></tr>`).join('')}</tbody></table>`:`<div class="empty">${activeTab==='customers'?t('لا ديون عملاء','No customer debts'):t('لا ديون موردين','No supplier debts')}</div>`;
  $('#screen').innerHTML=`<div class="screen">${pageHead(t('الديون','Debts'),{icon:'💳',sub:`${t('الإجمالي','Total')}: ${money(totalDebt)}`})}
    <div class="chip-row"><button class="chip ${activeTab==='customers'?'active':''}" onclick="window._debtTab='customers';renderDebts()">${t('ديون العملاء','Customer Debts')} (${custList.length})</button><button class="chip ${activeTab==='suppliers'?'active':''}" onclick="window._debtTab='suppliers';renderDebts()">${t('ديون الموردين','Supplier Debts')} (${supList.length})</button><button class="btn btn-primary btn-sm" onclick="openAddDebtModal()">＋ ${t('تسجيل دين','Add Debt')}</button></div>
    <div class="filters"><div class="field-inline"><input id="debtSearch" placeholder="${t('بحث بالاسم','Search name')}" oninput="filterDebtsList()"><button class="voice-btn btn sm" onclick="startVoiceSearch('debtSearch')">🎤</button></div></div>
    ${panel({flush:true,body})}</div>`; applyLang();
}
function openAddDebtModal(personId,personName,personType){
  const customers=DB.get('customers');
  const suppliers=DB.get('suppliers');
  let personSearch=`<label>${t('الشخص','Person')}<select id="debtPerson"><optgroup label="${t('العملاء','Customers')}">${customers.map(c=>`<option value="${c.id}" data-type="customer" ${personId===c.id?'selected':''}>${esc(c.name)}</option>`).join('')}</optgroup><optgroup label="${t('الموردين','Suppliers')}">${suppliers.map(s=>`<option value="${s.id}" data-type="supplier" ${personId===s.id?'selected':''}>${esc(s.name)}</option>`).join('')}</optgroup></select></label>`;
  if(!personId) personSearch+=`<button class="btn btn-sm" onclick="openAddDebtPersonInline()">${t('أو أضف شخص جديد','Or add new person')}</button>`;
  openModal(t('تسجيل دين','Add Debt'),`<div class="form-grid">${personSearch}<label>${t('المبلغ','Amount')}<input id="debtAmount" type="number"></label><label>${t('النوع','Type')}<select id="debtType"><option value="gave">${t('أعطيت','Gave')}</option><option value="took">${t('أخذت','Took')}</option></select></label><label>${t('التاريخ','Date')}<input id="debtDate" type="date" value="${new Date().toISOString().slice(0,10)}"></label><label>${t('ملاحظات','Notes')}<input id="debtNotes"></label></div>`,[{label:t('حفظ','Save'),cls:'btn-primary',onClick:()=>{ const amt=Number($('#debtAmount').value)||0; if(!amt){toast(t('المبلغ مطلوب','Amount required'));return;} const pid=$('#debtPerson').value; const type=$('#debtType').value; const cust=customers.find(c=>c.id===pid); const sup=suppliers.find(s=>s.id===pid); if(cust){ cust.balance=(cust.balance||0)+(type==='gave'?amt:-amt); DB.set('customers',customers); } else if(sup){ sup.balance=(sup.balance||0)+(type==='gave'?amt:-amt); DB.set('suppliers',suppliers); } logAudit(t('تسجيل دين','Add Debt'),(cust||sup||{}).name+' '+amt); closeModal(); renderDebts(); toast(t('تم الحفظ','Saved'));}},{label:t('إلغاء','Cancel'),cls:'btn',onClick:closeModal}]);
}
function filterDebtsList(){ const q=(($('#debtSearch').value||'').toLowerCase()); document.querySelectorAll('#screen .tbl tbody tr').forEach(r=>{ r.style.display=r.textContent.toLowerCase().includes(q)?'':'none'; }); }

/* ============================ PROFITS ============================ */
function renderProfits(){
  const invoices=(DB.get('invoices')||[]).filter(i=>i.type==='sale'&&i.status!=='deleted');
  const products=DB.get('products');
  let totalProfit=0;
  const profits= invoices.map(inv=>{ let profit=0; (inv.items||[]).forEach(it=>{ const p=products.find(x=>x.id===it.productId); const cost=p?p.buyingPrice||0:0; profit+=((Number(it.price)||0)-cost)*(Number(it.qty)||0); }); if(inv.discount) profit-=Number(inv.discount); totalProfit+=profit; return {code:inv.code,customer:inv.customerName||'',date:inv.createdAt,profit}; });
  const byDay={};
  profits.forEach(p=>{ const d=(p.date||'').slice(0,10); if(!byDay[d]) byDay[d]=0; byDay[d]+=p.profit; });
  const days=Object.keys(byDay).sort().slice(-14);
  const barH=days.length?`<div style="display:flex;align-items:flex-end;gap:4px;height:120px;margin-top:10px">${days.map(d=>{const v=byDay[d]; const max=Math.max(1,...Object.values(byDay)); const h=Math.max(4,(v/max)*100); return `<div style="flex:1;display:flex;flex-direction:column;align-items:center"><div style="width:100%;height:${h}px;background:${v>=0?'var(--success)':'var(--danger)'};border-radius:4px 4px 0 0"></div><div style="font-size:10px;color:var(--muted);margin-top:2px">${d.slice(5)}</div></div>`;}).join('')}</div>`:'';
  const body=profits.length?`<table class="tbl"><thead><tr><th>${t('الفاتورة','Invoice')}</th><th>${t('العميل','Customer')}</th><th>${t('التاريخ','Date')}</th><th>${t('الربح','Profit')}</th></tr></thead><tbody>${profits.slice(-20).reverse().map(p=>`<tr><td>${esc(p.code)}</td><td>${esc(p.customer)}</td><td>${fmtDate(p.date)}</td><td class="${p.profit>=0?'':'neg'}">${money(p.profit)}</td></tr>`).join('')}</tbody></table>`:`<div class="empty">${t('لا بيانات','No data')}</div>`;
  $('#screen').innerHTML=`<div class="screen">${pageHead(t('الأرباح','Profits'),{icon:'📈',sub:`${t('إجمالي الربح','Total Profit')}: ${money(totalProfit)}`})}
    ${barH?panel({body:`<h3>${t('ربح آخر 14 يوم','Last 14 days profit')}</h3>${barH}`}):''}
    ${panel({flush:true,body})}</div>`; applyLang();
}

/* ============================ DIRECTORY ============================ */
function renderDirectory(){
  const customers=(DB.get('customers')||[]).slice();
  const suppliers=(DB.get('suppliers')||[]).slice();
  const custBody=customers.length?`<table class="tbl"><thead><tr><th>${t('الاسم','Name')}</th><th>${t('الهاتف','Phone')}</th><th>${t('العنوان','Address')}</th><th>${t('الرصيد','Balance')}</th><th></th></tr></thead><tbody>${customers.map(c=>`<tr><td>${esc(c.name)}</td><td>${esc(c.phone||'')}</td><td>${esc(c.address||'')}</td><td class="${(c.balance||0)>0?'neg':''}">${money(c.balance||0)}</td><td><button class="btn sm" onclick="openCustomerModal('${c.id}')">📝</button></td></tr>`).join('')}</tbody></table>`:`<div class="empty">${t('لا عملاء','No customers')}</div>`;
  const supBody=suppliers.length?`<table class="tbl"><thead><tr><th>${t('الاسم','Name')}</th><th>${t('الهاتف','Phone')}</th><th>${t('العنوان','Address')}</th><th>${t('الرصيد','Balance')}</th><th></th></tr></thead><tbody>${suppliers.map(s=>`<tr><td>${esc(s.name)}</td><td>${esc(s.phone||'')}</td><td>${esc(s.address||'')}</td><td class="${(s.balance||0)>0?'neg':''}">${money(s.balance||0)}</td><td><button class="btn sm" onclick="openSupplierModal('${s.id}')">📝</button></td></tr>`).join('')}</tbody></table>`:`<div class="empty">${t('لا موردين','No suppliers')}</div>`;
  $('#screen').innerHTML=`<div class="screen">${pageHead(t('دليل جهات الاتصال','Directory'),{icon:'📒'})}
    <div class="filters"><div class="field-inline"><input id="dirSearch" placeholder="${t('بحث بالاسم أو الهاتف','Search name or phone')}" oninput="filterDirectoryList()"><button class="voice-btn btn sm" onclick="startVoiceSearch('dirSearch')">🎤</button></div></div>
    <div class="section-title">${t('العملاء','Customers')}</div>${panel({flush:true,body:custBody})}
    <div class="section-title">${t('الموردون','Suppliers')}</div>${panel({flush:true,body:supBody})}
  </div>`; applyLang();
}
function filterDirectoryList(){ const q=(($('#dirSearch').value||'').toLowerCase()); document.querySelectorAll('#screen .tbl tbody tr').forEach(r=>{ r.style.display=r.textContent.toLowerCase().includes(q)?'':'none'; }); }

/* ============================ RECYCLE BIN ============================ */
function renderRecycleBin(){
  const trash=(DB.get('trash')||[]).slice().sort((a,b)=>(b.deletedAt||'').localeCompare(a.deletedAt||''));
  const body=trash.length?`<table class="tbl"><thead><tr><th>${t('النوع','Type')}</th><th>${t('الرمز','Ref')}</th><th>${t('التاريخ','Date')}</th><th>${t('حذف في','Deleted')}</th><th></th></tr></thead><tbody>${trash.map(r=>`<tr><td>${esc(r.type)}</td><td>${esc(r.code||r.name||'')}</td><td>${fmtDate(r.date||r.createdAt)}</td><td>${fmtDateTime(r.deletedAt)}</td><td><button class="btn sm btn-primary" onclick="restoreFromTrash('${r.id}')">${t('استرجاع','Restore')}</button> <button class="btn sm btn-danger" onclick="permanentDelete('${r.id}')">${t('حذف نهائي','Delete Forever')}</button></td></tr>`).join('')}</tbody></table>`:`<div class="empty">${t('السلة فارغة','Bin is empty')}</div>`;
  $('#screen').innerHTML=`<div class="screen">${pageHead(t('سلة المحذوفات','Recycle Bin'),{icon:'🗑️',actions:`<button class="btn btn-danger" onclick="emptyTrash()">${t('تفريغ الكل','Empty All')}</button>`})}
    ${panel({flush:true,body})}</div>`; applyLang();
}
function moveToTrash(type, id, data){
  const trash=DB.get('trash')||[];
  trash.push({id:uid(),refId:id,type,code:data.code||data.name||'',date:data.date||data.createdAt||'',deletedAt:nowISO()});
  DB.set('trash',trash);
}
function restoreFromTrash(id){
  const trash=DB.get('trash')||[];
  const item=trash.find(t=>t.id===id);
  if(!item) return;
  toast(t('تم الاسترجاع','Restored')+' ('+item.type+')');
  DB.set('trash',trash.filter(t=>t.id!==id));
  renderRecycleBin();
}
function permanentDelete(id){ confirmModal(t('حذف نهائي','Permanent Delete'),t('لا يمكن التراجع','Cannot undo'),()=>{ const trash=(DB.get('trash')||[]).filter(t=>t.id!==id); DB.set('trash',trash); renderRecycleBin(); toast(t('تم الحذف','Deleted')); }); }
function emptyTrash(){ confirmModal(t('تفريغ السلة','Empty Bin'),t('حذف جميع العناصر نهائياً؟','Delete all items forever?'),()=>{ DB.set('trash',[]); renderRecycleBin(); toast(t('تم التفريغ','Emptied')); }); }

/* ============================ SOUND FEEDBACK ============================ */
function playAddSound(){
  try{ const ctx=new (window.AudioContext||window.webkitAudioContext)(); const osc=ctx.createOscillator(); const gain=ctx.createGain(); osc.connect(gain); gain.connect(ctx.destination); osc.type='sine'; osc.frequency.setValueAtTime(880,ctx.currentTime); osc.frequency.exponentialRampToValueAtTime(1320,ctx.currentTime+0.08); gain.gain.setValueAtTime(0.15,ctx.currentTime); gain.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+0.15); osc.start(ctx.currentTime); osc.stop(ctx.currentTime+0.15); }catch(e){}
}

/* ============================ SHARE AS JPG ============================ */
function shareAsJPG(elementId, filename){
  const el=document.getElementById(elementId);
  if(!el){ toast(t('خطأ','Error')); return; }
  if(typeof html2canvas!=='undefined'){
    html2canvas(el,{useCORS:true,backgroundColor:'#fff'}).then(canvas=>{
      canvas.toBlob(blob=>{
        if(navigator.share&&navigator.canShare){
          const file=new File([blob],(filename||'share')+'.jpg',{type:'image/jpeg'});
          try{ navigator.share({files:[file]}); return; }catch(e){}
        }
        const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=(filename||'share')+'.jpg'; a.click();
      },'image/jpeg',0.9);
    });
  } else {
    toast(t('html2canvas غير متاح','html2canvas not available'));
  }
}

/* ============================ DATE FILTER HELPER ============================ */
function filterByDate(items, from, to){
  if(!from&&!to) return items;
  return items.filter(i=>{
    const d=(i.createdAt||i.date||'').slice(0,10);
    if(from&&d<from) return false;
    if(to&&d>to) return false;
    return true;
  });
}
function dateRangeLabel(from, to){
  if(!from&&!to) return t('الكل','All');
  if(from&&to) return fmtDate(from)+' — '+fmtDate(to);
  if(from) return t('من','From')+' '+fmtDate(from);
  return t('إلى','To')+' '+fmtDate(to);
}

/* ============================ VOICE SEARCH ============================ */
function startVoiceSearch(inputId){
  if(!('webkitSpeechRecognition' in window||'SpeechRecognition' in window)){
    toast(t('البحث الصوتي غير مدعوم','Voice search not supported')); return;
  }
  const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
  const rec=new SR();
  rec.lang=(LANG==='en'?'en-US':'ar-SA');
  rec.interimResults=false;
  rec.maxAlternatives=1;
  const inp=document.getElementById(inputId);
  const btn=inp?inp.parentElement.querySelector('.voice-btn'):null;
  if(btn) btn.classList.add('listening');
  rec.onresult=function(e){
    const txt=e.results[0][0].transcript;
    if(inp){ inp.value=txt; inp.dispatchEvent(new Event('input')); }
    if(btn) btn.classList.remove('listening');
  };
  rec.onerror=function(){ if(btn) btn.classList.remove('listening'); toast(t('فشل التعرف على الصوت','Voice recognition failed')); };
  rec.onend=function(){ if(btn) btn.classList.remove('listening'); };
  rec.start();
}

/* ============================ CAMERA CAPTURE ============================ */
function captureCamera(inputId){
  if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia){
    toast(t('الكاميرا غير مدعومة','Camera not supported')); return;
  }
  openModal(t('التقط صورة','Capture Photo'),`<video id="camVideo" autoplay playsinline style="width:100%;border-radius:8px"></video>`,[
    {label:t('التقط','Capture'),cls:'btn-primary',onClick:()=>{
      const video=document.getElementById('camVideo');
      if(!video) return;
      const canvas=document.createElement('canvas');
      canvas.width=video.videoWidth||640; canvas.height=video.videoHeight||480;
      canvas.getContext('2d').drawImage(video,0,0);
      const dataUrl=canvas.toDataURL('image/jpeg',0.7);
      const inp=document.getElementById(inputId);
      if(inp) inp.value=dataUrl;
      video.srcObject.getTracks().forEach(t=>t.stop());
      closeModal(); toast(t('تم التحصيل','Captured'));
    }},
    {label:t('إلغاء','Cancel'),cls:'btn',onClick:()=>{
      const video=document.getElementById('camVideo');
      if(video&&video.srcObject) video.srcObject.getTracks().forEach(t=>t.stop());
      closeModal();
    }}
  ]);
  navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'}}).then(stream=>{
    const video=document.getElementById('camVideo');
    if(video) video.srcObject=stream;
  }).catch(()=>{ toast(t('فشل فتح الكاميرا','Camera access failed')); closeModal(); });
}

/* ============================ BULK OPERATIONS ============================ */
let _bulkSelected=new Set();
function toggleBulk(id){
  if(_bulkSelected.has(id)) _bulkSelected.delete(id); else _bulkSelected.add(id);
  const bar=document.getElementById('bulkBar');
  if(bar) bar.style.display=_bulkSelected.size>0?'flex':'none';
  const cnt=document.getElementById('bulkCount');
  if(cnt) cnt.textContent=_bulkSelected.size;
}
function clearBulk(){ _bulkSelected.clear(); const bar=document.getElementById('bulkBar'); if(bar) bar.style.display='none'; }
function bulkDelete(key, afterFn){
  if(!_bulkSelected.size){ toast(t('لم يتم اختيار أي عنصر','No items selected')); return; }
  confirmModal(t('حذف محدد','Delete Selected'),t('حذف '+_bulkSelected.size+' عنصر؟','Delete '+_bulkSelected.size+' items?'),()=>{
    const items=(DB.get(key)||[]).filter(i=>!_bulkSelected.has(i.id));
    DB.set(key,items);
    logAudit(t('حذف مجمع','Bulk Delete'),_bulkSelected.size+' '+key);
    clearBulk(); if(afterFn) afterFn(); toast(t('تم الحذف','Deleted'));
  });
}

/* ============================ BLUETOOTH PRINTER ============================ */
let _btDevice=null;
let _btCharacteristic=null;
async function connectBluetooth(){
  if(!navigator.bluetooth){ toast(t('البلوتوث غير مدعوم','Bluetooth not supported')); return false; }
  try{
    _btDevice=await navigator.bluetooth.requestDevice({filters:[{services:['battery_service']}],optionalServices:['000018f0-0000-1000-8000-00805f9b34fb']});
    const server=await _btDevice.gatt.connect();
    const services=await server.getPrimaryServices();
    if(services.length){
      const chars=await services[0].getCharacteristics();
      _btCharacteristic=chars.find(c=>c.properties.write)||chars[0];
    }
    toast(t('تم الاتصال بالبلوتوث','Bluetooth connected')); return true;
  }catch(e){ toast(t('فشل الاتصال','Connection failed')); return false; }
}
function escPOS(text){
  return [0x1B,0x40, 0x1B,0x61,0x01, ...new TextEncoder().encode(text), 0x0A, 0x0A, 0x1B,0x69];
}
async function printBluetooth(text){
  if(!_btCharacteristic){ const ok=await connectBluetooth(); if(!ok) return; }
  try{
    const data=new Uint8Array(escPOS(text));
    await _btCharacteristic.writeValue(data);
    toast(t('تمت الطباعة','Printed'));
  }catch(e){ toast(t('فشلت الطباعة','Print failed')); _btCharacteristic=null; }
}
async function printInvoiceBT(inv){
  const lines=[];
  lines.push('═══════════════════');
  lines.push(inv.code);
  lines.push('═══════════════════');
  lines.push(t('التاريخ','Date')+': '+(inv.createdAt||'').slice(0,10));
  lines.push(t('العميل','Customer')+': '+(inv.customerName||'—'));
  lines.push('───────────────────');
  (inv.items||[]).forEach(i=>{ lines.push(i.name+' ×'+i.qty+' = '+money(i.price*i.qty)); });
  lines.push('───────────────────');
  lines.push(t('الإجمالي','Total')+': '+money(inv.total));
  lines.push(t('المدفوع','Paid')+': '+money(inv.paid));
  lines.push('═══════════════════');
  await printBluetooth(lines.join('\n'));
}

/* ============================ AUTO BACKUP AT MIDNIGHT ============================ */
let _midnightTimer=null;
function scheduleMidnightBackup(){
  if(_midnightTimer) clearTimeout(_midnightTimer);
  const now=new Date();
  const tomorrow=new Date(now.getFullYear(),now.getMonth(),now.getDate()+1,0,0,5);
  const ms=tomorrow-now;
  _midnightTimer=setTimeout(()=>{
    try{ Backup.download(); }catch(e){}
    scheduleMidnightBackup();
  }, ms);
}

/* ============================ CAMERA IMAGE CAPTURE ============================ */
function openCameraCapture(targetInputId, previewId){
  const input=document.getElementById(targetInputId);
  if(!input) return;
  const cameraInput=document.createElement('input');
  cameraInput.type='file';
  cameraInput.accept='image/*';
  cameraInput.capture='environment';
  cameraInput.style.display='none';
  cameraInput.onchange=function(){
    if(cameraInput.files&&cameraInput.files[0]){
      const reader=new FileReader();
      reader.onload=function(e){
        const dataUrl=e.target.result;
        if(input.tagName==='INPUT'&&input.type==='hidden'){ input.value=dataUrl; }
        else if(input.tagName==='TEXTAREA'){ input.value+=(input.value?'\n':'')+dataUrl; }
        const prev=document.getElementById(previewId);
        if(prev){ prev.src=dataUrl; prev.style.display='block'; }
      };
      reader.readAsDataURL(cameraInput.files[0]);
    }
    cameraInput.remove();
  };
  document.body.appendChild(cameraInput);
  cameraInput.click();
}
function captureAndAddToGallery(galleryId, maxImages){
  maxImages=maxImages||10;
  const input=document.createElement('input');
  input.type='file';
  input.accept='image/*';
  input.capture='environment';
  input.multiple=true;
  input.style.display='none';
  input.onchange=function(){
    const files=Array.from(input.files||[]);
    const gallery=document.getElementById(galleryId);
    if(!gallery) return;
    let current=gallery.querySelectorAll('img').length;
    files.forEach(f=>{
      if(current>=maxImages) return;
      const reader=new FileReader();
      reader.onload=function(e){
        const img=document.createElement('div');
        img.className='gallery-item';
        img.style.cssText='display:inline-block;position:relative;margin:4px';
        img.innerHTML=`<img src="${e.target.result}" style="width:60px;height:60px;object-fit:cover;border-radius:6px;border:1px solid var(--border)"><button onclick="this.parentElement.remove()" style="position:absolute;top:-6px;right:-6px;background:var(--danger);color:#fff;border:none;border-radius:50%;width:18px;height:18px;font-size:11px;cursor:pointer;line-height:1">×</button><input type="hidden" class="gallery-data" value="${e.target.result}">`;
        gallery.appendChild(img);
      };
      reader.readAsDataURL(f);
      current++;
    });
    input.remove();
  };
  document.body.appendChild(input);
  input.click();
}
function getGalleryData(galleryId){
  const gallery=document.getElementById(galleryId);
  if(!gallery) return [];
  return Array.from(gallery.querySelectorAll('.gallery-data')).map(inp=>inp.value).filter(Boolean);
}

/* ============================ BARCODE SCANNER (html5-qrcode) ============================ */
let _barcodeScanner=null;
function openBarcodeScannerModal(targetInputId, onResult){
  const body=`<div id="barcode-reader" style="width:100%;max-width:400px;margin:0 auto"></div><p class="muted text-center mt-sm">${t('وجّه الكاميرا للباركود','Point camera at barcode')}</p>`;
  openModal(t('مسح باركود','Scan Barcode'), body, [{label:t('إغلاق','Close'),cls:'btn',onClick:()=>{ closeBarcodeScanner(); closeModal(); }}]);
  setTimeout(()=>startBarcodeScanner(targetInputId, onResult), 300);
}
function startBarcodeScanner(targetInputId, onResult){
  if(typeof Html5Qrcode==='undefined'){
    const script=document.createElement('script');
    script.src='https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js';
    script.onload=()=>initBarcodeScan(targetInputId, onResult);
    script.onerror=()=>toast(t('فشل تحميل مكتبة المسح','Scanner library load failed'));
    document.head.appendChild(script);
  } else {
    initBarcodeScan(targetInputId, onResult);
  }
}
function initBarcodeScan(targetInputId, onResult){
  try{
    _barcodeScanner=new Html5Qrcode('barcode-reader');
    _barcodeScanner.start({facingMode:'environment'},{fps:10,qrbox:{width:250,height:150}},(decodedText)=>{
      const inp=document.getElementById(targetInputId);
      if(inp) inp.value=decodedText;
      if(onResult) onResult(decodedText);
      closeBarcodeScanner();
      closeModal();
      toast(t('تم المسح','Scanned')+': '+decodedText);
    },()=>{});
  }catch(e){ toast(t('فشل المسح','Scan failed')); }
}
function closeBarcodeScanner(){
  if(_barcodeScanner){
    try{ _barcodeScanner.stop().catch(()=>{}); }catch(e){}
    try{ _barcodeScanner.clear(); }catch(e){}
    _barcodeScanner=null;
  }
}

/* ============================ UI CUSTOMIZATION (FOCUS MODE) ============================ */
let _focusMode=false;
let _selectedElement=null;
let _originalStyles=new Map();
function toggleFocusMode(){
  _focusMode=!_focusMode;
  if(_focusMode){
    document.body.classList.add('editing-ui-active');
    document.addEventListener('click',focusModeClick,true);
    toast(t('وضع التحرير — اضغط على أي عنصر لتعديله','Edit mode — click any element to edit'));
  } else {
    document.body.classList.remove('editing-ui-active');
    document.removeEventListener('click',focusModeClick,true);
    if(_selectedElement){ _selectedElement.classList.remove('ui-element-selected'); _selectedElement=null; }
    _originalStyles.clear();
    closeFocusPanel();
  }
}
function focusModeClick(e){
  if(!_focusMode) return;
  if(e.target.closest('#focusPanel')||e.target.closest('.topbar')||e.target.closest('.sidebar')) return;
  e.preventDefault(); e.stopPropagation();
  const target=e.target;
  if(_selectedElement) _selectedElement.classList.remove('ui-element-selected');
  _selectedElement=target;
  if(!_originalStyles.has(target)){
    _originalStyles.set(target, target.getAttribute('style')||'');
  }
  target.classList.add('ui-element-selected');
  openFocusPanel(target);
}
function openFocusPanel(el){
  let panel=document.getElementById('focusPanel');
  if(!panel){
    panel=document.createElement('div');
    panel.id='focusPanel';
    panel.style.cssText='position:fixed;inset-inline-end:10px;top:60px;width:260px;max-height:70vh;overflow-y:auto;background:var(--panel);border:1px solid var(--border);border-radius:var(--radius);box-shadow:var(--shadow-lg);z-index:100;padding:12px;font-size:13px';
    document.body.appendChild(panel);
  }
  const cs=getComputedStyle(el);
  panel.innerHTML=`<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px"><b>${t('تخصيص العنصر','Customize')}</b><button class="btn btn-sm" onclick="toggleFocusMode()">✕</button></div>
    <label>${t('اللون','Color')}<input type="color" value="${rgbToHex(cs.color)}" onchange="applyFocusStyle('color',this.value)" style="width:100%"></label>
    <label>${t('الخلفية','Background')}<input type="color" value="${rgbToHex(cs.backgroundColor)}" onchange="applyFocusStyle('backgroundColor',this.value)" style="width:100%"></label>
    <label>${t('حجم الخط','Font Size')}<input type="number" value="${parseInt(cs.fontSize)}" onchange="applyFocusStyle('fontSize',this.value+'px')" style="width:100%"></label>
    <label>${t('الهامش','Padding')}<input type="number" value="${parseInt(cs.padding)}" onchange="applyFocusStyle('padding',this.value+'px')" style="width:100%"></label>
    <label>${t('الحدود','Border Radius')}<input type="number" value="${parseInt(cs.borderRadius)}" onchange="applyFocusStyle('borderRadius',this.value+'px')" style="width:100%"></label>
    <label>${t('الوزن','Font Weight')}<select onchange="applyFocusStyle('fontWeight',this.value)" style="width:100%"><option ${cs.fontWeight==='400'?'selected':''}>400</option><option ${cs.fontWeight==='600'?'selected':''}>600</option><option ${cs.fontWeight==='700'?'selected':''}>700</option><option ${cs.fontWeight==='800'?'selected':''}>800</option></select></label>
    <button class="btn btn-sm mt-sm" onclick="undoFocusStyle()" style="width:100%">↩ ${t('تراجع','Undo')}</button>`;
}
function closeFocusPanel(){ const p=document.getElementById('focusPanel'); if(p) p.remove(); }
function getElSelector(el){
  if(el.id) return '#'+el.id;
  let path=[]; let cur=el;
  while(cur && cur!==document.body && cur!==document.documentElement){
    let sel=cur.tagName.toLowerCase();
    if(cur.id){ path.unshift('#'+cur.id); break; }
    if(cur.className&&typeof cur.className==='string'){
      const cls=cur.className.trim().split(/\s+/).filter(c=>c&&!c.startsWith('ui-')&&!c.startsWith('editing')).slice(0,2).join('.');
      if(cls) sel+='.'+cls;
    }
    const parent=cur.parentElement;
    if(parent){
      const siblings=Array.from(parent.children).filter(c=>c.tagName===cur.tagName);
      if(siblings.length>1){ const idx=siblings.indexOf(cur); sel+=':nth-of-type('+(idx+1)+')'; }
    }
    path.unshift(sel);
    cur=cur.parentElement;
  }
  return path.join(' > ');
}
function applyFocusStyle(prop, val){
  if(!_selectedElement) return;
  _selectedElement.style[prop]=val;
  saveFocusCustomizations();
}
function resetFocusStyle(){
  if(!_selectedElement) return;
  _selectedElement.removeAttribute('style');
  saveFocusCustomizations();
  if(_focusMode) openFocusPanel(_selectedElement);
}
function undoFocusStyle(){
  if(!_selectedElement) return;
  const orig=_originalStyles.get(_selectedElement);
  if(orig!==undefined){
    if(orig) _selectedElement.setAttribute('style',orig);
    else _selectedElement.removeAttribute('style');
  }
  saveFocusCustomizations();
  if(_focusMode) openFocusPanel(_selectedElement);
}
function resetAllUICustomizations(){
  document.querySelectorAll('[style]').forEach(el=>{
    if(el.id==='focusPanel') return;
    el.removeAttribute('style');
  });
  const s=DB.getOne('settings')||{};
  delete s.uiCustomizations;
  DB.setOne('settings',s);
  toast(t('تمت إعادة الواجهة','UI reset'));
}
function rgbToHex(rgb){
  if(!rgb||rgb==='transparent'||rgb==='rgba(0, 0, 0, 0)') return '#ffffff';
  const m=rgb.match(/\d+/g); if(!m) return '#000000';
  return '#'+m.slice(0,3).map(x=>Number(x).toString(16).padStart(2,'0')).join('');
}
function saveFocusCustomizations(){
  const styles={};
  document.querySelectorAll('[style]').forEach(el=>{
    if(el.id==='focusPanel') return;
    const key=getElSelector(el);
    if(!key) return;
    styles[key]=el.getAttribute('style');
  });
  const s=DB.getOne('settings')||{};
  s.uiCustomizations=styles;
  DB.setOne('settings',s);
}
function loadFocusCustomizations(){
  const s=DB.getOne('settings')||{};
  const styles=s.uiCustomizations||{};
  Object.entries(styles).forEach(([selector,styleStr])=>{
    try{ const el=document.querySelector(selector); if(el) el.setAttribute('style',styleStr); }catch(e){}
  });
}

/* ============================ CLOUD SYNC (FIREBASE) ============================ */
let _firebaseApp=null;
let _firebaseDB=null;
let _firebaseAuth=null;
function initFirebase(){
  if(_firebaseApp) return true;
  const s=DB.getOne('settings')||{};
  const cfg=s.firebaseConfig;
  if(!cfg||!cfg.apiKey) return false;
  try{
    if(typeof firebase!=='undefined'&&firebase.initializeApp){
      _firebaseApp=firebase.initializeApp(cfg);
      _firebaseDB=firebase.firestore();
      _firebaseAuth=firebase.auth();
      return true;
    }
  }catch(e){}
  return false;
}
async function firebaseLogin(){
  const s=DB.getOne('settings')||{};
  if(!initFirebase()){ toast(t('Firebase غير مهيأ','Firebase not configured')); return false; }
  try{
    const provider=new firebase.auth.GoogleAuthProvider();
    await _firebaseAuth.signInWithPopup(provider);
    toast(t('تم تسجيل الدخول','Logged in'));
    return true;
  }catch(e){ toast(t('فشل تسجيل الدخول','Login failed')); return false; }
}
async function firebasePush(){
  if(!initFirebase()||!_firebaseAuth||!_firebaseAuth.currentUser) return false;
  try{
    const uid=_firebaseAuth.currentUser.uid;
    const data=collectState();
    await _firebaseDB.collection('backups').doc(uid).set({data,syncedAt:new Date().toISOString()});
    _dirty=false;
    _setSyncStatus('ok',t('تمت المزامنة','Synced'));
    return true;
  }catch(e){ _setSyncStatus('err',t('فشلت المزامنة','Sync failed')); return false; }
}
async function firebasePull(){
  if(!initFirebase()||!_firebaseAuth||!_firebaseAuth.currentUser) return false;
  try{
    const uid=_firebaseAuth.currentUser.uid;
    const doc=await _firebaseDB.collection('backups').doc(uid).get();
    if(doc.exists){
      applyState(doc.data().data);
      _setSyncStatus('ok',t('تم السحب','Pulled'));
      boot();
      return true;
    }
  }catch(e){ _setSyncStatus('err',t('فشل السحب','Pull failed')); }
  return false;
}
function firebaseLogout(){
  if(_firebaseAuth) _firebaseAuth.signOut();
  toast(t('تم الخروج','Logged out'));
}

/* ============================ KEYBOARD SHORTCUTS ============================ */
function initKeyboardShortcuts(){
  document.addEventListener('keydown',function(e){
    if(e.target.tagName==='INPUT'||e.target.tagName==='TEXTAREA'||e.target.tagName==='SELECT') return;
    if(e.altKey&&e.key>='1'&&e.key<='9'){
      const nav=navItems().filter(n=>hasPerm(n.perm));
      const idx=parseInt(e.key)-1;
      if(nav[idx]){ renderScreen(nav[idx].id); e.preventDefault(); }
    }
    if(e.key==='n'&&!e.ctrlKey&&!e.altKey){
      const screen=_currentScreenId;
      if(screen==='products'||screen==='inventory'){ openProductModal(); e.preventDefault(); }
      else if(screen==='sales'){ renderInvoiceScreen('sale'); e.preventDefault(); }
      else if(screen==='purchases'){ renderPurchasePOS(); e.preventDefault(); }
      else if(screen==='expenses'){ openExpenseModal(); e.preventDefault(); }
      else if(screen==='customers'){ openCustomerModal(); e.preventDefault(); }
      else if(screen==='suppliers'){ openSupplierModal(); e.preventDefault(); }
    }
  });
}

