/* ============================================================
   Nexus ERP — HTML Templates & SVG Generators
   Pure HTML string builders (no business logic).
   ============================================================ */
'useuse strict';

/* --- Page layout partials --- */
function pageHead(title, opts){ opts=opts||{}; const ico=opts.icon?`<div class="page-head-ico">${opts.icon}</div>`:''; const sub=opts.sub?`<div class="page-head-sub">${esc(opts.sub)}</div>`:''; const actions=opts.actions?`<div class="page-head-actions">${opts.actions}</div>`:'';
  return `<div class="page-head">${ico}<div class="page-head-text"><h2>${esc(title)}</h2>${sub}</div>${actions}</div>`; }

function panel(opts){ opts=opts||{}; const head=(opts.title||opts.tools)?`<div class="panel-head">${opts.title?`<h3>${esc(opts.title)}</h3>`:''}${opts.tools?`<div class="panel-tools">${opts.tools}</div>`:''}</div>`:'';
  return `<section class="panel${opts.flush?' panel-flush':''}">${head}<div class="panel-body">${opts.body||''}</div></section>`; }

function panelTable(opts){ return panel(Object.assign({}, opts, {body: opts.body})); }

/* --- SVG generators --- */
function qrSVG(text){ try{ if(typeof qrcode==='function'){ const qr=qrcode(0,'M'); qr.addData(String(text)); qr.make(); return qr.createSvgTag({cellSize:3, margin:4}); } }catch(e){} return `<div class="qr-fallback">${esc(text)}</div>`; }

function barSVG(text){ if(!String(text||'')) return ''; let s=String(text); let x=0; let seed=s.split('').reduce((a,c)=>a+c.charCodeAt(0),0); const rnd=()=>{ seed=Math.sin(seed)*10000; return seed-Math.floor(seed); }; let inner=''; for(let i=0;i<s.length;i++){ const w=1+Math.floor(rnd()*3); inner+='<rect x="'+x+'" y="0" width="'+w+'" height="40" fill="#000"></rect>'; x+=w+(1+Math.floor(rnd()*2)); } return '<svg viewBox="0 0 '+x+' 40" xmlns="http://www.w3.org/2000/svg"><rect x="0" y="0" width="'+x+'" height="40" fill="#fff"></rect>'+inner+'</svg>'; }

/* --- Receipt HTML (invoice print) --- */
function receiptHTML(inv){ const comp=currentCompany()||{}; const s=DB.getOne('settings')||{}; const logo=s.logo||comp.logo||''; const taxNo=s.taxNumber||comp.taxNo||''; const cust=DB.get('customers').find(c=>c.id===inv.customerId); const phone=cust?c.phone:''; return `<div class="receipt">
  ${logo?`<div class="r-logo"><img src="${logo}" alt="logo"></div>`:''}
  <h3 class="r-title">${esc(comp.name||s.companyName||'')}</h3>
  ${comp.address?`<div class="r-sub">${esc(comp.address)}</div>`:''}
  ${taxNo?`<div class="r-sub">${t('الرقم الضريبي','Tax No')}: ${esc(taxNo)}</div>`:''}
  <hr>
  <div class="r-row"><span>${t('فاتورة','Invoice')}</span><span>${esc(inv.code)}</span></div>
  <div class="r-row"><span>${t('التاريخ','Date')}</span><span>${fmtDateTime(inv.createdAt)}</span></div>
  <div class="r-row"><span>${t('العميل','Customer')}</span><span>${esc(inv.customerName||'—')}</span></div>
  ${phone?`<div class="r-row"><span>${t('الهاتف','Phone')}</span><span>${esc(phone)}</span></div>`:''}
  ${inv.payment==='credit'?`<div class="r-row"><span>${t('الدفع','Payment')}</span><span>${t('آجل','Credit')}</span></div>`:''}
  <hr>
  <div class="r-item r-head"><span>${t('الصنف','Item')}</span><span>${t('كمية','Qty')} × ${t('سعر','Price')}</span><span>${t('إجمالي','Total')}</span></div>
  ${inv.items.map(i=>`<div class="r-item"><span>${esc(i.name)}</span><span>${fmt(i.qty)} × ${money(i.price)}</span><span>${money((i.price||0)*(i.qty||0))}</span></div>`).join('')}
  <hr>
  <div class="r-row"><span>${t('المجموع الفرعي','Subtotal')}</span><span>${money(inv.subtotal)}</span></div>
  ${inv.discount?`<div class="r-row"><span>${t('خصم','Discount')}</span><span>${money(inv.discount)}</span></div>`:''}
  ${inv.tax?`<div class="r-row"><span>${t('ضريبة','Tax')}</span><span>${money(inv.tax)}</span></div>`:''}
  <div class="r-total"><span>${t('الإجمالي','Total')}</span><span>${money(inv.total)}</span></div>
  <div class="r-row"><span>${t('المدفوع','Paid')}</span><span>${money(inv.paid)}</span></div>
  ${inv.payment==='credit'?`<div class="r-row"><span>${t('المتبقي','Remaining')}</span><span>${money((inv.remaining!=null?inv.remaining:Math.max(0,(inv.total||0)-(inv.paid||0))))}</span></div>`:''}
  <div class="r-row"><span>${t('الباقي','Change')}</span><span>${money(inv.change)}</span></div>
  <hr>
  <div class="r-qr">${qrSVG(inv.code)}</div>
  ${inv.barcode||(inv.items[0]&&inv.items[0].code)?`<div class="r-barcode">${barSVG(inv.barcode||(inv.items[0]&&inv.items[0].code))}</div>`:''}
  ${s.receiptNote?`<div class="r-sub r-foot">${esc(s.receiptNote)}</div>`:''}
`;
}

