const express = require('express');
const JsBarcode = require('jsbarcode');
const { DOMImplementation, XMLSerializer } = require('xmldom');
const path = require('path');
const fs = require('fs');
const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');
const SysTray = require('systray').default;

const PORT = 3000;

// پوشه واقعی خروجی (کنار خود exe یا کنار server.js در حالت node عادی)
const APP_DIR = process.pkg ? path.dirname(process.execPath) : __dirname;
const VENDOR_DIR = path.join(APP_DIR, 'vendor', 'bootstrap');

// در حالت pkg، فایل‌های bootstrap داخل snapshot مجازی هستند و express.static
// نمی‌تواند مستقیماً از آنجا stream کند؛ پس یک‌بار آن‌ها را روی دیسک واقعی کپی می‌کنیم.
function extractBootstrapAssets() {
  const srcDist = path.join(__dirname, 'node_modules', 'bootstrap', 'dist');
  const filesToCopy = [
    ['css/bootstrap.rtl.min.css', 'css/bootstrap.rtl.min.css'],
    ['js/bootstrap.bundle.min.js', 'js/bootstrap.bundle.min.js'],
  ];

  filesToCopy.forEach(([src, dest]) => {
    const srcPath = path.join(srcDist, src);
    const destPath = path.join(VENDOR_DIR, dest);
    const destFolder = path.dirname(destPath);

    if (!fs.existsSync(destFolder)) fs.mkdirSync(destFolder, { recursive: true });

    // اگر فایل از قبل کپی شده، دوباره کپی نکن
    if (fs.existsSync(destPath)) return;

    try {
      const content = fs.readFileSync(srcPath); // خواندن از snapshot (pkg) یا دیسک عادی
      fs.writeFileSync(destPath, content);       // نوشتن روی دیسک واقعی
      console.log('کپی شد:', dest);
    } catch (err) {
      console.error('خطا در کپی فایل bootstrap:', src, err.message);
    }
  });
}
const DB_FILE = path.join(APP_DIR, 'database.json');

const adapter = new FileSync(DB_FILE);
const db = low(adapter);
db.defaults({ records: [] }).write();

