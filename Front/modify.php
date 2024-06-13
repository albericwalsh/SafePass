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
            value = parts.pop().split(';').shift();
            // if (parts.length === 2) return parts.pop().split(';');
            return value;
        }
        const uid = getCookie('uid');
        const key = getCookie('key');

        //url params title
        const id = new URLSearchParams(window.location.search).get('site');
        async function GetValues() {

            console.log(id + " - " + key);
            const url = `http://localhost:5000/get_site?id=${encodeURIComponent(id)}&key=${encodeURIComponent(key)}`;

            try {
                const response = await fetch(url);
                console.log(response);
                //contains Aucun site trouvé
                if (response === "No site found") {
                    alert("No site found");
                    return "No site found"
                } else {
                    const result = await response.json();
                    console.log(result);

                    if (result.error) {
                        alert('Error: ' + result.error);
                    }else {
                        document.getElementById('url').value = result.url;
                        document.getElementById('username').value = result.username;
                        document.getElementById('password').value = result.password;
                        document.getElementById('notes').innerHTML = result.notes;
                        document.getElementById('date').innerHTML = result.expiration;
                    }


                }
            } catch (error) {
                console.error('Error during login:', error);
                alert('Error during login: ' + error);
            }
        }

        GetValues();

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
                <input type="password" id="password" class="form-control" placeholder="Password">
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
                        onclick="window.location='home.php'">
                    Cancel
                </button>
            </div>
            <div class="col-50">
                <button class="simple-button custom-shadow" onclick="window.location='home.php'">
                    Save
                </button>
            </div>
        </div>
    </div>
</div>
</body>
</html>