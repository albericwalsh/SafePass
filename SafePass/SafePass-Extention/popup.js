
// Récupérer le statut de connexion stocké dans le service worker (background.js)
chrome.runtime.sendMessage({ action: "getStatus" }, (response) => {
    const statusElement = document.getElementById("status");
    statusElement.textContent = response.status ? "Connexion réussie" : "Échec de la connexion";
});