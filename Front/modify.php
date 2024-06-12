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
                <input type="text" class="form-control" placeholder="Url">
            </label>
        </div>
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
                <input type="password" class="form-control" placeholder="Password">
            </label>
        </div>
        <br>
        <div class=" custom-input-container input-group-prepend">
            <label class="form-control">24d before expiration</label>
        </div>
    </div>
    <div class="col-45">
        <div class="card-info" style="height: 500px; background-color: var(--couleur-dark)">
            <h2 class="info-text" style="color: var(--couleur-white)">Notes</h2>
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