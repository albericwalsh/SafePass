(function(){
    // Validate configured data and token paths and show alert if invalid
    async function getSettings(){
        const proto = window.location.protocol;
        const host = window.location.hostname;
        const isFrontendDev = (window.location.port === '3000');
        const backendBase = `${proto}//${host}:5000`;
        const url = isFrontendDev ? (backendBase + '/settings') : '/settings';
        try{
            const r = await fetch(url,{cache:'no-store'});
            if (!r || !r.ok) return null;
            const j = await r.json().catch(()=>null);
            return j && j.settings ? j.settings : j;
        }catch(e){ return null; }
    }

    async function validatePath(path, opts){
        try{
            const proto = window.location.protocol;
            const host = window.location.hostname;
            const isFrontendDev = (window.location.port === '3000');
            const backendBase = `${proto}//${host}:5000`;
            const url = isFrontendDev ? (backendBase + '/validate-path') : '/validate-path';
            const resp = await fetch(url, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ path: path, mode: (opts && opts.directory) ? 'directory' : 'file' }) });
            const body = await (resp ? resp.json().catch(()=>null) : null);
            return { ok: !!(resp && resp.ok), body };
        }catch(e){ return null; }
    }

    async function check(){
        const s = await getSettings();
        if (!s) return;
        const storage = s.storage || s;
        const dataPath = storage && storage.data_path ? storage.data_path : s.data_path;
        const tokenPath = storage && storage.token_path ? storage.token_path : s.token_path;

            try{
                // call server to validate; only show alert when server explicitly reports invalid
                const vd = await validatePath(dataPath, {directory:false});
                if (vd && vd.body){
                    if (vd.ok === false || (vd.body && vd.body.valid === false)){
                        const msg = (vd.body && (vd.body.message || vd.body.error)) ? (vd.body.message || vd.body.error) : ('Chemin des données invalide: ' + (vd.body.path || dataPath));
                        try{ showAlertMessage(msg, '--sp-alert'); }catch(e){}
                    }
                }

                const vt = await validatePath(tokenPath, {directory:false});
                if (vt && vt.body){
                    if (vt.ok === false || (vt.body && vt.body.valid === false)){
                        const msg = (vt.body && (vt.body.message || vt.body.error)) ? (vt.body.message || vt.body.error) : ('Chemin du token invalide: ' + (vt.body.path || tokenPath));
                        try{ showAlertMessage(msg, '--sp-alert'); }catch(e){}
                    }
                }
            }catch(e){ console.warn('check paths failed', e); }
    }

    // Run on document ready
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', check); else check();
})();
