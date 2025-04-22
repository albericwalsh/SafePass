// Save data to server
function saveAllData() {
    try {
        console.log('Data saved:', allData);
        $.ajax({
            url: 'http://127.0.0.1:5000/saveData',
            type: 'POST',
            data: JSON.stringify(allData),
            contentType: 'application/json; charset=utf-8',
            dataType: 'json',
            success: function(response) {
                console.log('Les données ont été sauvegardées avec succès.');
            },
            error: function(error) {
                console.error('Échec de la sauvegarde des données: ', error);
            }
        });
    } catch (e) {
        console.error('Error saving data', e);
    }
}


function loadAllData() {
    try {
        $.ajax({
            url: 'http://127.0.0.1:5000/getData', // Assure-toi que l'URL correspond à ton endpoint Flask
            type: 'GET',
            dataType: 'json',
            success: function (data) {
                allData = data;
                displayCategory(currentCategory); // Affiche initialement la catégorie 'sites'
                console.log('Données chargées:', allData);
                showAlertMessage("Données chargées avec succès.");
            },
            error: function (error) {
                console.error('Erreur lors du chargement des données:', error);
                STATUS = error.status;
                if (error.status === 0){
                    STATUS = "Erreur de connexion";
                }
                showAlertMessage("Erreur lors du chargement des données: " + STATUS, '--sp-error');
            }
        });
    } catch (e) {
        console.error('Erreur lors du chargement des données', e);
    }
}

function decryptData(Data) {
    try {
        $.ajax({
            url: 'http://127.0.0.1:5000/decryptData', // Assure-toi que l'URL correspond à ton endpoint Flask
            type: 'GET',
            data: { data: Data }, // Send the path as a query parameter
            dataType: 'json',
            success: function (data) {
                const isValidStructure = validateDataStructure(data);
                if (!isValidStructure) {
                    throw new Error('La structure des données ne correspond pas au format attendu.');
                }
                //ajouter les données importées à la liste
                addToData(data);
                console.log('Données importées:', data);
                saveAllData(); // Sauvegarde les données importées
                displayCategory(currentCategory); // Affiche initialement la catégorie 'sites'
            },
            error: function (error) {
                console.error('Erreur lors du chargement des données:', error);
            }
        });
    } catch (e) {
        console.error('Erreur lors du chargement des données', e);
        showAlertMessage("Erreur lors du chargement des données: " + e, '--sp-error');
        return null;
    }
}

function cryptData(Data) {
    try {
        Data = JSON.stringify(Data);
        $.ajax({
            url: 'http://127.0.0.1:5000/cryptData', // Assure-toi que l'URL correspond à ton endpoint Flask
            type: 'GET',
            data: { data: Data }, // Send the path as a query parameter

            success: function (data) {
                let dataStr = data;
                console.log('Données cryptées:', dataStr);
                const blob = new Blob([dataStr], { type: 'application/sfpss' }); // Create a blob of JSON data
                const url = URL.createObjectURL(blob);

                // Create a link element to download the blob as a file
                const a = document.createElement('a');
                a.href = url;
                a.download = 'data_export.sfpss'; // Set the download filename with .sfpss extension
                document.body.appendChild(a);
                a.click();

                // Clean up by revoking the object URL and removing the link element
                URL.revokeObjectURL(url);
                a.remove();
            },
            error: function (error) {
                console.error('Erreur lors du chargement des données:', error);
            }
        });
    } catch (e) {
        console.error('Erreur lors du chargement des données', e);
        showAlertMessage("Erreur lors du chargement des données: " + e, '--sp-error');
        return null;
    }
}
