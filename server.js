const express = require('express');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const app = express();
const PORT = 3000;

// Middleware
app.use(express.json());
app.use(express.static('.'));

// Configuration
const CONFIG = {
    PRINTER_NAME: "XPrinterXP",             // Sửa lại đúng tên máy in bạn dùng
    FILE_PATH: "receipt.txt",
    LOGO_PATH: "logo.txt",
    QR_PATH: "qr.txt"
};

// ESC/POS commands
const ESC = {
    RESET: '\x1B\x40',
    ALIGN_CENTER: '\x1B\x61\x01',
    ALIGN_LEFT: '\x1B\x61\x00',
    CUT_PARTIAL: '\x1D\x56\x01',
};

let hasCreatedOrder = false;

// === Utility ===
function generateOrderNumber() {
    const now = new Date();
    const date = now.toISOString().slice(0, 10).replace(/-/g, '');
    const time = now.toTimeString().slice(0, 8).replace(/:/g, '');
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `HD${date}-${time}${random}`;
}

function formatVietnameseDate(date) {
    const d = (n) => n.toString().padStart(2, '0');
    return `${d(date.getDate())}/${d(date.getMonth()+1)}/${date.getFullYear()} ${d(date.getHours())}:${d(date.getMinutes())}:${d(date.getSeconds())}`;
}

function formatCurrency(n) {
    return n.toLocaleString('vi-VN');
}

// === Create receipt content ===
function createReceiptContent(orderData) {
    const now = new Date();
    const orderNumber = generateOrderNumber();
    const time = formatVietnameseDate(now);

    let content = '';
    content += ESC.RESET + ESC.ALIGN_CENTER;
    content += '\nGO COFFEE\n543/1 Phan Van Tri, Go Vap, HCM\nPhone: 0388172131\n\n';
    content += 'SALES RECEIPT\n';
    content += `No: ${orderNumber}\nPrinted on: ${time}\n\n`;

    content += ESC.ALIGN_LEFT;
    content += `Check-in: ${time}\nTable: 5[A]    Cashier: cashier\nCustomer: Guest\n`;
    content += '------------------------------------------------\n';
    content += 'Item'.padEnd(18) + 'Price'.padStart(8) + 'Qty'.padStart(6) + 'Total'.padStart(10) + '\n';
    content += '------------------------------------------------\n';

    let subtotal = 0, totalQty = 0;
    orderData.products.forEach(p => {
        subtotal += p.total;
        totalQty += p.quantity;
        content += p.name.padEnd(18) + 
                   formatCurrency(p.price).padStart(8) + 
                   p.quantity.toString().padStart(6) + 
                   formatCurrency(p.total).padStart(10) + '\n';
    });

    const vat = Math.round(subtotal * 0.1);
    const total = subtotal + vat;

    content += '------------------------------------------------\n';
    content += 'Subtotal'.padEnd(32) + formatCurrency(subtotal).padStart(10) + '\n';
    content += 'VAT (10%)'.padEnd(32) + formatCurrency(vat).padStart(10) + '\n';
    content += 'Total'.padEnd(32) + formatCurrency(total).padStart(10) + '\n';
    content += 'Paid'.padEnd(32) + formatCurrency(total).padStart(10) + '\n';
    content += 'Change'.padEnd(32) + '0'.padStart(10) + '\n\n';

    content += ESC.ALIGN_CENTER;
    content += 'Thank you! See you again!\nPowered by POS365.VN\n\n\n';
    content += ESC.CUT_PARTIAL;

    return content;
}

// === Routes ===
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.post('/create-order', (req, res) => {
    try {
        const order = req.body;
        if (!order.products || order.products.length === 0) {
            return res.status(400).json({ success: false, error: 'No products selected' });
        }

        const receipt = createReceiptContent(order);

        fs.writeFileSync(CONFIG.FILE_PATH, receipt, { encoding: 'latin1' });  // ⚠️ Use latin1 to preserve ESC/POS

        hasCreatedOrder = true;

        console.log('✅ Order created:', {
            items: order.products.length,
            total: order.products.reduce((s, p) => s + p.total, 0),
        });

        return res.json({ success: true, message: 'Order created successfully' });
    } catch (err) {
        console.error('❌ Create order failed:', err);
        return res.status(500).json({ success: false, error: err.message });
    }
});

app.post('/print-order', (req, res) => {
    if (!hasCreatedOrder) {
        return res.status(400).json({ success: false, error: 'No order to print. Please create first.' });
    }

    if (!fs.existsSync(CONFIG.FILE_PATH)) {
        return res.status(404).json({ success: false, error: 'Receipt file not found' });
    }

    const printCommand = `lp -d "${CONFIG.PRINTER_NAME}" -o raw "${CONFIG.FILE_PATH}"`;

    exec(printCommand, (error, stdout, stderr) => {
        console.log('🔧 Print STDOUT:', stdout);
        console.log('🔧 Print STDERR:', stderr);

        if (error) {
            console.error('❌ Print failed:', error.message);
            return res.status(500).json({ success: false, error: error.message });
        }

        try {
            fs.unlinkSync(CONFIG.FILE_PATH);
            hasCreatedOrder = false;
            console.log('🗑️ Receipt deleted and state reset.');
        } catch (err) {
            console.warn('⚠️ Could not delete receipt file:', err.message);
        }

        return res.json({ success: true, message: 'Printed successfully and system reset.' });
    });
});

// === Optional debug route ===
app.get('/receipt', (req, res) => {
    if (fs.existsSync(CONFIG.FILE_PATH)) {
        return res.type('text/plain').send(fs.readFileSync(CONFIG.FILE_PATH, 'utf8'));
    } else {
        return res.status(404).send('No receipt file found.');
    }
});

// === Start server ===
app.listen(PORT, '0.0.0.0', () => {
    console.log('='.repeat(40));
    console.log('🚀 POS SERVER STARTED');
    console.log(`🖨️ Printer: ${CONFIG.PRINTER_NAME}`);
    console.log(`📄 File: ${CONFIG.FILE_PATH}`);
    console.log(`🌐 http://localhost:${PORT}`);
    console.log('='.repeat(40));
});
