<?php
if (isset($_COOKIE['session'])) {
    header('Location: ./home.php');
    exit();
} else {
    header('Location: ./login.php');
    exit();
}