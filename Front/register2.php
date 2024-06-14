<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Register</title>
    <link rel="icon" href="SVG/password.svg" type="image/x-icon">
    <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="css/style.css">
    <link rel="stylesheet" href="css/container.css">
    <link rel="stylesheet" href="css/button.css">
    <!-- Bootstrap CSS -->
    <link href="https://stackpath.bootstrapcdn.com/bootstrap/4.5.2/css/bootstrap.min.css" rel="stylesheet">
    <script>
        const actual_URL = new URL(window.location.href).search;

        const Key = String(actual_URL).split('key=')[1];
        console.log(Key);

        async function setKeyText() {
            document.getElementById('key').textContent = Key || '';
        }

        window.onload = setKeyText;

        async function copyKey() {
            const key = document.getElementById('key').textContent;
            navigator.clipboard.writeText(key);
            alert('Key copied to clipboard');
        }
    </script>
</head>
<body>
<header class="header d-flex align-items-center custom-shadow mb-6">
    <div class="">
        <img src="SVG/SafePass%20-%20color.svg" alt="Logo" class="logo">
        <h1 class="title">NOTE YOUR SUPER PASSWORD</h1>
    </div>
</header>
<div class="custom-container">
    <div class="col-65">
        <div class=" custom-input-container input-group-prepend" style="width: 90%">
            <span class="input-group-text"><img src="SVG/password.svg" alt="Icon" class="icon">
            </span>
            <div class="scroll-box" style="width: 100%; overflow-y: clip; overflow-x: auto">
                <label>
                    <h1 class="form-control" style="white-space: nowrap;" id="key"></h1>
                </label>
            </div>
        </div>
        <button class="simple-button custom-shadow" style="background-color: var(--couleur-info)" onclick="copyKey()">
            Copy
        </button>
    </div>
    <div class="col-35" style="align-content: flex-end">
        <div class="card-info" style="height: 400px">
            <h2 class="info-text">This is your single super password for unlock all other passwords. Do not share it. If
                you
                loose it, you loose all your data.</h2>
        </div>
        <button class="simple-button custom-shadow" onclick="window.location='login.php'">
            Continue
        </button>
    </div>
</body>
</html>