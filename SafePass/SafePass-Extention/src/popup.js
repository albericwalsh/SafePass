// src/popup.js
// helper: ensure aws-input fallback and value accessors
function ensureAwsInputFallback() {
    try {
        const awsEl = document.querySelector('aws-input#ext-token-input');
        if (!awsEl) return;
        // if custom element not defined, replace with native input
        if (!customElements.get || !customElements.get('aws-input')) {
            const native = document.createElement('input');
            native.type = awsEl.getAttribute('type') || 'text';
            native.id = awsEl.id || 'ext-token-input';
            native.className = 'token-input';
            if (awsEl.getAttribute('placeholder')) native.placeholder = awsEl.getAttribute('placeholder');
            // migrate value attribute if present
            const v = awsEl.getAttribute('value') || '';
            native.value = v;
            awsEl.replaceWith(native);
        }
    } catch (e) {
        console.warn('ensureAwsInputFallback error', e);
    }
}

function getTokenValue() {
    const el = document.getElementById('ext-token-input');
    if (!el) return '';
    try {
        if (el.tagName && el.tagName.toLowerCase() === 'aws-input') {
            // aws-input may expose .value or contain an input
            if (typeof el.value !== 'undefined') return String(el.value || '').trim();
            const inner = el.querySelector && el.querySelector('input');
            return inner ? String(inner.value || '').trim() : (el.getAttribute('value') || '').trim();
        }
        return String(el.value || '').trim();
    } catch (e) { return '' }
}

function setTokenValue(v) {
    const el = document.getElementById('ext-token-input');
    if (!el) return;
    try {
        if (el.tagName && el.tagName.toLowerCase() === 'aws-input') {
            if (typeof el.value !== 'undefined') { el.value = v; return; }
            const inner = el.querySelector && el.querySelector('input');
            if (inner) { inner.value = v; return; }
            el.setAttribute('value', v);
            return;
        }
        el.value = v;
    } catch (e) {}
}

// update connection status
function updateStatus() {
    chrome.runtime.sendMessage({ action: 'getStatus' }, (response) => {
        const statusElement = document.getElementById('status');
        const reloadBtn = document.getElementById('reload-connection');
        if (!statusElement) return;
        if (chrome.runtime.lastError) {
            statusElement.textContent = 'Erreur: ' + chrome.runtime.lastError.message;
            statusElement.classList.add('failed');
            if (reloadBtn) { reloadBtn.style.display = 'inline-block'; }
            return;
        }
        if (!response || typeof response.status === 'undefined') {
            statusElement.textContent = 'Statut inconnu';
            statusElement.classList.remove('failed');
            if (reloadBtn) reloadBtn.style.display = 'inline-block';
            return;
        }
        // If server disabled detection, show disabled state
        if (typeof response.detectEnabled !== 'undefined' && response.detectEnabled === false){
            statusElement.textContent = 'Extension désactivée (detection inactive)';
            statusElement.classList.add('failed');
            if (reloadBtn) reloadBtn.style.display = 'none';
            return;
        }
        if (response.status) {
            statusElement.textContent = 'Connexion réussie';
            statusElement.classList.remove('failed');
            if (reloadBtn) reloadBtn.style.display = 'none';
        } else {
            statusElement.textContent = 'Échec de la connexion';
            statusElement.classList.add('failed');
            if (reloadBtn) reloadBtn.style.display = 'inline-block';
        }
    });
}

// fetch detect_enabled from app settings
async function fetchDetectEnabled() {
    try {
        const res = await fetch('http://localhost:5000/settings', { cache: 'no-store' });
        if (!res.ok) return null;
        const j = await res.json().catch(()=>null);
        if (!j) return null;
        if (j && j.settings && typeof j.settings.detect_enabled !== 'undefined') return !!j.settings.detect_enabled;
        if (typeof j.detect_enabled !== 'undefined') return !!j.detect_enabled;
        return null;
    } catch (e) {
        return null;
    }
}

function updateDetectUI(enabled) {
    const el = document.getElementById('detect-status');
    if (!el) return;
    el.classList.remove('detect-on','detect-off','loading','muted');
    if (enabled === null) {
        el.textContent = 'Impossible de lire le paramètre detection';
        el.classList.add('detect-off');
        return;
    }
    if (enabled) {
        el.textContent = 'Detection: activé';
        el.classList.add('detect-on');
    } else {
        el.textContent = 'Detection: désactivé';
        el.classList.add('detect-off');
    }
}