function generateSVG(text, format) {
  const xmlSerializer = new XMLSerializer();
  const document = new DOMImplementation().createDocument('http://www.w3.org/1999/xhtml', 'html', null);
  const svgNode = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  JsBarcode(svgNode, text, {
    xmlDocument: document,
    format: format,
    background: '#ffffff',
    lineColor: '#000000',
    width: 2,
    height: 100,
    displayValue: true,
    textAlign: 'center',
    margin: 10,
  });
  return xmlSerializer.serializeToString(svgNode);
}

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function renderPage() {
  return `<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
<meta charset="UTF-8">
<title>سیستم مدیریت پرونده‌ها</title>
<link href="/vendor/bootstrap/css/bootstrap.rtl.min.css" rel="stylesheet">
<style>
  body { font-family: Tahoma, Arial, sans-serif; padding: 20px; background:#f8f9fa; }
  .card-box { background:#fff; }
</style>
</head>
<body>
<div class="container">
  <h3 class="mb-4">سیستم مدیریت پرونده‌ها</h3>

  <ul class="nav nav-tabs" id="mainTab" role="tablist">
    <li class="nav-item" role="presentation">
      <button class="nav-link active" data-bs-toggle="tab" data-bs-target="#newTab" type="button">پرونده جدید</button>
    </li>
    <li class="nav-item" role="presentation">
      <button class="nav-link" id="listTabBtn" data-bs-toggle="tab" data-bs-target="#listTab" type="button">نمایش پرونده‌ها</button>
    </li>
  </ul>

  <div class="tab-content card-box border border-top-0 p-4">
    <div class="tab-pane fade show active" id="newTab">
      <form id="recordForm">
        <div class="mb-3">
          <label class="form-label">شناسه پرونده <span class="text-danger">*</span></label>
          <input type="text" class="form-control" id="fileId" required>
        </div>
        <div class="mb-3">
          <label class="form-label">توضیحات</label>
          <textarea class="form-control" id="description" rows="4"></textarea>
        </div>
        <button type="submit" class="btn btn-primary">ذخیره</button>
      </form>
    </div>

    <div class="tab-pane fade" id="listTab">
      <table class="table table-bordered table-hover align-middle" id="recordsTable">
        <thead class="table-light">
          <tr>
            <th>شناسه پرونده</th>
            <th>توضیحات</th>
            <th>تاریخ ثبت</th>
            <th>عملیات</th>
          </tr>
        </thead>
        <tbody></tbody>
      </table>
    </div>
  </div>
</div>

<!-- مودال انتخاب نوع بارکد -->
<div class="modal fade" id="barcodeFormatModal" tabindex="-1">
  <div class="modal-dialog">
    <div class="modal-content">
      <div class="modal-header">
        <h5 class="modal-title">انتخاب نوع بارکد Code128</h5>
        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
      </div>
      <div class="modal-body">
        <div class="form-check mb-2">
          <input class="form-check-input" type="radio" name="bcFormat" id="fmtAuto" value="CODE128">
          <label class="form-check-label" for="fmtAuto">خودکار (Auto)</label>
        </div>
        <div class="form-check mb-2">
          <input class="form-check-input" type="radio" name="bcFormat" id="fmtA" value="CODE128A">
          <label class="form-check-label" for="fmtA">Set A (حروف بزرگ و اعداد)</label>
        </div>
        <div class="form-check mb-2">
          <input class="form-check-input" type="radio" name="bcFormat" id="fmtB" value="CODE128B" checked>
          <label class="form-check-label" for="fmtB">Set B (حروف بزرگ و کوچک)</label>
        </div>
        <div class="form-check mb-2">
          <input class="form-check-input" type="radio" name="bcFormat" id="fmtC" value="CODE128C">
          <label class="form-check-label" for="fmtC">Set C (فقط اعداد زوج)</label>
        </div>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">انصراف</button>
        <button type="button" class="btn btn-primary" id="confirmPrintBtn">چاپ</button>
      </div>
    </div>
  </div>
</div>

<script src="/vendor/bootstrap/js/bootstrap.bundle.min.js"></script>
<script>
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
    tr.innerHTML = \`
      <td>\${escapeHtml(r.fileId)}</td>
      <td>\${escapeHtml(r.description)}</td>
      <td>\${new Date(r.createdAt).toLocaleString('fa-IR')}</td>
      <td>
        <button class="btn btn-sm btn-danger me-1" onclick="deleteRecord('\${r.id}')">حذف</button>
        <button class="btn btn-sm btn-secondary" onclick="printBarcode('\${r.id}')">چاپ بارکد</button>
      </td>\`;
    tbody.appendChild(tr);
  });
}

async function deleteRecord(id) {
  if (!confirm('آیا از حذف این رکورد مطمئن هستید؟')) return;
  const res = await fetch('/records/' + id, { method: 'DELETE' });
  if (res.ok) loadRecords();
}

let pendingPrintId = null;
const formatModal = new bootstrap.Modal(document.getElementById('barcodeFormatModal'));

function printBarcode(id) {
  pendingPrintId = id;
  formatModal.show();
}

document.getElementById('confirmPrintBtn').addEventListener('click', () => {
  const format = document.querySelector('input[name="bcFormat"]:checked').value;
  formatModal.hide();
  window.open('/barcode/print/' + pendingPrintId + '?format=' + format, '_blank', 'width=400,height=300');
});

document.getElementById('listTabBtn').addEventListener('shown.bs.tab', loadRecords);
</script>
</body>
</html>`;
}

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // سرو فایل‌های آفلاین Bootstrap (کپی‌شده روی دیسک واقعی، نه از snapshot)
  app.use('/vendor/bootstrap', express.static(VENDOR_DIR));

  app.get('/', (req, res) => res.send(renderPage()));

  app.get('/records', (req, res) => {
    const records = db.get('records').sortBy('createdAt').reverse().value();
    res.json(records);
  });

  app.post('/records', (req, res) => {
    const { fileId, description } = req.body;
    if (!fileId || !fileId.trim()) {
      return res.status(400).json({ message: 'شناسه پرونده الزامی است' });
    }
    const record = {
      id: Date.now().toString(),
      fileId: fileId.trim(),
      description: description || '',
      createdAt: new Date().toISOString(),
    };
    db.get('records').push(record).write();
    res.json(record);
  });

  app.delete('/records/:id', (req, res) => {
    db.get('records').remove({ id: req.params.id }).write();
    res.json({ ok: true });
  });

  app.get('/barcode/print/:id', (req, res) => {
    const record = db.get('records').find({ id: req.params.id }).value();
    if (!record) return res.status(404).send('رکورد یافت نشد');

    const allowedFormats = ['CODE128', 'CODE128A', 'CODE128B', 'CODE128C'];
    const format = allowedFormats.includes(req.query.format) ? req.query.format : 'CODE128';
    const title = escapeHtml(record.fileId || 'پرونده');
    const description = escapeHtml(record.description || '');

    let svg;
    try {
      svg = generateSVG(record.fileId, format);
    } catch (err) {
      return res.status(400).send(`<html dir="rtl"><body style="font-family:Tahoma;padding:40px;">
        <h4>خطا در تولید بارکد</h4>
        <p>شناسه پرونده با فرمت انتخابی (${format}) سازگار نیست: ${err.message}</p>
        <p>مثلاً Set A فقط حروف بزرگ و اعداد را پشتیبانی می‌کند و Set C فقط تعداد زوج رقم را.</p>
      </body></html>`);
    }

    res.send(`<!DOCTYPE html>
<html dir="rtl" lang="fa">
<head><meta charset="UTF-8"><title>چاپ بارکد</title>
<style>
  body {
    display:flex;
    justify-content:center;
    align-items:center;
    min-height:100vh;
    margin:0;
    font-family:Tahoma, Arial, sans-serif;
    background:#fff;
  }
  .print-card {
    text-align:center;
    padding:24px 18px;
    border:2px solid #000;
    border-radius:10px;
    background:#fff;
  }
  .print-title {
    font-size:20px;
    font-weight:bold;
    margin-bottom:12px;
    color:#111;
  }
  .print-desc {
    font-size:14px;
    margin-top:10px;
    color:#333;
  }
  @media print {
    body { min-height:auto; }
    .print-card { border:none; padding:0; }
  }
</style>
</head>
<body>
  <div class="print-card">
    <div class="print-title">پرونده: ${title}</div>
    ${description ? `<div class="print-desc">توضیحات: ${description}</div>` : ''}
    ${svg}
  </div>
  <script>window.onload = function () { window.print(); };</script>
</body>
</html>`);
  });

  return app;
}

