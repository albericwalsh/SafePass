<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Login</title>
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
        <h1 class="title">LOGIN TO CONTINUE</h1>
    </div>
</header>
<div class="custom-container">
    <div class="col-75">
        <div class=" custom-input-container input-group-prepend">
                <span class="input-group-text"><img src="SVG/account.svg" alt="Icon" class="icon">
                </span>
            <label>
                <input type="text" class="form-control" placeholder="Username">
            </label>
        </div>
        <div class=" custom-input-container input-group-prepend">
                <span class="input-group-text"><img src="SVG/password.svg" alt="Icon" class="icon">
                </span>
            <label>
                <input type="password" class="form-control" placeholder="Super Password">
            </label>
        </div>
        <button class="link-button" onclick="window.location='register1.php'">
            Create an account
        </button>
    </div>
    <div class="col-25" style="align-content: flex-end">
        <button class="simple-button custom-shadow" onclick="window.location='home.php'">
            Continue
        </button>
    </div>
</div>
</body>
</html>