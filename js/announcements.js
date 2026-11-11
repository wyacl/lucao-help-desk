'use strict';

function renderAnnouncements() {
  const list = $('#announcement-list');
  if (!list) return;
  list.innerHTML = renderAnnouncementEntries(
    [...state.announcements].sort((a, b) => (b.ts || 0) - (a.ts || 0)),
    true
  );
}

function formatWhen(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
}

function renderAnnouncementEntries(announcements, showActions = false) {
  if (!announcements.length) return showEmpty('No announcements published yet.');
  const isOfficial = currentRole === 'official';

  return announcements.map(item => {
    const textContent = item.what || item.body || '';

    const pills = [];
    if (item.when) {
      pills.push(`<span class="announcement-meta-pill"><i class="fa-regular fa-clock"></i> ${escapeHTML(formatWhen(item.when))}</span>`);
    }
    if (item.where) {
      pills.push(`<span class="announcement-meta-pill"><i class="fa-solid fa-location-dot"></i> ${escapeHTML(item.where)}</span>`);
    }
    const pillsHtml = pills.length ? `<div class="announcement-pills">${pills.join('')}</div>` : '';

    const actionsHtml = (showActions && isOfficial) ? `
      <div class="announcement-card-actions">
        <button class="announcement-full-btn" type="button" data-action="view-announcement" data-id="${escapeHTML(item.id)}">
          <i class="fa-solid fa-circle-info"></i> Full details
        </button>
        <button class="small-action" type="button" data-action="edit-announcement" data-id="${escapeHTML(item.id)}">
          <i class="fa-solid fa-pen-to-square"></i> Edit
        </button>
        <button class="small-action danger" type="button" data-action="delete-announcement" data-id="${escapeHTML(item.id)}">
          <i class="fa-solid fa-trash-can"></i> Remove
        </button>
      </div>
    ` : `
      <div class="announcement-card-actions">
        <button class="announcement-full-btn" type="button" data-action="view-announcement" data-id="${escapeHTML(item.id)}">
          <i class="fa-solid fa-circle-info"></i> Full details
        </button>
      </div>
    `;

    return `
      <article class="announcement-card category-${escapeHTML((item.category || 'General').toLowerCase())}">
        <div class="announcement-card-header">
          <span class="category-tag">${escapeHTML(item.category || 'General')}</span>
          <span class="announcement-date-text"><i class="fa-regular fa-calendar"></i> ${dateLabel(item.ts || item.when)}</span>
        </div>
        <h3>${escapeHTML(item.title)}</h3>
        ${pillsHtml}
        <p class="announcement-card-body">${escapeHTML(textContent)}</p>
        ${actionsHtml}
      </article>
    `;
  }).join('');
}

function showAnnouncementForm() {
  $('#announcement-form-panel')?.classList.remove('hidden');
  $('.announcement-layout')?.classList.add('has-form');
}

function hideAnnouncementForm() {
  $('#announcement-form-panel')?.classList.add('hidden');
  $('.announcement-layout')?.classList.remove('has-form');
}

function resetAnnouncementForm() {
  $('#announcement-form')?.reset();
  $('#announcement-id').value = '';
  $('#announcement-error').textContent = '';
  $('#announcement-form-title').textContent = 'Publish an announcement';
  $('#announcement-submit').textContent = 'Publish notice';
  hideAnnouncementForm();
}

function addAnnouncement(event) {
  event.preventDefault();
  const editId = $('#announcement-id').value;
  const title = $('#announcement-title').value.trim();
  const category = $('#announcement-category').value;
  const when = $('#announcement-when').value;
  const where = $('#announcement-where').value.trim();
  const requirements = $('#announcement-requirements').value.trim();
  const what = $('#announcement-body').value.trim();
  const error = $('#announcement-error');
  error.textContent = '';

  if (!title || !what) {
    error.textContent = 'Title and announcement details (what) are required.';
    return;
  }

  const announcementData = {
    title,
    category,
    when,
    where,
    requirements,
    what
  };

  if (editId) {
    const existing = state.announcements.find(a => a.id === editId);
    if (existing) {
      delete existing.body;
      Object.assign(existing, announcementData);
    }
  } else {
    state.announcements.unshift({
      id: id(),
      ...announcementData,
      ts: Date.now()
    });
  }

  if (!saveData()) {
    error.textContent = 'Could not save announcement. Please check browser storage.';
    return;
  }

  resetAnnouncementForm();
  renderAll();
  showToast(editId ? 'Announcement updated.' : 'Announcement published.');
}

function editAnnouncement(recordId) {
  const item = state.announcements.find(a => a.id === recordId);
  if (!item) return;

  $('#announcement-id').value = item.id;
  $('#announcement-title').value = item.title;
  $('#announcement-category').value = item.category || 'General';
  
  // Format for HTML5 datetime-local input (YYYY-MM-DDTHH:mm)
  let whenVal = item.when || '';
  if (whenVal && !whenVal.includes('T')) {
    const d = new Date(whenVal);
    if (!Number.isNaN(d.getTime())) {
      const pad = n => String(n).padStart(2, '0');
      whenVal = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    }
  }
  $('#announcement-when').value = whenVal;

  $('#announcement-where').value = item.where || '';
  $('#announcement-requirements').value = item.requirements || '';
  $('#announcement-body').value = item.what || item.body || '';

  $('#announcement-form-title').textContent = 'Edit announcement';
  $('#announcement-submit').textContent = 'Save changes';
  showAnnouncementForm();
  $('#announcement-title').focus();
}

function viewAnnouncementDetails(recordId) {
  const item = state.announcements.find(a => a.id === recordId);
  if (!item) return;

  $('#announcement-detail-category').textContent = (item.category || 'COMMUNITY BULLETIN').toUpperCase();
  $('#announcement-detail-title').textContent = item.title;
  $('#announcement-detail-tag').textContent = item.category || 'General';
  $('#announcement-detail-date').querySelector('span').textContent = dateLabel(item.ts || item.when);

  let extraHtml = '';
  if (item.when) extraHtml += `<p><i class="fa-regular fa-clock"></i> <strong>When:</strong> ${escapeHTML(formatWhen(item.when))}</p>`;
  if (item.where) extraHtml += `<p><i class="fa-solid fa-location-dot"></i> <strong>Where:</strong> ${escapeHTML(item.where)}</p>`;
  if (item.requirements) extraHtml += `<p><i class="fa-solid fa-list-check"></i> <strong>Requirements:</strong> ${escapeHTML(item.requirements)}</p>`;

  $('#announcement-detail-extra').innerHTML = extraHtml;
  $('#announcement-detail-body').textContent = item.what || item.body || '';

  $('#announcement-modal')?.showModal();
}

function removeAnnouncement(recordId) {
  const item = state.announcements.find(a => a.id === recordId);
  if (!item) return;

  openConfirmDialog({
    eyebrow: 'CONFIRM REMOVAL',
    title: 'Remove Announcement',
    message: `Are you sure you want to remove <strong>${escapeHTML(item.title)}</strong>? This action cannot be undone.`,
    confirmText: 'Remove announcement',
    onConfirm: () => {
      const original = [...state.announcements];
      state.announcements = state.announcements.filter(a => a.id !== recordId);
      if (!saveData()) {
        state.announcements = original;
        return;
      }
      renderAll();
      showToast('Announcement removed.');
    }
  });
}