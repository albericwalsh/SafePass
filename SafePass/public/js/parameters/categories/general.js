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

    window.SP_render_general = function(area){
        area.innerHTML = '<div class="loading" data-i18n="loading_settings">Chargement des paramètres...</div>';

        (function init(){
            // build UI using aws-widgets elements only (no native fallbacks)
            area.innerHTML = '';
            const wrap = el('div',{class:'params-form'});
            const head = el('h3'); head.setAttribute('data-i18n','general'); head.textContent = window.t ? window.t('general') : 'General';
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

            // language selector (reuse common helper if available)
            const makeLangSelector = () => {
                const options = [{id:'fr', label:'Français'}, {id:'en', label:'English'}];
                if (window.SP_params && window.SP_params.makeSelector) return window.SP_params.makeSelector('general-language', options);
                const s = document.createElement('aws-selector'); s.id = 'general-language'; s.setAttribute('mode','edit');
                options.forEach(o=>{ const opt = document.createElement('aws-option'); opt.setAttribute('data-id', o.id); opt.textContent = o.label; s.appendChild(opt); });
                return s;
            };
            addRow('language','language', makeLangSelector());

            // booleans using aws-bool (reuse helper when available)
            const makeBool = (id, disabled) => {
                if (window.SP_params && window.SP_params.makeBool){ const b = window.SP_params.makeBool(id); if (disabled) try { b.setAttribute('disabled',''); } catch(e){} return b; }
                const b = document.createElement('aws-bool'); b.id = id; b.setAttribute('mode','edit'); if (disabled) try { b.setAttribute('disabled',''); } catch(e){} return b;
            };
            addRow('start_on_boot','start_on_boot', makeBool('general-start_on_boot'));
            addRow('auto_update_check','auto_update_check', makeBool('general-auto_update_check', true));
            addRow('open_front_on_start','open_front_on_start', makeBool('general-open_front_on_start'));

            wrap.appendChild(grid);

            // actions (use aws-button)
            const actions = el('div',{class:'form-actions'});
            const saveBtn = document.createElement('aws-button'); saveBtn.id = 'general-save'; saveBtn.setAttribute('variant','primary'); saveBtn.setAttribute('size','md'); saveBtn.setAttribute('data-i18n','save'); saveBtn.textContent = (window.t && window.t('save')) || 'Sauvegarder';
            const status = el('span',{id:'general-status', style:'margin-left:12px;color:var(--sp-panel-text)'});
            actions.appendChild(saveBtn); actions.appendChild(status);
            wrap.appendChild(actions);

            area.appendChild(wrap);

            function populate(settings){
                try{
                    const s = settings || {};
                    const g = (s && s.general) ? s.general : s;
                    const langEl = document.getElementById('general-language');
                    if (langEl){ try {
                        const lang = g.language || s.language || 'fr';
                        if ('value' in langEl) langEl.value = lang;
                        else langEl.setAttribute && langEl.setAttribute('value', lang);
                        Array.from(langEl.querySelectorAll && langEl.querySelectorAll('aws-option') || []).forEach(opt => {
                            try{ if (opt.getAttribute('data-id') === lang) opt.setAttribute('selected',''); else opt.removeAttribute && opt.removeAttribute('selected'); }catch(e){}
                        });
                    } catch(e){} }

                    const setBool = (id, val) => {
                        if (window.SP_params && window.SP_params.setBool) return window.SP_params.setBool(id, val);
                        const el = document.getElementById(id);
                        if (!el) return;
                        try { if ('value' in el) el.value = !!val; else el.setAttribute && el.setAttribute('value', !!val); try{ el.dispatchEvent(new Event('change')); }catch(e){} try{ el.dispatchEvent(new Event('value-changed')); }catch(e){} } catch(e){ try{ el.setAttribute && el.setAttribute('value', !!val); }catch(_){} }
                    };
                    setBool('general-start_on_boot', g.start_on_boot || s.start_on_boot);
                    setBool('general-auto_update_check', g.auto_update_check || s.auto_update_check);
                    setBool('general-open_front_on_start', g.open_front_on_start || s.open_front_on_start);
                    try{ if (window.SP_params && typeof window.SP_params.initAwsWidgets === 'function') window.SP_params.initAwsWidgets(area); }catch(e){}
                }catch(e){ console.error('populate general', e); }
            }

            // Load settings from backend GET /settings only. If frontend runs on port 3000, prefer backend on port 5000.
            const loadSettings = async () => {
                const proto = window.location.protocol;
                const host = window.location.hostname;
                const isFrontendDev = (window.location.port === '3000');
                const backendBase = `${proto}//${host}:5000`;

                const safeParseJsonResponse = async (res) => {
                    if (!res || !res.ok) return null;
                    const ct = (res.headers.get('content-type')||'').toLowerCase();
                    if (ct.indexOf('application/json') !== -1) return await res.json();
                    try { const txt = await res.text(); return JSON.parse(txt); } catch(e){ return null; }
                };

                // 1) If dev, try backend on port 5000 first
                if (isFrontendDev) {
                    try {
                        const url = backendBase + '/settings';
                        console.log('[settings] GET ->', url);
                        const r = await fetch(url, {cache: 'no-store'});
                        console.log('[settings] response', url, r.status, r.statusText);
                        const parsed = await safeParseJsonResponse(r);
                        console.log('[settings] parsed', url, parsed);
                        if (parsed) return parsed;
                    } catch(e){ console.error('[settings] fetch error', e); }
                }

                // 2) Try same-origin /settings
                try {
                    const url = '/settings';
                    console.log('[settings] GET ->', url);
                    const r = await fetch(url, {cache: 'no-store'});
                    console.log('[settings] response', url, r.status, r.statusText);
                    const parsed = await safeParseJsonResponse(r);
                    console.log('[settings] parsed', url, parsed);
                    if (parsed) return parsed;
                } catch(e){ console.error('[settings] fetch error same-origin', e); }

                // 3) Final attempt: backend on port 5000
                try {
                    const url = backendBase + '/settings';
                    console.log('[settings] final GET ->', url);
                    const r2 = await fetch(url, {cache: 'no-store'});
                    console.log('[settings] response', url, r2.status, r2.statusText);
                    const parsed2 = await safeParseJsonResponse(r2);
                    console.log('[settings] parsed', url, parsed2);
                    if (parsed2) return parsed2;
                } catch(e){ console.error('[settings] final fetch error', e); }

                throw new Error('settings not found');
            };

            // load and populate (no waiting for customElements)
            loadSettings().then(j=>{ if(j && j.settings) populate(j.settings); else populate(j); }).catch(e=>{ console.warn('Could not load settings', e); populate({}); });

            // save handler uses global SP_saveSettings or common helper if available
            saveBtn.addEventListener('click', function(){
                status.textContent = (window.t && window.t('saving')) || 'Saving...';
                const getVal = (id) => {
                    const el = document.getElementById(id);
                    if (!el) return null;
                    try {
                        const tag = el.tagName && el.tagName.toLowerCase();
                        // Special handling for aws-selector which may expose value in different ways
                        if (tag === 'aws-selector') {
                            // 1) prefer property value
                            if ('value' in el && el.value !== undefined && el.value !== null && String(el.value).trim() !== '') return el.value;
                            // 2) attribute value on the selector
                            const attrVal = el.getAttribute && el.getAttribute('value');
                            if (attrVal && String(attrVal).trim() !== '') return attrVal;
                            // 3) try to find selected aws-option via several conventions
                            const opts = Array.from(el.querySelectorAll ? el.querySelectorAll('aws-option') : []);
                            let sel = opts.find(o => o.hasAttribute('selected'))
                                      || opts.find(o => o.getAttribute('data-selected') === 'true')
                                      || opts.find(o => o.getAttribute('selected') === 'true')
                                      || opts.find(o => o.getAttribute('aria-selected') === 'true')
                                      || opts.find(o => (o.classList && o.classList.contains && o.classList.contains('selected')));
                            if (!sel && opts.length === 1) sel = opts[0];
                            if (sel) {
                                return sel.getAttribute('data-id') || sel.getAttribute('value') || (sel.textContent && sel.textContent.trim());
                            }
                            // 4) last resort: try dataset
                            for (const o of opts) {
                                if (o.dataset && o.dataset.id) return o.dataset.id;
                            }
                            return null;
                        }

                        // Generic aws-* elements expose value or attribute
                        if (tag && tag.startsWith('aws-')) {
                            if ('value' in el) return el.value;
                            return el.getAttribute && el.getAttribute('value');
                        }

                        if ('checked' in el) return el.checked;
                        return el.value;
                    } catch(e){ console.error('getVal error', e); return null; }
                };

                    const values = {
                        language: getVal('general-language') || window.getLocale && window.getLocale() || 'fr',
                        start_on_boot: !!getVal('general-start_on_boot'),
                        auto_update_check: !!getVal('general-auto_update_check'),
                        open_front_on_start: !!getVal('general-open_front_on_start')
                    };

                    const doSave = (window.SP_saveCategorySettings && typeof window.SP_saveCategorySettings === 'function') ? window.SP_saveCategorySettings : null;
                    if (doSave){
                        (async function(){
                            try{
                                const resp = await doSave('general', values);
                                if (resp && resp.status === 'ok'){
                                    status.textContent = (window.t && window.t('saved')) || 'Saved';
                                    setTimeout(()=>{ status.textContent=''; try{ window.location.reload(); }catch(e){ location.reload(); } }, 700);
                                } else { status.textContent = (window.t && window.t('error')) || 'Error'; console.warn(resp); }
                            }catch(err){ status.textContent = (window.t && window.t('error')) || 'Error'; console.error(err); }
                        })();
                    } else {
                        status.textContent = (window.t && window.t('error')) || 'Error';
                    }
            });
        })();
    };
})();