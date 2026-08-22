// ─── STATE ──────────────────────────────────────────────────────────────────
let state = {
  wards: [],            // list of { studentId } this login can view
  currentStudentId: null,
  currentStudent: null, // full record for the ward currently on screen (used for printing)
  schoolInfo: { schoolName: '', currentTerm: '' },
};

// ─── HELPERS (same formulas as the main Ledger app, kept in sync) ──────────────
const fmt = n => `GH₡${Number(n||0).toLocaleString('en-NG',{minimumFractionDigits:2,maximumFractionDigits:2})}`;
const clamp = (v,lo,hi) => Math.min(Math.max(v,lo),hi);
const pct = (paid,req) => req > 0 ? Math.round(clamp(paid/req*100,0,100)) : (paid > 0 ? 100 : 0);
const initials = name => name ? name.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase() : '?';

const customFeesTotal = s => (s.customFees||[]).reduce((sum,cf)=>sum+(cf.required||0),0);
const customFeesPaid  = s => (s.customFees||[]).reduce((sum,cf)=>sum+(cf.paid||0),0);
const totalRequired   = s => (s.feeRequired||0)+(s.feedingFeeRequired||0)+(s.examFeeRequired||0)+(s.arrears||0)+customFeesTotal(s);
const totalPaid       = s => (s.feePaid||0)+(s.feedingFeePaid||0)+(s.examFeePaid||0)+(s.arrearsPaid||0)+customFeesPaid(s);
const overallPct      = s => pct(totalPaid(s),totalRequired(s));

function getPaymentStatus(student) {
  const totalReq = totalRequired(student);
  const totalPd  = totalPaid(student);
  if (totalReq === 0) return totalPd > 0 ? 'overpaid' : 'paid';
  const ratio = totalPd / totalReq;
  if (ratio >= 1.0) return ratio > 1.01 ? 'overpaid' : 'paid';
  if (ratio > 0) return 'started';
  return 'zero';
}

const STATUS_META = {
  paid:     { avatar: 'avatar-paid',     name: 'name-paid',     badge: 'status-paid' },
  overpaid: { avatar: 'avatar-overpaid', name: 'name-overpaid', badge: 'status-overpaid' },
  started:  { avatar: 'avatar-started',  name: 'name-started',  badge: 'status-started' },
  zero:     { avatar: 'avatar-unpaid',   name: 'name-unpaid',   badge: 'status-zero' },
};
const STATUS_LABEL_PROFILE = {
  paid:     '✓ All Fees Cleared',
  overpaid: '⊕ Overpaid (Credit Balance)',
  started:  '⟳ Partial Payment Made',
  zero:     '✗ No Payment Made',
};

function paymentTypeLabel(type, customFees) {
  if (type==='feeding') return 'Feeding Fee';
  if (type==='exam')    return 'Exam Fee';
  if (type==='arrears') return 'Arrears';
  if (type && type.startsWith('custom_')) {
    const cf = (customFees||[]).find(c=>c.id===type.slice(7));
    return cf ? cf.label : 'Custom Fee';
  }
  return 'Tuition Fee';
}

