// Apply app theme based on settings.display.theme or top-level theme
(function(){
    async function fetchSettings(){
        try{
            if (window.SP_params && typeof window.SP_params.loadSettings === 'function'){
                return await window.SP_params.loadSettings();
            }
            const r = await fetch('/settings', {cache:'no-store'}).catch(()=>null);
            if (!r || !r.ok) return null;
            try{ return await r.json(); }catch(e){ return null; }
        }catch(e){ return null; }
    }

    async function loadThemeDefinitions(){
        try{
            const r = await fetch('/styles/themes.json', {cache:'no-store'}).catch(()=>null);
            if (!r || !r.ok) return null;
            return await r.json().catch(()=>null);
        }catch(e){ return null; }
    }

    function applyTheme(theme, defs){
        try{
            // determine resolved theme
            let resolved = theme || 'system';
            if (resolved === 'system') {
                const dark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
                resolved = dark ? 'dark' : 'light';
            }

            // set data attribute for CSS or other scripts to read
            try{ document.documentElement.setAttribute('data-sp-theme', resolved); }catch(e){}

            const root = document.documentElement;
            // If theme definitions provided, apply the variable map for chosen theme
            try{
                if (defs && typeof defs === 'object'){
                    // prefer explicit 'light' or 'dark' entries; resolve 'system' to 'light' or 'dark' first
                    let key = resolved === 'dark' ? 'dark' : 'light';
                    const map = defs[key] || defs[resolved] || defs[key];
                    if (map && typeof map === 'object'){
                        Object.keys(map).forEach(k => {
                            try{ root.style.setProperty(k, map[k]); }catch(e){}
                        });
                    }
                }
            }catch(e){ }

            // Fallback: if no defs or missing vars, set a minimal sensible palette
            try{
                if (!root.style.getPropertyValue('--sp-text')) root.style.setProperty('--sp-text', '#0b1220');
                if (!root.style.getPropertyValue('--sp-card')) root.style.setProperty('--sp-card', '#ffffff');
                if (!root.style.getPropertyValue('--sp-panel-bg')) root.style.setProperty('--sp-panel-bg', 'var(--sp-card)');
                if (!root.style.getPropertyValue('--sp-panel-text')) root.style.setProperty('--sp-panel-text', 'var(--sp-text)');
            }catch(e){}
        }catch(e){ console.warn('applyTheme error', e); }
    }

    async function init(){
        try{
            const raw = await fetchSettings();
            const s = (raw && raw.settings) ? raw.settings : (raw || {});
            const theme = (s && s.display && s.display.theme) ? s.display.theme : (s && s.theme) ? s.theme : 'system';
            const defs = await loadThemeDefinitions();
            applyTheme(theme, defs);

            // observe changes to system theme when using 'system'
            if (window.matchMedia){
                const mq = window.matchMedia('(prefers-color-scheme: dark)');
                mq.addEventListener && mq.addEventListener('change', (ev)=>{
                    // Only update if settings say 'system'
                    (async ()=>{
                        const raw2 = await fetchSettings();
                        const s2 = (raw2 && raw2.settings) ? raw2.settings : (raw2 || {});
                        const t = (s2 && s2.display && s2.display.theme) ? s2.display.theme : (s2 && s2.theme) ? s2.theme : 'system';
                        const defs2 = await loadThemeDefinitions();
                        if (t === 'system') applyTheme('system', defs2);
                    })();
                });
            }
        }catch(e){ console.warn('theme init failed', e); }
    }

    // expose a helper so parameters UI can re-apply after save
    window.applyAppTheme = function(){ (async ()=>{ try{ const raw = await fetchSettings(); const s = (raw && raw.settings) ? raw.settings : (raw || {}); const theme = (s && s.display && s.display.theme) ? s.display.theme : (s && s.theme) ? s.theme : 'system'; applyTheme(theme); }catch(e){} })(); };

    if (document.readyState === 'complete' || document.readyState === 'interactive') init(); else document.addEventListener('DOMContentLoaded', init);
})();
