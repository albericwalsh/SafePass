-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Hôte : 127.0.0.1
-- Généré le : jeu. 23 mai 2024 à 21:26
-- Version du serveur : 10.4.32-MariaDB
-- Version de PHP : 8.2.12

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Base de données : `infra`
--

-- --------------------------------------------------------

--
-- Structure de la table `data`
--

CREATE TABLE `data` (
  `Id` int(11) NOT NULL,
  `Encrypted_Uid` int(11) DEFAULT NULL,
  `Title` varbinary(255) DEFAULT NULL,
  `Identifiant` varbinary(255) NOT NULL,
  `Password` varbinary(255) NOT NULL,
  `Url_site` varbinary(2083) NOT NULL,
  `Notes` varbinary(1000) DEFAULT NULL,
  `Expiration_suggestion` date DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Déchargement des données de la table `data`
--

INSERT INTO `data` (`Id`, `Encrypted_Uid`, `Title`, `Identifiant`, `Password`, `Url_site`, `Notes`, `Expiration_suggestion`) VALUES
(1, 1, 0x54657374, 0x5465737440546573742e636f6d, 0x54657374, 0x68747470733a2f2f546573742e636f6d, 0x54657374, '2024-12-31'),
(2, 2, 0x406b95baa7219c54143292c6d982482a, 0x9586a595a51c7ad6068657e258e9ccd6, 0x406b95baa7219c54143292c6d982482a, 0xd71d030355e4cbacc51d8a4733883d2a9593ab35e367a2bcc4936bc94595f77c, 0x406b95baa7219c54143292c6d982482a, '2024-12-31');

-- --------------------------------------------------------

--
-- Structure de la table `user`
--

CREATE TABLE `user` (
  `Id` int(11) NOT NULL,
  `User_name` varchar(255) NOT NULL,
  `Address_mail` varchar(255) NOT NULL,
  `Password` varbinary(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Déchargement des données de la table `user`
--

INSERT INTO `user` (`Id`, `User_name`, `Address_mail`, `Password`) VALUES
(1, 'Test1', 'Test@Test.com', 0x406b95baa7219c54143292c6d982482a),
(2, 'Test2', 'Test@Test.com', 0x406b95baa7219c54143292c6d982482a);

--
-- Index pour les tables déchargées
--

--
-- Index pour la table `data`
--
ALTER TABLE `data`
  ADD PRIMARY KEY (`Id`),
  ADD KEY `fk_Uid_User` (`Encrypted_Uid`);

--
-- Index pour la table `user`
--
ALTER TABLE `user`
  ADD PRIMARY KEY (`Id`);

--
-- AUTO_INCREMENT pour les tables déchargées
--

--
-- AUTO_INCREMENT pour la table `data`
--
ALTER TABLE `data`
  MODIFY `Id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT pour la table `user`
--
ALTER TABLE `user`
  MODIFY `Id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- Contraintes pour les tables déchargées
--

--
-- Contraintes pour la table `data`
--
ALTER TABLE `data`
  ADD CONSTRAINT `fk_Uid_User` FOREIGN KEY (`Encrypted_Uid`) REFERENCES `user` (`Id`) ON DELETE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
