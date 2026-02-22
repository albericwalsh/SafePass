// src/background.js - service worker (moved from background.js)
let isConnected = false;
let detectEnabled = true; // mirror of server setting
let cachedExtToken = null;
console.log('Background service worker running (src)');

// Check token validity by comparing local stored token with server token
function checkTokenValidityAsync() {
    return new Promise((resolve) => {
        try {
            // refresh detect flag and bail out if disabled
            loadSettingsFlag().then(()=>{
                if (!detectEnabled){ updateIcon(false); resolve(false); return; }
                getExtToken((localToken) => {
                    if (!localToken) {
                        // no local token -> invalid
                        updateIcon(false);
                        resolve(false);
                        return;
                    }
                    fetch('http://localhost:5000/extension/token', { cache: 'no-store' })
                        .then(r => r.json())
                        .then(j => {
                            if (j && j.status === 'ok' && j.token) {
                                let valid = (j.token === localToken);
                                if (valid && j.expires_at) {
                                    const exp = Date.parse(j.expires_at);
                                    if (!isNaN(exp) && exp <= Date.now()) valid = false;
                                }
                                updateIcon(!!valid);
                                resolve(!!valid);
                            } else {
                                updateIcon(false);
                                resolve(false);
                            }
                        })
                        .catch(err => { updateIcon(false); resolve(false); });
                });
            }).catch(()=>{ updateIcon(false); resolve(false); });
        } catch (e) { updateIcon(false); resolve(false); }
    });
}

function testServerConnection() {
    console.log('Testing server connection...');
    // refresh detect flag first
    loadSettingsFlag().catch(()=>{});
    fetch('http://localhost:5000/test')
        .then(response => {
            if (response.ok) {
                console.log('Server reachable');
                isConnected = true;
                updateIcon(true);
            } else {
                console.error('Server returned error', response.status);
                isConnected = false;
                updateIcon(false);
            }
        })
        .catch(error => {
            console.error('Server unreachable:', error);
            isConnected = false;
            updateIcon(false);
        });
}

// Async version that returns a Promise and updates isConnected
function testServerConnectionAsync() {
    return loadSettingsFlag().then(()=>{
        if (!detectEnabled){ isConnected = false; updateIcon(false); return Promise.resolve(false); }
        return fetch('http://localhost:5000/test', { cache: 'no-store' })
    })
        .then(response => {
            if (response.ok) {
                isConnected = true; updateIcon(true); return true;
            }
            isConnected = false; updateIcon(false); return false;
        })
        .catch(err => { isConnected = false; updateIcon(false); return false; });
}

// Load /settings and set detectEnabled flag
function loadSettingsFlag(){
    return fetch('http://localhost:5000/settings', { cache: 'no-store' })
        .then(r=> r.ok ? r.json().catch(()=>null) : null)
        .then(j=>{
            if (j && j.settings && typeof j.settings.detect_enabled !== 'undefined'){
                detectEnabled = !!j.settings.detect_enabled;
            } else if (j && typeof j.detect_enabled !== 'undefined'){
                detectEnabled = !!j.detect_enabled;
            }
            // if detection disabled, ensure icon reflects disconnected
            if (!detectEnabled){ isConnected = false; updateIcon(false); }
            return detectEnabled;
        })
        .catch(err=>{ console.warn('Could not load settings:', err); return detectEnabled; });
}

function updateIcon(status) {
    const makePaths = (name) => ({
        16: chrome.runtime.getURL(name),
        32: chrome.runtime.getURL(name),
        48: chrome.runtime.getURL(name),
        128: chrome.runtime.getURL(name),
        512: chrome.runtime.getURL(name)
    });
    const okPaths = makePaths('icon_ok.png');
    const failedPaths = makePaths('icon_failed.png');
    try {
        const paths = status ? okPaths : failedPaths;
        console.log('Attempting setIcon with paths:', paths);
        chrome.action.setIcon({ path: paths }, async () => {
            if (chrome.runtime.lastError) {
                console.warn('setIcon(path) failed:', chrome.runtime.lastError.message, '- attempting imageData fallback');
                try {
                    const name = status ? 'icon_ok.png' : 'icon_failed.png';
                    const sizes = [16,32,48,128,512];
                    const imageMap = {};
                    for (const s of sizes) {
                        try {
                            const resp = await fetch(chrome.runtime.getURL(name));
                            const blob = await resp.blob();
                            const bmp = await createImageBitmap(blob);
                            const oc = new OffscreenCanvas(s, s);
                            const ctx = oc.getContext('2d');
                            ctx.drawImage(bmp, 0, 0, s, s);
                            const imgData = ctx.getImageData(0,0,s,s);
                            imageMap[s] = imgData;
                        } catch (e) {
                        }
                    }
                    if (Object.keys(imageMap).length > 0) {
                        chrome.action.setIcon({ imageData: imageMap }, () => {
                            if (chrome.runtime.lastError) console.error('setIcon(imageData) error:', chrome.runtime.lastError.message);
                        });
                    }
                } catch (e) {
                    console.error('imageData fallback error:', e);
                }
            }
        });
    } catch (e) {
        console.error('setIcon error:', e);
    }
}

