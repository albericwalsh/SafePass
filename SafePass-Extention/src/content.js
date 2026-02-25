// src/content.js - content script that relies on utils.js (loaded first)
const SP_DEBUG = (typeof globalThis !== 'undefined' && globalThis.__SAFEPASS_DEBUG__ === true);
function spInfo(...args) {
    if (!SP_DEBUG) return;
    try { console.info(...args); } catch (e) {}
}
function spDebug(...args) {
    if (!SP_DEBUG) return;
    try { console.debug(...args); } catch (e) {}
}

// create or return a Shadow DOM host to isolate modal styles from page CSS
function getModalHost() {
    const HOST_ID = 'safepass-credentials-host';
    let host = document.getElementById(HOST_ID);
    if (host) return host.shadowRoot;

    host = document.createElement('div');
    host.id = HOST_ID;
    Object.assign(host.style, {
        position: 'fixed', right: '6%', top: '8%', zIndex: 2147483647, pointerEvents: 'auto'
    });
    const sr = host.attachShadow({ mode: 'open' });
    const container = document.createElement('div');
    container.id = 'safepass-credentials-modal';

    const style = document.createElement('style');
    // attempt to import extension font.css into the Shadow DOM
    let fontImport = '';
    try {
        if (typeof chrome !== 'undefined' && chrome.runtime && typeof chrome.runtime.getURL === 'function') {
            const fontUrl = chrome.runtime.getURL('src/font.css');
            fontImport = `@import url("${fontUrl}");\n`;
        }
    } catch (e) {}
    style.textContent = `${fontImport}` + `
    :host {
        --sp-dark: #172033;
        --sp-light: #e6eef6;
        --sp-card: #0b1220;
        --sp-accent: #21c997;
        --sp-accent-grad: linear-gradient(90deg, #21c997, #33d8b0);
        font-family: 'Quicksand', Arial, sans-serif;
        all: initial;
    }
    #safepass-credentials-modal {
        position: relative;
        display:block;
        width:380px;
        max-width:92vw;
        border-radius:12px;
        overflow:hidden;
        box-shadow:0 18px 50px rgba(3,10,30,0.6);
        background: linear-gradient(180deg, rgba(11,18,32,0.98), rgba(6,10,18,0.95));
        color: var(--sp-light);
        border:1px solid rgba(255,255,255,0.04);
    }
    .modal-inner { padding:12px; }
    .modal-title { font-weight:700; margin-bottom:6px; font-size:15px; }
    .modal-muted { color: rgba(230,238,246,0.8); font-size:12px; margin-bottom:8px }
    .cred-list { max-height:320px; overflow:auto; border-radius:8px; background: rgba(255,255,255,0.02); padding:6px }
    .cred-row {
        padding:10px;
        border-radius:8px;
        margin-bottom:8px;
        display:flex;
        flex-direction:row;
        align-items:center;
        gap:12px;
        cursor:pointer;
        transition: transform .12s ease, box-shadow .12s ease, background .12s ease;
        background: transparent;
        border:1px solid rgba(255,255,255,0.02);
    }
    .cred-row:hover { transform: translateY(-3px); box-shadow: 0 12px 28px rgba(2,8,24,0.6); background: rgba(255,255,255,0.02); }
    .cred-favicon { width:28px; height:28px; border-radius:6px; flex:0 0 28px; background: rgba(255,255,255,0.04); display:inline-block }
    .cred-main { display:flex; flex-direction:column; flex:1; min-width:0 }
    .cred-username { font-weight:600; color:var(--sp-light); font-size:14px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis }
    .cred-source { font-size:12px; color: rgba(230,238,246,0.75); margin-top:4px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis }
    .modal-actions { display:flex; justify-content:flex-end; gap:8px; margin-top:8px }
    .btn { padding:8px 10px; border-radius:10px; cursor:pointer; border:1px solid rgba(255,255,255,0.04); background:transparent; color:var(--sp-light); }
    .btn.primary { background: var(--sp-accent-grad); border:none; color:#042024 }
    @media (max-width: 420px) {
        #safepass-credentials-modal { width: calc(100vw - 24px); left: 12px; right: 12px }
        .cred-username { font-size:13px }
    }
    `;

    sr.appendChild(style);
    sr.appendChild(container);
    document.body.appendChild(host);
    return sr;
}

// track last mouse position in page coordinates to position modal near cursor
let _safeLastMouse = { x: null, y: null };
try {
    window.addEventListener('pointermove', (e) => {
        try { _safeLastMouse = { x: e.pageX, y: e.pageY }; } catch (ee) {}
    }, { passive: true });
} catch (e) {}

function collectFields() {
    const inputs = document.querySelectorAll('input[type="text"], input[type="email"], input[type="password"]');
    let username = null;
    let password = null;
    inputs.forEach(input => {
        if (input.type === 'password' && !password) password = input.value;
        else if ((input.type === 'text' || input.type === 'email') && !username) username = input.value;
    });
    try {
        const passCount = Array.from(inputs).filter(i => i.type === 'password').length;
        spInfo('SafePass: detected login fields', { domain: window.location.hostname, usernameFound: !!username, passwordCount: passCount });
    } catch (e) {}
    return { url: window.location.hostname, username, password };
}

