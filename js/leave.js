/* leave.js — apply, validate, approve/reject, balances */
(function () {
  const HS = window.HS, S = HS.Storage, U = HS.Util, K = HS.KEYS;

  HS.Leave = {
    TYPES: ['Casual', 'Sick', 'Annual'],
    all() { return S.leaves(); },
    forEmployee(id) { return S.leaves().filter(l => l.employeeId === id); },
    quota() { const c = S.getCompany(); return Number(c && c.leaveQuota) || 0; },

    /* ISO dates between from and to that are working days (weekends / non-working days skipped). */
    workingDates(from, to) {
      const a = U.parseISO(from), b = U.parseISO(to), out = [];
      if (!a || !b || a > b) return out;
      for (let d = new Date(a); d <= b; d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1))
        if (HS.Attendance.isWorkingDate(d)) out.push(U.toISO(d));
      return out;
    },
    byYear(dates) { const o = {}; dates.forEach(s => { const y = s.slice(0, 4); o[y] = (o[y] || 0) + 1; }); return o; },

    /* Approved working days used in a calendar year (pending and rejected never count). */
    usedDays(empId, year, excludeId) {
      return this.forEmployee(empId).filter(l => l.status === 'Approved' && l.id !== excludeId)
        .reduce((s, l) => s + this.workingDates(l.from, l.to).filter(x => x.slice(0, 4) === String(year)).length, 0);
    },
    balance(empId, year) {
      year = year || String(new Date().getFullYear());
      const quota = this.quota(), used = this.usedDays(empId, year);
      return { year, quota, used, remaining: Math.max(0, quota - used) };
    },
    isOnLeave(empId, iso) { return S.leaves().some(l => l.employeeId === empId && l.status === 'Approved' && l.from <= iso && iso <= l.to); },

    quotaError(empId, dates, excludeId) {
      const by = this.byYear(dates);
      for (const y of Object.keys(by)) {
        const used = this.usedDays(empId, y, excludeId), left = Math.max(0, this.quota() - used);
        if (by[y] > left) return 'Needs ' + by[y] + ' working day(s) in ' + y + ' but only ' + left + ' of ' + this.quota() + ' remain.';
      }
      return '';
    },

    validate(empId, d) {
      const errors = {};
      if (!d.type || this.TYPES.indexOf(d.type) === -1) errors.type = 'Choose a leave type.';
      const from = U.parseISO(d.from), to = U.parseISO(d.to);
      if (!d.from) errors.from = 'From date is required.'; else if (!from) errors.from = 'Enter a valid date.';
      if (!d.to) errors.to = 'To date is required.'; else if (!to) errors.to = 'Enter a valid date.';
      if (!(d.reason || '').trim()) errors.reason = 'Reason is required.';
      if (from && to) {
        if (from > to) errors.to = 'To date must be on or after the From date.';
        else {
          const dates = this.workingDates(d.from, d.to);
          if (!dates.length) errors.to = 'These dates contain no working days.';
          else if (this.forEmployee(empId).some(l => l.status !== 'Rejected' && d.from <= l.to && d.to >= l.from))
            errors.from = 'This overlaps another leave request (' + 'pending or approved).';
          else { const q = this.quotaError(empId, dates); if (q) errors.to = q; }
        }
      }
      return errors;
    },

    apply(empId, d) {
      const errors = this.validate(empId, d);
      if (Object.keys(errors).length) return { ok: false, errors };
      const leave = { id: U.uid(), employeeId: empId, type: d.type, from: d.from, to: d.to, days: this.workingDates(d.from, d.to).length,
        reason: d.reason.trim(), status: 'Pending', comment: '', appliedOn: U.today() };
      S.add(K.leaves, leave);
      return { ok: true, leave };
    },

    decide(id, status, comment) {
      const l = S.leaves().find(x => x.id === id);
      if (!l) return { ok: false, error: 'Leave request not found.' };
      if (l.status !== 'Pending') return { ok: false, error: 'This request was already ' + l.status.toLowerCase() + '.' };
      if (status === 'Approved') {
        const q = this.quotaError(l.employeeId, this.workingDates(l.from, l.to), id);
        if (q) return { ok: false, error: 'Cannot approve: ' + q };
      }
      return { ok: true, leave: S.update(K.leaves, id, { status, comment: (comment || '').trim(), decidedOn: U.today() }) };
    }
  };
})();