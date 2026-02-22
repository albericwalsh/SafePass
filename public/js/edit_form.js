
function showEditForm(category, entry) {
    console.log("entry: " + JSON.stringify(entry));
    const backdropHtml = '<div class="backdrop" id="backdrop"></div>';
    let formFields = '';

    // small esc helper to safely embed values into attributes
    function esc(v){ if (v===null||v===undefined) return ''; return String(v).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

    if (category === 'sites') {
        formFields = `
            <label for="name">Name:</label>
            <aws-input id="name" mode="edit" type="text" value="${esc(entry.name)}"></aws-input>
            <label for="url">URL:</label>
            <aws-input id="url" mode="edit" type="url" value="${esc(entry.url)}"></aws-input>
            <label for="username">Username:</label>
            <aws-input id="username" mode="edit" type="text" value="${esc(entry.username)}"></aws-input>
            <label for="password">Password:</label>
            <div class="password-field">
                <aws-input id="password" mode="edit" type="password" value="${esc(entry.password)}"></aws-input>
                <aws-icon-button class="generate-password-btn" size="sm" variant="secondary" onclick="generateAndSetPassword()"><span class="material-icons">autorenew</span></aws-icon-button>
            </div>
        `;
    } else if (category === 'applications') {
        formFields = `
            <label for="name">Name:</label>
            <aws-input id="name" mode="edit" type="text" value="${esc(entry.name)}"></aws-input>
            <label for="GUID">GUID:</label>
            <aws-input id="GUID" mode="edit" type="text" value="${esc(entry.GUID)}"></aws-input>
            <label for="username">Username:</label>
            <aws-input id="username" mode="edit" type="text" value="${esc(entry.username)}"></aws-input>
            <label for="password">Password:</label>
            <div class="password-field">
                <aws-input id="password" mode="edit" type="password" value="${esc(entry.password)}"></aws-input>
                <aws-icon-button class="generate-password-btn" size="sm" variant="secondary" onclick="generateAndSetPassword()"><span class="material-icons">autorenew</span></aws-icon-button>
            </div>
        `;
    } else if (category === 'autres') {
        formFields = `
            <label for="name">Name:</label>
            <aws-input id="name" mode="edit" type="text" value="${esc(entry.name)}"></aws-input>
            <label for="username">Username:</label>
            <aws-input id="username" mode="edit" type="text" value="${esc(entry.username)}"></aws-input>
            <label for="password">Password:</label>
            <div class="password-field">
                <aws-input id="password" mode="edit" type="password" value="${esc(entry.password)}"></aws-input>
                <aws-icon-button class="generate-password-btn" size="sm" variant="secondary" onclick="generateAndSetPassword()"><span class="material-icons">autorenew</span></aws-icon-button>
            </div>
        `;
    } else {
        formFields = '<p>Unknown category</p>';
    }

    const formHtml = `
        <div class="upper-center-window" id="edit">
            <form id="editForm">
                ${formFields}
                <div class="form-buttons">
                    <aws-button id="cancelButton" variant="secondary">Cancel</aws-button>
                    <aws-button id="editSubmit" variant="primary">Save</aws-button>
                </div>
            </form>
        </div>`;

    $('body').append(backdropHtml, formHtml);

    // Force render and initialization of aws-input elements so their value is visible
    try {
        const inputs = Array.from(document.querySelectorAll('#edit aws-input'));
        inputs.forEach(orig => {
            try {
                // collect attributes
                const attrs = {};
                for (let i = 0; i < orig.attributes.length; i++) {
                    const a = orig.attributes[i];
                    attrs[a.name] = a.value;
                }
                // create new element before replacing to ensure connectedCallback sees initial attributes
                const nw = document.createElement('aws-input');
                // copy attributes
                Object.keys(attrs).forEach(k => nw.setAttribute(k, attrs[k]));
                // copy inline style/class
                nw.className = orig.className || '';
                if (orig.getAttribute('style')) nw.setAttribute('style', orig.getAttribute('style'));
                // set property value if present
                if (attrs.value !== undefined && attrs.value !== null) {
                    try { nw.value = attrs.value; } catch (e) {}
                }
                // replace in DOM
                orig.parentNode.replaceChild(nw, orig);

                // after connected, try to set internal native input value and dispatch events
                setTimeout(() => {
                    try {
                        const sr = nw.shadowRoot;
                        const inner = sr ? sr.querySelector('input,textarea') : nw.querySelector('input,textarea');
                        const val = attrs.value !== undefined ? attrs.value : (nw.value || '');
                        if (inner) {
                            inner.value = val;
                            inner.dispatchEvent(new Event('input', { bubbles: true }));
                            inner.dispatchEvent(new Event('change', { bubbles: true }));
                        }
                    } catch (e) {}
                }, 30);
            } catch (e) {}
        });
    } catch (e) {}

    // prevent body scroll while edit open
    try{ $('body').css('overflow', 'hidden'); }catch(e){}

    // generate-password icon sets value on aws-input; visibility handled by component

    // Handle form submission
    $('#editSubmit').on('click', function () {
        let updatedItem = {};
        if (category === 'sites') {
            updatedItem = {
                name: document.getElementById('name').value || '',
                url: document.getElementById('url').value || '',
                username: document.getElementById('username').value || '',
                password: document.getElementById('password').value || ''
            };
        } else if (category === 'applications') {
            updatedItem = {
                name: document.getElementById('name').value || '',
                GUID: document.getElementById('GUID').value || '',
                username: document.getElementById('username').value || '',
                password: document.getElementById('password').value || ''
            };
        } else if (category === 'autres') {
            updatedItem = {
                name: document.getElementById('name').value || '',
                username: document.getElementById('username').value || '',
                password: document.getElementById('password').value || ''
            };
        }
        updateItemInCategory(category, entry, updatedItem); // Function to update the item in the dataset
        try{ $('body').css('overflow', ''); }catch(e){}
        $('#edit').remove();
        $('#backdrop').remove();
    });

    // Handle form cancel
    $('#cancelButton').on('click', function () {
        try{ $('body').css('overflow', ''); }catch(e){}
        $('#edit').remove();
        $('#backdrop').remove();
    });

    // Close settings: restore body scroll
    $('#closeButton').on('click', function () {
        $('#parameters').remove();
        $('#backdrop').remove();
        $('body').css('overflow', '');
    });

    // Load extension token info
    async function loadExtensionTokenInfo() {
        try {
                const res = await fetch('http://127.0.0.1:5000/extension/token');
                const j = await res.json();
                if (j && j.status === 'ok') {
                    $('#ext_token_display_text').text(j.token || '(non défini)');
                    $('#ext_token_expiry').text(j.expires_at || '(non défini)');
                } else if (j && j.status === 'empty') {
                    $('#ext_token_display_text').text('(non défini)');
                    $('#ext_token_expiry').text('(non défini)');
                }
            } catch (e) { console.warn('Failed to load extension token', e); }
    }
    

    $('#copyToken').on('click', function () {
        const v = $('#ext_token_display_text').text() || '';
        if (!v || v === '(non défini)') return alert('Aucun token');
        try { copyToClipboard(v); } catch(e) { navigator.clipboard.writeText(v).then(()=>alert('Token copié')).catch(()=>alert('Impossible de copier')); }
    });

    $('#regenToken').on('click', async function () {
        const ttl = parseInt($('#ext_token_ttl').val() || '30', 10) || 30;
        try {
            const res = await fetch('http://127.0.0.1:5000/extension/token', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ttl_days: ttl }) });
            const j = await res.json();
            if (j && j.status === 'ok') {
                $('#ext_token_display_text').text(j.token || '(non défini)');
                $('#ext_token_expiry').text(j.expires_at || '(non défini)');
                showDurationAlertMessage('Token créé/mis à jour.', 2000, '--sp-success');
            } else {
                showDurationAlertMessage('Erreur lors de la génération', 2000, '--sp-error');
            }
        } catch (e) { console.warn(e); showDurationAlertMessage('Erreur réseau', 2000, '--sp-error'); }
    });

    // initial load of token info
    loadExtensionTokenInfo();
}