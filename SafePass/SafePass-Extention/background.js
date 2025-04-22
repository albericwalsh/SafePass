let isConnected = false; // Variable pour stocker le statut de connexion
console.log('Background script is running');

// Fonction pour tester la connexion au serveur
function testServerConnection() {
    console.log('Testing server connection...');
    fetch('http://localhost:5000/test', { method: 'GET' })
        .then(response => {
            if (response.ok) {
                console.log('Connexion au serveur réussie');
                isConnected = true;
                updateIcon(true); // Mettre à jour l'icône en vert
            } else {
                console.error('Erreur de connexion au serveur');
                isConnected = false;
                updateIcon(false); // Mettre à jour l'icône en rouge
            }
        })
        .catch(error => {
            console.error('Le serveur est inaccessible:', error);
            isConnected = false;
            updateIcon(false); // Mettre à jour l'icône en rouge
        });
}

// Fonction pour mettre à jour l'icône en fonction du statut
function updateIcon(status) {
    const iconPath = status ? "  /icon_ok.png" : "/icon_failed.png";
    chrome.action.setIcon({ path: iconPath });
}

console.log("Extension chargée : en attente de l'ouverture d'une fenêtre");

chrome.windows.onCreated.addListener(() => {
    console.log("Nouvelle fenêtre détectée - lancement du test de connexion");
    testServerConnection();
});

chrome.runtime.onInstalled.addListener(() => {
    console.log("Extension installée - lancement du test de connexion");
    testServerConnection();
});



// Écouteur pour envoyer le statut de connexion à la popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "getStatus") {
        sendResponse({ status: isConnected });
    }
});
