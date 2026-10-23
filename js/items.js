/* ============================================================
   GharSeva — items.js
   Item Master + seller pricing rows + photo.
   ============================================================ */
(function () {
    'use strict';
    const {
        showToast, escapeHtml, uid, formatCurrency, formatDate,
        safeImg, thumbHtml, resizeImageFile, getDiscountPct,
        getItems, getStock, getCategories, getBrands, getSellers,
        saveItems, getItemById, getCategoryById, getBrandById, getSellerById,
        getMinAlert, getSellingPrice, getBestSellerPrice, getSellerPrice
    } = GS;

    let __itemImage = '';

    // ─── Autocomplete setups ─────────────────────────
    function setupItemBrandAc() {
        GS.ac.acSetup('itemBrandAc', {
            getSource: () => getBrands().map(b => ({ id: b.id, label: b.name, sub: b.description || '' })),
            onSelect: (id) => { document.getElementById('itemBrand').value = id; },
            onClear: () => { document.getElementById('itemBrand').value = ''; }
        });
    }
    function setupItemCategoryAc() {
        GS.ac.acSetup('itemCategoryAc', {
            getSource: () => getCategories().map(c => ({ id: c.id, label: c.name, sub: c.description || '' })),
            onSelect: (id) => { document.getElementById('itemCategory').value = id; },
            onClear: () => { document.getElementById('itemCategory').value = ''; }
        });
    }

    // ─── Item photo ─────────────────────────────────
    function setItemImage(dataUrl) {
        __itemImage = dataUrl || '';
        const prev = document.getElementById('itemImagePreview');
        const rm = document.getElementById('itemImageRemoveBtn');
        const info = document.getElementById('itemImageInfo');

        if (prev) {
            if (__itemImage) {
                const safe = safeImg(__itemImage);
                prev.innerHTML = `<img src="${safe}" 
                alt="Selected item image"
                onerror="this.onerror=null;this.src='./assets/images/no_image_found.png'">`;
            } else {
                prev.innerHTML = '<i class="fas fa-image"></i>';
            }
        }
        if (rm) rm.style.display = __itemImage ? '' : 'none';
        if (info) {
            if (__itemImage) {
                const isDataUrl = __itemImage.startsWith('data:');
                const b64 = isDataUrl ? (__itemImage.split(',')[1] || '') : '';
                const kb = Math.round(b64.length * 0.75 / 1024);
                info.textContent = isDataUrl ? `~${kb} KB` : 'Image selected';
            } else {
                info.textContent = 'Koi photo nahi (optional)';
            }
        }
    }
    function onItemImagePicked(input) {
        const file = input.files && input.files[0];
        input.value = '';
        if (!file) return;
        if (!/^image\//.test(file.type)) { showToast('Sirf image file select karein', 'warning'); return; }
        resizeImageFile(file, 256, 0.7)
            .then(url => setItemImage(url))
            .catch(() => showToast('Image process nahi ho payi (JPG/PNG/WebP try karein)', 'error'));
    }
    function removeItemImage() { setItemImage(''); }

    // ─── Seller pricing rows ─────────────────────────
    function addSellerPriceRow(sellerId, price) {
        const container = document.getElementById('sellerPricingContainer');
        if (!container) return;
        const sellers = getSellers();
        if (!sellers.length) {
            GS.masters.openQuickSellerModal((newId) => addSellerPriceRow(newId, price));
            return;
        }
        const rowId = 'spr_' + Date.now() + Math.random().toString(36).substr(2, 4);
        const opts = sellers.map(s => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join('');
        const html = `
            <div class="seller-price-row" id="${rowId}">
                <select class="form-select sp-seller">
                    <option value="">-- Select Seller --</option>
                    ${opts}
                    <option value="__add_new__">➕ Add New Seller...</option>
                </select>
                <input type="number" class="form-control sp-price" placeholder="Price" step="0.01" min="0" oninput="recalcSellerRow('${rowId}')">
                <div class="sp-discount discount-badge text-muted">—</div>
                <button type="button" class="btn-remove sp-remove" onclick="removeSellerPriceRow('${rowId}')" title="Remove">
                    <i class="fas fa-times"></i>
                </button>
            </div>`;
        container.insertAdjacentHTML('beforeend', html);
        const row = document.getElementById(rowId);
        const sel = row.querySelector('.sp-seller');
        const pIn = row.querySelector('.sp-price');
        if (sellerId) sel.value = sellerId;
        if (price !== undefined && price !== null && price !== '') pIn.value = price;

        sel.addEventListener('change', function () {
            if (this.value === '__add_new__') {
                this.value = '';
                GS.masters.openQuickSellerModal((newId) => {
                    const freshSellers = getSellers();
                    const newOpts = freshSellers.map(s => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join('');
                    this.innerHTML = `<option value="">-- Select Seller --</option>${newOpts}<option value="__add_new__">➕ Add New Seller...</option>`;
                    this.value = newId;
                    recalcSellerRow(rowId);
                });
            } else {
                recalcSellerRow(rowId);
            }
        });

        recalcSellerRow(rowId);
    }
    function removeSellerPriceRow(rowId) {
        const el = document.getElementById(rowId);
        if (el) el.remove();
    }
    function recalcSellerRow(rowId) {
        const row = document.getElementById(rowId); if (!row) return;
        const price = parseFloat(row.querySelector('.sp-price').value) || 0;
        const mrp = parseFloat(document.getElementById('itemMrp').value) || 0;
        const discount = getDiscountPct(mrp, price);
        const badge = row.querySelector('.sp-discount');
        if (price > 0 && discount > 0) {
            badge.textContent = `${discount}% off`;
            badge.className = 'sp-discount discount-badge text-success';
        } else {
            badge.textContent = '—';
            badge.className = 'sp-discount discount-badge text-muted';
        }
    }
    document.addEventListener('input', function (e) {
        if (e.target && e.target.id === 'itemMrp') {
            document.querySelectorAll('.seller-price-row').forEach(r => recalcSellerRow(r.id));
        }
    });

    // ─── Items list ─────────────────────────────────
    function refreshItems() {
        const tbody = document.getElementById('itemsBody');
        const mob = document.getElementById('itemsMobileList');
        if (!tbody || !mob) return;
        const search = (document.getElementById('itemSearch')?.value || '').toLowerCase();
        const catFilter = document.getElementById('itemCategoryFilter')?.value || '';
        const brandFilter = document.getElementById('itemBrandFilter')?.value || '';
        let items = getItems();
        if (search) items = items.filter(i => (i.itemName || '').toLowerCase().includes(search));
        if (catFilter) items = items.filter(i => i.categoryId === catFilter);
        if (brandFilter) items = items.filter(i => i.brandId === brandFilter);
        items = items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        if (!items.length) {
            tbody.innerHTML = '<tr><td colspan="9" class="empty-state"><i class="fas fa-tag"></i><p>No items found.</p></td></tr>';
            mob.innerHTML = '<div class="empty-state"><i class="fas fa-tag"></i><p>No items found.</p></div>';
            return;
        }

        tbody.innerHTML = items.map(i => {
            const cat = getCategoryById(i.categoryId);
            const brand = getBrandById(i.brandId);
            const mrp = Number(i.mrp) || 0;
            const basePrice = Number(i.price) || 0;
            const best = getBestSellerPrice(i);
            const bestSeller = best ? getSellerById(best.sellerId) : null;
            const bestDiscount = best ? getDiscountPct(mrp, best.price) : 0;
            return `<tr>
                <td>${brand ? `<span class="badge-soft purple">${escapeHtml(brand.name)}</span>` : '<span class="text-muted">—</span>'}</td>
                <td><div class="d-flex align-items-center gap-2">${thumbHtml(i, 'md')}<strong>${escapeHtml(i.itemName)}</strong></div></td>
                <td>${cat ? `<span class="badge-soft blue">${escapeHtml(cat.name)}</span>` : '<span class="text-muted">—</span>'}</td>
                <td>${i.size} <span class="badge-soft gray">${escapeHtml(i.unit)}</span></td>
                <td>${mrp ? formatCurrency(mrp) : '<span class="text-muted">—</span>'}</td>
                <td>${basePrice ? formatCurrency(basePrice) : '<span class="text-muted">—</span>'}${i.lastBuyDate ? `<br><small class="text-muted">last buy ${formatDate(i.lastBuyDate)}</small>` : ''}</td>
                <td>${bestSeller ? `<span class="seller-chip best"><span class="seller-name">${escapeHtml(bestSeller.name)}</span> <span class="seller-price">${formatCurrency(best.price)}</span>${bestDiscount ? ` <span class="seller-disc">${bestDiscount}%</span>` : ''}</span>` : '<span class="text-muted small">No sellers</span>'}</td>
                <td><span class="badge-soft orange">≤ ${getMinAlert(i)}</span></td>
                <td>
                    <button class="btn btn-sm item-stock-btn me-1" onclick="openStockModal('add',null,'${i.id}')" title="Add stock"><i class="fas fa-plus"></i></button>
                    <button class="btn btn-sm btn-outline-primary me-1" onclick="openItemModal('edit','${i.id}')"><i class="fas fa-edit"></i></button>
                    <button class="btn btn-sm btn-outline-danger" onclick="deleteItem('${i.id}')"><i class="fas fa-trash"></i></button>
                </td>
            </tr>`;
        }).join('');

        mob.innerHTML = items.map(i => {
            const cat = getCategoryById(i.categoryId);
            const brand = getBrandById(i.brandId);
            const mrp = Number(i.mrp) || 0;
            const basePrice = Number(i.price) || 0;
            const sellerChips = (i.sellers || []).map(sp => {
                const seller = getSellerById(sp.sellerId);
                if (!seller) return '';
                const disc = getDiscountPct(mrp, sp.price);
                const best = getBestSellerPrice(i);
                const isBest = best && best.sellerId === sp.sellerId;
                return `<span class="seller-chip ${isBest ? 'best' : ''}">
                    <span class="seller-name">${escapeHtml(seller.name)}</span>
                    <span class="seller-price">${formatCurrency(sp.price)}</span>
                    ${disc ? `<span class="seller-disc">${disc}%</span>` : ''}
                </span>`;
            }).join('');
            return `<div class="mobile-card">
                <div class="mobile-card-header">
                    ${thumbHtml(i, 'lg')}
                    <div style="min-width:0;flex:1;">
                        <div class="mobile-card-title">${escapeHtml(i.itemName)}</div>
                        <div class="mobile-card-sub">${i.size} ${escapeHtml(i.unit)} ${cat ? '· ' + escapeHtml(cat.name) : ''}</div>
                    </div>
                    ${brand ? `<span class="badge-soft purple">${escapeHtml(brand.name)}</span>` : ''}
                </div>
                <div class="mobile-card-row"><span class="label">MRP</span><span>${mrp ? formatCurrency(mrp) : '—'}</span></div>
                <div class="mobile-card-row"><span class="label">Base Price</span><span><strong>${basePrice ? formatCurrency(basePrice) : '—'}</strong>${i.lastBuyDate ? ` <small class="text-muted">(${formatDate(i.lastBuyDate)})</small>` : ''}</span></div>
                <div class="mobile-card-row"><span class="label">Min Alert</span><span class="badge-soft orange">≤ ${getMinAlert(i)}</span></div>
                ${sellerChips ? `<div style="margin-top:6px;"><small class="text-muted d-block mb-1">Sellers:</small>${sellerChips}</div>` : ''}
                ${i.notes ? `<div class="mobile-card-row" style="margin-top:6px;"><span class="label">Notes</span><span>${escapeHtml(i.notes)}</span></div>` : ''}
                <div class="mobile-card-actions">
                    <button class="btn btn-outline-success" onclick="openStockModal('add',null,'${i.id}')"><i class="fas fa-plus me-1"></i>Stock</button>
                    <button class="btn btn-outline-primary" onclick="openItemModal('edit','${i.id}')"><i class="fas fa-edit me-1"></i>Edit</button>
                    <button class="btn btn-outline-danger" onclick="deleteItem('${i.id}')"><i class="fas fa-trash me-1"></i>Delete</button>
                </div>
            </div>`;
        }).join('');
    }

    function openItemModal(mode, id) {
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
        document.getElementById('itemBrand').value = '';
        document.getElementById('itemCategory').value = '';
        document.getElementById('itemBrandAc').value = '';
        document.getElementById('itemCategoryAc').value = '';
        document.getElementById('sellerPricingContainer').innerHTML = '';
        setItemImage('');

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
            setItemImage(safeImg(i.image));
            (i.sellers || []).forEach(sp => addSellerPriceRow(sp.sellerId, sp.price));
        }

        setupItemBrandAc();
        setupItemCategoryAc();
        const bId = document.getElementById('itemBrand').value;
        const cId = document.getElementById('itemCategory').value;
        if (bId) GS.ac.acSetValue('itemBrandAc', bId); else GS.ac.acClear('itemBrandAc');
        if (cId) GS.ac.acSetValue('itemCategoryAc', cId); else GS.ac.acClear('itemCategoryAc');

        new bootstrap.Modal(document.getElementById('itemModal')).show();
    }

    function saveItem() {
        const itemName = document.getElementById('itemName').value.trim();
        if (!itemName) { showToast('Item name required', 'warning'); return; }
        const brandId = document.getElementById('itemBrand').value;
        const categoryId = document.getElementById('itemCategory').value;
        if (!brandId) { showToast('Brand required — list se select karein', 'warning'); return; }
        if (!categoryId) { showToast('Category required — list se select karein', 'warning'); return; }
        const size = parseFloat(document.getElementById('itemSize').value);
        if (!size || size <= 0) { showToast('Valid size required', 'warning'); return; }
        const mrp = parseFloat(document.getElementById('itemMrp').value);
        if (isNaN(mrp) || mrp < 0) { showToast('Valid MRP required', 'warning'); return; }
        const price = parseFloat(document.getElementById('itemPrice').value);
        if (isNaN(price) || price < 0) { showToast('Valid price required', 'warning'); return; }
        const minAlert = parseFloat(document.getElementById('itemMinAlert').value);
        if (isNaN(minAlert) || minAlert < 0) { showToast('Valid min alert required', 'warning'); return; }

        const sellers = [];
        const seen = new Set();
        document.querySelectorAll('.seller-price-row').forEach(row => {
            const sellerId = row.querySelector('.sp-seller').value;
            const sellerPrice = parseFloat(row.querySelector('.sp-price').value);
            if (sellerId && sellerId !== '__add_new__' && !isNaN(sellerPrice) && sellerPrice >= 0) {
                if (seen.has(sellerId)) { showToast('Duplicate seller — only first kept', 'warning'); return; }
                seen.add(sellerId);
                sellers.push({ sellerId, price: sellerPrice });
            }
        });

        const editId = document.getElementById('itemEditId').value;
        const items = getItems();
        const data = {
            id: editId || uid('itm'),
            brandId, itemName, categoryId,
            size, unit: document.getElementById('itemUnit').value,
            mrp, price, minAlert,
            sellers,
            notes: document.getElementById('itemNotes').value.trim(),
            image: __itemImage || '',
            lastBuyDate: (editId && getItemById(editId)?.lastBuyDate) || null,
            createdAt: editId ? (getItemById(editId)?.createdAt || new Date().toISOString()) : new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        if (editId) { const i = items.findIndex(x => x.id === editId); if (i >= 0) items[i] = data; }
        else items.push(data);
        if (!saveItems(items)) return;
        bootstrap.Modal.getInstance(document.getElementById('itemModal')).hide();
        showToast(editId ? 'Item updated!' : 'Item added!', 'success');
        refreshItems(); GS.app.refreshDropdowns(); GS.app.refreshDashboard(); GS.app.updateBadges();
    }
    function deleteItem(id) {
        const used = getStock().filter(s => s.itemId === id).length;
        if (used) { showToast(`Cannot delete — ${used} stock entr(ies) use this item`, 'error'); return; }
        if (!confirm('Delete this item?')) return;
        saveItems(getItems().filter(i => i.id !== id));
        showToast('Item deleted', 'success');
        refreshItems(); GS.app.refreshDropdowns(); GS.app.refreshDashboard();
    }

    Object.assign(GS, {
        items: {
            refreshItems, openItemModal, saveItem, deleteItem,
            setupItemBrandAc, setupItemCategoryAc, setItemImage,
            addSellerPriceRow, removeSellerPriceRow, recalcSellerRow,
            onItemImagePicked, removeItemImage
        }
    });

    // Inline HTML ke liye
    window.openItemModal = openItemModal;
    window.saveItem = saveItem;
    window.deleteItem = deleteItem;
    window.onItemImagePicked = onItemImagePicked;
    window.removeItemImage = removeItemImage;
    window.addSellerPriceRow = addSellerPriceRow;
    window.removeSellerPriceRow = removeSellerPriceRow;
    window.recalcSellerRow = recalcSellerRow;
})();