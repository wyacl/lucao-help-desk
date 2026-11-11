'use strict';

let currentViewerTab = 'front';
let currentFrontSrc = '';
let currentBackSrc = '';

// Compress uploaded file to a lightweight Data URL so it fits safely in localStorage
function compressImage(file, maxWidth = 800, quality = 0.65) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = event => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        // Export as compressed JPEG
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = reject;
    };
    reader.onerror = reject;
  });
}

function renderRequests() {
  const filter = $('#document-filter')?.value || '';
  const isResident = currentRole === 'resident';
  const residentName = currentUserName.trim().replace(/\s+/g, ' ').toLocaleLowerCase();

  const requests = state.requests.filter(item => {
    const statusMatch = !filter || item.status === filter;
    const residentMatch = !isResident || item.name.trim().replace(/\s+/g, ' ').toLocaleLowerCase() === residentName;
    return statusMatch && residentMatch;
  });

  const tableWrap = $('#document-table');
  if (!tableWrap) return;

  tableWrap.innerHTML = requests.length ? `<table>
    <thead>
      <tr>
        <th>Reference</th>
        <th>Date filed</th>
        <th>Resident</th>
        <th>Document</th>
        <th>Purpose</th>
        <th>Attachment</th>
        <th>Status</th>
        <th>Actions</th>
      </tr>
    </thead>
    <tbody>
      ${requests.map(item => {
        const isLocked = item.status === 'Approved' || item.status === 'Released';

        return `<tr>
          <td><strong>${escapeHTML(item.ref)}</strong></td>
          <td>${dateLabel(item.ts)}</td>
          <td>${escapeHTML(item.name)}</td>
          <td>${escapeHTML(item.type)}</td>
          <td>${escapeHTML(item.purpose)}</td>
          <td>
            ${(item.idFront || item.idBack) ? `
              <button class="small-action" type="button" data-action="view-request-id" data-id="${escapeHTML(item.id)}" title="${escapeHTML(item.idType || 'View ID')}">
                <i class="fa-solid fa-id-card"></i> View ID
              </button>
            ` : '<span class="muted">—</span>'}
          </td>
          <td>
            ${isResident ? badge(item.status) : `
              <select class="status-select" 
                      id="request-status-${escapeHTML(item.id)}" 
                      name="request_status_${escapeHTML(item.id)}" 
                      aria-label="Update status for ${escapeHTML(item.ref)}" 
                      data-action="request-status" 
                      data-id="${escapeHTML(item.id)}">
                ${statusOptions(['Pending', 'Approved', 'Released'], item.status)}
              </select>
            `}
          </td>
          <td>
            <div class="table-actions">
              ${!isLocked ? `
                <button class="small-action" type="button" data-action="edit-request" data-id="${escapeHTML(item.id)}">
                  <i class="fa-solid fa-pen-to-square"></i> Edit
                </button>
                <button class="small-action danger" type="button" data-action="delete-request" data-id="${escapeHTML(item.id)}">
                  <i class="fa-solid fa-trash-can"></i> Remove
                </button>
              ` : '<span class="muted">—</span>'}
            </div>
          </td>
        </tr>`;
      }).join('')}
    </tbody>
  </table>` : showEmpty(isResident ? 'You have not submitted any document requests yet.' : 'No document requests found.');
}

async function addRequest() {
  const editId = $('#record-form').dataset.editId;
  const name = $('#request-name').value.trim();
  const type = $('#request-type').value;
  const purpose = $('#request-purpose').value.trim();
  const idType = $('#request-id-type')?.value || '';
  const error = $('#record-error');
  error.textContent = '';

  const existing = editId ? state.requests.find(r => r.id === editId) : null;

  if (existing && (existing.status === 'Approved' || existing.status === 'Released')) {
    error.textContent = `This request cannot be edited because it is already ${existing.status.toLowerCase()}.`;
    return;
  }

  if (!name || !purpose) {
    error.textContent = 'Resident name and purpose are required.';
    return;
  }

  const frontInput = $('#request-id-front');
  const backInput = $('#request-id-back');

  // Use newly compressed image data or retain existing image data
  let frontLink = frontInput.dataset.preview || existing?.idFront || '';
  let backLink = backInput.dataset.preview || existing?.idBack || '';

  const ref = existing ? existing.ref : nextReference('DOC', state.requests);

  const requestData = {
    name,
    type,
    purpose,
    idType: idType || existing?.idType || '',
    idFront: frontLink,
    idBack: backLink
  };

  if (existing) {
    Object.assign(existing, requestData);
  } else {
    state.requests.unshift({
      id: id(),
      ref,
      ...requestData,
      status: 'Pending',
      ts: Date.now()
    });
  }

  if (!saveData()) {
    error.textContent = 'Could not save document request. Storage is full.';
    return;
  }

  closeRecordDialog();
  renderAll();
  showToast(editId ? 'Request updated.' : 'Request submitted successfully.');
}

function editRequest(recordId) {
  const request = state.requests.find(item => item.id === recordId);
  if (!request) return;

  if (request.status === 'Approved' || request.status === 'Released') {
    showToast(`Request ${request.ref} cannot be edited once ${request.status.toLowerCase()}.`);
    return;
  }

  openRecordDialog('request', request);
}