chrome.runtime.onInstalled.addListener(() => {
    console.log('Extension installed - creating context menu and testing server');
    chrome.contextMenus.removeAll(() => {
        chrome.contextMenus.create({
            id: 'getPasswordFieldUrl',
            title: "Récupérer les identifiants",
            contexts: ['editable']
        }, () => {
            if (chrome.runtime.lastError) console.error('Context menu create error:', chrome.runtime.lastError);
            else console.log('Context menu created');
        });
    });

    testServerConnection();
    // prime cached token
    try { getExtToken(t => { cachedExtToken = t; console.log('cached ext token set:', !!t); }); } catch(e) {}
    // also check token validity and update icon
    try { checkTokenValidityAsync(); } catch(e) {}
});

chrome.runtime.onStartup.addListener(() => {
    chrome.contextMenus.removeAll(() => {
        chrome.contextMenus.create({
            id: 'getPasswordFieldUrl',
            title: "Récupérer les identifiants",
            contexts: ['editable']
        }, () => {
            if (chrome.runtime.lastError) console.error('Context menu create error (startup):', chrome.runtime.lastError);
            else console.log('Context menu created (startup)');
        });
    });
    try { checkTokenValidityAsync(); } catch(e) {}
});

chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
        id: 'getPasswordFieldUrl',
        title: "Récupérer les identifiants",
        contexts: ['editable']
    }, () => {
        if (chrome.runtime.lastError) console.error('Context menu create error (load):', chrome.runtime.lastError);
        else console.log('Context menu created (load)');
    });
});

chrome.windows.onCreated.addListener(() => {
    testServerConnection();
});

// ensure token validity icon updates when token in storage changes
try {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged && typeof chrome.storage.onChanged.addListener === 'function') {
        chrome.storage.onChanged.addListener((changes, area) => {
            if (area !== 'local') return;
            if (changes.ext_token) {
                cachedExtToken = changes.ext_token.newValue;
                console.log('cachedExtToken updated via onChanged:', !!cachedExtToken);
                try { checkTokenValidityAsync(); } catch(e) {}
            }
        });
    }
} catch (e) {}

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo && changeInfo.status === 'complete') {
        if (!isConnected) {
            console.log('Tab reloaded - re-testing server connection');
            testServerConnection();
        }
    }
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === 'getPasswordFieldUrl' && tab && tab.id) {
        // don't proceed if detection is disabled on server
        if (!detectEnabled){
            console.warn('Detection disabled; extension action blocked');
            try { chrome.notifications && chrome.notifications.create && chrome.notifications.create({ type: 'basic', iconUrl: 'icon_failed.png', title: 'SafePass', message: 'Extension désactivée (detection inactive)' }); }catch(e){}
            return;
        }
        const handleResponse = (response) => {
            if (!response) {
                console.warn('No response from content script');
                return;
            }
            const { url, username, password } = response;
            // include extension auth token header if configured in cache
            const token = cachedExtToken;
            const headers = { 'Content-Type': 'application/json' };
            if (token) headers['X-Ext-Auth'] = token;
            fetch('http://localhost:5000/saveData', {
                method: 'POST',
                headers,
                body: JSON.stringify({ extension_entry: { url, username, password } })
            })
            .then(res => res.json().then(data => ({ ok: res.ok, status: res.status, data })))
            .then(obj => {
                if (obj.ok) console.log('Fields sent to server (ack)');
                else console.error('Server error', obj.status);
            })
            .catch(err => console.error('Fetch error sending fields:', err));
        };

        // request hostname and mouse coords from content script (preferred) so placement is precise
        chrome.tabs.sendMessage(tab.id, { action: 'getContext' }, (response) => {
            if (chrome.runtime.lastError || !response || !response.url) {
                console.warn('Could not get context from content script or no response:', chrome.runtime.lastError);
                try {
                    chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['src/utils.js','src/content.js'] }, () => {
                        if (chrome.runtime.lastError) {
                            console.error('Failed to inject content script:', chrome.runtime.lastError);
                            return;
                        }
                        chrome.tabs.sendMessage(tab.id, { action: 'getContext' }, (resp2) => {
                            if (chrome.runtime.lastError || !resp2 || !resp2.url) {
                                console.error('Failed to retrieve context after injection:', chrome.runtime.lastError);
                                return;
                            }
                            requestCredentialsAndFill(tab.id, resp2.url, resp2.coords || { x: info.pageX || null, y: info.pageY || null });
                        });
                    });
                } catch (e) {
                    console.error('scripting.executeScript error:', e);
                }
                return;
            }
            requestCredentialsAndFill(tab.id, response.url, response.coords || { x: info.pageX || null, y: info.pageY || null });
        });
    }
});

