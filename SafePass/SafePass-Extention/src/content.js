// src/content.js - content script that relies on utils.js (loaded first)
try { console.info('SafePass content script loaded for', window.location.hostname); } catch(e) {}

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
    style.textContent = `
    :host { all: initial; }
    #safepass-credentials-modal { position: relative; display:block; width:360px; max-width:92vw; border-radius:14px; overflow:hidden; box-shadow:0 18px 50px rgba(3,10,30,0.6); background: rgba(8,12,20,0.96); color: var(--sp-light); font-family: Inter, Arial, sans-serif; border:1px solid rgba(255,255,255,0.04); }
    .modal-inner { padding:14px; }
    .modal-title { font-weight:700; margin-bottom:8px; font-size:14px }
    .modal-muted { color: rgba(255,255,255,0.75); font-size:12px; margin-bottom:8px }
    .cred-list { max-height:320px; overflow:auto; border-radius:10px; background: rgba(255,255,255,0.03); padding:8px }
    .cred-row { padding:10px;border-radius:10px;margin-bottom:8px; display:flex;flex-direction:column; gap:6px; cursor:pointer; transition: transform .12s ease, box-shadow .12s ease; background: rgba(0,0,0,0.12); }
    .cred-row:hover { transform: translateY(-3px); box-shadow: 0 12px 28px rgba(2,8,24,0.6) }
    .cred-username { font-weight:600; color:var(--sp-light) }
    .cred-source { font-size:12px; color: rgba(255,255,255,0.75) }
    .modal-actions { display:flex; justify-content:flex-end; gap:8px; margin-top:8px }
    .btn { padding:8px 10px; border-radius:10px; cursor:pointer; border:1px solid rgba(255,255,255,0.04); background:transparent }
    .btn.primary { background: var(--sp-accent-grad); border:none; color:var(--sp-accent-text) }
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
        console.info('SafePass: detected login fields', { domain: window.location.hostname, usernameFound: !!username, passwordCount: passCount });
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

                try { console.info('SafePass: filled username elements', filledUserElements); } catch(e) {}
                try { console.info('SafePass: filled password elements', filledPassElements); } catch(e) {}

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
                    const u = document.createElement('div'); u.className = 'cred-username'; u.textContent = m.username || '(vide)';
                    const s = document.createElement('div'); s.className = 'cred-source'; s.textContent = m.source || '';
                    row.appendChild(u); row.appendChild(s);
                    row.addEventListener('click', () => {
                        try {
                            const passEls = findPasswordElements();
                            const usernameCandidates = getUsernameCandidates(passEls.length ? passEls[0] : null);
                            const filledUserElements = [];
                            const filledPassElements = [];

                            usernameCandidates.forEach(ue => {
                                if (typeof m.username !== 'undefined') {
                                    try { setNativeValue(ue, m.username); filledUserElements.push(getElementDescriptor(ue)); } catch(e) { console.warn(e); }
                                }
                            });

                            passEls.forEach(pe => {
                                if (typeof m.password !== 'undefined') {
                                    try { setNativeValue(pe, m.password); filledPassElements.push(getElementDescriptor(pe)); } catch(e) { console.warn(e); }
                                }
                            });

                            try { console.info('SafePass: modal filled username elements', filledUserElements); } catch(e) {}
                            try { console.info('SafePass: modal filled password elements', filledPassElements); } catch(e) {}

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
