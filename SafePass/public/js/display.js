function displayCategory(category) {
    currentCategory = category;
    let tableHeaders = $('#table-headers');
    let tableBody = $('#dynamic-list');
    tableHeaders.empty();
    tableBody.empty();

    console.log("currentCategory:", currentCategory);

    if (!Array.isArray(allData)) {
        console.error("allData is not an array:", allData);
        return;
    }

    if (allData.length && allData[0][category].length) {
        let headers = ['name', 'url', 'GUID', 'username', 'password'];
        headers.forEach(key => {
            if (allData[0][category][0][key] !== undefined) {
                let icon = '';
                switch (key) {
                    case 'name':
                        icon = '<i class="fas fa-file"></i>';
                        break;
                    case 'url':
                        icon = '<i class="fas fa-link"></i>';
                        break;
                    case 'GUID':
                        icon = '<i class="fas fa-key"></i>';
                        break;
                    case 'username':
                        icon = '<i class="fas fa-user-circle"></i>';
                        break;
                    case 'password':
                        icon = '<i class="fas fa-lock"></i>';
                        break;
                }
                tableHeaders.append(`
                    <th class="resizable sortable" data-key="${key}">
                        ${icon} ${key}
                        <span class="sort-icon">&#10606;</span>
                    </th>
                `);
            }
        });

        // Add the header for the edit column
        tableHeaders.append('<th class="resizable">Edit</th>');
    }


    allData.forEach(item => {
        if (item[category]) {
            item[category].forEach(entry => {
                let row = $('<tr>');

                ['name', 'url', 'GUID', 'username', 'password'].forEach(key => {
                    if (entry[key] !== undefined) {
                        if (key === 'name') {
                            let favicon = '';

                            if (category !== 'applications') {
                                favicon = entry.url
                                    ? `https://www.google.com/s2/favicons?domain=${entry.url}`
                                    : '';

                                favicon = favicon
                                    ? `<img src="${favicon}" alt="favicon" style="width: 16px; height: 16px; margin-right: 8px;">`
                                    : '';
                            }

                            row.append(`
                                    <td class="resizable" data-key="${key}">
                                        ${favicon}
                                        ${entry[key]}
                                    </td>
                                `);
                        } else if (key === 'url') {
                            row.append(`<td class="resizable" data-key="${key}"><a href="${entry[key]}" target="_blank">${entry[key]}</a></td>`);
                        } else if (key === 'username') {
                            row.append(`
                                <td class="resizable" data-key="${key}">
                                    <div class="username">
                                        <span>${entry[key]}</span>
                                        <span class="copy-icon fas fa-copy" onclick="copyToClipboard('${entry[key]}')"></span>
                                    </div>
                                </td>
                            `);
                        } else if (key === 'password') {
                            let strengthColor = getPasswordStrength(entry[key]);
                            row.append(`
                                <td class="resizable" data-key="${key}">
                                    <div class="password">
                                        <span class="password-strength" style="background-color: ${strengthColor}; width: 10px; height: 10px; display: inline-block; border-radius: 50%; margin-right: 8px;"></span>
                                        <input type="password" value="${entry[key]}" readonly>
                                        <span class="fas fa-eye toggle-password"></span>
                                        <span class="copy-icon fas fa-copy" onclick="copyToClipboard('${entry[key]}')"></span>
                                    </div>
                                </td>
                            `);
                        } else {
                            row.append(`<td class="resizable" data-key="${key}">${entry[key]}</td>`);
                        }
                    }
                });

                // Add the Tools icons
                row.append(`
                    <td class="resizable" data-key="Tools">
                        <span class="fas fa-edit edit-icon" onclick="showEditForm('${category}', ${JSON.stringify(entry).replace(/"/g, '&quot;')})"></span>
                        <span class="fas fa-trash-alt delete-icon" onclick="deleteEntry('${category}',${JSON.stringify(entry).replace(/"/g, '&quot;')})"></span>
                    </td>
                `);

                tableBody.append(row);
            });
        }
    });

    // Make the columns resizable
    $('.resizable').resizable({
        handles: 'e'
    });

    // Toggle password visibility
    $('.toggle-password').on('click', function () {
        let input = $(this).prev('input');
        if (input.attr('type') === 'password') {
            input.attr('type', 'text');
        } else {
            input.attr('type', 'password');
        }
    });
}

