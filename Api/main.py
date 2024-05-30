import mysql.connector
from cryptography.fernet import Fernet




# Établissement de la connexion à la base de données
Db_con = mysql.connector.connect(
    host="localhost",
    user="root",
    password="",
    database="safepassdb"
)

if Db_con.is_connected():
    print('La connexion a bien été établie avec la base de données : ' + Db_con.database)
else:
    print('La connexion avec la base de données : ' + Db_con.database + ' a échoué')




# Définition de la classe User
class User:
    def __init__(self, id, user_name, address_mail, password, key=None):
        self.id = id
        self.user_name = user_name
        self.address_mail = address_mail
        self.password = password
        self.key = key

    def __str__(self):
        return f"{self.id} {self.user_name} {self.address_mail} {self.password}"

    def __repr__(self):
        return f"User(id={self.id}, user_name={self.user_name}, address_mail={self.address_mail}, password={self.password})"




# Définition de la classe Data
class Data:

    def __init__(self, id, encrypted_uid, title, identifiant, password, url_site, notes, expiration_suggestion):
        self.id = id
        self.encrypted_uid = encrypted_uid
        self.title = title
        self.identifiant = identifiant
        self.password = password
        self.url_site = url_site
        self.notes = notes
        self.expiration_suggestion = expiration_suggestion

    def __str__(self):
        return f"{self.id} {self.encrypted_uid} {self.title} {self.identifiant} {self.password} {self.url_site} {self.notes} {self.expiration_suggestion}"

    def __repr__(self):
        return f"Data(id={self.id}, encrypted_uid={self.encrypted_uid}, title={self.title}, identifiant={self.identifiant}, password={self.password}, url_site={self.url_site}, notes={self.notes}, expiration_suggestion={self.expiration_suggestion})"



# Création d'un curseur pour exécuter des requêtes SQL
cursor = Db_con.cursor()



# Génération d'une clé de cryptage
def generate_key():
    return Fernet.generate_key()

def encrypt_data(data, cipher_suite):
    return cipher_suite.encrypt(data.encode()).decode()

def decrypt_data(encrypted_data, cipher_suite):
    return cipher_suite.decrypt(encrypted_data.encode()).decode()

def encrypt_password(password, cipher_suite):
    return encrypt_data(password, cipher_suite)

def decrypt_password(encrypted_password, cipher_suite):
    return decrypt_data(encrypted_password, cipher_suite)


#
def sign_up(user_name, address_mail, password):
    cursor.execute("SELECT * FROM user WHERE user_name = %s", (user_name,))
    user_tuple = cursor.fetchone()
    if user_tuple:
        print(f"Erreur : L'utilisateur {user_name} existe déjà.")
        return None, None
    else:
        # Génération de la clé de cryptage pour cet utilisateur
        key = generate_key()
        cipher_suite = Fernet(key)
        encrypted_password = encrypt_password(password, cipher_suite)
        cursor.execute("INSERT INTO user (user_name, address_mail, password) VALUES (%s, %s, %s)",
                    (user_name, address_mail, encrypted_password))
        user_id = cursor.lastrowid
        print(f"L'utilisateur {user_name} a été ajouté avec l'id {user_id}")
        return User(user_id, user_name, address_mail, password), key

def login(user_name, password, cipher_suite):
    cursor.execute("SELECT * FROM user WHERE user_name = %s", (user_name,))
    user_tuple = cursor.fetchone()
    if user_tuple:
        stored_password = decrypt_password(user_tuple[3], cipher_suite)
        if stored_password == password:
            user = User(user_tuple[0], user_tuple[1], user_tuple[2], stored_password)
            print(f"Authentification réussie pour l'utilisateur : {user}")
            return user, cipher_suite
        else:
            print("Mot de passe incorrect")
            return None
    else:
        print(f"L'utilisateur {user_name} non trouvé")
        return None

def logout(user):
    user.user_name = None
    user.address_mail = None
    user.password = None
    user.key = None
    print(f"Utilisateur {user} déconnecté")


