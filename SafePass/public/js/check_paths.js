(function(){
    if (!window.SP_storageReadyPromise || typeof window.SP_storageReadyPromise.then !== 'function') {
        window.SP_storageReadyPromise = new Promise((resolve) => {
            window.SP_storageReadyPromiseResolve = resolve;
        });
    }

    function markStorageReady(isReady){
        try { window.SP_storage_ready = !!isReady; } catch(e) {}
        try {
            if (typeof window.SP_storageReadyPromiseResolve === 'function') {
                const resolver = window.SP_storageReadyPromiseResolve;
                window.SP_storageReadyPromiseResolve = null;
                resolver(!!isReady);
            }
        } catch (e) {}
    }

    function tr(key, fallback){
        try{
            if (window.t && typeof window.t === 'function'){
                const v = window.t(key);
                if (v && v !== key) return v;
            }
        }catch(e){}
        return fallback;
    }

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

    async function selectPath(mode){
        try{
            const proto = window.location.protocol;
            const host = window.location.hostname;
            const isFrontendDev = (window.location.port === '3000');
            const backendBase = `${proto}//${host}:5000`;
            const url = isFrontendDev ? (backendBase + '/select-path') : '/select-path';
            const r = await fetch(url, {
                method: 'POST',
                headers: {'Content-Type':'application/json'},
                body: JSON.stringify({ mode: mode || 'file' })
            });
            const j = await (r ? r.json().catch(()=>null) : null);
            if (!j || j.status !== 'ok' || !j.path) return null;
            return String(j.path || '');
        }catch(e){ return null; }
    }

    async function saveStoragePaths(dataPath, tokenPath){
        const proto = window.location.protocol;
        const host = window.location.hostname;
        const isFrontendDev = (window.location.port === '3000');
        const backendBase = `${proto}//${host}:5000`;
        const url = isFrontendDev ? (backendBase + '/settings') : '/settings';
        const payload = {
            storage: {
                data_path: String(dataPath || ''),
                token_path: String(tokenPath || '')
            }
        };
        const resp = await fetch(url, {
            method: 'POST',
            headers: {'Content-Type':'application/json'},
            body: JSON.stringify(payload)
        });
        if (!resp || !resp.ok) {
            let msg = 'HTTP ' + (resp ? resp.status : 'error');
            try {
                const j = await resp.json();
                if (j && (j.error || j.message)) msg = j.error || j.message;
            } catch (e) {}
            throw new Error(msg);
        }
        return true;
    }

    async function ensureTokenFile(tokenPath){
        const proto = window.location.protocol;
        const host = window.location.hostname;
        const isFrontendDev = (window.location.port === '3000');
        const backendBase = `${proto}//${host}:5000`;
        const url = isFrontendDev ? (backendBase + '/ensure-token') : '/ensure-token';
        const resp = await fetch(url, {
            method: 'POST',
            headers: {'Content-Type':'application/json'},
            body: JSON.stringify({ token_path: String(tokenPath || '') })
        });
        if (!resp || !resp.ok) {
            let msg = 'HTTP ' + (resp ? resp.status : 'error');
            try {
                const j = await resp.json();
                if (j && (j.error || j.message)) msg = j.error || j.message;
            } catch (e) {}
            throw new Error(msg);
        }
        return true;
    }

    async function initializeEncryptedDataFile(dataPath){
        const proto = window.location.protocol;
        const host = window.location.hostname;
        const isFrontendDev = (window.location.port === '3000');
        const backendBase = `${proto}//${host}:5000`;
        const url = isFrontendDev ? (backendBase + '/initialize-data-file') : '/initialize-data-file';
        const resp = await fetch(url, {
            method: 'POST',
            headers: {'Content-Type':'application/json'},
            body: JSON.stringify({ data_path: String(dataPath || '') })
        });
        if (!resp || !resp.ok) {
            let msg = 'HTTP ' + (resp ? resp.status : 'error');
            try {
                const j = await resp.json();
                if (j && (j.error || j.message)) msg = j.error || j.message;
            } catch (e) {}
            throw new Error(msg);
        }
        return true;
    }

    function splitPathParts(p){
        const value = String(p || '').trim();
        if (!value) return { dir: '', file: '' };
        const normalized = value.replace(/\\/g, '/');
        const idx = normalized.lastIndexOf('/');
        if (idx < 0) return { dir: '', file: normalized };
        return {
            dir: normalized.slice(0, idx).replace(/\//g, '\\'),
            file: normalized.slice(idx + 1)
        };
    }

    function joinPath(dir, file){
        const d = String(dir || '').trim().replace(/[\\/]+$/g, '');
        const f = String(file || '').trim().replace(/^[\\/]+/g, '');
        if (!d) return f;
        if (!f) return d;
        return d + '\\' + f;
    }

    function toTokenPathFromDataPath(dataPath){
        const parts = splitPathParts(dataPath);
        const filename = String(parts.file || '').trim();
        const dot = filename.lastIndexOf('.');
        const base = dot > 0 ? filename.slice(0, dot) : (filename || 'data_encrypted');
        return joinPath(parts.dir, base + '.token');
    }

    function makePathInputLikeStorage(id, value, opts){
        try {
            if (window.SP_params && typeof window.SP_params.makePathInput === 'function') {
                return window.SP_params.makePathInput(id, value || '', opts || {});
            }
            const container = document.createElement('div');
            container.className = 'path-input-wrap';
            container.style = 'display:flex;align-items:center;gap:6px;';
            const input = document.createElement('aws-input');
            input.id = id;
            input.setAttribute('mode', 'edit');
            input.setAttribute('type', 'text');
            if (typeof value !== 'undefined' && value !== null) input.setAttribute('value', String(value));
            input.style = 'flex:1;min-width:0;vertical-align:middle';
            const btn = document.createElement('aws-icon-button');
            btn.setAttribute('variant','ghost');
            btn.setAttribute('size','sm');
            btn.className = 'path-btn';
            btn.style = 'flex:0 0 32px;width:32px;height:28px;vertical-align:middle;padding:0;';
            btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="currentColor"><path d="M10 4H4C2.895 4 2 4.895 2 6V18C2 19.105 2.895 20 4 20H20C21.105 20 22 19.105 22 18V8C22 6.895 21.105 6 20 6H12L10 4Z"/></svg>';
            container.appendChild(input);
            container.appendChild(btn);

            let selecting = false;
            btn.addEventListener('click', async (e)=>{
                e.preventDefault();
                e.stopPropagation();
                if (selecting) return;
                selecting = true;
                btn.setAttribute('disabled', 'true');
                try {
                    const p = await selectPath((opts && opts.directory) ? 'directory' : 'file');
                    if (!p) return;
                    if (window.SP_params && typeof window.SP_params.setVal === 'function') {
                        window.SP_params.setVal(id, p);
                    } else {
                        input.value = p;
                        try { input.setAttribute('value', p); } catch (e2) {}
                    }
                } finally {
                    setTimeout(()=>{
                        try { btn.removeAttribute('disabled'); } catch(e2) {}
                        selecting = false;
                    }, 400);
                }
            });
            return container;
        } catch (e) {
            const fallback = document.createElement('aws-input');
            fallback.id = id;
            fallback.setAttribute('mode', 'edit');
            fallback.setAttribute('type', 'text');
            if (typeof value !== 'undefined' && value !== null) fallback.setAttribute('value', String(value));
            return fallback;
        }
    }

    function getPathVal(id){
        try {
            if (window.SP_params && typeof window.SP_params.getVal === 'function') {
                return String(window.SP_params.getVal(id) || '');
            }
        } catch (e) {}
        try {
            const el = document.getElementById(id);
            if (!el) return '';
            if (typeof el.value !== 'undefined') return String(el.value || '');
            return String(el.getAttribute('value') || '');
        } catch (e) {
            return '';
        }
    }

    function hideMainDataViews(){
        try {
            const searchBar = document.querySelector('.search-bar');
            const tableEl = document.getElementById('dynamic-table');
            if (searchBar) searchBar.style.display = 'none';
            if (tableEl) tableEl.style.display = 'none';
        } catch (e) {}
    }

    async function showStartupStorageSetupInline(currentDataPath, currentTokenPath){
        if (window.SP_startup_setup_rendered) return;
        window.SP_startup_setup_rendered = true;

        hideMainDataViews();
        const statsView = document.getElementById('stats-view');
        if (!statsView) {
            markStorageReady(false);
            return;
        }

        statsView.style.display = '';
        statsView.innerHTML = '';

        const root = document.createElement('div');
        root.className = 'sp-stats-page';
        const title = document.createElement('h2');
        title.className = 'sp-stats-title';
        title.textContent = tr('startup_storage_title', 'Configuration initiale du stockage');
        root.appendChild(title);

        const info = document.createElement('div');
        info.className = 'sp-anssi-details';
        info.style.marginBottom = '12px';
        info.textContent = tr('startup_storage_help', 'Aucun fichier de données valide détecté. Choisissez Créer ou Ouvrir un fichier existant.');
        root.appendChild(info);

        const switcher = document.createElement('div');
        switcher.className = 'form-actions';
        switcher.style.marginBottom = '12px';
        const btnCreate = document.createElement('aws-button');
        btnCreate.setAttribute('variant', 'primary');
        btnCreate.textContent = tr('startup_create', 'Créer un nouveau fichier');
        const btnOpen = document.createElement('aws-button');
        btnOpen.setAttribute('variant', 'secondary');
        btnOpen.textContent = tr('startup_open', 'Ouvrir un fichier existant');
        switcher.appendChild(btnCreate);
        switcher.appendChild(btnOpen);
        root.appendChild(switcher);

        const panelCreate = document.createElement('div');
        panelCreate.className = 'params-form';
        const panelOpen = document.createElement('div');
        panelOpen.className = 'params-form';
        panelOpen.style.display = 'none';

        const mkRow = (labelText, controlEl) => {
            const row = document.createElement('div');
            row.className = 'param-row';
            const name = document.createElement('div');
            name.className = 'param-name';
            name.textContent = labelText;
            const val = document.createElement('div');
            val.className = 'param-value';
            try{ if (controlEl && controlEl.classList && controlEl.classList.contains('path-input-wrap')) val.classList.add('param-control-wrap'); }catch(e){}
            val.appendChild(controlEl);
            row.appendChild(name);
            row.appendChild(val);
            return row;
        };

        const createGrid = document.createElement('div');
        createGrid.className = 'params-grid';
        const createDirControl = makePathInputLikeStorage('startup-create-dir', '', { directory: true });
        const createName = document.createElement('aws-input');
        createName.id = 'startup-create-name';
        createName.setAttribute('mode', 'edit');
        createName.setAttribute('type', 'text');
        createName.setAttribute('value', 'data_encrypted.sfpss');
        createGrid.appendChild(mkRow(tr('startup_folder_label', 'Dossier'), createDirControl));
        createGrid.appendChild(mkRow(tr('startup_filename_label', 'Nom du fichier'), createName));
        panelCreate.appendChild(createGrid);

        const createDataPreview = document.createElement('div');
        createDataPreview.className = 'sp-anssi-loading';
        createDataPreview.style.marginTop = '8px';
        const createTokenPreview = document.createElement('div');
        createTokenPreview.className = 'sp-anssi-loading';
        const refreshCreatePreview = () => {
            let fileName = String(createName.value || '').trim();
            if (fileName && !/\.[a-z0-9]+$/i.test(fileName)) fileName += '.sfpss';
            const dataPath = joinPath(getPathVal('startup-create-dir'), fileName);
            const tokenPath = toTokenPathFromDataPath(dataPath);
            createDataPreview.textContent = tr('startup_data_path_preview', 'Fichier data : ') + dataPath;
            createTokenPreview.textContent = tr('startup_token_path_preview', 'Fichier token : ') + tokenPath;
        };
        panelCreate.appendChild(createDataPreview);
        panelCreate.appendChild(createTokenPreview);

        const openGrid = document.createElement('div');
        openGrid.className = 'params-grid';
        const openDataControl = makePathInputLikeStorage('startup-open-data', currentDataPath || '', { directory: false });
        const openTokenControl = makePathInputLikeStorage('startup-open-token', currentTokenPath || '', { directory: false });
        openGrid.appendChild(mkRow(tr('startup_existing_data_label', 'Chemin du fichier data'), openDataControl));
        openGrid.appendChild(mkRow(tr('startup_existing_token_label', 'Chemin du fichier token'), openTokenControl));
        panelOpen.appendChild(openGrid);

        root.appendChild(panelCreate);
        root.appendChild(panelOpen);

        const status = document.createElement('div');
        status.id = 'startup-storage-status';
        status.style.color = 'var(--sp-error)';
        status.style.minHeight = '18px';
        status.style.marginTop = '10px';
        root.appendChild(status);

        const actions = document.createElement('div');
        actions.className = 'form-actions';
        actions.style.marginTop = '12px';
        const btnApply = document.createElement('aws-button');
        btnApply.setAttribute('variant', 'primary');
        btnApply.textContent = tr('confirm', 'Valider');
        actions.appendChild(btnApply);
        root.appendChild(actions);

        statsView.appendChild(root);

        let mode = 'create';
        const setMode = (m) => {
            mode = m === 'open' ? 'open' : 'create';
            panelCreate.style.display = mode === 'create' ? '' : 'none';
            panelOpen.style.display = mode === 'open' ? '' : 'none';
            btnCreate.setAttribute('variant', mode === 'create' ? 'primary' : 'secondary');
            btnOpen.setAttribute('variant', mode === 'open' ? 'primary' : 'secondary');
            status.textContent = '';
        };
        btnCreate.addEventListener('click', ()=> setMode('create'));
        btnOpen.addEventListener('click', ()=> setMode('open'));

        createName.addEventListener('input', refreshCreatePreview);
        createName.addEventListener('change', refreshCreatePreview);
        const createDirInput = document.getElementById('startup-create-dir');
        if (createDirInput) {
            createDirInput.addEventListener('input', refreshCreatePreview);
            createDirInput.addEventListener('change', refreshCreatePreview);
            createDirInput.addEventListener('value-changed', refreshCreatePreview);
        }
        refreshCreatePreview();

        btnApply.addEventListener('click', async ()=>{
            status.textContent = '';
            try {
                if (mode === 'create') {
                    const dir = String(getPathVal('startup-create-dir') || '').trim();
                    let filename = String(createName.value || '').trim();
                    if (!dir) { status.textContent = tr('startup_folder_required', 'Veuillez choisir un dossier.'); return; }
                    if (!filename) { status.textContent = tr('startup_filename_required', 'Veuillez saisir un nom de fichier.'); return; }
                    if (!/\.[a-z0-9]+$/i.test(filename)) filename += '.sfpss';

                    const vd = await validatePath(dir, { directory: true });
                    const dirOk = !!(vd && vd.body && vd.body.valid);
                    if (!dirOk) { status.textContent = tr('startup_folder_invalid', 'Le dossier choisi est invalide.'); return; }

                    const dataPath = joinPath(dir, filename);
                    const tokenPath = toTokenPathFromDataPath(dataPath);
                    await saveStoragePaths(dataPath, tokenPath);
                    await ensureTokenFile(tokenPath);
                    await initializeEncryptedDataFile(dataPath);
                    markStorageReady(true);
                    try { window.location.reload(); } catch (e) { location.reload(); }
                    return;
                }

                const dataPath = String(getPathVal('startup-open-data') || '').trim();
                const tokenPath = String(getPathVal('startup-open-token') || '').trim();
                if (!dataPath || !tokenPath) {
                    status.textContent = tr('startup_paths_required', 'Veuillez renseigner les chemins data et token.');
                    return;
                }

                const vd = await validatePath(dataPath, { directory: false });
                const vt = await validatePath(tokenPath, { directory: false });
                const dataOk = !!(vd && vd.body && vd.body.valid);
                const tokenOk = !!(vt && vt.body && vt.body.valid);
                if (!dataOk || !tokenOk) {
                    status.textContent = tr('startup_existing_invalid', 'Fichier data ou token invalide/introuvable.');
                    return;
                }

                await saveStoragePaths(dataPath, tokenPath);
                markStorageReady(true);
                try { window.location.reload(); } catch (e) { location.reload(); }
            } catch (e) {
                status.textContent = e && e.message ? e.message : tr('error', 'Erreur');
            }
        });
    }

    async function check(){
        const s = await getSettings();
        if (!s) { markStorageReady(false); return; }
        const storage = s.storage || s;
        const dataPath = storage && storage.data_path ? storage.data_path : s.data_path;
        const tokenPath = storage && storage.token_path ? storage.token_path : s.token_path;
        const hasDataPath = !!String(dataPath || '').trim();
        const hasTokenPath = !!String(tokenPath || '').trim();

        try{
            const vd = hasDataPath ? await validatePath(dataPath, {directory:false}) : null;
            const dataValid = hasDataPath && !!(vd && vd.body && vd.body.valid);
            if (hasDataPath && vd && vd.body && (vd.ok === false || vd.body.valid === false)) {
                const msg = (vd.body && (vd.body.message || vd.body.error)) ? (vd.body.message || vd.body.error) : ('Chemin des données invalide: ' + (vd.body.path || dataPath));
                try{ showAlertMessage(msg, '--sp-alert'); }catch(e){}
            }

            const vt = hasTokenPath ? await validatePath(tokenPath, {directory:false}) : null;
            const tokenValid = hasTokenPath && !!(vt && vt.body && vt.body.valid);
            if (hasTokenPath && vt && vt.body && (vt.ok === false || vt.body.valid === false)) {
                const msg = (vt.body && (vt.body.message || vt.body.error)) ? (vt.body.message || vt.body.error) : ('Chemin du token invalide: ' + (vt.body.path || tokenPath));
                try{ showAlertMessage(msg, '--sp-alert'); }catch(e){}
            }

            const readyNow = dataValid && tokenValid;
            if (readyNow) {
                markStorageReady(true);
                return;
            }

            markStorageReady(false);
            await showStartupStorageSetupInline(dataPath, tokenPath);
        }catch(e){
            console.warn('check paths failed', e);
            markStorageReady(false);
        }
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', check); else check();
})();