// Function to show the add item form
function showAddForm(category) {
    const backdropHtml = '<div class="backdrop" id="backdrop"></div>';
    let formFields = '';

    if (category === 'sites') {
        formFields = `
            <label for="name">Name:</label>
            <input type="text" id="name" name="name">
            <label for="url">URL:</label>
            <input type="text" id="url" name="url">
            <label for="username">Username:</label>
            <input type="text" id="username" name="username">
            <label for="password">Password:</label>
            <div class="password-field">
                <input type="password" id="password" name="password">
                <span class="fas fa-eye toggle-password-field"></span>
                <span class="fas fa-sync-alt generate-password-icon" onclick="generateAndSetPassword()"></span>
            </div>
        `;
    } else if (category === 'applications') {
        formFields = `
            <label for="name">Name:</label>
            <input type="text" id="name" name="name">
            <label for="GUID">GUID:</label>
            <input type="text" id="GUID" name="GUID">
            <label for="username">Username:</label>
            <input type="text" id="username" name="username">
            <label for="password">Password:</label>
            <div class="password-field">
                <input type="password" id="password" name="password">
                <span class="fas fa-eye toggle-password-field"></span>
                <span class="fas fa-sync-alt generate-password-icon" onclick="generateAndSetPassword()"></span>
            </div>
        `;
    } else if (category === 'autres') {
        formFields = `
            <label for="name">Name:</label>
            <input type="text" id="name" name="name">
            <label for="username">Username:</label>
            <input type="text" id="username" name="username">
            <label for="password">Password:</label>
            <div class="password-field">
                <input type="password" id="password" name="password">
                <span class="fas fa-eye toggle-password-field"></span>
                <span class="fas fa-sync-alt generate-password-icon" onclick="generateAndSetPassword()"></span>
            </div>
        `;
    } else {
        formFields = '<p>Unknown category</p>';
    }

    const formHtml = `
        <div class="upper-center-window" id="add">
            <form id="addForm">
                ${formFields}
                <div class="form-buttons">
                    <button class="btn sp-btn" type="button" id="cancelButton">Cancel</button>
                    <button class="btn sp-btn-primary" type="button" id="addSubmit">Add</button>
                </div>
            </form>
        </div>`;
    $('body').append(backdropHtml, formHtml);

    // Toggle password visibility
    $('.toggle-password-field').on('click', function () {
        let input = $(this).prev('input');
        if (input.attr('type') === 'password') {
            input.attr('type', 'text');
        } else {
            input.attr('type', 'password');
        }
    });

    // Handle form submission
    $('#addSubmit').on('click', function () {
        let newItem = {};
        if (category === 'sites') {
            newItem = {
                name: $('#name').val(),
                url: $('#url').val(),
                username: $('#username').val(),
                password: $('#password').val()
            };
        } else if (category === 'applications') {
            newItem = {
                name: $('#name').val(),
                GUID: $('#GUID').val(),
                username: $('#username').val(),
                password: $('#password').val()
            };
        } else if (category === 'autres') {
            newItem = {
                name: $('#name').val(),
                username: $('#username').val(),
                password: $('#password').val()
            };
        }
        addItemToCategory(category, newItem);
    });

    // Handle form cancel
    $('#cancelButton').on('click', function () {
        $('#add').remove();
        $('#backdrop').remove();
    });
}

