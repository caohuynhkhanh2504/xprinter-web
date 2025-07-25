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
    PRINTER_NAME: "XPrinterXP",
    FILE_PATH: "receipt.txt",
    LOGO_PATH: "logo.txt",
    QR_PATH: "qr.txt"
};

// ESC/POS commands - Cải thiện lệnh cắt
const ESC_COMMANDS = {
    RESET: '\x1B\x40',
    ALIGN_CENTER: '\x1B\x61\x01',
    ALIGN_LEFT: '\x1B\x61\x00',
    ALIGN_RIGHT: '\x1B\x61\x02',
    CUT_PARTIAL: '\x1D\x56\x01',         // Partial cut (GS V 1) 
};

// Global order state tracking
let hasCreatedOrder = false;

// Generate order number
function generateOrderNumber() {
    const now = new Date();
    const date = now.toISOString().slice(0, 10).replace(/-/g, '');
    const time = now.toTimeString().slice(0, 8).replace(/:/g, '');
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `HD${date}-${time}${random}`;
}

// Format Vietnamese date
function formatVietnameseDate(date) {
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const seconds = date.getSeconds().toString().padStart(2, '0');
    
    return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
}

// Format number to Vietnamese currency
function formatCurrency(amount) {
    return amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

// Create receipt content with proper cutting
function createReceiptContent(orderData) {
    const now = new Date();
    const orderNumber = generateOrderNumber();
    const formattedDate = formatVietnameseDate(now);
    
    let content = '';
    
    // Header with logo (if enabled)
    content += `${ESC_COMMANDS.RESET}${ESC_COMMANDS.ALIGN_CENTER}\n`;
    
    // if (orderData.includeLogo) {
    //     // Try to read logo file, if not exist, skip
    //     try {
    //         if (fs.existsSync(CONFIG.LOGO_PATH)) {
    //             const logoContent = fs.readFileSync(CONFIG.LOGO_PATH, 'utf8');
    //             content += logoContent + '\n';
    //         }
    //     } catch (error) {
    //         console.log('Logo file not found, skipping...');
    //     }
    // }
    
    content += 'GO COFFEE\n';
    content += 'Addr: 543/1 Phan Van Tri, Go Vap, HCM\n';
    content += 'Phone: 0388172131\n';
    content += '\n';
    content += 'SALES RECEIPT\n';
    content += `No: ${orderNumber}\n`;
    content += `Printed on: ${formattedDate}\n`;
    content += '\n';
    
    // Order details
    content += `${ESC_COMMANDS.RESET}${ESC_COMMANDS.ALIGN_LEFT}\n`;
    content += `Check-in: ${formattedDate.split(' ')[0]} ${formattedDate.split(' ')[1].slice(0, 5)}\n`;
    content += 'Table: 5[A]       Cashier: cashier\n';
    content += 'Customer: Guest\n';
    content += '------------------------------------------------\n';
    
    // Table header
    content += String.prototype.padEnd ? 
        'Item'.padEnd(19) + 'Price'.padStart(10) + 'Q'.padStart(5) + 'Total'.padStart(10) + '\n' :
        'Item                Price     Q     Total\n';
    content += '------------------------------------------------\n';
    
    // Calculate totals
    let subtotal = 0;
    let totalQuantity = 0;
    
    // Product lines
    orderData.products.forEach(product => {
        subtotal += product.total;
        totalQuantity += product.quantity;
        
        const name = product.name.length > 19 ? product.name.substring(0, 19) : product.name;
        const price = formatCurrency(product.price);
        const qty = product.quantity.toString();
        const total = formatCurrency(product.total);
        
        if (String.prototype.padEnd) {
            content += name.padEnd(19) + price.padStart(10) + qty.padStart(5) + total.padStart(10) + '\n';
        } else {
            // Fallback for older Node.js versions
            content += `${name}                ${price}     ${qty}     ${total}\n`.slice(0, 48) + '\n';
        }
    });
    
    content += '------------------------------------------------\n';
    
    // Totals
    const subtotalStr = formatCurrency(subtotal);
    const vatAmount = Math.round(subtotal * 0.1);
    const vatStr = formatCurrency(vatAmount);
    const finalTotal = subtotal + vatAmount;
    const finalTotalStr = formatCurrency(finalTotal);
    
    if (String.prototype.padEnd) {
        content += 'Subtotal'.padEnd(19) + ''.padStart(10) + ''.padStart(5) + subtotalStr.padStart(10) + '\n';
        content += 'VAT (10%)'.padEnd(19) + ''.padStart(10) + ''.padStart(5) + vatStr.padStart(10) + '\n';
        content += 'Total'.padEnd(19) + ''.padStart(10) + ''.padStart(5) + finalTotalStr.padStart(10) + '\n';
        content += 'Paid'.padEnd(19) + ''.padStart(10) + ''.padStart(5) + finalTotalStr.padStart(10) + '\n';
        content += 'Change'.padEnd(19) + ''.padStart(10) + ''.padStart(5) + '0'.padStart(10) + '\n';
    } else {
        content += `Subtotal                            ${subtotalStr}\n`;
        content += `VAT (10%)                           ${vatStr}\n`;
        content += `Total                               ${finalTotalStr}\n`;
        content += `Paid                                ${finalTotalStr}\n`;
        content += `Change                              0\n`;
    }
    
    content += '\n';
    
    // Footer
    content += `${ESC_COMMANDS.ALIGN_CENTER}\n`;
    content += 'Thank you! See you again!\n';
    content += '\nPowered by POS365.VN\n';

    // QR code nếu có
    // if (orderData.includeQR && fs.existsSync(CONFIG.QR_PATH)) {
    // //    content += fs.readFileSync(CONFIG.QR_PATH, 'utf8') + '\n';
    // }

    // 🔥 FIXED: Proper cutting sequence
    content += '\n\n\n';                    // Feed a few lines
    content += ESC_COMMANDS.CUT_PARTIAL; // Cut with feed - this should work better
    
    return content;
}

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.post('/create-order', (req, res) => {
    try {
        const orderData = req.body;
        
        if (!orderData.products || orderData.products.length === 0) {
            return res.status(400).json({ success: false, error: 'No products in order' });
        }
        
        // Create receipt content
        const receiptContent = createReceiptContent(orderData);
        
        // Write to file
        fs.writeFileSync(CONFIG.FILE_PATH, receiptContent, 'binary');
        
        // Set global state - order has been created
        hasCreatedOrder = true;
        
        console.log('✅ Receipt created successfully');
        console.log('📊 Order details:', {
            products: orderData.products.length,
            total: orderData.products.reduce((sum, p) => sum + p.total, 0),
            includeLogo: orderData.includeLogo,
            includeQR: orderData.includeQR
        });
        
        res.json({ success: true, message: 'Receipt created successfully' });
        
    } catch (error) {
        console.error('❌ Error creating receipt:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/print-order', (req, res) => {
    try {
        // Check if order was created first
        if (!hasCreatedOrder) {
            return res.status(400).json({ 
                success: false, 
                error: 'Please create an order first before printing.' 
            });
        }
        
        // Check if receipt file exists
        if (!fs.existsSync(CONFIG.FILE_PATH)) {
            return res.status(400).json({ 
                success: false, 
                error: 'No receipt file found. Please create an order first.' 
            });
        }
        
        // Execute print command
        const printCommand = `lp -d "${CONFIG.PRINTER_NAME}" "${CONFIG.FILE_PATH}"`;
        
        exec(printCommand, (error, stdout, stderr) => {
            if (error) {
                console.error('❌ Print error:', error);
                return res.status(500).json({ 
                    success: false, 
                    error: `Print failed: ${error.message}` 
                });
            }

            if (stderr) {
                console.error('⚠️ Print stderr:', stderr);
                return res.status(500).json({ 
                    success: false, 
                    error: `Print error: ${stderr}` 
                });
            }

            console.log('✅ Print command executed successfully:', stdout);

            // 🔥 Reset state and clean up after printing
            try {
                // Delete receipt file
                fs.unlinkSync(CONFIG.FILE_PATH);
                console.log('🗑️ Receipt file deleted after printing');
                
                // Reset global state
                hasCreatedOrder = false;
                console.log('🔄 Order state reset - ready for new order');
                
            } catch (deleteErr) {
                console.warn('⚠️ Failed to delete receipt file:', deleteErr.message);
            }

            res.json({ 
                success: true, 
                message: 'Order printed successfully, system reset for next order' 
            });
        });
        
    } catch (error) {
        console.error('❌ Error printing receipt:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Check order status endpoint
app.get('/order-status', (req, res) => {
    res.json({
        hasCreatedOrder: hasCreatedOrder,
        receiptFileExists: fs.existsSync(CONFIG.FILE_PATH),
        timestamp: new Date().toISOString()
    });
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        printer: CONFIG.PRINTER_NAME,
        hasCreatedOrder: hasCreatedOrder
    });
});

// Get current receipt content (for debugging)
app.get('/receipt', (req, res) => {
    try {
        if (fs.existsSync(CONFIG.FILE_PATH)) {
            const content = fs.readFileSync(CONFIG.FILE_PATH, 'utf8');
            res.type('text/plain').send(content);
        } else {
            res.status(404).send('No receipt file found');
        }
    } catch (error) {
        res.status(500).send('Error reading receipt file');
    }
});

// Reset system endpoint (for debugging)
app.post('/reset', (req, res) => {
    try {
        hasCreatedOrder = false;
        if (fs.existsSync(CONFIG.FILE_PATH)) {
            fs.unlinkSync(CONFIG.FILE_PATH);
        }
        res.json({ success: true, message: 'System reset successfully' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
    console.log('='.repeat(50));
    console.log('🚀 POS System Server Started!');
    console.log('='.repeat(50));
    console.log(`📍 Server running on: http://localhost:${PORT}`);
    console.log(`🌐 Network access: http://[YOUR_BOX_IP]:${PORT}`);
    console.log(`🖨️  Printer: ${CONFIG.PRINTER_NAME}`);
    console.log(`📄 Receipt file: ${CONFIG.FILE_PATH}`);
    console.log('='.repeat(50));
    console.log('📱 Access from other devices using your box IP address');
    console.log('⚡ Ready to accept orders!');
    console.log('='.repeat(50));
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down POS System Server...');
    // Clean up on shutdown
    hasCreatedOrder = false;
    if (fs.existsSync(CONFIG.FILE_PATH)) {
        try {
            fs.unlinkSync(CONFIG.FILE_PATH);
            console.log('🗑️ Cleaned up receipt file on shutdown');
        } catch (error) {
            console.warn('⚠️ Failed to clean up receipt file:', error.message);
        }
    }
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n🛑 POS System Server terminated');
    hasCreatedOrder = false;
    process.exit(0);
});