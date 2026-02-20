(function(){
    const el = (window.SP_params && window.SP_params.el) ? window.SP_params.el : function(tag, attrs, children){
        const e = document.createElement(tag);
        if (attrs && typeof attrs === 'object' && !Array.isArray(attrs)){
            Object.keys(attrs).forEach(k=>{ if(k==='class') e.className = attrs[k]; else if(k==='html') e.innerHTML = attrs[k]; else e.setAttribute(k, attrs[k]); });
        }
        (children||[]).forEach(ch => { if(typeof ch === 'string') e.appendChild(document.createTextNode(ch)); else e.appendChild(ch); });
        return e;
    };

    window.SP_render_security = function(area){
        area.innerHTML = '<div class="loading" data-i18n="loading_settings">Chargement des paramètres...</div>';
        (function init(){
            area.innerHTML = '';
            const wrap = el('div',{class:'params-form'});
            const head = el('h3'); head.setAttribute('data-i18n','security'); head.textContent = window.t ? window.t('security') : 'Security';
            wrap.appendChild(head);
            const grid = el('div',{class:'params-grid'});

            const addRow = (key, label, control) => {
                const row = el('div',{class:'param-row'});
                const name = el('div',{class:'param-name'});
                name.setAttribute('data-i18n', label);
                name.textContent = window.t ? window.t(label) : label;
                const val = el('div',{class:'param-value'});
                val.appendChild(control);
                row.appendChild(name); row.appendChild(val);
                grid.appendChild(row);
            };

            const makeNumber = (id, min, max, value) => { if (window.SP_params && window.SP_params.makeNumber) return window.SP_params.makeNumber(id,min,max,value,'120px'); const n = document.createElement('aws-input'); n.id = id; n.setAttribute('type','number'); n.setAttribute('mode','edit'); if(min!==undefined) n.setAttribute('min',String(min)); if(max!==undefined) n.setAttribute('max',String(max)); if(value!==undefined) n.setAttribute('value',String(value)); n.style='width:120px'; return n; };
            const makeBool = (id)=>{ if (window.SP_params && window.SP_params.makeBool) return window.SP_params.makeBool(id); const b = document.createElement('aws-bool'); b.id = id; b.setAttribute('mode','edit'); return b; };
            const makeSelector = (id, options)=>{ if (window.SP_params && window.SP_params.makeSelector) return window.SP_params.makeSelector(id, options); const s = document.createElement('aws-selector'); s.id = id; s.setAttribute('mode','edit'); (options||[]).forEach(o=>{ const opt = document.createElement('aws-option'); opt.setAttribute('data-id', o.id); opt.textContent = o.label; s.appendChild(opt); }); return s; };

            const makeThresholdLine = ()=>{
                const wrapper = document.createElement('div');
                wrapper.style.display = 'flex';
                wrapper.style.flexDirection = 'column';
                wrapper.style.gap = '8px';

                // bar container
                const barWrap = document.createElement('div');
                barWrap.style.position = 'relative';
                barWrap.style.width = '100%';
                barWrap.style.height = '18px';
                barWrap.style.borderRadius = '8px';
                barWrap.style.overflow = 'visible';
                barWrap.style.background = 'linear-gradient(to right, red 0%, orange 33%, yellow 66%, green 100%)';

                // marker elements (optional ticks)
                const tickContainer = document.createElement('div');
                tickContainer.style.position = 'absolute';
                tickContainer.style.left = '0';
                tickContainer.style.top = '0';
                tickContainer.style.right = '0';
                tickContainer.style.bottom = '0';
                barWrap.appendChild(tickContainer);

                // inputs: placed absolutely above the bar at transition positions
                const commonInputStyle = {
                    width: '56px',
                    padding: '6px 8px',
                    position: 'absolute',
                    top: '-4px',
                    borderRadius: '6px',
                    background: 'var(--sp-panel-bg, #fff)',
                    color: 'var(--sp-panel-text, #222)',
                    border: '1px solid var(--sp-input-border, rgba(0,0,0,0.12))',
                    boxShadow: '0 6px 18px rgba(0,0,0,0.12)',
                    fontSize: '13px',
                    textAlign: 'center',
                    zIndex: '200'
                };
                const inRed = document.createElement('input'); inRed.type='number'; inRed.id='security-strength_threshold_red'; inRed.min='0'; inRed.max='100';
                const inOrange = document.createElement('input'); inOrange.type='number'; inOrange.id='security-strength_threshold_orange'; inOrange.min='0'; inOrange.max='100';
                const inYellow = document.createElement('input'); inYellow.type='number'; inYellow.id='security-strength_threshold_yellow'; inYellow.min='0'; inYellow.max='100';
                [inRed, inOrange, inYellow].forEach(i=>{ Object.assign(i.style, commonInputStyle); i.setAttribute('inputmode','numeric'); i.setAttribute('aria-label','strength-threshold'); });

                // small labels under bar for colors
                const labelsRow = document.createElement('div');
                labelsRow.style.display = 'flex';
                labelsRow.style.justifyContent = 'space-between';
                labelsRow.style.fontSize = '12px';
                labelsRow.style.color = 'var(--sp-panel-text)';
                labelsRow.style.marginTop = '4px';
                const rlbl = document.createElement('span'); rlbl.textContent = (window.t && window.t('red'))||'red'; rlbl.style.color='red'; rlbl.style.fontWeight='600';
                const olbl = document.createElement('span'); olbl.textContent = (window.t && window.t('orange'))||'orange'; olbl.style.color='orange'; olbl.style.fontWeight='600';
                const ylbl = document.createElement('span'); ylbl.textContent = (window.t && window.t('yellow'))||'yellow'; ylbl.style.color='goldenrod'; ylbl.style.fontWeight='600';
                const glbl = document.createElement('span'); glbl.textContent = (window.t && window.t('green'))||'green'; glbl.style.color='green'; glbl.style.fontWeight='600';
                labelsRow.appendChild(rlbl); labelsRow.appendChild(olbl); labelsRow.appendChild(ylbl); labelsRow.appendChild(glbl);

                barWrap.appendChild(inRed); barWrap.appendChild(inOrange); barWrap.appendChild(inYellow);
                wrapper.appendChild(barWrap);
                wrapper.appendChild(labelsRow);

                // update bar gradient and input positions based on current values
                const updateBar = ()=>{
                    const r = Number(inRed.value) || 0;
                    const o = Number(inOrange.value) || Math.max(r+1, 1);
                    const y = Number(inYellow.value) || Math.max(o+1, 2);
                    const rr = Math.min(100, Math.max(0, r));
                    const oo = Math.min(100, Math.max(rr+1, o));
                    const yy = Math.min(100, Math.max(oo+1, y));
                    barWrap.style.background = `linear-gradient(to right, red 0% ${rr}%, orange ${rr}% ${oo}%, yellow ${oo}% ${yy}%, green ${yy}% 100%)`;
                    // position inputs (center them at transition)
                    inRed.style.left = `calc(${rr}% - ${inRed.offsetWidth/2}px)`;
                    inOrange.style.left = `calc(${oo}% - ${inOrange.offsetWidth/2}px)`;
                    inYellow.style.left = `calc(${yy}% - ${inYellow.offsetWidth/2}px)`;
                };

                // attach listeners
                [inRed, inOrange, inYellow].forEach(inp=>{ inp.addEventListener('input', updateBar); inp.addEventListener('change', updateBar); });

                // expose update function for external calls
                wrapper.updateBar = updateBar;
                return wrapper;
            };

            addRow('master_password_enabled','master_password_enabled', makeBool('security-master_password_enabled'));
            addRow('auto_lock_minutes','auto_lock_minutes', makeNumber('security-auto_lock_minutes', 1, 1440, 5));
            addRow('require_password_on_export','require_password_on_export', makeBool('security-require_password_on_export'));
            // legacy single-policy removed; detailed parameters below

            // Extended password policy fields
            addRow('password_min_length','password_min_length', makeNumber('security-password_min_length', 4, 128, 12));
            addRow('require_uppercase','require_uppercase', makeBool('security-require_uppercase'));
            addRow('require_lowercase','require_lowercase', makeBool('security-require_lowercase'));
            addRow('require_numbers','require_numbers', makeBool('security-require_numbers'));
            addRow('require_symbols','require_symbols', makeBool('security-require_symbols'));
            addRow('password_blacklist','password_blacklist', (function(){
                if (window.SP_params && typeof window.SP_params.makeInput === 'function'){
                    try{
                        return window.SP_params.makeInput('security-password_blacklist', { mode: 'edit', placeholder: (window.t && window.t('password_blacklist_placeholder')) || 'comma,separated,blacklist' });
                    }catch(e){}
                }
                const i = document.createElement('aws-input');
                i.id = 'security-password_blacklist';
                i.setAttribute('mode','edit');
                i.setAttribute('placeholder', (window.t && window.t('password_blacklist_placeholder')) || 'comma,separated,blacklist');
                return i;
            })());
            addRow('password_history_length','password_history_length', makeNumber('security-password_history_length', 0, 50, 5));
            // Strength thresholds visual line (red -> orange -> yellow -> green)
            addRow('strength_thresholds','strength_thresholds', makeThresholdLine());

            wrap.appendChild(grid);

            const actions = el('div',{class:'form-actions'});
            const saveBtn = document.createElement('aws-button'); saveBtn.id = 'security-save'; saveBtn.setAttribute('variant','primary'); saveBtn.setAttribute('size','md'); saveBtn.setAttribute('data-i18n','save'); saveBtn.textContent = (window.t && window.t('save')) || 'Sauvegarder';
            const status = el('span',{id:'security-status', style:'margin-left:12px;color:var(--sp-panel-text)'});
            actions.appendChild(saveBtn); actions.appendChild(status);
            wrap.appendChild(actions);

            area.appendChild(wrap);

                    const getVal = (id) => { if (window.SP_params && window.SP_params.getVal) return window.SP_params.getVal(id); const el = document.getElementById(id); if (!el) return null; try{ const tag = el.tagName && el.tagName.toLowerCase(); if (tag === 'aws-selector') { if ('value' in el && el.value !== undefined && el.value !== null && String(el.value).trim() !== '') return el.value; const attrVal = el.getAttribute && el.getAttribute('value'); if (attrVal && String(attrVal).trim() !== '') return attrVal; const opts = Array.from(el.querySelectorAll && el.querySelectorAll('aws-option') || []); let sel = opts.find(o => o.hasAttribute('selected')) || opts.find(o => o.getAttribute('data-selected') === 'true') || opts.find(o => o.getAttribute('selected') === 'true') || opts.find(o => o.getAttribute('aria-selected') === 'true') || opts.find(o => (o.classList && o.classList.contains && o.classList.contains('selected'))); if (!sel && opts.length === 1) sel = opts[0]; if (sel) return sel.getAttribute('data-id') || sel.getAttribute('value') || (sel.textContent && sel.textContent.trim()); for (const o of opts) { if (o.dataset && o.dataset.id) return o.dataset.id; } return null; } if (tag && tag.startsWith('aws-')) { try{ if ('checked' in el) return el.checked; }catch(e){} try{ const a = el.getAttribute && el.getAttribute('aria-checked'); if (a !== null) return a; }catch(e){} try{ if ('value' in el) return el.value; }catch(e){} try{ const attrVal = el.getAttribute && el.getAttribute('value'); if (attrVal !== null) return attrVal; }catch(e){} return null; } if ('checked' in el) return el.checked; return el.value; }catch(e){ console.error('getVal error', e); return null; } };

            // normalize boolean-like values from different control types
            const parseBool = (v) => {
                if (v === true || v === 1) return true;
                if (v === false || v === 0 || v === null || typeof v === 'undefined') return false;
                const s = String(v).toLowerCase().trim();
                if (s === 'true' || s === '1' || s === 'yes' || s === 'on') return true;
                if (s === 'false' || s === '0' || s === 'no' || s === 'off' || s === '') return false;
                return false;
            };

            const proto = window.location.protocol; const host = window.location.hostname; const isFrontendDev = (window.location.port === '3000'); const backendBase = `${proto}//${host}:5000`;
            const adminUrl = (path)=> isFrontendDev ? (backendBase + path) : path;
            const loadSettings = async () => { if (window.SP_params && window.SP_params.loadSettings) return window.SP_params.loadSettings(); const safeParseJsonResponse = async (res) => { if (!res || !res.ok) return null; const ct = (res.headers.get('content-type')||'').toLowerCase(); if (ct.indexOf('application/json') !== -1) return await res.json(); try { const txt = await res.text(); return JSON.parse(txt); } catch(e){ return null; } }; if (isFrontendDev) { try { const url = backendBase + '/settings'; const r = await fetch(url,{cache:'no-store'}); const parsed = await safeParseJsonResponse(r); if (parsed) return parsed; } catch(e){} } try { const url = '/settings'; const r = await fetch(url,{cache:'no-store'}); const parsed = await safeParseJsonResponse(r); if (parsed) return parsed; } catch(e){} try { const url = backendBase + '/settings'; const r = await fetch(url,{cache:'no-store'}); const parsed = await safeParseJsonResponse(r); if (parsed) return parsed; } catch(e){} return null; };

            let _prevMaster = null;
            // indicates whether a master password hash is actually configured on the server
            let masterConfigured = false;
            const populate = (settings)=>{
                const root = settings || {};
                const s = (root && root.security) ? root.security : root;
                try{
                    // Ensure aws widgets are (re)initialized before populating values so setVal works reliably
                    try{ if (window.SP_params && typeof window.SP_params.initAwsWidgets === 'function') window.SP_params.initAwsWidgets(area); }catch(e){}
                    const setVal = (id, val) => {
                        // if caller passed an array (e.g., password_blacklist), convert to string
                        if (Array.isArray(val)) val = val.join(',');
                        if (window.SP_params && typeof window.SP_params.setVal === 'function') return window.SP_params.setVal(id, val);
                        const el = document.getElementById(id);
                        if (!el) return;
                        try{
                            const toSet = (val===undefined || val===null) ? '' : val;
                            if ('value' in el) el.value = toSet; else el.setAttribute && el.setAttribute('value', toSet);
                            try{ el.dispatchEvent(new Event('input')); }catch(e){}
                            try{ el.dispatchEvent(new Event('value-changed')); }catch(e){}
                        }catch(e){
                            try{
                                const toSet = (val===undefined || val===null) ? '' : val;
                                el.setAttribute && el.setAttribute('value', toSet);
                                try{ el.dispatchEvent(new Event('input')); }catch(_){}
                                try{ el.dispatchEvent(new Event('value-changed')); }catch(_){}
                            }catch(_){}
                        }
                    };
                    const setBool = (id, val) => {
                        if (window.SP_params && typeof window.SP_params.setBool === 'function') return window.SP_params.setBool(id, val);
                        const el = document.getElementById(id);
                        if (!el) return;
                        try{ if ('value' in el) el.value = !!val; else el.setAttribute && el.setAttribute('value', !!val); try{ el.dispatchEvent(new Event('change')); }catch(e){} try{ el.dispatchEvent(new Event('value-changed')); }catch(e){} }catch(e){ try{ el.setAttribute && el.setAttribute('value', !!val); try{ el.dispatchEvent(new Event('change')); }catch(_){} try{ el.dispatchEvent(new Event('value-changed')); }catch(_){} }catch(_){} }
                    };
                    setVal('security-auto_lock_minutes', s.auto_lock_minutes || 5);
                    setBool('security-master_password_enabled', s.master_password_enabled);
                    setBool('security-require_password_on_export', s.require_password_on_export);
                    // detailed policy fields handled separately
                    setVal('security-password_min_length', (typeof s.password_min_length !== 'undefined') ? s.password_min_length : 12);
                    setBool('security-require_uppercase', s.require_uppercase);
                    setBool('security-require_lowercase', s.require_lowercase);
                    setBool('security-require_numbers', s.require_numbers);
                    setBool('security-require_symbols', s.require_symbols);
                    try{ if (Array.isArray(s.password_blacklist)) setVal('security-password_blacklist', s.password_blacklist.join(',')); else setVal('security-password_blacklist', s.password_blacklist || ''); }catch(e){ setVal('security-password_blacklist',''); }
                    setVal('security-password_history_length', (typeof s.password_history_length !== 'undefined') ? s.password_history_length : 5);
                    setVal('security-strength_threshold_red', (typeof s.strength_threshold_red !== 'undefined') ? s.strength_threshold_red : 20);
                    setVal('security-strength_threshold_orange', (typeof s.strength_threshold_orange !== 'undefined') ? s.strength_threshold_orange : 45);
                    setVal('security-strength_threshold_yellow', (typeof s.strength_threshold_yellow !== 'undefined') ? s.strength_threshold_yellow : 75);
                    // ensure aws-input widgets reflect newly set values visually
                    try{ if (window.SP_params && typeof window.SP_params.initAwsWidgets === 'function') window.SP_params.initAwsWidgets(area); }catch(e){}
                    // diagnostic log: inspect aws-input upgrade/state
                    try{ const ids = ['security-auto_lock_minutes','security-master_password_enabled','security-password_min_length','security-password_blacklist','security-strength_threshold_red']; ids.forEach(id=>{ const el=document.getElementById(id); if (!el) return; if (window.SP_params && window.SP_params._setDiag) window.SP_params._setDiag(id, el); }); }catch(e){}
                    // widgets were initialized before populating; no further init here
                    // trigger input events so threshold bar updates
                    try{ ['security-strength_threshold_red','security-strength_threshold_orange','security-strength_threshold_yellow'].forEach(id=>{ const el = document.getElementById(id); if (el) el.dispatchEvent(new Event('input')); });
                        // ensure the visual bar positions are recalculated after layout -- find wrapper and call its updateBar if present
                        try{
                            const any = document.getElementById('security-strength_threshold_red') || document.getElementById('security-strength_threshold_orange') || document.getElementById('security-strength_threshold_yellow');
                            if (any){ const barWrap = any.parentElement && any.parentElement.parentElement ? any.parentElement.parentElement : null; const wrapper = barWrap && barWrap.parentElement ? barWrap.parentElement : null; if (wrapper && typeof wrapper.updateBar === 'function'){ try{ window.requestAnimationFrame(()=>{ try{ wrapper.updateBar(); }catch(e){} }); }catch(e){} } }
                        }catch(e){}
                    }catch(e){}
                    // helper: ensure aws-input internal native input reflects a string value
                    const ensureWidgetValue = (id, value)=>{
                        try{
                            const el = document.getElementById(id);
                            if (!el) return;
                            const v = Array.isArray(value) ? value.join(',') : (value===undefined || value===null ? '' : String(value));
                            try{ if (el.setAttribute) el.setAttribute('value', v); }catch(e){}
                            try{ if ('value' in el) el.value = v; }catch(e){}
                            // attempt to write to inner native input after the custom element is upgraded
                            setTimeout(()=>{
                                try{
                                    const target = document.getElementById(id) || el;
                                    const inner = (target && target.shadowRoot && target.shadowRoot.querySelector) ? target.shadowRoot.querySelector('input,textarea') : (target && target.querySelector ? target.querySelector('input,textarea') : null);
                                    if (inner){ inner.value = v; inner.dispatchEvent(new Event('input', { bubbles:true })); inner.dispatchEvent(new Event('change', { bubbles:true })); }
                                }catch(e){}
                            },50);
                        }catch(e){}
                    };
                    _prevMaster = !!(s.master_password_enabled || root.master_password_enabled);
                    // server-reported flag indicating whether a master hash exists
                    try{ masterConfigured = !!(root.master_password_configured || s.master_password_configured); }catch(e){ masterConfigured = false; }
                    // ensure blacklist displays even if widget upgraded/replaced
                    try{ ensureWidgetValue('security-password_blacklist', s.password_blacklist); }catch(e){}
                    // apply general widget values so they display immediately (handles aws-input inner inputs)
                    try{
                        if (window.SP_params && typeof window.SP_params.applyValueToWidget === 'function'){
                            window.SP_params.applyValueToWidgetEdit('security-auto_lock_minutes', s.auto_lock_minutes || 5);
                            window.SP_params.applyValueToWidgetEdit('security-password_min_length', (typeof s.password_min_length !== 'undefined') ? s.password_min_length : 12);
                            window.SP_params.applyValueToWidgetEdit('security-password_history_length', (typeof s.password_history_length !== 'undefined') ? s.password_history_length : 5);
                            window.SP_params.applyValueToWidgetEdit('security-strength_threshold_red', (typeof s.strength_threshold_red !== 'undefined') ? s.strength_threshold_red : 20);
                            window.SP_params.applyValueToWidgetEdit('security-strength_threshold_orange', (typeof s.strength_threshold_orange !== 'undefined') ? s.strength_threshold_orange : 45);
                            window.SP_params.applyValueToWidgetEdit('security-strength_threshold_yellow', (typeof s.strength_threshold_yellow !== 'undefined') ? s.strength_threshold_yellow : 75);
                        }
                    }catch(e){}
                    // reflect dependent controls state
                    try{ if (typeof updateDependentControls === 'function') updateDependentControls(); }catch(e){}
                    // ensure action buttons (Change/Reset) reflect current master enabled state
                    try{ if (typeof refreshButtons === 'function') refreshButtons(); }catch(e){}
                    // re-attach master control listeners and ensure actions are in the correct container
                    try{
                        const masterNow = document.getElementById('security-master_password_enabled');
                        if (masterNow){
                            try{ const pv2 = masterNow.closest && masterNow.closest('.param-value') ? masterNow.closest('.param-value') : (masterNow.parentElement || masterNow); if (pv2 && pv2.classList) pv2.classList.add('param-control-wrap'); }catch(e){}
                            try{ if (typeof refreshButtons === 'function'){ masterNow.addEventListener('change', refreshButtons); masterNow.addEventListener('value-changed', refreshButtons); } }catch(e){}
                            try{ if (typeof handleToggle === 'function'){ masterNow.addEventListener('change', handleToggle); masterNow.addEventListener('value-changed', handleToggle); } }catch(e){}
                        }
                    }catch(e){}
                }catch(e){ console.error('populate security', e); }
            };

            // Enable/disable dependent controls when master password is toggled
                    // keep dependent controls always enabled (we manage policy via explicit params)
                    const updateDependentControls = ()=>{ return; };

            // attach listeners after elements exist
            try{
                const masterEl = document.getElementById('security-master_password_enabled');
                if (masterEl){
                    masterEl.addEventListener('change', updateDependentControls);
                    masterEl.addEventListener('value-changed', updateDependentControls);
                    // intercept toggle to show/create/verify flows
                    const handleToggle = async ()=>{
                        try{
                            const cur = parseBool(getVal('security-master_password_enabled'));
                            if (_prevMaster === null){ _prevMaster = cur; return; }
                            if (! _prevMaster && cur){
                                // enabling: open create modal
                                const res = await showSetMasterModal();
                                            if (!res || !res.ok){ // revert
                                                try{ const _el = document.getElementById('security-master_password_enabled'); if(_el){ if('value' in _el) _el.value = false; else _el.setAttribute && _el.setAttribute('value', false); } }catch(e){}
                                            }
                                _prevMaster = !!getVal('security-master_password_enabled');
                                updateDependentControls();
                            } else if (_prevMaster && !cur){
                                // disabling: verify current password
                                const res = await showDisableMasterModal();
                                if (!res || !res.ok){ // revert
                                    try{ const _el = document.getElementById('security-master_password_enabled'); if(_el){ if('value' in _el) _el.value = true; else _el.setAttribute && _el.setAttribute('value', true); } }catch(e){}
                                }
                                _prevMaster = !!getVal('security-master_password_enabled');
                                updateDependentControls();
                            }
                        }catch(e){ console.error('master toggle handler', e); }
                    };
                    try{ masterEl.addEventListener('change', handleToggle); masterEl.addEventListener('value-changed', handleToggle); }catch(e){}
                }
            }catch(e){}

            // Create styled modal helper
            const createModal = (titleHtml, contentEl) => {
                const overlay = document.createElement('div'); overlay.className = 'sp-modal-overlay';
                overlay.style.position = 'fixed'; overlay.style.left='0'; overlay.style.top='0'; overlay.style.width='100%'; overlay.style.height='100%'; overlay.style.zIndex='100000'; overlay.style.display='flex'; overlay.style.alignItems='center'; overlay.style.justifyContent='center'; overlay.style.background='rgba(0,0,0,0.6)';
                const box = document.createElement('div'); box.style.background='var(--sp-panel-bg)'; box.style.color='var(--sp-panel-text)'; box.style.padding='18px'; box.style.borderRadius='10px'; box.style.minWidth='320px'; box.style.maxWidth='90%'; box.style.boxShadow='0 20px 60px rgba(0,0,0,0.6)';
                const title = document.createElement('div'); title.className='params-category-title'; title.innerHTML = titleHtml; box.appendChild(title);
                box.appendChild(contentEl);
                overlay.appendChild(box);
                return { overlay, box };
            };

            // Show modal and return a promise resolved when closed
            const showModal = (modalObj)=>{
                return new Promise((resolve)=>{
                    document.body.appendChild(modalObj.overlay);
                    const close = (result)=>{ try{ modalObj.overlay.remove(); }catch(e){} resolve(result); };
                    modalObj.close = close;
                });
            };

            // Master password workflows
            const showSetMasterModal = async ()=>{
                const wrapper = document.createElement('div');
                const p1 = document.createElement('aws-input'); p1.setAttribute('type','password'); p1.setAttribute('mode','edit'); p1.setAttribute('value',''); p1.setAttribute('placeholder', (window.t && window.t('new_master_password')) || 'New master password'); p1.style.marginBottom='8px';
                const p2 = document.createElement('aws-input'); p2.setAttribute('type','password'); p2.setAttribute('mode','edit'); p2.setAttribute('value',''); p2.setAttribute('placeholder', (window.t && window.t('confirm_password')) || 'Confirm password'); p2.style.marginBottom='8px';
                const err = document.createElement('div'); err.style.color='#ff6b6b'; err.style.minHeight='18px'; err.style.marginBottom='8px';
                const actions = document.createElement('div'); actions.className='form-actions';
                const btnOk = document.createElement('aws-button'); btnOk.setAttribute('variant','primary'); btnOk.textContent=(window.t && window.t('set'))||'Set';
                const btnCancel = document.createElement('aws-button'); btnCancel.textContent=(window.t && window.t('cancel'))||'Cancel';
                actions.appendChild(btnOk); actions.appendChild(btnCancel);
                wrapper.appendChild(p1); wrapper.appendChild(p2); wrapper.appendChild(err); wrapper.appendChild(actions);
                const modal = createModal((window.t && window.t('create_master_password')) || 'Create Master Password', wrapper);
                const prom = showModal(modal);
                btnCancel.addEventListener('click', ()=> modal.close({ok:false}));
                btnOk.addEventListener('click', async ()=>{
                    err.textContent='';
                    if (!p1.value){ err.textContent=(window.t && window.t('password_required'))||'Password required'; return; }
                    if (p1.value !== p2.value){ err.textContent=(window.t && window.t('passwords_do_not_match'))||'Passwords do not match'; return; }
                    try{
                        const r = await fetch(adminUrl('/admin/master_password'), { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ password: p1.value }) });
                        if (r.ok){ modal.close({ok:true}); loadSettings().then(j=>{ if(j && j.settings) populate(j.settings); else populate(j); }).finally(()=>{ try{ saveBtn.dispatchEvent(new Event('click')); }catch(e){} }); }
                        else { const j = await r.json().catch(()=>null); err.textContent = j && j.error ? j.error : 'Error'; }
                    }catch(e){ err.textContent=(window.t && window.t('network_error'))||'Network error'; }
                });
                return prom;
            };

            const showChangeMasterModal = async ()=>{
                const wrapper = document.createElement('div');
                const oldp = document.createElement('aws-input'); oldp.setAttribute('type','password'); oldp.setAttribute('mode','edit'); oldp.setAttribute('value',''); oldp.setAttribute('placeholder',(window.t && window.t('current_password'))||'Current password'); oldp.style.marginBottom='8px';
                const p1 = document.createElement('aws-input'); p1.setAttribute('type','password'); p1.setAttribute('mode','edit'); p1.setAttribute('value',''); p1.setAttribute('placeholder',(window.t && window.t('new_password'))||'New password'); p1.style.marginBottom='8px';
                const p2 = document.createElement('aws-input'); p2.setAttribute('type','password'); p2.setAttribute('mode','edit'); p2.setAttribute('value',''); p2.setAttribute('placeholder',(window.t && window.t('confirm_new_password'))||'Confirm new password'); p2.style.marginBottom='8px';
                const err = document.createElement('div'); err.style.color='#ff6b6b'; err.style.minHeight='18px'; err.style.marginBottom='8px';
                const actions = document.createElement('div'); actions.className='form-actions';
                const btnOk = document.createElement('aws-button'); btnOk.setAttribute('variant','primary'); btnOk.textContent=(window.t && window.t('change'))||'Change';
                const btnCancel = document.createElement('aws-button'); btnCancel.textContent=(window.t && window.t('cancel'))||'Cancel';
                actions.appendChild(btnOk); actions.appendChild(btnCancel);
                wrapper.appendChild(oldp); wrapper.appendChild(p1); wrapper.appendChild(p2); wrapper.appendChild(err); wrapper.appendChild(actions);
                const modal = createModal((window.t && window.t('change_master_password')) || 'Change Master Password', wrapper);
                const prom = showModal(modal);
                btnCancel.addEventListener('click', ()=> modal.close({ok:false}));
                btnOk.addEventListener('click', async ()=>{
                    err.textContent='';
                    if (!oldp.value || !p1.value){ err.textContent=(window.t && window.t('fields_required'))||'Fields required'; return; }
                    if (p1.value !== p2.value){ err.textContent=(window.t && window.t('passwords_do_not_match'))||'Passwords do not match'; return; }
                    try{
                        const r = await fetch(adminUrl('/admin/master_password/change'), { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ old_password: oldp.value, new_password: p1.value }) });
                        if (r.ok){ modal.close({ok:true}); loadSettings().then(j=>{ if(j && j.settings) populate(j.settings); else populate(j); }).finally(()=>{ try{ saveBtn.dispatchEvent(new Event('click')); }catch(e){} }); }
                        else { const j = await r.json().catch(()=>null); err.textContent = j && j.error ? j.error : 'Error'; }
                    }catch(e){ err.textContent=(window.t && window.t('network_error'))||'Network error'; }
                });
                return prom;
            };

            const showDisableMasterModal = async ()=>{
                const wrapper = document.createElement('div');
                const cur = document.createElement('aws-input'); cur.setAttribute('type','password'); cur.setAttribute('mode','edit'); cur.setAttribute('value',''); cur.setAttribute('placeholder',(window.t && window.t('current_master_password'))||'Current master password'); cur.style.marginBottom='8px';
                const err = document.createElement('div'); err.style.color='#ff6b6b'; err.style.minHeight='18px'; err.style.marginBottom='8px';
                const actions = document.createElement('div'); actions.className='form-actions';
                const btnOk = document.createElement('aws-button'); btnOk.setAttribute('variant','primary'); btnOk.textContent=(window.t && window.t('disable'))||'Disable';
                const btnCancel = document.createElement('aws-button'); btnCancel.textContent=(window.t && window.t('cancel'))||'Cancel';
                actions.appendChild(btnOk); actions.appendChild(btnCancel);
                wrapper.appendChild(cur); wrapper.appendChild(err); wrapper.appendChild(actions);
                const modal = createModal((window.t && window.t('disable_master_password')) || 'Disable Master Password', wrapper);
                const prom = showModal(modal);
                btnCancel.addEventListener('click', ()=> modal.close({ok:false}));
                btnOk.addEventListener('click', async ()=>{
                    err.textContent=''; if (!cur.value){ err.textContent=(window.t && window.t('password_required'))||'Password required'; return; }
                    try{
                        const r = await fetch(adminUrl('/auth/unlock'), { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ password: cur.value }) });
                        if (r.ok){ const j = await r.json(); if (j && j.status === 'ok'){ modal.close({ok:true}); // dispatch save to persist master disabled state
                                    try{ saveBtn.dispatchEvent(new Event('click')); }catch(e){}
                                    return; } }
                        err.textContent=(window.t && window.t('invalid_password'))||'Invalid password';
                    }catch(e){ err.textContent=(window.t && window.t('network_error'))||'Network error'; }
                });
                return prom;
            };

            const showResetModal = async ()=>{
                const wrapper = document.createElement('div');
                const info = document.createElement('div'); info.textContent=(window.t && window.t('reset_master_info'))||'Reset will clear stored master password and disable it (local only).'; info.style.marginBottom='12px';
                const err = document.createElement('div'); err.style.color='#ff6b6b'; err.style.minHeight='18px'; err.style.marginBottom='8px';
                const actions = document.createElement('div'); actions.className='form-actions';
                const btnOk = document.createElement('aws-button'); btnOk.setAttribute('variant','primary'); btnOk.textContent=(window.t && window.t('reset'))||'Reset';
                const btnCancel = document.createElement('aws-button'); btnCancel.textContent=(window.t && window.t('cancel'))||'Cancel';
                actions.appendChild(btnOk); actions.appendChild(btnCancel);
                wrapper.appendChild(info); wrapper.appendChild(err); wrapper.appendChild(actions);
                const modal = createModal((window.t && window.t('reset_master_password')) || 'Reset Master Password', wrapper);
                const prom = showModal(modal);
                btnCancel.addEventListener('click', ()=> modal.close({ok:false}));
                btnOk.addEventListener('click', async ()=>{
                    err.textContent='';
                    try{
                        const r = await fetch(adminUrl('/admin/master_password/reset'), { method: 'POST' });
                        if (r.ok){ modal.close({ok:true}); loadSettings().then(j=>{ if(j && j.settings) populate(j.settings); else populate(j); }).finally(()=>{ try{ saveBtn.dispatchEvent(new Event('click')); }catch(e){} }); }
                        else { const j = await r.json().catch(()=>null); err.textContent = j && j.error ? j.error : 'Error'; }
                    }catch(e){ err.textContent=(window.t && window.t('network_error'))||'Network error'; }
                });
                return prom;
            };

            // create aws-button controls next to master element
            try{
                const masterWrap = document.getElementById('security-master_password_enabled');
                if (masterWrap){
                    const container = document.createElement('div'); container.className='param-actions';
                    const btnChange = document.createElement('aws-button'); btnChange.setAttribute('size','sm');
                    const btnReset = document.createElement('aws-button'); btnReset.setAttribute('size','sm'); btnReset.textContent=(window.t && window.t('reset'))||'Reset';
                    container.appendChild(btnChange); container.appendChild(btnReset);
                        const pv = masterWrap.closest && masterWrap.closest('.param-value') ? masterWrap.closest('.param-value') : (masterWrap.parentElement || masterWrap);
                        // ensure the value cell uses the control-wrap layout so actions sit inline
                        try{ if (pv && pv.classList) pv.classList.add('param-control-wrap'); }catch(e){}
                        // avoid appending duplicate action containers
                        if (!pv.querySelector || !pv.querySelector('.param-actions')) pv.appendChild(container);
                    btnChange.addEventListener('click', async ()=>{ 
                        if (masterConfigured){ await showChangeMasterModal(); }
                        else { await showSetMasterModal(); }
                        updateDependentControls(); 
                    });
                    btnReset.addEventListener('click', async ()=>{ await showResetModal(); updateDependentControls(); });

                    // disable/enable these buttons based on master flag
                    const refreshButtons = ()=>{ 
                        try{
                            const master = parseBool(getVal('security-master_password_enabled'));
                            // set both property and attributes to cover widget implementations
                            try{ btnChange.disabled = !master; btnReset.disabled = !master; }catch(e){}
                            // if no configured hash exists, or master toggle is off, disable actions
                            if(!master || !masterConfigured){ 
                                try{ btnChange.setAttribute('disabled',''); }catch(e){}
                                try{ btnReset.setAttribute('disabled',''); }catch(e){}
                                try{ btnChange.setAttribute('aria-disabled','true'); btnReset.setAttribute('aria-disabled','true'); }catch(e){}
                            } else { 
                                try{ btnChange.removeAttribute('disabled'); }catch(e){}
                                try{ btnReset.removeAttribute('disabled'); }catch(e){}
                                try{ btnChange.removeAttribute('aria-disabled'); btnReset.removeAttribute('aria-disabled'); }catch(e){}
                            }
                            // update change button label depending on configured state
                            try{ if (masterConfigured) btnChange.textContent = (window.t && window.t('change'))||'Change'; else btnChange.textContent = (window.t && window.t('set'))||'Set'; }catch(e){}
                            // debug output to help diagnose if still wrong
                            
                        }catch(e){ console.error('refreshButtons error', e); }
                    };
                    try{ refreshButtons(); }catch(e){}
                    // ensure they update when master toggled
                    try{ masterWrap.addEventListener('change', refreshButtons); masterWrap.addEventListener('value-changed', refreshButtons); }catch(e){}
                }
            }catch(e){ console.error('master buttons init', e); }

            loadSettings().then(j=>{ if(j && j.settings) populate(j.settings); else populate(j); }).catch(e=>{ console.warn('Could not load settings', e); populate({}); });

                saveBtn.addEventListener('click', function(){
                status.textContent = (window.t && window.t('saving')) || 'Saving...';
                const updates = {
                    auto_lock_minutes: parseInt(getVal('security-auto_lock_minutes') || 5,10),
                    master_password_enabled: !!getVal('security-master_password_enabled'),
                    require_password_on_export: !!getVal('security-require_password_on_export'),
                    password_min_length: parseInt(getVal('security-password_min_length') || 12,10),
                    require_uppercase: !!getVal('security-require_uppercase'),
                    require_lowercase: !!getVal('security-require_lowercase'),
                    require_numbers: !!getVal('security-require_numbers'),
                    require_symbols: !!getVal('security-require_symbols'),
                    password_blacklist: (function(){ const v = getVal('security-password_blacklist') || ''; return v.split(',').map(s=>s.trim()).filter(Boolean); })(),
                    password_history_length: parseInt(getVal('security-password_history_length') || 5,10)
                };

                // validate thresholds ordering: red < orange < yellow
                updates.strength_threshold_red = parseInt(getVal('security-strength_threshold_red') || 20, 10);
                updates.strength_threshold_orange = parseInt(getVal('security-strength_threshold_orange') || 45, 10);
                updates.strength_threshold_yellow = parseInt(getVal('security-strength_threshold_yellow') || 75, 10);
                if (!(updates.strength_threshold_red < updates.strength_threshold_orange && updates.strength_threshold_orange < updates.strength_threshold_yellow)){
                    status.textContent = (window.t && window.t('invalid_thresholds')) || 'Invalid thresholds (must be red < orange < yellow)';
                    return;
                }


                // Enforce dependency: if master password disabled, disable auto-lock and export-password
                if (!updates.master_password_enabled){
                    updates.auto_lock_minutes = 0;
                    updates.require_password_on_export = false;
                }
                const proto = window.location.protocol; const host = window.location.hostname; const isFrontendDev = (window.location.port === '3000'); const backendBase = `${proto}//${host}:5000`;
                const settingsGetUrl = isFrontendDev ? (backendBase + '/settings') : '/settings';
                const settingsPostUrl = isFrontendDev ? (backendBase + '/settings') : '/settings';

                const doSave = (window.SP_saveSettings && typeof window.SP_saveSettings === 'function') ? window.SP_saveSettings : (window.SP_params && window.SP_params.saveSettings) ? window.SP_params.saveSettings : null;
                const doCategorySave = (window.SP_saveCategorySettings && typeof window.SP_saveCategorySettings === 'function') ? (vals => window.SP_saveCategorySettings('security', vals)) : (window.SP_params && typeof window.SP_params.saveCategorySettings === 'function') ? (vals => window.SP_params.saveCategorySettings('security', vals)) : null;

                if (doCategorySave){
                    (async function(){
                        try{
                            const resp = await doCategorySave(updates);
                            if (resp && resp.status === 'ok'){
                                status.textContent = (window.t && window.t('saved')) || 'Saved';
                                setTimeout(()=>{ status.textContent=''; try{ window.location.reload(); }catch(e){ location.reload(); } }, 700);
                            } else { status.textContent = (window.t && window.t('error')) || 'Error'; console.warn(resp); }
                        }catch(e){ status.textContent = (window.t && window.t('error')) || 'Error'; console.error(e); }
                    })();
                } else if (doSave){
                    (async function(){
                        try{
                            const resp = await doSave(updates);
                            if (resp && resp.status === 'ok'){
                                status.textContent = (window.t && window.t('saved')) || 'Saved';
                                setTimeout(()=>{ status.textContent=''; try{ window.location.reload(); }catch(e){ location.reload(); } }, 700);
                            } else { status.textContent = (window.t && window.t('error')) || 'Error'; console.warn(resp); }
                        }catch(e){ status.textContent = (window.t && window.t('error')) || 'Error'; console.error(e); }
                    })();
                } else {
                    status.textContent = (window.t && window.t('error')) || 'Error';
                }
            });
        })();
    };
})();