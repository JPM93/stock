/* ============================================================
   GharSeva — masters.js
   Storage / Category / Brand / Seller masters + sidebar drawer.
   ============================================================ */
(function () {
    'use strict';
    const {
        showToast, escapeHtml, uid, initials, formatCurrency, formatDate,
        getStorages, getCategories, getBrands, getSellers, getItems, getStock,
        saveStorages, saveCategories, saveBrands, saveSellers,
        getStorageById, getCategoryById, getBrandById, getSellerById,
        getSellingPrice, getBestSellerPrice
    } = GS;

    // ─── Mobile Drawer ────────────────────────────────
    function openSidebar() {
        const sb = document.getElementById('sidebar'), ov = document.getElementById('sidebarOverlay');
        if (!sb) return;
        sb.classList.add('open'); if (ov) ov.classList.add('show');
        document.body.style.overflow = 'hidden';
    }
    function closeSidebar() {
        const sb = document.getElementById('sidebar'), ov = document.getElementById('sidebarOverlay');
        if (!sb) return;
        sb.classList.remove('open'); if (ov) ov.classList.remove('show');
        document.body.style.overflow = '';
    }

    // ═══ SELLER MASTER ═══
    function refreshSellers() {
        const grid = document.getElementById('sellersGrid');
        const sellers = getSellers();
        if (!grid) return;
        if (!sellers.length) { grid.innerHTML = '<div class="col-12 empty-state"><i class="fas fa-store"></i><p>No sellers yet. Add Zepto, Blinkit, etc.</p></div>'; return; }

        const items = getItems();
        const data = sellers.map(s => {
            let itemCount = 0, bestPriceWins = 0;
            items.forEach(i => {
                const sp = (i.sellers || []).find(x => x.sellerId === s.id);
                if (sp) {
                    itemCount++;
                    const best = getBestSellerPrice(i);
                    if (best && best.sellerId === s.id) bestPriceWins++;
                }
            });
            return { seller: s, itemCount, bestPriceWins };
        }).sort((a, b) => b.itemCount - a.itemCount);

        grid.innerHTML = data.map(d => {
            const s = d.seller;
            return `<div class="col-12 col-sm-6 col-lg-4">
                <div class="master-card">
                    <div class="d-flex gap-2 mb-3">
                        <div class="master-icon seller" style="font-weight:800;font-size:0.95rem;">${escapeHtml(initials(s.name))}</div>
                        <div style="min-width:0;flex:1;">
                            <h6 class="fw-bold mb-0">${escapeHtml(s.name)}</h6>
                            <small class="text-muted">Seller / Platform</small>
                        </div>
                    </div>
                    ${s.description ? `<p class="small text-muted mb-2">${escapeHtml(s.description)}</p>` : ''}
                    <div class="d-flex gap-2 mb-3 flex-wrap">
                        <span class="badge-soft pink"><i class="fas fa-tag me-1"></i>${d.itemCount} item${d.itemCount !== 1 ? 's' : ''}</span>
                        ${d.bestPriceWins ? `<span class="badge-soft green"><i class="fas fa-trophy me-1"></i>${d.bestPriceWins} best</span>` : ''}
                    </div>
                    <div class="d-flex justify-content-between align-items-center gap-2 flex-wrap">
                        <button class="btn btn-sm btn-outline-custom" onclick="viewSellerItems('${s.id}')"><i class="fas fa-list me-1"></i>Items</button>
                        <div>
                            <button class="btn btn-sm btn-outline-primary me-1" onclick="openSellerModal('edit','${s.id}')"><i class="fas fa-edit"></i></button>
                            <button class="btn btn-sm btn-outline-danger" onclick="deleteSeller('${s.id}')"><i class="fas fa-trash"></i></button>
                        </div>
                    </div>
                </div>
            </div>`;
        }).join('');
    }
    function openSellerModal(mode, id) {
        document.getElementById('sellerEditId').value = '';
        document.getElementById('sellerModalTitle').textContent = 'Add Seller';
        document.getElementById('sellerName').value = '';
        document.getElementById('sellerDescription').value = '';
        if (mode === 'edit' && id) {
            const s = getSellerById(id); if (!s) return;
            document.getElementById('sellerEditId').value = s.id;
            document.getElementById('sellerModalTitle').textContent = 'Edit Seller';
            document.getElementById('sellerName').value = s.name;
            document.getElementById('sellerDescription').value = s.description || '';
        }
        new bootstrap.Modal(document.getElementById('sellerModal')).show();
    }
    function saveSeller() {
        const name = document.getElementById('sellerName').value.trim();
        if (!name) { showToast('Seller name required', 'warning'); return; }
        const editId = document.getElementById('sellerEditId').value;
        const sellers = getSellers();
        if (sellers.find(s => s.name.toLowerCase() === name.toLowerCase() && s.id !== editId)) {
            showToast('Seller already exists', 'warning'); return;
        }
        const data = {
            id: editId || uid('slr'), name,
            description: document.getElementById('sellerDescription').value.trim(),
            createdAt: editId ? (getSellerById(editId)?.createdAt || new Date().toISOString()) : new Date().toISOString()
        };
        if (editId) { const i = sellers.findIndex(x => x.id === editId); if (i >= 0) sellers[i] = data; }
        else sellers.push(data);
        saveSellers(sellers);
        bootstrap.Modal.getInstance(document.getElementById('sellerModal')).hide();
        showToast(editId ? 'Seller updated!' : 'Seller added!', 'success');
        refreshSellers();
    }
    function deleteSeller(id) {
        let used = 0;
        getItems().forEach(i => { if ((i.sellers || []).some(s => s.sellerId === id)) used++; });
        if (used) { showToast(`Cannot delete — ${used} item(s) use this seller`, 'error'); return; }
        if (!confirm('Delete this seller?')) return;
        saveSellers(getSellers().filter(s => s.id !== id));
        showToast('Seller deleted', 'success');
        refreshSellers();
    }
    function viewSellerItems(sellerId) {
        const seller = getSellerById(sellerId); if (!seller) return;
        const itemsWithSeller = getItems().filter(i => (i.sellers || []).some(s => s.sellerId === sellerId));
        if (!itemsWithSeller.length) { showToast(`No items for ${seller.name} yet`, 'info'); return; }
        window.navigateTo('items');
    }

    function openQuickSellerModal(callback) {
        document.getElementById('quickSellerName').value = '';
        document.getElementById('quickSellerDescription').value = '';
        window.__quickSellerCallback = callback;
        new bootstrap.Modal(document.getElementById('quickSellerModal')).show();
    }
    function saveQuickSeller() {
        const name = document.getElementById('quickSellerName').value.trim();
        if (!name) { showToast('Seller name required', 'warning'); return; }
        const sellers = getSellers();
        if (sellers.find(s => s.name.toLowerCase() === name.toLowerCase())) {
            showToast('Seller already exists', 'warning'); return;
        }
        const data = {
            id: uid('slr'), name,
            description: document.getElementById('quickSellerDescription').value.trim(),
            createdAt: new Date().toISOString()
        };
        sellers.push(data);
        saveSellers(sellers);
        bootstrap.Modal.getInstance(document.getElementById('quickSellerModal')).hide();
        showToast('Seller added!', 'success');
        refreshSellers();
        if (window.__quickSellerCallback) {
            window.__quickSellerCallback(data.id);
            window.__quickSellerCallback = null;
        }
    }

    // ═══ STORAGE MASTER ═══
    function refreshStorages() {
        const grid = document.getElementById('storagesGrid');
        const storages = getStorages();
        if (!grid) return;
        if (!storages.length) { grid.innerHTML = '<div class="col-12 empty-state"><i class="fas fa-warehouse"></i><p>No storage locations yet.</p></div>'; return; }
        const iconMap = { rack: 'fa-layer-group', box: 'fa-box', refrigerator: 'fa-snowflake', cabinet: 'fa-cabinet-filing', room: 'fa-door-open', other: 'fa-cube' };
        grid.innerHTML = storages.map(s => {
            const stockCount = getStock().filter(st => st.storageId === s.id).length;
            return `<div class="col-12 col-sm-6 col-lg-4">
                <div class="master-card">
                    <div class="d-flex gap-2 mb-2">
                        <div class="master-icon"><i class="fas ${iconMap[s.type] || 'fa-cube'}"></i></div>
                        <div style="min-width:0;"><h6 class="fw-bold mb-0">${escapeHtml(s.name)}</h6><small class="text-muted">${escapeHtml(s.type || 'other')}</small></div>
                    </div>
                    <p class="small text-muted mb-2">${escapeHtml(s.description || 'No description')}</p>
                    <div class="d-flex justify-content-between align-items-center gap-2 flex-wrap">
                        <span class="badge-soft green">${stockCount} item${stockCount !== 1 ? 's' : ''}</span>
                        <div>
                            <button class="btn btn-sm btn-outline-primary me-1" onclick="openStorageModal('edit','${s.id}')"><i class="fas fa-edit"></i></button>
                            <button class="btn btn-sm btn-outline-danger" onclick="deleteStorage('${s.id}')"><i class="fas fa-trash"></i></button>
                        </div>
                    </div>
                </div>
            </div>`;
        }).join('');
    }
    function openStorageModal(mode, id) {
        document.getElementById('storageEditId').value = '';
        document.getElementById('storageModalTitle').textContent = 'Add Storage';
        document.getElementById('storageName').value = '';
        document.getElementById('storageType').value = 'rack';
        document.getElementById('storageDescription').value = '';
        if (mode === 'edit' && id) {
            const s = getStorageById(id); if (!s) return;
            document.getElementById('storageEditId').value = s.id;
            document.getElementById('storageModalTitle').textContent = 'Edit Storage';
            document.getElementById('storageName').value = s.name;
            document.getElementById('storageType').value = s.type || 'rack';
            document.getElementById('storageDescription').value = s.description || '';
        }
        new bootstrap.Modal(document.getElementById('storageModal')).show();
    }
    function saveStorage() {
        const name = document.getElementById('storageName').value.trim();
        if (!name) { showToast('Storage name required', 'warning'); return; }
        const editId = document.getElementById('storageEditId').value;
        const storages = getStorages();
        const data = {
            id: editId || uid('stg'), name,
            type: document.getElementById('storageType').value,
            description: document.getElementById('storageDescription').value.trim(),
            createdAt: editId ? (getStorageById(editId)?.createdAt || new Date().toISOString()) : new Date().toISOString()
        };
        if (editId) { const i = storages.findIndex(x => x.id === editId); if (i >= 0) storages[i] = data; }
        else storages.push(data);
        saveStorages(storages);
        bootstrap.Modal.getInstance(document.getElementById('storageModal')).hide();
        showToast(editId ? 'Storage updated!' : 'Storage added!', 'success');
        refreshStorages(); GS.app.refreshDropdowns(); GS.app.refreshDashboard();
    }
    function deleteStorage(id) {
        const used = getStock().filter(s => s.storageId === id).length;
        if (used) { showToast(`Cannot delete — ${used} stock item(s) use this storage`, 'error'); return; }
        if (!confirm('Delete this storage?')) return;
        saveStorages(getStorages().filter(s => s.id !== id));
        showToast('Storage deleted', 'success');
        refreshStorages(); GS.app.refreshDropdowns();
    }

    // ═══ CATEGORY MASTER ═══
    function refreshCategories() {
        const grid = document.getElementById('categoriesGrid');
        const cats = getCategories();
        if (!grid) return;
        if (!cats.length) { grid.innerHTML = '<div class="col-12 empty-state"><i class="fas fa-layer-group"></i><p>No categories yet.</p></div>'; return; }
        const colors = ['green', 'blue', 'orange', 'purple', 'red'];
        grid.innerHTML = cats.map((c, idx) => {
            const itemCount = getItems().filter(i => i.categoryId === c.id).length;
            return `<div class="col-12 col-sm-6 col-lg-4">
                <div class="master-card">
                    <div class="d-flex gap-2 mb-2">
                        <div class="master-icon category"><i class="fas fa-tag"></i></div>
                        <div style="min-width:0;"><h6 class="fw-bold mb-0">${escapeHtml(c.name)}</h6><small class="text-muted">Category</small></div>
                    </div>
                    <p class="small text-muted mb-2">${escapeHtml(c.description || 'No description')}</p>
                    <div class="d-flex justify-content-between align-items-center gap-2 flex-wrap">
                        <span class="badge-soft ${colors[idx % colors.length]}">${itemCount} item${itemCount !== 1 ? 's' : ''}</span>
                        <div>
                            <button class="btn btn-sm btn-outline-primary me-1" onclick="openCategoryModal('edit','${c.id}')"><i class="fas fa-edit"></i></button>
                            <button class="btn btn-sm btn-outline-danger" onclick="deleteCategory('${c.id}')"><i class="fas fa-trash"></i></button>
                        </div>
                    </div>
                </div>
            </div>`;
        }).join('');
    }
    function openCategoryModal(mode, id) {
        document.getElementById('categoryEditId').value = '';
        document.getElementById('categoryModalTitle').textContent = 'Add Category';
        document.getElementById('categoryName').value = '';
        document.getElementById('categoryDescription').value = '';
        if (mode === 'edit' && id) {
            const c = getCategoryById(id); if (!c) return;
            document.getElementById('categoryEditId').value = c.id;
            document.getElementById('categoryModalTitle').textContent = 'Edit Category';
            document.getElementById('categoryName').value = c.name;
            document.getElementById('categoryDescription').value = c.description || '';
        }
        new bootstrap.Modal(document.getElementById('categoryModal')).show();
    }
    function saveCategory() {
        const name = document.getElementById('categoryName').value.trim();
        if (!name) { showToast('Category name required', 'warning'); return; }
        const editId = document.getElementById('categoryEditId').value;
        const cats = getCategories();
        const data = {
            id: editId || uid('cat'), name,
            description: document.getElementById('categoryDescription').value.trim(),
            createdAt: editId ? (getCategoryById(editId)?.createdAt || new Date().toISOString()) : new Date().toISOString()
        };
        if (editId) { const i = cats.findIndex(x => x.id === editId); if (i >= 0) cats[i] = data; }
        else cats.push(data);
        saveCategories(cats);
        bootstrap.Modal.getInstance(document.getElementById('categoryModal')).hide();
        showToast(editId ? 'Category updated!' : 'Category added!', 'success');
        refreshCategories(); GS.app.refreshDropdowns();
    }
    function deleteCategory(id) {
        const used = getItems().filter(i => i.categoryId === id).length;
        if (used) { showToast(`Cannot delete — ${used} item(s) use this category`, 'error'); return; }
        if (!confirm('Delete this category?')) return;
        saveCategories(getCategories().filter(c => c.id !== id));
        showToast('Category deleted', 'success');
        refreshCategories(); GS.app.refreshDropdowns();
    }

    // ═══ BRAND MASTER ═══
    function refreshBrands() {
        const grid = document.getElementById('brandsGrid');
        const brands = getBrands();
        if (!grid) return;
        if (!brands.length) { grid.innerHTML = '<div class="col-12 empty-state"><i class="fas fa-copyright"></i><p>No brands yet.</p></div>'; return; }
        const items = getItems();
        const data = brands.map(b => {
            const brandItems = items.filter(i => i.brandId === b.id);
            const itemCount = brandItems.length;
            let stockUnits = 0, value = 0;
            brandItems.forEach(i => {
                getStock().filter(s => s.itemId === i.id).forEach(s => {
                    stockUnits += Number(s.quantity) || 0;
                    value += getSellingPrice(i) * (Number(s.quantity) || 0);
                });
            });
            return { brand: b, itemCount, stockUnits, value };
        }).sort((a, b) => b.itemCount - a.itemCount);
        const maxItems = Math.max(...data.map(d => d.itemCount), 1);
        grid.innerHTML = data.map(d => {
            const b = d.brand;
            const pct = (d.itemCount / maxItems) * 100;
            return `<div class="col-12 col-sm-6 col-lg-4">
                <div class="master-card">
                    <div class="d-flex gap-2 mb-3">
                        <div class="master-icon brand" style="font-weight:800;font-size:0.95rem;">${escapeHtml(initials(b.name))}</div>
                        <div style="min-width:0;"><h6 class="fw-bold mb-0">${escapeHtml(b.name)}</h6><small class="text-muted">Brand</small></div>
                    </div>
                    ${b.description ? `<p class="small text-muted mb-2">${escapeHtml(b.description)}</p>` : ''}
                    <div class="mb-2">
                        <div class="d-flex justify-content-between mb-1"><small class="text-muted">Items used</small><small class="fw-bold">${d.itemCount}</small></div>
                        <div class="brand-usage-bar"><div style="width:${pct}%;"></div></div>
                    </div>
                    <div class="d-flex gap-2 mb-3 flex-wrap">
                        <span class="badge-soft blue"><i class="fas fa-cubes me-1"></i>${d.stockUnits.toFixed(0)} units</span>
                        <span class="badge-soft green"><i class="fas fa-indian-rupee-sign me-1"></i>${formatCurrency(d.value)}</span>
                    </div>
                    <div class="d-flex justify-content-between align-items-center gap-2 flex-wrap">
                        <button class="btn btn-sm btn-outline-custom" onclick="viewBrandItems('${b.id}')"><i class="fas fa-list me-1"></i>Items</button>
                        <div>
                            <button class="btn btn-sm btn-outline-primary me-1" onclick="openBrandModal('edit','${b.id}')"><i class="fas fa-edit"></i></button>
                            <button class="btn btn-sm btn-outline-danger" onclick="deleteBrand('${b.id}')"><i class="fas fa-trash"></i></button>
                        </div>
                    </div>
                </div>
            </div>`;
        }).join('');
    }
    function openBrandModal(mode, id) {
        document.getElementById('brandEditId').value = '';
        document.getElementById('brandModalTitle').textContent = 'Add Brand';
        document.getElementById('brandName').value = '';
        document.getElementById('brandDescription').value = '';
        if (mode === 'edit' && id) {
            const b = getBrandById(id); if (!b) return;
            document.getElementById('brandEditId').value = b.id;
            document.getElementById('brandModalTitle').textContent = 'Edit Brand';
            document.getElementById('brandName').value = b.name;
            document.getElementById('brandDescription').value = b.description || '';
        }
        new bootstrap.Modal(document.getElementById('brandModal')).show();
    }
    function saveBrand() {
        const name = document.getElementById('brandName').value.trim();
        if (!name) { showToast('Brand name required', 'warning'); return; }
        const editId = document.getElementById('brandEditId').value;
        const brands = getBrands();
        if (brands.find(b => b.name.toLowerCase() === name.toLowerCase() && b.id !== editId)) {
            showToast('Brand already exists', 'warning'); return;
        }
        const data = {
            id: editId || uid('brd'), name,
            description: document.getElementById('brandDescription').value.trim(),
            createdAt: editId ? (getBrandById(editId)?.createdAt || new Date().toISOString()) : new Date().toISOString()
        };
        if (editId) { const i = brands.findIndex(x => x.id === editId); if (i >= 0) brands[i] = data; }
        else brands.push(data);
        saveBrands(brands);
        bootstrap.Modal.getInstance(document.getElementById('brandModal')).hide();
        showToast(editId ? 'Brand updated!' : 'Brand added!', 'success');
        refreshBrands(); GS.app.refreshDropdowns(); GS.app.refreshDashboard();
    }
    function deleteBrand(id) {
        const used = getItems().filter(i => i.brandId === id).length;
        if (used) { showToast(`Cannot delete — ${used} item(s) use this brand`, 'error'); return; }
        if (!confirm('Delete this brand?')) return;
        saveBrands(getBrands().filter(b => b.id !== id));
        showToast('Brand deleted', 'success');
        refreshBrands(); GS.app.refreshDropdowns(); GS.app.refreshDashboard();
    }
    function viewBrandItems(brandId) {
        const brand = getBrandById(brandId); if (!brand) return;
        const brandItems = getItems().filter(i => i.brandId === brandId);
        if (!brandItems.length) { showToast(`No items for ${brand.name} yet`, 'info'); return; }
        window.navigateTo('items');
        setTimeout(() => {
            const filter = document.getElementById('itemBrandFilter');
            if (filter) { filter.value = brandId; window.GS.items.refreshItems(); }
        }, 100);
    }

    // ─── Exports ─────────────────────────────────────
    Object.assign(GS, {
        masters: {
            openSidebar, closeSidebar,
            refreshSellers, openSellerModal, saveSeller, deleteSeller, viewSellerItems,
            openQuickSellerModal, saveQuickSeller,
            refreshStorages, openStorageModal, saveStorage, deleteStorage,
            refreshCategories, openCategoryModal, saveCategory, deleteCategory,
            refreshBrands, openBrandModal, saveBrand, deleteBrand, viewBrandItems
        }
    });

    // Inline HTML ke liye
    window.openSellerModal = openSellerModal;
    window.saveSeller = saveSeller;
    window.deleteSeller = deleteSeller;
    window.viewSellerItems = viewSellerItems;
    window.openQuickSellerModal = openQuickSellerModal;
    window.saveQuickSeller = saveQuickSeller;

    window.openStorageModal = openStorageModal;
    window.saveStorage = saveStorage;
    window.deleteStorage = deleteStorage;

    window.openCategoryModal = openCategoryModal;
    window.saveCategory = saveCategory;
    window.deleteCategory = deleteCategory;

    window.openBrandModal = openBrandModal;
    window.saveBrand = saveBrand;
    window.deleteBrand = deleteBrand;
    window.viewBrandItems = viewBrandItems;
})();