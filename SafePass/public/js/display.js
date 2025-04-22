
function displayCategory(category) {
    currentCategory = category;
    let tableHeaders = $('#table-headers');
    let tableBody = $('#dynamic-list');
    tableHeaders.empty();
    tableBody.empty();

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
                            if (category === 'applications') {
                                // Utilisation de l'API Icons8 pour obtenir une icône
                                fetch(`https://api.icons8.com/icons/search?api_key=ton_clé_api&term=${entry[key]}`, {
                                    method: 'GET',
                                    headers: {
                                        'Content-Type': 'application/json'
                                    }
                                })
                                    .then(response => response.json())
                                    .then(data => {
                                        if (data.icons.length > 0) {
                                            favicon = `<img src="${data.icons[0].png}" alt="Icon" style="width: 16px; height: 16px; margin-right: 8px;">`;
                                        } else {
                                            favicon = '<i class="fas fa-file"></i>';
                                        }
                                    })
                                    .catch(error => console.error('Error:', error));
                            } else if (key === 'name') {
                                favicon = entry.url ? `https://www.google.com/s2/favicons?domain=${entry.url}` : '<i class="fas fa-file"></i>';
                                favicon = favicon.startsWith('http') ? `<img src="${favicon}" alt="favicon" style="width: 16px; height: 16px; margin-right: 8px;">` : favicon;
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
        <div class="file-input">
            <label for="filePath" style="margin-right: 10px">Importer un fichier:</label>
            <label for="fileUpload" class="browse-icon">
                <i class="fas fa-folder-open"></i>
            </label>
            <input type="file" id="fileUpload" name="fileUpload" accept=".sfpss" style="display: none;">
        </div>
        <div class="file-input">
            <!-- Export Button -->
            <button id="exportButton" class="export-icon" style="margin-left: 10px;">
                <i class="fas fa-file-export"></i> Exporter
            </button>
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

    // Handle file export
    document.getElementById('exportButton').addEventListener('click', function() {
        try {
            let dataStr = allData;
            console.log('Exporting data:', dataStr);
            cryptData(dataStr);// Convert `allData` to JSON string with indentation
            showDurationAlertMessage("Fichier exporté avec succès.", 2000, '--sp-success');
        } catch (e) {
            console.error("Erreur lors de l'exportation du fichier:", e);
            showAlertMessage("Erreur lors de l'exportation du fichier.");
        }
    });

    // Handle file upload
    $('#fileUpload').on('change', function() {
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
}


