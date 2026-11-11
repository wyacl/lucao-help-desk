'use strict';

function renderInventory() {
  $('#inventory-item').innerHTML = state.inventory.length ?
    state.inventory.map(item => `<option value="${escapeHTML(item.id)}">${escapeHTML(item.name)}</option>`).join('') :
    '<option value="">No inventory items</option>';

  $('#inventory-table').innerHTML = state.inventory.length ? `<table>
    <thead>
      <tr>
        <th>Item</th>
        <th>Quantity</th>
        <th>Stock status</th>
        <th>Last distribution</th>
        <th>Actions</th>
      </tr>
    </thead>
    <tbody>
      ${state.inventory.map(item => `
        <tr>
          <td><strong>${escapeHTML(item.name)}</strong></td>
          <td>${item.quantity} ${escapeHTML(item.unit)}</td>
          <td>${isLowStock(item) ? '<span class="badge low">Low stock</span>' : '<span class="badge ok">In stock</span>'}</td>
          <td>${escapeHTML(item.lastDistribution || '—')}</td>
          <td>
            <div class="table-actions">
              <button class="small-action danger" type="button" data-action="remove-inventory" data-id="${escapeHTML(item.id)}">
                <i class="fa-solid fa-trash-can"></i> Remove
              </button>
            </div>
          </td>
        </tr>
      `).join('')}
    </tbody>
  </table>` : showEmpty('No inventory items. Add one to start tracking stock.');
}

function updateInventory(event) {
  event.preventDefault();
  const item = state.inventory.find(record => record.id === $('#inventory-item').value);
  const quantity = Number($('#inventory-quantity').value);
  const operation = $('#inventory-operation').value;
  const household = $('#inventory-household').value.trim();
  const error = $('#inventory-error');
  error.textContent = '';
  if (!item) return error.textContent = 'Choose an inventory item first.';
  if (!Number.isSafeInteger(quantity) || quantity <= 0) return error.textContent = 'Enter a whole quantity greater than zero.';
  if (operation === 'out' && !household) return error.textContent = 'Enter the household receiving this distribution.';
  if (operation === 'out' && quantity > item.quantity) return error.textContent = `Only ${item.quantity} ${item.unit} available. Stock cannot go below zero.`;
  if (operation === 'in' && quantity > Number.MAX_SAFE_INTEGER - item.quantity) return error.textContent = 'Quantity exceeds the supported stock limit.';
  const original = { ...item };
  item.quantity += operation === 'in' ? quantity : -quantity;
  if (operation === 'out') item.lastDistribution = `${quantity} ${item.unit} to ${household}`;
  if (!saveData()) Object.assign(item, original);
  else {
    $('#inventory-form').reset();
    showToast(isLowStock(item) ? `${item.name} is low: ${item.quantity} ${item.unit} remaining.` : 'Inventory updated.');
  }
  renderAll();
}

function addInventoryItem(event) {
  event.preventDefault();
  const name = $('#new-item-name').value.trim();
  const unit = $('#new-item-unit').value.trim() || 'pcs';
  const quantity = Number($('#new-item-quantity').value);
  const error = $('#new-item-error');
  error.textContent = '';
  if (!name) return error.textContent = 'Item name is required.';
  if (!Number.isSafeInteger(quantity) || quantity < 0) return error.textContent = 'Enter a whole, non-negative quantity.';
  if (state.inventory.some(item => item.name.toLocaleLowerCase() === name.toLocaleLowerCase())) return error.textContent = 'An item with that name already exists.';
  state.inventory.push({ id: id(), name, unit, quantity });
  if (!saveData()) {
    state.inventory.pop();
    return;
  }
  $('#new-item-form').reset();
  renderAll();
  showToast('Inventory item added.');
}

function removeInventoryItem(recordId) {
  const item = state.inventory.find(record => record.id === recordId);
  if (!item) return;

  openConfirmDialog({
    eyebrow: 'CONFIRM REMOVAL',
    title: 'Remove Inventory Item',
    message: `Are you sure you want to remove <strong>${escapeHTML(item.name)}</strong> from resource inventory? This action cannot be undone.`,
    confirmText: 'Remove item',
    onConfirm: () => {
      const original = [...state.inventory];
      state.inventory = state.inventory.filter(record => record.id !== recordId);
      if (!saveData()) {
        state.inventory = original;
        return;
      }
      renderAll();
      showToast(`${item.name} removed from inventory.`);
    }
  });
}