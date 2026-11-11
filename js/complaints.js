'use strict';

function filterComplaints() {
  const query = $('#blotter-search').value.trim().toLocaleLowerCase();
  const status = $('#blotter-status').value;
  const category = $('#blotter-category').value;

  const complaints = state.complaints.filter(item => {
    const statusMatch = !status || item.status === status;
    const categoryMatch = !category || item.category === category;
    const queryMatch = !query || `${item.ref} ${item.parties} ${item.summary} ${item.type || ''}`.toLocaleLowerCase().includes(query);
    return statusMatch && categoryMatch && queryMatch;
  });

  const tableWrap = $('#blotter-table');
  if (!tableWrap) return;

  tableWrap.innerHTML = complaints.length ? `<table>
    <thead>
      <tr>
        <th>Reference</th>
        <th>Date</th>
        <th>Type</th>
        <th>Category</th>
        <th>Parties</th>
        <th>Summary</th>
        <th>Status</th>
        <th>Actions</th>
      </tr>
    </thead>
    <tbody>
      ${complaints.map(item => {
        const recordType = item.type || (item.ref.startsWith('CPL') ? 'Complaint' : 'Blotter');
        const badgeClass = recordType.toLowerCase() === 'complaint' ? 'badge-complaint' : 'badge-blotter';

        return `<tr>
          <td><strong>${escapeHTML(item.ref)}</strong></td>
          <td>${escapeHTML(item.date)}</td>
          <td><span class="badge ${badgeClass}">${escapeHTML(recordType)}</span></td>
          <td>${escapeHTML(item.category)}</td>
          <td>${escapeHTML(item.parties)}</td>
          <td>${escapeHTML(item.summary)}</td>
          <td>
            <select class="status-select" 
                    id="complaint-status-${escapeHTML(item.id)}" 
                    name="complaint_status_${escapeHTML(item.id)}" 
                    aria-label="Update status for ${escapeHTML(item.ref)}" 
                    data-action="complaint-status" 
                    data-id="${escapeHTML(item.id)}">
              ${statusOptions(['Pending', 'In Progress', 'Resolved'], item.status)}
            </select>
          </td>
          <td>
            <div class="table-actions">
              <button class="small-action" type="button" data-action="edit-complaint" data-id="${escapeHTML(item.id)}"><i class="fa-solid fa-pen-to-square"></i> Edit</button>
              <button class="small-action danger" type="button" data-action="remove-complaint" data-id="${escapeHTML(item.id)}"><i class="fa-solid fa-trash-can"></i> Remove</button>
            </div>
          </td>
        </tr>`;
      }).join('')}
    </tbody>
  </table>` : showEmpty('No matching incident or blotter records found.');
}

function addComplaint(event = null) {
  if (event) event.preventDefault();
  const editId = $('#record-form').dataset.editId;
  const type = $('#complaint-type').value;
  const date = $('#complaint-date').value;
  const category = $('#complaint-category').value;
  const parties = $('#complaint-parties').value.trim();
  const summary = $('#complaint-summary').value.trim();
  const error = $('#record-error');
  error.textContent = '';

  if (!date || !parties || !summary) {
    if (error) error.textContent = 'Date, parties involved, and incident summary are required.';
    return;
  }

  const existing = editId ? state.complaints.find(c => c.id === editId) : null;
  const prefix = type === 'Complaint' ? 'CPL' : 'BLT';
  const ref = existing ? existing.ref : nextReference(prefix, state.complaints, 2000);

  const complaintData = {
    type,
    date,
    category,
    parties,
    summary
  };

  if (existing) {
    Object.assign(existing, complaintData);
  } else {
    state.complaints.unshift({
      id: id(),
      ref,
      ...complaintData,
      status: 'Pending'
    });
  }

  if (!saveData()) {
    if (error) error.textContent = 'Could not save incident record. Please check browser storage.';
    return;
  }

  closeRecordDialog();
  renderAll();
  showToast(editId ? 'Incident record updated.' : 'Incident logged successfully.');
}

function editComplaint(recordId) {
  const complaint = state.complaints.find(item => item.id === recordId);
  if (complaint) openRecordDialog('complaint', complaint);
}

function removeComplaint(recordId) {
  const complaint = state.complaints.find(item => item.id === recordId);
  if (!complaint) return;

  const recordType = complaint.type || (complaint.ref.startsWith('CPL') ? 'Complaint' : 'Blotter');

  openConfirmDialog({
    eyebrow: 'CONFIRM REMOVAL',
    title: `Remove ${recordType}`,
    message: `Are you sure you want to remove ${recordType.toLowerCase()} record <strong>${escapeHTML(complaint.ref)}</strong>? This action cannot be undone.`,
    confirmText: 'Remove record',
    onConfirm: () => {
      const original = [...state.complaints];
      state.complaints = state.complaints.filter(item => item.id !== recordId);
      if (!saveData()) {
        state.complaints = original;
        return;
      }
      renderAll();
      showToast(`${recordType} record removed.`);
    }
  });
}

function updateComplaintStatus(recordId, newStatus) {
  const complaint = state.complaints.find(item => item.id === recordId);
  if (!complaint) return;
  const oldStatus = complaint.status;
  complaint.status = newStatus;
  if (!saveData()) {
    complaint.status = oldStatus;
    return;
  }
  renderAll();
  showToast(`Incident status updated to ${newStatus}.`);
}