const form = document.getElementById('recordForm');

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const fileId = document.getElementById('fileId').value.trim();
  const description = document.getElementById('description').value;

  if (!fileId) {
    alert('شناسه پرونده الزامی است');
    return;
  }

  const res = await fetch('/records', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fileId, description })
  });

  if (res.ok) {
    form.reset();
    alert('پرونده با موفقیت ذخیره شد');
  } else {
    const err = await res.json();
    alert('خطا: ' + err.message);
  }
});

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

async function loadRecords() {
  const res = await fetch('/records');
  const records = await res.json();
  const tbody = document.querySelector('#recordsTable tbody');
  tbody.innerHTML = '';
  records.forEach(r => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${escapeHtml(r.fileId)}</td>
      <td>${escapeHtml(r.description)}</td>
      <td>${new Date(r.createdAt).toLocaleString('fa-IR')}</td>
      <td>
        <button class="btn btn-sm btn-danger me-1" onclick="deleteRecord('${r.id}')">حذف</button>
        <button class="btn btn-sm btn-secondary" onclick="printBarcode('${r.id}')">چاپ بارکد</button>
      </td>`;
    tbody.appendChild(tr);
  });
}

async function deleteRecord(id) {
  if (!confirm('آیا از حذف این رکورد مطمئن هستید؟')) return;
  const res = await fetch('/records/' + id, { method: 'DELETE' });
  if (res.ok) loadRecords();
}

function printBarcode(id) {
  window.open('/barcode/print/' + id, '_blank', 'width=400,height=300');
}

document.getElementById('listTabBtn').addEventListener('shown.bs.tab', loadRecords);