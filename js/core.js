'use strict';

const STORAGE_KEYS = {
  residents: 'residents_data',
  requests: 'doc_requests_data',
  complaints: 'blotter_records',
  announcements: 'announcements_data',
  inventory: 'inventory_data'
};
const LOW_STOCK_THRESHOLD = 15;
const DAY_MS = 24 * 60 * 60 * 1000;
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
})[char]);
const id = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
const dateLabel = value => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' :
    date.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
};
const localDateValue = (date = new Date()) => {
  const offset = date.getTimezoneOffset() * 60 * 1000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
};
const currentYear = () => new Date().getFullYear();
const state = { residents: [], requests: [], complaints: [], announcements: [], inventory: [] };
let currentView = 'dashboard';
let currentRole = 'staff';
let toastTimer;
let confirmDialogCallback = null;

function nextReference(prefix, collection, initialSequence = 1000) {
  const yearPrefix = `${prefix}-${currentYear()}-`;
  const highest = collection.reduce((max, record) => {
    if (!record.ref || !record.ref.startsWith(yearPrefix)) return max;
    const sequence = Number(record.ref.slice(yearPrefix.length));
    return Number.isSafeInteger(sequence) ? Math.max(max, sequence) : max;
  }, initialSequence);
  return `${yearPrefix}${String(highest + 1).padStart(4, '0')}`;
}

function openConfirmDialog({ eyebrow = 'CONFIRM ACTION', title = 'Confirm', message = '', confirmText = 'Confirm', onConfirm }) {
  const dialog = $('#confirm-dialog');
  if (!dialog || typeof dialog.showModal !== 'function') {
    if (confirm(message.replace(/<[^>]+>/g, ''))) {
      if (typeof onConfirm === 'function') onConfirm();
    }
    return;
  }
  if ($('#confirm-dialog-eyebrow')) $('#confirm-dialog-eyebrow').textContent = eyebrow;
  if ($('#confirm-dialog-title')) $('#confirm-dialog-title').textContent = title;
  if ($('#confirm-dialog-message')) $('#confirm-dialog-message').innerHTML = message;
  if ($('#confirm-dialog-confirm')) $('#confirm-dialog-confirm').textContent = confirmText;
  confirmDialogCallback = onConfirm;
  dialog.showModal();
}

function closeConfirmDialog() {
  confirmDialogCallback = null;
  $('#confirm-dialog')?.close();
}

