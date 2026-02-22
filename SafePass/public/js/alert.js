function showAlertMessage(message, color = '--sp-info') {
    // Crée la div pour le fond (backdrop) - solide et au-dessus
    const backdropHtml = '<div id="backdrop" style="position:fixed;left:0;top:0;width:100%;height:100%;background:rgba(0,0,0,0.92);z-index:99998;"></div>';

    // Crée la div pour l'alerte avec le message passé en paramètre
    const alertHtml = `
        <div id="alert" style="position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);z-index:100001;max-width:520px;width:90%;box-shadow: 0 0 50px 0 var(${color});">
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
        <div id="alert" style="position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);z-index:100001;max-width:420px;width:80%;box-shadow: 0 0 50px 0 var(${color}); transition: opacity 0.5s ease;">
            <div class="alert-content" style="text-align:center;padding:12px 16px;">
                <p style="margin:0;">${message}</p>
            </div>
        </div>
    `;

    // Ajoute le backdrop solide et la fenêtre d'alerte au body (évite les doublons)
    const localBackdrop = '<div id="backdrop" style="position:fixed;left:0;top:0;width:100%;height:100%;background:rgba(0,0,0,0.92);z-index:99998;"></div>';
    if (!document.getElementById('backdrop')) $('body').append(localBackdrop);
    $('body').append(alertHtml);

    // Attendre avant de démarrer l'animation de fade
    setTimeout(function () {
        $('#alert').css('opacity', '0');  // Applique l'effet de fondu
    }, timer);

    // Supprimer complètement l'alerte et le backdrop après l'animation
    setTimeout(function () {
        $('#alert').remove();
        $('#backdrop').remove();
    }, timer + 500); // 500ms pour correspondre au temps de transition
}

function showCancelDurationAlertMessage(message, timer = 2000, color = '--sp-alert', cancelText = 'Cancel', onCancel = () => {
    console.log("cancel");
}) {
    // Crée la div pour l'alerte avec le message passé en paramètre
    const alertHtml = `
        <div id="alert" style="position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);z-index:100001;max-width:520px;width:90%;box-shadow: 0 0 50px 0 var(${color}); transition: opacity 0.5s ease;">
            <div class="alert-content">
                <p>${message}</p>
                <div class="alert-buttons">
                    <button class="btn sp-btn-primary " type="button" id="cancelButton">` + cancelText + `</button>
                </div>
            </div>
        </div>
    `;

    // Ajoute le backdrop solide et la fenêtre d'alerte au body (évite les doublons)
    const localBackdrop2 = '<div id="backdrop" style="position:fixed;left:0;top:0;width:100%;height:100%;background:rgba(0,0,0,0.92);z-index:99998;"></div>';
    if (!document.getElementById('backdrop')) $('body').append(localBackdrop2);
    $('body').append(alertHtml);

    // Attendre avant de démarrer l'animation de fade
    setTimeout(function () {
        $('#alert').css('opacity', '0');  // Applique l'effet de fondu
    }, timer);

    // Supprimer complètement l'alerte et le backdrop après l'animation
    setTimeout(function () {
        $('#alert').remove();
        $('#backdrop').remove();
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
    // Crée la div pour le fond (backdrop) - solide et au-dessus
    const backdropHtml = '<div id="backdrop" style="position:fixed;left:0;top:0;width:100%;height:100%;background:rgba(0,0,0,0.92);z-index:99998;"></div>';

    // Crée la div pour l'alerte avec le message et deux boutons (OK et Cancel)
    const alertHtml = `
        <div class="" id="alert" style="position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);z-index:100001;max-width:520px;width:90%;box-shadow: 0 0 50px 0 var(` + color + `);">
            <div class="alert-content">
                <p>${message}</p>
                <div class="alert-buttons">
                    <button class="btn sp-btn " type="button" id="cancelButton">` + cancelText + `</button>
                    <button class="btn sp-btn-primary " type="button" id="confirmButton">` + confirmText + `</button>
                </div>
            </div>
        </div>
    `;

    // Ajoute le backdrop solide et la fenêtre d'alerte au body (évite les doublons)
    if (!document.getElementById('backdrop')) $('body').append(backdropHtml);
    $('body').append(alertHtml);

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