def update_user(user, cipher_suite):
    encrypted_password = encrypt_password(user.password, cipher_suite)
    cursor.execute("UPDATE user SET user_name = %s, address_mail = %s, password = %s WHERE id = %s",
                (user.user_name, user.address_mail, encrypted_password, user.id))
    print(f"L'utilisateur {user} a été mis à jour")

def delete_user(user_id, password, cipher_suite):
    cursor.execute("SELECT * FROM user WHERE id = %s", (user_id,))
    user_tuple = cursor.fetchone()
    if user_tuple:
        stored_password = decrypt_password(user_tuple[3], cipher_suite)
        if stored_password == password:
            cursor.execute("DELETE FROM user WHERE id = %s", (user_id,))
            print(f"L'utilisateur avec l'ID {user_id} a été supprimé.")
        else:
            print("Mot de passe incorrect. Impossible de supprimer l'utilisateur.")
    else:
        print(f"Aucun utilisateur trouvé avec l'ID {user_id}.")



def add_site(uid, title, identifiant, password, url_site, notes, expiration_suggestion, cipher_suite):
    encrypted_title = encrypt_data(title, cipher_suite)
    encrypted_identifiant = encrypt_data(identifiant, cipher_suite)
    encrypted_password = encrypt_data(password, cipher_suite)
    encrypted_url_site = encrypt_data(url_site, cipher_suite)
    encrypted_notes = encrypt_data(notes, cipher_suite)


    cursor.execute(
        "INSERT INTO data (encrypted_uid, title, identifiant, password, url_site, notes, expiration_suggestion) VALUES (%s, %s, %s, %s, %s, %s, %s)",
        (uid, encrypted_title, encrypted_identifiant, encrypted_password, encrypted_url_site, encrypted_notes,
        expiration_suggestion))
    print(f"La donnée {title} a été ajoutée pour l'utilisateur avec uid {uid}")

def update_site(data, cipher_suite):
    encrypted_title = encrypt_data(data.title, cipher_suite)
    encrypted_identifiant = encrypt_data(data.identifiant, cipher_suite)
    encrypted_password = encrypt_password(data.password, cipher_suite)
    encrypted_url_site = encrypt_data(data.url_site, cipher_suite)
    encrypted_notes = encrypt_data(data.notes, cipher_suite)
    expiration_suggestion = data.expiration_suggestion

    cursor.execute(
        "UPDATE data SET encrypted_uid = %s, title = %s, identifiant = %s, password = %s, url_site = %s, notes = %s, expiration_suggestion = %s WHERE id = %s",
        (data.encrypted_uid, encrypted_title, encrypted_identifiant, encrypted_password, encrypted_url_site,
        encrypted_notes, expiration_suggestion, data.id))
    print(f"La donnée {data} a été mise à jour")

def get_all_sites(uid, cipher_suite):
    cursor.execute("SELECT * FROM data WHERE encrypted_uid = %s", (uid,))
    data_tuples = cursor.fetchall()  # Utiliser fetchall() pour récupérer toutes les entrées
    sites = []
    for data_tuple in data_tuples:
        data = Data(data_tuple[0], data_tuple[1], decrypt_data(data_tuple[2], cipher_suite),
                    decrypt_data(data_tuple[3], cipher_suite), decrypt_data(data_tuple[4], cipher_suite),
                    decrypt_data(data_tuple[5], cipher_suite), decrypt_data(data_tuple[6], cipher_suite),
                    data_tuple[7])  # Décryptage de la date
        sites.append(data)
    if sites:
        for site in sites:
            print(site)
        return sites
    else:
        print(f"Aucun site trouvé pour l'utilisateur avec uid {uid}")
        return None

