Charte de style — SafePass Extension

Palette de couleurs
- Accent principal: #21c997 → dégradé: linear-gradient(90deg,#21c997,#33d8b0)
- Fond sombre: rgba(8,12,20,0.96)
- Surface claire: rgba(255,255,255,0.03)
- Texte principal: #eaf3ff
- Texte secondaire: rgba(255,255,255,0.75)

Typographie
- Font principale: Inter, fallback: Segoe UI, Arial, sans-serif
- Tailles: title 14px, body 12–13px, small 11px

Espacements & rayons
- Rayons par défaut: boutons 10px, cartes 16px, modal 14px
- Gutter: 8px entre actions, 12–14px padding intérieur

Boutons
- `.btn.primary`: fond dégradé (voir Accent principal), couleur texte sombre (#022522), border:none
- `.btn`: fond transparent, bord 1px rgba(255,255,255,0.04), hover: légère élévation
- Transition: transform .12s ease, box-shadow .12s ease

Modals / listes
- Isoler via Shadow DOM pour éviter fuite CSS
- Modal: largeur 360px max-width 92vw, bord arrondi 14px, fond opaque
- Lignes de liste: fond semi-opaque, border-radius 10px, hover: translateY(-3px) + shadow

Accessibilité
- Contraste: vérifier contraste du texte sur les fonds sombres (WCAG AA recommandé)
- Focus visible: outline sur éléments interactifs (si besoin)

Assets
- Icônes: fournir `icon.png` (128) et `icon_ok.png` / `icon_failed.png` (512 idéalement)

Usage
- Centraliser variables de style (couleurs, rayons) dans `src/popup.css` et réutiliser
- Pour l'application principale, étendre cette charte dans `app/style/` ou `web/style/` avec les mêmes tokens

Notes
- Cette charte est minimale; on l'étendra pour composants, formulaires et états (disabled, loading, error) si nécessaire.
