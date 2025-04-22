// content.js
let fields = {
    username: null,
    password: null
};

// Créer un menu contextuel pour le champ de mot de passe
chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
        id: "getPasswordFieldUrl",
        title: "Récupérer l'URL et le mot de passe",
        contexts: ["editable"]
    });
});

// Recherche des champs de saisie de type 'text', 'email', et 'password'
document.querySelectorAll('input[type="text"], input[type="email"], input[type="password"]').forEach(input => {
    if (input.type === 'password') {
        fields.password = input;
    } else if (input.type === 'text' || input.type === 'email') {
        fields.username = input;
    }
});

// Écoute de l'événement de clic sur le menu contextuel
chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === "getPasswordFieldUrl") {
        // Vérifier si le champ de mot de passe est actif
        if (fields.password) {
            // Obtenir l'URL de la page actuelle
            const url = window.location.href;
            const passwordValue = fields.password.value; // Récupérer la valeur du champ de mot de passe

            // Envoyer les informations au serveur Flask
            fetch('http://localhost:5000/fields', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    url: url,
                    password: passwordValue
                })
            })
                .then(response => response.json())
                .then(data => console.log('Success:', data))
                .catch((error) => {
                    console.error('Error:', error);
                });
        }
    }
});