/* --- Excel export HTML --- */
function tableToExcel(title,headers,rows){ const e2=v=>String(v==null?'':v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); const tbl=`<table border="1" cellspacing="0" cellpadding="4" style="border-collapse:collapse;font-family:Tahoma"><thead><tr style="background:#0974B0;color:#fff">${headers.map(h=>`<th>${e2(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${r.map(c=>`<td>${e2(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`; return `<html dir="${LANG==='en'?'ltr':'rtl'}"><head><meta charset="utf-8"></head><body><h3>${e2(title)}</h3>${tbl}<p>${e2(new Date().toLocaleString())}</p></body></html>`; }

/* --- Three Dots Menu (context menu for mobile) --- */
function threeDotsMenu(id, items){
  return `<div class="three-dots"><button class="three-dots-btn" onclick="event.stopPropagation();document.getElementById('tdm_${id}').classList.toggle('show')">⋯</button><div class="three-dots-menu" id="tdm_${id}">${items.map(i=>`<button onclick="${i.onClick}">${i.icon||''} ${esc(i.label)}</button>`).join('')}</div></div>`;
}
function closeAllMenus(){ document.querySelectorAll('.three-dots-menu.show').forEach(m=>m.classList.remove('show')); }
if(typeof document!=='undefined'){ document.addEventListener('click', closeAllMenus); }

/* --- Date Filter Popover --- */
function dateFilterPop(id, callback){
  return `<div class="date-filter"><button class="btn btn-sm" onclick="event.stopPropagation();document.getElementById('df_${id}').classList.toggle('show')">📅 ${t('التاريخ','Date')}</button><div class="date-filter-pop" id="df_${id}"><div class="df-row"><button class="df-btn" onclick="window['${callback}']('today')">${t('اليوم','Today')}</button><button class="df-btn" onclick="window['${callback}']('yesterday')">${t('أمس','Yesterday')}</button><button class="df-btn" onclick="window['${callback}']('thisMonth')">${t('هذا الشهر','This Month')}</button><button class="df-btn" onclick="window['${callback}']('all')">${t('الكل','All')}</button></div><label>${t('من','From')}<input type="date" id="df_from_${id}" onchange="window['${callback}']('custom')"></label><label>${t('إلى','To')}<input type="date" id="df_to_${id}" onchange="window['${callback}']('custom')"></label></div></div>`;
}
function getDateFilterRange(id){
  const from=(document.getElementById('df_from_'+id)||{}).value||'';
  const to=(document.getElementById('df_to_'+id)||{}).value||'';
  return {from,to};
}
function applyDatePreset(id, preset){
  const now=new Date(); let from='',to=now.toISOString().slice(0,10);
  if(preset==='today'){ from=to; }
  else if(preset==='yesterday'){ const y=new Date(now); y.setDate(y.getDate()-1); from=to=y.toISOString().slice(0,10); }
  else if(preset==='thisMonth'){ from=now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0')+'-01'; }
  else { from=''; to=''; }
  const fEl=document.getElementById('df_from_'+id); const tEl=document.getElementById('df_to_'+id);
  if(fEl) fEl.value=from; if(tEl) tEl.value=to;
}
