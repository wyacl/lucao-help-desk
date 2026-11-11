'use strict';

const DEMO_ACCOUNTS = [
  { email: 'staff@lucao.gov.ph', password: 'desk123', role: 'staff', name: 'Front Desk Staff' },
  { email: 'official@lucao.gov.ph', password: 'official123', role: 'official', name: 'Barangay Official' }
];
const REGISTERED_ACCOUNTS_KEY = 'brgy_lucao_resident_accounts';
const READ_NOTIFICATIONS_KEY = 'lucao_read_notifications';
let currentUserName = '';

function showLoginError(message) {
  $('#login-error').textContent = message;
}

function getRegisteredAccounts() {
  let raw;
  try {
    raw = localStorage.getItem(REGISTERED_ACCOUNTS_KEY);
  } catch (error) {
    return { accounts: null, error: 'Browser storage is unavailable. Resident accounts cannot be accessed.' };
  }
  if (!raw) return { accounts: [], error: '' };
  try {
    const accounts = JSON.parse(raw);
    const valid = Array.isArray(accounts) && accounts.every(account =>
      account && typeof account.name === 'string' && typeof account.email === 'string' &&
      typeof account.password === 'string' && account.role === 'resident'
    );
    return valid ? { accounts, error: '' } :
      { accounts: null, error: 'Saved resident accounts are invalid. Please contact the system administrator.' };
  } catch (error) {
    return { accounts: null, error: 'Saved resident accounts could not be read. Please contact the system administrator.' };
  }
}

