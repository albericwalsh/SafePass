from selenium import webdriver
from selenium.webdriver.common.by import By
from pynput import keyboard
import pygetwindow as gw



def onDetect():
    # Obtenir la fenêtre active
    active_window = gw.getActiveWindow()
    print("Fenêtres ouvertes :", active_window)


    def on_type(key):
        try:
            if key.char and key.char.lower() in ['password', 'mdp']:
                print("Saisie de mot de passe détectée! Proposez une suggestion.")
        except AttributeError:
            pass

    # Écouter les frappes clavier
    with keyboard.Listener(on_press=on_type) as listener:
        listener.join()

def byUrl(url):
    # Obtenir l'URL de la page web active

    # Lancer un navigateur avec Selenium
    driver = webdriver.Chrome()
    driver.get(url)

    # Chercher les champs de saisie ayant un nom lié à un mot de passe
    password_fields = driver.find_elements(By.XPATH, "//*[contains(@id, 'password') or contains(@name, 'password') or contains(@placeholder, 'mot de passe')]")

    # Si un champ de mot de passe est trouvé, proposer une suggestion
    if password_fields:
        print("Champ de mot de passe détecté! Proposez une suggestion.")
    driver.quit()