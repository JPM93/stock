/* ============================================================
   GharSeva — csv-io.js
   CSV import / export / remove-all. Saare modules.
   ============================================================ */
(function () {
    'use strict';
    const {
        showToast, escapeHtml, uid, formatCurrency, formatDate, todayISO,
        applyBuyRate,
        getStorages, getCategories, getBrands, getSellers, getItems, getStock,
        getShopping, getPurchaseNotes,
        saveStorages, saveCategories, saveBrands, saveSellers, saveItems, saveStock,
        saveShopping, savePurchaseNotes,
        getBrandById, getCategoryById, getStorageById, getItemById, getSellerById
    } = GS;

    let __ioModule = null;
    let __ioParsed = null;
    const ITEM_UNITS = ['gm', 'kg', 'ml', 'l', 'u', 'pcs', 'pack', 'dozen', 'box'];
    const STORAGE_TYPES = ['rack', 'box', 'refrigerator', 'cabinet', 'room', 'other'];

    function parseCSV(text) {
        const rows = [];
        let cur = '', row = [], inQuotes = false;
        text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
        const firstLine = text.split('\n')[0] || '';
        const nComma = firstLine.split(',').length, nSemi = firstLine.split(';').length, nTab = firstLine.split('\t').length;
        const delim = (nSemi > nComma && nSemi >= nTab) ? ';' : (nTab > nComma ? '\t' : ',');
        for (let i = 0; i < text.length; i++) {
            const ch = text[i];
            if (inQuotes) {
                if (ch === '"') {
                    if (text[i + 1] === '"') { cur += '"'; i++; }
                    else inQuotes = false;
                } else cur += ch;
            } else {
                if (ch === '"') inQuotes = true;
                else if (ch === delim) { row.push(cur); cur = ''; }
                else if (ch === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; }
                else cur += ch;
            }
        }
        if (cur.length || row.length) { row.push(cur); rows.push(row); }
        return rows.filter(r => r.some(c => String(c).trim() !== ''));
    }
    function csvEsc(v) {
        const s = v === null || v === undefined ? '' : String(v);
        if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
        return s;
    }
    function csvToObjects(text, required) {
        const rows = parseCSV(String(text || '').replace(/^\uFEFF/, ''));
        if (rows.length < 2) return { error: 'CSV khaali hai ya data rows nahi hain' };
        const header = rows[0].map(h => String(h).trim().toLowerCase());
        const missing = required.filter(r => !header.includes(r));
        if (missing.length) return { error: 'Missing columns: ' + missing.join(', ') };
        const objs = rows.slice(1).map((r, i) => {
            const o = { _row: i + 2 };
            header.forEach((h, c) => { o[h] = r[c] === undefined ? '' : String(r[c]).trim(); });
            return o;
        });
        return { objs };
    }
    function downloadText(filename, text) {
        const blob = new Blob(['\uFEFF' + text], { type: 'text/csv;charset=utf-8;' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = filename;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    }
    function normalizeDate(s) {
        s = String(s || '').trim();
        if (!s) return '';
        let y, mo, d, m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
        if (m) { y = +m[1]; mo = +m[2]; d = +m[3]; }
        else {
            m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
            if (!m) return null;
            d = +m[1]; mo = +m[2]; y = +m[3];
        }
        const dt = new Date(y, mo - 1, d);
        if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) return null;
        return y + '-' + String(mo).padStart(2, '0') + '-' + String(d).padStart(2, '0');
    }
    function findItemByKey(ctx, brandName, itemName, sizeStr, unit) {
        if (!brandName || !itemName) return { error: 'brand/itemName missing' };
        const size = parseFloat(sizeStr);
        if (!size || size <= 0) return { error: 'invalid size' };
        if (!unit) return { error: 'unit missing' };
        const brand = ctx.brands.find(b => b.name.toLowerCase() === brandName.toLowerCase());
        if (!brand) return { error: `Brand "${brandName}" not found` };
        const item = ctx.items.find(i => i.brandId === brand.id &&
            (i.itemName || '').toLowerCase() === itemName.toLowerCase() &&
            Number(i.size) === size && (i.unit || '').toLowerCase() === unit.toLowerCase());
        if (!item) return { error: `Item "${brandName} ${itemName} ${size}${unit}" Item Master me nahi mila` };
        return { item, brand };
    }

    function makeNameConfig(o) {
        return {
            title: o.title, file: o.file,
            headers: ['name', 'description'], required: ['name'],
            previewHead: ['Name', 'Description'],
            sample: o.sample, notes: o.notes,
            getAll: o.get,
            toRow: x => [x.name, x.description || ''],
            makeCtx: () => ({ names: new Set(o.get().map(x => (x.name || '').toLowerCase())) }),
            parse(row, ctx) {
                if (!row.name) return { error: 'name missing' };
                const k = row.name.toLowerCase();
                if (ctx.names.has(k)) return { dup: `"${row.name}" already exists` };
                ctx.names.add(k);
                const description = row.description || '';
                return { data: { name: row.name, description }, view: [row.name, description || '—'] };
            },
            commit(list) {
                const all = o.get(), now = new Date().toISOString();
                list.forEach(p => all.push({ id: uid(o.prefix), ...p.data, createdAt: now }));
                return o.put(all);
            },
            blocker: o.blocker
        };
    }

    const IO_CONFIG = {
        brands: makeNameConfig({
            title: 'Brands', file: 'brands', prefix: 'brd', get: getBrands, put: saveBrands,
            sample: [['Tata', 'Preferred for staples'], ['Amul', 'Dairy regular']],
            notes: ['<strong>name</strong> required hai', 'Duplicate brand names skip honge'],
            blocker: () => getItems().length ? `Pehle Item Master clear karein — ${getItems().length} item(s) brands use karte hain` : ''
        }),
        categories: makeNameConfig({
            title: 'Categories', file: 'categories', prefix: 'cat', get: getCategories, put: saveCategories,
            sample: [['Kathod', 'Pulses & Lentils'], ['Masala', 'Spices & condiments']],
            notes: ['<strong>name</strong> required hai', 'Duplicate category names skip honge'],
            blocker: () => getItems().length ? `Pehle Item Master clear karein — ${getItems().length} item(s) categories use karte hain` : ''
        }),
        sellers: makeNameConfig({
            title: 'Sellers', file: 'sellers', prefix: 'slr', get: getSellers, put: saveSellers,
            sample: [['Zepto', '10-min delivery'], ['Blinkit', 'Fast delivery']],
            notes: ['<strong>name</strong> required hai', 'Duplicate seller names skip honge', 'Seller-wise item prices Item Master me set hote hain'],
            blocker: () => {
                const n = getItems().filter(i => (i.sellers || []).length).length;
                return n ? `Pehle Item Master ke seller prices hatayein — ${n} item(s) sellers use karte hain` : '';
            }
        }),

        storages: {
            title: 'Storages', file: 'storages',
            headers: ['name', 'type', 'description'], required: ['name'],
            previewHead: ['Name', 'Type', 'Description'],
            sample: [['Refrigerator', 'refrigerator', 'Kitchen main fridge'], ['Rack A', 'rack', 'Ground floor']],
            notes: ['<strong>name</strong> required hai', 'type: ' + STORAGE_TYPES.join(' / ') + ' (galat/khaali ho to "other")', 'Duplicate storage names skip honge'],
            getAll: getStorages,
            toRow: s => [s.name, s.type || 'other', s.description || ''],
            makeCtx: () => ({ names: new Set(getStorages().map(x => (x.name || '').toLowerCase())) }),
            parse(row, ctx) {
                if (!row.name) return { error: 'name missing' };
                const k = row.name.toLowerCase();
                if (ctx.names.has(k)) return { dup: `"${row.name}" already exists` };
                ctx.names.add(k);
                const t = (row.type || '').toLowerCase();
                const type = STORAGE_TYPES.includes(t) ? t : 'other';
                const description = row.description || '';
                return { data: { name: row.name, type, description }, view: [row.name, type, description || '—'] };
            },
            commit(list) {
                const all = getStorages(), now = new Date().toISOString();
                list.forEach(p => all.push({ id: uid('stg'), ...p.data, createdAt: now }));
                return saveStorages(all);
            },
            blocker: () => getStock().length ? `Pehle Stock clear karein — ${getStock().length} stock entr(ies) storages use karti hain` : ''
        },

        items: {
            title: 'Items', file: 'items',
            headers: ['brand', 'itemName', 'category', 'size', 'unit', 'mrp', 'price', 'minAlert', 'notes'],
            required: ['brand', 'itemname', 'category', 'size', 'unit', 'mrp', 'price'],
            previewHead: ['Brand', 'Item', 'Category', 'Size', 'MRP', 'Price'],
            sample: [
                ['Tata', 'Toor Dal', 'Kathod', '1', 'kg', '220', '180', '2', ''],
                ['MDH', 'Turmeric Powder', 'Masala', '100', 'gm', '50', '45', '1', ''],
                ['Amul', 'Milk', 'Dairy', '1', 'l', '66', '60', '3', '']
            ],
            notes: [
                '<strong>brand</strong> &amp; <strong>category</strong> ka naam Brand/Category Master se match hoga — match na hone par row skip',
                'unit: ' + ITEM_UNITS.join(', '),
                'Duplicate items skip honge (same brand + item + size + unit)',
                'Photo CSV me nahi jati — photo/seller prices JSON backup (Settings) me save rehte hain'
            ],
            getAll: getItems,
            toRow: i => {
                const b = getBrandById(i.brandId), c = getCategoryById(i.categoryId);
                return [b ? b.name : '', i.itemName || '', c ? c.name : '', i.size, i.unit, i.mrp, i.price, i.minAlert, i.notes || ''];
            },
            makeCtx: () => ({
                brands: getBrands(), cats: getCategories(),
                seen: new Set(getItems().map(i => [i.brandId, (i.itemName || '').toLowerCase(), Number(i.size), (i.unit || '').toLowerCase()].join('|')))
            }),
            parse(row, ctx) {
                const brandName = row.brand, itemName = row.itemname, catName = row.category;
                const size = parseFloat(row.size), unit = (row.unit || '').toLowerCase();
                const mrp = parseFloat(row.mrp), price = parseFloat(row.price);
                const minAlert = (row.minalert !== undefined && row.minalert !== '') ? parseFloat(row.minalert) : 0;
                if (!brandName || !itemName || !catName) return { error: 'brand/itemName/category missing' };
                const brand = ctx.brands.find(b => b.name.toLowerCase() === brandName.toLowerCase());
                if (!brand) return { error: `Brand "${brandName}" not found` };
                const cat = ctx.cats.find(c => c.name.toLowerCase() === catName.toLowerCase());
                if (!cat) return { error: `Category "${catName}" not found` };
                if (!size || size <= 0) return { error: 'invalid size' };
                if (isNaN(mrp) || mrp < 0) return { error: 'invalid mrp' };
                if (isNaN(price) || price < 0) return { error: 'invalid price' };
                if (!unit) return { error: 'unit missing' };
                if (!ITEM_UNITS.includes(unit)) return { error: `invalid unit "${unit}" (allowed: ${ITEM_UNITS.join(', ')})` };
                const key = [brand.id, itemName.toLowerCase(), size, unit].join('|');
                if (ctx.seen.has(key)) return { dup: `${brandName} ${itemName} (${size}${unit}) already exists` };
                ctx.seen.add(key);
                return {
                    data: { brandId: brand.id, categoryId: cat.id, itemName, size, unit, mrp, price, minAlert: isNaN(minAlert) ? 0 : minAlert, notes: row.notes || '' },
                    view: [brand.name, itemName, cat.name, size + unit, formatCurrency(mrp), formatCurrency(price)]
                };
            },
            commit(list) {
                const all = getItems(), now = new Date().toISOString();
                list.forEach(p => all.push({ id: uid('itm'), ...p.data, sellers: [], image: '', createdAt: now, updatedAt: now }));
                return saveItems(all);
            },
            blocker: () => getStock().length ? `Pehle Stock clear karein — ${getStock().length} stock entr(ies) items use karti hain` : ''
        },

        stock: {
            title: 'Stock', file: 'stock',
            headers: ['brand', 'itemName', 'size', 'unit', 'storage', 'quantity', 'batchNumber', 'rate', 'purchaseDate', 'expiryDate', 'notes', 'brokenPack'],
            required: ['brand', 'itemname', 'size', 'unit', 'storage', 'quantity'],
            previewHead: ['Item', 'Storage', 'Qty', 'Batch', 'Expiry'],
            sample: [
                ['Tata', 'Toor Dal', '1', 'kg', 'Storage Box', '3', 'TD-2024-A1', '180', todayISO(), '', '', 'yes'],
                ['Amul', 'Milk', '1', 'l', 'Refrigerator', '2', 'MLK-2401', '60', todayISO(), '', '', 'no']
            ],
            notes: [
                'item (brand + itemName + size + unit) aur <strong>storage</strong> pehle se Master me hone chahiye',
                '<strong>batchNumber</strong> optional',
                '<strong>rate</strong> (optional): import hone par Item Master ka Base Price latest purchaseDate wale rate se update hota hai',
                'Dates: YYYY-MM-DD ya DD/MM/YYYY',
                '<strong>brokenPack</strong> (optional): yes / no',
                'Bilkul same entry (item + storage + qty + dates) skip hogi'
            ],
            getAll: getStock,
            toRow: s => {
                const item = getItemById(s.itemId); if (!item) return null;
                const b = getBrandById(item.brandId), st = getStorageById(s.storageId);
                return [b ? b.name : '', item.itemName, item.size, item.unit, st ? st.name : '', s.quantity, s.batchNumber || '', (s.rate === null || s.rate === undefined) ? '' : s.rate, s.purchaseDate || '', s.expiryDate || '', s.notes || '', s.brokenPack ? 'yes' : 'no'];
            },
            makeCtx: () => ({
                brands: getBrands(), items: getItems(), storages: getStorages(),
                seen: new Set(getStock().map(s => [s.itemId, s.storageId, Number(s.quantity), s.purchaseDate || '', s.expiryDate || ''].join('|')))
            }),
            parse(row, ctx) {
                const f = findItemByKey(ctx, row.brand, row.itemname, row.size, (row.unit || '').trim());
                if (f.error) return { error: f.error };
                const st = ctx.storages.find(s => s.name.toLowerCase() === (row.storage || '').toLowerCase());
                if (!st) return { error: `Storage "${row.storage}" not found` };
                const qty = parseFloat(row.quantity);
                if (isNaN(qty) || qty < 0) return { error: 'invalid quantity' };
                const rate = (row.rate === undefined || row.rate === '') ? null : parseFloat(row.rate);
                if (rate !== null && (isNaN(rate) || rate < 0)) return { error: 'invalid rate' };
                const pd = normalizeDate(row.purchasedate), ed = normalizeDate(row.expirydate);
                if (pd === null) return { error: 'invalid purchaseDate (YYYY-MM-DD ya DD/MM/YYYY)' };
                if (ed === null) return { error: 'invalid expiryDate (YYYY-MM-DD ya DD/MM/YYYY)' };
                const key = [f.item.id, st.id, qty, pd || '', ed || ''].join('|');
                if (ctx.seen.has(key)) return { dup: `${f.brand.name} ${f.item.itemName} @ ${st.name} already exists` };
                ctx.seen.add(key);
                return {
                    data: { itemId: f.item.id, storageId: st.id, quantity: qty, rate, batchNumber: row.batchnumber || '', purchaseDate: pd || null, expiryDate: ed || null, notes: row.notes || '', brokenPack: /^(yes|y|true|1)$/i.test(row.brokenpack || '') },
                    view: [`${f.brand.name} ${f.item.itemName} ${f.item.size}${f.item.unit}`, st.name, qty, row.batchnumber || '—', ed ? formatDate(ed) : '—']
                };
            },
            commit(list) {
                const all = getStock(), items = getItems(), now = new Date().toISOString();
                let itemsChanged = false;
                [...list].sort((a, b) => (a.data.purchaseDate || '').localeCompare(b.data.purchaseDate || '')).forEach(p => {
                    all.push({ id: uid('stk'), ...p.data, createdAt: now, updatedAt: now });
                    if (p.data.rate > 0 && applyBuyRate(items, p.data.itemId, p.data.rate, p.data.purchaseDate)) itemsChanged = true;
                });
                if (!saveStock(all)) return false;
                if (itemsChanged) saveItems(items);
                return true;
            }
        },

        shopping: {
            title: 'Shopping List', file: 'shopping',
            headers: ['brand', 'itemName', 'size', 'unit', 'seller', 'qty', 'price', 'done', 'notes'],
            required: ['brand', 'itemname', 'size', 'unit', 'qty'],
            previewHead: ['Item', 'Seller', 'Qty', 'Price', 'Done'],
            sample: [
                ['Tata', 'Toor Dal', '1', 'kg', 'Blinkit', '2', '175', 'no', ''],
                ['Amul', 'Milk', '1', 'l', '', '3', '', 'no', '']
            ],
            notes: [
                'item (brand + itemName + size + unit) Item Master me hona chahiye',
                '<strong>seller</strong> optional — likha ho to Seller Master se match hoga',
                '<strong>price</strong> khaali ho to seller/base price auto-fill hoga',
                'done: yes / no'
            ],
            getAll: getShopping,
            toRow: s => {
                const item = s.itemId ? getItemById(s.itemId) : null; if (!item) return null;
                const b = getBrandById(item.brandId), sl = s.sellerId ? getSellerById(s.sellerId) : null;
                return [b ? b.name : '', item.itemName, item.size, item.unit, sl ? sl.name : '', s.qty, s.price || '', s.done ? 'yes' : 'no', s.notes || ''];
            },
            makeCtx: () => ({
                brands: getBrands(), items: getItems(), sellers: getSellers(),
                seen: new Set(getShopping().map(s => [s.itemId, s.sellerId || '', Number(s.qty), Number(s.price) || 0, s.done ? 1 : 0].join('|')))
            }),
            parse(row, ctx) {
                const f = findItemByKey(ctx, row.brand, row.itemname, row.size, (row.unit || '').trim());
                if (f.error) return { error: f.error };
                const qty = parseFloat(row.qty);
                if (isNaN(qty) || qty <= 0) return { error: 'invalid qty' };
                let seller = null;
                if (row.seller) {
                    seller = ctx.sellers.find(s => s.name.toLowerCase() === row.seller.toLowerCase());
                    if (!seller) return { error: `Seller "${row.seller}" not found` };
                }
                let price;
                if (row.price !== undefined && row.price !== '') {
                    price = parseFloat(row.price);
                    if (isNaN(price) || price < 0) return { error: 'invalid price' };
                } else {
                    const sp = seller ? (f.item.sellers || []).find(x => x.sellerId === seller.id) : null;
                    price = sp ? Number(sp.price) : (Number(f.item.price) || Number(f.item.mrp) || 0);
                }
                const done = /^(yes|y|true|1|done)$/i.test(row.done || '');
                const key = [f.item.id, seller ? seller.id : '', qty, price, done ? 1 : 0].join('|');
                if (ctx.seen.has(key)) return { dup: `${f.brand.name} ${f.item.itemName} already in list` };
                ctx.seen.add(key);
                return {
                    data: { itemId: f.item.id, sellerId: seller ? seller.id : null, name: f.brand.name + ' ' + f.item.itemName, qty, unit: f.item.unit, price, totalPrice: qty * price, notes: row.notes || '', done },
                    view: [`${f.brand.name} ${f.item.itemName} ${f.item.size}${f.item.unit}`, seller ? seller.name : '—', qty, formatCurrency(price), done ? 'yes' : 'no']
                };
            },
            commit(list) {
                const all = getShopping(), now = new Date().toISOString();
                list.forEach(p => all.push({ id: uid('shp'), ...p.data, createdAt: now }));
                return saveShopping(all);
            }
        },

        purchaseNotes: {
            title: 'Purchase Notes', file: 'purchase_notes',
            headers: ['title', 'dueDate', 'remark', 'brand', 'itemName', 'size', 'unit', 'seller', 'qty', 'price', 'bought', 'itemNotes'],
            required: ['title', 'brand', 'itemname', 'size', 'unit', 'qty'],
            previewHead: ['Note', 'Item', 'Seller', 'Qty', 'Price', 'Bought'],
            sample: [
                ['Mahine ka ration', todayISO(), 'Pehle hafte tak', 'Tata', 'Toor Dal', '1', 'kg', 'Blinkit', '2', '175', 'yes', ''],
                ['Mahine ka ration', todayISO(), 'Pehle hafte tak', 'Amul', 'Milk', '1', 'l', '', '3', '', 'no', '']
            ],
            notes: [
                'Ek note ki saari rows me same <strong>title</strong> (aur dueDate) likho — wo ek hi Purchase Note me group ho jayengi',
                'item (brand + itemName + size + unit) Item Master me hona chahiye',
                '<strong>dueDate</strong> optional: YYYY-MM-DD ya DD/MM/YYYY; <strong>remark</strong> optional',
                '<strong>seller</strong> optional; <strong>price</strong> khaali ho to seller/base price auto-fill hoga',
                '<strong>bought</strong>: yes / no',
                'Same title + dueDate ka note pehle se ho to items usi me judenge; bilkul same row skip hogi'
            ],
            getAll: () => {
                const rows = [];
                getPurchaseNotes().forEach(n => (n.items || []).forEach(it => rows.push({ n, it })));
                return rows;
            },
            count: () => getPurchaseNotes().length,
            toRow: ({ n, it }) => {
                const item = it.itemId ? getItemById(it.itemId) : null; if (!item) return null;
                const b = getBrandById(item.brandId), sl = it.sellerId ? getSellerById(it.sellerId) : null;
                return [n.title, n.dueDate || '', n.remark || '', b ? b.name : '', item.itemName, item.size, item.unit, sl ? sl.name : '', it.qty, it.price || '', it.bought ? 'yes' : 'no', it.notes || ''];
            },
            makeCtx: () => {
                const seen = new Set();
                getPurchaseNotes().forEach(n => (n.items || []).forEach(it =>
                    seen.add([(n.title || '').toLowerCase(), n.dueDate || '', it.itemId, it.sellerId || '', Number(it.qty), Number(it.price) || 0].join('|'))));
                return { brands: getBrands(), items: getItems(), sellers: getSellers(), seen };
            },
            parse(row, ctx) {
                if (!row.title) return { error: 'title missing' };
                const f = findItemByKey(ctx, row.brand, row.itemname, row.size, (row.unit || '').trim());
                if (f.error) return { error: f.error };
                const qty = parseFloat(row.qty);
                if (isNaN(qty) || qty <= 0) return { error: 'invalid qty' };
                const due = normalizeDate(row.duedate);
                if (due === null) return { error: 'invalid dueDate (YYYY-MM-DD ya DD/MM/YYYY)' };
                let seller = null;
                if (row.seller) {
                    seller = ctx.sellers.find(s => s.name.toLowerCase() === row.seller.toLowerCase());
                    if (!seller) return { error: `Seller "${row.seller}" not found` };
                }
                let price;
                if (row.price !== undefined && row.price !== '') {
                    price = parseFloat(row.price);
                    if (isNaN(price) || price < 0) return { error: 'invalid price' };
                } else {
                    const sp = seller ? (f.item.sellers || []).find(x => x.sellerId === seller.id) : null;
                    price = sp ? Number(sp.price) : (Number(f.item.price) || Number(f.item.mrp) || 0);
                }
                const bought = /^(yes|y|true|1|done)$/i.test(row.bought || '');
                const key = [row.title.toLowerCase(), due || '', f.item.id, seller ? seller.id : '', qty, price].join('|');
                if (ctx.seen.has(key)) return { dup: `${row.title}: ${f.brand.name} ${f.item.itemName} already in note` };
                ctx.seen.add(key);
                return {
                    data: {
                        title: row.title, dueDate: due || null, remark: row.remark || '',
                        item: { itemId: f.item.id, sellerId: seller ? seller.id : null, name: f.brand.name + ' ' + f.item.itemName, qty, unit: f.item.unit, price, bought, boughtAt: bought ? todayISO() : null, notes: row.itemnotes || '' }
                    },
                    view: [row.title, `${f.brand.name} ${f.item.itemName} ${f.item.size}${f.item.unit}`, seller ? seller.name : '—', qty, formatCurrency(price), bought ? 'yes' : 'no']
                };
            },
            commit(list) {
                const all = getPurchaseNotes(), now = new Date().toISOString();
                list.forEach(p => {
                    const d = p.data;
                    let note = all.find(n => (n.title || '').toLowerCase() === d.title.toLowerCase() && (n.dueDate || '') === (d.dueDate || ''));
                    if (!note) {
                        note = { id: uid('pn'), title: d.title, dueDate: d.dueDate, remark: d.remark || '', items: [], createdAt: now, updatedAt: now };
                        all.push(note);
                    } else if (!note.remark && d.remark) note.remark = d.remark;
                    note.items.push({ id: uid('pni'), ...d.item });
                    note.updatedAt = now;
                });
                return savePurchaseNotes(all);
            }
        }
    };

    function ioRefreshAll() {
        GS.app.refreshCurrentPage();
        GS.app.refreshDropdowns();
        GS.app.refreshDashboard();
        GS.app.updateBadges();
    }

    function buildIoMenus() {
        document.querySelectorAll('.io-menu[data-module]').forEach(el => {
            const k = el.getAttribute('data-module');
            el.classList.add('dropdown');
            el.innerHTML = `<button class="btn btn-outline-custom btn-sm dropdown-toggle" type="button" data-bs-toggle="dropdown" aria-expanded="false"><i class="fas fa-file-csv me-1"></i>CSV</button>
                <ul class="dropdown-menu shadow-sm">
                    <li><button class="dropdown-item" type="button" onclick="openImportModal('${k}')"><i class="fas fa-file-import me-2 text-primary"></i>Import CSV</button></li>
                    <li><button class="dropdown-item" type="button" onclick="exportModuleCsv('${k}')"><i class="fas fa-file-export me-2 text-success"></i>Export CSV</button></li>
                    <li><hr class="dropdown-divider"></li>
                    <li><button class="dropdown-item text-danger" type="button" onclick="removeAllModule('${k}')"><i class="fas fa-trash me-2"></i>Remove All</button></li>
                </ul>`;
        });
    }

    function exportModuleCsv(key) {
        const cfg = IO_CONFIG[key]; if (!cfg) return;
        const data = cfg.getAll();
        if (!data.length) { showToast(`${cfg.title}: export karne ke liye kuch nahi hai`, 'warning'); return; }
        const lines = [cfg.headers.join(',')];
        data.forEach(x => { const row = cfg.toRow(x); if (row) lines.push(row.map(csvEsc).join(',')); });
        downloadText(`gharseva_${cfg.file}_${todayISO()}.csv`, lines.join('\n'));
        showToast(`${cfg.title} exported!`, 'success');
    }

    function removeAllModule(key) {
        const cfg = IO_CONFIG[key]; if (!cfg) return;
        const n = cfg.count ? cfg.count() : cfg.getAll().length;
        if (!n) { showToast(`${cfg.title}: delete karne ke liye kuch nahi hai`, 'info'); return; }
        const block = cfg.blocker ? cfg.blocker() : '';
        if (block) { showToast(block, 'error'); return; }
        if (!confirm(`⚠️ ${n} ${cfg.title} entr(ies) delete hongi. Ye undo nahi hoga.\n\nPehle Export CSV kar lena behtar hai. Continue?`)) return;
        if (!confirm(`Pakka? Saari ${cfg.title} permanently delete ho jayengi.`)) return;
        const map = { brands: saveBrands, categories: saveCategories, sellers: saveSellers, storages: saveStorages, items: saveItems, stock: saveStock, shopping: saveShopping, purchaseNotes: savePurchaseNotes };
        map[key]([]);
        showToast(`${cfg.title}: saare ${n} delete ho gaye`, 'success');
        ioRefreshAll();
    }

    function openImportModal(key) {
        const cfg = IO_CONFIG[key]; if (!cfg) return;
        __ioModule = key; __ioParsed = null;
        document.getElementById('ioModalTitle').textContent = `Import ${cfg.title} from CSV`;
        document.getElementById('ioFormat').textContent = cfg.headers.join(',');
        document.getElementById('ioNotes').innerHTML = cfg.notes.map(n => `<li>${n}</li>`).join('');
        document.getElementById('ioCsvFile').value = '';
        document.getElementById('ioPreview').innerHTML = '';
        document.getElementById('ioImportBtn').disabled = true;
        bootstrap.Modal.getOrCreateInstance(document.getElementById('ioModal')).show();
    }
    function downloadIoTemplate() {
        const cfg = IO_CONFIG[__ioModule]; if (!cfg) return;
        const lines = [cfg.headers.join(',')].concat(cfg.sample.map(r => r.map(csvEsc).join(',')));
        downloadText(`gharseva_${cfg.file}_template.csv`, lines.join('\n'));
        showToast('Template downloaded!', 'success');
    }
    function exportCurrentIoModule() { if (__ioModule) exportModuleCsv(__ioModule); }

    document.addEventListener('change', function (e) {
        if (!e.target || e.target.id !== 'ioCsvFile') return;
        const cfg = IO_CONFIG[__ioModule];
        const file = e.target.files && e.target.files[0];
        if (!cfg || !file) return;
        const reader = new FileReader();
        reader.onload = function (ev) {
            try {
                const res = csvToObjects(ev.target.result, cfg.required);
                if (res.error) {
                    __ioParsed = null;
                    document.getElementById('ioPreview').innerHTML = '';
                    document.getElementById('ioImportBtn').disabled = true;
                    showToast(res.error, 'error');
                    return;
                }
                const ctx = cfg.makeCtx();
                const parsed = [], errors = [], skipped = [];
                res.objs.forEach(o => {
                    const r = cfg.parse(o, ctx);
                    if (r.error) errors.push(`Row ${o._row}: ${r.error}`);
                    else if (r.dup) skipped.push(`Row ${o._row}: ${r.dup}`);
                    else parsed.push(r);
                });
                __ioParsed = parsed;
                renderIoPreview(cfg, parsed, errors, skipped);
            } catch (err) {
                console.error(err);
                showToast('CSV parse nahi ho payi', 'error');
            }
        };
        reader.readAsText(file);
    });

    function renderIoPreview(cfg, parsed, errors, skipped) {
        const c = document.getElementById('ioPreview'); if (!c) return;
        let html = `<div class="d-flex gap-2 flex-wrap mb-2">
            <span class="badge-soft green">✅ Ready: ${parsed.length}</span>
            ${errors.length ? `<span class="badge-soft red">❌ Errors: ${errors.length}</span>` : ''}
            ${skipped.length ? `<span class="badge-soft orange">⚠️ Skipped: ${skipped.length}</span>` : ''}
        </div>`;
        if (parsed.length) {
            html += `<div style="max-height:220px;overflow:auto;border:1px solid #e2e8f0;border-radius:12px;">
                <table class="table table-sm mb-0" style="font-size:0.8rem;">
                    <thead style="position:sticky;top:0;background:#f8fafc;z-index:1;"><tr>${cfg.previewHead.map(h => `<th>${escapeHtml(h)}</th>`).join('')}</tr></thead>
                    <tbody>${parsed.slice(0, 200).map(p => `<tr>${p.view.map(v => `<td>${escapeHtml(String(v))}</td>`).join('')}</tr>`).join('')}</tbody>
                </table></div>`;
            if (parsed.length > 200) html += `<small class="text-muted">Preview me pehli 200 rows — import me saari ${parsed.length} judengi.</small>`;
        }
        if (errors.length) {
            html += `<details class="mt-2" style="font-size:0.8rem;"><summary class="fw-semibold text-danger">Show errors (${errors.length})</summary>
                <ul class="mb-0 ps-3">${errors.slice(0, 50).map(e => `<li>${escapeHtml(e)}</li>`).join('')}</ul></details>`;
        }
        if (skipped.length) {
            html += `<details class="mt-2" style="font-size:0.8rem;"><summary class="fw-semibold text-warning">Show skipped duplicates (${skipped.length})</summary>
                <ul class="mb-0 ps-3">${skipped.slice(0, 50).map(e => `<li>${escapeHtml(e)}</li>`).join('')}</ul></details>`;
        }
        c.innerHTML = html;
        const btn = document.getElementById('ioImportBtn');
        if (btn) btn.disabled = parsed.length === 0;
    }

    function confirmIoImport() {
        const cfg = IO_CONFIG[__ioModule];
        if (!cfg || !__ioParsed || !__ioParsed.length) { showToast('Import karne ke liye kuch nahi hai', 'warning'); return; }
        const n = __ioParsed.length;
        if (cfg.commit(__ioParsed) === false) return;
        const inst = bootstrap.Modal.getInstance(document.getElementById('ioModal'));
        if (inst) inst.hide();
        showToast(`${n} ${cfg.title} imported!`, 'success');
        __ioParsed = null;
        ioRefreshAll();
    }

    Object.assign(GS, {
        csv: {
            buildIoMenus, exportModuleCsv, removeAllModule, openImportModal,
            downloadIoTemplate, exportCurrentIoModule, confirmIoImport
        }
    });

    // Inline HTML ke liye
    window.openImportModal = openImportModal;
    window.exportModuleCsv = exportModuleCsv;
    window.removeAllModule = removeAllModule;
    window.downloadIoTemplate = downloadIoTemplate;
    window.exportCurrentIoModule = exportCurrentIoModule;
    window.confirmIoImport = confirmIoImport;
    window.buildIoMenus = buildIoMenus;
})();