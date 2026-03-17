const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

// Invoice Generator Service
class InvoiceGenerator {
    // Generate PDF Invoice
    static async generateInvoice(order, user, products) {
        return new Promise((resolve, reject) => {
            try {
                // Create invoices directory if it doesn't exist
                const invoicesDir = path.join(__dirname, '..', 'public', 'invoices');
                if (!fs.existsSync(invoicesDir)) {
                    fs.mkdirSync(invoicesDir, { recursive: true });
                }

                const fileName = `invoice-${order.tracking.orderId}.pdf`;
                const filePath = path.join(invoicesDir, fileName);

                // Create PDF document
                const doc = new PDFDocument({ margin: 50 });
                const stream = fs.createWriteStream(filePath);

                doc.pipe(stream);

                // Header
                doc
                    .fontSize(24)
                    .fillColor('#1c8125')
                    .text('🌿 Shri Govind Pharmacy', { align: 'center' })
                    .fontSize(12)
                    .fillColor('#333')
                    .text('Your Health, Our Priority', { align: 'center' })
                    .moveDown(0.5);

                // Company Info
                doc
                    .fontSize(10)
                    .text('Shop No. 123, Main Market, City - 123456', { align: 'center' })
                    .text('Phone: +91 98765 43210 | Email: support@shrigovindpharmacy.com', { align: 'center' })
                    .text('GSTIN: 27ABCDE1234F1Z5', { align: 'center' })
                    .moveDown(1);

                // Invoice Title
                doc
                    .fontSize(20)
                    .fillColor('#333')
                    .text('TAX INVOICE', { align: 'center' })
                    .moveDown(1);

                // Invoice Details
                doc.fontSize(10).fillColor('#333');
                const invoiceDetails = [
                    { label: 'Invoice No:', value: order.tracking.orderId },
                    { label: 'Invoice Date:', value: new Date(order.createdAt).toLocaleDateString('en-IN') },
                    { label: 'Order Date:', value: new Date(order.createdAt).toLocaleDateString('en-IN') },
                    { label: 'Payment Method:', value: order.paymentMethod || 'COD' },
                    { label: 'Payment Status:', value: order.paymentStatus || 'Pending' }
                ];

                invoiceDetails.forEach((item, index) => {
                    doc.text(`${item.label} ${item.value}`, 50, doc.y + (index * 3));
                });

                doc.moveDown(2);

                // Billing Address
                doc.fontSize(12).fillColor('#1c8125').text('Billing Address:', { underline: true });
                doc.moveDown(0.5);
                doc.fontSize(10).fillColor('#333');
                
                if (order.address) {
                    doc.text(`Name: ${order.address.name || user.name}`);
                    doc.text(`Address: ${order.address.fullAddress || order.address.street}`);
                    doc.text(`City: ${order.address.city}, State: ${order.address.state}, PIN: ${order.address.pincode}`);
                    doc.text(`Phone: ${order.address.phone || user.phone}`);
                    doc.text(`Email: ${user.email}`);
                } else {
                    doc.text(`Name: ${user.name}`);
                    doc.text(`Email: ${user.email}`);
                    doc.text(`Phone: ${user.phone}`);
                }

                doc.moveDown(2);

                // Products Table Header
                const tableTop = doc.y;
                doc.fontSize(10).fillColor('#fff');
                
                // Table header background
                doc.rect(50, tableTop - 5, 500, 25).fill('#1c8125');
                doc.fillColor('#fff');
                doc.text('Product', 60, tableTop + 5, { width: 200 });
                doc.text('Price', 270, tableTop + 5, { width: 70, align: 'right' });
                doc.text('Qty', 350, tableTop + 5, { width: 50, align: 'center' });
                doc.text('Total', 450, tableTop + 5, { width: 100, align: 'right' });

                // Products
                let y = tableTop + 35;
                doc.fillColor('#333');
                
                if (order.items && order.items.length > 0) {
                    order.items.forEach((item, index) => {
                        const product = item.product || products.find(p => p._id.toString() === item.product.toString());
                        
                        if (product) {
                            const rowHeight = 20;
                            
                            // Alternate row colors
                            if (index % 2 === 0) {
                                doc.rect(50, y - 5, 500, rowHeight).fill('#f8f9fa');
                            }
                            
                            doc.fillColor('#333');
                            doc.text(product.name || 'Product', 60, y, { width: 200, ellipsis: true });
                            doc.text(`₹${product.price}`, 270, y, { width: 70, align: 'right' });
                            doc.text(item.quantity.toString(), 350, y, { width: 50, align: 'center' });
                            doc.text(`₹${(product.price * item.quantity).toFixed(2)}`, 450, y, { width: 100, align: 'right' });
                            
                            y += rowHeight + 5;
                        }
                    });
                }

                // Totals
                y += 10;
                doc.fontSize(11).fillColor('#333');
                
                const subtotal = order.subtotal || order.items.reduce((sum, item) => {
                    const product = products.find(p => p._id.toString() === item.product.toString());
                    return sum + (product ? product.price * item.quantity : 0);
                }, 0);

                const gst = subtotal * 0.05; // 5% GST
                const total = order.totalAmount || subtotal + gst;

                doc.text('Subtotal:', 350, y, { width: 100, align: 'right' });
                doc.text(`₹${subtotal.toFixed(2)}`, 450, y, { width: 100, align: 'right' });
                
                y += 20;
                doc.text('GST (5%):', 350, y, { width: 100, align: 'right' });
                doc.text(`₹${gst.toFixed(2)}`, 450, y, { width: 100, align: 'right' });
                
                y += 25;
                doc.fontSize(14).fillColor('#1c8125').font('Helvetica-Bold');
                doc.text('Grand Total:', 350, y, { width: 100, align: 'right' });
                doc.text(`₹${total.toFixed(2)}`, 450, y, { width: 100, align: 'right' });

                // Footer
                doc.fontSize(9).fillColor('#666');
                doc.moveDown(3);
                doc.text('Thank you for shopping with us!', { align: 'center' });
                doc.text('For any queries, please contact our customer support.', { align: 'center' });
                doc.text('This is a computer-generated invoice and does not require a signature.', { align: 'center' });
                doc.moveDown(1);
                doc.text('© 2025 Shri Govind Pharmacy. All rights reserved.', { align: 'center' });

                // Finalize PDF
                doc.end();

                stream.on('finish', () => {
                    console.log(`✅ Invoice generated: ${fileName}`);
                    resolve({
                        success: true,
                        fileName: fileName,
                        filePath: filePath,
                        url: `/invoices/${fileName}`
                    });
                });

                stream.on('error', (error) => {
                    console.error('❌ Invoice generation error:', error);
                    reject({
                        success: false,
                        message: 'Failed to generate invoice',
                        error: error.message
                    });
                });

            } catch (error) {
                console.error('Invoice generation error:', error);
                reject({
                    success: false,
                    message: 'Failed to generate invoice',
                    error: error.message
                });
            }
        });
    }

    // Download Invoice
    static async downloadInvoice(res, filePath, fileName) {
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({
                success: false,
                message: 'Invoice not found'
            });
        }

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
        
        const filestream = fs.createReadStream(filePath);
        filestream.pipe(res);
    }
}

module.exports = InvoiceGenerator;