function showEditForm(category, entry) {
    console.log("entry: " + JSON.stringify(entry));
    const backdropHtml = '<div class="backdrop" id="backdrop"></div>';
    let formFields = '';

    if (category === 'sites') {
        formFields = `
            <label for="name">Name:</label>
            <input type="text" id="name" name="name" value="${entry.name}">
            <label for="url">URL:</label>
            <input type="text" id="url" name="url" value="${entry.url}">
            <label for="username">Username:</label>
            <input type="text" id="username" name="username" value="${entry.username}">
            <label for="password">Password:</label>
            <div class="password-field">
                <input type="password" id="password" name="password" value="${entry.password}">
                <span class="fas fa-eye toggle-password-field"></span>
                <span class="fas fa-sync-alt generate-password-icon" onclick="generateAndSetPassword()"></span>
            </div>
        `;
    } else if (category === 'applications') {
        formFields = `
            <label for="name">Name:</label>
            <input type="text" id="name" name="name" value="${entry.name}">
            <label for="GUID">GUID:</label>
            <input type="text" id="GUID" name="GUID" value="${entry.GUID}">
            <label for="username">Username:</label>
            <input type="text" id="username" name="username" value="${entry.username}">
            <label for="password">Password:</label>
            <div class="password-field">
                <input type="password" id="password" name="password" value="${entry.password}">
                <span class="fas fa-eye toggle-password-field"></span>
                <span class="fas fa-sync-alt generate-password-icon" onclick="generateAndSetPassword()"></span>
            </div>
        `;
    } else if (category === 'autres') {
        formFields = `
            <label for="name">Name:</label>
            <input type="text" id="name" name="name" value="${entry.name}">
            <label for="username">Username:</label>
            <input type="text" id="username" name="username" value="${entry.username}">
            <label for="password">Password:</label>
            <div class="password-field">
                <input type="password" id="password" name="password" value="${entry.password}">
                <span class="fas fa-eye toggle-password-field"></span>
                <span class="fas fa-sync-alt generate-password-icon" onclick="generateAndSetPassword()"></span>
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
                    <button class="btn sp-btn" type="button" id="cancelButton">Cancel</button>
                    <button class="btn sp-btn-primary" type="button" id="editSubmit">Save</button>
                </div>
            </form>
        </div>`;

    $('body').append(backdropHtml, formHtml);

    // Toggle password visibility
    $('.toggle-password-field').on('click', function () {
        let input = $(this).prev('input');
        if (input.attr('type') === 'password') {
            input.attr('type', 'text');
        } else {
            input.attr('type', 'password');
        }
    });

    // Handle form submission
    $('#editSubmit').on('click', function () {
        let updatedItem = {};
        if (category === 'sites') {
            updatedItem = {
                name: $('#name').val(),
                url: $('#url').val(),
                username: $('#username').val(),
                password: $('#password').val()
            };
        } else if (category === 'applications') {
            updatedItem = {
                name: $('#name').val(),
                GUID: $('#GUID').val(),
                username: $('#username').val(),
                password: $('#password').val()
            };
        } else if (category === 'autres') {
            updatedItem = {
                name: $('#name').val(),
                username: $('#username').val(),
                password: $('#password').val()
            };
        }
        updateItemInCategory(category, entry, updatedItem); // Function to update the item in the dataset
        $('#edit').remove();
        $('#backdrop').remove();
    });

    // Handle form cancel
    $('#cancelButton').on('click', function () {
        $('#edit').remove();
        $('#backdrop').remove();
    });
}

function showParameters() {
    const backdropHtml = '<div class="backdrop" id="backdrop"></div>';
    const formFields = `
        <div id="settings-container" style="width:600px; max-width:95%;">
            <h3>Général</h3>
            <div class="settings-grid">
                <div class="settings-row"><label>Langue</label><select id="language"><option value="fr">Français</option><option value="en">English</option></select></div>
                <div class="settings-row"><label></label><label><input type="checkbox" id="start_on_boot"> Démarrer au démarrage</label></div>
                <div class="settings-row"><label></label><label><input type="checkbox" id="auto_update_check"> Vérifier mises à jour automatiquement</label></div>
                <div class="settings-row"><label></label><label><input type="checkbox" id="open_front_on_start"> Ouvrir le front au démarrage</label></div>
            </div>

            <h3>Sécurité</h3>
            <div class="settings-grid">
                <div class="settings-row"><label></label><label><input type="checkbox" id="master_password_enabled"> Exiger mot de passe maître</label></div>
                <div class="settings-row"><label>Verrouillage automatique (minutes)</label><input type="number" id="auto_lock_minutes" min="0" style="width:120px"></div>
                <div class="settings-row"><label>Politique force mot de passe</label>
                    <select id="password_strength_policy"><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select>
                </div>
                <div class="settings-row"><label></label><label><input type="checkbox" id="require_password_on_export"> Demander mot de passe pour export</label></div>
            </div>

            <h3>Stockage & Sauvegardes</h3>
            <div class="settings-grid">
                <div class="settings-row"><label>Chemin données</label>
                    <div style="display:flex; gap:8px; align-items:center;">
                        <input type="text" id="data_path" style="flex:1">
                        <button type="button" id="browseData" class="btn">Parcourir</button>
                    </div>
                </div>
                    <div class="settings-row"><label></label><label><input type="checkbox" id="backup_enabled"> Activer sauvegardes</label></div>
                    <div class="settings-row"><label>Intervalle sauvegarde (jours)</label><input type="number" id="backup_interval_days" min="0" style="width:120px"></div>
                    <div class="settings-row"><label>Emplacement sauvegarde</label>
                        <div style="display:flex; gap:8px; align-items:center;">
                            <input type="text" id="backup_location" style="flex:1">
                            <button type="button" id="browseBackup" class="btn">Parcourir</button>
                        </div>
                    </div>
            </div>

            <h3>Affichage</h3>
            <div class="settings-grid">
                <div class="settings-row"><label>Thème</label>
                    <select id="theme"><option value="light">Light</option><option value="dark">Dark</option><option value="system">System</option></select>
                </div>
                <div class="settings-row"><label>Éléments par page</label><input type="number" id="items_per_page" min="1" style="width:120px"></div>
            </div>

            <div id="advanced-section" style="display:none; margin-top:12px; border-top:1px dashed #ccc; padding-top:10px;">
                <h4>Avancés</h4>
                <div class="settings-grid">
                    <div class="settings-row"><label></label><label><input type="checkbox" id="detect_enabled"> Activer détection (back.detect)</label></div>
                    <div class="settings-row"><label></label><label><input type="checkbox" id="debug_mode"> Mode debug</label></div>
                    <div class="settings-row"><label>Niveau logs</label>
                        <select id="log_level"><option>DEBUG</option><option selected>INFO</option><option>WARNING</option><option>ERROR</option></select>
                    </div>
                </div>
            </div>

            <label style="margin-top:8px; display:block;"><input type="checkbox" id="show_advanced_toggle"> Afficher les paramètres avancés</label>
            <div style="margin-top:12px; display:flex; gap:10px; align-items:center;">
                <button id="saveSettings" class="btn sp-btn-primary">Sauvegarder</button>
                <button id="exportButton" class="export-icon btn"><i class="fas fa-file-export"></i> Exporter CSV</button>
            </div>

            <!-- Hidden fallback pickers -->
            <input type="file" id="filePicker" style="display:none" accept=".sfpss">
            <input type="file" id="dirPicker" style="display:none" webkitdirectory directory>
        </div>
    `;

    const formHtml = `
        <div class="upper-center-window" id="parameters">
            <form id="parametersForm">
                ${formFields}
                <div class="form-buttons">
                    <button class="btn sp-btn" type="button" id="closeButton">Close</button>
                </div>
            </form>
        </div>`;
    $('body').append(backdropHtml, formHtml);

    // Add minimal styles for settings grid if not present
    if (!document.getElementById('settings-grid-style')) {
        const style = document.createElement('style');
        style.id = 'settings-grid-style';
        style.innerHTML = `
            .settings-grid { display: grid; grid-template-columns: 200px 1fr; gap:8px 12px; align-items: center; }
            .settings-row { display: contents; }
            #settings-container h3 { margin-top:12px; margin-bottom:6px; }
            #settings-container label { margin:0; }
        `;
        document.head.appendChild(style);
    }

    // Browse button -> open native picker when possible (File System Access API), fallback to hidden file input
    document.getElementById('browseData').addEventListener('click', async function () {
        // Prefer the File System Access API
        try {
            if (window.showOpenFilePicker) {
                const [handle] = await window.showOpenFilePicker({
                    multiple: false,
                    types: [{ description: 'SafePass data', accept: { 'application/octet-stream': ['.sfpss'] } }]
                });
                if (handle) {
                    // We cannot reliably get absolute path from the browser; use the name and let backend handle move/upload if needed
                    $('#data_path').val(handle.name);
                    // store handle for potential future upload
                    window._selectedDataFileHandle = handle;
                }
                return;
            }
        } catch (e) {
            console.warn('showOpenFilePicker failed, falling back to file input', e);
        }

        // Fallback: trigger hidden file input
        const filePicker = document.getElementById('filePicker');
        if (filePicker) filePicker.click();
    });

    // Fallback file input change
    document.getElementById('filePicker').addEventListener('change', function (ev) {
        const f = this.files && this.files[0];
        if (f) {
            // browsers hide full path for security; use filename
            $('#data_path').val(f.name || 'selected-file.sfpss');
            window._selectedDataFile = f;
        }
    });

    // Backup folder picker (fallback using hidden dir input)
    document.getElementById('browseBackup')?.addEventListener('click', async function () {
        try {
            if (window.showDirectoryPicker) {
                const handle = await window.showDirectoryPicker();
                if (handle) {
                    $('#backup_location').val(handle.name || 'selected-folder');
                    window._selectedBackupDirHandle = handle;
                }
                return;
            }
        } catch (e) {
            console.warn('showDirectoryPicker failed, falling back to dir input', e);
        }

        const dirPicker = document.getElementById('dirPicker');
        if (dirPicker) dirPicker.click();
    });

    // Handle fallback directory picker change
    document.getElementById('dirPicker').addEventListener('change', function () {
        const files = this.files;
        if (files && files.length) {
            // webkitRelativePath gives directory relative path like "folder/file"
            const rel = files[0].webkitRelativePath || files[0].name;
            const root = rel.split('/')[0];
            $('#backup_location').val(root || files[0].name);
            window._selectedBackupFiles = files;
        }
    });

    // Toggle advanced section
    $('#show_advanced_toggle').on('change', function () {
        if ($(this).is(':checked')) $('#advanced-section').show(); else $('#advanced-section').hide();
    });

    // Handle save settings
    document.getElementById('saveSettings').addEventListener('click', async function (e) {
        e.preventDefault();
        try {
            const settings = {
                language: $('#language').val(),
                start_on_boot: $('#start_on_boot').is(':checked'),
                auto_update_check: $('#auto_update_check').is(':checked'),
                open_front_on_start: $('#open_front_on_start').is(':checked'),
                master_password_enabled: $('#master_password_enabled').is(':checked'),
                auto_lock_minutes: parseInt($('#auto_lock_minutes').val() || '0', 10),
                password_strength_policy: $('#password_strength_policy').val(),
                require_password_on_export: $('#require_password_on_export').is(':checked'),
                data_path: $('#data_path').val(),
                backup_enabled: $('#backup_enabled').is(':checked'),
                backup_interval_days: parseInt($('#backup_interval_days').val() || '0', 10),
                theme: $('#theme').val(),
                items_per_page: parseInt($('#items_per_page').val() || '20', 10),
                detect_enabled: $('#detect_enabled').is(':checked'),
                debug_mode: $('#debug_mode').is(':checked'),
                log_level: $('#log_level').val()
            };

            const resp = await fetch('http://127.0.0.1:5000/settings', {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(settings)
            });
            if (!resp.ok) throw new Error('Save failed');
            showDurationAlertMessage('Paramètres sauvegardés.', 1500, '--sp-success');
        } catch (err) {
            console.error('Erreur save settings', err);
            showAlertMessage('Erreur lors de la sauvegarde des paramètres.');
        }
    });

    // Handle file export -> export to CSV via backend
    document.getElementById('exportButton').addEventListener('click', async function (e) {
        e.preventDefault();
        try {
            const payload = { data: allData };
            console.log('Requesting CSV export with payload:', payload);

            const resp = await fetch('http://127.0.0.1:5000/exportCSV', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!resp.ok) {
                const text = await resp.text();
                throw new Error('Export failed: ' + resp.status + ' ' + text);
            }

            const blob = await resp.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'SafePass_export.csv';
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);

            showDurationAlertMessage("Export CSV téléchargé.", 2000, '--sp-success');
        } catch (err) {
            console.error('Erreur export CSV:', err);
            showAlertMessage('Erreur lors de l\'export CSV.');
        }
    });

    // Handle file upload
    $('#fileUpload').on('change', function () {
        const file = $(this)[0].files[0]; // Access the selected file
        try {
            if (file) {
                console.log('File selected:', file.name);

                if (typeof file.name !== 'string' || !file.name.endsWith('.sfpss')) {
                    throw new Error('Invalid file extension. Expected .sfpss');
                }
                // Read the file content (if required)
                const reader = new FileReader();
                reader.onload = function (e) {
                    const fileContent = e.target.result;
                    console.log('File content:', fileContent);
                    importData(fileContent); // Pass file content to the importData function
                };
                reader.onerror = function (error) {
                    console.error('Error reading file:', error);
                };

                // Read the file as text or data URL
                reader.readAsText(file); // Or use reader.readAsDataURL(file) for binary files
            } else {
                console.log('No file selected.');
            }
        } catch (e) {
            console.error('Error reading file:', e);
        }
    });

    // Handle form cancel
    $('#closeButton').on('click', function () {
        $('#parameters').remove();
        $('#backdrop').remove();
    });

    // Load existing settings
    (async function loadSettings(){
        try{
            const resp = await fetch('http://127.0.0.1:5000/settings');
            if (!resp.ok) return;
            const json = await resp.json();
            const s = json.settings || {};
            $('#language').val(s.language||'fr');
            $('#start_on_boot').prop('checked', !!s.start_on_boot);
            $('#auto_update_check').prop('checked', !!s.auto_update_check);
            $('#open_front_on_start').prop('checked', !!s.open_front_on_start);
            $('#master_password_enabled').prop('checked', !!s.master_password_enabled);
            $('#auto_lock_minutes').val(s.auto_lock_minutes||5);
            $('#password_strength_policy').val(s.password_strength_policy||'medium');
            $('#require_password_on_export').prop('checked', !!s.require_password_on_export);
            $('#data_path').val(s.data_path||'data/data_encrypted.sfpss');
            $('#backup_enabled').prop('checked', !!s.backup_enabled);
            $('#backup_interval_days').val(s.backup_interval_days||7);
            $('#theme').val(s.theme||'system');
            $('#items_per_page').val(s.items_per_page||20);
            $('#detect_enabled').prop('checked', !!s.detect_enabled);
            $('#debug_mode').prop('checked', !!s.debug_mode);
            $('#log_level').val(s.log_level||'INFO');
        }catch(e){console.warn('Cannot load settings',e)}
    })();
}


