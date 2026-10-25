/* attendance.js — check-in/out, status rules, work hours, summaries */
(function () {
  const HS = window.HS, S = HS.Storage, U = HS.Util, K = HS.KEYS;

  HS.Attendance = {
    isWorkingDate(date) { const c = S.getCompany(); return ((c && c.workingDays) || [1, 2, 3, 4, 5]).indexOf(date.getDay()) !== -1; },
    isWorkingISO(iso) { const d = U.parseISO(iso); return !!d && this.isWorkingDate(d); },
    all() { return S.attendance(); },
    forEmployee(id) { return S.attendance().filter(r => r.employeeId === id); },
    get(id, iso) { return S.attendance().find(r => r.employeeId === id && r.date === iso) || null; },
    lateLimitMin() { const c = S.getCompany(); return U.toMin(c.startTime) + Number(c.graceMinutes || 0); },
    hours(rec) { return rec && rec.checkOut ? Math.max(0, (U.toMin(rec.checkOut) - U.toMin(rec.checkIn)) / 60) : 0; },

    checkIn(empId) {
      const iso = U.today();
      if (!this.isWorkingISO(iso)) return { ok: false, error: 'Today is not a working day.' };
      if (this.get(empId, iso)) return { ok: false, error: 'You have already checked in today.' };
      const t = U.nowHM(), late = U.toMin(t) > this.lateLimitMin();
      const rec = { id: U.uid(), employeeId: empId, date: iso, checkIn: t, checkOut: '', status: late ? 'Late' : 'Present', late };
      S.add(K.attendance, rec);
      return { ok: true, record: rec };
    },

    checkOut(empId) {
      const rec = this.get(empId, U.today());
      if (!rec) return { ok: false, error: 'Check in first, then check out.' };
      if (rec.checkOut) return { ok: false, error: 'You have already checked out today.' };
      const t = U.nowHM(), hrs = Math.max(0, (U.toMin(t) - U.toMin(rec.checkIn)) / 60);
      const status = hrs < 5 ? 'Half Day' : (rec.late ? 'Late' : 'Present');
      return { ok: true, record: S.update(K.attendance, rec.id, { checkOut: t, status }) };
    },

    /* Status of one employee on one date, using the Admin's settings. */
    statusFor(emp, iso) {
      const rec = this.get(emp.id, iso), today = U.today();
      if (rec) return rec.status;
      if (iso < (emp.joined || '')) return 'Before joining';
      if (!this.isWorkingISO(iso)) return 'Non-working day';
      if (HS.Leave.isOnLeave(emp.id, iso)) return 'On Leave';
      if (iso > today) return 'Upcoming';
      if (iso === today) return 'Not checked in';
      return 'Absent';
    },

    weekStartISO() {
      const d = new Date(); d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
      return U.toISO(d);
    },
    hoursThisWeek(empId) {
      const from = this.weekStartISO(), to = U.today();
      return this.forEmployee(empId).filter(r => r.date >= from && r.date <= to).reduce((s, r) => s + this.hours(r), 0);
    },

    /* ym = 'YYYY-MM'. Counts working days only; today and future days are never counted absent. */
    monthSummary(emp, ym) {
      const [y, m] = ym.split('-').map(Number), n = new Date(y, m, 0).getDate();
      const o = { workingDays: 0, present: 0, late: 0, half: 0, absent: 0, onLeave: 0 };
      for (let d = 1; d <= n; d++) {
        const iso = ym + '-' + U.pad(d);
        if (!this.isWorkingISO(iso)) continue;
        o.workingDays++;
        const s = this.statusFor(emp, iso);
        if (s === 'Present') o.present++; else if (s === 'Late') o.late++; else if (s === 'Half Day') o.half++;
        else if (s === 'Absent') o.absent++; else if (s === 'On Leave') o.onLeave++;
      }
      return o;
    },

    /* Newest-first day list for the employee's own attendance table. */
    recentDays(emp, count) {
      const rows = [], d = new Date();
      for (let i = 0; i < count; i++) {
        const iso = U.toISO(d);
        if (iso < (emp.joined || '')) break;
        const st = this.statusFor(emp, iso);
        if (st !== 'Non-working day' || this.get(emp.id, iso)) rows.push({ date: iso, rec: this.get(emp.id, iso), status: st });
        d.setDate(d.getDate() - 1);
      }
      return rows;
    }
  };
})();