def get_specific_site(data_id, cipher_suite):
    cursor.execute("SELECT * FROM data WHERE id = %s", (data_id,))
    data_tuple = cursor.fetchone()
    if data_tuple:
        data = Data(data_tuple[0], data_tuple[1], decrypt_data(data_tuple[2], cipher_suite),
                    decrypt_data(data_tuple[3], cipher_suite), decrypt_data(data_tuple[4], cipher_suite),
                    decrypt_data(data_tuple[5], cipher_suite), decrypt_data(data_tuple[6], cipher_suite),
                    data_tuple[7])  # Décryptage de la date
        print(data)
        return data
    else:
        print(f"Aucun site trouvé avec l'ID {data_id}")
        return None

def delete_site(user_id, data_id, password, cipher_suite):
    cursor.execute("SELECT * FROM user WHERE id = %s", (user_id,))
    user_tuple = cursor.fetchone()
    if user_tuple:
        stored_password = decrypt_password(user_tuple[3], cipher_suite)
        if stored_password == password:
            cursor.execute("DELETE FROM data WHERE id = %s", (data_id,))
            print(f"Le site avec l'ID {data_id} a été supprimé.")
        else:
            print("Mot de passe incorrect. Impossible de supprimer le site.")
    else:
        print(f"Aucun utilisateur trouvé avec l'ID {user_id}.")




# Exemple d'utilisation des fonctions

#_,key = sign_up("Akemi", "Akemi@gmail.com", "Akemi123")
#print(key)




cipher_suite = Fernet("uAVZiudM3S8tu07jyDw8VwWeMglJh5UBajZ_rv52rCM=")
Akemi,Akemi.key = login("Akemi", "Akemi123", cipher_suite)

#add_site(Akemi.id, "Facebook", "Akemi", "Akemi123", "https://www.facebook.com", "Notes", date(2024, 12, 31), Akemi.key)
#add_site(Akemi.id, "Twitter", "Akemi", "Akemi123", "https://www.twitter.com", "Notes", date(2024, 12, 31), cipher_suite)
#add_site(Akemi.id, "Instagram", "Akemi", "Akemi123", "https://www.instagram.com", "Notes", date(2024, 12, 31), cipher_suite)
#add_site(Akemi.id, "LinkedIn", "Akemi", "Akemi123", "https://www.linkedin.com", "Notes", date(2024, 12, 31), cipher_suite)
#add_site(Akemi.id, "Pinterest", "Akemi", "Akemi123", "https://www.pinterest.com", "Notes", date(2024, 12, 31), cipher_suite)
#add_site(Akemi.id, "Snapchat", "Akemi", "Akemi123", "https://www.snapchat.com", "Notes", date(2024, 12, 31), cipher_suite)
#add_site(Akemi.id, "TikTok", "Akemi", "Akemi123", "https://www.tiktok.com", "Notes", date(2024, 12, 31), cipher_suite)
#add_site(Akemi.id, "WhatsApp", "Akemi", "Akemi123", "https://www.whatsapp.com", "Notes", date(2024, 12, 31), cipher_suite)
#add_site(Akemi.id, "YouTube", "Akemi", "Akemi123", "https://www.youtube.com", "Notes", date(2024, 12, 31), cipher_suite)
#add_site(Akemi.id, "Netflix", "Akemi", "Akemi123", "https://www.netflix.com", "Notes", date(2024, 12, 31), cipher_suite)
#add_site(Akemi.id, "Amazon", "Akemi", "Akemi123", "https://www.amazon.com", "Notes", date(2024, 12, 31), cipher_suite)
#add_site(Akemi.id, "Google", "Akemi", "Akemi123", "https://www.google.com", "Notes", date(2024, 12, 31), cipher_suite)
#add_site(Akemi.id, "Yahoo", "Akemi", "Akemi123", "https://www.yahoo.com", "Notes", date(2024, 12, 31), cipher_suite)

#get_all_sites(Akemi.id, Akemi.key)





# Fermeture de la connexion à la base de données
Db_con.commit()
cursor.close()
Db_con.close()
if not Db_con.is_connected():
    print('La connexion à la base de données a été fermée')
