(function () {
    let currentPage = 'dashboard';
    const PREFIX = 'gharseva_';

    // ─── Helpers ─────────────────────────────────────
    function showToast(msg, type = 'info') {
        const c = document.querySelector('.toast-container'); if (!c) return;
        const bg = { success: 'bg-success text-white', error: 'bg-danger text-white', info: 'bg-info text-dark', warning: 'bg-warning text-dark' }[type] || 'bg-info text-dark';
        const icon = { success: 'fa-check-circle', error: 'fa-exclamation-circle', info: 'fa-info-circle', warning: 'fa-exclamation-triangle' }[type] || 'fa-info-circle';
        const el = document.createElement('div');
        el.innerHTML = `<div class="toast align-items-center ${bg} border-0"><div class="d-flex"><div class="toast-body"><i class="fas ${icon} me-2"></i>${msg}</div><button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button></div></div>`;
        const n = el.firstChild; c.appendChild(n);
        const t = new bootstrap.Toast(n, { delay: 3000 }); t.show();
        n.addEventListener('hidden.bs.toast', () => n.remove());
    }
    function save(k, v) { try { localStorage.setItem(PREFIX + k, JSON.stringify(v)); return true; } catch (e) { showToast('Storage full', 'error'); return false; } }
    function load(k, d = null) { const r = localStorage.getItem(PREFIX + k); if (r === null) return d; try { return JSON.parse(r); } catch (e) { return d; } }
    function escapeHtml(s) { if (!s) return ''; const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
    function uid(prefix) { return prefix + '_' + Date.now() + Math.random().toString(36).substr(2, 6); }
    function formatDate(ds) { if (!ds) return '—'; const d = new Date(ds + 'T00:00:00'); return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }); }
    function formatCurrency(n) { return '₹' + (Number(n) || 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 }); }
    function initials(name) { if (!name) return '?'; return name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase(); }
    function isMobile() { return window.innerWidth < 768; }

    // ─── Data Accessors ──────────────────────────────
    function getStorages() { return load('storages', []); }
    function getCategories() { return load('categories', []); }
    function getBrands() { return load('brands', []); }
    function getItems() { return load('items', []); }
    function getStock() { return load('stock', []); }
    function getShopping() { return load('shopping', []); }
    function saveStorages(v) { save('storages', v); }
    function saveCategories(v) { save('categories', v); }
    function saveBrands(v) { save('brands', v); }
    function saveItems(v) { save('items', v); }
    function saveStock(v) { save('stock', v); }
    function saveShopping(v) { save('shopping', v); }

    function getAllData() {
        return {
            storages: getStorages(), categories: getCategories(), brands: getBrands(),
            items: getItems(), stock: getStock(), shopping: getShopping(),
            exportDate: new Date().toISOString(), version: '1.2'
        };
    }
    function restoreData(d) {
        if (d.storages) saveStorages(d.storages);
        if (d.categories) saveCategories(d.categories);
        if (d.brands) saveBrands(d.brands);
        if (d.items) saveItems(d.items);
        if (d.stock) saveStock(d.stock);
        if (d.shopping) saveShopping(d.shopping);
    }
    function getStorageById(id) { return getStorages().find(s => s.id === id); }
    function getCategoryById(id) { return getCategories().find(c => c.id === id); }
    function getBrandById(id) { return getBrands().find(b => b.id === id); }
    function getItemById(id) { return getItems().find(i => i.id === id); }

    // Effective min alert: item level
    function getMinAlert(item) {
        if (!item) return 1;
        return Number(item.minAlert) || 0;
    }
    // Selling price (fallback to MRP)
    function getSellingPrice(item) {
        if (!item) return 0;
        if (item.price !== undefined && item.price !== null && item.price !== '') return Number(item.price) || 0;
        return Number(item.mrp) || 0;
    }

    // ─── Mobile Drawer ────────────────────────────────
    function openSidebar() {
        const sb = document.getElementById('sidebar');
        const ov = document.getElementById('sidebarOverlay');
        if (!sb) return;
        sb.classList.add('open');
        if (ov) ov.classList.add('show');
        document.body.style.overflow = 'hidden';
    }
    function closeSidebar() {
        const sb = document.getElementById('sidebar');
        const ov = document.getElementById('sidebarOverlay');
        if (!sb) return;
        sb.classList.remove('open');
        if (ov) ov.classList.remove('show');
        document.body.style.overflow = '';
    }

    // ─── Navigation ──────────────────────────────────
    function navigateTo(page) {
        currentPage = page;
        document.querySelectorAll('.section-page').forEach(el => el.classList.remove('active'));
        const pEl = document.getElementById('page-' + page); if (pEl) pEl.classList.add('active');
        document.querySelectorAll('.sidebar-nav .nav-link').forEach(el => el.classList.remove('active'));
        const nav = document.querySelector(`[data-page="${page}"]`); if (nav) nav.classList.add('active');
        const titles = {
            dashboard: '📊 Dashboard', stock: '📦 Available Stock', items: '🏷️ Item Master',
            brands: '©️ Brand Master', categories: '📚 Category Master', storages: '🏠 Storage Master',
            shopping: '🛒 Shopping List', settings: '⚙️ Settings & Sync'
        };
        document.getElementById('pageTitle').textContent = titles[page] || page;

        // FAB visible on specific pages (mobile)
        const fab = document.getElementById('mobileFab');
        if (fab) {
            if (isMobile() && ['stock', 'items', 'brands', 'categories', 'storages'].includes(page)) {
                fab.style.display = 'flex';
                fab.onclick = function () {
                    if (page === 'stock') openStockModal();
                    else if (page === 'items') openItemModal();
                    else if (page === 'brands') openBrandModal();
                    else if (page === 'categories') openCategoryModal();
                    else if (page === 'storages') openStorageModal();
                };
            } else {
                fab.style.display = 'none';
            }
        }

        refreshCurrentPage();
        if (page === 'settings') loadDriveConfigInputs();

        // Auto-close drawer on mobile
        if (isMobile()) closeSidebar();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    window.navigateTo = navigateTo;

    function refreshCurrentPage() {
        switch (currentPage) {
            case 'dashboard': refreshDashboard(); break;
            case 'stock': refreshStock(); break;
            case 'items': refreshItems(); break;
            case 'brands': refreshBrands(); break;
            case 'categories': refreshCategories(); break;
            case 'storages': refreshStorages(); break;
            case 'shopping': refreshShopping(); break;
        }
        updateBadges();
    }
    function updateBadges() {
        const lowStock = getStock().filter(s => {
            const item = getItemById(s.itemId); const min = getMinAlert(item);
            const q = Number(s.quantity) || 0;
            return q > 0 && q <= min;
        }).length;
        const outOfStock = getStock().filter(s => (Number(s.quantity) || 0) <= 0).length;
        document.getElementById('stockBadgeCount').textContent = lowStock + outOfStock;
        const shoppingActive = getShopping().filter(s => !s.done).length;
        document.getElementById('shoppingBadgeCount').textContent = shoppingActive;
    }

    // ─── Dashboard ───────────────────────────────────
    function refreshDashboard() {
        const items = getItems(), stock = getStock();
        document.getElementById('statTotalItems').textContent = items.length;
        document.getElementById('statTotalStock').textContent = stock.length;

        const lowStock = stock.filter(s => {
            const item = getItemById(s.itemId); const min = getMinAlert(item);
            const q = Number(s.quantity) || 0;
            return q > 0 && q <= min;
        });
        const outOfStock = stock.filter(s => (Number(s.quantity) || 0) <= 0);
        document.getElementById('statLowStock').textContent = lowStock.length + outOfStock.length;

        let totalValue = 0;
        stock.forEach(s => { const item = getItemById(s.itemId); if (item) totalValue += getSellingPrice(item) * (Number(s.quantity) || 0); });
        document.getElementById('statInventoryValue').textContent = formatCurrency(totalValue);

        // Low stock alerts
        const lowStockList = document.getElementById('lowStockList');
        const alerts = [...outOfStock, ...lowStock].slice(0, 8);
        if (!alerts.length) { lowStockList.innerHTML = '<div class="empty-state"><i class="fas fa-check-circle text-success"></i><p>All items are well-stocked! 🎉</p></div>'; }
        else {
            lowStockList.innerHTML = alerts.map(s => {
                const item = getItemById(s.itemId); if (!item) return '';
                const brand = getBrandById(item.brandId);
                const isOut = (Number(s.quantity) || 0) <= 0;
                const min = getMinAlert(item);
                return `<div class="alert-item ${isOut ? 'danger' : ''}">
                    <div style="min-width:0;flex:1;">
                        <strong>${escapeHtml(brand?.name || '')} ${escapeHtml(item.itemName)}</strong><br>
                        <small class="text-muted">${escapeHtml(getStorageById(s.storageId)?.name || 'Unknown')} · Alert ≤ ${min}</small>
                    </div>
                    <span class="badge-soft ${isOut ? 'red' : 'orange'}">${isOut ? 'Out' : (Number(s.quantity)) + ' left'}</span>
                </div>`;
            }).join('');
        }

        // Expiring soon
        const expiringList = document.getElementById('expiringList');
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const in30 = new Date(today); in30.setDate(in30.getDate() + 30);
        const expiring = stock.filter(s => {
            if (!s.expiryDate) return false;
            const d = new Date(s.expiryDate); d.setHours(0, 0, 0, 0);
            return d >= today && d <= in30;
        }).sort((a, b) => new Date(a.expiryDate) - new Date(b.expiryDate)).slice(0, 8);

        if (!expiring.length) { expiringList.innerHTML = '<div class="empty-state"><i class="fas fa-check-circle text-success"></i><p>Nothing expiring in 30 days</p></div>'; }
        else {
            expiringList.innerHTML = expiring.map(s => {
                const item = getItemById(s.itemId); if (!item) return '';
                const brand = getBrandById(item.brandId);
                const d = new Date(s.expiryDate); const days = Math.ceil((d - today) / 86400000);
                return `<div class="alert-item">
                    <div style="min-width:0;flex:1;">
                        <strong>${escapeHtml(brand?.name || '')} ${escapeHtml(item.itemName)}</strong><br>
                        <small class="text-muted">${escapeHtml(getStorageById(s.storageId)?.name || '')}</small>
                    </div>
                    <span class="badge-soft orange">${days}d</span>
                </div>`;
            }).join('');
        }

        refreshBrandUsageWidget();

        const recent = [...items].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 5);
        const tbody = document.getElementById('recentItemsBody');
        if (!recent.length) { tbody.innerHTML = '<tr><td colspan="4" class="empty-state"><i class="fas fa-inbox"></i><p>No items yet.</p></td></tr>'; }
        else {
            tbody.innerHTML = recent.map(i => {
                const brand = getBrandById(i.brandId);
                return `<tr>
                    <td>${escapeHtml(i.itemName)}</td>
                    <td>${brand ? `<span class="badge-soft purple">${escapeHtml(brand.name)}</span>` : '<span class="text-muted">—</span>'}</td>
                    <td>${i.size} ${i.unit}</td>
                    <td>${formatCurrency(getSellingPrice(i))}</td>
                </tr>`;
            }).join('');
        }
    }

    function refreshBrandUsageWidget() {
        const container = document.getElementById('brandUsageList');
        if (!container) return;
        const brands = getBrands();
        const items = getItems();
        if (!brands.length) { container.innerHTML = '<div class="empty-state"><i class="fas fa-copyright"></i><p>No brands yet.</p></div>'; return; }

        const usage = brands.map(b => {
            const brandItems = items.filter(i => i.brandId === b.id);
            const itemCount = brandItems.length;
            let stockCount = 0, value = 0;
            brandItems.forEach(i => {
                getStock().filter(s => s.itemId === i.id).forEach(s => {
                    stockCount += Number(s.quantity) || 0;
                    value += getSellingPrice(i) * (Number(s.quantity) || 0);
                });
            });
            return { id: b.id, name: b.name, itemCount, stockCount, value };
        }).sort((a, b) => b.itemCount - a.itemCount).slice(0, 6);

        const maxItems = Math.max(...usage.map(u => u.itemCount), 1);

        container.innerHTML = usage.map(u => {
            const pct = (u.itemCount / maxItems) * 100;
            return `<div class="brand-usage-row">
                <div class="brand-usage-avatar">${escapeHtml(initials(u.name))}</div>
                <div style="flex:1;min-width:0;">
                    <div class="d-flex justify-content-between align-items-center">
                        <strong>${escapeHtml(u.name)}</strong>
                        <small class="text-muted">${u.itemCount} item${u.itemCount !== 1 ? 's' : ''}</small>
                    </div>
                    <div class="brand-usage-bar"><div style="width:${pct}%;"></div></div>
                    <small class="text-muted">Stock: ${u.stockCount.toFixed(0)} units · Value: ${formatCurrency(u.value)}</small>
                </div>
            </div>`;
        }).join('');
    }

    // ─── Storage Master ──────────────────────────────
    function refreshStorages() {
        const grid = document.getElementById('storagesGrid');
        const storages = getStorages();
        if (!storages.length) { grid.innerHTML = '<div class="col-12 empty-state"><i class="fas fa-warehouse"></i><p>No storage locations yet.</p></div>'; return; }
        const iconMap = { rack: 'fa-layer-group', box: 'fa-box', refrigerator: 'fa-snowflake', cabinet: 'fa-cabinet-filing', room: 'fa-door-open', other: 'fa-cube' };
        grid.innerHTML = storages.map(s => {
            const stockCount = getStock().filter(st => st.storageId === s.id).length;
            return `<div class="col-12 col-sm-6 col-lg-4">
                <div class="master-card">
                    <div class="d-flex gap-2 mb-2">
                        <div class="master-icon"><i class="fas ${iconMap[s.type] || 'fa-cube'}"></i></div>
                        <div style="min-width:0;">
                            <h6 class="fw-bold mb-0">${escapeHtml(s.name)}</h6>
                            <small class="text-muted">${escapeHtml(s.type || 'other')}</small>
                        </div>
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
    window.openStorageModal = function (mode, id) {
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
    };
    window.saveStorage = function () {
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
        refreshStorages(); refreshDropdowns(); refreshDashboard();
    };
    window.deleteStorage = function (id) {
        const used = getStock().filter(s => s.storageId === id).length;
        if (used) { showToast(`Cannot delete — ${used} stock item(s) use this storage`, 'error'); return; }
        if (!confirm('Delete this storage?')) return;
        saveStorages(getStorages().filter(s => s.id !== id));
        showToast('Storage deleted', 'success');
        refreshStorages(); refreshDropdowns();
    };

    // ─── Category Master ─────────────────────────────
    function refreshCategories() {
        const grid = document.getElementById('categoriesGrid');
        const cats = getCategories();
        if (!cats.length) { grid.innerHTML = '<div class="col-12 empty-state"><i class="fas fa-layer-group"></i><p>No categories yet.</p></div>'; return; }
        const colors = ['green', 'blue', 'orange', 'purple', 'red'];
        grid.innerHTML = cats.map((c, idx) => {
            const itemCount = getItems().filter(i => i.categoryId === c.id).length;
            return `<div class="col-12 col-sm-6 col-lg-4">
                <div class="master-card">
                    <div class="d-flex gap-2 mb-2">
                        <div class="master-icon category"><i class="fas fa-tag"></i></div>
                        <div style="min-width:0;">
                            <h6 class="fw-bold mb-0">${escapeHtml(c.name)}</h6>
                            <small class="text-muted">Category</small>
                        </div>
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
    window.openCategoryModal = function (mode, id) {
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
    };
    window.saveCategory = function () {
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
        refreshCategories(); refreshDropdowns();
    };
    window.deleteCategory = function (id) {
        const used = getItems().filter(i => i.categoryId === id).length;
        if (used) { showToast(`Cannot delete — ${used} item(s) use this category`, 'error'); return; }
        if (!confirm('Delete this category?')) return;
        saveCategories(getCategories().filter(c => c.id !== id));
        showToast('Category deleted', 'success');
        refreshCategories(); refreshDropdowns();
    };

    // ─── Brand Master ────────────────────────────────
    function refreshBrands() {
        const grid = document.getElementById('brandsGrid');
        const brands = getBrands();
        if (!brands.length) { grid.innerHTML = '<div class="col-12 empty-state"><i class="fas fa-copyright"></i><p>No brands yet. Add your first brand!</p></div>'; return; }

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
                        <div style="min-width:0;">
                            <h6 class="fw-bold mb-0">${escapeHtml(b.name)}</h6>
                            <small class="text-muted">Brand</small>
                        </div>
                    </div>
                    ${b.description ? `<p class="small text-muted mb-2">${escapeHtml(b.description)}</p>` : ''}
                    <div class="mb-2">
                        <div class="d-flex justify-content-between mb-1">
                            <small class="text-muted">Items used</small>
                            <small class="fw-bold">${d.itemCount}</small>
                        </div>
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
    window.openBrandModal = function (mode, id) {
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
    };
    window.saveBrand = function () {
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
        refreshBrands(); refreshDropdowns(); refreshDashboard();
    };
    window.deleteBrand = function (id) {
        const used = getItems().filter(i => i.brandId === id).length;
        if (used) { showToast(`Cannot delete — ${used} item(s) use this brand`, 'error'); return; }
        if (!confirm('Delete this brand?')) return;
        saveBrands(getBrands().filter(b => b.id !== id));
        showToast('Brand deleted', 'success');
        refreshBrands(); refreshDropdowns(); refreshDashboard();
    };
    window.viewBrandItems = function (brandId) {
        const brand = getBrandById(brandId); if (!brand) return;
        const brandItems = getItems().filter(i => i.brandId === brandId);
        if (!brandItems.length) { showToast(`No items for ${brand.name} yet`, 'info'); return; }
        navigateTo('items');
        setTimeout(() => {
            const filter = document.getElementById('itemBrandFilter');
            if (filter) { filter.value = brandId; refreshItems(); }
        }, 100);
    };

    // ─── Item Master ─────────────────────────────────
    function refreshItems() {
        const tbody = document.getElementById('itemsBody');
        const mob = document.getElementById('itemsMobileList');
        const search = (document.getElementById('itemSearch')?.value || '').toLowerCase();
        const catFilter = document.getElementById('itemCategoryFilter')?.value || '';
        const brandFilter = document.getElementById('itemBrandFilter')?.value || '';
        let items = getItems();
        if (search) items = items.filter(i => (i.itemName || '').toLowerCase().includes(search));
        if (catFilter) items = items.filter(i => i.categoryId === catFilter);
        if (brandFilter) items = items.filter(i => i.brandId === brandFilter);
        items = items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        if (!items.length) {
            tbody.innerHTML = '<tr><td colspan="8" class="empty-state"><i class="fas fa-tag"></i><p>No items found.</p></td></tr>';
            mob.innerHTML = '<div class="empty-state"><i class="fas fa-tag"></i><p>No items found.</p></div>';
            return;
        }

        // Desktop table
        tbody.innerHTML = items.map(i => {
            const cat = getCategoryById(i.categoryId);
            const brand = getBrandById(i.brandId);
            const mrp = Number(i.mrp) || 0;
            const price = getSellingPrice(i);
            const discount = mrp > price && mrp > 0 ? Math.round(((mrp - price) / mrp) * 100) : 0;
            return `<tr>
                <td>${brand ? `<span class="badge-soft purple">${escapeHtml(brand.name)}</span>` : '<span class="text-muted">—</span>'}</td>
                <td><strong>${escapeHtml(i.itemName)}</strong></td>
                <td>${cat ? `<span class="badge-soft blue">${escapeHtml(cat.name)}</span>` : '<span class="text-muted">—</span>'}</td>
                <td>${i.size} <span class="badge-soft gray">${escapeHtml(i.unit)}</span></td>
                <td>${mrp ? formatCurrency(mrp) : '<span class="text-muted">—</span>'}</td>
                <td><strong>${formatCurrency(price)}</strong>${discount ? `<br><small class="text-success">${discount}% off</small>` : ''}</td>
                <td><span class="badge-soft orange">≤ ${getMinAlert(i)}</span></td>
                <td>
                    <button class="btn btn-sm btn-outline-primary me-1" onclick="openItemModal('edit','${i.id}')"><i class="fas fa-edit"></i></button>
                    <button class="btn btn-sm btn-outline-danger" onclick="deleteItem('${i.id}')"><i class="fas fa-trash"></i></button>
                </td>
            </tr>`;
        }).join('');

        // Mobile cards
        mob.innerHTML = items.map(i => {
            const cat = getCategoryById(i.categoryId);
            const brand = getBrandById(i.brandId);
            const mrp = Number(i.mrp) || 0;
            const price = getSellingPrice(i);
            const discount = mrp > price && mrp > 0 ? Math.round(((mrp - price) / mrp) * 100) : 0;
            return `<div class="mobile-card">
                <div class="mobile-card-header">
                    <div style="min-width:0;flex:1;">
                        <div class="mobile-card-title">${escapeHtml(i.itemName)}</div>
                        <div class="mobile-card-sub">${i.size} ${escapeHtml(i.unit)} ${cat ? '· ' + escapeHtml(cat.name) : ''}</div>
                    </div>
                    ${brand ? `<span class="badge-soft purple">${escapeHtml(brand.name)}</span>` : ''}
                </div>
                <div class="mobile-card-row">
                    <span class="label">MRP</span>
                    <span>${mrp ? formatCurrency(mrp) : '—'}</span>
                </div>
                <div class="mobile-card-row">
                    <span class="label">Selling Price</span>
                    <span><strong>${formatCurrency(price)}</strong> ${discount ? `<span class="badge-soft green">${discount}% off</span>` : ''}</span>
                </div>
                <div class="mobile-card-row">
                    <span class="label">Min Alert Level</span>
                    <span class="badge-soft orange">≤ ${getMinAlert(i)}</span>
                </div>
                ${i.notes ? `<div class="mobile-card-row"><span class="label">Notes</span><span>${escapeHtml(i.notes)}</span></div>` : ''}
                <div class="mobile-card-actions">
                    <button class="btn btn-outline-primary" onclick="openItemModal('edit','${i.id}')"><i class="fas fa-edit me-1"></i>Edit</button>
                    <button class="btn btn-outline-danger" onclick="deleteItem('${i.id}')"><i class="fas fa-trash me-1"></i>Delete</button>
                </div>
            </div>`;
        }).join('');
    }
    window.openItemModal = function (mode, id) {
        if (!getCategories().length) { showToast('Please add a category first', 'warning'); return; }
        if (!getBrands().length) { showToast('Please add a brand first', 'warning'); return; }
        document.getElementById('itemEditId').value = '';
        document.getElementById('itemModalTitle').textContent = 'Add Item';
        document.getElementById('itemName').value = '';
        document.getElementById('itemSize').value = '';
        document.getElementById('itemUnit').value = 'gm';
        document.getElementById('itemMrp').value = '';
        document.getElementById('itemPrice').value = '';
        document.getElementById('itemMinAlert').value = '1';
        document.getElementById('itemNotes').value = '';
        populateDropdown('itemBrand', getBrands().map(b => ({ id: b.id, label: b.name })), false);
        populateDropdown('itemCategory', getCategories().map(c => ({ id: c.id, label: c.name })), false);
        if (mode === 'edit' && id) {
            const i = getItemById(id); if (!i) return;
            document.getElementById('itemEditId').value = i.id;
            document.getElementById('itemModalTitle').textContent = 'Edit Item';
            document.getElementById('itemBrand').value = i.brandId || '';
            document.getElementById('itemName').value = i.itemName;
            document.getElementById('itemCategory').value = i.categoryId || '';
            document.getElementById('itemSize').value = i.size;
            document.getElementById('itemUnit').value = i.unit;
            document.getElementById('itemMrp').value = i.mrp || '';
            document.getElementById('itemPrice').value = i.price || '';
            document.getElementById('itemMinAlert').value = getMinAlert(i);
            document.getElementById('itemNotes').value = i.notes || '';
        }
        new bootstrap.Modal(document.getElementById('itemModal')).show();
    };
    window.saveItem = function () {
        const itemName = document.getElementById('itemName').value.trim();
        if (!itemName) { showToast('Item name required', 'warning'); return; }
        const brandId = document.getElementById('itemBrand').value;
        const categoryId = document.getElementById('itemCategory').value;
        if (!brandId) { showToast('Brand required', 'warning'); return; }
        if (!categoryId) { showToast('Category required', 'warning'); return; }
        const size = parseFloat(document.getElementById('itemSize').value);
        if (!size || size <= 0) { showToast('Valid size required', 'warning'); return; }
        const mrp = parseFloat(document.getElementById('itemMrp').value);
        if (isNaN(mrp) || mrp < 0) { showToast('Valid MRP required', 'warning'); return; }
        const price = parseFloat(document.getElementById('itemPrice').value);
        if (isNaN(price) || price < 0) { showToast('Valid price required', 'warning'); return; }
        const minAlert = parseFloat(document.getElementById('itemMinAlert').value);
        if (isNaN(minAlert) || minAlert < 0) { showToast('Valid min alert level required', 'warning'); return; }

        const editId = document.getElementById('itemEditId').value;
        const items = getItems();
        const data = {
            id: editId || uid('itm'),
            brandId, itemName, categoryId,
            size, unit: document.getElementById('itemUnit').value,
            mrp, price, minAlert,
            notes: document.getElementById('itemNotes').value.trim(),
            createdAt: editId ? (getItemById(editId)?.createdAt || new Date().toISOString()) : new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        if (editId) { const i = items.findIndex(x => x.id === editId); if (i >= 0) items[i] = data; }
        else items.push(data);
        saveItems(items);
        bootstrap.Modal.getInstance(document.getElementById('itemModal')).hide();
        showToast(editId ? 'Item updated!' : 'Item added!', 'success');
        refreshItems(); refreshDropdowns(); refreshDashboard(); updateBadges();
    };
    window.deleteItem = function (id) {
        const used = getStock().filter(s => s.itemId === id).length;
        if (used) { showToast(`Cannot delete — ${used} stock entr(ies) use this item`, 'error'); return; }
        if (!confirm('Delete this item?')) return;
        saveItems(getItems().filter(i => i.id !== id));
        showToast('Item deleted', 'success');
        refreshItems(); refreshDropdowns(); refreshDashboard();
    };

    // ─── Stock ───────────────────────────────────────
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
    function refreshStock() {
        const tbody = document.getElementById('stockBody');
        const mob = document.getElementById('stockMobileList');
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
                return true;
            });
        }
        stock = stock.sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));

        if (!stock.length) {
            tbody.innerHTML = '<tr><td colspan="8" class="empty-state"><i class="fas fa-boxes-stacked"></i><p>No stock entries found.</p></td></tr>';
            mob.innerHTML = '<div class="empty-state"><i class="fas fa-boxes-stacked"></i><p>No stock entries found.</p></div>';
            return;
        }

        // Desktop table
        tbody.innerHTML = stock.map(s => {
            const item = getItemById(s.itemId); if (!item) return '';
            const brand = getBrandById(item.brandId);
            const storage = getStorageById(s.storageId);
            const status = getStockStatus(s);
            const value = getSellingPrice(item) * (Number(s.quantity) || 0);
            return `<tr>
                <td><strong>${escapeHtml(item.itemName)}</strong><br><small class="text-muted">${item.size} ${item.unit}</small></td>
                <td>${brand ? `<span class="badge-soft purple">${escapeHtml(brand.name)}</span>` : '<span class="text-muted">—</span>'}</td>
                <td>${storage ? `<i class="fas fa-warehouse text-muted me-1"></i>${escapeHtml(storage.name)}` : '<span class="text-muted">—</span>'}</td>
                <td><strong>${Number(s.quantity) || 0}</strong></td>
                <td>${s.expiryDate ? formatDate(s.expiryDate) : '<span class="text-muted">—</span>'}</td>
                <td>${formatCurrency(value)}</td>
                <td><span class="badge-soft ${status.cls}">${status.label}</span></td>
                <td>
                    <button class="btn btn-sm btn-outline-success me-1" title="Add 1" onclick="quickAdjust('${s.id}', 1)"><i class="fas fa-plus"></i></button>
                    <button class="btn btn-sm btn-outline-warning me-1" title="Remove 1" onclick="quickAdjust('${s.id}', -1)"><i class="fas fa-minus"></i></button>
                    <button class="btn btn-sm btn-outline-primary me-1" onclick="openStockModal('edit','${s.id}')"><i class="fas fa-edit"></i></button>
                    <button class="btn btn-sm btn-outline-danger" onclick="deleteStock('${s.id}')"><i class="fas fa-trash"></i></button>
                </td>
            </tr>`;
        }).join('');

        // Mobile cards
        mob.innerHTML = stock.map(s => {
            const item = getItemById(s.itemId); if (!item) return '';
            const brand = getBrandById(item.brandId);
            const storage = getStorageById(s.storageId);
            const status = getStockStatus(s);
            const value = getSellingPrice(item) * (Number(s.quantity) || 0);
            const min = getMinAlert(item);
            return `<div class="mobile-card">
                <div class="mobile-card-header">
                    <div style="min-width:0;flex:1;">
                        <div class="mobile-card-title">${escapeHtml(item.itemName)}</div>
                        <div class="mobile-card-sub">${item.size} ${escapeHtml(item.unit)} ${brand ? '· ' + escapeHtml(brand.name) : ''}</div>
                    </div>
                    <span class="badge-soft ${status.cls}">${status.label}</span>
                </div>
                <div class="mobile-card-row">
                    <span class="label"><i class="fas fa-warehouse me-1"></i>Storage</span>
                    <span>${storage ? escapeHtml(storage.name) : '—'}</span>
                </div>
                <div class="mobile-card-row">
                    <span class="label">Quantity</span>
                    <span><strong>${Number(s.quantity) || 0}</strong> <small class="text-muted">(Alert ≤ ${min})</small></span>
                </div>
                ${s.expiryDate ? `<div class="mobile-card-row"><span class="label">Expiry</span><span>${formatDate(s.expiryDate)}</span></div>` : ''}
                <div class="mobile-card-row">
                    <span class="label">Value</span>
                    <span><strong>${formatCurrency(value)}</strong></span>
                </div>
                <div class="mobile-card-actions">
                    <button class="btn btn-outline-success" onclick="quickAdjust('${s.id}', 1)"><i class="fas fa-plus"></i></button>
                    <button class="btn btn-outline-warning" onclick="quickAdjust('${s.id}', -1)"><i class="fas fa-minus"></i></button>
                    <button class="btn btn-outline-primary" onclick="openStockModal('edit','${s.id}')"><i class="fas fa-edit"></i></button>
                    <button class="btn btn-outline-danger" onclick="deleteStock('${s.id}')"><i class="fas fa-trash"></i></button>
                </div>
            </div>`;
        }).join('');
    }
    window.quickAdjust = function (id, delta) {
        const stock = getStock();
        const s = stock.find(x => x.id === id); if (!s) return;
        s.quantity = Math.max(0, (Number(s.quantity) || 0) + delta);
        s.updatedAt = new Date().toISOString();
        saveStock(stock);
        refreshStock(); refreshDashboard(); updateBadges();
    };
    window.openStockModal = function (mode, id) {
        if (!getItems().length) { showToast('Please add an item first', 'warning'); return; }
        if (!getStorages().length) { showToast('Please add a storage location first', 'warning'); return; }
        document.getElementById('stockEditId').value = '';
        document.getElementById('stockModalTitle').textContent = 'Add Stock';
        document.getElementById('stockQuantity').value = '1';
        document.getElementById('stockPurchaseDate').value = new Date().toISOString().split('T')[0];
        document.getElementById('stockExpiry').value = '';
        document.getElementById('stockNotes').value = '';

        populateDropdown('stockItem', getItems().map(i => {
            const brand = getBrandById(i.brandId);
            return { id: i.id, label: `${brand ? brand.name + ' ' : ''}${i.itemName} (${i.size}${i.unit})` };
        }), false);
        populateDropdown('stockStorage', getStorages().map(s => ({ id: s.id, label: s.name })), false);

        if (mode === 'edit' && id) {
            const s = getStock().find(x => x.id === id); if (!s) return;
            document.getElementById('stockEditId').value = s.id;
            document.getElementById('stockModalTitle').textContent = 'Edit Stock';
            document.getElementById('stockItem').value = s.itemId;
            document.getElementById('stockStorage').value = s.storageId;
            document.getElementById('stockQuantity').value = s.quantity;
            document.getElementById('stockPurchaseDate').value = s.purchaseDate || '';
            document.getElementById('stockExpiry').value = s.expiryDate || '';
            document.getElementById('stockNotes').value = s.notes || '';
        }
        new bootstrap.Modal(document.getElementById('stockModal')).show();
    };
    window.saveStock = function () {
        const itemId = document.getElementById('stockItem').value;
        const storageId = document.getElementById('stockStorage').value;
        if (!itemId) { showToast('Item required', 'warning'); return; }
        if (!storageId) { showToast('Storage required', 'warning'); return; }
        const qty = parseFloat(document.getElementById('stockQuantity').value);
        if (isNaN(qty) || qty < 0) { showToast('Valid quantity required', 'warning'); return; }

        const editId = document.getElementById('stockEditId').value;
        const stock = getStock();
        const data = {
            id: editId || uid('stk'),
            itemId, storageId, quantity: qty,
            purchaseDate: document.getElementById('stockPurchaseDate').value || null,
            expiryDate: document.getElementById('stockExpiry').value || null,
            notes: document.getElementById('stockNotes').value.trim(),
            createdAt: editId ? (stock.find(x => x.id === editId)?.createdAt || new Date().toISOString()) : new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        if (editId) { const i = stock.findIndex(x => x.id === editId); if (i >= 0) stock[i] = data; }
        else stock.push(data);
        saveStock(stock);
        bootstrap.Modal.getInstance(document.getElementById('stockModal')).hide();
        showToast(editId ? 'Stock updated!' : 'Stock added!', 'success');
        refreshStock(); refreshDashboard(); updateBadges();
    };
    window.deleteStock = function (id) {
        if (!confirm('Delete this stock entry?')) return;
        saveStock(getStock().filter(s => s.id !== id));
        showToast('Stock deleted', 'success');
        refreshStock(); refreshDashboard(); updateBadges();
    };

    // ─── Shopping List ───────────────────────────────
    function refreshShopping() {
        const container = document.getElementById('shoppingListContainer');
        const list = getShopping();
        if (!list.length) { container.innerHTML = '<div class="empty-state"><i class="fas fa-cart-shopping"></i><p>Shopping list khaali hai.</p></div>'; return; }
        const active = list.filter(s => !s.done);
        const done = list.filter(s => s.done);
        let html = '';
        if (active.length) html += active.map(s => shoppingItemHTML(s)).join('');
        if (done.length) {
            html += `<div class="mt-3 mb-2 text-muted small fw-bold">COMPLETED (${done.length})</div>`;
            html += done.map(s => shoppingItemHTML(s)).join('');
        }
        const totalEst = active.reduce((sum, s) => sum + (Number(s.price) || 0), 0);
        if (active.length) {
            html = `<div class="mb-3 d-flex justify-content-between flex-wrap gap-2">
                <span class="badge-soft green">${active.length} item(s) pending</span>
                <strong>Est. Total: ${formatCurrency(totalEst)}</strong>
            </div>` + html;
        }
        container.innerHTML = html;
    }
    function shoppingItemHTML(s) {
        return `<div class="shopping-item ${s.done ? 'done' : ''}">
            <input type="checkbox" class="form-check-input" ${s.done ? 'checked' : ''} onchange="toggleShoppingDone('${s.id}')">
            <div style="flex:1;min-width:0;">
                <strong>${escapeHtml(s.name)}</strong>
                ${s.qty ? `<span class="text-muted"> — ${escapeHtml(s.qty)}</span>` : ''}
                ${s.notes ? `<br><small class="text-muted">${escapeHtml(s.notes)}</small>` : ''}
            </div>
            ${s.price ? `<span class="badge-soft blue">${formatCurrency(s.price)}</span>` : ''}
            <div class="d-flex gap-1">
                <button class="btn btn-sm btn-outline-primary" onclick="openShoppingModal('edit','${s.id}')"><i class="fas fa-edit"></i></button>
                <button class="btn btn-sm btn-outline-danger" onclick="deleteShoppingItem('${s.id}')"><i class="fas fa-trash"></i></button>
            </div>
        </div>`;
    }
    window.openShoppingModal = function (mode, id) {
        document.getElementById('shoppingEditId').value = '';
        document.getElementById('shoppingModalTitle').textContent = 'Add to Shopping List';
        document.getElementById('shoppingName').value = '';
        document.getElementById('shoppingQty').value = '';
        document.getElementById('shoppingPrice').value = '';
        document.getElementById('shoppingNotes').value = '';
        if (mode === 'edit' && id) {
            const s = getShopping().find(x => x.id === id); if (!s) return;
            document.getElementById('shoppingEditId').value = s.id;
            document.getElementById('shoppingModalTitle').textContent = 'Edit Shopping Item';
            document.getElementById('shoppingName').value = s.name;
            document.getElementById('shoppingQty').value = s.qty || '';
            document.getElementById('shoppingPrice').value = s.price || '';
            document.getElementById('shoppingNotes').value = s.notes || '';
        }
        new bootstrap.Modal(document.getElementById('shoppingModal')).show();
    };
    window.saveShoppingItem = function () {
        const name = document.getElementById('shoppingName').value.trim();
        if (!name) { showToast('Item name required', 'warning'); return; }
        const editId = document.getElementById('shoppingEditId').value;
        const list = getShopping();
        const data = {
            id: editId || uid('shp'), name,
            qty: document.getElementById('shoppingQty').value.trim(),
            price: parseFloat(document.getElementById('shoppingPrice').value) || 0,
            notes: document.getElementById('shoppingNotes').value.trim(),
            done: editId ? (list.find(x => x.id === editId)?.done || false) : false,
            createdAt: editId ? (list.find(x => x.id === editId)?.createdAt || new Date().toISOString()) : new Date().toISOString()
        };
        if (editId) { const i = list.findIndex(x => x.id === editId); if (i >= 0) list[i] = data; }
        else list.push(data);
        saveShopping(list);
        bootstrap.Modal.getInstance(document.getElementById('shoppingModal')).hide();
        showToast(editId ? 'Updated!' : 'Added to list!', 'success');
        refreshShopping(); updateBadges();
    };
    window.toggleShoppingDone = function (id) {
        const list = getShopping(); const s = list.find(x => x.id === id); if (!s) return;
        s.done = !s.done;
        saveShopping(list);
        refreshShopping(); updateBadges();
    };
    window.deleteShoppingItem = function (id) {
        if (!confirm('Remove from shopping list?')) return;
        saveShopping(getShopping().filter(s => s.id !== id));
        refreshShopping(); updateBadges();
    };
    window.autoGenerateShoppingList = function () {
        const lowStock = getStock().filter(s => {
            const item = getItemById(s.itemId);
            const min = getMinAlert(item);
            return (Number(s.quantity) || 0) <= min;
        });
        if (!lowStock.length) { showToast('No low-stock items to add', 'info'); return; }
        const list = getShopping();
        let added = 0;
        lowStock.forEach(s => {
            const item = getItemById(s.itemId); if (!item) return;
            const brand = getBrandById(item.brandId);
            const existing = list.find(x => !x.done && x.name.toLowerCase().includes(item.itemName.toLowerCase()));
            if (existing) return;
            const min = getMinAlert(item);
            const shortfall = Math.max(1, min - (Number(s.quantity) || 0) + 1);
            list.push({
                id: uid('shp'),
                name: `${brand ? brand.name + ' ' : ''}${item.itemName}`,
                qty: `${shortfall} x ${item.size}${item.unit}`,
                price: getSellingPrice(item) * shortfall,
                notes: 'Auto-added from low stock',
                done: false,
                createdAt: new Date().toISOString()
            });
            added++;
        });
        saveShopping(list);
        showToast(`${added} item(s) added to shopping list`, 'success');
        refreshShopping(); updateBadges();
    };
    window.copyShoppingList = function () {
        const list = getShopping().filter(s => !s.done);
        if (!list.length) { showToast('Shopping list is empty', 'warning'); return; }
        let text = '🛒 *Shopping List*\n\n';
        list.forEach((s, i) => {
            text += `${i + 1}. ${s.name}`;
            if (s.qty) text += ` — ${s.qty}`;
            if (s.price) text += ` (₹${s.price})`;
            text += '\n';
        });
        const total = list.reduce((sum, s) => sum + (Number(s.price) || 0), 0);
        text += `\n💰 Est. Total: ₹${total}\n\n— GharSeva`;
        if (navigator.clipboard) {
            navigator.clipboard.writeText(text).then(() => showToast('Shopping list copied!', 'success'));
        } else {
            const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select();
            document.execCommand('copy'); document.body.removeChild(ta); showToast('Copied!', 'success');
        }
    };

    // ─── Dropdowns ───────────────────────────────────
    function populateDropdown(elId, options, addEmpty = true) {
        const el = document.getElementById(elId); if (!el) return;
        let html = addEmpty ? '<option value="">-- Select --</option>' : '';
        html += options.map(o => `<option value="${o.id}">${escapeHtml(o.label)}</option>`).join('');
        el.innerHTML = html;
    }
    function refreshDropdowns() {
        const itemCatFilter = document.getElementById('itemCategoryFilter');
        if (itemCatFilter) {
            const cur = itemCatFilter.value;
            itemCatFilter.innerHTML = '<option value="">All Categories</option>' + getCategories().map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');
            itemCatFilter.value = cur;
        }
        const itemBrandFilter = document.getElementById('itemBrandFilter');
        if (itemBrandFilter) {
            const cur = itemBrandFilter.value;
            itemBrandFilter.innerHTML = '<option value="">All Brands</option>' + getBrands().map(b => `<option value="${b.id}">${escapeHtml(b.name)}</option>`).join('');
            itemBrandFilter.value = cur;
        }
        const stgFilter = document.getElementById('stockStorageFilter');
        if (stgFilter) {
            const cur = stgFilter.value;
            stgFilter.innerHTML = '<option value="">All Storages</option>' + getStorages().map(s => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join('');
            stgFilter.value = cur;
        }
        const brandFilter = document.getElementById('stockBrandFilter');
        if (brandFilter) {
            const cur = brandFilter.value;
            brandFilter.innerHTML = '<option value="">All Brands</option>' + getBrands().map(b => `<option value="${b.id}">${escapeHtml(b.name)}</option>`).join('');
            brandFilter.value = cur;
        }
    }

    // ─── Google Drive Backup ─────────────────────────
    function getDriveConfig() { return load('gdrive_config', { clientId: '', folderName: '' }); }
    window.saveGoogleDriveConfig = function () {
        const clientId = document.getElementById('gdriveClientId').value.trim();
        const folderName = document.getElementById('gdriveFolderName').value.trim();
        if (!clientId || !folderName) { showToast('Both fields required', 'warning'); return; }
        save('gdrive_config', { clientId, folderName });
        showToast('Drive config saved!', 'success');
    };
    function loadDriveConfigInputs() {
        const c = getDriveConfig();
        const ci = document.getElementById('gdriveClientId'); if (ci) ci.value = c.clientId || '';
        const fn = document.getElementById('gdriveFolderName'); if (fn) fn.value = c.folderName || '';
    }
    function setDriveStatus(msg, isError = false) {
        const el = document.getElementById('driveStatus'); if (!el) return;
        el.textContent = msg; el.className = 'mt-2 ' + (isError ? 'drive-status-error' : 'drive-status-success');
    }
    let googleTokenClient = null;
    async function ensureGoogleAuth() {
        if (typeof google === 'undefined' || typeof google.accounts === 'undefined') {
            const loaded = await new Promise(resolve => {
                let waited = 0;
                const check = () => {
                    if (typeof google !== 'undefined' && google.accounts && google.accounts.oauth2) resolve(true);
                    else if (waited >= 10000) resolve(false);
                    else { waited += 300; setTimeout(check, 300); }
                };
                check();
            });
            if (!loaded) { showToast('Google script failed to load', 'error'); return null; }
        }
        const config = getDriveConfig();
        if (!config.clientId) { showToast('Please configure Google OAuth Client ID first', 'warning'); return null; }
        if (!googleTokenClient) {
            googleTokenClient = google.accounts.oauth2.initTokenClient({
                client_id: config.clientId,
                scope: 'https://www.googleapis.com/auth/drive.file',
                callback: (tokenResponse) => {
                    if (tokenResponse && tokenResponse.access_token) {
                        localStorage.setItem('gdrive_token_gharseva', tokenResponse.access_token);
                    }
                }
            });
        }
        let token = localStorage.getItem('gdrive_token_gharseva');
        if (token) {
            try {
                const testRes = await fetch('https://www.googleapis.com/drive/v3/about?fields=user', { headers: { Authorization: 'Bearer ' + token } });
                if (!testRes.ok) { localStorage.removeItem('gdrive_token_gharseva'); token = null; }
            } catch (e) { token = null; }
        }
        if (!token) {
            googleTokenClient.requestAccessToken();
            await new Promise(r => setTimeout(r, 2500));
            token = localStorage.getItem('gdrive_token_gharseva');
        }
        return token;
    }
    async function getOrCreateFolder(token, name) {
        const res = await fetch(`https://www.googleapis.com/drive/v3/files?q=name='${name}' and mimeType='application/vnd.google-apps.folder' and trashed=false&fields=files(id)`, { headers: { Authorization: 'Bearer ' + token } });
        const data = await res.json();
        if (data.files && data.files.length) return data.files[0].id;
        const create = await fetch('https://www.googleapis.com/drive/v3/files', {
            method: 'POST',
            headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, mimeType: 'application/vnd.google-apps.folder' })
        });
        const folder = await create.json();
        return folder.id || null;
    }
    window.uploadToGoogleDrive = async function () {
        setDriveStatus('⏳ Backing up...');
        const token = await ensureGoogleAuth();
        if (!token) { setDriveStatus('❌ Auth failed', true); return; }
        const config = getDriveConfig();
        const data = getAllData();
        const now = new Date();
        const fileName = `gharseva_backup_${now.getFullYear()}_${String(now.getMonth() + 1).padStart(2, '0')}.json`;
        try {
            const folderId = await getOrCreateFolder(token, config.folderName);
            if (!folderId) { setDriveStatus('❌ Could not access folder', true); return; }
            const searchRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=name='${fileName}' and '${folderId}' in parents and trashed=false&fields=files(id)`, { headers: { Authorization: 'Bearer ' + token } });
            const existing = await searchRes.json();
            const content = JSON.stringify(data, null, 2);
            let resp;
            if (existing.files && existing.files.length) {
                resp = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${existing.files[0].id}?uploadType=media`, {
                    method: 'PATCH',
                    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
                    body: content
                });
            } else {
                const metadata = { name: fileName, parents: [folderId], mimeType: 'application/json' };
                const boundary = 'gsv_' + Date.now();
                const body = [`--${boundary}`, 'Content-Type: application/json; charset=UTF-8', '', JSON.stringify(metadata), `--${boundary}`, 'Content-Type: application/json', '', content, `--${boundary}--`].join('\r\n');
                resp = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
                    method: 'POST',
                    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'multipart/related; boundary="' + boundary + '"' },
                    body
                });
            }
            if (resp.ok) { setDriveStatus(`✅ Backup complete (${fileName})`); showToast('Backed up!', 'success'); }
            else throw new Error('Upload failed: ' + resp.status);
        } catch (e) { setDriveStatus('❌ ' + e.message, true); }
    };
    window.listGoogleDriveFiles = async function () {
        setDriveStatus('⏳ Loading files...');
        const token = await ensureGoogleAuth();
        if (!token) { setDriveStatus('❌ Auth failed', true); return; }
        const config = getDriveConfig();
        const folderId = await getOrCreateFolder(token, config.folderName);
        if (!folderId) { setDriveStatus('❌ Folder unavailable', true); return; }
        try {
            const res = await fetch(`https://www.googleapis.com/drive/v3/files?q='${folderId}' in parents and trashed=false&orderBy=createdTime desc&pageSize=10`, { headers: { Authorization: 'Bearer ' + token } });
            const data = await res.json();
            const container = document.getElementById('driveFileList');
            if (data.files && data.files.length) {
                container.innerHTML = '<strong>📂 Backups:</strong>' + data.files.map(f =>
                    `<div class="border rounded p-2 mt-1 d-flex justify-content-between align-items-center gap-2 flex-wrap">
                        <span style="min-width:0;flex:1;">📄 ${escapeHtml(f.name)}</span>
                        <button class="btn btn-sm btn-primary-custom" onclick="restoreFromDrive('${f.id}')">Restore</button>
                    </div>`).join('');
            } else container.innerHTML = '<small class="text-muted">No backups found.</small>';
            setDriveStatus('✅ Loaded');
        } catch (e) { setDriveStatus('❌ ' + e.message, true); }
    };
    window.restoreFromDrive = async function (fileId) {
        if (!confirm('Restore from this backup? Current data will be replaced.')) return;
        setDriveStatus('⏳ Restoring...');
        const token = await ensureGoogleAuth();
        if (!token) { setDriveStatus('❌ Auth failed', true); return; }
        try {
            const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, { headers: { Authorization: 'Bearer ' + token } });
            const data = await res.json();
            restoreData(data);
            setDriveStatus('✅ Restored!');
            showToast('Data restored successfully!', 'success');
            refreshCurrentPage(); refreshDropdowns();
        } catch (e) { setDriveStatus('❌ ' + e.message, true); }
    };

    // ─── Export / Import / Clear / Sample ────────────
    window.exportData = function () {
        const data = getAllData();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `gharseva-backup-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        showToast('Exported!', 'success');
    };
    window.importData = function (event) {
        const file = event.target.files[0]; if (!file) return;
        const reader = new FileReader();
        reader.onload = function (e) {
            try {
                const data = JSON.parse(e.target.result);
                if (!data.items && !data.storages && !data.categories && !data.brands) { showToast('Invalid file', 'error'); return; }
                if (confirm('Replace all current data?')) {
                    restoreData(data);
                    showToast('Imported!', 'success');
                    refreshCurrentPage(); refreshDropdowns();
                }
            } catch (err) { showToast('Parse error', 'error'); }
        };
        reader.readAsText(file);
        event.target.value = '';
    };
    window.clearAllData = function () {
        if (!confirm('⚠️ Delete ALL data? This cannot be undone.')) return;
        if (!confirm('Are you absolutely sure?')) return;
        saveStorages([]); saveCategories([]); saveBrands([]); saveItems([]); saveStock([]); saveShopping([]);
        showToast('All data cleared', 'success');
        refreshCurrentPage(); refreshDropdowns();
    };
    window.loadSampleData = function () {
        if (!confirm('Load sample data? This will replace existing data.')) return;
        const now = new Date().toISOString();
        const stg1 = { id: uid('stg'), name: 'Refrigerator', type: 'refrigerator', description: 'Kitchen — main fridge', createdAt: now };
        const stg2 = { id: uid('stg'), name: 'Storage Box', type: 'box', description: 'Dry goods box', createdAt: now };
        const stg3 = { id: uid('stg'), name: 'Rack A Floor 1', type: 'rack', description: 'Kitchen rack, ground floor', createdAt: now };
        const cat1 = { id: uid('cat'), name: 'Kathod', description: 'Pulses & Lentils', createdAt: now };
        const cat2 = { id: uid('cat'), name: 'Dery', description: 'Dry fruits & nuts', createdAt: now };
        const cat3 = { id: uid('cat'), name: 'Masala', description: 'Spices & condiments', createdAt: now };
        const cat4 = { id: uid('cat'), name: 'Dairy', description: 'Milk products', createdAt: now };
        const brd1 = { id: uid('brd'), name: 'Tata', description: 'Preferred for staples', createdAt: now };
        const brd2 = { id: uid('brd'), name: 'MDH', description: 'Masala brand', createdAt: now };
        const brd3 = { id: uid('brd'), name: 'Amul', description: 'Dairy regular', createdAt: now };
        const brd4 = { id: uid('brd'), name: 'Happilo', description: 'Dry fruits', createdAt: now };
        const brd5 = { id: uid('brd'), name: 'Fortune', description: 'Oil & atta', createdAt: now };
        const itm1 = { id: uid('itm'), brandId: brd1.id, itemName: 'Toor Dal', categoryId: cat1.id, size: 1, unit: 'kg', mrp: 220, price: 180, minAlert: 2, notes: '', createdAt: now, updatedAt: now };
        const itm2 = { id: uid('itm'), brandId: brd2.id, itemName: 'Turmeric Powder', categoryId: cat3.id, size: 100, unit: 'gm', mrp: 50, price: 45, minAlert: 1, notes: '', createdAt: now, updatedAt: now };
        const itm3 = { id: uid('itm'), brandId: brd3.id, itemName: 'Milk', categoryId: cat4.id, size: 1, unit: 'l', mrp: 66, price: 60, minAlert: 3, notes: '', createdAt: now, updatedAt: now };
        const itm4 = { id: uid('itm'), brandId: brd4.id, itemName: 'Almonds', categoryId: cat2.id, size: 250, unit: 'gm', mrp: 400, price: 350, minAlert: 1, notes: '', createdAt: now, updatedAt: now };
        const itm5 = { id: uid('itm'), brandId: brd5.id, itemName: 'Sunflower Oil', categoryId: cat3.id, size: 1, unit: 'l', mrp: 160, price: 140, minAlert: 1, notes: '', createdAt: now, updatedAt: now };
        const itm6 = { id: uid('itm'), brandId: brd1.id, itemName: 'Salt', categoryId: cat3.id, size: 1, unit: 'kg', mrp: 28, price: 25, minAlert: 1, notes: '', createdAt: now, updatedAt: now };
        const exp1 = new Date(); exp1.setDate(exp1.getDate() + 5);
        const exp2 = new Date(); exp2.setDate(exp2.getDate() + 20);
        const exp3 = new Date(); exp3.setDate(exp3.getDate() + 180);
        const stock = [
            { id: uid('stk'), itemId: itm1.id, storageId: stg2.id, quantity: 3, expiryDate: exp3.toISOString().split('T')[0], createdAt: now, updatedAt: now },
            { id: uid('stk'), itemId: itm2.id, storageId: stg3.id, quantity: 1, expiryDate: exp3.toISOString().split('T')[0], createdAt: now, updatedAt: now },
            { id: uid('stk'), itemId: itm3.id, storageId: stg1.id, quantity: 2, expiryDate: exp1.toISOString().split('T')[0], createdAt: now, updatedAt: now },
            { id: uid('stk'), itemId: itm4.id, storageId: stg2.id, quantity: 0, expiryDate: exp2.toISOString().split('T')[0], createdAt: now, updatedAt: now },
            { id: uid('stk'), itemId: itm5.id, storageId: stg3.id, quantity: 2, expiryDate: exp3.toISOString().split('T')[0], createdAt: now, updatedAt: now },
            { id: uid('stk'), itemId: itm6.id, storageId: stg2.id, quantity: 1, expiryDate: exp3.toISOString().split('T')[0], createdAt: now, updatedAt: now }
        ];
        saveStorages([stg1, stg2, stg3]);
        saveCategories([cat1, cat2, cat3, cat4]);
        saveBrands([brd1, brd2, brd3, brd4, brd5]);
        saveItems([itm1, itm2, itm3, itm4, itm5, itm6]);
        saveStock(stock);
        saveShopping([]);
        showToast('Sample data loaded!', 'success');
        refreshCurrentPage(); refreshDropdowns();
        navigateTo('dashboard');
    };

    // ─── Listeners ───────────────────────────────────
    function attachSearchListeners() {
        ['stockSearch', 'stockBrandFilter', 'stockStorageFilter', 'stockStatusFilter'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('input', refreshStock);
        });
        ['itemSearch', 'itemCategoryFilter', 'itemBrandFilter'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('input', refreshItems);
        });
    }

    // ─── Init ────────────────────────────────────────
    function init() {
        document.getElementById('currentDateDisplay').textContent = new Date().toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
        document.querySelectorAll('.sidebar-nav .nav-link').forEach(l => l.addEventListener('click', function () {
            const page = this.getAttribute('data-page');
            if (page) navigateTo(page);
        }));

        // Mobile menu handlers
        const menuBtn = document.getElementById('mobileMenuBtn');
        const closeBtn = document.getElementById('sidebarCloseBtn');
        const overlay = document.getElementById('sidebarOverlay');
        if (menuBtn) menuBtn.addEventListener('click', openSidebar);
        if (closeBtn) closeBtn.addEventListener('click', closeSidebar);
        if (overlay) overlay.addEventListener('click', closeSidebar);

        // Close sidebar on ESC
        document.addEventListener('keydown', e => { if (e.key === 'Escape') closeSidebar(); });

        // Handle resize
        let rt;
        window.addEventListener('resize', () => {
            clearTimeout(rt);
            rt = setTimeout(() => {
                if (!isMobile()) closeSidebar();
                // Update FAB visibility
                const fab = document.getElementById('mobileFab');
                if (fab) fab.style.display = (isMobile() && ['stock', 'items', 'brands', 'categories', 'storages'].includes(currentPage)) ? 'flex' : 'none';
            }, 200);
        });

        attachSearchListeners();
        refreshDropdowns();
        navigateTo('dashboard');
    }
    init();
})();