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

        function createCard(site) {
            const card = document.createElement('button');
            card.className = 'long-button';
            card.style = 'color: var(--couleur-dark), box-shadow: 0 8px 8px rgba(0, 0, 0, 0.25);';
            card.onclick = () => {
                window.location.href = './modify.php?/site=' + site.id;
            };
            card.innerHTML = `
                <div class="card-body" style="display: flex">
                    <div class="col-15">
                        <img src="SVG/view.svg" alt="Icon" class="icon">
                    </div>
                    <div class="col-70">
                        <h5 class="card-title">${site.title}</h5>
                    </div>
                    <div class="col-15">
                        <img src="SVG/more.svg" alt="Icon" class="icon">
                    </div>
                </div>
            `;
            return card;
        }

        async function getAllCards() {
            const uid = getCookie('uid');
            const key = getCookie('key');
            console.log(uid + " - " + key);

            const url = `http://localhost:5000/get_all_sites?uid=${encodeURIComponent(uid)}&key=${encodeURIComponent(key)}`;

            try {
                const response = await fetch(url);
                if (response === "No sites found") {
                    return "No sites found"
                } else {
                    const result = await response.json();
                    console.log(result);

                    if (result.error) {
                        alert('Error: ' + result.error);
                    }else {
                        for (let i = 0; i < result.length; i++) {
                            const card = createCard(result[i]);
                            document.getElementById('results-container').appendChild(card);
                        }
                    }


                }
            } catch (error) {
                console.error('Error during fetching cards:', error);
                alert('Error during fetching cards: ' + error);
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
    <div class="col-65">
        <div class="scroll-box" id="results-container">
            <script>
                getAllCards();
            </script>
        </div>
    </div>
    <div class="col-25">
        <div class="simple-container flex">
            <img src="SVG/add.svg" alt="Icon" class="icon" style="margin: 0 8%">
            <img src="SVG/remove.svg" alt="Icon" class="icon" style="margin: 0 8%">
            <img src="SVG/logout.svg" alt="Icon" class="icon" style="margin: 0 8%">
        </div>
    </div>
</div>
</body>
</html>