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
    let rows = $('#dynamic-list tr').get();
    rows.sort(function (a, b) {
        let A = $(a).find(`td[data-key="${columnKey}"]`).text().toLowerCase();
        let B = $(b).find(`td[data-key="${columnKey}"]`).text().toLowerCase();

        if (sortOrder[columnKey] === 'asc') {
            return (A < B) ? -1 : (A > B) ? 1 : 0;
        } else {
            return (A > B) ? -1 : (A < B) ? 1 : 0;
        }
    });

    // Append sorted rows to the table body
    $.each(rows, function (index, row) {
        $('#dynamic-list').append(row);
    });

    // Toggle the sort order for next click
    sortOrder[columnKey] = (sortOrder[columnKey] === 'asc') ? 'desc' : 'asc';
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
    const password = generatePassword();
    $('#password').val(password);
}

// Call saveData() whenever data is modified
function addItemToCategory(category, newItem) {
    allData.forEach(item => {
        if (item[category]) {
            item[category].push(newItem);
        }
    });
    saveAllData(); // Save data after modifying it
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