// message handlers
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message && message.action === 'getFields') {
        const fields = collectFields();
        sendResponse(fields);
    }
    if (message && message.action === 'getUrl') {
        try {
            const u = new URL(window.location.href);
            // return only the hostname (nom de domaine) to the background script
            sendResponse({ url: u.hostname });
        } catch (e) {
            sendResponse({ url: window.location.hostname || window.location.host });
        }
    }
    if (message && message.action === 'getContext') {
        try {
            const u = new URL(window.location.href);
            sendResponse({ url: u.hostname, coords: _safeLastMouse });
        } catch (e) {
            sendResponse({ url: window.location.hostname || window.location.host, coords: _safeLastMouse });
        }
    }
    if (message && message.action === 'fillFields') {
        (async () => {
            try {
                const { username, password } = message;
                const passEls = findPasswordElements();
                const usernameCandidates = getUsernameCandidates(passEls.length ? passEls[0] : null);

                const filledUserElements = [];
                const filledPassElements = [];

                for (const ue of usernameCandidates) {
                    if (typeof username !== 'undefined' && username !== null) {
                        try {
                            setNativeValue(ue, username);
                            filledUserElements.push(getElementDescriptor(ue));
                        } catch (e) { console.warn('SafePass: username candidate fill error', e); }
                    }
                }

                await new Promise(r => setTimeout(r, 30));

                for (const pe of passEls) {
                    if (typeof password !== 'undefined' && password !== null) {
                        try {
                            setNativeValue(pe, password);
                            filledPassElements.push(getElementDescriptor(pe));
                        } catch (e) { console.warn('SafePass: password candidate fill error', e); }
                    }
                }

                try { spInfo('SafePass: filled username elements', filledUserElements); } catch(e) {}
                try { spInfo('SafePass: filled password elements', filledPassElements); } catch(e) {}

                sendResponse({ status: 'filled', result: { filledUserElements, filledPassElements } });
            } catch (e) {
                sendResponse({ status: 'error', error: String(e) });
            }
        })();
        return true;
    }
    if (message && message.action === 'showCredentials') {
        try {
            const matches = Array.isArray(message.matches) ? message.matches : [];
            const existing = document.getElementById('safepass-credentials-modal');
            if (existing) existing.remove();

            const sr = getModalHost();
            const hostEl = document.getElementById('safepass-credentials-host');
            const hostContainer = sr.getElementById('safepass-credentials-modal');
            if (hostContainer) {
                hostContainer.remove();
            }

            const modal = document.createElement('div');
            modal.id = 'safepass-credentials-modal';
            const inner = document.createElement('div');
            inner.className = 'modal-inner';

            const title = document.createElement('div');
            title.className = 'modal-title';
            title.textContent = 'Choisir un identifiant';
            inner.appendChild(title);

            const muted = document.createElement('div');
            muted.className = 'modal-muted';
            muted.textContent = matches.length === 0 ? 'Aucun identifiant trouvé' : `${matches.length} identifiant(s) disponible(s)`;
            inner.appendChild(muted);

            const list = document.createElement('div');
            list.className = 'cred-list';
            if (matches.length > 0) {
                matches.forEach((m) => {
                    const row = document.createElement('div');
                    row.className = 'cred-row';
                    const favicon = document.createElement('img');
                    favicon.className = 'cred-favicon';
                    try {
                        // prefer domain provided by server match (primary domain), fallback to derive from match url or current hostname
                        let favDomain = null;
                        if (m && m.domain) favDomain = m.domain;
                        else if (m && m.url) {
                            try {
                                let u = m.url;
                                if (!u.includes('://')) u = 'http://' + u;
                                favDomain = (new URL(u)).hostname.split('.').slice(-2).join('.');
                            } catch (e) {
                                favDomain = window.location.hostname;
                            }
                        } else {
                            favDomain = window.location.hostname;
                        }
                        // transforme favDomain (auth.google.com -> google.com) to increase chances of favicon being available, but fallback to full domain if needed
                        favDomain = favDomain.split('.').slice(-2).join('.');
                        favicon.src = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(favDomain)}&sz=64`;
                    } catch (e) {
                        favicon.src = '';
                    }
                    favicon.alt = '';
                    favicon.loading = 'lazy';

                    const u = document.createElement('div'); u.className = 'cred-username'; u.textContent = m.username || '(vide)';
                    const s = document.createElement('div'); s.className = 'cred-source'; s.textContent = m.source || '';
                    const main = document.createElement('div'); main.className = 'cred-main';
                    main.appendChild(u);
                    main.appendChild(s);
                    row.appendChild(favicon);
                    row.appendChild(main);
                    row.addEventListener('click', async () => {
                        try {
                            let passEls = findPasswordElements();
                            const filledUserElements = [];
                            const filledPassElements = [];

                            try { spDebug('SafePass: found password elements', passEls.length, passEls.map(getElementDescriptor)); } catch(e) {}
                            try { spDebug('SafePass: match data', m); } catch(e) {}

                            // choose best username field candidate (prefer proximity heuristics)
                            let usernameEl = null;
                            try {
                                usernameEl = findBestUsername(passEls.length ? passEls[0] : null) || (getUsernameCandidates(passEls.length ? passEls[0] : null)[0] || null);
                            } catch (e) { usernameEl = null; }

                            if (!usernameEl) {
                                // fallback: try any visible candidate
                                const candidates = getUsernameCandidates(passEls.length ? passEls[0] : null);
                                if (candidates && candidates.length) usernameEl = candidates[0];
                            }

                            try { spDebug('SafePass: selected username element for fill', getElementDescriptor(usernameEl)); } catch(e) {}

                            if (usernameEl && typeof m.username !== 'undefined') {
                                try { usernameEl.focus && usernameEl.focus(); setNativeValue(usernameEl, m.username); filledUserElements.push(getElementDescriptor(usernameEl)); } catch(e) { console.warn(e); }
                            }

                            // ensure we have password elements; fallback to querySelector if none found
                            if ((!passEls || passEls.length === 0)) {
                                try {
                                    const fallback = Array.from(document.querySelectorAll('input[type="password"]')).filter(isVisible);
                                    if (fallback && fallback.length) passEls = fallback;
                                } catch (e) {}
                            }

                            // small delay before filling password to avoid site scripts interfering
                            await new Promise(r => setTimeout(r, 60));

                            for (const pe of passEls) {
                                if (pe && (pe.type === 'password' || pe.getAttribute('type') === 'password') && typeof m.password !== 'undefined') {
                                    try { pe.focus && pe.focus(); setNativeValue(pe, m.password); filledPassElements.push(getElementDescriptor(pe)); } catch(e) { console.warn(e); }
                                }
                            }

                            // If still nothing filled, try first visible password input once more
                            if (filledPassElements.length === 0 && typeof m.password !== 'undefined') {
                                try {
                                    const tryOne = document.querySelector('input[type="password"]');
                                    if (tryOne && isVisible(tryOne)) { tryOne.focus && tryOne.focus(); setNativeValue(tryOne, m.password); filledPassElements.push(getElementDescriptor(tryOne)); }
                                } catch (e) {}
                            }

                            try { spInfo('SafePass: modal filled username elements', filledUserElements); } catch(e) {}
                            try { spInfo('SafePass: modal filled password elements', filledPassElements); } catch(e) {}

                            // remove host (cleans shadow root)
                            const host = document.getElementById('safepass-credentials-host');
                            if (host) host.remove();
                        } catch (e) {
                            console.warn('SafePass: error filling fields', e);
                            const host = document.getElementById('safepass-credentials-host');
                            if (host) host.remove();
                        }
                    });
                    list.appendChild(row);
                });
            }
            inner.appendChild(list);

            const actions = document.createElement('div'); actions.className = 'modal-actions';
            const close = document.createElement('button'); close.className = 'btn primary'; close.textContent = 'Fermer';
            close.addEventListener('click', () => { const host = document.getElementById('safepass-credentials-host'); if (host) host.remove(); });
            actions.appendChild(close);
            inner.appendChild(actions);

            modal.appendChild(inner);
            // position host using provided coords when available
            try {
                const coords = message.coords;
                if (hostEl && coords && typeof coords.x === 'number' && typeof coords.y === 'number') {
                    hostEl.style.left = (coords.x + 8) + 'px';
                    hostEl.style.top = (coords.y + 8) + 'px';
                    hostEl.style.right = 'auto';
                }
            } catch (e) {}
            sr.appendChild(modal);

            // make draggable by dragging the title
            try {
                const hostNode = document.getElementById('safepass-credentials-host');
                let dragging = false;
                let offsetX = 0, offsetY = 0;
                const titleEl = inner.querySelector('.modal-title');
                if (titleEl && hostNode) {
                    titleEl.style.cursor = 'move';
                    titleEl.addEventListener('pointerdown', (ev) => {
                        dragging = true;
                        offsetX = ev.clientX - hostNode.getBoundingClientRect().left;
                        offsetY = ev.clientY - hostNode.getBoundingClientRect().top;
                        ev.preventDefault();
                    });
                    window.addEventListener('pointermove', (ev) => {
                        if (!dragging) return;
                        hostNode.style.left = (ev.clientX - offsetX) + 'px';
                        hostNode.style.top = (ev.clientY - offsetY) + 'px';
                        hostNode.style.right = 'auto';
                    });
                    window.addEventListener('pointerup', () => { dragging = false; });
                }
            } catch (e) {}
            sendResponse({ status: 'shown' });
        } catch (e) {
            sendResponse({ status: 'error', error: String(e) });
        }
    }
});
