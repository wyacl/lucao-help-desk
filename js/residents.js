'use strict';

function renderResidents() {
  const query = $('#resident-search').value.trim().toLocaleLowerCase();
  const showArchived = $('#show-archived').checked;
  const residents = state.residents.filter(resident =>
    (showArchived || !resident.archived) &&
    (!query || `${resident.name} ${resident.housenumber || ''} ${resident.address || ''} ${resident.contact || ''} ${resident.civil || ''}`.toLocaleLowerCase().includes(query))
  );

  $('#resident-table').innerHTML = residents.length ? `<table>
    <thead>
      <tr>
        <th>Name</th>
        <th>Civil status</th>
        <th>Address</th>
        <th>House number</th>
        <th>Contact number</th>
        <th>Voter</th>
        <th>Actions</th>
      </tr>
    </thead>
    <tbody>
      ${residents.map(resident => {
        const displayAddress = resident.address || 'Lucao, Dagupan City';
        const houseNum = resident.housenumber || '—';

        return `<tr>
          <td><strong>${escapeHTML(resident.name)}</strong>${resident.archived ? ' <span class="badge pending">Archived</span>' : ''}</td>
          <td>${escapeHTML(resident.civil || 'Single')}</td>
          <td>${escapeHTML(displayAddress)}</td>
          <td>${escapeHTML(houseNum)}</td>
          <td><span class="resident-contact-text">${escapeHTML(resident.contact || '—')}</span></td>
          <td>${escapeHTML(resident.voter || 'Registered')}</td>
          <td>
            <div class="table-actions">
              <button class="small-action" type="button" data-action="edit-resident" data-id="${escapeHTML(resident.id)}"><i class="fa-solid fa-pen-to-square"></i> Edit</button>
              <button class="small-action" type="button" data-action="archive-resident" data-id="${escapeHTML(resident.id)}">${resident.archived ? '<i class="fa-solid fa-rotate-left"></i> Restore' : '<i class="fa-solid fa-box-archive"></i> Archive'}</button>
              <button class="small-action danger" type="button" data-action="delete-resident" data-id="${escapeHTML(resident.id)}"><i class="fa-solid fa-trash-can"></i> Remove</button>
            </div>
          </td>
        </tr>`;
      }).join('')}
    </tbody>
  </table>` : showEmpty('No matching residents.');
}

function searchResidents() {
  renderResidents();
}

function addResident() {
  openRecordDialog('resident');
}

function editResident(recordId) {
  const resident = state.residents.find(item => item.id === recordId);
  if (resident) openRecordDialog('resident', resident);
}

function deleteResident(recordId) {
  const resident = state.residents.find(item => item.id === recordId);
  if (!resident) return;

  openConfirmDialog({
    eyebrow: 'CONFIRM REMOVAL',
    title: 'Remove Resident',
    message: `Are you sure you want to remove resident <strong>${escapeHTML(resident.name)}</strong> from the registry? This action cannot be undone.`,
    confirmText: 'Remove resident',
    onConfirm: () => {
      const original = [...state.residents];
      state.residents = state.residents.filter(item => item.id !== recordId);
      if (!saveData()) {
        state.residents = original;
        return;
      }
      renderAll();
      showToast(`${resident.name} removed.`);
    }
  });
}

function archiveResident(recordId) {
  const resident = state.residents.find(item => item.id === recordId);
  if (!resident) return;
  const wasArchived = Boolean(resident.archived);
  resident.archived = !wasArchived;
  if (!saveData()) {
    resident.archived = wasArchived;
    return;
  }
  renderAll();
  showToast(resident.archived ? 'Resident archived.' : 'Resident restored.');
}

function validateResident() {
  const editId = $('#record-form').dataset.editId;
  const name = $('#resident-name').value.trim().replace(/\s+/g, ' ');
  const civil = $('#resident-civil').value;
  const purok = $('#resident-purok').value.trim().replace(/\s+/g, ' ');
  const housenumber = $('#resident-household').value.trim().replace(/\s+/g, ' ');
  let contact = $('#resident-contact').value.trim();
  const voter = $('#resident-voter').value;

  const errors = [];
  if (!name || !purok || !housenumber) {
    errors.push('Name, Zone / Purok, and House number are required.');
  }

  if (!contact || contact === '+63') {
    errors.push('Contact number is required.');
  } else {
    if (!contact.startsWith('+63')) {
      if (contact.startsWith('09')) contact = '+63 ' + contact.slice(1);
      else if (contact.startsWith('9')) contact = '+63 ' + contact;
      else contact = '+63 ' + contact;
    }
    const digitsOnly = contact.replace(/\D/g, '');
    if (digitsOnly.length !== 12) {
      errors.push('Enter a valid 10-digit Philippine mobile number after +63 (e.g. +63 912 345 6789).');
    }
  }

  const duplicate = state.residents.some(item => item.id !== editId &&
    item.name.toLocaleLowerCase() === name.toLocaleLowerCase() &&
    (item.housenumber || '').toLocaleLowerCase() === housenumber.toLocaleLowerCase());
  if (duplicate) errors.push('This resident is already listed in that house number.');

  if (errors.length) {
    $('#record-error').textContent = errors.join(' ');
    return;
  }

  const generatedAddress = `${purok}, Lucao, Dagupan City`;

  const resident = {
    name,
    civil,
    address: generatedAddress,
    housenumber,
    contact,
    voter
  };

  const existing = editId ? state.residents.find(item => item.id === editId) : null;
  if (editId && !existing) {
    $('#record-error').textContent = 'This resident could not be found.';
    return;
  }
  const previous = existing ? { ...existing } : null;
  if (existing) {
    Object.assign(existing, resident);
  } else {
    state.residents.push({ id: id(), ...resident });
  }

  if (!saveData()) {
    if (existing) Object.assign(existing, previous);
    else state.residents.pop();
    return;
  }

  closeRecordDialog();
  renderAll();
  showToast(editId ? 'Resident updated.' : 'Resident added.');
}