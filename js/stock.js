/* ============================================================
   GharSeva — stock.js
   Stock master + item autocomplete + quick adjust.
   ============================================================ */
(function () {
    'use strict';
    const {
        showToast, escapeHtml, uid, formatCurrency, formatDate, todayISO,
        thumbHtml, applyBuyRate,
        getItems, getStock, getStorages, saveItems, saveStock,
        getItemById, getBrandById, getStorageById, getMinAlert, getSellingPrice
    } = GS;

    function getStockStatus(s) {
        const item = getItemById(s.itemId);
        const q = Number(s.quantity) || 0;
        const min = getMinAlert(item);
        if (q <= 0) return { label: 'Out of Stock', cls: 'red' };
        if (s.expiryDate && new Date(s.expiryDate) < new Date()) return { label: 'Expired', cls: 'red' };
        if (q <= min) return { label: 'Low Stock', cls: 'orange' };
        if (s.expiryDate) {
            const d = new Date(s.expiryDate); const diff = Math.ceil((d - new Date()) / 86400000);
            if (diff <= 30) return { label: `Expires in ${diff}d`, cls: 'orange' };
        }
        return { label: 'In Stock', cls: 'green' };
    }

    function setupStockItemAc() {
        GS.ac.acSetup('stockItemAc', {
            getSource: () => getItems().map(i => {
                const brand = getBrandById(i.brandId);
                return {
                    id: i.id,
                    label: `${brand ? brand.name + ' ' : ''}${i.itemName}`,
                    sub: `${i.size} ${i.unit}${brand ? ' · ' + brand.name : ''}`
                };
            }),
            onSelect: (id) => {
                document.getElementById('stockItem').value = id;
                onStockItemChange();
            },
            onClear: () => {
                document.getElementById('stockItem').value = '';
                onStockItemChange();
            }
        });
    }

    function refreshStock() {
        const tbody = document.getElementById('stockBody');
        const mob = document.getElementById('stockMobileList');
        if (!tbody || !mob) return;
        const search = (document.getElementById('stockSearch')?.value || '').toLowerCase();
        const brandFilter = document.getElementById('stockBrandFilter')?.value || '';
        const storageFilter = document.getElementById('stockStorageFilter')?.value || '';
        const statusFilter = document.getElementById('stockStatusFilter')?.value || '';
        let stock = getStock();
        if (storageFilter) stock = stock.filter(s => s.storageId === storageFilter);
        if (brandFilter) stock = stock.filter(s => { const item = getItemById(s.itemId); return item && item.brandId === brandFilter; });
        if (search) stock = stock.filter(s => { const item = getItemById(s.itemId); return item && (item.itemName || '').toLowerCase().includes(search); });
        if (statusFilter) {
            stock = stock.filter(s => {
                const st = getStockStatus(s);
                if (statusFilter === 'low') return st.label === 'Low Stock';
                if (statusFilter === 'out') return st.label === 'Out of Stock';
                if (statusFilter === 'expired') return st.label === 'Expired';
                if (statusFilter === 'expiring') return st.label.startsWith('Expires in');
                if (statusFilter === 'broken') return !!s.brokenPack;
                return true;
            });
        }
        stock = stock.sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));

        if (!stock.length) {
            tbody.innerHTML = '<tr><td colspan="9" class="empty-state"><i class="fas fa-boxes-stacked"></i><p>No stock entries found.</p></td></tr>';
            mob.innerHTML = '<div class="empty-state"><i class="fas fa-boxes-stacked"></i><p>No stock entries found.</p></div>';
            return;
        }

        tbody.innerHTML = stock.map(s => {
            const item = getItemById(s.itemId); if (!item) return '';
            const brand = getBrandById(item.brandId);
            const storage = getStorageById(s.storageId);
            const status = getStockStatus(s);
            const value = getSellingPrice(item) * (Number(s.quantity) || 0);
            return `<tr>
                <td><div class="d-flex align-items-center gap-2">${thumbHtml(item, 'md')}<div><strong>${escapeHtml(item.itemName)}</strong><br><small class="text-muted">${item.size} ${item.unit}</small></div></div></td>
                <td>${brand ? `<span class="badge-soft purple">${escapeHtml(brand.name)}</span>` : '<span class="text-muted">—</span>'}</td>
                <td>${storage ? `<i class="fas fa-warehouse text-muted me-1"></i>${escapeHtml(storage.name)}` : '<span class="text-muted">—</span>'}</td>
                <td><strong>${Number(s.quantity) || 0}</strong>${s.rate ? `<br><small class="text-muted">@ ${formatCurrency(s.rate)}</small>` : ''}</td>
                <td>${s.batchNumber ? `<span class="batch-chip"><i class="fas fa-barcode"></i>${escapeHtml(s.batchNumber)}</span>` : '<span class="text-muted">—</span>'}</td>
                <td>${s.expiryDate ? formatDate(s.expiryDate) : '<span class="text-muted">—</span>'}</td>
                <td>${formatCurrency(value)}</td>
                <td><span class="badge-soft ${status.cls}">${status.label}</span>${s.brokenPack ? '<br><span class="badge-soft orange mt-1"><i class="fas fa-box-open me-1"></i>Broken pack</span>' : ''}</td>
                <td>
                    <button class="btn btn-sm btn-outline-success me-1" onclick="quickAdjust('${s.id}', 1)"><i class="fas fa-plus"></i></button>
                    <button class="btn btn-sm btn-outline-warning me-1" onclick="quickAdjust('${s.id}', -1)"><i class="fas fa-minus"></i></button>
                    <button class="btn btn-sm btn-outline-primary me-1" onclick="openStockModal('edit','${s.id}')"><i class="fas fa-edit"></i></button>
                    <button class="btn btn-sm btn-outline-danger" onclick="deleteStock('${s.id}')"><i class="fas fa-trash"></i></button>
                </td>
            </tr>`;
        }).join('');

        mob.innerHTML = stock.map(s => {
            const item = getItemById(s.itemId); if (!item) return '';
            const brand = getBrandById(item.brandId);
            const storage = getStorageById(s.storageId);
            const status = getStockStatus(s);
            const value = getSellingPrice(item) * (Number(s.quantity) || 0);
            const min = getMinAlert(item);
            return `<div class="mobile-card">
                <div class="mobile-card-header">
                    ${thumbHtml(item, 'lg')}
                    <div style="min-width:0;flex:1;">
                        <div class="mobile-card-title">${escapeHtml(item.itemName)}</div>
                        <div class="mobile-card-sub">${item.size} ${escapeHtml(item.unit)} ${brand ? '· ' + escapeHtml(brand.name) : ''}</div>
                    </div>
                    <span class="badge-soft ${status.cls}">${status.label}</span>
                </div>
                <div class="mobile-card-row"><span class="label"><i class="fas fa-warehouse me-1"></i>Storage</span><span>${storage ? escapeHtml(storage.name) : '—'}</span></div>
                <div class="mobile-card-row"><span class="label">Quantity</span><span><strong>${Number(s.quantity) || 0}</strong> <small class="text-muted">(Alert ≤ ${min})</small></span></div>
                ${s.batchNumber ? `<div class="mobile-card-row"><span class="label"><i class="fas fa-barcode me-1"></i>Batch</span><span class="batch-chip">${escapeHtml(s.batchNumber)}</span></div>` : ''}
                ${s.brokenPack ? `<div class="mobile-card-row"><span class="label"><i class="fas fa-box-open me-1"></i>Broken Pack</span><span class="badge-soft orange">Available</span></div>` : ''}
                ${s.rate ? `<div class="mobile-card-row"><span class="label">Buy Rate</span><span>${formatCurrency(s.rate)}</span></div>` : ''}
                ${s.expiryDate ? `<div class="mobile-card-row"><span class="label">Expiry</span><span>${formatDate(s.expiryDate)}</span></div>` : ''}
                <div class="mobile-card-row"><span class="label">Value</span><span><strong>${formatCurrency(value)}</strong></span></div>
                <div class="mobile-card-actions">
                    <button class="btn btn-outline-success" onclick="quickAdjust('${s.id}', 1)"><i class="fas fa-plus"></i></button>
                    <button class="btn btn-outline-warning" onclick="quickAdjust('${s.id}', -1)"><i class="fas fa-minus"></i></button>
                    <button class="btn btn-outline-primary" onclick="openStockModal('edit','${s.id}')"><i class="fas fa-edit"></i></button>
                    <button class="btn btn-outline-danger" onclick="deleteStock('${s.id}')"><i class="fas fa-trash"></i></button>
                </div>
            </div>`;
        }).join('');
    }

    function quickAdjust(id, delta) {
        const stock = getStock();
        const s = stock.find(x => x.id === id); if (!s) return;
        s.quantity = Math.max(0, (Number(s.quantity) || 0) + delta);
        s.updatedAt = new Date().toISOString();
        saveStock(stock);
        refreshStock(); GS.app.refreshDashboard(); GS.app.updateBadges();
    }

    function openStockModal(mode, id, preselectedItemId) {
        if (!getItems().length) { showToast('Please add an item first', 'warning'); return; }
        if (!getStorages().length) { showToast('Please add a storage location first', 'warning'); return; }
        document.getElementById('stockEditId').value = '';
        document.getElementById('stockModalTitle').textContent = 'Add Stock';
        document.getElementById('stockQuantity').value = '1';
        document.getElementById('stockPurchaseDate').value = todayISO();
        document.getElementById('stockRate').value = '';
        document.getElementById('stockExpiry').value = '';
        document.getElementById('stockNotes').value = '';
        document.getElementById('stockBatch').value = '';
        document.getElementById('stockBroken').checked = false;
        document.getElementById('stockItem').value = '';
        document.getElementById('stockItemAc').value = '';
        GS.app.populateDropdown('stockStorage', getStorages().map(s => ({ id: s.id, label: s.name })), false);

        setupStockItemAc();

        if (mode === 'edit' && id) {
            const s = getStock().find(x => x.id === id); if (!s) return;
            document.getElementById('stockEditId').value = s.id;
            document.getElementById('stockModalTitle').textContent = 'Edit Stock';
            document.getElementById('stockItem').value = s.itemId;
            GS.ac.acSetValue('stockItemAc', s.itemId);
            document.getElementById('stockStorage').value = s.storageId;
            document.getElementById('stockQuantity').value = s.quantity;
            document.getElementById('stockBatch').value = s.batchNumber || '';
            document.getElementById('stockPurchaseDate').value = s.purchaseDate || '';
            document.getElementById('stockExpiry').value = s.expiryDate || '';
            document.getElementById('stockNotes').value = s.notes || '';
            document.getElementById('stockRate').value = (s.rate !== undefined && s.rate !== null) ? s.rate : '';
            document.getElementById('stockBroken').checked = !!s.brokenPack;
        } else if (preselectedItemId) {
            const it = getItemById(preselectedItemId);
            if (it) {
                document.getElementById('stockItem').value = preselectedItemId;
                GS.ac.acSetValue('stockItemAc', preselectedItemId);
                onStockItemChange();
            }
        } else {
            onStockItemChange();
        }
        new bootstrap.Modal(document.getElementById('stockModal')).show();
    }

    function onStockItemChange() {
        const id = document.getElementById('stockItem').value;
        const it = id ? getItemById(id) : null;
        const rateEl = document.getElementById('stockRate');
        if (rateEl) rateEl.value = (it && Number(it.price) > 0) ? it.price : '';
    }

    function saveStock() {
        const itemId = document.getElementById('stockItem').value;
        const storageId = document.getElementById('stockStorage').value;
        if (!itemId) { showToast('Item required — list se select karein', 'warning'); return; }
        if (!storageId) { showToast('Storage required', 'warning'); return; }
        const qty = parseFloat(document.getElementById('stockQuantity').value);
        if (isNaN(qty) || qty < 0) { showToast('Valid quantity required', 'warning'); return; }
        const rateRaw = document.getElementById('stockRate').value;
        const rate = rateRaw === '' ? null : parseFloat(rateRaw);
        if (rate !== null && (isNaN(rate) || rate < 0)) { showToast('Valid rate required', 'warning'); return; }
        const editId = document.getElementById('stockEditId').value;
        const stock = getStock();
        const data = {
            id: editId || uid('stk'),
            itemId, storageId, quantity: qty, rate,
            batchNumber: document.getElementById('stockBatch').value.trim() || '',
            purchaseDate: document.getElementById('stockPurchaseDate').value || null,
            expiryDate: document.getElementById('stockExpiry').value || null,
            notes: document.getElementById('stockNotes').value.trim(),
            brokenPack: document.getElementById('stockBroken').checked,
            createdAt: editId ? (stock.find(x => x.id === editId)?.createdAt || new Date().toISOString()) : new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        if (editId) { const i = stock.findIndex(x => x.id === editId); if (i >= 0) stock[i] = data; }
        else stock.push(data);
        if (!saveStock(stock)) return;
        let priceMsg = '';
        if (rate !== null && rate > 0) {
            const allItems = getItems();
            if (applyBuyRate(allItems, itemId, rate, data.purchaseDate)) {
                if (saveItems(allItems)) priceMsg = ` Base Price → ${formatCurrency(rate)}`;
            }
        }
        bootstrap.Modal.getInstance(document.getElementById('stockModal')).hide();
        showToast((editId ? 'Stock updated!' : 'Stock added!') + priceMsg, 'success');
        refreshStock(); GS.items.refreshItems(); GS.app.refreshDashboard(); GS.app.updateBadges();
    }

    function deleteStock(id) {
        if (!confirm('Delete this stock entry?')) return;
        saveStock(getStock().filter(s => s.id !== id));
        showToast('Stock deleted', 'success');
        refreshStock(); GS.app.refreshDashboard(); GS.app.updateBadges();
    }

    Object.assign(GS, {
        stock: {
            getStockStatus, setupStockItemAc, refreshStock, quickAdjust,
            openStockModal, onStockItemChange, saveStock, deleteStock
        }
    });

    // Inline HTML ke liye
    window.quickAdjust = quickAdjust;
    window.openStockModal = openStockModal;
    window.onStockItemChange = onStockItemChange;
    window.saveStock = saveStock;
    window.deleteStock = deleteStock;
})();