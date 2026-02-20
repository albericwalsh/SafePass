Guide d'intégration — aws-widgets
================================

Ce court guide explique comment intégrer la librairie Web Components `aws-widgets` dans un projet web (site statique ou projet dev avec Vite/Parcel/Webpack).

1) Installation rapide (CDN)

Inclure dans votre page principale (`index.html`) :

```html
<script type="module" src="https://cdn.jsdelivr.net/gh/albericwalsh/aws-widgets@main/dist/index.js"></script>
```

2) Option locale / développement

- Si le package est disponible via npm :

```bash
npm install aws-widgets
npm install
npm run dev
```

- Si vous travaillez depuis le repo source : copier le dossier `src` de `aws-widgets` dans votre projet (ex. `public/aws-widgets/`) et importer l'entrypoint (`index.js`) via un `script type="module"`.

3) Charger & découvrir les widgets

Après le chargement du module principal, la liste des widgets exposés est disponible sur `window.awsWidgets` :

```js
const widgets = window.awsWidgets; // tableau { id, parameters, ... }
```

Attendre que les Custom Elements soient définis avant d'interagir :

```js
await customElements.whenDefined('aws-button');
```

4) Exemples d'utilisation

a) HTML statique

```html
<aws-button variant="secondary" size="lg">Envoyer</aws-button>
<aws-bool mode="edit" value="false"></aws-bool>
<aws-context id="dialog"></aws-context>
```

b) Création dynamique & écoute d'événements

```js
await customElements.whenDefined('aws-button');
const btn = document.createElement('aws-button');
btn.setAttribute('variant', 'primary');
btn.textContent = 'Test';
btn.addEventListener('click', () => console.log('aws-button clicked'));
document.body.appendChild(btn);
```

c) Propriétés JS et événements (`aws-bool`)

```js
await customElements.whenDefined('aws-bool');
const t = document.createElement('aws-bool');
t.setAttribute('mode', 'edit');
t.value = true; // propriété JS
t.addEventListener('change', e => console.log('bool changed', e.detail?.value));
document.body.appendChild(t);
```

d) Méthodes publiques (`aws-context`)

```js
await customElements.whenDefined('aws-context');
const c = document.querySelector('aws-context#dialog');
if (c) c.open();
```

5) Thème et styles

- Le thème principal est chargé via `style.json` avec `loadTheme()` (souvent fourni dans `theme.js`). Modifier `style.json` puis recharger la page pour appliquer un thème personnalisé.
- Chaque composant peut injecter son CSS dans le Shadow DOM — inspectez le Shadow DOM pour vérifier le rendu.
- En build (Vite/ESBuild), assurez-vous que les assets (ex. `style.json` et dossiers de widgets) sont copiés dans `dist/` si nécessaires.

6) Notes pour bundlers / production

- Importer comme module ES fonctionne avec Vite/ESBuild. Vérifiez que les imports relatifs utilisant `new URL(..., import.meta.url)` restent valides après le build.
- Si vous publiez sur npm, exposez un build ES module (`index.js`) et documentez l'import dans votre README.

7) Vérifications rapides (checklist)

- window.awsWidgets est présent dans la console
- `customElements.get('aws-button')` ou `await customElements.whenDefined(...)` réussit
- Pas d'erreurs d'import dynamiques dans la console au chargement
<script type="module" src="https://cdn.jsdelivr.net/gh/albericwalsh/aws-widgets@v0.1.2/dist/index.js"></script>
- Events reçus (vérifier `detail`, `bubbles: true` et `composed: true` si besoin)


- Erreur d'import dynamique : vérifier chemins relatifs et présence des fichiers `.js` dans le bundle/dist
- Pas d'affichage/Styles : vérifier `style.json` présent et accessible
- Events non reçus : vérifier que l'élément dispatch l'event avec `bubbles` et `composed`

9) Mini-snippet de test (index.html minimal)

```html
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>aws-widgets demo</title>
    <script type="module" src="https://cdn.jsdelivr.net/gh/albericwalsh/aws-widgets@main/dist/index.js"></script>
<script type="module" src="https://cdn.jsdelivr.net/gh/albericwalsh/aws-widgets@v0.1.2/dist/index.js"></script>
      (async () => {
        await customElements.whenDefined('aws-button');
        console.log('aws-widgets ready', window.awsWidgets);
      })();
    </script>
  </head>
  <body>
    <h1>aws-widgets demo</h1>
    <aws-button variant="primary">Hello</aws-button>
    <aws-bool mode="edit" value="false"></aws-bool>
    <aws-context id="dialog"></aws-context>
  </body>
</html>
```

10) Commande dev (ex. Vite)

```bash
npm install
npm run dev
```

Licence & bonnes pratiques

- Respecter les attributs `disabled` et `mode` des widgets (ne pas forcer d'interaction si désactivé).
- Favoriser `aria-label` et attributs ARIA fournis pour l'accessibilité.
- Toujours attendre `customElements.whenDefined()` pour interactions programmatiques.

---

Fichier ajouté automatiquement par l'agent — dites-moi si vous voulez que je crée aussi un mini-demo HTML séparé `public/aws-widgets-demo.html` et le module JS d'accompagnement.