function makeSeedData() {
  const now = Date.now();
  const year = currentYear();
  return {
    residents: [
      { id: id(), name: 'Maria L. Santos', civil: 'Married', address: 'Purok 1, Lucao, Dagupan City', housenumber: 'H-001', contact: '+63 917 123 4567', voter: 'Registered' },
      { id: id(), name: 'Juan P. Dela Cruz', civil: 'Married', address: 'Purok 2, Lucao, Dagupan City', housenumber: 'H-002', contact: '+63 918 234 5678', voter: 'Registered' },
      { id: id(), name: 'Angela R. Mendoza', civil: 'Single', address: 'Purok 3, Lucao, Dagupan City', housenumber: 'H-003', contact: '+63 920 345 6789', voter: 'Not registered' },
      { id: id(), name: 'Pedro G. Reyes', civil: 'Widowed', address: 'Purok 1, Lucao, Dagupan City', housenumber: 'H-004', contact: '+63 922 456 7890', voter: 'Registered' }
    ],
    requests: [
      { id: id(), ref: `DOC-${year}-1048`, name: 'Maria L. Santos', type: 'Barangay Clearance', purpose: 'Employment', status: 'Pending', ts: now - DAY_MS, idType: '', idFront: '', idBack: '' },
      { id: id(), ref: `DOC-${year}-1047`, name: 'Juan P. Dela Cruz', type: 'Certificate of Residency', purpose: 'School enrollment', status: 'Approved', ts: now - 2 * DAY_MS, idType: '', idFront: '', idBack: '' },
      { id: id(), ref: `DOC-${year}-1046`, name: 'Angela R. Mendoza', type: 'Certificate of Indigency', purpose: 'Medical aid', status: 'Released', ts: now - 3 * DAY_MS, idType: '', idFront: '', idBack: '' }
    ],
    complaints: [
      { id: id(), ref: `CPL-${year}-2001`, type: 'Complaint', date: new Date(now - 4 * DAY_MS).toISOString().slice(0, 10), category: 'Noise', parties: 'Reyes vs. Santos', summary: 'Loud karaoke past 10 PM.', status: 'In Progress' },
      { id: id(), ref: `BLT-${year}-2002`, type: 'Blotter', date: new Date(now - 6 * DAY_MS).toISOString().slice(0, 10), category: 'Dispute', parties: 'Dela Cruz vs. Mendoza', summary: 'Boundary fence disagreement.', status: 'Pending' },
      { id: id(), ref: `CPL-${year}-2003`, type: 'Complaint', date: new Date(now - 12 * DAY_MS).toISOString().slice(0, 10), category: 'Sanitation', parties: 'Purok 2 residents', summary: 'Uncollected garbage near the creek.', status: 'Resolved' }
    ],
    announcements: [
      { id: id(), title: 'Free medical check-up this Saturday', category: 'Health', when: `${year}-11-14T08:00`, where: 'Barangay Covered Court', requirements: 'Valid ID or Student ID', what: 'Residents may visit the barangay covered court from 8:00 AM to 12:00 PM. Please bring a valid ID.', ts: now - DAY_MS },
      { id: id(), title: 'Scheduled water interruption', category: 'Advisory', when: `${year}-11-16T09:00`, where: 'Lucao West & East', requirements: '', what: 'Water service will be interrupted on Monday from 9:00 AM to 3:00 PM for line maintenance.', ts: now - 3 * DAY_MS }
    ],
    inventory: [
      { id: id(), name: 'Rice packs', quantity: 148, unit: 'packs' },
      { id: id(), name: 'First aid kits', quantity: 12, unit: 'kits' },
      { id: id(), name: 'Bottled water', quantity: 320, unit: 'bottles' },
      { id: id(), name: 'Emergency blankets', quantity: 9, unit: 'pcs' }
    ]
  };
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isValidRecord(collection, item) {
  if (!isPlainObject(item) || typeof item.id !== 'string' || !/^[a-z0-9]+$/i.test(item.id)) return false;
  if (collection === 'residents') {
    const hasHouseNumber = (typeof item.housenumber === 'string' && item.housenumber.trim() !== '') ||
                           (typeof item.household === 'string' && item.household.trim() !== '');
    return ['name', 'civil', 'voter'].every(key => typeof item[key] === 'string' && item[key].trim()) &&
      hasHouseNumber &&
      (item.address === undefined || typeof item.address === 'string') &&
      (item.contact === undefined || typeof item.contact === 'string') &&
      (item.archived === undefined || typeof item.archived === 'boolean');
  }
  if (collection === 'requests') {
    return ['name', 'purpose'].every(key => typeof item[key] === 'string' && item[key].trim()) &&
      ['Barangay Clearance', 'Certificate of Residency', 'Certificate of Indigency'].includes(item.type) &&
      typeof item.ref === 'string' && /^DOC-\d{4}-\d+$/.test(item.ref) &&
      ['Pending', 'Approved', 'Released'].includes(item.status) && Number.isFinite(item.ts) &&
      Number.isFinite(new Date(item.ts).getTime()) &&
      (item.idType === undefined || typeof item.idType === 'string') &&
      (item.idFront === undefined || typeof item.idFront === 'string') &&
      (item.idBack === undefined || typeof item.idBack === 'string');
  }
  if (collection === 'complaints') {
    return ['date', 'parties', 'summary'].every(key => typeof item[key] === 'string' && item[key].trim()) &&
      ['Dispute', 'Noise', 'Sanitation', 'Other'].includes(item.category) &&
      typeof item.ref === 'string' && /^(BLT|CPL)-\d{4}-\d+$/.test(item.ref) &&
      ['Pending', 'In Progress', 'Resolved'].includes(item.status) &&
      (item.type === undefined || ['Complaint', 'Blotter'].includes(item.type));
  }
  if (collection === 'announcements') {
    const hasBodyOrWhat = (typeof item.what === 'string' && item.what.trim()) ||
                          (typeof item.body === 'string' && item.body.trim());
    return ['title', 'category'].every(key => typeof item[key] === 'string' && item[key].trim()) &&
      hasBodyOrWhat &&
      Number.isFinite(item.ts) && Number.isFinite(new Date(item.ts).getTime()) &&
      (item.when === undefined || typeof item.when === 'string') &&
      (item.where === undefined || typeof item.where === 'string') &&
      (item.requirements === undefined || typeof item.requirements === 'string');
  }
  return typeof item.name === 'string' && item.name.trim() !== '' &&
    typeof item.unit === 'string' && item.unit.trim() !== '' &&
    Number.isSafeInteger(item.quantity) && item.quantity >= 0 &&
    (item.lastDistribution === undefined || typeof item.lastDistribution === 'string');
}

function isValidCollection(collection, value) {
  if (!Array.isArray(value)) return false;
  const ids = new Set();
  const refs = new Set();
  for (const item of value) {
    if (!isValidRecord(collection, item) || ids.has(item.id)) return false;
    ids.add(item.id);
    if (item.ref) {
      if (refs.has(item.ref)) return false;
      refs.add(item.ref);
    }
  }
  if (collection === 'inventory') {
    const names = value.map(item => item.name.toLocaleLowerCase());
    if (new Set(names).size !== names.length) return false;
  }
  return true;
}

function loadData() {
  let unavailable = false;
  let reseeded = false;
  const seed = makeSeedData();

  for (const [collection, key] of Object.entries(STORAGE_KEYS)) {
    let raw;
    try {
      raw = localStorage.getItem(key);
    } catch (error) {
      unavailable = true;
      break;
    }
    if (raw !== null) {
      try {
        state[collection] = JSON.parse(raw);
      } catch (error) {
        state[collection] = null;
      }

      if (!isValidCollection(collection, state[collection])) {
        state[collection] = seed[collection];
        reseeded = true;
      } else if (collection !== 'residents' && Array.isArray(state[collection]) && state[collection].length === 0) {
        state[collection] = seed[collection];
        reseeded = true;
      }
    } else {
      state[collection] = seed[collection];
      reseeded = true;
    }
  }

  if (unavailable) {
    Object.assign(state, seed);
    showToast('Browser storage is unavailable. Data will not persist after closing this page.');
    return;
  }

  // 1. announcements_data: migrate body -> what
  let migratedAnnouncements = false;
  if (Array.isArray(state.announcements)) {
    state.announcements.forEach(item => {
      if (item && item.body !== undefined) {
        if (item.what === undefined) item.what = item.body;
        delete item.body;
        migratedAnnouncements = true;
      }
    });
  }

  // 2. residents_data: schema standardization (id, name, civil, address, housenumber, contact, voter)
  let migratedResidents = false;
  if (Array.isArray(state.residents)) {
    state.residents.forEach(item => {
      if (item) {
        let changed = false;
        if (item.household !== undefined) {
          if (item.housenumber === undefined) item.housenumber = item.household;
          delete item.household;
          changed = true;
        }
        if (item.purok !== undefined) {
          if (!item.address) item.address = `${item.purok}, Lucao, Dagupan City`;
          delete item.purok;
          changed = true;
        }
        if (item.birthdate !== undefined) {
          delete item.birthdate;
          changed = true;
        }
        if (changed) migratedResidents = true;
      }
    });
  }

  // 3. brgy_lucao_resident_accounts: schema standardization (name, email, password, birthdate, civil, contact, purok, housenumber, role)
  try {
    const rawAcc = localStorage.getItem('brgy_lucao_resident_accounts');
    if (rawAcc) {
      const accounts = JSON.parse(rawAcc);
      if (Array.isArray(accounts)) {
        let accMigrated = false;
        const cleaned = accounts.map(acc => {
          const hNum = acc.housenumber || acc.household || '—';
          if (acc.household !== undefined || acc.address !== undefined || acc.civil === undefined) accMigrated = true;
          return {
            name: acc.name,
            email: acc.email,
            password: acc.password,
            birthdate: acc.birthdate || '',
            civil: acc.civil || 'Single',
            contact: acc.contact || '+63 ',
            purok: acc.purok || 'Purok 1',
            housenumber: hNum,
            role: acc.role || 'resident'
          };
        });
        if (accMigrated) {
          localStorage.setItem('brgy_lucao_resident_accounts', JSON.stringify(cleaned));
        }
      }
    }
  } catch (e) {}

  // 4. Clean up any leftover file-pointer references directly back into doc_requests_data
  let migratedImages = false;
  if (localStorage.getItem('lucao_id_files')) {
    try {
      const files = JSON.parse(localStorage.getItem('lucao_id_files') || '{}');
      if (Array.isArray(state.requests)) {
        state.requests.forEach(req => {
          if (req.idFront && req.idFront.startsWith('file:') && files[req.idFront]) {
            req.idFront = files[req.idFront];
            migratedImages = true;
          }
          if (req.idBack && req.idBack.startsWith('file:') && files[req.idBack]) {
            req.idBack = files[req.idBack];
            migratedImages = true;
          }
        });
      }
    } catch (e) {}
    localStorage.removeItem('lucao_id_files');
  }

  if (reseeded || migratedAnnouncements || migratedResidents || migratedImages) {
    saveData(true);
  }
}

function saveData(silent = false) {
  try {
    for (const [collection, key] of Object.entries(STORAGE_KEYS)) {
      localStorage.setItem(key, JSON.stringify(state[collection]));
    }
    return true;
  } catch (error) {
    if (!silent) showToast('Could not save changes. Browser storage may be unavailable or full.');
    return false;
  }
}

function showToast(message) {
  const element = $('#toast');
  element.textContent = message;
  element.classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => element.classList.remove('visible'), 3000);
}

function showEmpty(message) {
  return `<div class="empty-state">${escapeHTML(message)}</div>`;
}

function badge(status) {
  const classes = {
    Pending: 'pending', Approved: 'approved', Released: 'released',
    'In Progress': 'in-progress', Resolved: 'resolved'
  };
  return `<span class="badge ${classes[status] || 'ok'}">${escapeHTML(status)}</span>`;
}

function statusOptions(statuses, selected) {
  return statuses.map(status =>
    `<option value="${escapeHTML(status)}"${status === selected ? ' selected' : ''}>${escapeHTML(status)}</option>`
  ).join('');
}

function isLowStock(item) {
  return item.quantity < LOW_STOCK_THRESHOLD;
}