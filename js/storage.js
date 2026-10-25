/* storage.js — shared localStorage helpers + small utilities used by every page */
(function () {
  const HS = (window.HS = window.HS || {});
  const K = (HS.KEYS = {
    company: 'alh_company', users: 'alh_users', attendance: 'alh_attendance',
    leaves: 'alh_leaves', session: 'alh_session'
  });

  HS.Storage = {
    read(key, fallback) {
      try {
        const raw = localStorage.getItem(key);
        if (raw === null) return fallback;
        const v = JSON.parse(raw);
        return v === null || v === undefined ? fallback : v;
      } catch (e) { return fallback; }
    },
    write(key, value) { localStorage.setItem(key, JSON.stringify(value)); },
    remove(key) { localStorage.removeItem(key); },
    list(key) { const v = this.read(key, []); return Array.isArray(v) ? v : []; },
    add(key, rec) { const l = this.list(key); l.push(rec); this.write(key, l); return rec; },
    update(key, id, changes) {
      const l = this.list(key); const i = l.findIndex(r => r.id === id);
      if (i < 0) return null;
      l[i] = Object.assign({}, l[i], changes); this.write(key, l); return l[i];
    },
    removeById(key, id) { this.write(key, this.list(key).filter(r => r.id !== id)); },
    getCompany() { return this.read(K.company, null); },
    saveCompany(c) { this.write(K.company, c); },
    users() { return this.list(K.users); },
    attendance() { return this.list(K.attendance); },
    leaves() { return this.list(K.leaves); },
    getSession() { return this.read(K.session, null); },
    setSession(s) { this.write(K.session, s); },
    clearSession() { this.remove(K.session); }
  };

  const pad = n => String(n).padStart(2, '0');
  HS.Util = {
    DAYS: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    pad,
    uid() { return Date.now() * 1000 + Math.floor(Math.random() * 1000); },
    toISO(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); },
    parseISO(s) {
      const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || '');
      if (!m) return null;
      const d = new Date(+m[1], +m[2] - 1, +m[3]);
      return d.getFullYear() === +m[1] && d.getMonth() === +m[2] - 1 && d.getDate() === +m[3] ? d : null;
    },
    today() { return this.toISO(new Date()); },
    nowHM() { const d = new Date(); return pad(d.getHours()) + ':' + pad(d.getMinutes()); },
    toMin(hm) { const p = String(hm || '0:0').split(':'); return (+p[0]) * 60 + (+p[1]); },
    fmtDate(iso) {
      const d = this.parseISO(iso);
      return d ? d.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' }) : '';
    },
    fmtTime(hm) {
      if (!hm) return '—';
      const [h, m] = hm.split(':').map(Number);
      return ((h % 12) || 12) + ':' + pad(m) + ' ' + (h < 12 ? 'AM' : 'PM');
    },
    money(n) { return Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }); },
    isEmail(s) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s || '').trim()); },
    esc(s) {
      return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    },
    badge(status) {
      const map = { Present: 'ok', Approved: 'ok', Late: 'warn', Pending: 'warn', 'Half Day': 'warn', Absent: 'err', Rejected: 'err', 'On Leave': 'info' };
      return '<span class="badge ' + (map[status] || '') + '">' + HS.Util.esc(status) + '</span>';
    },
    /* Show field-level errors next to inputs. errors = { fieldName: message, _form: message } */
    setErrors(form, errors) {
      form.querySelectorAll('.err').forEach(e => { e.textContent = ''; });
      form.querySelectorAll('.invalid').forEach(e => { e.classList.remove('invalid'); e.removeAttribute('aria-invalid'); });
      let first = null;
      Object.keys(errors || {}).forEach(name => {
        const slot = form.querySelector('.err[data-for="' + name + '"]');
        if (slot) slot.textContent = errors[name];
        const input = form.querySelector('[name="' + name + '"]');
        if (input && name !== '_form') { input.classList.add('invalid'); input.setAttribute('aria-invalid', 'true'); if (!first) first = input; }
      });
      if (first) first.focus();
      return Object.keys(errors || {}).length === 0;
    },
    toast(msg, type) {
      let box = document.getElementById('toasts');
      if (!box) { box = document.createElement('div'); box.id = 'toasts'; box.setAttribute('role', 'status'); document.body.appendChild(box); }
      const t = document.createElement('div');
      t.className = 'toast' + (type === 'error' ? ' error' : '');
      t.textContent = msg; box.appendChild(t);
      setTimeout(() => t.remove(), 3500);
    }
  };
})();