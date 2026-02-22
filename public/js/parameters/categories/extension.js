
    (function(){
    const el = (window.SP_params && window.SP_params.el) ? window.SP_params.el : function(tag, attrs, children){
        const e = document.createElement(tag);
        if (attrs && typeof attrs === 'object' && !Array.isArray(attrs)){
            Object.keys(attrs).forEach(k=>{ if(k==='class') e.className = attrs[k]; else if(k==='html') e.innerHTML = attrs[k]; else e.setAttribute(k, attrs[k]); });
        }
        (children||[]).forEach(ch => { if(typeof ch === 'string') e.appendChild(document.createTextNode(ch)); else e.appendChild(ch); });
        return e;
    };

    async function fetchToken(){
        const proto = window.location.protocol;
        const host = window.location.hostname;
        const isFrontendDev = (window.location.port === '3000');
        const backendBase = `${proto}//${host}:5000`;
        const safeParse = async (res)=>{ if(!res || !res.ok) return null; try{ return await res.json(); }catch(e){ try{ const t = await res.text(); return JSON.parse(t); }catch(_){ return null; } } };

        if (isFrontendDev) {
            try { const r = await fetch(backendBase + '/extension/token', {cache:'no-store'}); const p = await safeParse(r); if (p) return p; } catch(e){}
        }
        try { const r = await fetch('/extension/token', {cache:'no-store'}); const p = await safeParse(r); if (p) return p; } catch(e){}
        try { const r = await fetch(backendBase + '/extension/token', {cache:'no-store'}); const p = await safeParse(r); if (p) return p; } catch(e){}
        return null;
    }

    async function postRegenerate(ttl){
        const proto = window.location.protocol;
        const host = window.location.hostname;
        const isFrontendDev = (window.location.port === '3000');
        const backendBase = `${proto}//${host}:5000`;
        const post = async (url)=>{
            const r = await fetch(url, {method:'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ttl_days: ttl})});
            try{ return await r.json(); }catch(e){ return null; }
        };
        if (isFrontendDev){ try { const p = await post(backendBase + '/extension/token'); if (p) return p; } catch(e){} }
        try { const p = await post('/extension/token'); if (p) return p; } catch(e){}
        try { const p = await post(backendBase + '/extension/token'); if (p) return p; } catch(e){}
        return null;
    }

    function formatExpiry(iso){ if(!iso) return '-'; try{ const d = new Date(iso); return d.toLocaleString(); }catch(e){ return iso; } }

    async function render(area){
        // extension styles are provided by public/style/parameters-extension.css

        area.innerHTML = '';
        const wrap = el('div',{class:'params-form'});
        const head = el('h3'); head.setAttribute('data-i18n','extension'); head.textContent = window.t ? window.t('extension') : 'Extension';
        wrap.appendChild(head);

        const box = el('div',{class:'extension-box'});

        const tokenRow = el('div',{class:'param-row'});
        const tokenName = el('div',{class:'param-name'}); tokenName.setAttribute('data-i18n','extension_token_label'); tokenName.textContent = window.t ? window.t('extension_token_label') : 'Token';
        const tokenValWrap = el('div',{class:'param-value'});
        // token display (aws-input mode=view) with a single regenerate icon button to its right
        const tokenInput = document.createElement('aws-input'); tokenInput.id = 'extension-token'; tokenInput.setAttribute('type','text'); tokenInput.setAttribute('mode','view'); tokenInput.style = 'width:calc(100% - 48px)';
        tokenValWrap.appendChild(tokenInput);
        const tokenActions = el('div',{class:'param-actions'});
        tokenRow.appendChild(tokenName); tokenRow.appendChild(tokenValWrap); tokenRow.appendChild(tokenActions);
        box.appendChild(tokenRow);

        // Expiry display as a date input next to its sync button
        const expRow = el('div',{class:'param-row'});
        const expName = el('div',{class:'param-name'}); expName.setAttribute('data-i18n','extension_expires_label'); expName.textContent = window.t ? window.t('extension_expires_label') : 'Expires';
        // control wrap keeps date input and regenerate button glued together
        const controlWrap = el('div',{class:'param-value param-control-wrap'});
        const expiryInput = document.createElement('aws-input'); expiryInput.id = 'extension-expiry'; expiryInput.setAttribute('type','date'); expiryInput.setAttribute('mode','view'); expiryInput.style = 'width:200px';
        // action area next to expiry: regenerate button + check icon (inside control wrap)
        const expActions = el('div',{class:'param-actions'});
        const genBtn = document.createElement('aws-icon-button'); genBtn.setAttribute('size','sm'); genBtn.setAttribute('variant','primary');
        const genIcon = document.createElement('span'); genIcon.className = 'material-icons'; genIcon.textContent = 'refresh';
        genBtn.appendChild(genIcon);
        genBtn.setAttribute('title', (window.t && window.t('extension_generate')) || 'Generate');
        const checkEl = document.createElement('span'); checkEl.className = 'material-icons sp-check'; checkEl.textContent = 'check_circle';
        expActions.appendChild(genBtn); expActions.appendChild(checkEl);
        controlWrap.appendChild(expiryInput); controlWrap.appendChild(expActions);
        expRow.appendChild(expName); expRow.appendChild(controlWrap);
        box.appendChild(expRow);

        const ttlRow = el('div',{class:'param-row'});
        const ttlName = el('div',{class:'param-name'}); ttlName.setAttribute('data-i18n','extension_ttl_label'); ttlName.textContent = window.t ? window.t('extension_ttl_label') : 'TTL (days)';
        const ttlVal = el('div',{class:'param-value'});
        // use aws-input for TTL (numeric)
        const ttlInput = document.createElement('aws-input'); ttlInput.id = 'extension-ttl'; ttlInput.setAttribute('type','number'); ttlInput.setAttribute('mode','edit'); ttlInput.setAttribute('min','1'); ttlInput.setAttribute('value','30'); ttlInput.style = 'width:80px';
        ttlVal.appendChild(ttlInput);
        ttlRow.appendChild(ttlName); ttlRow.appendChild(ttlVal);
        box.appendChild(ttlRow);

        // Detect enabled toggle (moved from security category)
        const detectRow = el('div',{class:'param-row'});
        const detectName = el('div',{class:'param-name'}); detectName.setAttribute('data-i18n','detect_enabled'); detectName.textContent = window.t ? window.t('detect_enabled') : 'Detect enabled';
        const detectVal = el('div',{class:'param-value'});
        const detectToggle = document.createElement('aws-bool'); detectToggle.id = 'extension-detect_enabled'; detectToggle.setAttribute('mode','edit'); detectVal.appendChild(detectToggle);
        detectRow.appendChild(detectName); detectRow.appendChild(detectVal);
        box.appendChild(detectRow);

        const actions = el('div',{class:'form-actions'});
        const status = el('span',{id:'extension-status', style:'margin-left:12px'});
        actions.appendChild(status);
        box.appendChild(actions);

        // connection badge row (placed last)
        const connRow = el('div',{class:'param-row'});
        const connName = el('div',{class:'param-name'});
        connName.setAttribute('data-i18n','extension_connection'); connName.textContent = window.t ? window.t('extension_connection') : 'Connection';
        const connVal = el('div',{class:'param-value'});
        const connBadge = el('span',{class:'sp-conn-badge off'});
        connBadge.textContent = (window.t && window.t('extension_disconnected')) || 'Disconnected';
        connVal.appendChild(connBadge);
        connRow.appendChild(connName); connRow.appendChild(connVal);
        box.appendChild(connRow);

        wrap.appendChild(box);
        area.appendChild(wrap);

        try{ if (window.SP_params && typeof window.SP_params.initAwsWidgets === 'function') window.SP_params.initAwsWidgets(area); }catch(e){}

        // Load current token
        const refresh = async ()=>{
            status.textContent = '';
            const j = await fetchToken();
            if (!j){ status.textContent = window.t ? window.t('extension_error') : 'Error'; return; }
            if (j.status === 'empty' || j.status === 'empty' || !j.token){
                try{ if (window.SP_params && typeof window.SP_params.applyValueToWidgetView === 'function') window.SP_params.applyValueToWidgetView('extension-token',''); else { if ('value' in tokenInput) tokenInput.value = ''; else tokenInput.setAttribute && tokenInput.setAttribute('value',''); } }catch(e){}
                try{ if (window.SP_params && typeof window.SP_params.applyValueToWidgetView === 'function') window.SP_params.applyValueToWidgetView('extension-expiry',''); else { if ('value' in expiryInput) expiryInput.value = ''; else expiryInput.setAttribute && expiryInput.setAttribute('value',''); } }catch(e){}
                // show friendly no-token text in status
                status.textContent = window.t ? window.t('extension_no_token') : 'No token';
                return;
            }
            try{ if (window.SP_params && typeof window.SP_params.applyValueToWidgetView === 'function') window.SP_params.applyValueToWidgetView('extension-token', j.token || ''); else { if ('value' in tokenInput) tokenInput.value = j.token || ''; else tokenInput.setAttribute && tokenInput.setAttribute('value', j.token || ''); } }catch(e){}
                // set expiry input value to ISO date (yyyy-mm-dd) if available
                const iso = j.expires_at || j.expires_at_iso || j.expiresAt || null;
                if (iso){
                    try{
                        const d = new Date(iso);
                        const yyyy = d.getFullYear();
                        const mm = String(d.getMonth()+1).padStart(2,'0');
                        const dd = String(d.getDate()).padStart(2,'0');
                        const isoDate = `${yyyy}-${mm}-${dd}`;
                        try{ if (window.SP_params && typeof window.SP_params.applyValueToWidgetView === 'function') window.SP_params.applyValueToWidgetView('extension-expiry', isoDate); else { if ('value' in expiryInput) expiryInput.value = isoDate; else expiryInput.setAttribute && expiryInput.setAttribute('value', isoDate); } }catch(e){}
                    }catch(e){ if ('value' in expiryInput) expiryInput.value = iso || ''; else expiryInput.setAttribute && expiryInput.setAttribute('value', iso || ''); }
                } else { try{ if (window.SP_params && typeof window.SP_params.applyValueToWidgetView === 'function') window.SP_params.applyValueToWidgetView('extension-expiry',''); else { if ('value' in expiryInput) expiryInput.value = ''; else expiryInput.setAttribute && expiryInput.setAttribute('value',''); } }catch(e){} }
                // show check icon briefly
                try{ checkEl.classList.add('visible'); setTimeout(()=>checkEl.classList.remove('visible'),1400); }catch(e){}
        };

        const loadSettings = async ()=>{ if (window.SP_params && window.SP_params.loadSettings) return window.SP_params.loadSettings(); const proto = window.location.protocol; const host = window.location.hostname; const isFrontendDev = (window.location.port === '3000'); const backendBase = `${proto}//${host}:5000`; const safeParse = async (res)=>{ if(!res || !res.ok) return null; try{ return await res.json(); }catch(e){ try{ const t = await res.text(); return JSON.parse(t); }catch(_){ return null; } } }; if (isFrontendDev){ try { const r = await fetch(backendBase + '/settings', {cache:'no-store'}); const p = await safeParse(r); if (p) return p; } catch(e){} } try { const r = await fetch('/settings', {cache:'no-store'}); const p = await safeParse(r); if (p) return p; } catch(e){} try { const r = await fetch(backendBase + '/settings', {cache:'no-store'}); const p = await safeParse(r); if (p) return p; } catch(e){} return null; };

        const saveSettings = async (updates)=>{ 
            if (window.SP_params && window.SP_params.saveSettings) { 
                const resp = await window.SP_params.saveSettings(updates); 
                if (resp && resp.status === 'ok'){ 
                    status.textContent = window.t ? window.t('saved') : 'Saved'; 
                    setTimeout(()=>status.textContent = '', 900); 
                    return true; 
                } 
                status.textContent = window.t ? window.t('error') : 'Error'; 
                setTimeout(()=>status.textContent = '', 1600); return false; 
            } 
            status.textContent = window.t ? window.t('saving') : 'Saving...'; 
            const proto = window.location.protocol; 
            const host = window.location.hostname; 
            const isFrontendDev = (window.location.port === '3000'); 
            const backendBase = `${proto}//${host}:5000`; 
            const settingsGetUrl = isFrontendDev ? (backendBase + '/settings') : '/settings'; 
            const settingsPostUrl = isFrontendDev ? (backendBase + '/settings') : '/settings'; 
            try{ const r = await fetch(settingsGetUrl, {cache:'no-store'}).catch(e=>{throw e;}); 
            const cur = r && r.ok ? await r.json().catch(()=>({})) : {}; 
            const current = (cur && cur.settings) ? cur.settings : (cur || {}); 
            Object.assign(current, updates); 
            const post = await fetch(settingsPostUrl, { 
                method: 'POST', 
                headers: {'Content-Type':'application/json'}, 
                body: JSON.stringify(current) 
            }); 
            const resp = post && post.ok ? await post.json().catch(()=>({})) : {}; 
            if (resp && resp.status === 'ok'){ 
                status.textContent = window.t ? window.t('saved') : 'Saved'; 
                setTimeout(()=>status.textContent = '', 900); return true; 
            }
        } catch(e){ console.error('saveSettings error', e); status.textContent = window.t ? window.t('error') : 'Error'; setTimeout(()=>status.textContent = '', 1600); return false; } };
        // initialize settings and token display
        const s = await loadSettings();
            if (s){ const ss = s.settings || s; try{ // prefer top-level detect_enabled but fall back to general.detect_enabled
                const detectVal = (typeof ss.detect_enabled !== 'undefined') ? ss.detect_enabled : (ss.general && typeof ss.general.detect_enabled !== 'undefined' ? ss.general.detect_enabled : false);
                if (typeof detectToggle !== 'undefined' && detectToggle){ try{ if (window.SP_params && typeof window.SP_params.setBool === 'function') window.SP_params.setBool('extension-detect_enabled', !!detectVal); else { if ('value' in detectToggle) detectToggle.value = !!detectVal; else detectToggle.setAttribute && detectToggle.setAttribute('value', !!detectVal); } }catch(e){} }
                // update connection badge according to detect_enabled (using resolved value)
                try{ if (detectVal){ connBadge.classList.remove('off'); connBadge.classList.add('on'); connBadge.textContent = (window.t && window.t('extension_connected')) || 'Connected'; } else { connBadge.classList.remove('on'); connBadge.classList.add('off'); connBadge.textContent = (window.t && window.t('extension_disconnected')) || 'Disconnected'; } }catch(e){}
            }catch(e){} }

        await refresh();

        genBtn.addEventListener('click', async ()=>{
            const ttlEl = document.getElementById('extension-ttl');
            let ttl = 30;
            try{
                if (ttlEl){
                    if ('value' in ttlEl && ttlEl.value !== undefined && ttlEl.value !== null) ttl = parseInt(ttlEl.value,10) || 30;
                    else ttl = parseInt(ttlEl.getAttribute && (ttlEl.getAttribute('value')||ttlEl.getAttribute('data-value')) || '30',10) || 30;
                }
            }catch(e){ ttl = 30; }
            status.textContent = window.t ? window.t('saving') : 'Saving...';
            const p = await postRegenerate(ttl);
            if (!p || (p && p.error)){
                status.textContent = (window.t && window.t('extension_error')) || 'Error';
                return;
            }
            // backend returns token and expires_at
            try{ if (window.SP_params && typeof window.SP_params.applyValueToWidgetView === 'function') window.SP_params.applyValueToWidgetView('extension-token', p.token || ''); else { if ('value' in tokenInput) tokenInput.value = p.token || ''; else tokenInput.setAttribute && tokenInput.setAttribute('value', p.token || ''); } }catch(e){}
            // visual effect on newly generated token: apply to the aws-widget host when present
            try{ 
                const widget = (tokenValWrap && tokenValWrap.querySelector && tokenValWrap.querySelector('aws-input')) || tokenInput;
                if (widget && widget.classList){
                    widget.classList.add('sp-token-generated');
                    setTimeout(()=>widget.classList.remove('sp-token-generated'),1400);
                }
            }catch(e){}
            const exp = p.expires_at || p.expiresAt || null;
            if (exp){
                try{
                    const d = new Date(exp);
                    const yyyy = d.getFullYear();
                    const mm = String(d.getMonth()+1).padStart(2,'0');
                    const dd = String(d.getDate()).padStart(2,'0');
                    const isoDate = `${yyyy}-${mm}-${dd}`;
                    try{ if (window.SP_params && typeof window.SP_params.applyValueToWidgetView === 'function') window.SP_params.applyValueToWidgetView('extension-expiry', isoDate); else { if ('value' in expiryInput) expiryInput.value = isoDate; else expiryInput.setAttribute && expiryInput.setAttribute('value', isoDate); } }catch(e){}
                }catch(e){ if ('value' in expiryInput) expiryInput.value = exp; else expiryInput.setAttribute && expiryInput.setAttribute('value', exp); }
            } else { try{ if (window.SP_params && typeof window.SP_params.applyValueToWidgetView === 'function') window.SP_params.applyValueToWidgetView('extension-expiry',''); else { if ('value' in expiryInput) expiryInput.value = ''; else expiryInput.setAttribute && expiryInput.setAttribute('value',''); } }catch(e){} }
            status.textContent = (window.t && window.t('extension_generated')) || 'Generated';
            setTimeout(()=>status.textContent='',1200);
        });

        // when detect toggle is changed, save immediately to /settings
        try{
            detectToggle.addEventListener('change', async ()=>{
                let val = false;
                try{ if ('value' in detectToggle) val = !!detectToggle.value; else val = (detectToggle.getAttribute && (detectToggle.getAttribute('value') === 'true')) || false; }catch(e){ val = false; }
                // update badge immediately
                try{ if (val){ connBadge.classList.remove('off'); connBadge.classList.add('on'); connBadge.textContent = (window.t && window.t('extension_connected')) || 'Connected'; } else { connBadge.classList.remove('on'); connBadge.classList.add('off'); connBadge.textContent = (window.t && window.t('extension_disconnected')) || 'Disconnected'; } }catch(e){}
                // persist under `general.detect_enabled` so backend merges into existing general settings
                const ok = await saveSettings({ general: { detect_enabled: !!val } });
                if (!ok){ /* if save failed, revert badge to previous state */ try{ if (!val){ connBadge.classList.remove('on'); connBadge.classList.add('off'); connBadge.textContent = (window.t && window.t('extension_disconnected')) || 'Disconnected'; } else { connBadge.classList.remove('off'); connBadge.classList.add('on'); connBadge.textContent = (window.t && window.t('extension_connected')) || 'Connected'; } }catch(e){} }
            });
        }catch(e){}
    }

    window.SP_render_extension = render;
})();