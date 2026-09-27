export function generateInvoice({ shop, items, total, method, customerName = 'Walk-in Customer' }) {
  const invoiceNo = `INV-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
  const dateStr = new Date().toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  const itemsHtml = items.map((item, idx) => `
    <tr>
      <td style="padding: 8px 0; border-bottom: 1px dashed #ddd; font-size: 14px;">${idx + 1}. ${item.name}</td>
      <td style="padding: 8px 0; border-bottom: 1px dashed #ddd; text-align: center; font-size: 14px;">${item.qty} ${item.unit || 'pc'}</td>
      <td style="padding: 8px 0; border-bottom: 1px dashed #ddd; text-align: right; font-size: 14px;">₹${item.price}</td>
      <td style="padding: 8px 0; border-bottom: 1px dashed #ddd; text-align: right; font-weight: bold; font-size: 14px;">₹${item.qty * item.price}</td>
    </tr>
  `).join('');

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Receipt ${invoiceNo}</title>
      <meta charset="utf-8" />
      <style>
        body {
          font-family: 'Courier New', Courier, monospace, sans-serif;
          max-width: 380px;
          margin: 0 auto;
          padding: 20px 15px;
          color: #111;
          background: #fff;
        }
        .header {
          text-align: center;
          border-bottom: 2px solid #000;
          padding-bottom: 12px;
          margin-bottom: 14px;
        }
        .shop-name {
          font-size: 22px;
          font-weight: 900;
          margin: 0 0 4px 0;
          text-transform: uppercase;
        }
        .shop-info {
          font-size: 13px;
          color: #444;
          margin: 2px 0;
        }
        .meta {
          font-size: 13px;
          margin-bottom: 14px;
          line-height: 1.5;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 16px;
        }
        th {
          text-align: left;
          font-size: 13px;
          border-bottom: 2px solid #000;
          padding-bottom: 6px;
          text-transform: uppercase;
        }
        .totals {
          border-top: 2px solid #000;
          padding-top: 10px;
          font-size: 15px;
        }
        .total-row {
          display: flex;
          justify-content: space-between;
          margin-bottom: 6px;
        }
        .grand-total {
          font-size: 18px;
          font-weight: 900;
          border-top: 1px dashed #000;
          border-bottom: 2px solid #000;
          padding: 8px 0;
          margin: 10px 0;
        }
        .footer {
          text-align: center;
          font-size: 13px;
          margin-top: 20px;
          color: #333;
          line-height: 1.4;
        }
        .qr-placeholder {
          margin: 14px auto;
          text-align: center;
          padding: 10px;
          border: 1px dashed #999;
          border-radius: 6px;
          font-size: 11px;
          color: #666;
        }
        @media print {
          body { padding: 0; }
          .no-print { display: none; }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1 class="shop-name">${shop?.name || 'ANTARYA KIRANA STORE'}</h1>
        <div class="shop-info">Owner: ${shop?.ownerName || 'Shopkeeper'}</div>
        <div class="shop-info">City: ${shop?.city || 'India'} | Phone: ${shop?.phone || ''}</div>
      </div>

      <div class="meta">
        <div><strong>Bill No:</strong> ${invoiceNo}</div>
        <div><strong>Date:</strong> ${dateStr}</div>
        <div><strong>Customer:</strong> ${customerName}</div>
        <div><strong>Payment Mode:</strong> <span style="text-transform: uppercase; font-weight: bold;">${method}</span></div>
      </div>

      <table>
        <thead>
          <tr>
            <th>Item</th>
            <th style="text-align: center;">Qty</th>
            <th style="text-align: right;">Rate</th>
            <th style="text-align: right;">Total</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHtml}
        </tbody>
      </table>

      <div class="totals">
        <div class="total-row grand-total">
          <span>GRAND TOTAL:</span>
          <span>₹${total}</span>
        </div>
        <div class="total-row" style="font-size: 13px; color: #555;">
          <span>Items Count:</span>
          <span>${items.length} (${items.reduce((s, i) => s + i.qty, 0)} units)</span>
        </div>
      </div>

      <div class="qr-placeholder">
        ✨ Powered by ANTARYA - Store Intelligence ✨<br/>
        Save & Print this receipt right from your browser!
      </div>

      <div class="footer">
        <strong>🙏 Thank you for your visit! 🙏</strong><br/>
        Please visit us again. Have a wonderful day! 😊
      </div>

      <div class="no-print" style="margin-top: 24px; text-align: center;">
        <button onclick="window.print()" style="padding: 12px 24px; font-size: 16px; font-weight: bold; background: #10b981; color: white; border: none; border-radius: 6px; cursor: pointer; margin-right: 8px;">
          🖨️ Print / Save PDF
        </button>
        <button onclick="window.close()" style="padding: 12px 20px; font-size: 16px; background: #eee; color: #333; border: none; border-radius: 6px; cursor: pointer;">
          ❌ Close
        </button>
      </div>

      <script>
        // Auto trigger print prompt
        setTimeout(() => { window.print(); }, 400);
      </script>
    </body>
    </html>
  `;

  const printWindow = window.open('', '_blank', 'width=420,height=650');
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
  } else {
    alert('Please allow popups to print/download your invoice.');
  }
}
