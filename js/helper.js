/* helper.js — Smart Helper: keyword matching over real saved data, restricted by role */
(function () {
  const HS = window.HS, U = HS.Util;
  const ADMIN_Q = ['How many employees do we have?', 'Who is on leave today?', 'Who was late today?'];
  const EMP_Q = ['How many leaves do I have left?', 'Was I late today?', 'How many hours did I work this week?'];

  HS.Helper = {
    answer(user, text) {
      const t = (text || '').toLowerCase().trim();
      if (!t) return 'Type a question first.';
      return user.role === 'admin' ? this.admin(t) : this.employee(user, t);
    },

    admin(t) {
      const today = U.today(), staff = HS.Employees.staff();
      if (t.includes('late')) {
        const late = HS.Attendance.all().filter(r => r.date === today && r.late)
          .map(r => ({ r, e: staff.find(s => s.id === r.employeeId) })).filter(x => x.e);
        return late.length ? late.length + ' employee(s) were late today:\n' + late.map(x => x.e.name + ' (checked in ' + U.fmtTime(x.r.checkIn) + ')').join('\n')
          : 'No one has been late today.';
      }
      if (t.includes('leave')) {
        const on = staff.filter(e => HS.Leave.isOnLeave(e.id, today));
        return on.length ? on.length + ' employee(s) on approved leave today:\n' + on.map(e => {
          const l = HS.Leave.forEmployee(e.id).find(x => x.status === 'Approved' && x.from <= today && today <= x.to);
          return e.name + ' (' + l.type + ')';
        }).join('\n') : 'No one is on approved leave today.';
      }
      if (t.includes('employee') || t.includes('staff')) {
        const n = staff.length;
        return 'You have ' + n + ' employee' + (n === 1 ? '' : 's') + ' across ' + HS.Employees.departments().filter(d => staff.some(e => e.department === d)).length + ' department(s).';
      }
      return 'I can answer: ' + ADMIN_Q.join(' · ');
    },

    employee(user, t) {
      if (/\b(employees?|everyone|everybody|colleagues?|coworkers?|team|company|others?|who|anyone)\b/.test(t))
        return 'I can only share your own information, not company or other employees\' data.';
      const today = U.today();
      if (t.includes('hour')) {
        const h = HS.Attendance.hoursThisWeek(user.id), rec = HS.Attendance.get(user.id, today);
        return 'You have worked ' + h.toFixed(1) + ' hours this week (completed check-outs only)' + (rec && !rec.checkOut ? '. You are still checked in today.' : '.');
      }
      if (t.includes('late')) {
        const rec = HS.Attendance.get(user.id, today);
        if (!rec) return 'You have not checked in today yet.';
        return rec.late ? 'Yes. You checked in at ' + U.fmtTime(rec.checkIn) + ', after the allowed time.' : 'No. You checked in on time at ' + U.fmtTime(rec.checkIn) + '.';
      }
      if (t.includes('leave')) {
        const b = HS.Leave.balance(user.id);
        return 'You have ' + b.remaining + ' of ' + b.quota + ' leave days left for ' + b.year + ' (' + b.used + ' approved so far).';
      }
      return 'I can answer: ' + EMP_Q.join(' · ');
    },

    /* Renders the chat box into the element with the given id. */
    mount(id, user) {
      const box = document.getElementById(id), qs = user.role === 'admin' ? ADMIN_Q : EMP_Q;
      box.innerHTML = '<div class="chat-log" role="log" aria-live="polite"></div>' +
        '<form class="chat-form"><label class="sr" for="' + id + 'In" style="position:absolute;left:-9999px">Ask the Smart Helper</label>' +
        '<input id="' + id + 'In" autocomplete="off" placeholder="Ask a question…"><button class="btn primary" type="submit">Ask</button></form>' +
        '<div class="chips">' + qs.map(q => '<button type="button" class="chip">' + U.esc(q) + '</button>').join('') + '</div>';
      const log = box.querySelector('.chat-log'), input = box.querySelector('input');
      const add = (cls, text) => { const m = document.createElement('div'); m.className = 'msg ' + cls; m.textContent = text; log.appendChild(m); log.scrollTop = log.scrollHeight; };
      const ask = text => { if (!text.trim()) return; add('me', text); add('bot', this.answer(HS.Auth.currentUser() || user, text)); };
      add('bot', 'Hi ' + user.name.split(' ')[0] + '! Ask me about your ' + (user.role === 'admin' ? 'company' : 'own') + ' data.');
      box.querySelector('form').addEventListener('submit', e => { e.preventDefault(); ask(input.value); input.value = ''; });
      box.querySelectorAll('.chip').forEach(c => c.addEventListener('click', () => ask(c.textContent)));
    }
  };
})();