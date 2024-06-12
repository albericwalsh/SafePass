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
                <span class="input-group-text" ><img src="SVG/search.svg" alt="Icon" class="icon" >
                </span>
            <label>
                <input type="text" class="form-control" placeholder="Search">
            </label>
        </div>
    </div>
</header>
<div class="custom-container">
    <div class="col-65">
        <div class="scroll-box">
            <button class="long-button" style="color: var(--couleur-dark)" onclick="window.location='modify.php'">
                <div class="card-body" style="display: flex">
                    <div class="col-15">
                        <img src="SVG/view.svg" alt="Icon" class="icon">
                    </div>
                    <div class="col-70">
                        <h5 class="card-title">www.youtube.com</h5>
                    </div>
                    <div class="col-15">
                        <img src="SVG/more.svg" alt="Icon" class="icon">
                    </div>
                </div>
            </button>
            <button class="long-button" style="color: var(--couleur-dark)" onclick="window.location='modify.php'">
                <div class="card-body" style="display: flex">
                    <div class="col-15">
                        <img src="SVG/view.svg" alt="Icon" class="icon">
                    </div>
                    <div class="col-70">
                        <h5 class="card-title">www.wikipedia.fr</h5>
                    </div>
                    <div class="col-15">
                        <img src="SVG/more.svg" alt="Icon" class="icon">
                    </div>
                </div>
            </button>
            <button class="long-button" style="color: var(--couleur-dark)" onclick="window.location='modify.php'">
                <div class="card-body" style="display: flex" >
                    <div class="col-15">
                        <img src="SVG/view.svg" alt="Icon" class="icon">
                    </div>
                    <div class="col-70">
                        <h5 class="card-title">www.google.com</h5>
                    </div>
                    <div class="col-15">
                        <img src="SVG/more.svg" alt="Icon" class="icon">
                    </div>
                </div>
            </button>
        </div>
    </div>
    <div class="col-25">
        <div class="simple-container">
            <img src="SVG/search.svg" alt="Icon" class="icon">
            <img src="SVG/search.svg" alt="Icon" class="icon">
            <img src="SVG/search.svg" alt="Icon" class="icon">
        </div>
    </div>
</div>
</body>
</html>