// token management
function refreshTokenDisplay() {
    const el = document.getElementById('current-token');
    chrome.storage.local.get('ext_token', (st) => {
        const token = st && st.ext_token ? st.ext_token : null;
        if (!el) return;
        el.textContent = token ? (token.length > 8 ? token.slice(0,5) + '...' : token) : '(non défini)';
    });
}

document.addEventListener('DOMContentLoaded', () => {
    // ensure aws-input fallback before wiring handlers
    ensureAwsInputFallback();
    updateStatus();
    refreshTokenDisplay();
    updateTokenValidity();
    // Ask background to refresh toolbar icon according to token validity
    try { chrome.runtime.sendMessage({ action: 'checkToken' }, () => {}); } catch(e) {}

    const saveBtn = document.getElementById('save-token');
    const clearBtn = document.getElementById('clear-token');
    const reloadBtn = document.getElementById('reload-connection');

    if (saveBtn) {
        saveBtn.addEventListener('click', () => {
            const v = getTokenValue();
            if (!v) return alert('Entrez un jeton non vide');
            chrome.storage.local.set({ ext_token: v }, () => {
                setTokenValue(v);
                refreshTokenDisplay();
                updateTokenValidity();
                try { chrome.runtime.sendMessage({ action: 'checkToken' }, () => {}); } catch(e) {}
                alert('Jeton enregistré');
            });
        });
    }

    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            chrome.storage.local.remove('ext_token', () => {
                setTokenValue('');
                refreshTokenDisplay();
                updateTokenValidity();
                try { chrome.runtime.sendMessage({ action: 'checkToken' }, () => {}); } catch(e) {}
                alert('Jeton effacé');
            });
        });
    }

    if (reloadBtn) {
        reloadBtn.addEventListener('click', async () => {
            reloadBtn.disabled = true;
            reloadBtn.textContent = '…';
            chrome.runtime.sendMessage({ action: 'testConnection' }, (resp) => {
                // restore UI
                reloadBtn.disabled = false;
                reloadBtn.textContent = '↻';
                try { updateStatus(); } catch (e) {}
                if (chrome.runtime.lastError) {
                    alert('Erreur: ' + chrome.runtime.lastError.message);
                }
            });
        });
    }
    // poll application settings for detect_enabled every 3s and update UI
    (async function pollDetect() {
        try {
            const el = document.getElementById('detect-status'); if (el) { el.classList.remove('detect-on','detect-off'); el.classList.add('loading'); }
            const enabled = await fetchDetectEnabled();
            updateDetectUI(enabled);
        } catch(e) { updateDetectUI(null); }
        setTimeout(pollDetect, 3000);
    })();
});

    // Check token validity by comparing stored token to server token and expiry
    function updateTokenValidity() {
        const icon = document.getElementById('token-valid-icon');
        if (!icon) return;
        chrome.storage.local.get('ext_token', (st) => {
            const local = st && st.ext_token ? st.ext_token : null;
            if (!local) {
                icon.className = 'token-icon invalid';
                icon.textContent = '●';
                icon.title = 'Aucun token défini';
                return;
            }
            // query server for current token
            fetch('http://localhost:5000/extension/token', { cache: 'no-store' })
                .then(r => r.json())
                .then(j => {
                    if (j && j.status === 'ok' && j.token) {
                        const serverToken = j.token;
                        let ok = (serverToken === local);
                        if (ok && j.expires_at) {
                            const exp = Date.parse(j.expires_at);
                            if (!isNaN(exp) && exp <= Date.now()) ok = false;
                        }
                        if (ok) {
                            icon.className = 'token-icon valid';
                            icon.title = 'Token valide';
                        } else {
                            icon.className = 'token-icon invalid';
                            icon.title = 'Token invalide ou expiré';
                        }
                    } else {
                        icon.className = 'token-icon invalid';
                        icon.title = 'Impossible de récupérer le token serveur';
                    }
                    icon.textContent = '●';
                })
                        .catch((e) => {
                            icon.className = 'token-icon invalid';
                            icon.textContent = '●';
                            icon.title = 'Erreur réseau';
                        });
                });
    }
