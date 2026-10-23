/* ============================================================
   GharSeva — shopping.js
   Direct Shopping List + Purchase Notes.
   ============================================================ */
(function () {
    'use strict';
    const {
        showToast, escapeHtml, uid, formatCurrency, formatDate, todayISO,
        thumbHtml, load, save, getDiscountPct,
        getShopping, getPurchaseNotes, getItems, getStock, getSellers,
        saveShopping, savePurchaseNotes,
        getItemById, getBrandById, getSellerById, getMinAlert,
        getSellingPrice, getBestSellerPrice, getSellerPrice
    } = GS;

    const gid = id => document.getElementById(id);
    let __shopTab = load('shopTab', 'list');
    const __pnOpen = new Set();
    let __pnDraft = { items: [] };

    // ─── Common ─────────────────────────────────────
    function itemDisplayName(item) {
        if (!item) return '';
        const brand = getBrandById(item.brandId);
        return (brand ? brand.name + ' ' : '') + item.itemName;
    }
    function shoppingItemAcSource() {
        return getItems().map(i => ({
            id: i.id,
            label: `${itemDisplayName(i)} ${i.size}${i.unit}`,
            sub: `${i.size} ${i.unit}${Number(i.price) > 0 ? ' · ' + formatCurrency(i.price) : ''}`
        }));
    }
    function copyText(text, okMsg) {
        if (navigator.clipboard) {
            navigator.clipboard.writeText(text).then(() => showToast(okMsg, 'success'));
        } else {
            const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select();
            document.execCommand('copy'); document.body.removeChild(ta); showToast(okMsg, 'success');
        }
    }
    function sellerOptionsFor(item) {
        const list = item.sellers || [];
        if (!list.length) {
            return { html: '<option value="">-- No seller (base price) --</option>', sellerId: '', price: Number(item.price) || Number(item.mrp) || 0 };
        }
        const opts = list.map(sp => {
            const s = getSellerById(sp.sellerId); if (!s) return '';
            const d = getDiscountPct(item.mrp, sp.price);
            return `<option value="${sp.sellerId}">${escapeHtml(s.name)} — ${formatCurrency(sp.price)}${d ? ' (' + d + '% off)' : ''}</option>`;
        }).join('');
        const best = getBestSellerPrice(item) || { sellerId: list[0].sellerId, price: Number(list[0].price) || 0 };
        return { html: '<option value="">-- Seller (optional) --</option>' + opts, sellerId: best.sellerId, price: best.price };
    }

    // ─── Tabs ───────────────────────────────────────
    function switchShopTab(tab) {
        __shopTab = tab === 'notes' ? 'notes' : 'list';
        save('shopTab', __shopTab);
        applyShopTab();
    }
    function applyShopTab() {
        const isNotes = __shopTab === 'notes';
        const set = (id, show, disp) => { const el = gid(id); if (el) el.style.display = show ? (disp || 'block') : 'none'; };
        set('shopPaneList', !isNotes);
        set('shopPaneNotes', isNotes);
        set('shopToolsList', !isNotes, 'flex');
        set('shopToolsNotes', isNotes, 'flex');
        const bl = gid('shopTabBtnList'), bn = gid('shopTabBtnNotes');
        if (bl) bl.classList.toggle('active', !isNotes);
        if (bn) bn.classList.toggle('active', isNotes);
    }
    function updateShopTabCounts() {
        const a = gid('shopTabCountList'), b = gid('shopTabCountNotes');
        if (a) a.textContent = getShopping().filter(s => !s.done).length;
        if (b) b.textContent = getPurchaseNotes().filter(n => !pnStats(n).complete).length;
    }

    function refreshShopping() {
        applyShopTab();
        refreshDirectShopping();
        refreshPurchaseNotes();
        updateShopTabCounts();
    }

    // ─── Autocomplete setups ─────────────────────────
    function setupShoppingItemAc() {
        GS.ac.acSetup('shoppingItemAc', {
            getSource: shoppingItemAcSource,
            onSelect: (id) => { gid('shoppingItem').value = id; onShoppingItemChange(); },
            onClear: () => { gid('shoppingItem').value = ''; onShoppingItemChange(); },
            onType: () => { if (gid('shoppingItem').value) { gid('shoppingItem').value = ''; onShoppingItemChange(); } }
        });
    }
    function setupPnItemAc() {
        GS.ac.acSetup('pnItemAc', {
            getSource: shoppingItemAcSource,
            onSelect: (id) => { gid('pnItem').value = id; pnOnItemChange(); },
            onClear: () => { gid('pnItem').value = ''; pnOnItemChange(); },
            onType: () => { if (gid('pnItem').value) { gid('pnItem').value = ''; pnOnItemChange(); } }
        });
    }

    // ═══ DIRECT SHOPPING LIST ═══
    function refreshDirectShopping() {
        const container = gid('shoppingListContainer');
        if (!container) return;
        const list = getShopping();
        if (!list.length) { container.innerHTML = '<div class="empty-state"><i class="fas fa-cart-shopping"></i><p>Shopping list khaali hai.</p></div>'; return; }
        const active = list.filter(s => !s.done);
        const done = list.filter(s => s.done);
        let html = '';
        if (active.length) {
            const totalEst = active.reduce((sum, s) => sum + (Number(s.totalPrice) || 0), 0);
            html += `<div class="mb-3 d-flex justify-content-between flex-wrap gap-2">
                <span class="badge-soft green">${active.length} item(s) pending</span>
                <strong>Est. Total: ${formatCurrency(totalEst)}</strong>
            </div>`;
            html += active.map(s => shoppingItemHTML(s)).join('');
        }
        if (done.length) {
            const doneAmt = done.reduce((sum, s) => sum + (Number(s.totalPrice) || 0), 0);
            html += `<div class="mt-3 mb-2 d-flex justify-content-between flex-wrap gap-1 text-muted small fw-bold">
                <span>COMPLETED (${done.length})</span>
                <span style="color:#059669;">Bought: ${formatCurrency(doneAmt)}</span>
            </div>`;
            html += done.map(s => shoppingItemHTML(s)).join('');
        }
        container.innerHTML = html;
    }
    function shoppingItemHTML(s) {
        const seller = s.sellerId ? getSellerById(s.sellerId) : null;
        const item = s.itemId ? getItemById(s.itemId) : null;
        const brand = item ? getBrandById(item.brandId) : null;
        return `<div class="shopping-item ${s.done ? 'done' : ''}">
            <input type="checkbox" class="form-check-input" ${s.done ? 'checked' : ''} onchange="toggleShoppingDone('${s.id}')">
            <div style="flex:1;min-width:0;">
                <div style="font-weight:700;display:flex;align-items:center;gap:8px;">${item ? thumbHtml(item, 'sm') : ''}<span>${escapeHtml(s.name)}</span></div>
                <div style="font-size:0.8rem;color:#64748b;margin-top:2px;">
                    ${brand ? `<span class="badge-soft purple">${escapeHtml(brand.name)}</span> ` : ''}
                    ${seller ? `<span class="seller-chip"><span class="seller-name">${escapeHtml(seller.name)}</span> ${s.price ? `<span class="seller-price">${formatCurrency(s.price)}</span>` : ''}</span>` : ''}
                    ${s.qty ? `<span class="text-muted"> · Qty: <strong>${s.qty}</strong> ${escapeHtml(s.unit || '')}</span>` : ''}
                </div>
                ${s.notes ? `<small class="text-muted">${escapeHtml(s.notes)}</small>` : ''}
            </div>
            <div class="text-end" style="flex-shrink:0;">
                ${s.totalPrice ? `<strong style="color:#059669;">${formatCurrency(s.totalPrice)}</strong>` : ''}
            </div>
            <div class="d-flex gap-1">
                <button class="btn btn-sm btn-outline-primary" onclick="openShoppingModal('edit','${s.id}')"><i class="fas fa-edit"></i></button>
                <button class="btn btn-sm btn-outline-danger" onclick="deleteShoppingItem('${s.id}')"><i class="fas fa-trash"></i></button>
            </div>
        </div>`;
    }

    function openShoppingModal(mode, id) {
        gid('shoppingEditId').value = '';
        gid('shoppingModalTitle').textContent = 'Add to Shopping List';
        gid('shoppingQty').value = '1';
        gid('shoppingUnit').value = '';
        gid('shoppingPrice').value = '';
        gid('shoppingNotes').value = '';
        gid('shoppingTotalPreview').textContent = '₹0';
        gid('shoppingItem').value = '';
        gid('shoppingItemAc').value = '';
        gid('shoppingSellerSelect').innerHTML = '<option value="">-- Select Item first --</option>';

        setupShoppingItemAc();

        if (mode === 'edit' && id) {
            const s = getShopping().find(x => x.id === id); if (!s) return;
            gid('shoppingEditId').value = s.id;
            gid('shoppingModalTitle').textContent = 'Edit Shopping Item';
            if (s.itemId) {
                gid('shoppingItem').value = s.itemId;
                GS.ac.acSetValue('shoppingItemAc', s.itemId);
                if (s.sellerId) gid('shoppingSellerSelect').value = s.sellerId;
            }
            gid('shoppingQty').value = s.qty || '1';
            gid('shoppingPrice').value = s.price || '';
            gid('shoppingNotes').value = s.notes || '';
            recalcShoppingTotal();
        }
        new bootstrap.Modal(gid('shoppingModal')).show();
    }

    function onShoppingItemChange() {
        const itemId = gid('shoppingItem').value;
        const sellerSel = gid('shoppingSellerSelect');
        const qtyIn = gid('shoppingQty');
        const unitIn = gid('shoppingUnit');
        const priceIn = gid('shoppingPrice');

        if (!itemId) {
            sellerSel.innerHTML = '<option value="">-- Select Item first --</option>';
            unitIn.value = '';
            priceIn.value = '';
            qtyIn.value = '1';
            recalcShoppingTotal();
            return;
        }

        const item = getItemById(itemId); if (!item) return;
        unitIn.value = item.unit || '';

        const itemSellers = (item.sellers || []);
        if (!itemSellers.length) {
            sellerSel.innerHTML = '<option value="">-- No sellers for this item --</option>';
            priceIn.value = item.price || item.mrp || '';
        } else {
            const opts = itemSellers.map(sp => {
                const seller = getSellerById(sp.sellerId);
                if (!seller) return '';
                const disc = getDiscountPct(item.mrp, sp.price);
                return `<option value="${sp.sellerId}" data-price="${sp.price}">${escapeHtml(seller.name)} — ${formatCurrency(sp.price)}${disc ? ' (' + disc + '% off)' : ''}</option>`;
            }).join('');
            sellerSel.innerHTML = '<option value="">-- Select Seller --</option>' + opts;

            const best = getBestSellerPrice(item);
            if (best) {
                sellerSel.value = best.sellerId;
                priceIn.value = best.price;
            } else if (itemSellers.length) {
                sellerSel.value = itemSellers[0].sellerId;
                priceIn.value = itemSellers[0].price;
            }
        }
        recalcShoppingTotal();
    }

    function onShoppingSellerChange() {
        const sellerId = gid('shoppingSellerSelect').value;
        const itemId = gid('shoppingItem').value;
        const priceIn = gid('shoppingPrice');
        if (!itemId || !sellerId) return;
        const item = getItemById(itemId); if (!item) return;
        const sp = getSellerPrice(item, sellerId);
        if (sp) priceIn.value = sp.price;
        recalcShoppingTotal();
    }

    function recalcShoppingTotal() {
        const qty = parseFloat(gid('shoppingQty').value) || 0;
        const price = parseFloat(gid('shoppingPrice').value) || 0;
        gid('shoppingTotalPreview').textContent = formatCurrency(qty * price);
    }

    document.addEventListener('input', function (e) {
        if (e.target && e.target.id === 'shoppingQty') recalcShoppingTotal();
    });

    function saveShoppingItem() {
        const itemId = gid('shoppingItem').value;
        if (!itemId) { showToast('Item required — list se select karein', 'warning'); return; }
        const item = getItemById(itemId); if (!item) { showToast('Item not found', 'error'); return; }
        const qty = parseFloat(gid('shoppingQty').value);
        if (isNaN(qty) || qty <= 0) { showToast('Valid quantity required', 'warning'); return; }
        const price = parseFloat(gid('shoppingPrice').value) || 0;
        const sellerId = gid('shoppingSellerSelect').value || null;

        const editId = gid('shoppingEditId').value;
        const list = getShopping();
        const data = {
            id: editId || uid('shp'),
            itemId, sellerId,
            name: itemDisplayName(item),
            qty, unit: item.unit, price,
            totalPrice: qty * price,
            notes: gid('shoppingNotes').value.trim(),
            done: editId ? (list.find(x => x.id === editId)?.done || false) : false,
            createdAt: editId ? (list.find(x => x.id === editId)?.createdAt || new Date().toISOString()) : new Date().toISOString()
        };
        if (editId) { const i = list.findIndex(x => x.id === editId); if (i >= 0) list[i] = data; }
        else list.push(data);
        saveShopping(list);
        bootstrap.Modal.getInstance(gid('shoppingModal')).hide();
        showToast(editId ? 'Updated!' : 'Added to list!', 'success');
        refreshShopping(); GS.app.updateBadges();
    }
    function toggleShoppingDone(id) {
        const list = getShopping(); const s = list.find(x => x.id === id); if (!s) return;
        s.done = !s.done;
        saveShopping(list);
        refreshShopping(); GS.app.updateBadges();
    }
    function deleteShoppingItem(id) {
        if (!confirm('Remove from shopping list?')) return;
        saveShopping(getShopping().filter(s => s.id !== id));
        refreshShopping(); GS.app.updateBadges();
    }
    function autoGenerateShoppingList() {
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
            const existing = list.find(x => !x.done && x.itemId === item.id);
            if (existing) return;
            const min = getMinAlert(item);
            const shortfall = Math.max(1, min - (Number(s.quantity) || 0) + 1);
            const best = getBestSellerPrice(item);
            const price = best ? best.price : getSellingPrice(item);
            list.push({
                id: uid('shp'),
                itemId: item.id,
                sellerId: best ? best.sellerId : null,
                name: itemDisplayName(item),
                qty: shortfall, unit: item.unit, price,
                totalPrice: shortfall * price,
                notes: 'Auto-added from low stock',
                done: false,
                createdAt: new Date().toISOString()
            });
            added++;
        });
        saveShopping(list);
        showToast(`${added} item(s) added to shopping list`, 'success');
        refreshShopping(); GS.app.updateBadges();
    }
    function copyShoppingList() {
        const list = getShopping().filter(s => !s.done);
        if (!list.length) { showToast('Shopping list is empty', 'warning'); return; }
        let text = '🛒 *Shopping List*\n\n';
        list.forEach((s, i) => {
            const seller = s.sellerId ? getSellerById(s.sellerId) : null;
            text += `${i + 1}. ${s.name}`;
            if (seller) text += ` [${seller.name}]`;
            if (s.qty) text += ` — ${s.qty} ${s.unit || ''}`;
            if (s.totalPrice) text += ` — ₹${s.totalPrice}`;
            text += '\n';
        });
        const total = list.reduce((sum, s) => sum + (Number(s.totalPrice) || 0), 0);
        text += `\n💰 Est. Total: ₹${total}\n\n— GharSeva`;
        copyText(text, 'Shopping list copied!');
    }

    // ═══ PURCHASE NOTES ═══
    function pnItemTotal(it) { return (Number(it.qty) || 0) * (Number(it.price) || 0); }

    function pnStats(note) {
        const items = (note && note.items) || [];
        let total = 0, bought = 0, boughtCount = 0;
        items.forEach(it => {
            const t = pnItemTotal(it);
            total += t;
            if (it.bought) { bought += t; boughtCount++; }
        });
        return {
            count: items.length, boughtCount, pendingCount: items.length - boughtCount,
            total, bought, pending: total - bought,
            pct: items.length ? Math.round(boughtCount / items.length * 100) : 0,
            complete: items.length > 0 && boughtCount === items.length
        };
    }
    function pnDueInfo(note, st) {
        if (!note.dueDate) return null;
        const diff = Math.round((new Date(note.dueDate + 'T00:00:00') - new Date(todayISO() + 'T00:00:00')) / 86400000);
        if (st.complete) return { cls: 'green', text: 'Done', overdue: false };
        if (diff < 0) return { cls: 'red', text: `${-diff} din late`, overdue: true };
        if (diff === 0) return { cls: 'orange', text: 'Aaj tak', overdue: false };
        if (diff === 1) return { cls: 'orange', text: 'Kal tak', overdue: false };
        if (diff <= 3) return { cls: 'orange', text: `${diff} din baaki`, overdue: false };
        return { cls: 'blue', text: `${diff} din baaki`, overdue: false };
    }

    function refreshPurchaseNotes() {
        const box = gid('pnListContainer'); if (!box) return;
        const all = getPurchaseNotes();
        const q = ((gid('pnSearch') || {}).value || '').trim().toLowerCase();
        const status = (gid('pnStatusFilter') || {}).value || 'open';

        let list = all.map(n => ({ n, st: pnStats(n) }));
        list = list.filter(({ n, st }) => {
            if (status === 'open' && st.complete) return false;
            if (status === 'done' && !st.complete) return false;
            if (status === 'overdue') { const d = pnDueInfo(n, st); if (!d || !d.overdue) return false; }
            if (q) {
                const hay = (n.title + ' ' + (n.remark || '') + ' ' + (n.items || []).map(i => i.name).join(' ')).toLowerCase();
                if (!hay.includes(q)) return false;
            }
            return true;
        });
        list.sort((a, b) => {
            if (a.st.complete !== b.st.complete) return a.st.complete ? 1 : -1;
            const ad = a.n.dueDate || '9999-12-31', bd = b.n.dueDate || '9999-12-31';
            if (ad !== bd) return ad.localeCompare(bd);
            return (b.n.createdAt || '').localeCompare(a.n.createdAt || '');
        });

        const sumEl = gid('pnSummary');
        if (sumEl) {
            if (!all.length) sumEl.innerHTML = '';
            else {
                const t = list.reduce((s, x) => s + x.st.total, 0);
                const b = list.reduce((s, x) => s + x.st.bought, 0);
                sumEl.innerHTML = `
                    <div class="pn-sum-box"><div class="lbl">Notes</div><div class="val">${list.length}</div></div>
                    <div class="pn-sum-box total"><div class="lbl">Total Amount</div><div class="val">${formatCurrency(t)}</div></div>
                    <div class="pn-sum-box bought"><div class="lbl">✅ Bought</div><div class="val" style="color:#059669;">${formatCurrency(b)}</div></div>
                    <div class="pn-sum-box pending"><div class="lbl">⏳ Pending</div><div class="val" style="color:#d97706;">${formatCurrency(t - b)}</div></div>`;
            }
        }

        if (!all.length) {
            box.innerHTML = `<div class="card-custom" style="grid-column:1/-1;"><div class="empty-state"><i class="fas fa-file-invoice"></i><p>Koi Purchase Note nahi hai.<br>PO ki tarah title, date aur items ke saath note banao.</p>
                <button class="btn btn-primary-custom btn-sm" onclick="openPnModal()"><i class="fas fa-plus me-1"></i>New Note</button></div></div>`;
            return;
        }
        if (!list.length) {
            box.innerHTML = `<div class="card-custom" style="grid-column:1/-1;"><div class="empty-state"><i class="fas fa-filter"></i><p>Is filter me koi note nahi mila.</p></div></div>`;
            return;
        }
        box.innerHTML = list.map(({ n, st }) => pnCardHTML(n, st)).join('');
    }

    function pnCardHTML(n, st) {
        const due = pnDueInfo(n, st);
        const open = __pnOpen.has(n.id);
        const cls = st.complete ? 'complete' : (due && due.overdue ? 'overdue' : '');
        const itemsHtml = open ? `<div class="pn-items">${(n.items || []).map(it => {
            const seller = it.sellerId ? getSellerById(it.sellerId) : null;
            const item = it.itemId ? getItemById(it.itemId) : null;
            return `<div class="pn-it ${it.bought ? 'bought' : ''}">
                <input type="checkbox" class="form-check-input" ${it.bought ? 'checked' : ''} onchange="togglePnItem('${n.id}','${it.id}')">
                <div class="pn-it-main">
                    <div class="pn-it-name">${item ? thumbHtml(item, 'sm') : ''}<span>${escapeHtml(it.name)}</span></div>
                    <div class="pn-it-sub">
                        ${seller ? `<span class="seller-chip"><span class="seller-name">${escapeHtml(seller.name)}</span></span>` : ''}
                        <span>${it.qty} ${escapeHtml(it.unit || '')} × ${formatCurrency(it.price)}</span>
                        ${it.bought && it.boughtAt ? `<span class="text-success">· ${formatDate(it.boughtAt)}</span>` : ''}
                    </div>
                    ${it.notes ? `<small class="text-muted">${escapeHtml(it.notes)}</small>` : ''}
                </div>
                <div class="pn-it-total">${formatCurrency(pnItemTotal(it))}</div>
            </div>`;
        }).join('')}</div>` : '';

        return `<div class="pn-card ${cls}">
            <div class="d-flex justify-content-between align-items-start gap-2">
                <div style="min-width:0;">
                    <div class="pn-title">${escapeHtml(n.title)}</div>
                    <div class="pn-meta">
                        ${n.dueDate ? `<span><i class="fas fa-calendar-day me-1"></i>${formatDate(n.dueDate)}</span>` : '<span class="text-muted">No due date</span>'}
                        ${due ? `<span class="badge-soft ${due.cls}">${due.text}</span>` : ''}
                    </div>
                </div>
                ${st.complete ? '<span class="badge-soft green">✅ Complete</span>' : `<span class="badge-soft gray">${st.boughtCount}/${st.count} bought</span>`}
            </div>
            ${n.remark ? `<div class="pn-remark">${escapeHtml(n.remark)}</div>` : ''}
            <div class="pn-progress"><span style="width:${st.pct}%"></span></div>
            <div class="pn-amt">
                <div><small>Total</small><b>${formatCurrency(st.total)}</b></div>
                <div class="g"><small>✅ Bought</small><b>${formatCurrency(st.bought)}</b></div>
                <div class="o"><small>⏳ Pending</small><b>${formatCurrency(st.pending)}</b></div>
            </div>
            <div class="pn-actions">
                <button class="btn btn-sm btn-outline-custom flex-grow-1" onclick="togglePnItems('${n.id}')"><i class="fas fa-chevron-${open ? 'up' : 'down'} me-1"></i>Items (${st.count})</button>
                <button class="btn btn-sm btn-outline-success" onclick="pnMarkAll('${n.id}')" title="${st.complete ? 'Sab unmark' : 'Sab bought mark karo'}"><i class="fas fa-check-double"></i></button>
                <button class="btn btn-sm btn-outline-primary" onclick="openPnModal('edit','${n.id}')" title="Edit"><i class="fas fa-edit"></i></button>
                <button class="btn btn-sm btn-outline-secondary" onclick="copyPurchaseNote('${n.id}')" title="Copy"><i class="fas fa-copy"></i></button>
                <button class="btn btn-sm btn-outline-danger" onclick="deletePurchaseNote('${n.id}')" title="Delete"><i class="fas fa-trash"></i></button>
            </div>
            ${itemsHtml}
        </div>`;
    }

    function togglePnItems(id) {
        if (__pnOpen.has(id)) __pnOpen.delete(id); else __pnOpen.add(id);
        refreshPurchaseNotes();
    }
    function togglePnItem(noteId, rid) {
        const all = getPurchaseNotes(); const n = all.find(x => x.id === noteId); if (!n) return;
        const it = (n.items || []).find(x => x.id === rid); if (!it) return;
        it.bought = !it.bought;
        it.boughtAt = it.bought ? todayISO() : null;
        n.updatedAt = new Date().toISOString();
        savePurchaseNotes(all);
        refreshShopping(); GS.app.updateBadges();
    }
    function pnMarkAll(noteId) {
        const all = getPurchaseNotes(); const n = all.find(x => x.id === noteId); if (!n) return;
        const allDone = (n.items || []).length > 0 && n.items.every(i => i.bought);
        n.items.forEach(i => { i.bought = !allDone; i.boughtAt = i.bought ? (i.boughtAt || todayISO()) : null; });
        n.updatedAt = new Date().toISOString();
        savePurchaseNotes(all);
        showToast(allDone ? 'Sab items pending kar diye' : 'Sab items bought mark ho gaye ✅', 'success');
        refreshShopping(); GS.app.updateBadges();
    }
    function deletePurchaseNote(id) {
        const n = getPurchaseNotes().find(x => x.id === id); if (!n) return;
        if (!confirm(`"${n.title}" delete karein?`)) return;
        savePurchaseNotes(getPurchaseNotes().filter(x => x.id !== id));
        __pnOpen.delete(id);
        showToast('Purchase note deleted', 'success');
        refreshShopping(); GS.app.updateBadges();
    }
    function copyPurchaseNote(id) {
        const n = getPurchaseNotes().find(x => x.id === id); if (!n) return;
        const st = pnStats(n);
        let text = `🧾 *${n.title}*\n`;
        if (n.dueDate) text += `📅 Due: ${formatDate(n.dueDate)}\n`;
        if (n.remark) text += `📝 ${n.remark}\n`;
        text += '\n';
        (n.items || []).forEach((it, i) => {
            const seller = it.sellerId ? getSellerById(it.sellerId) : null;
            text += `${it.bought ? '✅' : '⬜'} ${i + 1}. ${it.name}`;
            if (seller) text += ` [${seller.name}]`;
            text += ` — ${it.qty} ${it.unit || ''}`;
            const t = pnItemTotal(it); if (t) text += ` — ₹${t}`;
            text += '\n';
        });
        text += `\n💰 Total: ₹${st.total} | ✅ Bought: ₹${st.bought} | ⏳ Pending: ₹${st.pending}\n\n— GharSeva`;
        copyText(text, 'Purchase note copied!');
    }

    // ─── Note Modal ─────────────────────────────────
    function openPnModal(mode, id) {
        if (!getItems().length) { showToast('Pehle Item Master me item add karein', 'warning'); return; }
        __pnDraft = { items: [] };
        gid('pnEditId').value = '';
        gid('pnModalTitle').textContent = 'New Purchase Note';
        gid('pnTitle').value = '';
        gid('pnDue').value = todayISO();
        gid('pnRemark').value = '';
        pnResetAddRow();
        setupPnItemAc();

        if (mode === 'edit' && id) {
            const n = getPurchaseNotes().find(x => x.id === id); if (!n) return;
            gid('pnEditId').value = n.id;
            gid('pnModalTitle').textContent = 'Edit Purchase Note';
            gid('pnTitle').value = n.title || '';
            gid('pnDue').value = n.dueDate || '';
            gid('pnRemark').value = n.remark || '';
            __pnDraft.items = JSON.parse(JSON.stringify(n.items || []));
        }
        renderPnDraft();
        bootstrap.Modal.getOrCreateInstance(gid('pnModal')).show();
    }

    function pnResetAddRow() {
        gid('pnItem').value = '';
        gid('pnItemAc').value = '';
        gid('pnSeller').innerHTML = '<option value="">-- Item select karein --</option>';
        gid('pnQty').value = '1';
        gid('pnUnit').textContent = '—';
        gid('pnPrice').value = '';
        pnRecalcAdd();
        setupPnItemAc();
    }
    function pnOnItemChange() {
        const itemId = gid('pnItem').value;
        const sel = gid('pnSeller');
        const item = itemId ? getItemById(itemId) : null;
        if (!item) {
            sel.innerHTML = '<option value="">-- Item select karein --</option>';
            gid('pnUnit').textContent = '—';
            gid('pnPrice').value = '';
            pnRecalcAdd();
            return;
        }
        const o = sellerOptionsFor(item);
        sel.innerHTML = o.html;
        sel.value = o.sellerId || '';
        gid('pnUnit').textContent = item.unit || '—';
        gid('pnPrice').value = o.price || '';
        pnRecalcAdd();
    }
    function pnOnSellerChange() {
        const item = getItemById(gid('pnItem').value);
        const sellerId = gid('pnSeller').value;
        if (!item || !sellerId) return;
        const sp = getSellerPrice(item, sellerId);
        if (sp) gid('pnPrice').value = sp.price;
        pnRecalcAdd();
    }
    function pnRecalcAdd() {
        const qty = parseFloat(gid('pnQty').value) || 0;
        const price = parseFloat(gid('pnPrice').value) || 0;
        gid('pnAddTotal').textContent = formatCurrency(qty * price);
    }
    function pnAddItem() {
        const itemId = gid('pnItem').value;
        if (!itemId) { showToast('Pehle list se item select karein', 'warning'); return; }
        const item = getItemById(itemId); if (!item) { showToast('Item not found', 'error'); return; }
        const qty = parseFloat(gid('pnQty').value);
        if (isNaN(qty) || qty <= 0) { showToast('Valid quantity required', 'warning'); return; }
        const price = parseFloat(gid('pnPrice').value) || 0;
        const sellerId = gid('pnSeller').value || null;

        const existing = __pnDraft.items.find(x => x.itemId === itemId && (x.sellerId || null) === sellerId && !x.bought);
        if (existing) {
            existing.qty = Math.round((Number(existing.qty) + qty) * 1000) / 1000;
            if (price) existing.price = price;
            showToast('Item pehle se tha — quantity badha di', 'info');
        } else {
            __pnDraft.items.push({
                id: uid('pni'), itemId, sellerId, name: itemDisplayName(item),
                qty, unit: item.unit, price, bought: false, boughtAt: null, notes: ''
            });
        }
        renderPnDraft();
        pnResetAddRow();
        const ac = gid('pnItemAc'); if (ac) ac.focus();
    }

    function pnDraftRowHTML(it) {
        const seller = it.sellerId ? getSellerById(it.sellerId) : null;
        return `<div class="pn-row ${it.bought ? 'bought' : ''}" id="pnRow_${it.id}">
            <div class="d-flex align-items-start gap-2">
                <input type="checkbox" class="form-check-input pn-chk" ${it.bought ? 'checked' : ''} onchange="pnDraftToggle('${it.id}', this.checked)" title="Buy ho gaya">
                <div style="flex:1;min-width:0;">
                    <div class="pn-it-name"><span>${escapeHtml(it.name)}</span></div>
                    ${seller ? `<span class="seller-chip"><span class="seller-name">${escapeHtml(seller.name)}</span></span>` : ''}
                </div>
                <button type="button" class="btn btn-sm btn-outline-danger" onclick="pnDraftRemove('${it.id}')"><i class="fas fa-trash"></i></button>
            </div>
            <div class="pn-row-edit">
                <div class="input-group input-group-sm">
                    <input type="number" class="form-control" step="0.01" min="0.01" value="${it.qty}" oninput="pnDraftField('${it.id}','qty',this.value)">
                    <span class="input-group-text">${escapeHtml(it.unit || '')}</span>
                </div>
                <span class="pn-x">×</span>
                <div class="input-group input-group-sm">
                    <span class="input-group-text">₹</span>
                    <input type="number" class="form-control" step="0.01" min="0" value="${it.price}" oninput="pnDraftField('${it.id}','price',this.value)">
                </div>
                <strong class="pn-row-total" id="pnRowTotal_${it.id}">${formatCurrency(pnItemTotal(it))}</strong>
            </div>
        </div>`;
    }
    function renderPnDraft() {
        const box = gid('pnItemsList');
        const items = __pnDraft.items;
        gid('pnItemsCount').textContent = items.length;
        box.innerHTML = items.length
            ? items.map(pnDraftRowHTML).join('')
            : '<div class="text-center text-muted small py-3">Abhi koi item nahi — upar se item search karke add karein.</div>';
        updatePnDraftSummary();
    }
    function updatePnDraftSummary() {
        const st = pnStats({ items: __pnDraft.items });
        gid('pnDraftSummary').innerHTML = `
            <div><small>Total</small><b>${formatCurrency(st.total)}</b></div>
            <div class="g"><small>✅ Bought (${st.boughtCount})</small><b>${formatCurrency(st.bought)}</b></div>
            <div class="o"><small>⏳ Pending (${st.pendingCount})</small><b>${formatCurrency(st.pending)}</b></div>`;
    }
    function pnDraftField(rid, field, val) {
        const it = __pnDraft.items.find(x => x.id === rid); if (!it) return;
        it[field] = parseFloat(val) || 0;
        const t = gid('pnRowTotal_' + rid); if (t) t.textContent = formatCurrency(pnItemTotal(it));
        updatePnDraftSummary();
    }
    function pnDraftToggle(rid, checked) {
        const it = __pnDraft.items.find(x => x.id === rid); if (!it) return;
        it.bought = !!checked;
        it.boughtAt = it.bought ? (it.boughtAt || todayISO()) : null;
        const row = gid('pnRow_' + rid); if (row) row.classList.toggle('bought', it.bought);
        updatePnDraftSummary();
    }
    function pnDraftRemove(rid) {
        __pnDraft.items = __pnDraft.items.filter(x => x.id !== rid);
        renderPnDraft();
    }

    function pnAddLowStock() {
        const qtyByItem = {};
        getStock().forEach(s => { qtyByItem[s.itemId] = (qtyByItem[s.itemId] || 0) + (Number(s.quantity) || 0); });
        const have = new Set(__pnDraft.items.filter(x => !x.bought).map(x => x.itemId));
        let added = 0;
        Object.keys(qtyByItem).forEach(itemId => {
            const item = getItemById(itemId); if (!item || have.has(itemId)) return;
            const min = getMinAlert(item), cur = qtyByItem[itemId];
            if (cur > min) return;
            const shortfall = Math.max(1, min - cur + 1);
            const best = getBestSellerPrice(item);
            __pnDraft.items.push({
                id: uid('pni'), itemId, sellerId: best ? best.sellerId : null, name: itemDisplayName(item),
                qty: shortfall, unit: item.unit, price: best ? best.price : getSellingPrice(item),
                bought: false, boughtAt: null, notes: 'Low stock'
            });
            added++;
        });
        if (!added) { showToast('Koi naya low-stock item nahi mila', 'info'); return; }
        renderPnDraft();
        showToast(`${added} low-stock item(s) add hue`, 'success');
    }
    function pnAddFromDirectList() {
        const pending = getShopping().filter(s => !s.done && s.itemId);
        let added = 0;
        pending.forEach(s => {
            const item = getItemById(s.itemId); if (!item) return;
            const dup = __pnDraft.items.some(x => x.itemId === s.itemId && (x.sellerId || null) === (s.sellerId || null) && !x.bought);
            if (dup) return;
            __pnDraft.items.push({
                id: uid('pni'), itemId: s.itemId, sellerId: s.sellerId || null, name: itemDisplayName(item),
                qty: Number(s.qty) || 1, unit: item.unit, price: Number(s.price) || 0,
                bought: false, boughtAt: null, notes: s.notes || ''
            });
            added++;
        });
        if (!added) { showToast('Direct list me koi naya pending item nahi', 'info'); return; }
        renderPnDraft();
        showToast(`${added} item(s) direct list se aaye`, 'success');
    }

    function savePurchaseNote() {
        const title = gid('pnTitle').value.trim();
        if (!title) { showToast('Title required', 'warning'); return; }
        if (gid('pnItem').value) { showToast('Selected item ko pehle "Add" button se list me daalein', 'warning'); return; }
        if (!__pnDraft.items.length) { showToast('Kam se kam ek item add karein', 'warning'); return; }
        if (__pnDraft.items.some(x => !(Number(x.qty) > 0))) { showToast('Har item ki quantity 0 se zyada honi chahiye', 'warning'); return; }

        const editId = gid('pnEditId').value;
        const all = getPurchaseNotes();
        const prev = editId ? all.find(x => x.id === editId) : null;
        const now = new Date().toISOString();
        const note = {
            id: editId || uid('pn'),
            title,
            dueDate: gid('pnDue').value || null,
            remark: gid('pnRemark').value.trim(),
            items: __pnDraft.items.map(x => ({ ...x })),
            createdAt: prev ? (prev.createdAt || now) : now,
            updatedAt: now
        };
        if (prev) all[all.findIndex(x => x.id === editId)] = note; else all.push(note);
        if (!savePurchaseNotes(all)) return;
        bootstrap.Modal.getInstance(gid('pnModal')).hide();
        showToast(editId ? 'Purchase note updated!' : 'Purchase note saved!', 'success');
        if (__shopTab !== 'notes') switchShopTab('notes');
        refreshShopping(); GS.app.updateBadges();
    }

    Object.assign(GS, {
        shopping: {
            refreshShopping, refreshDirectShopping, refreshPurchaseNotes,
            switchShopTab, updateShopTabCounts,
            setupShoppingItemAc, setupPnItemAc,
            openShoppingModal, onShoppingItemChange, onShoppingSellerChange, recalcShoppingTotal,
            saveShoppingItem, toggleShoppingDone, deleteShoppingItem,
            autoGenerateShoppingList, copyShoppingList,
            openPnModal, pnOnItemChange, pnOnSellerChange, pnRecalcAdd, pnAddItem,
            pnDraftField, pnDraftToggle, pnDraftRemove,
            pnAddLowStock, pnAddFromDirectList, savePurchaseNote,
            togglePnItems, togglePnItem, pnMarkAll, deletePurchaseNote, copyPurchaseNote,
            pnStats
        }
    });

    // Inline HTML ke liye
    window.switchShopTab = switchShopTab;
    window.openShoppingModal = openShoppingModal;
    window.onShoppingItemChange = onShoppingItemChange;
    window.onShoppingSellerChange = onShoppingSellerChange;
    window.recalcShoppingTotal = recalcShoppingTotal;
    window.saveShoppingItem = saveShoppingItem;
    window.toggleShoppingDone = toggleShoppingDone;
    window.deleteShoppingItem = deleteShoppingItem;
    window.autoGenerateShoppingList = autoGenerateShoppingList;
    window.copyShoppingList = copyShoppingList;
    window.openPnModal = openPnModal;
    window.pnOnItemChange = pnOnItemChange;
    window.pnOnSellerChange = pnOnSellerChange;
    window.pnRecalcAdd = pnRecalcAdd;
    window.pnAddItem = pnAddItem;
    window.pnDraftField = pnDraftField;
    window.pnDraftToggle = pnDraftToggle;
    window.pnDraftRemove = pnDraftRemove;
    window.pnAddLowStock = pnAddLowStock;
    window.pnAddFromDirectList = pnAddFromDirectList;
    window.savePurchaseNote = savePurchaseNote;
    window.togglePnItems = togglePnItems;
    window.togglePnItem = togglePnItem;
    window.pnMarkAll = pnMarkAll;
    window.deletePurchaseNote = deletePurchaseNote;
    window.copyPurchaseNote = copyPurchaseNote;
})();