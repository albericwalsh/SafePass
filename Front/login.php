<?php
session_start();

if ($_SERVER['REQUEST_METHOD'] == 'POST') {
    $username = $_POST['username'];
    $password = $_POST['password'];
    $key = $_POST['key'];

    $url = 'http://127.0.0.1:5000/login?user_name=' . urlencode($username) . '&password=' . urlencode($password) . '&key=' . urlencode($key);
    $response = file_get_contents($url);

    if (strpos($response, 'Login successful') !== false) {
        $_SESSION['username'] = $username;
        setcookie('username', $username, time() + (86400 * 30), "/");
        echo json_encode(['status' => 'success']);
    } else {
        echo json_encode(['status' => 'error']);
    }
    exit();
}
?>
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
    <script>

        async function login() {
            const username = document.querySelector('input[name="username"]').value;
            const password = document.querySelector('input[name="password"]').value;
            const key = document.querySelector('input[name="key"]').value;

            const url = `http://localhost:5000/login?user_name=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}&key=${encodeURIComponent(key)}`;

            try {
                const response = await fetch(url, {method: 'POST'});
                const result = await response.text();

                console.log(result);
                if (!result.includes('Login failed')) {
                    alert('Login successful')
                    const id = result.split('"id": ')[1].split(',')[0];
                    console.log(id);

                    // Set cookies for username and key
                    setCookie('uid', id, sessionStorage); // Cookie expires in 7 days
                    setCookie('key', key, sessionStorage); // Cookie expires in 7 days

                    // Assuming your PHP script is on the same domain and sets the session/cookie
                    await fetch('./login-test.php', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            username: username
                        })
                    });
                    window.location.href = './home.php';
                } else {
                    alert('Login failed: ' + result);
                }
            } catch (error) {
                console.error('Error during login:', error);
                alert('Error during login: ' + error);
            }
        }

        function setCookie(name, value, days) {
            const d = new Date();
            d.setTime(d.getTime() + (days * 24 * 60 * 60 * 1000));
            const expires = "expires=" + d.toUTCString();
            document.cookie = name + "=" + value + ";" + expires + ";path=/";
        }
    </script>
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
                <input type="text" name="username" class="form-control" placeholder="Username">
            </label>
        </div>
        <div class=" custom-input-container input-group-prepend">
                <span class="input-group-text"><img src="SVG/password.svg" alt="Icon" class="icon">
                </span>
            <label>
                <input type="password" name="password" class="form-control" placeholder="Password">
            </label>
        </div>
        <div class=" custom-input-container input-group-prepend">
                <span class="input-group-text"><img src="SVG/password.svg" alt="Icon" class="icon">
                </span>
            <label>
                <input type="password" name="key" class="form-control" placeholder="Super Password">
            </label>
        </div>
        <button class="link-button" onclick="window.location='register1.php'">
            Create an account
        </button>
    </div>
    <div class="col-25" style="align-content: flex-end">
        <button onclick="login()" class="simple-button custom-shadow">
            Continue
        </button>
    </div>
</div>
</body>
</html>