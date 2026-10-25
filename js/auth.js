/* auth.js — first-run setup, login/logout, password change, session + page protection */
(function () {
  const HS = window.HS, S = HS.Storage, U = HS.Util;

  HS.Auth = {
    base() { return location.pathname.indexOf('/pages/') !== -1 ? '../' : ''; },
    isSetup() { return !!S.getCompany() && S.users().some(u => u.role === 'admin'); },
    homeFor(role) { return role === 'admin' ? 'pages/admin.html' : 'pages/employee.html'; },

    /* The session only stores the user id; role always comes from alh_users. */
    currentUser() {
      const s = S.getSession();
      if (!s || !s.userId) return null;
      return S.users().find(u => u.id === s.userId) || null;
    },

    setup(d) {
      const errors = {};
      const company = (d.companyName || '').trim(), name = (d.name || '').trim(), email = (d.email || '').trim().toLowerCase();
      if (this.isSetup()) return { ok: false, errors: { _form: 'Setup is already complete. Please log in.' } };
      if (!company) errors.companyName = 'Company name is required.';
      if (!name) errors.name = 'Your name is required.';
      if (!email) errors.email = 'Email is required.'; else if (!U.isEmail(email)) errors.email = 'Enter a valid email address.';
      if (!d.password) errors.password = 'Password is required.'; else if (d.password.length < 6) errors.password = 'Use at least 6 characters.';
      if (d.password && d.confirm !== d.password) errors.confirm = 'Passwords do not match.';
      if (Object.keys(errors).length) return { ok: false, errors };
      S.saveCompany({ name: company, startTime: '09:00', graceMinutes: 15, leaveQuota: 20, workingDays: [1, 2, 3, 4, 5], announcements: [] });
      const user = { id: U.uid(), name, email, password: d.password, role: 'admin', department: 'Management', salary: 0, joined: U.today() };
      S.add(HS.KEYS.users, user);
      this.startSession(user);
      return { ok: true, user };
    },

    startSession(user) { S.setSession({ userId: user.id, role: user.role, name: user.name, loginAt: new Date().toISOString() }); },

    login(email, password) {
      const errors = {}; email = (email || '').trim().toLowerCase();
      if (!email) errors.email = 'Email is required.'; else if (!U.isEmail(email)) errors.email = 'Enter a valid email address.';
      if (!password) errors.password = 'Password is required.';
      if (Object.keys(errors).length) return { ok: false, errors };
      const user = S.users().find(u => u.email === email && u.password === password);
      if (!user) return { ok: false, errors: { _form: 'Incorrect email or password.' } };
      this.startSession(user);
      return { ok: true, user };
    },

    logout() { S.clearSession(); location.href = this.base() + 'index.html'; },

    changePassword(userId, current, next, confirm) {
      const errors = {}, user = S.users().find(u => u.id === userId);
      if (!user) return { ok: false, errors: { _form: 'Please log in again.' } };
      if (!current) errors.current = 'Enter your current password.'; else if (current !== user.password) errors.current = 'Current password is incorrect.';
      if (!next) errors.next = 'New password is required.'; else if (next.length < 6) errors.next = 'Use at least 6 characters.';
      if (next && confirm !== next) errors.confirm = 'Passwords do not match.';
      if (Object.keys(errors).length) return { ok: false, errors };
      S.update(HS.KEYS.users, userId, { password: next });
      return { ok: true };
    },

    /* Protects a page. roles: ['admin'] | ['employee'] | ['admin','employee']. Returns the user or null (after redirecting). */
    guard(roles) {
      const b = this.base(), user = this.currentUser();
      if (!this.isSetup() || !user) { S.clearSession(); location.replace(b + 'index.html'); return null; }
      if (roles.indexOf(user.role) === -1) { location.replace(b + this.homeFor(user.role)); return null; }
      return user;
    },

    initPage(opts) {
      const user = this.guard(opts.roles);
      if (!user) return null;
      this.renderShell(user, opts.active);
      document.body.classList.remove('guard');
      return user;
    },

    renderShell(user, active) {
      const b = this.base(), company = S.getCompany() || {};
      const items = user.role === 'admin'
        ? [['admin', 'Dashboard', 'admin.html'], ['employees', 'Employees', 'employees.html'], ['leaves', 'Leave requests', 'leaves.html'], ['payslip', 'Payslips', 'payslip.html'], ['settings', 'Settings', 'settings.html']]
        : [['employee', 'My dashboard', 'employee.html'], ['payslip', 'My payslip', 'payslip.html']];
      const logo = b + 'assets/alihired_logo.svg';
      document.getElementById('sidebar').innerHTML =
        '<a class="brand" href="' + b + 'index.html"><img src="' + logo + '" alt="AliHired logo" width="44" height="44"><span><strong>Sudais hired</strong><small>Hire Smart. Grow Faster.</small></span></a>' +
        '<div class="company">' + U.esc(company.name) + '</div>' +
        '<nav class="nav" aria-label="Main">' + items.map(i => '<a href="' + i[2] + '"' + (i[0] === active ? ' class="active" aria-current="page"' : '') + '>' + i[1] + '</a>').join('') + '</nav>' +
        '<div class="side-foot"><div class="who"><span class="avatar">' + U.esc(user.name.charAt(0).toUpperCase()) + '</span><span><strong>' + U.esc(user.name) + '</strong><small>' + (user.role === 'admin' ? 'Admin' : 'Employee') + '</small></span></div>' +
        '<a class="btn ghost sm" href="' + b + 'index.html#password">Change password</a><button class="btn ghost sm" id="logoutBtn" type="button">Log out</button></div>';
      document.getElementById('topbar').innerHTML =
        '<button class="icon-btn" id="menuBtn" type="button" aria-label="Open menu" aria-expanded="false">&#9776;</button><span class="topbar-title">Sudais hired</span>';
      const overlay = document.createElement('div'); overlay.className = 'overlay'; document.body.appendChild(overlay);
      const side = document.getElementById('sidebar'), btn = document.getElementById('menuBtn');
      const toggle = open => { side.classList.toggle('open', open); overlay.classList.toggle('open', open); btn.setAttribute('aria-expanded', String(open)); };
      btn.addEventListener('click', () => toggle(!side.classList.contains('open')));
      overlay.addEventListener('click', () => toggle(false));
      document.getElementById('logoutBtn').addEventListener('click', () => this.logout());
    }
  };
})();