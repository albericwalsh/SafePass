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
            addRow('data_path','data_path', (function(){ return (window.SP_params && window.SP_params.makePathInput) ? window.SP_params.makePathInput('storage-data_path','', {directory:false}) : (function(){ const i = document.createElement('aws-input'); i.id='storage-data_path'; i.setAttribute('mode','edit'); return i; })(); })());
            addRow('token_path','token_path', (function(){ return (window.SP_params && window.SP_params.makePathInput) ? window.SP_params.makePathInput('storage-token_path','', {directory:false}) : (function(){ const i = document.createElement('aws-input'); i.id='storage-token_path'; i.setAttribute('mode','edit'); return i; })(); })());
            addRow('backup_enabled','backup_enabled', makeBool('storage-backup_enabled'));
            addRow('backup_interval_days','backup_interval_days', makeNumber('storage-backup_interval_days', 1, 3650, 7));

            // Backup and storage-only controls (log controls moved to Advanced)

            wrap.appendChild(grid);

            const actions = el('div',{class:'form-actions'});
            const saveBtn = document.createElement('aws-button'); saveBtn.id = 'storage-save'; saveBtn.setAttribute('variant','primary'); saveBtn.setAttribute('size','md'); saveBtn.setAttribute('data-i18n','save'); saveBtn.textContent = (window.t && window.t('save')) || 'Save';
            const status = el('span',{id:'storage-status', style:'margin-left:12px;color:var(--sp-panel-text)'});
            actions.appendChild(saveBtn); actions.appendChild(status);
            wrap.appendChild(actions);

            area.appendChild(wrap);

            const getVal = (id) => { if (window.SP_params && window.SP_params.getVal) return window.SP_params.getVal(id); const el = document.getElementById(id); if (!el) return null; try{ const tag = el.tagName && el.tagName.toLowerCase(); if (tag === 'aws-selector') { if ('value' in el && el.value !== undefined && el.value !== null && String(el.value).trim() !== '') return el.value; const attrVal = el.getAttribute && el.getAttribute('value'); if (attrVal && String(attrVal).trim() !== '') return attrVal; const opts = Array.from(el.querySelectorAll && el.querySelectorAll('aws-option') || []); let sel = opts.find(o => o.hasAttribute('selected')) || opts.find(o => o.getAttribute('data-selected') === 'true') || opts.find(o => o.getAttribute('selected') === 'true') || opts.find(o => o.getAttribute('aria-selected') === 'true') || opts.find(o => (o.classList && o.classList.contains && o.classList.contains('selected'))); if (!sel && opts.length === 1) sel = opts[0]; if (sel) return sel.getAttribute('data-id') || sel.getAttribute('value') || (sel.textContent && sel.textContent.trim()); for (const o of opts) { if (o.dataset && o.dataset.id) return o.dataset.id; } return null; } if (tag && tag.startsWith('aws-')) { if ('value' in el) return el.value; return el.getAttribute && el.getAttribute('value'); } if ('checked' in el) return el.checked; return el.value; }catch(e){ console.error('getVal error', e); return null; } };

            const setVal = (id, val) => { if (window.SP_params && window.SP_params.setVal) return window.SP_params.setVal(id, val); const el = document.getElementById(id); if (!el) return; try{ if ('value' in el) el.value = (val===undefined || val===null) ? '' : val; else el.setAttribute && el.setAttribute('value', val); try{ el.dispatchEvent(new Event('input')); }catch(e){} try{ el.dispatchEvent(new Event('value-changed')); }catch(e){} }catch(e){ try{ el.setAttribute && el.setAttribute('value', val); }catch(_){} } };
            const setBool = (id, val) => { if (window.SP_params && window.SP_params.setBool) return window.SP_params.setBool(id, val); const el = document.getElementById(id); if (!el) return; try{ if ('value' in el) el.value = !!val; else el.setAttribute && el.setAttribute('value', !!val); try{ el.dispatchEvent(new Event('change')); }catch(e){} try{ el.dispatchEvent(new Event('value-changed')); }catch(e){} }catch(e){ try{ el.setAttribute && el.setAttribute('value', !!val); }catch(_){} } };

            const loadSettings = async () => { if (window.SP_params && window.SP_params.loadSettings) return window.SP_params.loadSettings(); const safeParseJsonResponse = async (res) => { if (!res || !res.ok) return null; const ct = (res.headers.get('content-type')||'').toLowerCase(); if (ct.indexOf('application/json') !== -1) return await res.json(); try { const txt = await res.text(); return JSON.parse(txt); } catch(e){ return null; } }; try { const url = '/settings'; const r = await fetch(url,{cache:'no-store'}); const parsed = await safeParseJsonResponse(r); if (parsed) return parsed; } catch(e){} return null; };

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
                    try{ console.debug('populate storage - using values:', { dataPath, tokenPath, backupEnabled, backupInterval }); }catch(e){}
                    // Do NOT validate paths in the frontend; simply display stored values.
                    setVal('storage-data_path', dataPath);
                    setVal('storage-token_path', tokenPath);
                    setBool('storage-backup_enabled', !!backupEnabled);
                    setVal('storage-backup_interval_days', backupInterval);

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
                        // no log fields here; advanced section handles them
                    }
                };
                const doSave = (window.SP_saveSettings && typeof window.SP_saveSettings === 'function') ? window.SP_saveSettings : (window.SP_params && window.SP_params.saveSettings) ? window.SP_params.saveSettings : null;
                if (doSave){ (async function(){ try{ const resp = await doSave(updates); if (resp && resp.status === 'ok'){ status.textContent = (window.t && window.t('saved')) || 'Saved'; setTimeout(()=>{ status.textContent=''; try{ window.location.reload(); }catch(e){ location.reload(); } }, 700); } else { status.textContent = (window.t && window.t('error')) || 'Error'; console.warn(resp); } }catch(e){ status.textContent = (window.t && window.t('error')) || 'Error'; console.error(e); } })(); } else { status.textContent = (window.t && window.t('error')) || 'Error'; }
            });
        })();
    };
})();