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
</head>
<body>
<header class="header d-flex align-items-center custom-shadow mb-6">
    <div class="">
        <img src="SVG/SafePass%20-%20color.svg" alt="Logo" class="logo">
        <h1 class="title">PERSONALS INFORMATIONS</h1>
    </div>
</header>
<div class="custom-container"">
    <div class="col-65">
        <div class=" custom-input-container input-group-prepend">
                <span class="input-group-text"><img src="SVG/account.svg" alt="Icon" class="icon">
                </span>
            <label>
                <input type="text" class="form-control" placeholder="Username">
            </label>
        </div>
        <div class=" custom-input-container input-group-prepend">
                <span class="input-group-text"><img src="SVG/web.svg" alt="Icon" class="icon">
                </span>
            <label>
                <input type="text" class="form-control" placeholder="mail">
            </label>
        </div>
        <div class=" custom-input-container input-group-prepend">
                <span class="input-group-text"><img src="SVG/password.svg" alt="Icon" class="icon">
                </span>
            <label>
                <input type="password" class="form-control" placeholder="Password">
            </label>
        </div>
    </div>
    <div class="col-35" style="align-content: flex-end">
        <div class="card-info" style="height: 400px">
            <h2 class="info-text">Use a simple Username for login, put your email and create a Password</h2>
        </div>
        <button class="simple-button custom-shadow" onclick="window.location='register2.php'">
            Continue
        </button>
    </div>
</div>
</body>
</html>