/* ============================================================
   GharSeva — autocomplete.js
   Generic autocomplete engine + registries.
   core.js ke baad load hota hai.
   ============================================================ */
(function () {
    'use strict';
    const { escapeHtml } = GS;

    const __acRegistry = {};

    function acSetup(inputId, config) {
        __acRegistry[inputId] = { config, activeIndex: -1, filtered: [] };
        const input = document.getElementById(inputId);
        const list = document.getElementById(inputId + 'List');
        const clearBtn = document.getElementById(inputId + 'Clear');
        if (!input || !list) return;

        if (!input.dataset.acBound) {
            input.dataset.acBound = '1';
            input.addEventListener('input', () => {
                const r = __acRegistry[inputId];
                if (r && r.config.onType && input.value !== r.selLabel) r.config.onType(input.value);
                acFilter(inputId);
            });
            input.addEventListener('focus', () => { acFilter(inputId, true); });
            input.addEventListener('keydown', (e) => acKeydown(inputId, e));
            input.addEventListener('blur', () => { setTimeout(() => acClose(inputId), 200); });
        }
        if (clearBtn) clearBtn.classList.toggle('show', !!input.value);
    }

    function acFilter(inputId, forceOpen) {
        const reg = __acRegistry[inputId]; if (!reg) return;
        const input = document.getElementById(inputId);
        const list = document.getElementById(inputId + 'List');
        const clearBtn = document.getElementById(inputId + 'Clear');
        if (!input || !list) return;

        const q = (input.value || '').trim().toLowerCase();
        const all = reg.config.getSource() || [];

        let filtered = all;
        if (q) {
            filtered = all.filter(o => {
                const main = (o.label || '').toLowerCase();
                const sub = (o.sub || '').toLowerCase();
                return main.includes(q) || sub.includes(q);
            });
            filtered.sort((a, b) => {
                const al = (a.label || '').toLowerCase(), bl = (b.label || '').toLowerCase();
                const as = al.startsWith(q) ? 0 : 1;
                const bs = bl.startsWith(q) ? 0 : 1;
                if (as !== bs) return as - bs;
                return al.localeCompare(bl);
            });
        }

        reg.filtered = filtered;
        reg.activeIndex = -1;

        if (!filtered.length) {
            list.innerHTML = q
                ? `<div class="ac-empty"><i class="fas fa-search me-1"></i>Koi match nahi mila</div>`
                : `<div class="ac-empty">Type karke search karein</div>`;
        } else {
            list.innerHTML = filtered.slice(0, 50).map((o, i) => `
                <div class="ac-item" data-index="${i}" onmousedown="acSelect('${inputId}', ${i})">
                    <div style="flex:1;min-width:0;">
                        <div class="ac-main">${escapeHtml(o.label || '')}</div>
                        ${o.sub ? `<div class="ac-sub">${escapeHtml(o.sub)}</div>` : ''}
                    </div>
                </div>
            `).join('');
        }

        if (forceOpen || q.length > 0) list.classList.add('open');
        if (clearBtn) clearBtn.classList.toggle('show', !!input.value);
    }

    function acClose(inputId) {
        const list = document.getElementById(inputId + 'List');
        if (list) list.classList.remove('open');
        const reg = __acRegistry[inputId];
        if (reg) reg.activeIndex = -1;
    }

    function acKeydown(inputId, e) {
        const reg = __acRegistry[inputId]; if (!reg) return;
        const list = document.getElementById(inputId + 'List');
        const items = list.querySelectorAll('.ac-item');

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (!list.classList.contains('open')) { acFilter(inputId, true); return; }
            reg.activeIndex = Math.min(reg.activeIndex + 1, items.length - 1);
            acHighlight(items, reg.activeIndex);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            reg.activeIndex = Math.max(reg.activeIndex - 1, 0);
            acHighlight(items, reg.activeIndex);
        } else if (e.key === 'Enter') {
            if (list.classList.contains('open') && reg.activeIndex >= 0) {
                e.preventDefault();
                acSelect(inputId, reg.activeIndex);
            }
        } else if (e.key === 'Escape') {
            acClose(inputId);
        }
    }

    function acHighlight(items, idx) {
        items.forEach((it, i) => it.classList.toggle('active', i === idx));
        if (items[idx]) items[idx].scrollIntoView({ block: 'nearest' });
    }

    function acSelect(inputId, idx) {
        const reg = __acRegistry[inputId]; if (!reg) return;
        const o = reg.filtered[idx];
        if (!o) return;
        const input = document.getElementById(inputId);
        if (input) input.value = o.label;
        reg.selLabel = o.label;
        acClose(inputId);
        const clearBtn = document.getElementById(inputId + 'Clear');
        if (clearBtn) clearBtn.classList.add('show');
        if (reg.config.onSelect) reg.config.onSelect(o.id, o);
    }

    function acClear(inputId) {
        const reg = __acRegistry[inputId]; if (!reg) return;
        const input = document.getElementById(inputId);
        reg.selLabel = undefined;
        if (input) { input.value = ''; input.focus(); }
        const clearBtn = document.getElementById(inputId + 'Clear');
        if (clearBtn) clearBtn.classList.remove('show');
        acClose(inputId);
        if (reg.config.onClear) reg.config.onClear();
    }

    function acSetValue(inputId, id) {
        const reg = __acRegistry[inputId]; if (!reg) return;
        const all = reg.config.getSource() || [];
        const o = all.find(x => x.id === id);
        const input = document.getElementById(inputId);
        if (input) input.value = o ? o.label : '';
        reg.selLabel = o ? o.label : undefined;
        const clearBtn = document.getElementById(inputId + 'Clear');
        if (clearBtn) clearBtn.classList.toggle('show', !!input.value);
        if (o && reg.config.onSelect) reg.config.onSelect(o.id, o);
    }

    window.acSelect = acSelect;
    window.acClear = acClear;

    Object.assign(GS, {
        ac: { acSetup, acFilter, acClose, acKeydown, acHighlight, acSelect, acClear, acSetValue }
    });
})();