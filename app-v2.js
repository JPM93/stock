/* ============================================================
   GharSeva — app.js
   Master: navigation, dashboard, init(). Sabse aakhir me load.
   ============================================================ */
(function () {
    'use strict';
    const {
        escapeHtml, formatCurrency, formatDate, isMobile, initials,
        getItems, getStock, getStorages, getCategories, getBrands, getSellers,
        getShopping, getPurchaseNotes,
        getItemById, getBrandById, getStorageById, getSellerById,
        getMinAlert, getSellingPrice, getBestSellerPrice
    } = GS;

    let currentPage = 'dashboard';

    // ─── Navigation ──────────────────────────────────
    function navigateTo(page) {
        const mobileTitle = document.getElementById('mobileBrandTitle');
        const mobileTitles = {
            dashboard: '📊 Dashboard', stock: '📦 Stock', items: '🏷️ Items',
            brands: '©️ Brands', sellers: '🏪 Sellers', categories: '📚 Categories',
            storages: '🏠 Storages', shopping: '🛒 Shopping List', settings: '⚙️ Settings'
        };
        if (mobileTitle) mobileTitle.textContent = mobileTitles[page] || '🛒 GharSeva';

        const bottomNavMap = { dashboard: 'dashboard', stock: 'stock', items: 'items', shopping: 'shopping' };
        document.querySelectorAll('.bottom-nav-item').forEach(el => el.classList.remove('active'));
        if (bottomNavMap[page]) {
            const btn = document.querySelector(`.bottom-nav-item[data-nav="${bottomNavMap[page]}"]`);
            if (btn) btn.classList.add('active');
        } else {
            const moreBtn = document.querySelector('.bottom-nav-item[data-nav="more"]');
            if (moreBtn) moreBtn.classList.add('active');
        }

        currentPage = page;
        document.querySelectorAll('.section-page').forEach(el => el.classList.remove('active'));
        const pEl = document.getElementById('page-' + page); if (pEl) pEl.classList.add('active');
        document.querySelectorAll('.sidebar-nav .nav-link').forEach(el => el.classList.remove('active'));
        const nav = document.querySelector(`[data-page="${page}"]`); if (nav) nav.classList.add('active');
        const titles = {
            dashboard: '📊 Dashboard', stock: '📦 Available Stock', items: '🏷️ Item Master',
            brands: '©️ Brand Master', sellers: '🏪 Seller Master', categories: '📚 Category Master',
            storages: '🏠 Storage Master', shopping: '🛒 Shopping List', settings: '⚙️ Settings & Sync'
        };
        const pageTitleEl = document.getElementById('pageTitle');
        if (pageTitleEl) pageTitleEl.textContent = titles[page] || page;

        const fab = document.getElementById('mobileFab');
        if (fab) {
            if (isMobile() && ['stock', 'items', 'brands', 'sellers', 'categories', 'storages'].includes(page)) {
                fab.style.display = 'flex';
                fab.onclick = function () {
                    if (page === 'stock') window.openStockModal();
                    else if (page === 'items') window.openItemModal();
                    else if (page === 'brands') window.openBrandModal();
                    else if (page === 'sellers') window.openSellerModal();
                    else if (page === 'categories') window.openCategoryModal();
                    else if (page === 'storages') window.openStorageModal();
                };
            } else fab.style.display = 'none';
        }

        refreshCurrentPage();
        if (page === 'settings') GS.backup.loadDriveConfigInputs();
        if (isMobile()) GS.masters.closeSidebar();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function refreshCurrentPage() {
        switch (currentPage) {
            case 'dashboard': refreshDashboard(); break;
            case 'stock': GS.stock.refreshStock(); break;
            case 'items': GS.items.refreshItems(); break;
            case 'brands': GS.masters.refreshBrands(); break;
            case 'sellers': GS.masters.refreshSellers(); break;
            case 'categories': GS.masters.refreshCategories(); break;
            case 'storages': GS.masters.refreshStorages(); break;
            case 'shopping': GS.shopping.refreshShopping(); break;
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
        const sbc = document.getElementById('stockBadgeCount');
        if (sbc) sbc.textContent = lowStock + outOfStock;
        const shoppingActive = getShopping().filter(s => !s.done).length
            + getPurchaseNotes().reduce((a, n) => a + (n.items || []).filter(i => !i.bought).length, 0);
        const shbc = document.getElementById('shoppingBadgeCount');
        if (shbc) shbc.textContent = shoppingActive;

        const bnStock = document.getElementById('bnStockBadge');
        const bnShopping = document.getElementById('bnShoppingBadge');
        if (bnStock) {
            const c = lowStock + outOfStock;
            bnStock.textContent = c;
            bnStock.style.display = c > 0 ? 'inline-block' : 'none';
        }
        if (bnShopping) {
            const c = shoppingActive;
            bnShopping.textContent = c;
            bnShopping.style.display = c > 0 ? 'inline-block' : 'none';
        }
    }

    // ─── Dashboard ───────────────────────────────────
    function refreshDashboard() {
        const items = getItems(), stock = getStock();
        const elTotalItems = document.getElementById('statTotalItems');
        const elTotalStock = document.getElementById('statTotalStock');
        if (elTotalItems) elTotalItems.textContent = items.length;
        if (elTotalStock) elTotalStock.textContent = stock.length;
        const lowStock = stock.filter(s => {
            const item = getItemById(s.itemId); const min = getMinAlert(item);
            const q = Number(s.quantity) || 0;
            return q > 0 && q <= min;
        });
        const outOfStock = stock.filter(s => (Number(s.quantity) || 0) <= 0);
        const elLow = document.getElementById('statLowStock');
        if (elLow) elLow.textContent = lowStock.length + outOfStock.length;
        let totalValue = 0;
        stock.forEach(s => { const item = getItemById(s.itemId); if (item) totalValue += getSellingPrice(item) * (Number(s.quantity) || 0); });
        const elVal = document.getElementById('statInventoryValue');
        if (elVal) elVal.textContent = formatCurrency(totalValue);

        const lowStockList = document.getElementById('lowStockList');
        if (lowStockList) {
            const alerts = [...outOfStock, ...lowStock].slice(0, 8);
            if (!alerts.length) { lowStockList.innerHTML = '<div class="empty-state"><i class="fas fa-check-circle text-success"></i><p>All items are well-stocked! 🎉</p></div>'; }
            else {
                lowStockList.innerHTML = alerts.map(s => {
                    const item = getItemById(s.itemId); if (!item) return '';
                    const brand = getBrandById(item.brandId);
                    const isOut = (Number(s.quantity) || 0) <= 0;
                    const min = getMinAlert(item);
                    return `<div class="alert-item ${isOut ? 'danger' : ''}">
                        <div style="min-width:0;flex:1;"><strong>${escapeHtml(brand?.name || '')} ${escapeHtml(item.itemName)}</strong><br><small class="text-muted">${escapeHtml(getStorageById(s.storageId)?.name || 'Unknown')} · Alert ≤ ${min}</small></div>
                        <span class="badge-soft ${isOut ? 'red' : 'orange'}">${isOut ? 'Out' : (Number(s.quantity)) + ' left'}</span>
                    </div>`;
                }).join('');
            }
        }

        const expiringList = document.getElementById('expiringList');
        if (expiringList) {
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
                    return `<div class="alert-item"><div style="min-width:0;flex:1;"><strong>${escapeHtml(brand?.name || '')} ${escapeHtml(item.itemName)}</strong><br><small class="text-muted">${escapeHtml(getStorageById(s.storageId)?.name || '')}</small></div><span class="badge-soft orange">${days}d</span></div>`;
                }).join('');
            }
        }

        refreshBrandUsageWidget();

        const recent = [...items].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 5);
        const tbody = document.getElementById('recentItemsBody');
        if (tbody) {
            if (!recent.length) { tbody.innerHTML = '<tr><td colspan="4" class="empty-state"><i class="fas fa-inbox"></i><p>No items yet.</p></td></tr>'; }
            else {
                tbody.innerHTML = recent.map(i => {
                    const brand = getBrandById(i.brandId);
                    return `<tr><td>${escapeHtml(i.itemName)}</td><td>${brand ? `<span class="badge-soft purple">${escapeHtml(brand.name)}</span>` : '<span class="text-muted">—</span>'}</td><td>${i.size} ${i.unit}</td><td>${formatCurrency(getSellingPrice(i))}</td></tr>`;
                }).join('');
            }
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
                    <div class="d-flex justify-content-between align-items-center"><strong>${escapeHtml(u.name)}</strong><small class="text-muted">${u.itemCount} item${u.itemCount !== 1 ? 's' : ''}</small></div>
                    <div class="brand-usage-bar"><div style="width:${pct}%;"></div></div>
                    <small class="text-muted">Stock: ${u.stockCount.toFixed(0)} units · Value: ${formatCurrency(u.value)}</small>
                </div>
            </div>`;
        }).join('');
    }

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

    // ─── Search listeners ────────────────────────────
    function attachSearchListeners() {
        ['stockSearch', 'stockBrandFilter', 'stockStorageFilter', 'stockStatusFilter'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('input', GS.stock.refreshStock);
        });
        ['itemSearch', 'itemCategoryFilter', 'itemBrandFilter'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('input', GS.items.refreshItems);
        });
    }

    // ─── Init ───────────────────────────────────────
    function init() {
        function setAppViewport() {
            document.documentElement.style.setProperty('--app-h', window.innerHeight + 'px');
        }
        setAppViewport();
        window.addEventListener('orientationchange', () => {
            setTimeout(setAppViewport, 250);
        });
        if (window.visualViewport) {
            window.visualViewport.addEventListener('resize', setAppViewport);
        }

        const curDateEl = document.getElementById('currentDateDisplay');
        if (curDateEl) curDateEl.textContent = new Date().toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

        document.querySelectorAll('.sidebar-nav .nav-link').forEach(l => l.addEventListener('click', function () {
            const page = this.getAttribute('data-page');
            if (page) navigateTo(page);
        }));
        const menuBtn = document.getElementById('mobileMenuBtn');
        const closeBtn = document.getElementById('sidebarCloseBtn');
        const overlay = document.getElementById('sidebarOverlay');
        if (menuBtn) menuBtn.addEventListener('click', GS.masters.openSidebar);
        if (closeBtn) closeBtn.addEventListener('click', GS.masters.closeSidebar);
        if (overlay) overlay.addEventListener('click', GS.masters.closeSidebar);
        document.addEventListener('keydown', e => { if (e.key === 'Escape') GS.masters.closeSidebar(); });
        let rt;
        window.addEventListener('resize', () => {
            clearTimeout(rt);
            rt = setTimeout(() => {
                if (!isMobile()) GS.masters.closeSidebar();
                const fab = document.getElementById('mobileFab');
                if (fab) fab.style.display = (isMobile() && ['stock', 'items', 'brands', 'sellers', 'categories', 'storages'].includes(currentPage)) ? 'flex' : 'none';
            }, 200);
        });

        document.querySelectorAll('.bottom-nav-item').forEach(btn => {
            btn.addEventListener('click', function () {
                const nav = this.getAttribute('data-nav');
                if (nav === 'more') {
                    GS.masters.openSidebar();
                    document.querySelectorAll('.sidebar-nav .nav-link').forEach(el => el.classList.remove('active'));
                    const cur = document.querySelector(`.sidebar-nav [data-page="${currentPage}"]`);
                    if (cur) cur.classList.add('active');
                } else {
                    navigateTo(nav);
                }
            });
        });

        GS.csv.buildIoMenus();
        attachSearchListeners();
        refreshDropdowns();

        // Autocomplete initial setups
        GS.items.setupItemBrandAc();
        GS.items.setupItemCategoryAc();
        GS.stock.setupStockItemAc();
        GS.shopping.setupShoppingItemAc();
        GS.shopping.setupPnItemAc();

        ['pnSearch', 'pnStatusFilter'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('input', GS.shopping.refreshPurchaseNotes);
        });

        navigateTo('dashboard');
    }

    Object.assign(GS, {
        app: {
            navigateTo, refreshCurrentPage, updateBadges, refreshDashboard,
            refreshDropdowns, populateDropdown, attachSearchListeners, init
        }
    });

    // Inline HTML ke liye
    window.navigateTo = navigateTo;

    init();
})();