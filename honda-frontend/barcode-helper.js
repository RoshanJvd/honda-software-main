// QR Code and Barcode Scanning Helper
// Uses html5-qrcode library for mobile camera scanning

class QRScanner {
  constructor() {
    this.scanner = null;
    this.isScanning = false;
    this.scanModal = null;
    this.resultModal = null;
    this.init();
  }

  init() {
    this.createScanModal();
    this.createResultModal();
  }

  createScanModal() {
    // Create scan modal
    this.scanModal = document.createElement('dialog');
    this.scanModal.id = 'qrScanModal';
    this.scanModal.innerHTML = `
      <div style="padding: 20px; text-align: center;">
        <h3>Scan QR Code</h3>
        <div id="qr-reader" style="width: 100%; max-width: 400px; margin: 0 auto;"></div>
        <div style="margin-top: 20px;">
          <button id="stopScanBtn" class="ghost" style="margin-right: 10px;">Stop Scanning</button>
          <button id="closeScanBtn" class="ghost">Close</button>
        </div>
      </div>
    `;
    document.body.appendChild(this.scanModal);

    // Add event listeners
    document.getElementById('stopScanBtn').addEventListener('click', () => this.stopScanning());
    document.getElementById('closeScanBtn').addEventListener('click', () => this.closeScanModal());
  }

  createResultModal() {
    // Create result modal
    this.resultModal = document.createElement('dialog');
    this.resultModal.id = 'qrResultModal';
    this.resultModal.innerHTML = `
      <div style="padding: 20px; max-width: 500px;">
        <h3>Item Details</h3>
        <div id="itemDetails" style="margin: 20px 0;"></div>
        <div style="text-align: right;">
          <button id="closeResultBtn" class="primary">Close</button>
        </div>
      </div>
    `;
    document.body.appendChild(this.resultModal);

    // Add event listener
    document.getElementById('closeResultBtn').addEventListener('click', () => this.closeResultModal());
  }

  async startScanning() {
    if (this.isScanning) return;

    try {
      this.scanner = new Html5Qrcode("qr-reader");

      const config = {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0
      };

      this.isScanning = true;
      this.scanModal.showModal();

      await this.scanner.start(
        { facingMode: "environment" }, // Use back camera
        config,
        this.onScanSuccess.bind(this),
        this.onScanFailure.bind(this)
      );
    } catch (error) {
      console.error("Error starting scanner:", error);
      alert("Error accessing camera. Please ensure camera permissions are granted.");
      this.isScanning = false;
    }
  }

  stopScanning() {
    if (this.scanner && this.isScanning) {
      this.scanner.stop().then(() => {
        this.isScanning = false;
        console.log("Scanner stopped");
      }).catch(err => {
        console.error("Error stopping scanner:", err);
      });
    }
  }

  closeScanModal() {
    this.stopScanning();
    this.scanModal.close();
  }

  closeResultModal() {
    this.resultModal.close();
  }

  async onScanSuccess(decodedText, decodedResult) {
    console.log("QR Code detected:", decodedText);

    // Stop scanning immediately after successful scan
    this.stopScanning();

    // Process the scanned code
    await this.processScannedCode(decodedText);
  }

  onScanFailure(error) {
    // Ignore scan failures - they're normal
    // console.log("Scan failure:", error);
  }

  async processScannedCode(code) {
    try {
      console.log("Processing scanned code:", code);

      // Call backend scan endpoint
      const response = await fetch(`${window.__API_BASE}/items/scan/${encodeURIComponent(code)}`, {
        headers: {
          'Content-Type': 'application/json',
          'x-role': localStorage.getItem('role') || 'agent',
          'x-user-id': JSON.parse(localStorage.getItem('auth.user') || 'null')?.id || null
        }
      });

      if (response.ok) {
        const item = await response.json();
        this.displayItemDetails(item);
      } else if (response.status === 404) {
        this.displayNotFound(code);
      } else {
        const error = await response.json();
        alert(`Scan failed: ${error.message || 'Unknown error'}`);
      }
    } catch (error) {
      console.error("Error processing scanned code:", error);
      alert("Error processing scanned code. Please try again.");
    }
  }

