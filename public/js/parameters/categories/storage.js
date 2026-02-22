(function(){
    const el = (window.SP_params && window.SP_params.el) ? window.SP_params.el : function(tag, attrs, children){
        const e = document.createElement(tag);
        (attrs||{}).forEach && attrs.forEach(([k,v])=>e.setAttribute(k,v));
        if (attrs && typeof attrs === 'object' && !Array.isArray(attrs)){
            Object.keys(attrs).forEach(k=>{ if(k==='class') e.className = attrs[k]; else if(k==='html') e.innerHTML = attrs[k]; else e.setAttribute(k, attrs[k]); });
        }
        (children||[]).forEach(ch => { if(typeof ch === 'string') e.appendChild(document.createTextNode(ch)); else e.appendChild(ch); });
        return e;
    };

    window.SP_render_storage = function(area){
        area.innerHTML = '<div class="loading" data-i18n="loading_settings">Chargement des paramètres...</div>';
        (function init(){
            area.innerHTML = '';
            const wrap = el('div',{class:'params-form'});
            const head = el('h3'); head.setAttribute('data-i18n','storage'); head.textContent = window.t ? window.t('storage') : 'Stockage';
            wrap.appendChild(head);
            const grid = el('div',{class:'params-grid'});

            const addRow = (key, label, control) => {
                const row = el('div',{class:'param-row'});
                const name = el('div',{class:'param-name'});
                name.setAttribute('data-i18n', label);
                name.textContent = window.t ? window.t(label) : label;
                const val = el('div',{class:'param-value'});
                val.appendChild(control);
                // If the control is a path-input wrapper, ensure the value cell uses flex layout
                try{ if (control && control.classList && control.classList.contains('path-input-wrap')) val.classList.add('param-control-wrap'); }catch(e){}
                row.appendChild(name); row.appendChild(val);
                grid.appendChild(row);
            };

            const makeNumber = (id, min, max, value) => { if (window.SP_params && window.SP_params.makeNumber) return window.SP_params.makeNumber(id,min,max,value,'120px'); const n = document.createElement('aws-input'); n.id = id; n.setAttribute('type','number'); n.setAttribute('mode','edit'); if(min!==undefined) n.setAttribute('min',String(min)); if(max!==undefined) n.setAttribute('max',String(max)); if(value!==undefined) n.setAttribute('value',String(value)); n.style='width:120px'; return n; };
            const makeBool = (id)=>{ if (window.SP_params && window.SP_params.makeBool) return window.SP_params.makeBool(id); const b = document.createElement('aws-bool'); b.id = id; b.setAttribute('mode','edit'); return b; };
            const makeSelector = (id, options)=>{ if (window.SP_params && window.SP_params.makeSelector) return window.SP_params.makeSelector(id, options); const s = document.createElement('aws-selector'); s.id = id; s.setAttribute('mode','edit'); (options||[]).forEach(o=>{ const opt = document.createElement('aws-option'); opt.setAttribute('data-id', o.id); opt.textContent = o.label; s.appendChild(opt); }); return s; };

            // Controls for storage and log-related settings
            // data_path and token_path: allow choosing path via helper
            addRow('data_path','data_path', (function(){ return (window.SP_params && window.SP_params.makePathInput) ? window.SP_params.makePathInput('storage-data_path','', {directory:false, only_sfpss:true}) : (function(){ const i = document.createElement('aws-input'); i.id='storage-data_path'; i.setAttribute('mode','edit'); return i; })(); })());
            addRow('token_path','token_path', (function(){ return (window.SP_params && window.SP_params.makePathInput) ? window.SP_params.makePathInput('storage-token_path','', {directory:false}) : (function(){ const i = document.createElement('aws-input'); i.id='storage-token_path'; i.setAttribute('mode','edit'); return i; })(); })());
            addRow('backup_enabled','backup_enabled', makeBool('storage-backup_enabled'));
            addRow('backup_interval_days','backup_interval_days', makeNumber('storage-backup_interval_days', 1, 3650, 7));
            addRow('backup_location','backup_location', (function(){ return (window.SP_params && window.SP_params.makePathInput) ? window.SP_params.makePathInput('storage-backup_location','', {directory:true}) : (function(){ const i = document.createElement('aws-input'); i.id='storage-backup_location'; i.setAttribute('mode','edit'); return i; })(); })());
            addRow('backup_history_count','backup_history_count', makeNumber('storage-backup_history_count', 1, 1000, 20));

            // Backup and storage-only controls (log controls moved to Advanced)

            wrap.appendChild(grid);

            const actions = el('div',{class:'form-actions'});
            const saveBtn = document.createElement('aws-button'); saveBtn.id = 'storage-save'; saveBtn.setAttribute('variant','primary'); saveBtn.setAttribute('size','md'); saveBtn.setAttribute('data-i18n','save'); saveBtn.textContent = (window.t && window.t('save')) || 'Save';
            const exportCsvBtn = document.createElement('aws-button'); exportCsvBtn.id = 'storage-export-csv'; exportCsvBtn.setAttribute('variant','secondary'); exportCsvBtn.setAttribute('size','md'); exportCsvBtn.textContent = (window.t && window.t('export_csv')) || 'Export CSV';
            const importCsvBtn = document.createElement('aws-button'); importCsvBtn.id = 'storage-import-csv'; importCsvBtn.setAttribute('variant','secondary'); importCsvBtn.setAttribute('size','md'); importCsvBtn.textContent = (window.t && window.t('import_csv')) || 'Import CSV';
            const status = el('span',{id:'storage-status', style:'margin-left:12px;color:var(--sp-panel-text)'});
            actions.appendChild(saveBtn); actions.appendChild(exportCsvBtn); actions.appendChild(importCsvBtn); actions.appendChild(status);
            wrap.appendChild(actions);

            area.appendChild(wrap);

            const getVal = (id) => { if (window.SP_params && window.SP_params.getVal) return window.SP_params.getVal(id); const el = document.getElementById(id); if (!el) return null; try{ const tag = el.tagName && el.tagName.toLowerCase(); if (tag === 'aws-selector') { if ('value' in el && el.value !== undefined && el.value !== null && String(el.value).trim() !== '') return el.value; const attrVal = el.getAttribute && el.getAttribute('value'); if (attrVal && String(attrVal).trim() !== '') return attrVal; const opts = Array.from(el.querySelectorAll && el.querySelectorAll('aws-option') || []); let sel = opts.find(o => o.hasAttribute('selected')) || opts.find(o => o.getAttribute('data-selected') === 'true') || opts.find(o => o.getAttribute('selected') === 'true') || opts.find(o => o.getAttribute('aria-selected') === 'true') || opts.find(o => (o.classList && o.classList.contains && o.classList.contains('selected'))); if (!sel && opts.length === 1) sel = opts[0]; if (sel) return sel.getAttribute('data-id') || sel.getAttribute('value') || (sel.textContent && sel.textContent.trim()); for (const o of opts) { if (o.dataset && o.dataset.id) return o.dataset.id; } return null; } if (tag && tag.startsWith('aws-')) { if ('value' in el) return el.value; return el.getAttribute && el.getAttribute('value'); } if ('checked' in el) return el.checked; return el.value; }catch(e){ console.error('getVal error', e); return null; } };

            const setVal = (id, val) => { if (window.SP_params && window.SP_params.setVal) return window.SP_params.setVal(id, val); const el = document.getElementById(id); if (!el) return; try{ if ('value' in el) el.value = (val===undefined || val===null) ? '' : val; else el.setAttribute && el.setAttribute('value', val); try{ el.dispatchEvent(new Event('input')); }catch(e){} try{ el.dispatchEvent(new Event('value-changed')); }catch(e){} }catch(e){ try{ el.setAttribute && el.setAttribute('value', val); }catch(_){} } };
            const setBool = (id, val) => { if (window.SP_params && window.SP_params.setBool) return window.SP_params.setBool(id, val); const el = document.getElementById(id); if (!el) return; try{ if ('value' in el) el.value = !!val; else el.setAttribute && el.setAttribute('value', !!val); try{ el.dispatchEvent(new Event('change')); }catch(e){} try{ el.dispatchEvent(new Event('value-changed')); }catch(e){} }catch(e){ try{ el.setAttribute && el.setAttribute('value', !!val); }catch(_){} } };

            const loadSettings = async () => { if (window.SP_params && window.SP_params.loadSettings) return window.SP_params.loadSettings(); const safeParseJsonResponse = async (res) => { if (!res || !res.ok) return null; const ct = (res.headers.get('content-type')||'').toLowerCase(); if (ct.indexOf('application/json') !== -1) return await res.json(); try { const txt = await res.text(); return JSON.parse(txt); } catch(e){ return null; } }; try { const url = '/settings'; const r = await fetch(url,{cache:'no-store'}); const parsed = await safeParseJsonResponse(r); if (parsed) return parsed; } catch(e){} return null; };

            const createModal = (titleHtml, contentEl) => {
                const overlay = document.createElement('div'); overlay.className = 'sp-modal-overlay';
                overlay.style.position = 'fixed'; overlay.style.left='0'; overlay.style.top='0'; overlay.style.width='100%'; overlay.style.height='100%'; overlay.style.zIndex='100000'; overlay.style.display='flex'; overlay.style.alignItems='center'; overlay.style.justifyContent='center'; overlay.style.background='rgba(0,0,0,0.6)';
                const box = document.createElement('div'); box.style.background='var(--sp-panel-bg)'; box.style.color='var(--sp-panel-text)'; box.style.padding='18px'; box.style.borderRadius='10px'; box.style.minWidth='320px'; box.style.maxWidth='90%'; box.style.boxShadow='0 20px 60px rgba(0,0,0,0.6)';
                const title = document.createElement('div'); title.className='params-category-title'; title.innerHTML = titleHtml; box.appendChild(title);
                box.appendChild(contentEl);
                overlay.appendChild(box);
                return { overlay, box };
            };

            const showModal = (modalObj)=>{
                return new Promise((resolve)=>{
                    document.body.appendChild(modalObj.overlay);
                    const close = (result)=>{ try{ modalObj.overlay.remove(); }catch(e){} resolve(result); };
                    modalObj.close = close;
                });
            };

            const showExportPasswordModal = async ()=>{
                const wrapper = document.createElement('div');
                const pwd = document.createElement('aws-input'); pwd.setAttribute('type','password'); pwd.setAttribute('mode','edit'); pwd.setAttribute('value',''); pwd.setAttribute('placeholder',(window.t && window.t('export_password_prompt')) || 'Export password'); pwd.style.marginBottom='8px';
                const err = document.createElement('div'); err.style.color='var(--sp-error)'; err.style.minHeight='18px'; err.style.marginBottom='8px';
                const actions = document.createElement('div'); actions.className='form-actions';
                const btnOk = document.createElement('aws-button'); btnOk.setAttribute('variant','primary'); btnOk.textContent=(window.t && window.t('confirm'))||'Confirm';
                const btnCancel = document.createElement('aws-button'); btnCancel.textContent=(window.t && window.t('cancel'))||'Cancel';
                actions.appendChild(btnOk); actions.appendChild(btnCancel);
                wrapper.appendChild(pwd); wrapper.appendChild(err); wrapper.appendChild(actions);

                const modal = createModal((window.t && window.t('require_password_on_export')) || 'Require password on export', wrapper);
                const prom = showModal(modal);
                btnCancel.addEventListener('click', ()=> modal.close({ok:false}));
                btnOk.addEventListener('click', ()=>{
                    err.textContent='';
                    if (!pwd.value){ err.textContent=(window.t && window.t('password_required'))||'Password required'; return; }
                    modal.close({ok:true, password: String(pwd.value || '')});
                });
                return prom;
            };

            const populate = (settings)=>{
                const s = settings || {};
                try{
                    // prefer nested storage object, fallback to root keys for compatibility
                    const st = (s && s.storage) ? s.storage : s;
                    // Debug: log incoming settings and chosen values
                    try{ console.debug('populate storage - incoming settings:', s); }catch(e){}
                    const dataPath = (st && typeof st.data_path !== 'undefined' && st.data_path !== null) ? st.data_path : (typeof s.data_path !== 'undefined' ? s.data_path : '');
                    const tokenPath = (st && typeof st.token_path !== 'undefined' && st.token_path !== null) ? st.token_path : (typeof s.token_path !== 'undefined' ? s.token_path : '');
                    const backupEnabled = (typeof (st && st.backup_enabled) !== 'undefined') ? st.backup_enabled : (typeof s.backup_enabled !== 'undefined' ? s.backup_enabled : true);
                    const backupInterval = (typeof (st && st.backup_interval_days) !== 'undefined') ? st.backup_interval_days : (typeof s.backup_interval_days !== 'undefined' ? s.backup_interval_days : 7);
                    const backupLocation = (typeof (st && st.backup_location) !== 'undefined') ? st.backup_location : (typeof s.backup_location !== 'undefined' ? s.backup_location : '');
                    const backupHistory = (typeof (st && st.backup_history_count) !== 'undefined') ? st.backup_history_count : (typeof s.backup_history_count !== 'undefined' ? s.backup_history_count : 20);
                    try{ console.debug('populate storage - using values:', { dataPath, tokenPath, backupEnabled, backupInterval, backupLocation, backupHistory }); }catch(e){}
                    // Do NOT validate paths in the frontend; simply display stored values.
                    setVal('storage-data_path', dataPath);
                    setVal('storage-token_path', tokenPath);
                    setBool('storage-backup_enabled', !!backupEnabled);
                    setVal('storage-backup_interval_days', backupInterval);
                    setVal('storage-backup_location', backupLocation);
                    setVal('storage-backup_history_count', backupHistory);

                    // log settings are managed in Advanced UI; keep storage display minimal
                    try{ if (window.SP_params && typeof window.SP_params.initAwsWidgets === 'function') window.SP_params.initAwsWidgets(area); }catch(e){}
                }catch(e){ console.error('populate storage', e); }
            };

            loadSettings().then(j=>{ if(j && j.settings) populate(j.settings); else populate(j); }).catch(e=>{ console.warn('Could not load settings', e); populate({}); });

            saveBtn.addEventListener('click', function(){
                status.textContent = (window.t && window.t('saving')) || 'Saving...';
                const updates = {
                    storage: {
                        data_path: getVal('storage-data_path') || '',
                        token_path: getVal('storage-token_path') || '',
                        backup_enabled: !!getVal('storage-backup_enabled'),
                        backup_interval_days: parseInt(getVal('storage-backup_interval_days') || 7,10),
                        backup_location: getVal('storage-backup_location') || '',
                        backup_history_count: parseInt(getVal('storage-backup_history_count') || 20,10)
                        // no log fields here; advanced section handles them
                    }
                };
                const doSave = (window.SP_saveSettings && typeof window.SP_saveSettings === 'function') ? window.SP_saveSettings : (window.SP_params && window.SP_params.saveSettings) ? window.SP_params.saveSettings : null;
                if (doSave){ (async function(){ try{ const resp = await doSave(updates); if (resp && resp.status === 'ok'){ status.textContent = (window.t && window.t('saved')) || 'Saved'; setTimeout(()=>{ status.textContent=''; try{ window.location.reload(); }catch(e){ location.reload(); } }, 700); } else { status.textContent = (window.t && window.t('error')) || 'Error'; console.warn(resp); } }catch(e){ status.textContent = (window.t && window.t('error')) || 'Error'; console.error(e); } })(); } else { status.textContent = (window.t && window.t('error')) || 'Error'; }
            });

            exportCsvBtn.addEventListener('click', async function(){
                status.textContent = (window.t && window.t('exporting')) || 'Exporting...';
                try {
                    let password = '';

                    let requirePassword = false;
                    try {
                        const loaded = await loadSettings();
                        const root = (loaded && loaded.settings) ? loaded.settings : (loaded || {});
                        const sec = (root && root.security && typeof root.security === 'object') ? root.security : {};
                        requirePassword = !!((typeof root.require_password_on_export !== 'undefined') ? root.require_password_on_export : sec.require_password_on_export);
                    } catch (e) {}

                    if (requirePassword) {
                        const modalResult = await showExportPasswordModal();
                        if (!modalResult || !modalResult.ok) {
                            status.textContent = '';
                            return;
                        }
                        password = String((modalResult.password || '')).trim();
                    }

                    const isFrontendDev = (window.location.port === '3000');
                    const backendBase = `${window.location.protocol}//${window.location.hostname}:5000`;
                    const exportUrl = isFrontendDev ? (backendBase + '/exportCSV') : '/exportCSV';

                    const payload = {};
                    if (password) payload.password = password;

                    const headers = { 'Content-Type': 'application/json' };
                    if (password) headers['X-Export-Password'] = password;

                    const resp = await fetch(exportUrl, {
                        method: 'POST',
                        headers,
                        body: JSON.stringify(payload)
                    });

                    if (!resp.ok) {
                        let msg = '';
                        try {
                            const j = await resp.json();
                            msg = (j && (j.error || j.message)) ? (j.error || j.message) : '';
                        } catch (e) {}
                        throw new Error(msg || ('HTTP ' + resp.status));
                    }

                    const blob = await resp.blob();
                    const downloadUrl = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = downloadUrl;
                    a.download = 'SafePass_export.csv';
                    document.body.appendChild(a);
                    a.click();
                    a.remove();
                    setTimeout(() => URL.revokeObjectURL(downloadUrl), 1500);

                    status.textContent = (window.t && window.t('saved')) || 'Saved';
                    setTimeout(()=>{ status.textContent=''; }, 1200);
                } catch (e) {
                    status.textContent = (window.t && window.t('error')) || 'Error';
                    console.error('CSV export failed', e);
                }
            });

            importCsvBtn.addEventListener('click', async function(){
                status.textContent = (window.t && window.t('importing')) || 'Importing...';
                try {
                    let token = null;
                    try {
                        if (typeof window.ensureAuthToken === 'function') {
                            token = await window.ensureAuthToken(false);
                        }
                    } catch (e) {}
                    if (!token) {
                        try {
                            const raw = localStorage.getItem('sp_auth_session');
                            const parsed = raw ? JSON.parse(raw) : null;
                            if (parsed && parsed.token) token = parsed.token;
                        } catch (e) {}
                    }

                    const isFrontendDev = (window.location.port === '3000');
                    const backendBase = `${window.location.protocol}//${window.location.hostname}:5000`;
                    const selectPathUrl = isFrontendDev ? (backendBase + '/select-path') : '/select-path';
                    const importUrl = isFrontendDev ? (backendBase + '/importCSV') : '/importCSV';

                    const selectResp = await fetch(selectPathUrl, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ mode: 'file', only_csv: true })
                    });

                    let selected = null;
                    if (!selectResp.ok) {
                        let selectMsg = 'Path selection failed (HTTP ' + selectResp.status + ')';
                        try {
                            const j = await selectResp.json();
                            if (j && (j.error || j.message)) selectMsg = String(j.error || j.message);
                        } catch (e) {}

                        try {
                            const fallbackResp = await fetch(selectPathUrl, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ mode: 'file' })
                            });
                            if (fallbackResp.ok) {
                                selected = await fallbackResp.json();
                            }
                        } catch (e) {}

                        if (!selected) throw new Error(selectMsg);
                    }

                    if (!selected) selected = await selectResp.json();
                    if (!selected || selected.status === 'cancelled' || !selected.path) {
                        status.textContent = '';
                        return;
                    }

                    const headers = { 'Content-Type': 'application/json' };
                    if (token && token !== '__MASTER_DISABLED__') headers['X-Auth-Token'] = token;

                    const resp = await fetch(importUrl, {
                        method: 'POST',
                        headers,
                        body: JSON.stringify({ csv_path: selected.path })
                    });

                    if (!resp.ok) {
                        let msg = '';
                        try {
                            const j = await resp.json();
                            msg = (j && (j.error || j.message)) ? (j.error || j.message) : '';
                        } catch (e) {}
                        throw new Error(msg || ('HTTP ' + resp.status));
                    }

                    const result = await resp.json();
                    const imported = (result && typeof result.imported === 'number') ? result.imported : null;
                    const savedText = (window.t && window.t('saved')) || 'Saved';
                    status.textContent = imported !== null ? `${savedText} (${imported})` : savedText;
                    setTimeout(()=>{ status.textContent=''; }, 1800);
                } catch (e) {
                    status.textContent = (window.t && window.t('error')) || 'Error';
                    console.error('CSV import failed', e);
                }
            });
        })();
    };
})();