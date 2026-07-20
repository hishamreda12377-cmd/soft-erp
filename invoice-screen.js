/* Nexus ERP — Unified Professional Invoice Screen (Sale / Purchase / PO)
 * Reuses existing business logic: nextNumber, getTaxRate, isPeriodLocked, periodOf,
 * applySale, applyPurchase, shareInvoiceModal, openModal/closeModal, DB, DEC, CFG, t, money, fmt, uid.
 */
'use strict';
let _invCart=[], _invCfg=null, _invEditId=null; const _invDraftPrefix='erp_inv_draft_'; /* _invDisc lives in app.js */
let _invAttach=[], _invKeyHandler=null; /* attachments + keyboard handler for active screen */
function invCfg(kind){
  if(kind==='sale') return {kind:'sale',title:t('فاتورة بيع','Sales Invoice'),seqPrefix:'INV',seqBase:'INV-',seqLen:6,hasPrice:true,partyLabel:t('العميل','Customer'),partyArr:'customers',partyField:'invParty',partyHidden:'invPartyId'};
  if(kind==='purchase') return {kind:'purchase',title:t('فاتورة شراء','Purchase Invoice'),seqPrefix:'PU',seqBase:'PU-',seqLen:6,hasPrice:true,partyLabel:t('المورد','Supplier'),partyArr:'suppliers',partyField:'invParty',partyHidden:'invPartyId'};
  return {kind:'po',title:t('أمر شراء','Purchase Order'),seqPrefix:'PO',seqBase:'PO-',seqLen:6,hasPrice:false,partyLabel:t('المورد','Supplier'),partyArr:'suppliers',partyField:'invParty',partyHidden:'invPartyId'};
}
function invDraftKey(kind){ return _invDraftPrefix+kind; }
function invNextCode(cfg){ return nextNumber(cfg.seqPrefix, cfg.seqBase, cfg.seqLen); }
function renderInvoiceScreen(kind, editId){
  const cfg=invCfg(kind); _invCfg=cfg; _invEditId=editId||null; _invCart=[]; _invDisc=0; _invAttach=[];
  let edit=null;
  if(editId){ if(kind==='sale') edit=DB.get('invoices').find(x=>x.id===editId); else if(kind==='purchase') edit=DB.get('purchases').find(x=>x.id===editId); else edit=DB.get('purchaseOrders').find(x=>x.id===editId); }
  if(edit){
    if(kind==='sale'){ _invCart=edit.items.map(it=>({id:it.productId,code:it.code,name:it.name,buying:it.buying,selling:it.price,qty:it.qty,disc:Number(it.disc)||0,tax:Number(it.tax)||0})); _invDisc=0; }
    else if(kind==='purchase'){ _invCart=edit.items.map(it=>({id:it.productId,code:it.code,name:it.name,buying:it.price,selling:it.price,qty:it.qty})); }
    else { _invCart=edit.items.map(it=>({id:it.productId,code:it.code,name:it.name,qty:it.qty})); }
    _invAttach=(edit.attachments||[]).map(a=>({name:a.name,type:a.type,data:a.data}));
  }
  const warehouses=DB.get('warehouses'); const ccs=DB.get('costCenters');
  const today=new Date().toISOString().slice(0,10);
  const due=new Date(Date.now()+30*86400000).toISOString().slice(0,10);
  const partyVal=edit?esc((kind==='sale'?edit.customerName:edit.supplierName)||''):'';
  const partyId=edit?(kind==='sale'?edit.customerId:edit.supplierId):'';
  const draftKey=invDraftKey(kind);
  const saved=(!edit && localStorage.getItem(draftKey))?JSON.parse(localStorage.getItem(draftKey)):null;
  const code=edit?edit.code:invNextCode(cfg);
  const listScreen=(kind==='sale'?'sales':kind==='purchase'?'purchases':'purchaseorders');
  $('#screen').innerHTML=`<div class="screen"><div class="inv-screen">
    ${edit?`<div class="edit-banner">${t('تعديل','Edit')} <b>${esc(edit.code)}</b> <button class="btn sm" onclick="invCancelEdit('${kind}')">${t('إلغاء','Cancel')}</button></div>`:''}
    <div class="inv-topbar">
      <div class="inv-code-row">
        <div class="inv-code">${t('رقم الفاتورة','Invoice No')}: <b>${esc(code)}</b></div>
        <label class="btn sm inv-attach-btn">📎 ${t('المرفقات','Attachments')}<input type="file" id="invFile" accept="image/*,application/pdf" multiple style="display:none" onchange="invAddAttachments(this)"><span class="muted" id="invAttachCount"></span></label>
        <div class="inv-attach-list inv-attach-list-inline" id="invAttachList"></div>
      </div>
      <div class="inv-status" id="invStatus"></div>
      <div class="inv-top-row">
        <div class="inv-topfields">
          <div class="field"><label>${t('المخزن','Warehouse')}</label><select id="invWh">${warehouses.length?warehouses.map(w=>`<option value="${w.id}">${esc(w.name)}</option>`).join(''):`<option value="">—</option>`}</select></div>
          <div class="field"><label>${t('تاريخ الفاتورة','Date')}</label><input id="invDate" type="date" value="${edit?edit.createdAt.slice(0,10):(saved?saved.date:today)}"></div>
          <div class="field"><label>${t('طريقة الدفع','Payment')}</label><select id="invPay">${['cash','credit'].map(v=>`<option value="${v}" ${((edit&&edit.payment===v)||(!edit&&v==='cash'))?'selected':''}>${v==='cash'?t('نقد','Cash'):t('آجل','Credit')}</option>`).join('')}</select></div>
        </div>
        <div class="inv-topactions">
          <button class="btn sm" onclick="invAuditHistory('${kind}')">🕑 ${t('سجل العمليات','History')}</button>
          <button class="btn" onclick="invSaveDraft('${kind}')">📝 ${t('حفظ كمسودة','Save Draft')}</button>
          <button class="btn btn-primary" onclick="invPost('${kind}')">✅ ${t('حفظ','Save')}</button>
          <button class="btn" onclick="invPreviewPrint('${kind}')">🖨️ ${t('طباعة','Print')}</button>
          <button class="btn-link" onclick="renderScreen('${listScreen}')" title="${t('الرجوع للقائمة','Back to List')}">←</button>
        </div>
      </div>
    </div>
    <div class="inv-split" id="invSplit">
      <div class="inv-input">
        <div class="inv-header inv-header-2">
          <div class="field col-party"><label>${cfg.partyLabel}</label><input id="${cfg.partyField}" list="invPartyList" placeholder="${t('بحث','Search')}" value="${partyVal}" oninput="invSetParty('${cfg.partyField}','${cfg.partyHidden}','${cfg.partyArr}')"><input type="hidden" id="${cfg.partyHidden}" value="${partyId}"><datalist id="invPartyList">${DB.get(cfg.partyArr).map(r=>`<option value="${esc(r.name)}">`).join('')}</datalist></div>
          <div class="field col-notes"><label>${t('ملاحظات','Notes')}</label><input id="invNotes" value="${edit?esc(edit.notes||''):(saved?saved.notes:'')}"></div>
          <div class="field inv-item-search-full"><label>${t('بحث عن صنف','Find Item')}</label><div class="inv-item-search-inline"><input id="invItemSearch" placeholder="${t('اكتب اسم أو باركود الصنف','Type item name or barcode')}" oninput="invItemSearchAC(this.value)" autocomplete="off"><button class="btn" type="button" onclick="openScanner('invItemSearch')">📷 ${t('مسح','Scan')}</button></div><div id="invItemAC" class="pos-ac"></div></div>
        </div>
        <div class="inv-grid-wrap"><table class="inv-table"><thead><tr>
          <th class="col-name">${t('الصنف','Item')}</th><th>${t('الوحدة','Unit')}</th><th>${t('الكمية','Qty')}</th>
          ${cfg.hasPrice?'<th>'+t('السعر','Price')+'</th><th>'+t('خصم','Disc')+'%</th>':''}
          <th>${t('الإجمالي','Total')}</th><th></th>
        </tr></thead><tbody id="invRows"></tbody></table>
        </div>
      </div>
      <div class="inv-preview" id="invPreview" style="display:none"></div>
    </div>
  </div></div>`;
  if(saved && !edit){ _invCart=saved.cart||[]; _invDisc=saved.invDisc||0; _invAttach=(saved.attachments||[]).slice(); const pid=$('#'+cfg.partyHidden); if(pid) pid.value=saved.partyId||''; const pn=$('#'+cfg.partyField); if(pn) pn.value=saved.partyName||''; }
  invRenderRows(); invRenderSummary(); invRenderAttach();
  invBindKeys(kind);
  applyLang();
}
function invBindKeys(kind){
  if(_invKeyHandler){ document.removeEventListener('keydown',_invKeyHandler); _invKeyHandler=null; }
}
function invCancelEdit(kind){ _invEditId=null; renderInvoiceScreen(kind); }
function invSetParty(field, hidden, arr){ const v=$('#'+field).value.trim(); const rec=DB.get(arr).find(r=>r.name===v); const h=$('#'+hidden); if(h) h.value=rec?rec.id:''; }
function invSearchPrompt(cfg){ openModal(t('إضافة صنف','Add Item'), `<div class="pos-search"><input id="invPick" placeholder="${t('بحث عن منتج','Search product')}" oninput="invPickAC(this.value)" autofocus><div id="invPickAC" class="pos-ac"></div></div>`, [{label:t('إغلاق','Close'),cls:'btn',onClick:closeModal}]); setTimeout(()=>{ const e=$('#invPick'); if(e) e.focus(); },50); }
function invPickAC(q){ const box=$('#invPickAC'); if(!box) return; if(!q){ box.style.display='none'; box.innerHTML=''; return; } const list=DB.get('products').filter(p=>p.status!=='inactive'&&((p.name||'').toLowerCase().includes(q.toLowerCase())||(p.barcode||'').includes(q)||(p.code||'').toLowerCase().includes(q.toLowerCase()))).slice(0,10); if(!list.length){ box.style.display='none'; box.innerHTML=''; return; } box.innerHTML=list.map(p=>`<div class="ac-item" data-id="${p.id}" onclick="invAddItem('${p.id}')"><div class="ac-name">${esc(p.name)}</div><div class="ac-meta">${cfg2Price(_invCfg,p)?money(cfg2Price(_invCfg,p)):''} · ${t('متاح','Av')}: ${fmt(p.qty)}</div></div>`).join(''); box.style.display='block'; }
function invItemSearchAC(q){ const box=$('#invItemAC'); if(!box) return; if(!q){ box.style.display='none'; box.innerHTML=''; return; } const list=DB.get('products').filter(p=>p.status!=='inactive'&&((p.name||'').toLowerCase().includes(q.toLowerCase())||(p.barcode||'').includes(q)||(p.code||'').toLowerCase().includes(q.toLowerCase()))).slice(0,10); if(!list.length){ box.style.display='none'; box.innerHTML=''; return; } box.innerHTML=list.map(p=>`<div class="ac-item" data-id="${p.id}" onclick="invItemSearchPick('${p.id}')"><div class="ac-name">${esc(p.name)}</div><div class="ac-meta">${cfg2Price(_invCfg,p)?money(cfg2Price(_invCfg,p)):''} · ${t('متاح','Av')}: ${fmt(p.qty)}</div></div>`).join(''); box.style.display='block'; }
function invItemSearchPick(id){ const inp=$('#invItemSearch'); if(inp) inp.value=''; const box=$('#invItemAC'); if(box){ box.style.display='none'; box.innerHTML=''; } invAddItem(id); }
function cfg2Price(cfg,p){ return cfg.hasPrice?(cfg.kind==='sale'?p.sellingPrice:p.buyingPrice):0; }
function invAddItem(id){ const p=DB.get('products').find(x=>x.id===id); if(!p) return; const line=_invCart.find(i=>i.id===id); const cur=line?line.qty:0;
  if(_invCfg.kind!=='po' && (p.qty||0)<=cur){ toast(t('رصيد غير كافٍ','Insufficient stock')+': '+p.name); }
  if(line){ line.qty++; } else { const base={id,code:p.code,name:p.name,qty:1}; if(_invCfg.hasPrice){ if(_invCfg.kind==='sale'){ base.selling=p.sellingPrice; base.buying=p.buyingPrice; base.disc=Number(p.defaultDiscount)||0; base.tax=Number(p.tax)||0; } else { base.buying=p.buyingPrice; base.selling=p.buyingPrice; } } _invCart.push(base); }
  closeModal(); invRenderRows(); invRenderSummary(); invAutosave(); }
