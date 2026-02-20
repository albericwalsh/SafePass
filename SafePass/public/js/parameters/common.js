/* Shared helpers for parameter category renderers */
(function(){
    if (!window.SP_params) window.SP_params = {};
    

    function el(tag, attrs, children){
        const e = document.createElement(tag);
        if (attrs && typeof attrs === 'object' && !Array.isArray(attrs)){
            Object.keys(attrs).forEach(k=>{ if(k==='class') e.className = attrs[k]; else if(k==='html') e.innerHTML = attrs[k]; else e.setAttribute(k, attrs[k]); });
        }
        (children||[]).forEach(ch => { if(typeof ch === 'string') e.appendChild(document.createTextNode(ch)); else e.appendChild(ch); });
        return e;
    }

    function makeNumber(id, min, max, value, width){ const n = document.createElement('aws-input'); n.id = id; n.setAttribute('type','number'); n.setAttribute('mode','edit'); if(min!==undefined) n.setAttribute('min',String(min)); if(max!==undefined) n.setAttribute('max',String(max)); if(value!==undefined) n.setAttribute('value',String(value)); if(width) n.style = `width:${width}`; return n; }
    function makeBool(id){ const b = document.createElement('aws-bool'); b.id = id; b.setAttribute('mode','edit'); return b; }
    function makeSelector(id, options){ const s = document.createElement('aws-selector'); s.id = id; s.setAttribute('mode','edit'); (options||[]).forEach(o=>{ const opt = document.createElement('aws-option'); opt.setAttribute('data-id', o.id); opt.textContent = o.label; s.appendChild(opt); }); return s; }
    function makePathInput(id, value, opts){
        try{
            const container = document.createElement('div'); container.className = 'path-input-wrap'; container.style = 'display:flex;align-items:center;gap:6px;';
            const input = document.createElement('aws-input'); input.id = id; input.setAttribute('mode','edit'); if (typeof value !== 'undefined' && value !== null) input.setAttribute('value', String(value));
            input.style = 'flex:1;min-width:0;vertical-align:middle';
            const btn = document.createElement('aws-icon-button'); btn.setAttribute('variant','ghost'); btn.setAttribute('size','sm'); btn.className = 'path-btn'; btn.style = 'flex:0 0 32px;width:32px;height:28px;vertical-align:middle;padding:0;';
            // folder icon (filled)
            btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="currentColor"><path d="M10 4H4C2.895 4 2 4.895 2 6V18C2 19.105 2.895 20 4 20H20C21.105 20 22 19.105 22 18V8C22 6.895 21.105 6 20 6H12L10 4Z"/></svg>';
            container.appendChild(input); container.appendChild(btn);
            let _pathSelecting = false;
            btn.addEventListener('click', async function(e){
                e.preventDefault();
                e.stopPropagation();
                if (_pathSelecting) return;
                _pathSelecting = true;
                btn.setAttribute('disabled','true');
                const directory = opts && opts.directory;
                try{
                    // Host-provided selector (Electron or native host) - prefer this (can return full path)
                    if (window.selectPath && typeof window.selectPath === 'function'){
                        try{ const p = await window.selectPath({id, directory}); if (p) window.SP_params && window.SP_params.setVal && window.SP_params.setVal(id, p); }catch(e){}
                        return;
                    }

                    // Backend API selector: call server-side endpoint which will open a native dialog and return absolute path
                    try{
                        const proto = window.location.protocol;
                        const host = window.location.hostname;
                        const backendBase = `${proto}//${host}:5000`;
                        const useBackend = (host === 'localhost' || host === '127.0.0.1' || window.location.port === '3000');
                        const url = useBackend ? (backendBase + '/select-path') : '/select-path';
                        const resp = await fetch(url, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ mode: directory ? 'directory' : 'file' }) });
                        if (resp && resp.ok){ const body = await resp.json().catch(()=>null); if (body && body.status === 'ok' && body.path){ window.SP_params && window.SP_params.setVal && window.SP_params.setVal(id, body.path); return; } }
                    }catch(e){}

                    // File System Access API (Chromium) - file picker
                    if (window.showOpenFilePicker && !directory){
                        try{
                            const handles = await window.showOpenFilePicker();
                            if (handles && handles.length){
                                const h = handles[0];
                                // try to read a better label (not full path, may be limited by browser)
                                try{ const f = await h.getFile(); const label = (f && (f.webkitRelativePath || f.name)) || h.name || ''; window.SP_params && window.SP_params.setVal && window.SP_params.setVal(id, label); }catch(e){ window.SP_params && window.SP_params.setVal && window.SP_params.setVal(id, h.name || ''); }
                            }
                        }catch(e){}
                        return;
                    }

                    // Directory picker
                    if (window.showDirectoryPicker && directory){
                        try{ const handle = await window.showDirectoryPicker(); if (handle){ window.SP_params && window.SP_params.setVal && window.SP_params.setVal(id, handle.name || ''); } }catch(e){}
                        return;
                    }

                    // Fallback: input[type=file]
                    try{
                        const tmp = document.createElement('input'); tmp.type = 'file'; if (directory) tmp.webkitdirectory = true; tmp.style.display='none'; document.body.appendChild(tmp);
                        tmp.addEventListener('change', function(){ try{ const f = tmp.files && tmp.files[0]; if (f){ const v = f.webkitRelativePath || f.name || ''; window.SP_params && window.SP_params.setVal && window.SP_params.setVal(id, v); } }catch(e){} try{ document.body.removeChild(tmp); }catch(e){} });
                        tmp.click();
                    }catch(e){}
                }finally{
                    setTimeout(()=>{ try{ btn.removeAttribute('disabled'); }catch(e){} _pathSelecting = false; }, 600);
                }
            });
            return container;
        }catch(e){ return document.createElement('aws-input'); }
    }

    function getVal(id){ const el = document.getElementById(id); if (!el) return null; try{ const tag = el.tagName && el.tagName.toLowerCase(); if (tag === 'aws-selector') { if ('value' in el && el.value !== undefined && el.value !== null && String(el.value).trim() !== '') return el.value; const attrVal = el.getAttribute && el.getAttribute('value'); if (attrVal && String(attrVal).trim() !== '') return attrVal; const opts = Array.from(el.querySelectorAll && el.querySelectorAll('aws-option') || []); let sel = opts.find(o => o.hasAttribute('selected')) || opts.find(o => o.getAttribute('data-selected') === 'true') || opts.find(o => o.getAttribute('selected') === 'true') || opts.find(o => o.getAttribute('aria-selected') === 'true') || opts.find(o => (o.classList && o.classList.contains && o.classList.contains('selected'))); if (!sel && opts.length === 1) sel = opts[0]; if (sel) return sel.getAttribute('data-id') || sel.getAttribute('value') || (sel.textContent && sel.textContent.trim()); for (const o of opts) { if (o.dataset && o.dataset.id) return o.dataset.id; } return null; } if (tag && tag.startsWith('aws-')) { if ('value' in el) return el.value; return el.getAttribute && el.getAttribute('value'); } if ('checked' in el) return el.checked; return el.value; }catch(e){ console.error('getVal error', e); return null; } }

    function setVal(id, val){
        const el = document.getElementById(id);
        if (!el) return;
        const outVal = Array.isArray(val) ? val.join(',') : (val === undefined || val === null ? '' : val);
        
        // if this is a custom aws-* element that isn't yet defined, schedule reapply when defined
        try{
            const tag = el && el.tagName ? el.tagName.toLowerCase() : null;
            if (tag && tag.startsWith('aws-') && window.customElements && window.customElements.get && !window.customElements.get(tag)){
                try{ _reapplyWhenDefined(el, val); }catch(e){}
            }
        }catch(e){}
        try{
            if ('value' in el) el.value = outVal; else if (el.setAttribute) el.setAttribute('value', outVal);
            try{
                const inner = (el.shadowRoot && el.shadowRoot.querySelector) ? el.shadowRoot.querySelector('input,textarea') : (el.querySelector ? el.querySelector('input,textarea') : null);
                if (inner){ inner.value = outVal; try{ inner.dispatchEvent(new Event('input', { bubbles: true })); }catch(e){} try{ inner.dispatchEvent(new Event('change', { bubbles: true })); }catch(e){} }
            }catch(e){}
            try{ el.dispatchEvent(new Event('input')); }catch(e){}
            try{ el.dispatchEvent(new Event('value-changed')); }catch(e){}
        }catch(e){
            try{
                if (el.setAttribute) el.setAttribute('value', outVal);
                try{
                    const inner = (el.shadowRoot && el.shadowRoot.querySelector) ? el.shadowRoot.querySelector('input,textarea') : (el.querySelector ? el.querySelector('input,textarea') : null);
                    if (inner){ inner.value = outVal; try{ inner.dispatchEvent(new Event('input', { bubbles: true })); }catch(e){} try{ inner.dispatchEvent(new Event('change', { bubbles: true })); }catch(e){} }
                }catch(e){}
                try{ el.dispatchEvent(new Event('input')); }catch(e){}
                try{ el.dispatchEvent(new Event('value-changed')); }catch(e){}
            }catch(e){}
        }
    }

    function setBool(id, val){ const el = document.getElementById(id); if(!el) return; try{ if ('value' in el) el.value = !!val; else el.setAttribute && el.setAttribute('value', !!val); try{ el.dispatchEvent(new Event('change')); }catch(e){} try{ el.dispatchEvent(new Event('value-changed')); }catch(e){} }catch(e){ try{ el.setAttribute && el.setAttribute('value', !!val); try{ el.dispatchEvent(new Event('change')); }catch(_){} try{ el.dispatchEvent(new Event('value-changed')); }catch(_){} }catch(_){} } }

    // If an aws-* custom element is not yet defined, reapply the value once it's defined
    function _reapplyWhenDefined(el, desired){
        try{
            if (!el || !el.tagName) return;
            const tag = el.tagName.toLowerCase();
            if (!(tag && tag.startsWith('aws-'))) return;
            if (!(window.customElements && window.customElements.whenDefined)) return;
            const ctor = window.customElements.get(tag);
            if (ctor) return; // already defined
            window.customElements.whenDefined(tag).then(()=>{
                try{
                    const d = Array.isArray(desired) ? desired.join(',') : (desired === undefined || desired === null ? '' : desired);
                    // prefer the element currently in the DOM (it may have been replaced during init)
                    const target = (el && el.id && document.getElementById(el.id)) ? document.getElementById(el.id) : el;
                    if (!target) return;
                    if ('value' in target) target.value = d;
                    else if (target.setAttribute) target.setAttribute('value', d);
                    try{ target.dispatchEvent(new Event('input')); }catch(e){}
                    try{ target.dispatchEvent(new Event('change')); }catch(e){}
                    try{ target.dispatchEvent(new Event('value-changed')); }catch(e){}
                }catch(e){}
            }).catch(()=>{});
        }catch(e){}
    }

    // Diagnostics: when setting a value, log useful info if widget doesn't seem to reflect it
    const _diag = (id, el) => {
        try{
            const tag = el && el.tagName ? el.tagName.toLowerCase() : 'null';
            const ce = (window.customElements && window.customElements.get) ? window.customElements.get(tag) : null;
            
        }catch(e){}
    };
    

    async function loadSettings(){
        const proto = window.location.protocol; const host = window.location.hostname; const isFrontendDev = (window.location.port === '3000'); const backendBase = `${proto}//${host}:5000`;
        const safeParseJsonResponse = async (res) => { if (!res || !res.ok) return null; const ct = (res.headers.get('content-type')||'').toLowerCase(); if (ct.indexOf('application/json') !== -1) return await res.json(); try { const txt = await res.text(); return JSON.parse(txt); } catch(e){ return null; } };
        const tryFetch = async (url) => { try{ const r = await fetch(url,{cache:'no-store'}); return await safeParseJsonResponse(r); }catch(e){ return null; } };
        let parsed = null;
        if (isFrontendDev) parsed = await tryFetch(backendBase + '/settings');
        if (!parsed) parsed = await tryFetch('/settings');
        if (!parsed) parsed = await tryFetch(backendBase + '/settings');
        if (!parsed) return null;
        // If backend returns { status: 'ok', settings: { ... } }, return the inner settings object
        if (parsed && typeof parsed === 'object' && parsed.settings && typeof parsed.settings === 'object') return parsed.settings;
        return parsed;
    }

    async function saveSettings(updates){ const proto = window.location.protocol; const host = window.location.hostname; const isFrontendDev = (window.location.port === '3000'); const backendBase = `${proto}//${host}:5000`; const settingsGetUrl = isFrontendDev ? (backendBase + '/settings') : '/settings'; const settingsPostUrl = isFrontendDev ? (backendBase + '/settings') : '/settings'; try{ const r = await fetch(settingsGetUrl,{cache:'no-store'}).catch(e=>{throw e;}); const cur = r && r.ok ? await r.json().catch(()=>({})) : {}; const current = (cur && cur.settings) ? cur.settings : (cur || {});
        // Merge updates into current, preserving nested objects (eg. `storage`).
        try{
            Object.keys(updates || {}).forEach(key => {
                const val = updates[key];
                if (val && typeof val === 'object' && !Array.isArray(val) && current[key] && typeof current[key] === 'object' && !Array.isArray(current[key])){
                    Object.assign(current[key], val);
                } else {
                    current[key] = val;
                }
            });
        }catch(e){
            // fallback to shallow assign if merge fails
            Object.assign(current, updates);
        }

        const post = await fetch(settingsPostUrl, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(current) }); const resp = post && post.ok ? await post.json().catch(()=>({})) : {}; return resp; }catch(e){ console.error('saveSettings error', e); return null; } }

    window.SP_params.el = el;
    window.SP_params.makeNumber = makeNumber;
    window.SP_params.makeBool = makeBool;
    window.SP_params.makeSelector = makeSelector;
    window.SP_params.makePathInput = makePathInput;
    // Validate path via backend: returns parsed JSON or null
    window.SP_params.validatePath = async function(path, opts){
        try{
            const proto = window.location.protocol;
            const host = window.location.hostname;
            const isFrontendDev = (window.location.port === '3000');
            const backendBase = `${proto}//${host}:5000`;
            const url = isFrontendDev ? (backendBase + '/validate-path') : '/validate-path';
            const resp = await fetch(url, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ path: path, mode: (opts && opts.directory) ? 'directory' : 'file' }) });
            if (!resp || !resp.ok) return null;
            const body = await resp.json().catch(()=>null);
            return body;
        }catch(e){ return null; }
    };
    window.SP_params.getVal = getVal;
    window.SP_params.setVal = setVal;
    window.SP_params.setBool = setBool;
    window.SP_params._setDiag = _diag;
    window.SP_params.loadSettings = loadSettings;
    window.SP_params.saveSettings = saveSettings;
    // Initialize aws-* widgets inside a container so their internal native inputs reflect attributes/properties
    window.SP_params.initAwsWidgets = function(container){
        try{
            const root = container || document;
            const inputs = Array.from(root.querySelectorAll('aws-input'));
            inputs.forEach(orig => {
                try {
                    // collect attributes (and preserve property 'value' if present)
                    const attrs = {};
                    for (let i = 0; i < orig.attributes.length; i++) {
                        const a = orig.attributes[i]; attrs[a.name] = a.value;
                    }
                    // if value was set as a property (setVal uses el.value), preserve it as attribute so new widget gets it
                    try{ if ((typeof attrs.value === 'undefined' || attrs.value === null || attrs.value === '') && ('value' in orig) && (typeof orig.value !== 'undefined') && orig.value !== null){ attrs.value = String(orig.value); } }catch(e){}
                    // create new element and copy attributes
                    const nw = document.createElement('aws-input');
                    Object.keys(attrs).forEach(k => nw.setAttribute(k, attrs[k]));
                    nw.className = orig.className || '';
                    if (orig.getAttribute('style')) nw.setAttribute('style', orig.getAttribute('style'));
                    if (typeof attrs.value !== 'undefined' && attrs.value !== null) { try{ nw.value = attrs.value; }catch(e){} }
                    // replace in DOM to trigger connectedCallback with initial attributes
                    if (orig.parentNode) orig.parentNode.replaceChild(nw, orig);
                    // after connected, set internal native input and dispatch events
                    setTimeout(()=>{
                        try{
                            const sr = nw.shadowRoot;
                            const inner = sr ? sr.querySelector('input,textarea') : nw.querySelector('input,textarea');
                            // prefer current property value (may have been set after replace), else fall back to captured attr
                            const currentProp = (typeof nw.value !== 'undefined' && nw.value !== null && String(nw.value) !== '') ? nw.value : null;
                            const val = currentProp !== null ? currentProp : (typeof attrs.value !== 'undefined' ? attrs.value : (nw.value || ''));
                            
                            if (inner) {
                                inner.value = val;
                                inner.dispatchEvent(new Event('input', { bubbles: true }));
                                inner.dispatchEvent(new Event('change', { bubbles: true }));
                            }
                        }catch(e){}
                    }, 30);
                }catch(e){}
            });
        }catch(e){ console.warn('initAwsWidgets error', e); }
    };

    // Apply a value safely to a widget by id: set attribute/property and inner native input if present
    window.SP_params.applyValueToWidget = function(id, value){
        try{
            const el = document.getElementById(id);
            if (!el) return;
            const outVal = Array.isArray(value) ? value.join(',') : (value===undefined || value===null ? '' : String(value));
            if (el.setAttribute) el.setAttribute('value', outVal);
            try{ if ('value' in el) el.value = outVal; }catch(e){}
            // attempt to set inner native input/textarea (shadow or light DOM)
            try{
                const target = document.getElementById(id) || el;
                const inner = (target && target.shadowRoot && target.shadowRoot.querySelector) ? target.shadowRoot.querySelector('input,textarea') : (target && target.querySelector ? target.querySelector('input,textarea') : null);
                if (inner){ inner.value = outVal; inner.dispatchEvent(new Event('input', { bubbles:true })); inner.dispatchEvent(new Event('change', { bubbles:true })); }
            }catch(e){}
        }catch(e){}
    };

    // Convenience: apply an array value (kept for backwards compatibility)
    window.SP_params.applyArrayToWidget = function(id, arr){
        try{ window.SP_params.applyValueToWidget(id, Array.isArray(arr) ? arr.join(',') : arr); }catch(e){}
    };

    // Apply value for widgets which are in view mode: set attribute and inner display only
    window.SP_params.applyValueToWidgetView = function(id, value){
        try{
            const el = document.getElementById(id);
            if (!el) return;
            const outVal = Array.isArray(value) ? value.join(',') : (value===undefined || value===null ? '' : String(value));
            if (el.setAttribute) el.setAttribute('value', outVal);
            // attempt to update inner native input for display
            try{
                const target = document.getElementById(id) || el;
                const inner = (target && target.shadowRoot && target.shadowRoot.querySelector) ? target.shadowRoot.querySelector('input,textarea') : (target && target.querySelector ? target.querySelector('input,textarea') : null);
                if (inner){ inner.value = outVal; }
            }catch(e){}
        }catch(e){}
    };

    // Apply value for widgets which are in edit mode: set property/attribute and dispatch input/change events
    window.SP_params.applyValueToWidgetEdit = function(id, value){
        try{
            if (window.SP_params && typeof window.SP_params.setVal === 'function'){
                return window.SP_params.setVal(id, value);
            }
            const el = document.getElementById(id);
            if (!el) return;
            const outVal = Array.isArray(value) ? value.join(',') : (value===undefined || value===null ? '' : String(value));
            try{ if ('value' in el) el.value = outVal; else if (el.setAttribute) el.setAttribute('value', outVal); }catch(e){}
            try{
                const target = document.getElementById(id) || el;
                const inner = (target && target.shadowRoot && target.shadowRoot.querySelector) ? target.shadowRoot.querySelector('input,textarea') : (target && target.querySelector ? target.querySelector('input,textarea') : null);
                if (inner){ inner.value = outVal; try{ inner.dispatchEvent(new Event('input', { bubbles:true })); }catch(e){} try{ inner.dispatchEvent(new Event('change', { bubbles:true })); }catch(e){} }
            }catch(e){}
            try{ el.dispatchEvent(new Event('input')); }catch(e){}
            try{ el.dispatchEvent(new Event('change')); }catch(e){}
        }catch(e){}
    };
})();
