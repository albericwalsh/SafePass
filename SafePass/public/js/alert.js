function showAlertMessage(message, color = '--sp-info') {
    // Crée la div pour le fond (backdrop)
    const backdropHtml = '<div class="backdrop" id="backdrop"></div>';

    // Crée la div pour l'alerte avec le message passé en paramètre
    const alertHtml = `
        <div class="upper-center-window " style="box-shadow: 0 0 50px 0 var(` + color + `);" id="alert">
            <div class="alert-content">
                <p>${message}</p>
                <div class="alert-buttons">
                    <button class="btn sp-btn-primary " type="button" id="closeAlert">OK</button>
                </div>
            </div>
        </div>
    `;

    // Ajoute le backdrop et la fenêtre d'alerte au body
    $('body').append(backdropHtml, alertHtml);

    // Gère la fermeture de l'alerte en cliquant sur le bouton OK
    $('#closeAlert').on('click', function () {
        $('#alert').remove();  // Enlève la fenêtre d'alerte
        $('#backdrop').remove();  // Enlève le backdrop
    });
}

function showDurationAlertMessage(message, timer = 2000, color = '--sp-info') {
    // Crée la div pour l'alerte avec le message passé en paramètre
    const alertHtml = `
        <div class="upper-top-window" style="box-shadow: 0 0 50px 0 var(${color}); transition: opacity 0.5s ease;" id="alert">
            <div class="alert-content">
                <p>${message}</p>
            </div>
        </div>
    `;

    // Ajoute la fenêtre d'alerte au body
    $('body').append(alertHtml);

    // Attendre avant de démarrer l'animation de fade
    setTimeout(function () {
        $('#alert').css('opacity', '0');  // Applique l'effet de fondu
    }, timer);

    // Supprimer complètement l'alerte après l'animation
    setTimeout(function () {
        $('#alert').remove();
    }, timer + 500); // 500ms pour correspondre au temps de transition
}

function showCancelDurationAlertMessage(message, timer = 2000, color = '--sp-alert', cancelText = 'Cancel', onCancel = () => {
    console.log("cancel");
}) {
    // Crée la div pour l'alerte avec le message passé en paramètre
    const alertHtml = `
        <div class="upper-top-window" style="box-shadow: 0 0 50px 0 var(${color}); transition: opacity 0.5s ease;" id="alert">
            <div class="alert-content">
                <p>${message}</p>
                <div class="alert-buttons">
                    <button class="btn sp-btn-primary " type="button" id="cancelButton">` + cancelText + `</button>
                </div>
            </div>
        </div>
    `;

    // Ajoute la fenêtre d'alerte au body
    $('body').append(alertHtml);

    // Attendre avant de démarrer l'animation de fade
    setTimeout(function () {
        $('#alert').css('opacity', '0');  // Applique l'effet de fondu
    }, timer);

    // Supprimer complètement l'alerte après l'animation
    setTimeout(function () {
        $('#alert').remove();
    }, timer + 500); // 500ms pour correspondre au temps de transition


    // Gère l'annulation (Cancel)
    $('#cancelButton').on('click', function () {
        $('#alert').remove();  // Enlève la fenêtre d'alerte
        $('#backdrop').remove(); // Enlève le backdrop
        onCancel();
    });
}


function showAlertConfirm(message, confirmText = 'OK', cancelText = 'Cancel', color = '--sp-info', onConfirm = () => {
    console.log("confirm");
}, onCancel = () => {
    console.log("cancel");
}) {
    // Crée la div pour le fond (backdrop)
    const backdropHtml = '<div class="backdrop" id="backdrop"></div>';

    // Crée la div pour l'alerte avec le message et deux boutons (OK et Cancel)
    const alertHtml = `
        <div class="upper-center-window" style="box-shadow: 0 0 50px 0 var(` + color + `);" id="alert">
            <div class="alert-content">
                <p>${message}</p>
                <div class="alert-buttons">
                    <button class="btn sp-btn " type="button" id="cancelButton">` + cancelText + `</button>
                    <button class="btn sp-btn-primary " type="button" id="confirmButton">` + confirmText + `</button>
                </div>
            </div>
        </div>
    `;

    // Ajoute le backdrop et la fenêtre d'alerte au body
    $('body').append(backdropHtml, alertHtml);

    // Gère la confirmation (OK)
    $('#confirmButton').on('click', function () {
        $('#alert').remove();  // Enlève la fenêtre d'alerte
        $('#backdrop').remove(); // Enlève le backdrop
        onConfirm();
    });

    // Gère l'annulation (Cancel)
    $('#cancelButton').on('click', function () {
        $('#alert').remove();  // Enlève la fenêtre d'alerte
        $('#backdrop').remove(); // Enlève le backdrop
        onCancel();
    });

    return bool;
}