  displayItemDetails(item) {
    const detailsDiv = document.getElementById('itemDetails');

    detailsDiv.innerHTML = `
      <div style="border: 1px solid #ddd; border-radius: 8px; padding: 15px; background: #f9f9f9;">
        <h4 style="margin: 0 0 15px 0; color: #333;">${this.escapeHtml(item.name)}</h4>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 15px;">
          <div><strong>SKU:</strong> ${this.escapeHtml(item.sku || 'N/A')}</div>
          <div><strong>Barcode:</strong> ${this.escapeHtml(item.barcode || 'N/A')}</div>
          <div><strong>Quantity:</strong> ${item.qty || 0}</div>
          <div><strong>Low Stock:</strong> ${item.low || 5}</div>
          <div><strong>Purchase Price:</strong> Rs. ${item.buy || 0}</div>
          <div><strong>Sell Price:</strong> Rs. ${item.sell || 0}</div>
        </div>

        ${item.supplier ? `<div style="margin-bottom: 10px;"><strong>Supplier:</strong> ${this.escapeHtml(item.supplier)}</div>` : ''}
        ${item.desc ? `<div style="margin-bottom: 10px;"><strong>Description:</strong> ${this.escapeHtml(item.desc)}</div>` : ''}

        <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #ddd;">
          <small style="color: #666;">
            Created: ${new Date(item.createdAt).toLocaleDateString()}<br>
            Last Updated: ${new Date(item.updatedAt).toLocaleDateString()}
          </small>
        </div>
      </div>
    `;

    this.resultModal.showModal();
  }

  displayNotFound(code) {
    const detailsDiv = document.getElementById('itemDetails');

    detailsDiv.innerHTML = `
      <div style="text-align: center; padding: 20px;">
        <div style="color: #d32f2f; font-size: 48px; margin-bottom: 15px;">⚠️</div>
        <h4 style="color: #d32f2f; margin: 0 0 15px 0;">Item Not Found</h4>
        <p>No item found with code: <strong>${this.escapeHtml(code)}</strong></p>
        <p style="color: #666; margin-top: 15px;">
          Make sure the QR code contains a valid SKU or barcode that exists in the inventory.
        </p>
      </div>
    `;

    this.resultModal.showModal();
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// Global scanner instance
window.qrScanner = new QRScanner();

// Function to start QR scanning (can be called from anywhere)
window.startQRScan = function() {
  if (window.qrScanner) {
    window.qrScanner.startScanning();
  }
};

// Add QR scan button to inventory view (if not already present)
document.addEventListener('DOMContentLoaded', function() {
  // Wait for the app to load, then add scan button
  setTimeout(() => {
    const inventoryView = document.querySelector('[data-view="inventory"]');
    if (inventoryView) {
      // Check if scan button already exists
      if (!document.getElementById('qrScanBtn')) {
        const scanBtn = document.createElement('button');
        scanBtn.id = 'qrScanBtn';
        scanBtn.innerHTML = '📱 Scan QR Code';
        scanBtn.style.cssText = `
          background: #1976d2;
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 4px;
          cursor: pointer;
          margin-left: 10px;
          font-size: 14px;
        `;

        scanBtn.addEventListener('click', () => {
          window.startQRScan();
        });

        // Insert after the inventory button
        const nav = document.getElementById('nav');
        if (nav) {
          const inventoryBtn = nav.querySelector('[data-view="inventory"]');
          if (inventoryBtn && inventoryBtn.parentNode) {
            inventoryBtn.parentNode.insertBefore(scanBtn, inventoryBtn.nextSibling);
          }
        }
      }
    }
  }, 1000);
});