let server = null;

function startServer() {
  if (server) return;
  const app = buildApp();
  server = app.listen(PORT, () => {
    console.log('سرور در حال اجرا: http://localhost:' + PORT);
    console.log('فایل دیتابیس: ' + DB_FILE);
  });
}

function stopServer() {
  if (!server) return;
  server.close(() => console.log('سرور متوقف شد'));
  server = null;
}

// ---- تنظیمات آیکون تری ----
const iconPath = path.join(__dirname, 'icon.ico');
const iconBase64 = fs.existsSync(iconPath) ? fs.readFileSync(iconPath).toString('base64') : '';

const systray = new SysTray({
  menu: {
    icon: iconBase64,
    title: 'سیستم مدیریت پرونده‌ها',
    tooltip: 'سیستم مدیریت پرونده‌ها',
    items: [
      { title: 'شروع سرور', tooltip: 'Start', checked: false, enabled: true },
      { title: 'توقف سرور', tooltip: 'Stop', checked: false, enabled: true },
      { title: 'باز کردن در مرورگر', tooltip: 'Open', checked: false, enabled: true },
      { title: 'خروج', tooltip: 'Exit', checked: false, enabled: true },
    ],
  },
  debug: false,
  copyDir: true,
});

systray.onClick((action) => {
  const title = action.item.title;
  if (title === 'شروع سرور') startServer();
  else if (title === 'توقف سرور') stopServer();
  else if (title === 'باز کردن در مرورگر') require('child_process').exec(`start http://localhost:${PORT}`);
  else if (title === 'خروج') {
    stopServer();
    systray.kill();
    process.exit(0);
  }
});

// شروع خودکار سرور هنگام اجرا
extractBootstrapAssets();
startServer();
