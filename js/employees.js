/* employees.js — employee CRUD, search, department filter, login creation */
(function () {
  const HS = window.HS, S = HS.Storage, U = HS.Util, K = HS.KEYS;

  HS.Employees = {
    all() { return S.users(); },
    staff() { return S.users().filter(u => u.role === 'employee'); },
    find(id) { return S.users().find(u => u.id === id) || null; },
    departments() {
      return Array.from(new Set(S.users().map(u => u.department).filter(Boolean))).sort((a, b) => a.localeCompare(b));
    },

    validate(d, editId) {
      const errors = {}, email = (d.email || '').trim().toLowerCase(), salary = Number(d.salary);
      if (!(d.name || '').trim()) errors.name = 'Name is required.';
      if (!email) errors.email = 'Email is required.';
      else if (!U.isEmail(email)) errors.email = 'Enter a valid email address.';
      else if (S.users().some(u => u.email === email && u.id !== editId)) errors.email = 'This email is already used by another account.';
      if (!editId && !d.password) errors.password = 'Password is required.';
      else if (d.password && d.password.length < 6) errors.password = 'Use at least 6 characters.';
      if (!(d.department || '').trim()) errors.department = 'Department is required.';
      if (d.salary === '' || d.salary == null) errors.salary = 'Salary is required.';
      else if (!isFinite(salary) || salary <= 0) errors.salary = 'Salary must be greater than 0.';
      if (['employee', 'admin'].indexOf(d.role) === -1) errors.role = 'Choose a role.';
      return errors;
    },

    create(d) {
      const errors = this.validate(d, null);
      if (Object.keys(errors).length) return { ok: false, errors };
      const user = { id: U.uid(), name: d.name.trim(), email: d.email.trim().toLowerCase(), password: d.password, role: d.role,
        department: d.department.trim(), salary: Number(d.salary), joined: U.today() };
      S.add(K.users, user);          // this record is also the employee's login
      return { ok: true, user };
    },

    update(id, d) {
      const cur = this.find(id);
      if (!cur) return { ok: false, errors: { _form: 'Employee not found.' } };
      const errors = this.validate(d, id);
      if (!errors.role && cur.role === 'admin' && d.role !== 'admin' && S.users().filter(u => u.role === 'admin').length === 1)
        errors.role = 'At least one Admin must remain.';
      if (Object.keys(errors).length) return { ok: false, errors };
      const changes = { name: d.name.trim(), email: d.email.trim().toLowerCase(), role: d.role, department: d.department.trim(), salary: Number(d.salary) };
      if (d.password) changes.password = d.password;
      return { ok: true, user: S.update(K.users, id, changes) };
    },

    remove(id, currentUserId) {
      const u = this.find(id);
      if (!u) return { ok: false, error: 'Employee not found.' };
      if (id === currentUserId) return { ok: false, error: 'You cannot delete your own account.' };
      S.removeById(K.users, id);
      S.write(K.attendance, S.attendance().filter(r => r.employeeId !== id));
      S.write(K.leaves, S.leaves().filter(l => l.employeeId !== id));
      return { ok: true };
    },

    search(list, query, dept) {
      const q = (query || '').trim().toLowerCase();
      return list.filter(u => (!dept || u.department === dept) &&
        (!q || [u.name, u.email, u.department].some(v => String(v).toLowerCase().indexOf(q) !== -1)));
    }
  };
})();