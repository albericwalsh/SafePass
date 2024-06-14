<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Home</title>
    <!-- Icon -->
    <link rel="icon" href="SVG/password.svg" type="image/x-icon">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="css/style.css">
    <link rel="stylesheet" href="css/container.css">
    <link rel="stylesheet" href="css/button.css">
    <link rel="stylesheet" href="css/scrollbar.css">
    <link rel="stylesheet" href="css/card.css">
    <!-- Bootstrap CSS -->
    <link href="https://stackpath.bootstrapcdn.com/bootstrap/4.5.2/css/bootstrap.min.css" rel="stylesheet">
    <script>
        function getCookie(name) {
            let value = "; " + document.cookie + "=";
            const parts = value.split(`; ${name}=`);
            if (parts.length === 2) return parts.pop().split(';').shift();
        }

        //url get parameter id
        const actual_URL = new URL(window.location.href).search;

        const Id = String(actual_URL).split('=')[1];
        let Title = '';

        async function fetchAndSetData() {
            const uid = getCookie('uid');
            const key = getCookie('key');
            console.log(actual_URL + " - " + key + " - " + uid);
            if (Id === "-1") {
                document.getElementById('url').value = '';
                document.getElementById('username').value = '';
                document.getElementById('password').value = '';
                document.getElementById('notes').textContent = '';
                document.getElementById('date').textContent = '';
            }else {
                try {
                    const response = await fetch(`http://localhost:5000/get_site?id=${encodeURIComponent(Id)}&key=${encodeURIComponent(key)}&uid=${encodeURIComponent(uid)}`);
                    if (!response.ok) {
                        new Error('Network response was not ok ' + response.statusText);
                    }
                    const data = await response.json();

                    // Assuming data contains the fields 'url', 'username', 'password', and 'notes'
                    Title = data.title;
                    document.getElementById('url').value = data.url_site || '';
                    document.getElementById('username').value = data.identifiant || '';
                    document.getElementById('password').value = data.password || '';
                    document.getElementById('notes').textContent = data.notes || '';
                    document.getElementById('date').textContent = data.expiration_suggestion || '';
                    console.log(data);
                } catch (error) {
                    console.error('There has been a problem with your fetch operation:', error);
                }
            }
        }

        // Call the function when the page loads
        window.onload = fetchAndSetData;


        async function saveData() {
            const key = getCookie('key');
            const url = document.getElementById('url').value;
            const username = document.getElementById('username').value;
            const password = document.getElementById('password').value;
            const notes = document.getElementById('notes').textContent;
            const expiration = document.getElementById('date').textContent;

            const data = {
                title: Title,
                url_site: url,
                identifiant: username,
                password: password,
                notes: notes,
                expiration_suggestion: expiration,
                id: Id,
                encrypted_uid: getCookie('uid')
            };


            try {
                console.log(data);

                if (Id === "-1") {
                    const response = await fetch(`http://localhost:5000/create_site?uid=${encodeURIComponent(data.encrypted_uid)}&title=${encodeURIComponent(data.url_site)}&identifiant=${encodeURIComponent(data.identifiant)}&password=${encodeURIComponent(data.password)}&url_site=${encodeURIComponent(data.url_site)}&notes=${encodeURIComponent(data.notes)}&expiration_suggestion=10/12/2024&key=${encodeURIComponent(key)}`, {
                        method: 'POST'
                    });
                    if (!response.ok) {
                        new Error('Network response was not ok ' + response.statusText);
                    }
                    console.log(response);
                    window.location.href = './home.php';
                }else {
                    const response = await fetch(`http://localhost:5000/update_site?data=${encodeURIComponent(JSON.stringify(data))}&key=${encodeURIComponent(key)}`, {
                        method: 'PUT'
                    });
                    if (!response.ok) {
                        new Error('Network response was not ok ' + response.statusText);
                    }
                    console.log(response);
                    window.location.href = './home.php';
                }
            } catch (error) {
                console.error('There has been a problem with your fetch operation:', error);
            }
        }

    </script>
</head>
<body>
<header class="header d-flex align-items-center custom-shadow mb-6">
    <div class="col-50">
        <img src="SVG/SafePass%20-%20color.svg" alt="Logo" class="logo">
    </div>
    <div class="col-50">
        <div class=" custom-input-container input-group-prepend">
                <span class="input-group-text"><img src="SVG/search.svg" alt="Icon" class="icon">
                </span>
            <label>
                <input type="text" class="form-control" placeholder="Search">
            </label>
        </div>
    </div>
</header>
<div class="custom-container">
    <div class="col-55">
        <div class=" custom-input-container input-group-prepend">
                <span class="input-group-text"><img src="SVG/web.svg" alt="Icon" class="icon">
                </span>
            <label>
                <input type="text" id="url" class="form-control" placeholder="Url">
            </label>
        </div>
        <div class=" custom-input-container input-group-prepend">
                <span class="input-group-text"><img src="SVG/account.svg" alt="Icon" class="icon">
                </span>
            <label>
                <input type="text" id="username" class="form-control" placeholder="Username">
            </label>
        </div>
        <div class=" custom-input-container input-group-prepend">
                <span class="input-group-text"><img src="SVG/password.svg" alt="Icon" class="icon">
                </span>
            <label>
                <input type="text" id="password" class="form-control" placeholder="Password">
            </label>
        </div>
        <br>
        <div class=" custom-input-container input-group-prepend">
            <label class="form-control" id="date" >24d before expiration</label>
        </div>
    </div>
    <div class="col-45">
        <div class="card-info" style="height: 500px; background-color: var(--couleur-dark)">
            <h2 class="info-text" id="notes"  style="color: var(--couleur-white)">Notes</h2>
        </div>
        <div class="custom-container">
            <div class="col-45">
                <button class="simple-button custom-shadow"
                        style="background-color: var(--couleur-warning); color: var(--couleur-black)"
                        onclick="window.location='./home.php'">
                    Cancel
                </button>
            </div>
            <div class="col-50">
                <button class="simple-button custom-shadow" onclick="saveData()">
                    Save
                </button>
            </div>
        </div>
    </div>
</div>
</body>
</html>