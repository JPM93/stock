/* ============================================================
   GharSeva — backup.js
   JSON export/import, Google Drive, clear all, sample data.
   ============================================================ */
(function () {
    'use strict';
    const {
        showToast, escapeHtml, uid, todayISO,
        load, save, getAllData, restoreData,
        getStorages, getCategories, getBrands, getSellers, getItems, getStock,
        saveStorages, saveCategories, saveBrands, saveSellers, saveItems, saveStock,
        saveShopping, savePurchaseNotes,
        getBrandById
    } = GS;

    // ═══ Google Drive ═══
    function getDriveConfig() { return load('gdrive_config', { clientId: '', folderName: '' }); }
    function saveGoogleDriveConfig() {
        const clientId = document.getElementById('gdriveClientId').value.trim();
        const folderName = document.getElementById('gdriveFolderName').value.trim();
        if (!clientId || !folderName) { showToast('Both fields required', 'warning'); return; }
        save('gdrive_config', { clientId, folderName });
        showToast('Drive config saved!', 'success');
    }
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

    async function uploadToGoogleDrive() {
        setDriveStatus('⏳ Backing up...');
        const token = await ensureGoogleAuth();
        if (!token) { setDriveStatus('❌ Auth failed', true); return; }
        const config = getDriveConfig();
        const data = getAllData();
        const now = new Date();
        const fileName = `gharseva_backup_${now.getFullYear()}_${String(now.getMonth() + 1).padStart(2, '0')}_${String(now.getDate()).padStart(2, '0')}.json`;
        const KEEP_DAYS = 30;

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

            if (resp.ok) {
                setDriveStatus(`✅ Backup complete (${fileName})`);
                showToast('Backed up!', 'success');
                try {
                    const listRes = await fetch(
                        `https://www.googleapis.com/drive/v3/files?q='${folderId}' in parents and trashed=false&orderBy=createdTime desc&fields=files(id,name,createdTime)`,
                        { headers: { Authorization: 'Bearer ' + token } }
                    );
                    const listData = await listRes.json();
                    const cutoffTime = Date.now() - (KEEP_DAYS * 24 * 60 * 60 * 1000);
                    const oldFiles = (listData.files || []).filter(f => new Date(f.createdTime).getTime() < cutoffTime);
                    for (const f of oldFiles) {
                        await fetch(`https://www.googleapis.com/drive/v3/files/${f.id}`, {
                            method: 'DELETE',
                            headers: { Authorization: 'Bearer ' + token }
                        });
                    }
                    if (oldFiles.length) {
                        setDriveStatus(`✅ Backup complete · 🧹 ${oldFiles.length} old removed`);
                    }
                } catch (cleanupErr) {
                    console.warn('Cleanup failed (backup succeeded):', cleanupErr);
                }
            } else {
                throw new Error('Upload failed: ' + resp.status);
            }
        } catch (e) {
            setDriveStatus('❌ ' + e.message, true);
        }
    }

    async function listGoogleDriveFiles() {
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
    }

    async function restoreFromDrive(fileId) {
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
            GS.app.refreshCurrentPage(); GS.app.refreshDropdowns();
        } catch (e) { setDriveStatus('❌ ' + e.message, true); }
    }

    // ═══ Export / Import / Clear / Sample ═══
    function exportData() {
        const data = getAllData();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `gharseva-backup-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        showToast('Exported!', 'success');
    }
    function importData(event) {
        const file = event.target.files[0]; if (!file) return;
        const reader = new FileReader();
        reader.onload = function (e) {
            try {
                const data = JSON.parse(e.target.result);
                if (!data.items && !data.storages && !data.categories && !data.brands) { showToast('Invalid file', 'error'); return; }
                if (confirm('Replace all current data?')) {
                    restoreData(data);
                    showToast('Imported!', 'success');
                    GS.app.refreshCurrentPage(); GS.app.refreshDropdowns();
                }
            } catch (err) { showToast('Parse error', 'error'); }
        };
        reader.readAsText(file);
        event.target.value = '';
    }
    function clearAllData() {
        if (!confirm('⚠️ Delete ALL data? This cannot be undone.')) return;
        if (!confirm('Are you absolutely sure?')) return;
        saveStorages([]); saveCategories([]); saveBrands([]); saveSellers([]); saveItems([]); saveStock([]); saveShopping([]); savePurchaseNotes([]);
        showToast('All data cleared', 'success');
        GS.app.refreshCurrentPage(); GS.app.refreshDropdowns();
    }
    function loadSampleData() {
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
        const slr1 = { id: uid('slr'), name: 'Zepto', description: '10-min delivery', createdAt: now };
        const slr2 = { id: uid('slr'), name: 'Blinkit', description: 'Fast delivery', createdAt: now };
        const slr3 = { id: uid('slr'), name: 'BigBasket', description: 'Grocery app', createdAt: now };
        const slr4 = { id: uid('slr'), name: 'DMart', description: 'Local store', createdAt: now };

        const itm1 = { id: uid('itm'), brandId: brd1.id, itemName: 'Toor Dal', categoryId: cat1.id, size: 1, unit: 'kg', mrp: 220, price: 180, minAlert: 2, notes: '', sellers: [{ sellerId: slr1.id, price: 189 }, { sellerId: slr2.id, price: 175 }, { sellerId: slr3.id, price: 185 }], createdAt: now, updatedAt: now };
        const itm2 = { id: uid('itm'), brandId: brd2.id, itemName: 'Turmeric Powder', categoryId: cat3.id, size: 100, unit: 'gm', mrp: 50, price: 45, minAlert: 1, notes: '', sellers: [{ sellerId: slr1.id, price: 45 }, { sellerId: slr2.id, price: 42 }], createdAt: now, updatedAt: now };
        const itm3 = { id: uid('itm'), brandId: brd3.id, itemName: 'Milk', categoryId: cat4.id, size: 1, unit: 'l', mrp: 66, price: 60, minAlert: 3, notes: '', sellers: [{ sellerId: slr1.id, price: 62 }, { sellerId: slr2.id, price: 60 }, { sellerId: slr4.id, price: 58 }], createdAt: now, updatedAt: now };
        const itm4 = { id: uid('itm'), brandId: brd4.id, itemName: 'Almonds', categoryId: cat2.id, size: 250, unit: 'gm', mrp: 400, price: 350, minAlert: 1, notes: '', sellers: [{ sellerId: slr1.id, price: 375 }, { sellerId: slr3.id, price: 340 }], createdAt: now, updatedAt: now };
        const itm5 = { id: uid('itm'), brandId: brd5.id, itemName: 'Sunflower Oil', categoryId: cat3.id, size: 1, unit: 'l', mrp: 160, price: 140, minAlert: 1, notes: '', sellers: [{ sellerId: slr2.id, price: 139 }, { sellerId: slr3.id, price: 142 }], createdAt: now, updatedAt: now };
        const itm6 = { id: uid('itm'), brandId: brd1.id, itemName: 'Salt', categoryId: cat3.id, size: 1, unit: 'kg', mrp: 28, price: 25, minAlert: 1, notes: '', sellers: [{ sellerId: slr4.id, price: 24 }], createdAt: now, updatedAt: now };

        const exp1 = new Date(); exp1.setDate(exp1.getDate() + 5);
        const exp2 = new Date(); exp2.setDate(exp2.getDate() + 20);
        const exp3 = new Date(); exp3.setDate(exp3.getDate() + 180);
        const stock = [
            { id: uid('stk'), itemId: itm1.id, storageId: stg2.id, quantity: 3, batchNumber: 'TD-2024-A1', expiryDate: exp3.toISOString().split('T')[0], createdAt: now, updatedAt: now },
            { id: uid('stk'), itemId: itm2.id, storageId: stg3.id, quantity: 1, batchNumber: '', expiryDate: exp3.toISOString().split('T')[0], createdAt: now, updatedAt: now },
            { id: uid('stk'), itemId: itm3.id, storageId: stg1.id, quantity: 2, batchNumber: 'MLK-2401', expiryDate: exp1.toISOString().split('T')[0], createdAt: now, updatedAt: now },
            { id: uid('stk'), itemId: itm4.id, storageId: stg2.id, quantity: 0, batchNumber: '', expiryDate: exp2.toISOString().split('T')[0], createdAt: now, updatedAt: now },
            { id: uid('stk'), itemId: itm5.id, storageId: stg3.id, quantity: 2, batchNumber: '', expiryDate: exp3.toISOString().split('T')[0], createdAt: now, updatedAt: now },
            { id: uid('stk'), itemId: itm6.id, storageId: stg2.id, quantity: 1, batchNumber: '', expiryDate: exp3.toISOString().split('T')[0], createdAt: now, updatedAt: now }
        ];
        saveStorages([stg1, stg2, stg3]);
        saveCategories([cat1, cat2, cat3, cat4]);
        saveBrands([brd1, brd2, brd3, brd4, brd5]);
        saveSellers([slr1, slr2, slr3, slr4]);
        saveItems([itm1, itm2, itm3, itm4, itm5, itm6]);
        saveStock(stock);
        saveShopping([]);
        const pnDue = new Date(); pnDue.setDate(pnDue.getDate() + 3);
        const pnDueIso = pnDue.getFullYear() + '-' + String(pnDue.getMonth() + 1).padStart(2, '0') + '-' + String(pnDue.getDate()).padStart(2, '0');
        const pnIt = (itm, brd, slr, qty, price, bought) => ({ id: uid('pni'), itemId: itm.id, sellerId: slr.id, name: brd.name + ' ' + itm.itemName, qty, unit: itm.unit, price, bought, boughtAt: bought ? todayISO() : null, notes: '' });
        savePurchaseNotes([{
            id: uid('pn'), title: 'Weekend Grocery', dueDate: pnDueIso, remark: 'Mahine ka basic ration',
            items: [pnIt(itm1, brd1, slr2, 2, 175, true), pnIt(itm3, brd3, slr4, 3, 58, true), pnIt(itm5, brd5, slr2, 1, 139, false), pnIt(itm6, brd1, slr4, 2, 24, false)],
            createdAt: now, updatedAt: now
        }]);
        showToast('Sample data loaded!', 'success');
        GS.app.refreshCurrentPage(); GS.app.refreshDropdowns();
        window.navigateTo('dashboard');
    }

    Object.assign(GS, {
        backup: {
            getDriveConfig, saveGoogleDriveConfig, loadDriveConfigInputs,
            uploadToGoogleDrive, listGoogleDriveFiles, restoreFromDrive,
            exportData, importData, clearAllData, loadSampleData
        }
    });

    // Inline HTML ke liye
    window.saveGoogleDriveConfig = saveGoogleDriveConfig;
    window.uploadToGoogleDrive = uploadToGoogleDrive;
    window.listGoogleDriveFiles = listGoogleDriveFiles;
    window.restoreFromDrive = restoreFromDrive;
    window.exportData = exportData;
    window.importData = importData;
    window.clearAllData = clearAllData;
    window.loadSampleData = loadSampleData;
})();