function deleteRequest(recordId) {
  const request = state.requests.find(item => item.id === recordId);
  if (!request) return;

  if (request.status === 'Approved' || request.status === 'Released') {
    showToast(`Request ${request.ref} cannot be removed once ${request.status.toLowerCase()}.`);
    return;
  }

  openConfirmDialog({
    eyebrow: 'CONFIRM REMOVAL',
    title: 'Remove Request',
    message: `Are you sure you want to remove document request <strong>${escapeHTML(request.ref)}</strong>? This action cannot be undone.`,
    confirmText: 'Remove request',
    onConfirm: () => {
      const original = [...state.requests];
      state.requests = state.requests.filter(item => item.id !== recordId);
      if (!saveData()) {
        state.requests = original;
        return;
      }
      renderAll();
      showToast('Document request removed.');
    }
  });
}

function updateRequestStatus(recordId, newStatus) {
  const request = state.requests.find(item => item.id === recordId);
  if (!request) return;
  const oldStatus = request.status;
  request.status = newStatus;
  if (!saveData()) {
    request.status = oldStatus;
    return;
  }
  renderAll();
  showToast(`Status updated to ${newStatus}.`);
}

function bindIdUploadPreview() {
  const frontInput = $('#request-id-front');
  const backInput = $('#request-id-back');

  frontInput?.addEventListener('change', async event => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const compressedDataUrl = await compressImage(file);
      frontInput.dataset.preview = compressedDataUrl;
      frontInput.dataset.attached = 'true';
      $('#request-id-front-name').textContent = file.name;
      $('#request-id-front-text').textContent = 'Front ID Attached';
      $('#btn-view-front')?.classList.remove('hidden');
    } catch (e) {
      console.error(e);
    }
  });

  backInput?.addEventListener('change', async event => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const compressedDataUrl = await compressImage(file);
      backInput.dataset.preview = compressedDataUrl;
      backInput.dataset.attached = 'true';
      $('#request-id-back-name').textContent = file.name;
      $('#request-id-back-text').textContent = 'Back ID Attached';
      $('#btn-view-back')?.classList.remove('hidden');
    } catch (e) {
      console.error(e);
    }
  });

  $('#btn-view-front')?.addEventListener('click', () => {
    const frontData = frontInput.dataset.preview || $('#record-form').dataset.frontSrc || '';
    const backData = backInput.dataset.preview || $('#record-form').dataset.backSrc || '';
    openIdViewer('front', frontData, backData);
  });

  $('#btn-view-back')?.addEventListener('click', () => {
    const frontData = frontInput.dataset.preview || $('#record-form').dataset.frontSrc || '';
    const backData = backInput.dataset.preview || $('#record-form').dataset.backSrc || '';
    openIdViewer('back', frontData, backData);
  });

  $('#id-view-front-tab')?.addEventListener('click', () => switchIdTab('front'));
  $('#id-view-back-tab')?.addEventListener('click', () => switchIdTab('back'));
}

function resetIdUploadFields(record = null) {
  const frontInput = $('#request-id-front');
  const backInput = $('#request-id-back');
  const form = $('#record-form');

  if (frontInput) {
    frontInput.value = '';
    delete frontInput.dataset.preview;
    delete frontInput.dataset.attached;
  }
  if (backInput) {
    backInput.value = '';
    delete backInput.dataset.preview;
    delete backInput.dataset.attached;
  }

  if (form) {
    form.dataset.frontSrc = record?.idFront || '';
    form.dataset.backSrc = record?.idBack || '';
  }

  $('#request-id-front-text').textContent = record?.idFront ? 'Change Front ID' : 'Upload ID (Front)';
  $('#request-id-front-name').textContent = record?.idFront ? 'ID Image Attached' : 'PNG, JPG, or WebP up to 2MB';
  $('#btn-view-front')?.classList.toggle('hidden', !record?.idFront);

  $('#request-id-back-text').textContent = record?.idBack ? 'Change Back ID' : 'Upload ID (Back)';
  $('#request-id-back-name').textContent = record?.idBack ? 'ID Image Attached' : 'PNG, JPG, or WebP up to 2MB';
  $('#btn-view-back')?.classList.toggle('hidden', !record?.idBack);
}

function openIdViewer(tab = 'front', frontSrc = '', backSrc = '') {
  currentFrontSrc = frontSrc;
  currentBackSrc = backSrc;
  switchIdTab(tab);
  $('#id-viewer-modal')?.showModal();
}

function closeIdViewer() {
  $('#id-viewer-modal')?.close();
}

function switchIdTab(tab) {
  currentViewerTab = tab;
  $('#id-view-front-tab')?.classList.toggle('active', tab === 'front');
  $('#id-view-back-tab')?.classList.toggle('active', tab === 'back');

  const src = tab === 'front' ? currentFrontSrc : currentBackSrc;
  const img = $('#id-viewer-img');
  const empty = $('#id-viewer-empty');

  if (src) {
    img.src = src;
    img.classList.remove('hidden');
    empty.classList.add('hidden');
  } else {
    img.src = '';
    img.classList.add('hidden');
    empty.classList.remove('hidden');
    empty.textContent = tab === 'front' ? 'No front ID attached.' : 'No back ID attached.';
  }
}