// safe wrapper to read ext token from storage or browser.storage
function getExtToken(cb) {
    try {
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local && typeof chrome.storage.local.get === 'function') {
            chrome.storage.local.get('ext_token', (st) => {
                try { cb(st && st.ext_token ? st.ext_token : null); } catch(e){}
            });
            return;
        }
        if (typeof browser !== 'undefined' && browser.storage && browser.storage.local) {
            browser.storage.local.get('ext_token').then(st => cb(st && st.ext_token ? st.ext_token : null)).catch(()=>cb(null));
            return;
        }
    } catch (e) {
        console.warn('getExtToken wrapper error', e);
    }
    console.warn('Storage API unavailable, returning null token');
    cb(null);
}

// listen for storage changes to keep cache updated
try {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged && typeof chrome.storage.onChanged.addListener === 'function') {
        chrome.storage.onChanged.addListener((changes, area) => {
            if (area !== 'local') return;
            if (changes.ext_token) {
                cachedExtToken = changes.ext_token.newValue;
                console.log('cachedExtToken updated via onChanged:', !!cachedExtToken);
            }
        });
    }
} catch (e) {}

// accept runtime message to set cached token as fallback
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message && message.action === 'setExtToken') {
        cachedExtToken = message.token || null;
        try {
            if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local && typeof chrome.storage.local.set === 'function') {
                chrome.storage.local.set({ ext_token: cachedExtToken }, () => {});
            }
        } catch (e) {}
        sendResponse({ ok: true });
        return true;
    }
});

function requestCredentialsAndFill(tabId, url, coords) {
    const encoded = encodeURIComponent(url);
    try { console.log('Requesting credentials for', url, 'coords=', coords); } catch(e) {}
    chrome.storage.local.get('ext_token', (st) => {
        const token = st && st.ext_token ? st.ext_token : null;
        const headers = {};
        if (token) headers['X-Ext-Auth'] = token;
        fetch(`http://localhost:5000/credentials?url=${encoded}`, { headers })
            .then(res => res.json().then(j => ({ status: res.status, ok: res.ok, data: j })))
            .then(obj => {
                if (!obj.ok) {
                    console.warn('No credentials found or server error', obj.status);
                    // try to deliver empty result, ensure content script exists
                    sendMessageToTab(tabId, { action: 'showCredentials', matches: [], coords });
                    return;
                }
                const matches = obj.data && obj.data.matches ? obj.data.matches : [];
                console.log('Credentials matches:', matches.length);
                sendMessageToTab(tabId, { action: 'showCredentials', matches, coords });
            })
            .catch(err => console.error('Error fetching credentials:', err));
    });
}

// Helper: ensure content scripts are injected before sending a message
function sendMessageToTab(tabId, message) {
    chrome.tabs.sendMessage(tabId, message, (resp) => {
        if (!chrome.runtime.lastError) return; // delivered
        // try to inject content scripts then resend
        console.warn('sendMessage failed, attempting to inject content scripts:', chrome.runtime.lastError.message);
        try {
            chrome.scripting.executeScript({ target: { tabId }, files: ['src/utils.js','src/content.js'] }, () => {
                if (chrome.runtime.lastError) {
                    console.error('Failed to inject content scripts:', chrome.runtime.lastError);
                    return;
                }
                // resend after a short delay to allow scripts to initialize
                setTimeout(() => {
                    chrome.tabs.sendMessage(tabId, message, (resp2) => {
                        if (chrome.runtime.lastError) console.error('Failed to send message after injection:', chrome.runtime.lastError);
                    });
                }, 250);
            });
        } catch (e) {
            console.error('scripting.executeScript error:', e);
        }
    });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message && message.action === 'getStatus') {
        // include detectEnabled so popup can show disabled state
        sendResponse({ status: isConnected, detectEnabled });
    }
});

// allow popup to request an immediate test and get async response
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message && message.action === 'testConnection') {
        testServerConnectionAsync().then(() => {
            sendResponse({ status: isConnected });
        });
        return true; // will respond asynchronously
    }
    if (message && message.action === 'checkToken') {
        checkTokenValidityAsync().then(valid => sendResponse({ valid }));
        return true;
    }
});