function escapeHtml(str) {
  return String(str||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ─── API HELPER ─────────────────────────────────────────────────────────────
async function api(method, path, body) {
  const opts = { method, headers: {}, credentials: 'same-origin' };
  if (body !== undefined) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(path, opts);
  let data = {};
  try { data = await res.json(); } catch {}
  if (!res.ok && !data.error) data.error = 'Something went wrong. Please try again.';
  return data;
}

// ─── TOAST ────────────────────────────────────────────────────────────────────
function showToast(msg, type='success') {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.className = `toast ${type}`;
  toast.classList.remove('hidden');
  clearTimeout(showToast._t);
  showToast._t = setTimeout(()=>toast.classList.add('hidden'), 3200);
}

// ─── PAGE SWITCHING ───────────────────────────────────────────────────────────
function showLogin() {
  document.getElementById('loginPage').classList.add('active');
  document.getElementById('loginPage').classList.remove('hidden');
  document.getElementById('profilePage').classList.add('hidden');
  document.getElementById('profilePage').classList.remove('active');
  document.getElementById('loginPassword').value = '';
  document.getElementById('loginError').classList.add('hidden');
}

function showProfilePage() {
  document.getElementById('loginPage').classList.remove('active');
  document.getElementById('loginPage').classList.add('hidden');
  document.getElementById('profilePage').classList.remove('hidden');
  document.getElementById('profilePage').classList.add('active');
}

// ─── LOGIN ────────────────────────────────────────────────────────────────────
document.getElementById('loginForm').addEventListener('submit', async e => {
  e.preventDefault();
  const username = document.getElementById('loginUsername').value.trim();
  const password = document.getElementById('loginPassword').value;
  const errEl = document.getElementById('loginError');
  errEl.classList.add('hidden');

  if (!username || !password) {
    errEl.textContent = 'Please enter your username and password.';
    errEl.classList.remove('hidden');
    return;
  }

  const data = await api('POST', '/api/login', { username, password });
  if (data.success) {
    state.wards = data.wards || [];
    document.getElementById('welcomeLine').textContent = data.parentName
      ? `Welcome, ${data.parentName}.`
      : 'Welcome.';
    showProfilePage();
    renderWardSwitcher();
    if (state.wards.length) loadWard(state.wards[0].studentId);
  } else {
    errEl.textContent = data.error || 'Invalid username or password.';
    errEl.classList.remove('hidden');
  }
});

// ─── BACK BUTTON ──────────────────────────────────────────────────────────────
document.getElementById('backToLoginBtn').addEventListener('click', async () => {
  await api('POST', '/api/logout');
  state.wards = [];
  state.currentStudentId = null;
  showLogin();
});

// ─── WARD SWITCHER (for parents with more than one child linked) ─────────────
function renderWardSwitcher() {
  const el = document.getElementById('wardSwitcher');
  if (state.wards.length <= 1) {
    el.classList.add('hidden');
    el.innerHTML = '';
    return;
  }
  el.classList.remove('hidden');
  el.innerHTML = state.wards.map(w => `
    <button class="filter-btn${w.studentId===state.currentStudentId?' active':''}" data-ward="${w.studentId}">
      ${escapeHtml(w.name || w.studentId)}
    </button>
  `).join('');
  el.querySelectorAll('[data-ward]').forEach(btn => {
    btn.addEventListener('click', () => loadWard(btn.dataset.ward));
  });
}

// ─── LOAD + RENDER WARD PROFILE (read-only) ──────────────────────────────────
async function loadWard(studentId) {
  state.currentStudentId = studentId;
  renderWardSwitcher();

  const errBanner = document.getElementById('portalErrorBanner');
  const card = document.getElementById('profileCard');
  errBanner.classList.add('hidden');

  const data = await api('GET', `/api/my-student?id=${encodeURIComponent(studentId)}`);
  if (!data.success) {
    card.style.display = 'none';
    errBanner.textContent = data.error || 'Could not load this student\'s record.';
    errBanner.classList.remove('hidden');
    return;
  }

  const s = data.student;
  state.currentStudent = s;
  card.style.display = '';

  const status = getPaymentStatus(s);
  const meta = STATUS_META[status];

  document.getElementById('profileAvatar').textContent = initials(s.name);
  document.getElementById('profileAvatar').className = `profile-avatar ${meta.avatar}`;
  document.getElementById('profileName').textContent = s.name;
  document.getElementById('profileName').className = `profile-name ${meta.name}`;
  document.getElementById('profileId').textContent = s.id;
  document.getElementById('profileClass').textContent = s.className;
  document.getElementById('profileStatusBadge').textContent = STATUS_LABEL_PROFILE[status];
  document.getElementById('profileStatusBadge').className = `payment-status-badge ${meta.badge}`;

  const feeBalance = Math.max(0,(s.feeRequired||0)-(s.feePaid||0));
  const feePctVal  = pct(s.feePaid,s.feeRequired);
  document.getElementById('profileFeeRequired').textContent = fmt(s.feeRequired);
  document.getElementById('profileFeePaid').textContent     = fmt(s.feePaid);
  document.getElementById('profileFeeBalance').textContent  = fmt(feeBalance);
  document.getElementById('feeProgress').style.width        = feePctVal+'%';
  document.getElementById('feeProgress').className          = `progress-fill${feePctVal>=100?' complete':''}`;
  document.getElementById('feePct').textContent              = feePctVal+'%';

  const feedBalance = Math.max(0,(s.feedingFeeRequired||0)-(s.feedingFeePaid||0));
  const feedPctVal  = pct(s.feedingFeePaid,s.feedingFeeRequired);
  document.getElementById('profileFeedingRequired').textContent = fmt(s.feedingFeeRequired);
  document.getElementById('profileFeedingPaid').textContent     = fmt(s.feedingFeePaid);
  document.getElementById('profileFeedingBalance').textContent  = fmt(feedBalance);
  document.getElementById('feedingProgress').style.width        = feedPctVal+'%';
  document.getElementById('feedingPct').textContent             = feedPctVal+'%';
  document.getElementById('feedingFeeCard').style.display       = (s.feedingFeeRequired>0)?'block':'none';

  const examRequired = s.examFeeRequired||0;
  const examPaid     = s.examFeePaid||0;
  const examBalance  = Math.max(0,examRequired-examPaid);
  const examPctVal   = pct(examPaid,examRequired);
  document.getElementById('profileExamRequired').textContent = fmt(examRequired);
  document.getElementById('profileExamPaid').textContent     = fmt(examPaid);
  document.getElementById('profileExamBalance').textContent  = fmt(examBalance);
  document.getElementById('examProgress').style.width        = examPctVal+'%';
  document.getElementById('examPct').textContent             = examPctVal+'%';
  document.getElementById('examFeeCard').style.display       = examRequired>0?'block':'none';

  const arrearsAmt     = s.arrears||0;
  const arrearsPaidAmt = s.arrearsPaid||0;
  const arrearsBalance = Math.max(0,arrearsAmt-arrearsPaidAmt);
  const arrearsPctVal  = pct(arrearsPaidAmt,arrearsAmt);
  document.getElementById('profileArrearsAmount').textContent  = fmt(arrearsAmt);
  document.getElementById('profileArrearsPaid').textContent    = fmt(arrearsPaidAmt);
  document.getElementById('profileArrearsBalance').textContent = fmt(arrearsBalance);
  document.getElementById('arrearsProgress').style.width       = arrearsPctVal+'%';
  document.getElementById('arrearsPct').textContent            = arrearsPctVal+'%';
  document.getElementById('arrearsCard').style.display         = arrearsAmt>0?'block':'none';

  const customFees = s.customFees||[];
  const customFeesContainer = document.getElementById('customFeeCards');
  if (customFees.length > 0) {
    customFeesContainer.innerHTML = customFees.map(cf => {
      const cfBalance = Math.max(0,(cf.required||0)-(cf.paid||0));
      const cfPct     = pct(cf.paid||0,cf.required||0);
      return `
      <div class="fee-card">
        <div class="fee-card-label">${escapeHtml(cf.label)}</div>
        <div class="fee-amounts">
          <div><div class="fee-small">Required</div><div class="fee-amount">${fmt(cf.required)}</div></div>
          <div><div class="fee-small">Paid</div><div class="fee-amount paid">${fmt(cf.paid||0)}</div></div>
          <div><div class="fee-small">Balance</div><div class="fee-amount balance">${fmt(cfBalance)}</div></div>
        </div>
        <div class="progress-wrap">
          <div class="progress-bar"><div class="progress-fill custom-fee-fill${cfPct>=100?' complete':''}" style="width:${cfPct}%"></div></div>
          <span class="progress-pct">${cfPct}%</span>
        </div>
      </div>`;
    }).join('');
    customFeesContainer.style.display = '';
  } else {
    customFeesContainer.innerHTML = '';
    customFeesContainer.style.display = 'none';
  }

  const op = overallPct(s);
  document.getElementById('overallProgress').style.width = op+'%';
  document.getElementById('overallPct').textContent      = op+'%';
  document.getElementById('overallProgress').classList.toggle('overpaid', status === 'overpaid');

  const payments = (s.payments||[]).slice().reverse();
  document.getElementById('paymentHistoryList').innerHTML = payments.length
    ? payments.map(p => {
        const typeLabel = paymentTypeLabel(p.type, s.customFees||[]);
        const typeClass = p.type.startsWith('custom_') ? 'custom' : p.type;
        return `
        <div class="history-item">
          <div class="history-left">
            <div class="history-type ${typeClass}">${typeLabel}</div>
            <div class="history-desc">${escapeHtml(p.description)||'—'}</div>
          </div>
          <div class="history-right">
            <div class="history-amount">+${fmt(p.amount)}</div>
            <div class="history-date">${new Date(p.date).toLocaleDateString('en-GB')}</div>
            <div class="history-by">by ${escapeHtml(p.recordedBy)}</div>
          </div>
        </div>`;
      }).join('')
    : '<p style="color:var(--text3);font-size:13px;">No payments recorded yet.</p>';
}

// ─── PRINT STATEMENT ──────────────────────────────────────────────────────────
function isFullyPaid(student) {
  const status = getPaymentStatus(student);
  return status === 'paid' || status === 'overpaid';
}

function buildStatementHTML(s) {
  const term       = state.schoolInfo.currentTerm || '';
  const schoolName = state.schoolInfo.schoolName || '';
  const date = new Date().toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'});
  const payments = (s.payments||[]).slice().reverse();
  const feeBalance     = Math.max(0,(s.feeRequired||0)-(s.feePaid||0));
  const feedBalance    = Math.max(0,(s.feedingFeeRequired||0)-(s.feedingFeePaid||0));
  const examBalance    = Math.max(0,(s.examFeeRequired||0)-(s.examFeePaid||0));
  const arrearsBalance = Math.max(0,(s.arrears||0)-(s.arrearsPaid||0));
  const totalReq = totalRequired(s);
  const totalPd  = totalPaid(s);
  const totalBal = Math.max(0,totalReq-totalPd);
  const op       = overallPct(s);
  const status   = getPaymentStatus(s);
  const paid     = isFullyPaid(s);

  const summaryRows = [
    ['Tuition Fee',fmt(s.feeRequired||0),fmt(s.feePaid||0),fmt(feeBalance)],
    s.feedingFeeRequired>0?['Feeding Fee',fmt(s.feedingFeeRequired),fmt(s.feedingFeePaid||0),fmt(feedBalance)]:null,
    (s.examFeeRequired||0)>0?['Exam Fee',fmt(s.examFeeRequired),fmt(s.examFeePaid||0),fmt(examBalance)]:null,
    (s.arrears||0)>0?['Arrears',fmt(s.arrears),fmt(s.arrearsPaid||0),fmt(arrearsBalance)]:null,
    ...(s.customFees||[]).map(cf=>{const cfBal=Math.max(0,(cf.required||0)-(cf.paid||0));return[escapeHtml(cf.label),fmt(cf.required),fmt(cf.paid||0),fmt(cfBal)];}),
  ].filter(Boolean);

  const summaryHTML = summaryRows.map(([label,req,pd,bal])=>`<tr><td>${label}</td><td class="amount-cell">${req}</td><td class="amount-cell">${pd}</td><td class="amount-cell ${bal===fmt(0)?'stmt-cleared':'stmt-owed'}">${bal}</td></tr>`).join('');
  const historyHTML = payments.length
    ? payments.map(p=>{
        const typeLabel = paymentTypeLabel(p.type,s.customFees||[]);
        return `<tr><td>${new Date(p.date).toLocaleDateString('en-GB')}</td><td>${typeLabel}</td><td>${escapeHtml(p.description)||'—'}</td><td>${escapeHtml(p.recordedBy)}</td><td class="amount-cell stmt-green">+${fmt(p.amount)}</td></tr>`;
      }).join('')
    : `<tr><td colspan="5" style="text-align:center;color:#888;padding:16px;">No payments recorded.</td></tr>`;

  return `
  <div class="stmt-page">
    <div class="stmt-header">
      <div class="stmt-logo">₡</div>
      <div class="stmt-school-info"><div class="stmt-title"><span style="color:#8f6060">${escapeHtml(schoolName)}</span><br>Fee Statement</div><div class="stmt-term">${escapeHtml(term)}</div></div>
      <div class="stmt-date">Printed: ${date}</div>
    </div>
    <div class="stmt-divider"></div>
    <div class="stmt-student-block">
      <div class="stmt-student-name">${escapeHtml(s.name)}</div>
      <div class="stmt-student-meta">${escapeHtml(s.id)} &nbsp;·&nbsp; <p>Class: ${escapeHtml(s.className)}</p></div>
      <div class="stmt-status ${paid?'stmt-status-paid':'stmt-status-owing'}">${paid?(status==='overpaid'?'⊕ Overpaid (Credit Balance)':'✓ All Fees Cleared'):'⚠ Fees Outstanding'}</div>
    </div>
    <h3 class="stmt-section-title">Fee Summary</h3>
    <table class="stmt-table"><thead><tr><th>Fee Type</th><th class="amount-cell">Required</th><th class="amount-cell">Paid</th><th class="amount-cell">Balance</th></tr></thead><tbody>${summaryHTML}</tbody>
    <tfoot><tr class="stmt-total-row"><td><strong>Total</strong></td><td class="amount-cell">${fmt(totalReq)}</td><td class="amount-cell">${fmt(totalPd)}</td><td class="amount-cell ${totalBal===0?'stmt-cleared':'stmt-owed'}">${fmt(totalBal)}</td></tr></tfoot></table>
    <div class="stmt-overall"><span>Overall Payment Completion:</span><strong>${op}%</strong></div>
    <h3 class="stmt-section-title" style="margin-top:24px;">Payment History</h3>
    <table class="stmt-table"><thead><tr><th>Date</th><th>Type</th><th>Description</th><th>Recorded By</th><th class="amount-cell">Amount</th></tr></thead><tbody>${historyHTML}</tbody></table>
  </div>`;
}

document.getElementById('printStatementBtn').addEventListener('click', () => {
  if (!state.currentStudent) { showToast('Nothing to print yet.','error'); return; }
  document.getElementById('printArea').innerHTML = buildStatementHTML(state.currentStudent);
  window.print();
});

// ─── INIT ─────────────────────────────────────────────────────────────────────
async function loadSchoolName() {
  const data = await api('GET', '/api/school-name');
  state.schoolInfo.schoolName  = (data && data.schoolName) || 'School';
  state.schoolInfo.currentTerm = (data && data.currentTerm) || '';
  document.getElementById('loginFooterSchoolName').textContent = state.schoolInfo.schoolName;
  document.getElementById('topbarSchoolName').textContent = state.schoolInfo.schoolName;
}

async function init() {
  await loadSchoolName();
  const me = await api('GET', '/api/me');
  if (me.success) {
    state.wards = me.wards || [];
    document.getElementById('welcomeLine').textContent = me.parentName
      ? `Welcome, ${me.parentName}.`
      : 'Welcome.';
    showProfilePage();
    renderWardSwitcher();
    if (state.wards.length) loadWard(state.wards[0].studentId);
  } else {
    showLogin();
  }
}
init();
