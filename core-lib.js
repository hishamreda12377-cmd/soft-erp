/* Nexus ERP — Core Library (loaded first)
 * - CFG: centralized constants (accounts, methods, keys)
 * - DEC: decimal-precision money math (no floating-point drift)
 * - validate(): lightweight schema validation layer
 * - logAudit(): expanded audit log (type + old/new values)
 */
'use strict';
/* ============================ CONFIG / CONSTANTS ============================ */
const CFG = {
  ACC: {
    CASH:'acc_cash', BANK:'acc_bank', INVENTORY:'acc_inventory',
    RECEIVABLE:'acc_receivable', PAYABLE:'acc_payable',
    COGS:'acc_cogs', SALES:'acc_sales', SALES_RET:'acc_sales_ret',
    PURCHASES:'acc_purchases', EXPENSES:'acc_expenses', CAPITAL:'acc_capital',
    VAT_IN:'acc_vat_in', VAT_OUT:'acc_vat_out', ADJUST:'acc_adjust', LOSS:'acc_loss',
    DEPRECIATION_EXP:'acc_depreciation_exp', FA_DEP:'acc_fa_dep'
  },
  COSTING: { FIFO:'fifo', AVG:'avg' },
  PAY: { CASH:'cash', CREDIT:'credit' },
  INV: { SALE:'sale', PURCHASE:'purchase', PO:'po' },
  AUDIT: { ADD:'add', EDIT:'edit', DELETE:'delete', LOGIN:'login', SYNC:'sync', OTHER:'other' },
  GLOBAL_KEYS: ['companies','users','settings','branches','audit'],
  MONEY_DP: 2
};

/* ============================ DECIMAL MONEY MATH ============================ */
/* Avoids floating-point errors (0.1+0.2 !== 0.3) that break journal balance. */
const DEC = {
  _n(v){ const x = Number(v); return isFinite(x) ? x : 0; },
  /* round to fixed decimal places using integer arithmetic */
  round(v, dp){ dp = (dp==null) ? CFG.MONEY_DP : dp; const f = Math.pow(10, dp); const n = DEC._n(v); return Math.round((n + (n >= 0 ? 1e-9 : -1e-9)) * f) / f; },
  add(){ let s = 0; for (let i=0;i<arguments.length;i++) s += DEC._n(arguments[i]); return DEC.round(s); },
  sub(a,b){ return DEC.round(DEC._n(a) - DEC._n(b)); },
  mul(a,b){ return DEC.round(DEC._n(a) * DEC._n(b)); },
  div(a,b){ const d = DEC._n(b); if (d === 0) return 0; return DEC.round(DEC._n(a) / d); },
  sum(arr, key){ let s = 0; const a = arr || []; for (let i=0;i<a.length;i++){ s += DEC._n(key ? a[i][key] : a[i]); } return DEC.round(s); },
  /* absolute difference, safe for balance checks */
  diff(a,b){ return DEC.round(DEC._n(a) - DEC._n(b)); },
  /* true if |a-b| <= tolerance (default 0.01) */
  eq(a,b, tol){ tol = (tol==null) ? 0.01 : tol; return Math.abs(DEC._n(a) - DEC._n(b)) <= tol; }
};

/* ============================ VALIDATION LAYER ============================ */
/* Lightweight schema validation. Returns {ok, errors:[{field,msg}]}. */
const Validate = {
  num(v){ const n = Number(v); return isFinite(n) ? n : null; },
  schema(defs, obj){
    const errors = [];
    for (const f in defs){
      const rule = defs[f];
      const val = obj ? obj[f] : undefined;
      const label = rule.label || f;
      if (rule.required && (val === undefined || val === null || val === '')){
        errors.push({ field: f, msg: t(label,'') + ' ' + t('مطلوب','required') });
        continue;
      }
      if (val === undefined || val === null || val === '') continue;
      if (rule.type === 'number'){
        const n = Validate.num(val);
        if (n === null){ errors.push({ field: f, msg: label + ' ' + t('يجب أن يكون رقماً','must be a number') }); continue; }
        if (rule.min != null && n < rule.min) errors.push({ field: f, msg: label + ' ' + t('لا يمكن أن يكون أقل من','cannot be less than') + ' ' + rule.min });
        if (rule.max != null && n > rule.max) errors.push({ field: f, msg: label + ' ' + t('لا يمكن أن يكون أكثر من','cannot be more than') + ' ' + rule.max });
      }
      if (rule.type === 'date'){
        const d = new Date(val);
        if (isNaN(d.getTime())) { errors.push({ field: f, msg: label + ' ' + t('تاريخ غير صالح','invalid date') }); continue; }
        if (rule.notFuture && d.getTime() > Date.now() + 86400000) errors.push({ field: f, msg: label + ' ' + t('لا يمكن أن يكون تاريخاً مستقبلياً','cannot be a future date') });
      }
      if (rule.type === 'string' && rule.maxLen != null && String(val).length > rule.maxLen) errors.push({ field: f, msg: label + ' ' + t('طويل جداً','too long') });
    }
    return { ok: errors.length === 0, errors };
  },
  /* show all errors as a single toast; returns ok */
  report(res){
    if (res.ok) return true;
    toast('⚠️ ' + res.errors.map(e => e.msg).join(' • '));
    return false;
  }
};

