CREATE DATABASE IF NOT EXISTS safepassdb;

use safepassdb;

DROP TABLE IF EXISTS Data;
DROP TABLE IF EXISTS User;


CREATE TABLE User
(
    Id INTEGER PRIMARY KEY AUTO_INCREMENT,
    User_name VARCHAR(255) NOT NULL,
    Address_mail VARCHAR(255) NOT NULL,
    Password VARBINARY(255) NOT NULL
);


CREATE TABLE Data
(
    Id INTEGER PRIMARY KEY AUTO_INCREMENT,
    Encrypted_Uid INTEGER,
    Title VARBINARY(255),
    Identifiant VARBINARY(255) NOT NULL,
    Password VARBINARY(255) NOT NULL,
    Url_site VARBINARY(2083) NOT NULL,
    Notes VARBINARY(1000),
    Expiration_suggestion DATE,
    CONSTRAINT fk_Uid_User FOREIGN KEY (Encrypted_Uid) REFERENCES User(Id) ON DELETE CASCADE
);


INSERT INTO User (User_name, Address_mail, Password) VALUES ('Test1', 'Test@Test.com', AES_ENCRYPT('Test', 'Test'));
INSERT INTO User (User_name, Address_mail, Password) VALUES ('Test2', 'Test@Test.com', AES_ENCRYPT('Test', 'Test'));

SET @key_str = 'Test';

SELECT Id INTO @user_id1 FROM User WHERE User_name = 'Test1';
SELECT Id INTO @user_id2 FROM User WHERE User_name = 'Test2';

INSERT INTO Data (Encrypted_Uid, Title, Identifiant, Password, Url_site, Notes, Expiration_suggestion)
VALUES (
    @user_id1,
    AES_ENCRYPT('Test', @key_str),
    AES_ENCRYPT('Test@Test.com', @key_str),
    AES_ENCRYPT('Test', @key_str),
    AES_ENCRYPT('https://Test.com', @key_str),
    AES_ENCRYPT('Test', @key_str),
    '2024-12-31'
);

INSERT INTO Data (Encrypted_Uid, Title, Identifiant, Password, Url_site, Notes, Expiration_suggestion)
VALUES (
    @user_id2,
    AES_ENCRYPT('Test', @key_str),
    AES_ENCRYPT('Test@Test.com', @key_str),
    AES_ENCRYPT('Test', @key_str),
    AES_ENCRYPT('https://Test.com', @key_str),
    AES_ENCRYPT('Test', @key_str),
    '2024-12-31'
);


UPDATE Data
SET
    Title = AES_DECRYPT(Title, @key_str),
    Identifiant = AES_DECRYPT(Identifiant, @key_str),
    Password = AES_DECRYPT(Password, @key_str),
    Url_site = AES_DECRYPT(Url_site, @key_str),
    Notes = AES_DECRYPT(Notes, @key_str),
    Expiration_suggestion = Expiration_suggestion
WHERE Encrypted_Uid = @user_id1;

