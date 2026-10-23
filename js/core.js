/* ============================================================
   GharSeva — core.js
   Helpers, storage, data accessors. Sabse pehle load hota hai.
   ============================================================ */
(function () {
    'use strict';

    const PREFIX = 'gharseva_';
    let __itemsCache = null;

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
    function todayISO() {
        const d = new Date();
        return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    }
    function safeImg(src) { return (typeof src === 'string' && /^data:image\//.test(src)) ? src.replace(/"/g, '') : ''; }
    function thumbHtml(item, size) {
        const sz = size || 'md';
        const src = item ? safeImg(item.image) : '';
        // const altText = item?.name || item?.title || 'thumbnail';
        const altText = escapeHtml(item?.itemName || item?.name || item?.title || 'thumbnail').replace(/"/g, '&quot;');
        return `<img class="item-thumb ${sz}" 
                     src="${src}" 
                     alt="${altText}" 
                     loading="lazy"
                     onerror="this.onerror=null;this.src='./assets/images/no_image_found.png'">`;
    }
    function applyBuyRate(items, itemId, rate, dateStr) {
        const it = items.find(x => x.id === itemId); if (!it) return false;
        const d = dateStr || todayISO();
        if (it.lastBuyDate && d < it.lastBuyDate) return false;
        it.price = rate; it.lastBuyDate = d; it.updatedAt = new Date().toISOString();
        return true;
    }
    function resizeImageFile(file, size, quality) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onerror = reject;
            reader.onload = () => {
                const img = new Image();
                img.onerror = reject;
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    canvas.width = size; canvas.height = size;
                    const c = canvas.getContext('2d');
                    c.fillStyle = '#ffffff'; c.fillRect(0, 0, size, size);
                    c.imageSmoothingQuality = 'high';
                    const scale = Math.min(size / img.width, size / img.height);
                    const w = Math.round(img.width * scale), h = Math.round(img.height * scale);
                    c.drawImage(img, Math.round((size - w) / 2), Math.round((size - h) / 2), w, h);
                    let q = quality, out = canvas.toDataURL('image/jpeg', q);
                    while (out.length > 28000 && q > 0.4) { q = Math.round((q - 0.1) * 10) / 10; out = canvas.toDataURL('image/jpeg', q); }
                    resolve(out);
                };
                img.src = reader.result;
            };
            reader.readAsDataURL(file);
        });
    }

    // ─── Data Accessors ──────────────────────────────
    function getStorages() { return load('storages', []); }
    function getCategories() { return load('categories', []); }
    function getBrands() { return load('brands', []); }
    function getSellers() { return load('sellers', []); }
    function getItems() { return load('items', []); }
    function getStock() { return load('stock', []); }
    function getShopping() { return load('shopping', []); }
    function getPurchaseNotes() { return load('purchaseNotes', []); }
    function saveStorages(v) { return save('storages', v); }
    function saveCategories(v) { return save('categories', v); }
    function saveBrands(v) { return save('brands', v); }
    function saveSellers(v) { return save('sellers', v); }
    function saveItems(v) { __itemsCache = null; return save('items', v); }
    function saveStock(v) { return save('stock', v); }
    function saveShopping(v) { return save('shopping', v); }
    function savePurchaseNotes(v) { return save('purchaseNotes', v); }
    function invalidateItemsCache() { __itemsCache = null; }

    function getAllData() {
        return {
            storages: getStorages(), categories: getCategories(), brands: getBrands(),
            sellers: getSellers(), items: getItems(), stock: getStock(), shopping: getShopping(),
            purchaseNotes: getPurchaseNotes(),
            exportDate: new Date().toISOString(), version: '1.7'
        };
    }
    function restoreData(d) {
        if (d.storages) saveStorages(d.storages);
        if (d.categories) saveCategories(d.categories);
        if (d.brands) saveBrands(d.brands);
        if (d.sellers) saveSellers(d.sellers);
        if (d.items) saveItems(d.items);
        if (d.stock) saveStock(d.stock);
        if (d.shopping) saveShopping(d.shopping);
        if (d.purchaseNotes) savePurchaseNotes(d.purchaseNotes);
    }
    function getStorageById(id) { return getStorages().find(s => s.id === id); }
    function getCategoryById(id) { return getCategories().find(c => c.id === id); }
    function getBrandById(id) { return getBrands().find(b => b.id === id); }
    function getSellerById(id) { return getSellers().find(s => s.id === id); }
    function getItemById(id) {
        if (!__itemsCache) { __itemsCache = new Map(); getItems().forEach(i => __itemsCache.set(i.id, i)); }
        return __itemsCache.get(id);
    }

    function getMinAlert(item) { return item ? (Number(item.minAlert) || 0) : 1; }
    function getSellingPrice(item) {
        if (!item) return 0;
        const best = getBestSellerPrice(item);
        if (best) return best.price;
        if (item.price !== undefined && item.price !== null && item.price !== '') return Number(item.price) || 0;
        return Number(item.mrp) || 0;
    }
    function getBestSellerPrice(item) {
        if (!item || !item.sellers || !item.sellers.length) return null;
        let best = null;
        item.sellers.forEach(s => {
            const p = Number(s.price) || 0;
            if (p > 0 && (!best || p < best.price)) best = { sellerId: s.sellerId, price: p };
        });
        return best;
    }
    function getDiscountPct(mrp, price) {
        const m = Number(mrp) || 0;
        const p = Number(price) || 0;
        if (m > 0 && p > 0 && m > p) return Math.round(((m - p) / m) * 100);
        return 0;
    }
    function getSellerPrice(item, sellerId) {
        if (!item || !item.sellers) return null;
        return item.sellers.find(s => s.sellerId === sellerId);
    }

    // ─── GS namespace ────────────────────────────────
    window.GS = window.GS || {};
    Object.assign(GS, {
        PREFIX,
        showToast, save, load, escapeHtml, uid, formatDate, formatCurrency,
        initials, isMobile, todayISO, safeImg, thumbHtml, applyBuyRate, resizeImageFile,
        getStorages, getCategories, getBrands, getSellers, getItems, getStock,
        getShopping, getPurchaseNotes,
        saveStorages, saveCategories, saveBrands, saveSellers, saveItems, saveStock,
        saveShopping, savePurchaseNotes,
        invalidateItemsCache,
        getAllData, restoreData,
        getStorageById, getCategoryById, getBrandById, getSellerById, getItemById,
        getMinAlert, getSellingPrice, getBestSellerPrice, getDiscountPct, getSellerPrice
    });

    // Inline HTML ke liye helpers jo core me hi use hote hain
    window.showToast = showToast;
})();