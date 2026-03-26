const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

// Invoice Generator Service
class InvoiceGenerator {
    // Generate PDF Invoice
    static async generateInvoice(order, user, products) {
        return new Promise((resolve, reject) => {
            try {
                // Validate required data
                if (!order || !order.tracking || !order.tracking.orderId) {
                    throw new Error('Invalid order data: missing tracking information');
                }

                // Create invoices directory if it doesn't exist
                const invoicesDir = path.join(__dirname, '..', 'public', 'invoices');
                if (!fs.existsSync(invoicesDir)) {
                    fs.mkdirSync(invoicesDir, { recursive: true });
                }

                const fileName = `invoice-${order.tracking.orderId}.pdf`;
                const filePath = path.join(invoicesDir, fileName);

                // Create PDF document with proper font encoding
                const doc = new PDFDocument({ 
                    margin: 50, 
                    size: 'A4',
                    font: 'Helvetica',
                    autoFirstPage: true
                });
                const stream = fs.createWriteStream(filePath);

                doc.pipe(stream);

                // Header - Use simple text without emoji for better compatibility
                doc
                    .fontSize(22)
                    .fillColor('#1c8125')
                    .font('Helvetica-Bold')
                    .text('Shri Govind Pharmacy', { align: 'center' })
                    .fontSize(11)
                    .fillColor('#333')
                    .font('Helvetica')
                    .text('Your Health, Our Priority', { align: 'center', width: 500 })
                    .moveDown(0.5);

                // Company Info
                doc
                    .fontSize(10)
                    .text('Shop No. 123, Main Market, City - 123456', { align: 'center' })
                    .text('Phone: +91 98765 43210 | Email: support@shrigovindpharmacy.com', { align: 'center' })
                    .text('GSTIN: 08ATYPS6691Q2ZZ', { align: 'center' })
                    .moveDown(1);

                // Invoice Title
                doc
                    .fontSize(20)
                    .fillColor('#333')
                    .text('TAX INVOICE', { align: 'center' })
                    .moveDown(1);

                // Invoice Details Section
                doc.moveDown(1);

                // Draw a box for invoice details - Increased height for better spacing
                const detailsTop = doc.y;
                const detailsBoxHeight = 85; // Increased from 70
                doc.rect(50, detailsTop - 5, 500, detailsBoxHeight).fill('#f8f9fa');
                doc.strokeColor('#ddd').lineWidth(1).rect(50, detailsTop - 5, 500, detailsBoxHeight);

                doc.fontSize(10).fillColor('#333');
                const invoiceDetails = [
                    { label: 'Invoice No:', value: order.tracking.orderId },
                    { label: 'Invoice Date:', value: new Date(order.createdAt).toLocaleDateString('en-IN') },
                    { label: 'Order Date:', value: new Date(order.createdAt).toLocaleDateString('en-IN') },
                    { label: 'Payment Method:', value: (order.payment && order.payment.method) ? order.payment.method.toUpperCase() : (order.paymentMethod || 'COD') },
                    { label: 'Payment Status:', value: (order.payment && order.payment.status) ? order.payment.status.toUpperCase() : (order.paymentStatus || 'Pending') }
                ];

                let detailY = detailsTop + 8; // Increased from 5 for better top spacing
                invoiceDetails.forEach((item) => {
                    doc.text(`${item.label} ${item.value}`, 60, detailY, { width: 200 });
                    detailY += 16; // Increased from 14 for better line spacing
                });

                doc.moveDown(2);

                // Billing Address Section
                doc.fontSize(12).fillColor('#1c8125').font('Helvetica-Bold').text('Billing Address:', { underline: true });
                doc.moveDown(0.5);
                doc.fontSize(10).fillColor('#333').font('Helvetica');

                // Get billing address from order (schema uses: fullName, email, phone, address, city, state, pincode, landmark)
                const billingAddress = order.address || {};
                
                if (billingAddress && Object.keys(billingAddress).length > 0) {
                    const addressName = billingAddress.fullName || billingAddress.name || user?.name || 'N/A';
                    const addressLine = billingAddress.address || billingAddress.fullAddress || billingAddress.street || 'N/A';
                    const cityState = `${billingAddress.city || 'N/A'}, ${billingAddress.state || 'N/A'} - ${billingAddress.pincode || 'N/A'}`;
                    const phone = billingAddress.phone || billingAddress.mobile || user?.phone || 'N/A';
                    const email = billingAddress.email || user?.email || 'N/A';
                    
                    doc.text(`Name: ${addressName}`);
                    doc.text(`Address: ${addressLine}`);
                    doc.text(`City: ${cityState}`);
                    doc.text(`Phone: ${phone}`);
                    doc.text(`Email: ${email}`);
                } else if (user) {
                    doc.text(`Name: ${user.name || 'N/A'}`);
                    doc.text(`Email: ${user.email || 'N/A'}`);
                    doc.text(`Phone: ${user.phone || 'N/A'}`);
                } else {
                    doc.text('Address information not available');
                }

                doc.moveDown(2);

                // Products Table Header - Fixed column alignment
                const tableTop = doc.y;
                const tableWidth = 500;
                const headerHeight = 30;
                const rowHeight = 28;
                
                // Column positions (left edge)
                const colProduct = 60;
                const colPrice = 320;
                const colQty = 410;
                const colTotal = 470;
                
                // Column widths
                const widthProduct = 250;
                const widthPrice = 80;
                const widthQty = 50;
                const widthTotal = 100;

                // Table header background
                doc.rect(50, tableTop - 5, tableWidth, headerHeight).fill('#1c8125');

                // Table header text - centered vertically
                doc.fontSize(11).fillColor('#fff').font('Helvetica-Bold');
                const headerY = tableTop + 8;
                doc.text('Product', colProduct, headerY, { width: widthProduct, ellipsis: true });
                doc.text('Price', colPrice, headerY, { width: widthPrice, align: 'right' });
                doc.text('Qty', colQty, headerY, { width: widthQty, align: 'center' });
                doc.text('Total', colTotal, headerY, { width: widthTotal, align: 'right' });

                // Draw table header border
                doc.strokeColor('#0a4a10').lineWidth(1);
                doc.rect(50, tableTop - 5, tableWidth, headerHeight);

                // Products rows
                let y = tableTop + headerHeight;
                doc.fillColor('#222').fontSize(10).font('Helvetica');

                if (order.items && order.items.length > 0) {
                    order.items.forEach((item, index) => {
                        const product = item.product || (products && products.find(p => p._id && p._id.toString() === item.product?.toString()));
                        const productName = product ? product.name : (item.name || 'Product');
                        const price = item.price || (product ? product.price : 0);
                        const quantity = item.quantity || 0;
                        const itemTotal = price * quantity;

                        const currentRowHeight = rowHeight;

                        // Alternate row colors with better contrast
                        if (index % 2 === 0) {
                            doc.rect(50, y - 5, tableWidth, currentRowHeight).fill('#f0f5f0');
                        }

                        // Draw row border
                        doc.strokeColor('#ccc').lineWidth(0.5);
                        doc.rect(50, y - 5, tableWidth, currentRowHeight);

                        // Row text - aligned to columns
                        const rowY = y + 6;
                        doc.fillColor('#222');
                        doc.text(productName, colProduct, rowY, { width: widthProduct, ellipsis: true });
                        doc.text(`Rs. ${price.toFixed(2)}`, colPrice, rowY, { width: widthPrice, align: 'right' });
                        doc.text(quantity.toString(), colQty, rowY, { width: widthQty, align: 'center' });
                        doc.text(`Rs. ${itemTotal.toFixed(2)}`, colTotal, rowY, { width: widthTotal, align: 'right' });

                        y += currentRowHeight;
                    });

                    // Draw bottom border
                    doc.strokeColor('#1c8125').lineWidth(1.5);
                    doc.rect(50, y - 5, tableWidth, 2);
                    y += 5;
                } else {
                    doc.fillColor('#666').fontSize(10);
                    doc.text('No items in this order', 60, y + 6, { width: 480, align: 'center' });
                    y += rowHeight + 5;
                }

                // Totals Section with better visibility
                y += 15;
                const totalsWidth = 200;
                const totalsX = 350;

                // Calculate totals safely
                let subtotal = 0;
                if (order.pricing && order.pricing.subtotal !== undefined) {
                    subtotal = order.pricing.subtotal;
                } else if (order.subtotal !== undefined) {
                    subtotal = order.subtotal;
                } else if (order.items && order.items.length > 0) {
                    subtotal = order.items.reduce((sum, item) => {
                        const product = products && products.find(p => p && p._id && p._id.toString() === item.product?.toString());
                        return sum + ((item.price || (product ? product.price : 0)) * (item.quantity || 0));
                    }, 0);
                }

                const gst = subtotal * 0.05; // 5% GST
                const total = order.totalAmount || (order.pricing && order.pricing.total) || subtotal + gst;

                // Draw totals box background
                const totalsBoxHeight = 85;
                doc.rect(totalsX - 10, y - 10, totalsWidth + 20, totalsBoxHeight).fill('#f8f9fa');
                doc.strokeColor('#1c8125').lineWidth(1).rect(totalsX - 10, y - 10, totalsWidth + 20, totalsBoxHeight);

                doc.fontSize(11).fillColor('#333').font('Helvetica');

                let totalsY = y + 8;
                // Subtotal row
                doc.text('Subtotal:', totalsX, totalsY, { width: 100, align: 'right' });
                doc.text(`Rs. ${subtotal.toFixed(2)}`, 450, totalsY, { width: 100, align: 'right' });

                totalsY += 24;
                // GST row
                doc.text('GST (5%):', totalsX, totalsY, { width: 100, align: 'right' });
                doc.text(`Rs. ${gst.toFixed(2)}`, 450, totalsY, { width: 100, align: 'right' });

                totalsY += 26;
                // Draw separator line before grand total
                doc.strokeColor('#1c8125').lineWidth(2);
                doc.moveTo(totalsX - 10, totalsY - 3).lineTo(500, totalsY - 3).stroke();

                totalsY += 8;
                // Grand Total row
                doc.fontSize(14).fillColor('#1c8125').font('Helvetica-Bold');
                doc.text('Grand Total:', totalsX, totalsY, { width: 100, align: 'right' });
                doc.text(`Rs. ${total.toFixed(2)}`, 450, totalsY, { width: 100, align: 'right' });

                // Footer - Fixed text layout with proper width
                doc.fontSize(9).fillColor('#666').font('Helvetica');
                const footerStartY = totalsY + 30;
                doc.text('Thank you for shopping with us!', 50, footerStartY, { align: 'center', width: 500 });
                doc.text('For any queries, please contact our customer support.', 50, footerStartY + 14, { align: 'center', width: 500 });
                doc.text('This is a computer-generated invoice and does not require a signature.', 50, footerStartY + 28, { align: 'center', width: 500 });
                doc.text('© 2025 Shri Govind Pharmacy. All rights reserved.', 50, footerStartY + 42, { align: 'center', width: 500 });

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
                console.error('Error stack:', error.stack);
                reject({
                    success: false,
                    message: 'Failed to generate invoice',
                    error: error.message,
                    stack: error.stack
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
        
        filestream.on('end', () => {
            console.log('Invoice download completed:', fileName);
        });
        
        filestream.on('error', (err) => {
            console.error('File stream error:', err);
            if (!res.headersSent) {
                res.status(500).json({ success: false, message: 'Download failed' });
            }
        });
    }
}

module.exports = InvoiceGenerator;