/* ============================ AUDIT LOG (expanded) ============================ */
/* Entry shape: {id, time, user, action, type, ref, details, changes:[{field,label,old,new}]} */
function logAudit(action, details, opts){
  opts = opts || {};
  try{
    const list = DB.get('audit');
    list.unshift({
      id: uid(),
      time: nowISO(),
      user: (currentUser && currentUser.name) || t('النظام','System'),
      action: action,
      type: opts.type || CFG.AUDIT.OTHER,
      ref: opts.ref || null,
      details: details || '',
      changes: Array.isArray(opts.changes) ? opts.changes : null
    });
    if (list.length > 2000) list.length = 2000;
    DB.set('audit', list);
  }catch(e){}
}

/* Build a changes array by diffing two plain objects over a field->label map. */
function diffChanges(before, after, labels){
  const out = [];
  const keys = Object.keys(labels || {});
  keys.forEach(k => {
    const a = before ? before[k] : undefined;
    const b = after ? after[k] : undefined;
    if (String(a) !== String(b)) out.push({ field:k, label: labels[k], old:a, new:b });
  });
  if (!out.length) return null;
  return out;
}

/* ============================ BACKUP (export / import / auto) ============================ */
const Backup = {
  KEY_PREFIX: 'erp_',
  export(){ const out = { app:'NexusERP', version:1, exportedAt: new Date().toISOString(), data: collectState() }; return JSON.stringify(out, null, 2); },
  download(){ downloadFile('nexus-backup-' + new Date().toISOString().slice(0,10) + '.json', Backup.export(), 'application/json'); const s = DB.getOne('settings') || {}; s.lastBackup = new Date().toISOString(); DB.setOne('settings', s); logAudit(t('نسخة احتياطية','Backup'), t('تصدير','Export'), {type:CFG.AUDIT.SYNC}); toast(t('تم تصدير النسخة الاحتياطية','Backup exported')); },
  import(text){ try{ const obj = JSON.parse(text); if(!obj || !obj.data) throw 0; applyState(obj.data); const s = DB.getOne('settings') || {}; s.lastBackup = new Date().toISOString(); DB.setOne('settings', s); logAudit(t('نسخة احتياطية','Backup'), t('استيراد','Import'), {type:CFG.AUDIT.SYNC}); boot(); toast(t('تم الاستيراد','Imported')); return true; }catch(e){ toast(t('ملف النسخة غير صالح','Invalid backup file')); return false; } },
  pickAndImport(){ const inp = document.createElement('input'); inp.type='file'; inp.accept='.json'; inp.onchange = async () => { if(!inp.files[0]) return; const txt = await readFileAsText(inp.files[0]); if(Backup.import(txt)) renderScreen(currentScreenId()); }; inp.click(); },
  daysSince(){ const s = DB.getOne('settings') || {}; if(!s.lastBackup) return 999; return Math.floor((Date.now() - new Date(s.lastBackup).getTime()) / 86400000); },
  remindIfOld(maxDays){ const d = Backup.daysSince(); if(d >= maxDays){ setTimeout(()=>toast('⚠️ '+d+' '+t('يوماً على آخر نسخة احتياطية — يُنصح بالتصدير','days since backup — please export')), 1500); } }
};