function invChangeQty(id,d){ const l=_invCart.find(i=>i.id===id); if(l){ l.qty+=d; if(l.qty<=0) _invCart=_invCart.filter(i=>i.id!==id); } invRenderRows(); invRenderSummary(); invAutosave(); }
function invSetLine(id,field,val){ const l=_invCart.find(i=>i.id===id); if(l) l[field]=Number(val)||0; invRenderRows(); invRenderSummary(); invAutosave(); }
function invSetDisc(v){ _invDisc=Number(v)||0; invRenderSummary(); invAutosave(); }
function invLineTotal(it){ if(!_invCfg.hasPrice) return 0; const price=it.selling!=null?it.selling:it.buying; const disc=DEC.mul(DEC.mul(price,it.qty), (it.disc||0)/100); return DEC.sub(DEC.mul(price,it.qty), disc); }
function invTotals(){
  if(!_invCfg.hasPrice) return {count:DEC.sum(_invCart,'qty')};
  const subtotal=DEC.sum(_invCart.map(i=>DEC.mul((i.selling!=null?i.selling:i.buying), i.qty)));
  const discAmt=DEC.sum(_invCart.map(i=>DEC.mul(DEC.mul((i.selling!=null?i.selling:i.buying),i.qty), (i.disc||0)/100)));
  const invDiscAmt=DEC.mul(subtotal,_invDisc/100);
  const afterDisc=DEC.sub(DEC.sub(subtotal,discAmt),invDiscAmt);
  const taxRate=getTaxRate(); const tax=DEC.mul(afterDisc,taxRate/100);
  const total=DEC.add(afterDisc,tax);
  return {subtotal,discAmt,invDiscAmt,tax,total,count:DEC.sum(_invCart,'qty')};
}
function invRenderRows(){
  const tbody=$('#invRows'); if(!tbody) return;
  if(!_invCart.length){ tbody.innerHTML=`<tr><td colspan="7" style="text-align:center;color:var(--muted);padding:20px">${t('لا أصناف بعد — اضغط إضافة صنف','No items — click add item')}</td></tr>`; return; }
  const prods=DB.get('products');
  tbody.innerHTML=_invCart.map(i=>{
    const p=prods.find(x=>x.id===i.id)||{}; const av=p.qty||0;
    const low=(_invCfg.kind!=='po' && i.qty>av)?' class="qty-low"':'';
    const unit=p.unit||t('قطعة','Pc');
    const total=_invCfg.hasPrice?money(invLineTotal(i)):'—';
    const price=_invCfg.hasPrice?(_invCfg.kind==='sale'?(i.selling||0):(i.buying||0)):0;
    const priceCell=_invCfg.hasPrice?`<td><input class="mini line-price" type="number" value="${price}" oninput="invSetLine('${i.id}','${_invCfg.kind==='sale'?'selling':'buying'}',this.value)"></td><td><input class="mini" type="number" value="${i.disc||0}" oninput="invSetLine('${i.id}','disc',this.value)">%</td>`:'';
    return `<tr>
      <td class="col-name"><div class="cell-name">${esc(i.name)}</div><div class="cell-meta">${esc(i.code||'')}${av!==undefined?' · '+t('متاح','Av')+': '+fmt(av):''}</div></td>
      <td>${esc(unit)}</td>
      <td${low}><button class="btn sm" onclick="invChangeQty('${i.id}',-1)">-</button> ${i.qty} <button class="btn sm" onclick="invChangeQty('${i.id}',1)">+</button></td>
      ${priceCell}
      <td class="line-total">${total}</td>
      <td><button class="btn sm btn-danger" onclick="invChangeQty('${i.id}',-999)">×</button></td>
    </tr>`;
  }).join('');
}
function invRenderSummary(){
  const el=$('#invSummary'); if(!el) return; const tt=invTotals();
  if(!_invCfg.hasPrice){ el.innerHTML=`<div class="sum-row"><span class="lbl">${t('عدد الأصناف','Items')}</span><span>${fmt(tt.count)}</span></div>`; return; }
  el.innerHTML=`<div class="sum-row"><span class="lbl">${t('صافي المبلغ','Subtotal')}</span><span>${money(tt.subtotal)}</span></div>
    <div class="sum-row"><span class="lbl">${t('خصم','Discount')}</span><span class="disc-field">${money(DEC.add(tt.discAmt,tt.invDiscAmt))} <input class="mini" id="invDisc" type="number" value="${_invDisc}" oninput="invSetDisc(this.value)">%</span></div>
    <div class="sum-row"><span class="lbl">${t('ضريبة','Tax')} ${getTaxRate()}%</span><span>${money(tt.tax)}</span></div>
    <div class="sum-row sum-grand"><span>${t('الإجمالي النهائي','Grand Total')}</span><span class="total">${money(tt.total)}</span></div>`;
}
function invValidatePost(){
  const tt=invTotals();
  if(!_invCart.length){ toast(t('أضف صنفاً واحداً على الأقل','Add at least one item')); return false; }
  if(_invCfg.hasPrice && tt.total<=0){ toast(t('الإجمالي يجب أن يكون أكبر من صفر','Total must be greater than zero')); return false; }
  const ph=$('#'+_invCfg.partyHidden);
  if(_invCfg.kind!=='po' && ph && !ph.value){ toast(t('اختر ','Select ')+_invCfg.partyLabel); return false; }
  return true;
}
function invEditDue(){ if(!_invEditId) return ''; const e = kind==='sale'?DB.get('invoices').find(x=>x.id===_invEditId):kind==='purchase'?DB.get('purchases').find(x=>x.id===_invEditId):DB.get('purchaseOrders').find(x=>x.id===_invEditId); return (e&&e.due)||''; }
function invBuild(kind){
  const cfg=invCfg(kind); const tt=invTotals();
  const partyId=$('#'+cfg.partyHidden).value||(DB.get(cfg.partyArr)[0]&&DB.get(cfg.partyArr)[0].id)||'';
  const party=DB.get(cfg.partyArr).find(x=>x.id===partyId)||{};
  const notes=$('#invNotes')?$('#invNotes').value.trim():'';
  const date=$('#invDate').value||new Date().toISOString().slice(0,10);
  const due=_invEditId?(invEditDue()||''):'';
  const whId=$('#invWh')?$('#invWh').value:'';
  const pay=$('#invPay')?$('#invPay').value:((edit&&edit.payment)||'cash');
  const ccId=(ccs&&ccs[0])?ccs[0].id:'';
  const code=_invEditId?(kind==='sale'?DB.get('invoices').find(x=>x.id===_invEditId).code:kind==='purchase'?DB.get('purchases').find(x=>x.id===_invEditId).code:DB.get('purchaseOrders').find(x=>x.id===_invEditId).code):invNextCode(cfg);
  const common={id:_invEditId||uid(),code,createdAt:nowISO(),date,due,warehouseId:whId,payment:pay,costCenterId:ccId,notes,branchId:_activeBranchId,companyId:_activeCompanyId,attachments:_invAttach.map(a=>({name:a.name,type:a.type,data:a.data}))};
  if(!cfg.hasPrice){ return Object.assign({},common,{supplierId:partyId,supplierName:party.name||'',type:'po',status:'pending',items:_invCart.map(i=>({productId:i.id,code:i.code,name:i.name,qty:i.qty}))}); }
  const items=_invCart.map(i=>({productId:i.id,code:i.code,name:i.name,qty:i.qty,price:i.selling!=null?i.selling:i.buying,buying:i.buying,selling:i.selling,disc:i.disc||0,tax:i.tax||0,subtotal:invLineTotal(i)}));
  const discount=DEC.add(tt.discAmt,tt.invDiscAmt);
  if(kind==='sale') return Object.assign({},common,{type:'sale',customerId:partyId,customerName:party.name||'',items,subtotal:tt.subtotal,discount,tax:tt.tax,total:tt.total,paid:(pay==='credit'?0:tt.total),change:0,remaining:(pay==='credit'?tt.total:0),status:'completed'});
  return Object.assign({},common,{type:'purchase',supplierId:partyId,supplierName:party.name||'',items,subtotal:tt.subtotal,discount,tax:tt.tax,total:tt.total,status:'completed'});
}
function invPost(kind){
  if(!requirePost()) return;
  if(!invValidatePost()) return;
  if(isPeriodLocked(periodOf($('#invDate').value))){ toast(t('الفترة مقفلة لا يمكن الترحيل','Period locked - cannot post')); return; }
  const inv=invBuild(kind);
  if(kind==='sale'){
    const products=DB.get('products'); inv.items.forEach(it=>{ const p=products.find(x=>x.id===it.productId); if(p) adjStock(p,-it.qty, inv.warehouseId); }); DB.set('products',products);
    const invoices=DB.get('invoices'); invoices.push(inv); DB.set('invoices',invoices); applySale(inv);
    logAudit(t('فاتورة بيع','Sale invoice'),inv.code,{type:CFG.AUDIT.ADD,ref:inv.id});
  } else if(kind==='purchase'){
    applyPurchase(inv); const arr=DB.get('purchases'); arr.push(inv); DB.set('purchases',arr);
    logAudit(t('فاتورة شراء','Purchase'),inv.code,{type:CFG.AUDIT.ADD,ref:inv.id});
  } else {
    const arr=DB.get('purchaseOrders'); arr.push(inv); DB.set('purchaseOrders',arr);
    logAudit(t('أمر شراء','PO'),inv.code,{type:CFG.AUDIT.ADD,ref:inv.id});
  }
  invClearDraft(kind); _invEditId=null;
  const listScreen=(kind==='sale'?'sales':kind==='purchase'?'purchases':'purchaseorders');
  if(kind==='sale'){ renderScreen(listScreen); shareInvoiceModal(inv); }
  else renderScreen(listScreen);
  toast(t('تم الترحيل','Posted')+' '+inv.code);
}
function invSaveDraft(kind){
  if(!_invCart.length){ toast(t('أضف صنفاً أولاً','Add an item first')); return; }
  const cfg=invCfg(kind);
  const draft={kind,partyId:$('#'+cfg.partyHidden).value,partyName:$('#'+cfg.partyField).value,date:$('#invDate').value,due:$('#invDue')?$('#invDue').value:'',notes:$('#invNotes')?$('#invNotes').value.trim():'',cart:_invCart,invDisc:_invDisc,attachments:_invAttach.map(a=>({name:a.name,type:a.type,data:a.data}))};
  localStorage.setItem(invDraftKey(kind), JSON.stringify(draft));
  const st=$('#invStatus'); if(st){ st.textContent='✓ '+t('تم حفظ المسودة','Draft saved')+' · '+new Date().toLocaleTimeString(); }
  toast(t('تم حفظ المسودة','Draft saved'));
}
function invAutosave(){ if(!_invCart.length){ invClearDraft(_invCfg.kind); return; } invSaveDraft(_invCfg.kind); }
function invClearDraft(kind){ localStorage.removeItem(invDraftKey(kind)); }
function invPrint(kind){
  if(kind==='sale'){ const inv=invBuild(kind); printInvoice(inv); }
  else { toast(t('الطباعة متاحة بعد الترحيل','Print available after posting')); }
}
function invPreviewPrint(kind){
  if(!_invCart.length){ toast(t('لا توجد أصناف للطباعة','No items to print')); return; }
  const previewHTML=`<div class="receipt-prev">${receiptHTMLPreview(invBuild(kind))}</div>`;
  openModal(t('معاينة الطباعة','Print Preview'), `<div class="inv-preview-modal">${previewHTML}</div>`, [
    {label:t('إلغاء','Cancel'), cls:'btn', onClick:closeModal},
    {label:'⬇️ '+t('تحميل PDF','Download PDF'), cls:'btn', onClick:()=>{ const inv=invBuild(kind); if(kind==='sale'){ printInvoicePDF(inv); } else { toast(t('التحميل متاح بعد الترحيل','Available after posting')); } }},
    {label:t('حفظ','Save'), cls:'btn', onClick:()=>{ closeModal(); invPost(kind); }},
    {label:'🖨️ '+t('طباعة','Print'), cls:'btn btn-primary', onClick:()=>{ const inv=invBuild(kind); if(kind==='sale'){ printInvoice(inv); } else { toast(t('الطباعة متاحة بعد الترحيل','Print available after posting')); } closeModal(); }}
  ]);
}
/* ---------- Attachments ---------- */
function invAddAttachments(input){ const files=input.files; if(!files||!files.length) return;
  Array.from(files).forEach(f=>{ const r=new FileReader(); r.onload=()=>{ _invAttach.push({name:f.name,type:f.type||'file',data:r.result}); invRenderAttach(); invAutosave(); }; r.readAsDataURL(f); });
  input.value='';
}
function invRemoveAttach(idx){ confirmModal(t('حذف المرفق','Delete attachment'), t('هل تريد حذف هذا المرفق؟','Delete this attachment?'), ()=>{ _invAttach.splice(idx,1); invRenderAttach(); invAutosave(); }); }
function invOpenAttach(idx){ const a=_invAttach[idx]; if(!a) return; const isImg=a.type&&a.type.indexOf('image/')===0; const body=isImg?`<img src="${a.data}" alt="" style="max-width:100%">`:`<iframe src="${a.data}" style="width:100%;height:70vh;border:0"></iframe>`; openModal(esc(a.name), body, [{label:t('إغلاق','Close'), cls:'btn', onClick:closeModal}]); }
function invRenderAttach(){ const box=$('#invAttachList'); if(!box) return; const cnt=$('#invAttachCount'); if(cnt) cnt.textContent=_invAttach.length?('('+_invAttach.length+')'):'';
  box.innerHTML=_invAttach.map((a,i)=>{ const isImg=a.type&&a.type.indexOf('image/')===0; const thumb=isImg?`<img src="${a.data}" alt="">`:`<span class="att-file">${a.type&&a.type.indexOf('pdf')>=0?'PDF':'📄'}</span>`; return `<div class="att-item"><button class="att-open" onclick="invOpenAttach(${i})">${thumb}<span class="att-name" title="${esc(a.name)}">${esc(a.name)}</span></button><button class="btn sm btn-danger" onclick="invRemoveAttach(${i})">×</button></div>`; }).join('');
}
/* ---------- Live Preview ---------- */
function receiptHTMLPreview(inv){ const html=receiptHTML(inv); return html.replace(/class="receipt"/,'class="receipt"'); }
/* ---------- Audit History (per invoice) ---------- */
function invAuditHistory(kind){
  const ref=_invEditId; if(!ref){ toast(t('لم تُحفظ الفاتورة بعد','Invoice not saved yet')); return; }
  const all=DB.get('audit').filter(a=>a.ref===ref).sort((a,b)=>(b.time||'').localeCompare(a.time||''));
  const rows=all.length?all.map(a=>`<div class="audit-hist-row"><div class="ah-top"><b>${esc(a.action||'')}</b> <span class="ah-time">${fmtDateTime(a.time)}</span></div><div class="ah-user">${esc(a.user||'')}</div>${a.details?`<div class="ah-detail">${esc(a.details)}</div>`:''}${a.changes&&a.changes.length?`<div class="audit-changes">${a.changes.map(c=>`${esc(c.label||c.field||'')}: ${esc(String(c.old??''))} → ${esc(String(c.new??''))}`).join('<br>')}</div>`:''}</div>`).join('') : `<div class="empty">${t('لا يوجد سجل لهذه الفاتورة','No history for this invoice')}</div>`;
  openModal(t('سجل العمليات','Audit History')+' '+(DB.get(kind==='sale'?'invoices':kind==='purchase'?'purchases':'purchaseOrders').find(x=>x.id===ref)||{}).code||'', `<div class="audit-hist">${rows}</div>`, [{label:t('إغلاق','Close'),cls:'btn',onClick:closeModal}]);
}

