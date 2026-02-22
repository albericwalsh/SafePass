function copyToClipboard(text) {
    const tempInput = document.createElement('input');
    tempInput.value = text;
    document.body.appendChild(tempInput);
    tempInput.select();
    document.execCommand('copy');
    document.body.removeChild(tempInput);
    showDurationAlertMessage('Copied to clipboard!', 2000, '--sp-success');
}

function sortTable(columnKey) {
    // Sorting is temporarily disabled per user request.
    return;
}

function deleteEntry(category, entry) {
    // let i = showAlertConfirm('Are you sure you want to delete this entry?', 'Delete') === 1
    // if (i) {
    // Parcours les catégories dans le JSON
    // alert when it found
    allData.forEach(item => {
        console.log("entry: " + JSON.stringify(entry));
        console.log(JSON.stringify(item[category]));
        if (item[category]) {
            const index = item[category].findIndex(e => JSON.stringify(e) === JSON.stringify(entry));
            if (index !== -1) {
                showAlertConfirm('Are you sure you want to delete this entry?', 'Delete', 'Cancel', '--sp-alert', onConfirm = () => {
                    item[category].splice(index, 1);
                    saveAllData(); // Optionnel: à implémenter pour sauvegarder les données
                    displayCategory(category); // Rafraîchit l'affichage de la catégorie actuelle
                }, onCancel = () => {
                    console.log("cancel");
                });
            }
        }
    });
    // Après suppression, sauvegarde et réaffiche la catégorie

    // } else if (i===0){
    //     console.log("cancel");
    // } else {
    //     console.log("close");
    // }
}


function updateItemInCategory(category, oldEntry, newEntry) {
    console.log("oldEntry: " + JSON.stringify(oldEntry));
    allData.forEach(item => {
        if (item[category]) {
            const index = item[category].findIndex(entry => JSON.stringify(entry) === JSON.stringify(oldEntry));
            if (index !== -1) {
                try {
                    const oldPw = (oldEntry && typeof oldEntry.password !== 'undefined') ? oldEntry.password : null;
                    const newPw = (newEntry && typeof newEntry.password !== 'undefined') ? newEntry.password : null;

                    // Build recent history list to check against (old password + saved history)
                    const recent = [];
                    if (oldPw) recent.push(oldPw);
                    if (Array.isArray(oldEntry.password_history)) {
                        for (const p of oldEntry.password_history) if (p && recent.indexOf(p) === -1) recent.push(p);
                    }

                    // Determine history length preference (for trimming/storing)
                    let maxLen = 5;
                    try {
                        if (window.SP_settings && window.SP_settings.security && typeof window.SP_settings.security.password_history_length !== 'undefined') {
                            maxLen = parseInt(window.SP_settings.security.password_history_length, 10) || maxLen;
                        } else if (window.SP_params && typeof window.SP_params.getVal === 'function') {
                            const v = window.SP_params.getVal('security-password_history_length');
                            if (typeof v !== 'undefined' && v !== null && v !== '') maxLen = parseInt(v, 10) || maxLen;
                        }
                    } catch (e) { }

                    // If password changed, verify it is not present in recent history
                    if (oldPw !== null && newPw !== null && oldPw !== newPw) {
                        // exact match check
                        for (const p of recent) { if (p === newPw) { showDurationAlertMessage('Ce mot de passe a déjà été utilisé récemment.', 2500, '--sp-alert'); return; } }

                        // build new history: prepend oldPw and merge previous history, then trim
                        let hist = Array.isArray(newEntry.password_history) ? newEntry.password_history.slice() : (Array.isArray(oldEntry.password_history) ? oldEntry.password_history.slice() : []);
                        if (oldPw && (!hist.length || hist[0] !== oldPw)) hist.unshift(oldPw);
                        hist = hist.slice(0, Math.max(0, parseInt(maxLen,10) || 0));
                        newEntry.password_history = hist;
                    }
                } catch (e) { console.error('password history update error', e); }
                item[category][index] = newEntry;
            }
        }
    });
    saveAllData();
    displayCategory(category);  // Re-render the table with updated data
    showDurationAlertMessage('Entry updated successfully!', 2000, '--sp-success');
}

// Function to generate and set password
function generateAndSetPassword() {
    const result = generatePassword();
    // result may be string (legacy) or object { password, strengthPercent }
    const pw = (result && result.password) ? result.password : result;
    const pct = (result && typeof result.strengthPercent !== 'undefined') ? result.strengthPercent : null;
    $('#password').val(pw);
    // show strength percent next to the field (place before the input)
    try{
        const container = $('#password').closest && $('#password').closest('.password-field') ? $('#password').closest('.password-field') : $('.password-field').first();
        if (container && container.length){
            let el = container.find('.password-strength-percent');
            if (!el || el.length===0){ el = $('<span class="password-strength-percent" style="margin-right:8px;color:var(--sp-panel-text);min-width:44px;display:inline-block"></span>'); container.prepend(el); }
            if (pct === null) el.text(''); else el.text(pct + '%');
        }
    }catch(e){ console.debug('Could not set strength percent', e); }
}

// Call saveData() whenever data is modified
function addItemToCategory(category, newItem) {
    allData.forEach(item => {
        if (item[category]) {
            item[category].push(newItem);
        }
    });
    saveAllData(); // Save data after modifying it
    // restore body scroll and remove form
    try{ $('body').css('overflow', ''); }catch(e){}
    $('#add').remove(); // Remove the form after submission
    $('#backdrop').remove(); // Remove the backdrop after submission
    displayCategory(currentCategory); // Refresh the current view
}

function importData(data) {
    if (!validateDataStructure(data)) {
        showDurationAlertMessage('Invalid data structure!', 2000, '--sp-error');
        return;
    }
    decryptData(data);
    showDurationAlertMessage('Data imported successfully!', 2000, '--sp-success');
}

// Assuming `allData` is your main data array
function addToData(newItem) {
    try {
        newItem[0].applications.forEach(app => {
            allData[0].applications.push(app);
        });
        newItem[0].autres.forEach(autre => {
            allData[0].autres.push(autre);
        });
        newItem[0].sites.forEach(site => {
            allData[0].sites.push(site);
        });
    } catch (e) {
        console.error('Error adding data', e);
    }
}


// Function to validate data structure
function validateDataStructure(data) {
    if (!Array.isArray(data) || data.length === 0) return false;

    const requiredCategories = ["applications", "autres", "sites"];
    const applicationFields = ["GUID", "name", "password", "username"];
    const autresFields = ["name", "password", "username"];
    const siteFields = ["name", "password", "url", "username"];

    return data.every(entry => {
        return requiredCategories.every(category => {
            if (!Array.isArray(entry[category])) return false;

            const fields = category === "applications" ? applicationFields :
                category === "autres" ? autresFields : siteFields;

            return entry[category].every(item => fields.every(field => field in item));
        });
    });
}