function getReadNotificationKeys() {
  try {
    const raw = localStorage.getItem(READ_NOTIFICATIONS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function markNotificationAsRead(key) {
  const keys = getReadNotificationKeys();
  if (!keys.includes(key)) {
    keys.push(key);
    try {
      localStorage.setItem(READ_NOTIFICATIONS_KEY, JSON.stringify(keys));
    } catch (e) {}
  }
  renderResidentNotifications();
}

function markAllNotificationsAsRead(allKeys) {
  const keys = getReadNotificationKeys();
  allKeys.forEach(k => {
    if (!keys.includes(k)) keys.push(k);
  });
  try {
    localStorage.setItem(READ_NOTIFICATIONS_KEY, JSON.stringify(keys));
  } catch (e) {}
  renderResidentNotifications();
}

function startSession(account) {
  currentRole = account.role;
  currentUserName = account.name;
  $('#account-identity').textContent = account.name;
  $('#login-page').classList.add('hidden');
  $('#app-shell').classList.remove('hidden');
  renderAll();
  const targetView = (location.hash && !['#login', '#register'].includes(location.hash))
    ? location.hash.slice(1)
    : 'dashboard';
  navigate(targetView);
}

function signIn(event) {
  event.preventDefault();
  const emailField = $('#login-email');
  emailField.value = emailField.value.trim();
  if (!emailField.checkValidity()) {
    showLoginError('Enter a valid email address to sign in.');
    emailField.focus();
    return;
  }
  const email = emailField.value.toLowerCase();
  const password = $('#login-password').value;
  const saved = getRegisteredAccounts();
  if (!saved.accounts) {
    showLoginError(saved.error);
    return;
  }
  const account = [...DEMO_ACCOUNTS, ...saved.accounts].find(item => item.email === email && item.password === password);
  if (!account) {
    showLoginError('Email or password is incorrect. Residents can create an account using the registration form.');
    return;
  }
  showLoginError('');
  startSession(account);
}

function showRegistration(updateHash = true) {
  $('#login-form').classList.add('hidden');
  $('#show-registration').classList.add('hidden');
  $('#registration-form').classList.remove('hidden');
  const demoAccounts = $('#demo-accounts');
  if (demoAccounts) demoAccounts.classList.add('hidden');
  $('#login-title').textContent = 'Create your account';
  $('#login-description').textContent = 'Register a new resident account to access the Barangay Lucao Help Desk.';
  $('#registration-error').textContent = '';
  if ($('#registration-contact')) $('#registration-contact').value = '+63 ';
  if (updateHash && location.hash !== '#register') {
    history.replaceState(null, '', '/#register');
  }
  $('#registration-name').focus();
}

function showSignIn(updateHash = true) {
  $('#registration-form').classList.add('hidden');
  $('#login-form').classList.remove('hidden');
  $('#show-registration').classList.remove('hidden');
  const demoAccounts = $('#demo-accounts');
  if (demoAccounts) demoAccounts.classList.remove('hidden');
  $('#login-title').textContent = 'Sign in to your account';
  $('#login-description').textContent = 'Use your staff, barangay official, or resident account to access the help desk.';
  $('#registration-error').textContent = '';
  if (updateHash && location.hash !== '#login') {
    history.replaceState(null, '', '/#login');
  }
}

function registerResident(event) {
  event.preventDefault();
  const name = $('#registration-name').value.trim().replace(/\s+/g, ' ');
  const birthdate = $('#registration-birthdate')?.value || '';
  const civil = $('#registration-civil')?.value || 'Single';
  const purok = $('#registration-purok').value.trim().replace(/\s+/g, ' ');
  const household = $('#registration-household').value.trim().replace(/\s+/g, ' ');
  let contact = $('#registration-contact')?.value.trim() || '';
  const email = $('#registration-email').value.trim().toLowerCase();
  const password = $('#registration-password').value;
  const confirmation = $('#registration-confirm-password').value;
  const error = $('#registration-error');
  error.textContent = '';

  if (!name || !birthdate || !civil || !purok || !household || !$('#registration-email').checkValidity() || !password || !confirmation) {
    error.textContent = 'Enter your name, birthdate, civil status, Zone / Purok, House number, valid email address, and both password fields.';
    return;
  }

  if (birthdate > localDateValue()) {
    error.textContent = 'Birthdate cannot be in the future.';
    return;
  }

  if (!contact || contact === '+63') {
    error.textContent = 'Contact number is required.';
    return;
  }
  if (!contact.startsWith('+63')) {
    if (contact.startsWith('09')) contact = '+63 ' + contact.slice(1);
    else if (contact.startsWith('9')) contact = '+63 ' + contact;
    else contact = '+63 ' + contact;
  }
  const digitsOnly = contact.replace(/\D/g, '');
  if (digitsOnly.length !== 12) {
    error.textContent = 'Enter a valid 10-digit Philippine mobile number after +63 (e.g. +63 912 345 6789).';
    return;
  }

  if (password.length < 8) {
    error.textContent = 'Password must be at least 8 characters.';
    return;
  }
  if (password !== confirmation) {
    error.textContent = 'Passwords do not match.';
    return;
  }
  if (DEMO_ACCOUNTS.some(account => account.email === email)) {
    error.textContent = 'This email is already in use.';
    return;
  }

  const saved = getRegisteredAccounts();
  if (!saved.accounts) {
    error.textContent = saved.error;
    return;
  }
  if (saved.accounts.some(account => account.email.toLowerCase() === email)) {
    error.textContent = 'An account with this email already exists.';
    return;
  }

  const account = { 
    name, 
    email, 
    password, 
    birthdate,
    civil,
    contact, 
    purok, 
    housenumber: household, 
    role: 'resident' 
  };

  try {
    localStorage.setItem(REGISTERED_ACCOUNTS_KEY, JSON.stringify([...saved.accounts, account]));
  } catch (storageError) {
    error.textContent = 'Could not save your account. Check browser storage settings and try again.';
    return;
  }

  const generatedAddress = `${purok}, Lucao, Dagupan City`;
  const existingResident = state.residents.find(r => r.name.toLowerCase() === name.toLowerCase());
  if (existingResident) {
    existingResident.civil = civil;
    existingResident.address = generatedAddress;
    existingResident.housenumber = household;
    existingResident.contact = contact;
    existingResident.voter = existingResident.voter || 'Registered';
    delete existingResident.birthdate;
    delete existingResident.purok;
    delete existingResident.household;
  } else {
    state.residents.push({
      id: id(),
      name,
      civil,
      address: generatedAddress,
      housenumber: household || '—',
      contact: contact,
      voter: 'Registered'
    });
  }
  saveData(true);

  $('#registration-form').reset();
  if ($('#registration-contact')) $('#registration-contact').value = '+63 ';
  showSignIn();
  $('#login-email').value = email;
  showToast('Account registered successfully!');
  $('#login-password').focus();
}

function signOut() {
  $('#app-shell').classList.add('hidden');
  $('#login-page').classList.remove('hidden');
  $('#login-form').reset();
  showLoginError('');
  showSignIn();
  history.replaceState(null, '', '/#login');
  $('#login-email').focus();
}

function renderDashboard() {
  const isResident = currentRole === 'resident';
  const residentName = currentUserName.trim().replace(/\s+/g, ' ').toLocaleLowerCase();
  const pending = state.requests.filter(request => request.status === 'Pending').length;
  const active = state.complaints.filter(complaint => complaint.status !== 'Resolved').length;
  const lowStock = state.inventory.filter(isLowStock).length;

  const metricsContainer = $('#metrics');
  if (isResident) {
    metricsContainer.innerHTML = '';
    metricsContainer.classList.add('hidden');
  } else {
    metricsContainer.classList.remove('hidden');
    const cards = [
      ['Registered residents', state.residents.filter(resident => !resident.archived).length, 'Active registry profiles', 'fa-solid fa-users'],
      ['Pending requests', pending, `${state.requests.filter(request => request.status === 'Approved').length} approved`, 'fa-solid fa-file-lines'],
      ['Active complaints', active, `${state.complaints.length - active} resolved`, 'fa-solid fa-scale-balanced'],
      ['Low stock items', lowStock, `Below ${LOW_STOCK_THRESHOLD} units`, 'fa-solid fa-boxes-stacked']
    ];
    metricsContainer.innerHTML = cards.map(([label, count, foot, icon]) =>
      `<article class="metric-card"><span class="metric-icon"><i class="${icon}"></i></span><span class="metric-label">${label}</span><strong class="metric-value">${count}</strong><span class="metric-foot">${foot}</span></article>`
    ).join('');
  }

  const visibleRequests = isResident
    ? state.requests.filter(request => request.name.trim().replace(/\s+/g, ' ').toLocaleLowerCase() === residentName)
    : state.requests;

  const recent = [...visibleRequests].sort((a, b) => b.ts - a.ts).slice(0, 5);
  $('#recent-documents').innerHTML = recent.length ?
    `<table><thead><tr><th>Reference</th><th>Resident</th><th>Document</th><th>Status</th></tr></thead><tbody>${recent.map(request =>
      `<tr><td><strong>${escapeHTML(request.ref)}</strong></td><td>${escapeHTML(request.name)}</td><td>${escapeHTML(request.type)}</td><td>${badge(request.status)}</td></tr>`
    ).join('')}</tbody></table>` : showEmpty(isResident ? 'You have not filed any document requests yet.' : 'No document requests yet.');

  $('#recent-announcements').innerHTML =
    renderAnnouncementEntries([...state.announcements].sort((a, b) => (b.ts || 0) - (a.ts || 0)).slice(0, 2), false);

  $('#resource-snapshot').innerHTML = state.inventory.length ? state.inventory.map(item =>
    `<div class="resource-row"><span>${escapeHTML(item.name)}</span><span>${item.quantity} ${escapeHTML(item.unit)} ${isLowStock(item) ? '<span class="badge low">Low</span>' : ''}</span></div>`
  ).join('') : showEmpty('No inventory items.');

  $('#pending-count').textContent = isResident ? '' : (pending || '');
  $('#pending-count').classList.toggle('hidden', isResident || !pending);
  $('#low-count').textContent = isResident ? '' : (lowStock || '');
  $('#low-count').classList.toggle('hidden', isResident || !lowStock);

  $('#today-label').textContent = new Date().toLocaleDateString('en-PH', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
  }).toUpperCase();
const hour = new Date().getHours();
  const timeOfDay = hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening';
  const displayName = currentRole === 'resident'
    ? (currentUserName.trim().split(/\s+/)[0] || 'there')
    : 'Lucao';

  $('#greeting').textContent = `Good ${timeOfDay}, ${displayName}`;
}

function renderResidentNotifications() {
  const isResident = currentRole === 'resident';
  const button = $('#notification-button');
  const count = $('#notification-count');
  const panel = $('#resident-notifications');

  button.classList.toggle('hidden', !isResident);
  const isOpen = isResident && button.getAttribute('aria-expanded') === 'true';
  button.setAttribute('aria-expanded', String(isOpen));
  panel.classList.toggle('hidden', !isOpen);

  if (!isResident) {
    count.textContent = '';
    count.classList.add('hidden');
    return;
  }

  const residentName = currentUserName.trim().replace(/\s+/g, ' ').toLocaleLowerCase();
  const readKeys = getReadNotificationKeys();

  const docNotifications = state.requests
    .filter(req => (req.status === 'Approved' || req.status === 'Released') &&
      req.name.trim().replace(/\s+/g, ' ').toLocaleLowerCase() === residentName)
    .map(req => ({
      id: req.id,
      key: `doc_${req.id}_${req.status}`,
      type: 'doc',
      targetView: 'documents',
      title: req.status === 'Approved' ? `Approved: ${req.type}` : `Released: ${req.type}`,
      message: req.status === 'Approved'
        ? `Reference: ${req.ref}<br>Purpose: ${req.purpose}<br>Ready for pickup at the barangay hall.`
        : `Reference: ${req.ref}<br>Purpose: ${req.purpose}<br>Your document has been released.`,
      ts: req.ts,
      icon: req.status === 'Approved' ? 'fa-solid fa-circle-check text-green' : 'fa-solid fa-file-circle-check text-blue'
    }));

  const announcementNotifications = state.announcements.map(ann => {
    const textContent = String(ann.what || ann.body || '');
    return {
      id: ann.id,
      key: `ann_${ann.id}`,
      type: 'announcement',
      targetView: 'announcements',
      title: `Notice: ${ann.title}`,
      message: textContent.length > 95 ? `${textContent.slice(0, 95)}...` : textContent,
      ts: ann.ts,
      icon: 'fa-solid fa-bullhorn text-amber'
    };
  });

  const allNotifications = [...docNotifications, ...announcementNotifications]
    .sort((a, b) => b.ts - a.ts)
    .map(notif => ({
      ...notif,
      isRead: readKeys.includes(notif.key)
    }));

  const unreadCount = allNotifications.filter(item => !item.isRead).length;

  button.setAttribute('aria-label', `Notifications${unreadCount ? `, ${unreadCount} unread update${unreadCount === 1 ? '' : 's'}` : ''}`);
  count.textContent = unreadCount || '';
  count.classList.toggle('hidden', unreadCount === 0);

  const allKeys = allNotifications.map(item => item.key);

  panel.innerHTML = allNotifications.length ? `
    <div class="notification-header-row">
      <strong class="notification-heading">Notifications</strong>
      <div class="notification-actions-wrap">
        ${unreadCount > 0 ? `<button class="text-button mark-all-read-btn" type="button" data-action="mark-all-read">Mark all read</button>` : '<span class="all-read-label">All caught up</span>'}
      </div>
    </div>
    <div class="notification-list">
      ${allNotifications.map(item => `
        <article class="notification-item ${item.isRead ? 'read' : 'unread'}" 
                 data-action="read-notif" 
                 data-key="${escapeHTML(item.key)}" 
                 data-target-view="${item.targetView}" 
                 data-target-id="${escapeHTML(item.id)}">
          <div class="notification-item-title">
            <i class="${item.icon}"></i>
            <strong>${escapeHTML(item.title)}</strong>
            ${!item.isRead ? '<span class="unread-dot" title="Unread"></span>' : ''}
          </div>
          <span>${item.message}<br><small class="notification-item-date">${dateLabel(item.ts)}</small></span>
        </article>
      `).join('')}
    </div>` :
    '<strong class="notification-heading">Notifications</strong><p class="notification-empty">No updates or announcements at this time.</p>';

  panel.dataset.allKeys = JSON.stringify(allKeys);
}

function renderResidentOptions() {
  $('#resident-options').innerHTML = state.residents.filter(resident => !resident.archived)
    .map(resident => `<option value="${escapeHTML(resident.name)}"></option>`).join('');
}

function renderAll() {
  renderDashboard();
  searchResidents();
  renderRequests();
  filterComplaints();
  renderAnnouncements();
  renderInventory();
  renderResidentOptions();
  renderResidentNotifications();
  applyRole();
}

const viewTitles = {
  dashboard: 'Dashboard',
  residents: 'Residents',
  documents: 'Document requests',
  blotter: 'Complaints & blotter',
  announcements: 'Announcements',
  inventory: 'Resource inventory',
  lookup: 'Reference lookup'
};

function navigate(view) {
  const restricted = currentRole === 'resident' && ['residents', 'blotter', 'inventory'].includes(view);
  const target = (view === 'overview') ? 'dashboard' : view;
  currentView = !viewTitles[target] || restricted ? 'dashboard' : target;

  $$('.view').forEach(section => section.classList.toggle('active', section.id === `view-${currentView}`));
  $$('.nav-link').forEach(button => button.classList.toggle('active', button.dataset.view === currentView));
  $('#current-page').textContent = viewTitles[currentView];
  if (location.hash !== `#${currentView}`) history.replaceState(null, '', `/#${currentView}`);
  $('#sidebar').classList.remove('open');
  if (currentView === 'lookup') {
    $('#lookup-input').value = '';
    $('#lookup-result').innerHTML = '';
    setTimeout(() => $('#lookup-input')?.focus(), 0);
  }
}

function applyRole() {
  document.body.dataset.role = currentRole;
  const isResident = currentRole === 'resident';
  const isOfficial = currentRole === 'official';

  $$('.nav-link').forEach(button => {
    const staffOnly = ['residents', 'blotter', 'inventory'].includes(button.dataset.view);
    button.classList.toggle('hidden', isResident && staffOnly);
  });

  $$('[data-action="quick-resident"], [data-action="quick-complaint"], [data-action="quick-announcement"]').forEach(button => {
    button.classList.toggle('hidden', isResident);
  });

  $$('[data-action="quick-request"]').forEach(button => {
    button.classList.toggle('hidden', isOfficial);
  });

  $('#metrics').classList.toggle('hidden', isResident);

  const resourceSnapshotPanel = $('#resource-snapshot-panel');
  if (resourceSnapshotPanel) {
    resourceSnapshotPanel.classList.toggle('hidden', isResident);
  }

  const manageInventoryBtn = $('#manage-inventory-btn');
  if (manageInventoryBtn) {
    manageInventoryBtn.classList.toggle('hidden', isResident);
  }

  if (isResident) {
    hideAnnouncementForm();
    $('#pending-count').classList.add('hidden');
    $('#low-count').classList.add('hidden');
  }

  if (isResident && ['residents', 'blotter', 'inventory'].includes(currentView)) navigate('dashboard');
}

function openRecordDialog(type, record = null) {
  const dialog = $('#record-dialog');
  $('#record-form').reset();
  $('#record-error').textContent = '';
  $('#resident-fields').classList.toggle('hidden', type !== 'resident');
  $('#document-fields').classList.toggle('hidden', type !== 'request');
  $('#complaint-fields').classList.toggle('hidden', type !== 'complaint');

  const editing = Boolean(record);
  const titles = {
    resident: editing ? 'Edit resident' : 'Add resident',
    request: editing ? 'Edit document request' : 'File a document request',
    complaint: editing ? 'Edit incident record' : 'Log an incident / complaint'
  };

  $('#dialog-title').textContent = titles[type];
  $('#dialog-submit').textContent = (editing) ? 'Save changes' :
    type === 'request' ? 'Submit request' : type === 'complaint' ? 'Save record' : 'Save resident';

  $('#record-form').dataset.type = type;
  $('#record-form').dataset.editId = record?.id || '';

  if (type === 'resident') {
    if (record) {
      $('#resident-name').value = record.name;
      $('#resident-civil').value = record.civil || 'Single';
      const addressParts = (record.address || '').split(',');
      $('#resident-purok').value = addressParts[0]?.trim() || '';
      $('#resident-household').value = record.housenumber || '';
      $('#resident-contact').value = record.contact || '+63 ';
      $('#resident-voter').value = record.voter || 'Registered';
    } else {
      $('#resident-household').value = '';
      $('#resident-contact').value = '+63 ';
    }
  }

  if (type === 'request') {
    const requestName = $('#request-name');
    requestName.readOnly = currentRole === 'resident';
    resetIdUploadFields(record);
    if (record) {
      requestName.value = record.name;
      $('#request-type').value = record.type;
      $('#request-purpose').value = record.purpose;
      if ($('#request-id-type')) $('#request-id-type').value = record.idType || '';
    } else {
      if (currentRole === 'resident') requestName.value = currentUserName;
      if ($('#request-id-type')) $('#request-id-type').value = '';
    }
  }

  if (type === 'complaint') {
    if (record) {
      $('#complaint-type').value = record.type || (record.ref.startsWith('CPL') ? 'Complaint' : 'Blotter');
      $('#complaint-date').value = record.date;
      $('#complaint-category').value = record.category;
      $('#complaint-parties').value = record.parties;
      $('#complaint-summary').value = record.summary;
    } else {
      $('#complaint-type').value = 'Complaint';
      $('#complaint-date').value = localDateValue();
      $('#complaint-category').value = 'Dispute';
      $('#complaint-parties').value = '';
      $('#complaint-summary').value = '';
    }
  }

  dialog.showModal();
  const selector = type === 'resident' ? '#resident-name' :
    type === 'request' ? '#request-name' : '#complaint-type';
  $(selector).focus();
}

function closeRecordDialog() {
  $('#record-dialog').close();
  $('#record-form').dataset.editId = '';
  $('#record-form').dataset.type = '';
  $('#record-error').textContent = '';
  resetIdUploadFields();
}

async function submitRecord(event) {
  event.preventDefault();
  const type = $('#record-form').dataset.type;
  if (type === 'resident') validateResident();
  else if (type === 'request') await addRequest();
  else if (type === 'complaint') addComplaint(event);
}

function trackRequest(reference = $('#lookup-input').value) {
  const query = reference.trim().toUpperCase();
  const result = $('#lookup-result');
  if (!query) {
    result.innerHTML = '<div class="lookup-banner not-found"><strong>Please enter a reference number</strong><span>Enter a document request or incident reference, such as DOC-2026-1048, CPL-2026-2001, or BLT-2026-2001.</span></div>';
    return;
  }
  const request = state.requests.find(item => item.ref.toUpperCase() === query);
  if (request) {
    const title = { Pending: 'Under review', Approved: 'Ready for pickup', Released: 'Released' }[request.status];
    const details = request.status === 'Pending' ? 'Your request is being processed.' :
      request.status === 'Approved' ? 'Please claim it at the barangay hall.' : 'This document has already been released.';
    result.innerHTML = `<div class="lookup-banner ${request.status.toLowerCase()}"><strong>${title}</strong><span>${escapeHTML(request.ref)} · ${escapeHTML(request.type)} for ${escapeHTML(request.name)} · filed ${dateLabel(request.ts)}<br>${details}</span></div>`;
    return;
  }
  const complaint = state.complaints.find(item => item.ref.toUpperCase() === query);
  if (complaint) {
    const recordType = complaint.type || (complaint.ref.startsWith('CPL') ? 'Complaint' : 'Blotter');
    result.innerHTML = `<div class="lookup-banner ${complaint.status.toLowerCase().replace(/\s/g, '-')}"><strong>${complaint.status === 'Resolved' ? 'Resolved' : complaint.status === 'Pending' ? 'Under review' : 'Investigation in progress'}</strong><span>${escapeHTML(complaint.ref)} · ${recordType} (${escapeHTML(complaint.category)}) · ${escapeHTML(complaint.date)}<br>Status: ${escapeHTML(complaint.status)}</span></div>`;
    return;
  }
  result.innerHTML = '<div class="lookup-banner not-found"><strong>Reference not found</strong><span>Check the number and try again.</span></div>';
}

function openBackupDialog(mode) {
  const isBackup = mode === 'backup';
  $('#backup-title').textContent = isBackup ? 'Back up your data' : 'Restore data';
  $('#backup-description').textContent = isBackup ?
    'Download a JSON copy of the records saved in this browser.' :
    'Choose a JSON backup or paste its contents below. Restoring replaces the current records.';
  $('#backup-text').value = isBackup ? JSON.stringify(state, null, 2) : '';
  $('#backup-text').readOnly = isBackup;
  $('#restore-file').value = '';
  $('#backup-error').textContent = '';
  $('#download-backup').classList.toggle('hidden', !isBackup);
  $('#restore-backup').classList.toggle('hidden', isBackup);
  $('#backup-dialog').showModal();
}

function downloadBackup() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `lucao-help-desk-backup-${localDateValue()}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
  showToast('Backup downloaded.');
}

function importBackup(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    $('#backup-error').textContent = 'The selected file is not valid JSON.';
    return;
  }
  if (!isPlainObject(parsed) || !Object.keys(STORAGE_KEYS).every(collection => isValidCollection(collection, parsed[collection]))) {
    $('#backup-error').textContent = 'This backup is incomplete or contains invalid records.';
    return;
  }
  if (!confirm('Restore this backup? This replaces all current records in this browser.')) return;
  const previous = Object.fromEntries(Object.keys(STORAGE_KEYS).map(collection => [collection, state[collection]]));
  Object.keys(STORAGE_KEYS).forEach(collection => { state[collection] = parsed[collection]; });
  if (!saveData(true)) {
    Object.keys(STORAGE_KEYS).forEach(collection => { state[collection] = previous[collection]; });
    saveData(true);
    $('#backup-error').textContent = 'Could not save the restored data. Current records were kept.';
    return;
  }
  $('#backup-dialog').close();
  renderAll();
  showToast('Data restored successfully.');
}

function handleAction(action, recordId, target = null) {
  if (action === 'edit-resident') editResident(recordId);
  else if (action === 'archive-resident') archiveResident(recordId);
  else if (action === 'delete-resident') deleteResident(recordId);
  else if (action === 'edit-announcement') editAnnouncement(recordId);
  else if (action === 'delete-announcement') removeAnnouncement(recordId);
  else if (action === 'view-announcement') viewAnnouncementDetails(recordId);
  else if (action === 'edit-request') editRequest(recordId);
  else if (action === 'delete-request') deleteRequest(recordId);
  else if (action === 'view-request-id') {
    const request = state.requests.find(item => item.id === recordId);
    if (request) {
      openIdViewer('front', request.idFront, request.idBack);
    }
  }
  else if (action === 'close-id-viewer') {
    closeIdViewer();
  }
  else if (action === 'edit-complaint') editComplaint(recordId);
  else if (action === 'remove-complaint') removeComplaint(recordId);
  else if (action === 'remove-inventory') removeInventoryItem(recordId);
  else if (action === 'quick-resident') addResident();
  else if (action === 'quick-request') openRecordDialog('request');
  else if (action === 'quick-complaint') addComplaint();
  else if (action === 'quick-announcement') {
    resetAnnouncementForm();
    navigate('announcements');
    showAnnouncementForm();
    $('#announcement-title')?.focus();
  } else if (action === 'quick-lookup') navigate('lookup');
  else if (action === 'read-notif') {
    const itemElem = target?.closest('[data-key]');
    const key = itemElem?.dataset.key;
    const targetView = itemElem?.dataset.targetView;
    const targetId = itemElem?.dataset.targetId;

    if (key) markNotificationAsRead(key);

    $('#resident-notifications')?.classList.add('hidden');
    $('#notification-button')?.setAttribute('aria-expanded', 'false');

    if (targetView) {
      navigate(targetView);
      if (targetView === 'announcements' && targetId) {
        setTimeout(() => viewAnnouncementDetails(targetId), 50);
      }
    }
  } else if (action === 'mark-all-read') {
    const panel = $('#resident-notifications');
    const allKeys = JSON.parse(panel?.dataset.allKeys || '[]');
    markAllNotificationsAsRead(allKeys);
  }
}

function bindEvents() {
  $('#login-form')?.addEventListener('submit', signIn);
  $('#registration-form')?.addEventListener('submit', registerResident);
  $('#show-registration')?.addEventListener('click', () => showRegistration(true));
  $('#show-login')?.addEventListener('click', () => showSignIn(true));
  $('#logout-button')?.addEventListener('click', signOut);

  $('#notification-button')?.addEventListener('click', () => {
    const panel = $('#resident-notifications');
    const isOpen = panel.classList.toggle('hidden') === false;
    $('#notification-button').setAttribute('aria-expanded', String(isOpen));
  });

  $('#navigation')?.addEventListener('click', event => {
    const button = event.target.closest('[data-view]');
    if (button) navigate(button.dataset.view);
  });

  document.addEventListener('click', event => {
    const action = event.target.closest('[data-action]');
    if (action) handleAction(action.dataset.action, action.dataset.id, action);
    const navigateButton = event.target.closest('[data-navigate]');
    if (navigateButton) navigate(navigateButton.dataset.navigate);
  });

  $('#menu-button')?.addEventListener('click', () => $('#sidebar').classList.toggle('open'));
  $('#resident-search')?.addEventListener('input', searchResidents);
  $('#show-archived')?.addEventListener('change', searchResidents);
  $('#document-filter')?.addEventListener('change', renderRequests);
  $('#blotter-search')?.addEventListener('input', filterComplaints);
  $('#blotter-status')?.addEventListener('change', filterComplaints);
  $('#blotter-category')?.addEventListener('change', filterComplaints);

  $('#document-table')?.addEventListener('change', event => {
    const select = event.target.closest('[data-action="request-status"]');
    if (select) updateRequestStatus(select.dataset.id, select.value);
  });

  $('#blotter-table')?.addEventListener('change', event => {
    const select = event.target.closest('[data-action="complaint-status"]');
    if (select) updateComplaintStatus(select.dataset.id, select.value);
  });

  $('#record-form')?.addEventListener('submit', submitRecord);
  $('#dialog-close')?.addEventListener('click', closeRecordDialog);
  $('#dialog-cancel')?.addEventListener('click', closeRecordDialog);
  $('#record-dialog')?.addEventListener('click', event => {
    if (event.target === $('#record-dialog')) closeRecordDialog();
  });

  $('#confirm-dialog-close')?.addEventListener('click', closeConfirmDialog);
  $('#confirm-dialog-cancel')?.addEventListener('click', closeConfirmDialog);
  $('#confirm-dialog-confirm')?.addEventListener('click', () => {
    const cb = confirmDialogCallback;
    confirmDialogCallback = null;
    $('#confirm-dialog')?.close();
    if (typeof cb === 'function') cb();
  });
  $('#confirm-dialog')?.addEventListener('click', event => {
    if (event.target === $('#confirm-dialog')) closeConfirmDialog();
  });

  const contactInputs = [$('#resident-contact'), $('#registration-contact')];
  contactInputs.forEach(input => {
    if (!input) return;
    input.addEventListener('focus', () => {
      if (!input.value || input.value.trim() === '') {
        input.value = '+63 ';
      }
    });
    input.addEventListener('input', () => {
      if (!input.value.startsWith('+63')) {
        input.value = '+63 ' + input.value.replace(/^\+?6?3?\s?/, '');
      }
    });
  });

  $('#announcement-modal-close')?.addEventListener('click', () => $('#announcement-modal').close());
  $('#announcement-modal-dismiss')?.addEventListener('click', () => $('#announcement-modal').close());
  $('#announcement-modal')?.addEventListener('click', event => {
    if (event.target === $('#announcement-modal')) $('#announcement-modal').close();
  });

  $('#announcement-form')?.addEventListener('submit', addAnnouncement);
  $('#announcement-cancel')?.addEventListener('click', resetAnnouncementForm);
  $('#announcement-form-close')?.addEventListener('click', resetAnnouncementForm);

  $('#inventory-form')?.addEventListener('submit', updateInventory);
  $('#new-item-form')?.addEventListener('submit', addInventoryItem);

  $('#lookup-form')?.addEventListener('submit', event => {
    event.preventDefault();
    trackRequest();
  });
  $('#lookup-input')?.addEventListener('input', () => {
    $('#lookup-result').innerHTML = '';
  });

  $('#backup-button')?.addEventListener('click', () => openBackupDialog('backup'));
  $('#restore-button')?.addEventListener('click', () => openBackupDialog('restore'));
  $('#backup-close')?.addEventListener('click', () => $('#backup-dialog').close());
  $('#backup-dialog')?.addEventListener('click', event => {
    if (event.target === $('#backup-dialog')) $('#backup-dialog').close();
  });
  $('#download-backup')?.addEventListener('click', downloadBackup);
  $('#restore-backup')?.addEventListener('click', () => importBackup($('#backup-text').value));
  $('#restore-file')?.addEventListener('change', event => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.addEventListener('load', () => {
      $('#backup-text').readOnly = false;
      $('#backup-text').value = String(reader.result ?? '');
      $('#backup-error').textContent = 'Backup loaded. Select “Restore from text” to apply it.';
      $('#restore-backup').classList.remove('hidden');
    });
    reader.addEventListener('error', () => {
      $('#backup-error').textContent = 'Could not read the selected backup file.';
    });
    reader.readAsText(file);
  });

  window.addEventListener('hashchange', () => {
    if ($('#app-shell').classList.contains('hidden')) {
      if (location.hash === '#register') {
        showRegistration(false);
      } else {
        showSignIn(false);
        if (location.hash !== '#login') history.replaceState(null, '', '/#login');
      }
      return;
    }
    navigate(location.hash.slice(1) || 'dashboard');
  });

  window.addEventListener('storage', event => {
    if (event.key !== STORAGE_KEYS.requests || event.newValue === null) return;
    let requests;
    try {
      requests = JSON.parse(event.newValue);
    } catch (error) {
      showToast('Document requests changed in another tab, but the updated data could not be read.');
      return;
    }
    if (!isValidCollection('requests', requests)) {
      showToast('Document requests changed in another tab, but the updated data is invalid.');
      return;
    }
    state.requests = requests;
    renderAll();
  });

  bindIdUploadPreview();
}

function init() {
  loadData();
  bindEvents();
  if ($('#app-shell').classList.contains('hidden')) {
    if (location.hash === '#register') {
      showRegistration(false);
    } else {
      showSignIn(false);
      if (location.hash !== '#login') {
        history.replaceState(null, '', '/#login');
      }
    }
  }
}

document.addEventListener('DOMContentLoaded', init);