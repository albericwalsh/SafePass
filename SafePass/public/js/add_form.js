// Function to show the add item form
function showAddForm(category) {
    const backdropHtml = '<div class="backdrop" id="backdrop"></div>';
    let formFields = '';

    if (category === 'sites') {
        formFields = `
            <label for="name">Name:</label>
            <aws-input id="name" mode="edit" type="text"></aws-input>
            <label for="url">URL:</label>
            <aws-input id="url" mode="edit" type="url"></aws-input>
            <label for="username">Username:</label>
            <aws-input id="username" mode="edit" type="text"></aws-input>
            <label for="password">Password:</label>
            <div class="password-field">
                <aws-input id="password" mode="edit" type="password"></aws-input>
                <aws-icon-button class="generate-password-btn" size="sm" variant="secondary" onclick="generateAndSetPassword()"><span class="material-icons">autorenew</span></aws-icon-button>
            </div>
        `;
    } else if (category === 'applications') {
        formFields = `
            <label for="name">Name:</label>
            <aws-input id="name" mode="edit" type="text"></aws-input>
            <label for="GUID">GUID:</label>
            <aws-input id="GUID" mode="edit" type="text"></aws-input>
            <label for="username">Username:</label>
            <aws-input id="username" mode="edit" type="text"></aws-input>
            <label for="password">Password:</label>
            <div class="password-field">
                <aws-input id="password" mode="edit" type="password"></aws-input>
                <aws-icon-button class="generate-password-btn" size="sm" variant="secondary" onclick="generateAndSetPassword()"><span class="material-icons">autorenew</span></aws-icon-button>
            </div>
        `;
    } else if (category === 'autres') {
        formFields = `
            <label for="name">Name:</label>
            <aws-input id="name" mode="edit" type="text"></aws-input>
            <label for="username">Username:</label>
            <aws-input id="username" mode="edit" type="text"></aws-input>
            <label for="password">Password:</label>
            <div class="password-field">
                <aws-input id="password" mode="edit" type="password"></aws-input>
                <aws-icon-button class="generate-password-btn" size="sm" variant="secondary" onclick="generateAndSetPassword()"><span class="material-icons">autorenew</span></aws-icon-button>
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
                    <aws-button id="cancelButton" variant="secondary">Cancel</aws-button>
                    <aws-button id="addSubmit" variant="primary">Add</aws-button>
                </div>
            </form>
        </div>`;
    $('body').append(backdropHtml, formHtml);

    // prevent body scroll while settings open
    $('body').css('overflow', 'hidden');

    // make settings container scrollable and trap scroll inside
    const settingsContainer = document.querySelector('#settings-container');
    if (settingsContainer) {
        settingsContainer.style.maxHeight = '70vh';
        settingsContainer.style.overflow = 'auto';
        settingsContainer.addEventListener('wheel', function (e) {
            const delta = e.deltaY;
            const up = delta < 0;
            if ((up && this.scrollTop === 0) || (!up && this.scrollTop + this.clientHeight >= this.scrollHeight)) {
                e.preventDefault();
            }
            e.stopPropagation();
        }, { passive: false });
    }

    // generate-password icon sets value on aws-input
    // (password visibility toggle handled by aws-input component in edit mode if supported)

    // Handle form submission
    $('#addSubmit').on('click', function () {
        let newItem = {};
        if (category === 'sites') {
            newItem = {
                name: document.getElementById('name').value || '',
                url: document.getElementById('url').value || '',
                username: document.getElementById('username').value || '',
                password: document.getElementById('password').value || ''
            };
        } else if (category === 'applications') {
            newItem = {
                name: document.getElementById('name').value || '',
                GUID: document.getElementById('GUID').value || '',
                username: document.getElementById('username').value || '',
                password: document.getElementById('password').value || ''
            };
        } else if (category === 'autres') {
            newItem = {
                name: document.getElementById('name').value || '',
                username: document.getElementById('username').value || '',
                password: document.getElementById('password').value || ''
            };
        }
        addItemToCategory(category, newItem);
    });

    // Handle form cancel
    $('#cancelButton').on('click', function () {
        try{ $('body').css('overflow', ''); }catch(e){}
        $('#add').remove();
        $('#backdrop').remove();
    });
}