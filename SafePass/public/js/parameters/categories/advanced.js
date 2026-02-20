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

    window.SP_render_advanced = function(area){
        area.innerHTML = '<div class="loading" data-i18n="loading_settings">Chargement des paramètres...</div>';
        (function init(){
            area.innerHTML = '';
            const wrap = el('div',{class:'params-form'});
            const head = el('h3'); head.setAttribute('data-i18n','advanced'); head.textContent = window.t ? window.t('advanced') : 'Advanced';
            wrap.appendChild(head);
            const grid = el('div',{class:'params-grid'});

            const addRow = (key, label, control) => {
                const row = el('div',{class:'param-row'});
                const name = el('div',{class:'param-name'});
                name.setAttribute('data-i18n', label);
                name.textContent = window.t ? window.t(label) : label;
                const val = el('div',{class:'param-value'});
                val.appendChild(control);
                try{ if (control && control.classList && control.classList.contains('path-input-wrap')) val.classList.add('param-control-wrap'); }catch(e){}
                row.appendChild(name); row.appendChild(val);
                grid.appendChild(row);
            };

            const makeNumber = (id, min, max, value) => { if (window.SP_params && window.SP_params.makeNumber) return window.SP_params.makeNumber(id,min,max,value,'120px'); const n = document.createElement('aws-input'); n.id = id; n.setAttribute('type','number'); n.setAttribute('mode','edit'); if(min!==undefined) n.setAttribute('min',String(min)); if(max!==undefined) n.setAttribute('max',String(max)); if(value!==undefined) n.setAttribute('value',String(value)); n.style='width:120px'; return n; };
            const makeBool = (id)=>{ if (window.SP_params && window.SP_params.makeBool) return window.SP_params.makeBool(id); const b = document.createElement('aws-bool'); b.id = id; b.setAttribute('mode','edit'); return b; };
            const makeSelector = (id, options)=>{ if (window.SP_params && window.SP_params.makeSelector) return window.SP_params.makeSelector(id, options); const s = document.createElement('aws-selector'); s.id = id; s.setAttribute('mode','edit'); (options||[]).forEach(o=>{ const opt = document.createElement('aws-option'); opt.setAttribute('data-id', o.id); opt.textContent = o.label; s.appendChild(opt); }); return s; };

            // Log settings (moved to Advanced UI): controls and defaults
            addRow('log_level','log_level', makeSelector('advanced-log_level', [
                {id:'ERROR', label:'ERROR'}, {id:'WARN', label:'WARN'}, {id:'INFO', label:'INFO'}, {id:'DEBUG', label:'DEBUG'}
            ]));
            addRow('log_to_file','log_to_file', makeBool('advanced-log_to_file'));
            addRow('log_file_path','log_file_path', (function(){ return (window.SP_params && window.SP_params.makePathInput) ? window.SP_params.makePathInput('advanced-log_file_path','logs/safepass.log',{directory:false}) : (function(){ const i = document.createElement('aws-input'); i.id='advanced-log_file_path'; i.setAttribute('mode','edit'); i.setAttribute('value','logs/safepass.log'); return i; })(); })());
            addRow('max_log_size_mb','max_log_size_mb', makeNumber('advanced-max_log_size_mb', 1, 1024, 5));
            addRow('log_retention_days','log_retention_days', makeNumber('advanced-log_retention_days', 0, 3650, 30));

            wrap.appendChild(grid);

            const actions = el('div',{class:'form-actions'});
            const saveBtn = document.createElement('aws-button'); saveBtn.id = 'advanced-save'; saveBtn.setAttribute('variant','primary'); saveBtn.setAttribute('size','md'); saveBtn.setAttribute('data-i18n','save'); saveBtn.textContent = (window.t && window.t('save')) || 'Save';
            const status = el('span',{id:'advanced-status', style:'margin-left:12px;color:var(--sp-panel-text)'});
            actions.appendChild(saveBtn); actions.appendChild(status);
            wrap.appendChild(actions);

            area.appendChild(wrap);

            const getVal = (id) => {
                if (window.SP_params && window.SP_params.getVal) return window.SP_params.getVal(id);
                const el = document.getElementById(id); if (!el) return null;
                try{ const tag = el.tagName && el.tagName.toLowerCase(); if (tag === 'aws-selector') { if ('value' in el && el.value !== undefined && el.value !== null && String(el.value).trim() !== '') return el.value; const attrVal = el.getAttribute && el.getAttribute('value'); if (attrVal && String(attrVal).trim() !== '') return attrVal; const opts = Array.from(el.querySelectorAll && el.querySelectorAll('aws-option') || []); let sel = opts.find(o => o.hasAttribute('selected')) || opts.find(o => o.getAttribute('data-selected') === 'true') || opts.find(o => o.getAttribute('selected') === 'true') || opts.find(o => o.getAttribute('aria-selected') === 'true') || opts.find(o => (o.classList && o.classList.contains && o.classList.contains('selected'))); if (!sel && opts.length === 1) sel = opts[0]; if (sel) return sel.getAttribute('data-id') || sel.getAttribute('value') || (sel.textContent && sel.textContent.trim()); for (const o of opts) { if (o.dataset && o.dataset.id) return o.dataset.id; } return null; } if (tag && tag.startsWith('aws-')) { if ('value' in el) return el.value; return el.getAttribute && el.getAttribute('value'); } if ('checked' in el) return el.checked; return el.value; }catch(e){ console.error('getVal error', e); return null; }
            };

            const setVal = (id, val) => { if (window.SP_params && window.SP_params.setVal) return window.SP_params.setVal(id, val); const el = document.getElementById(id); if (!el) return; try{ if ('value' in el) el.value = (val===undefined || val===null) ? '' : val; else el.setAttribute && el.setAttribute('value', val); try{ el.dispatchEvent(new Event('input')); }catch(e){} try{ el.dispatchEvent(new Event('value-changed')); }catch(e){} }catch(e){ try{ el.setAttribute && el.setAttribute('value', val); }catch(_){} } };
            const setBool = (id, val) => { if (window.SP_params && window.SP_params.setBool) return window.SP_params.setBool(id, val); const el = document.getElementById(id); if (!el) return; try{ if ('value' in el) el.value = !!val; else el.setAttribute && el.setAttribute('value', !!val); try{ el.dispatchEvent(new Event('change')); }catch(e){} try{ el.dispatchEvent(new Event('value-changed')); }catch(e){} }catch(e){ try{ el.setAttribute && el.setAttribute('value', !!val); }catch(_){} } };

            const loadSettings = async () => { if (window.SP_params && window.SP_params.loadSettings) return window.SP_params.loadSettings(); const safeParseJsonResponse = async (res) => { if (!res || !res.ok) return null; const ct = (res.headers.get('content-type')||'').toLowerCase(); if (ct.indexOf('application/json') !== -1) return await res.json(); try { const txt = await res.text(); return JSON.parse(txt); } catch(e){ return null; } }; try { const url = '/settings'; const r = await fetch(url,{cache:'no-store'}); const parsed = await safeParseJsonResponse(r); if (parsed) return parsed; } catch(e){} return null; };

            const populate = (settings)=>{
                const s = settings || {};
                try{
                    const st = s.storage || s;
                    setVal('advanced-log_level', st.log_level || s.log_level || 'INFO');
                    setBool('advanced-log_to_file', (typeof st.log_to_file !== 'undefined') ? st.log_to_file : (typeof s.log_to_file !== 'undefined' ? s.log_to_file : false));
                    setVal('advanced-log_file_path', st.log_file_path || s.log_file_path || 'logs/safepass.log');
                    setVal('advanced-max_log_size_mb', (typeof st.max_log_size_mb !== 'undefined') ? st.max_log_size_mb : (typeof s.max_log_size_mb !== 'undefined' ? s.max_log_size_mb : 5));
                    setVal('advanced-log_retention_days', (typeof st.log_retention_days !== 'undefined') ? st.log_retention_days : (typeof s.log_retention_days !== 'undefined' ? s.log_retention_days : 30));
                    try{ if (window.SP_params && typeof window.SP_params.initAwsWidgets === 'function') window.SP_params.initAwsWidgets(area); }catch(e){}
                }catch(e){ console.error('populate advanced', e); }
            };

            loadSettings().then(j=>{ if(j && j.settings) populate(j.settings); else populate(j); }).catch(e=>{ console.warn('Could not load settings', e); populate({}); });

            saveBtn.addEventListener('click', function(){
                status.textContent = (window.t && window.t('saving')) || 'Saving...';
                const updates = {
                    storage: {
                        log_to_file: !!getVal('advanced-log_to_file'),
                        log_file_path: getVal('advanced-log_file_path') || 'logs/safepass.log',
                        log_level: getVal('advanced-log_level') || 'INFO',
                        max_log_size_mb: parseInt(getVal('advanced-max_log_size_mb') || 5,10),
                        log_retention_days: parseInt(getVal('advanced-log_retention_days') || 30,10)
                    }
                };
                const doSave = (window.SP_saveSettings && typeof window.SP_saveSettings === 'function') ? window.SP_saveSettings : (window.SP_params && window.SP_params.saveSettings) ? window.SP_params.saveSettings : null;
                if (doSave){ (async function(){ try{ const resp = await doSave(updates); if (resp && resp.status === 'ok'){ status.textContent = (window.t && window.t('saved')) || 'Saved'; setTimeout(()=>{ status.textContent=''; try{ window.location.reload(); }catch(e){ location.reload(); } }, 700); } else { status.textContent = (window.t && window.t('error')) || 'Error'; console.warn(resp); } }catch(e){ status.textContent = (window.t && window.t('error')) || 'Error'; console.error(e); } })(); } else { status.textContent = (window.t && window.t('error')) || 'Error'; }
            });
        })();
    };
})();