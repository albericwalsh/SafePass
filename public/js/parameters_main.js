

(function(){
    // Main loader for the parameters page — builds sidebar and loads per-category modules
    const categories = [
        { id: 'general', name: 'general' },
        { id: 'extension', name: 'extension' },
        { id: 'security', name: 'security' },
        { id: 'storage', name: 'storage' },
        { id: 'display', name: 'display' },
        { id: 'advanced', name: 'advanced' }
    ];

    function createSidebar() {
        const ul = document.getElementById('params-sidebar');
        categories.forEach(c => {
                const li = document.createElement('li'); li.className = 'nav-item';
                const a = document.createElement('a'); a.href = '#'; a.className = 'nav-link sp-link'; a.id = 'params-nav-' + c.id;
                a.setAttribute('data-i18n', c.name);
                a.textContent = (window.t && window.t(c.name)) || c.name;
                a.addEventListener('click', (ev) => { ev.preventDefault();
                    // toggle active state
                    Array.from(document.querySelectorAll('#params-sidebar .nav-link')).forEach(n=>n.classList.remove('active'));
                    a.classList.add('active');
                    // mark category globally
                    document.body.classList.remove('params-category-active');
                    document.body.classList.add('params-category-active-' + c.id);
                    loadCategory(c.id);
                });
                li.appendChild(a); ul.appendChild(li);
        });
    }

    function loadScript(path, cb){
        const s = document.createElement('script'); s.src = path; s.onload = () => cb && cb(null); s.onerror = (e) => cb && cb(e); document.head.appendChild(s);
    }

    // Wait for aws-widgets to be ready / custom elements to be defined (best-effort with timeout)
    function waitForWidgets(timeout){
        timeout = typeof timeout === 'number' ? timeout : 2000;
        if (window.awsWidgetsReady) return Promise.resolve();
        if (!window.customElements || !window.customElements.whenDefined) return Promise.resolve();
        const tags = ['aws-input','aws-bool','aws-selector','aws-button'];
        const promises = tags.map(t => {
            try{ if (window.customElements.get && window.customElements.get(t)) return Promise.resolve(); }catch(e){}
            try{ return window.customElements.whenDefined(t).catch(()=>{}); }catch(e){ return Promise.resolve(); }
        });
        return Promise.race([ Promise.all(promises), new Promise(res=>setTimeout(res, timeout)) ]);
    }

    function loadCategory(catId){
        const area = document.getElementById('params-main-area');
        // show category title and default skeleton
        const cat = (categories.find(c=>c.id===catId) || {name: catId});
        const title = (window.t && window.t(cat.name)) || cat.name;
        area.innerHTML = `<h2 data-i18n="${cat.name}">${title}</h2><div id="params-category-content" data-i18n="loading_settings">Chargement...</div>`;
        // wire basic search behavior
        try { document.getElementById('params-search-input').addEventListener('input', function(){ const q=this.value.toLowerCase(); Array.from(document.querySelectorAll('#params-list-body tr')).forEach(tr=>{ tr.style.display = tr.innerText.toLowerCase().indexOf(q)===-1 ? 'none' : ''; }); }); } catch(e){}
        // try to load module for this category
        const modulePath = '/js/parameters/categories/' + catId + '.js';
        // remove any previously loaded module with same id
        const existing = Array.from(document.querySelectorAll('script')).find(s => s.src && s.src.indexOf(modulePath) !== -1);
        if (existing) {
            // module already loaded; wait for widgets then call its render function if present
            try {
                waitForWidgets(2000).then(()=>{
                    try{ const fn = window['SP_render_' + catId]; if (typeof fn === 'function') { fn(area); setTimeout(()=>upgradeAndNotify(area),50); } else area.innerHTML = '<h3>' + catId + '</h3>'; }catch(e){ console.error(e); }
                });
            } catch(e) { console.error(e); }
            return;
        }
        loadScript(modulePath, function(err){
            if (err) { console.warn('No module for', catId, err); area.innerHTML = '<h3>' + categories.find(c => c.id === catId).name + '</h3>'; return; }
            try {
                waitForWidgets(2000).then(()=>{ try { const fn = window['SP_render_' + catId]; if (typeof fn === 'function') { fn(area); setTimeout(()=>upgradeAndNotify(area),50); } } catch(e){ console.error('render error', e); } });
            } catch(e){ console.error('render error', e); }
        });
    }

    // Try to upgrade any custom elements inside the area and dispatch input/change/value-changed
    function upgradeAndNotify(area){
        try{
            const selectors = ['aws-input','aws-bool','aws-selector','aws-button','input','select','textarea'];
            const nodes = area.querySelectorAll(selectors.join(','));
            nodes.forEach(el => {
                try{
                    if (window.customElements && window.customElements.upgrade && el.tagName && el.tagName.toLowerCase().startsWith('aws-')){
                        try{ window.customElements.upgrade(el); }catch(e){}
                    }
                    // re-emit events to ensure widgets refresh
                    try{ el.dispatchEvent(new Event('input',{bubbles:true})); }catch(e){}
                    try{ el.dispatchEvent(new Event('change',{bubbles:true})); }catch(e){}
                    try{ el.dispatchEvent(new Event('value-changed',{bubbles:true})); }catch(e){}
                    // force re-apply of value/attribute to trigger widget update if needed
                    try{
                        if ('value' in el){ const v = el.value; el.value = v; }
                        else if (el.getAttribute && el.getAttribute('value') !== null){ const a = el.getAttribute('value'); el.setAttribute('value', a); }
                        // special-case selector: ensure aws-option selected state
                        if (el.tagName && el.tagName.toLowerCase() === 'aws-selector'){
                            try{
                                const desired = el.getAttribute && el.getAttribute('value');
                                const opts = Array.from(el.querySelectorAll ? el.querySelectorAll('aws-option') : []);
                                opts.forEach(o=>{ try{ if (desired && (o.getAttribute('data-id') === desired || o.getAttribute('value') === desired || (o.textContent && o.textContent.trim() === desired)) ) o.setAttribute('selected',''); else o.removeAttribute && o.removeAttribute('selected'); }catch(e){} });
                            }catch(e){}
                        }
                        // ensure boolean-like controls get explicit attribute
                        if (el.tagName && el.tagName.toLowerCase() === 'aws-bool'){ try{ if ('value' in el) el.value = !!el.value; else el.setAttribute && el.setAttribute('value', !!el.getAttribute('value')); }catch(e){} }
                    }catch(e){}
                }catch(e){}
            });
        }catch(e){ console.error('upgradeAndNotify error', e); }
    }

    // init
    document.addEventListener('DOMContentLoaded', function(){
        createSidebar();
        // activate first category by default, but wait for widgets to be ready (best-effort)
        const first = categories[0]; const firstLink = document.getElementById('params-nav-' + first.id);
        const doActivate = ()=>{ if (firstLink) { firstLink.classList.add('active'); loadCategory(first.id); } };
        try{ waitForWidgets(3000).then(()=>{ doActivate(); }).catch(()=>{ doActivate(); }); }catch(e){ doActivate(); }
    });

    // Debug diagnostic: check customElements registration and upgrade timing
    (function runWidgetDiagnostics(){
        try{
            const check = () => {
                try{
                    const tags = ['aws-input','aws-bool','aws-selector','aws-button'];
                    tags.forEach(t => {
                        const ce = (window.customElements && window.customElements.get) ? window.customElements.get(t) : null;
                        console.log('[SP_diag] customElements.get', t, '=>', !!ce);
                        if (window.customElements && window.customElements.whenDefined){
                            window.customElements.whenDefined(t).then(()=>console.log('[SP_diag] whenDefined resolved for', t)).catch(()=>{});
                        }
                    });
                    // create temporary aws-input and log upgrade state
                    const tmp = document.createElement('aws-input'); tmp.id = 'sp-debug-temp-input'; tmp.style.display='none'; document.body.appendChild(tmp);
                    console.log('[SP_diag] tmp created tag=', tmp.tagName, 'hasValueProp=', ('value' in tmp), 'isConnected=', tmp.isConnected);
                    setTimeout(()=>{ try{ const el = document.getElementById('sp-debug-temp-input'); if(el){ console.log('[SP_diag] after timeout hasValueProp=', ('value' in el), 'attrValue=', el.getAttribute && el.getAttribute('value')); el.remove(); } }catch(e){} }, 2000);
                }catch(e){ console.warn('SP_diag check error', e); }
            };
            if (document.readyState === 'complete' || document.readyState === 'interactive') check(); else document.addEventListener('DOMContentLoaded', check);
            window.SP_runParamsDiagnostics = function(){ try{ check(); return true; }catch(e){ console.warn('SP_runParamsDiagnostics error', e); return false; } };
        }catch(e){ }
    })();

    // expose for tests
    window.SP_parameters_main = { createSidebar, loadCategory };
})();