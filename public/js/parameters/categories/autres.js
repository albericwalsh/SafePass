(function(){
    function render(area){
        area.innerHTML = '';
        const h = document.createElement('h3'); h.setAttribute('data-i18n','autres'); h.textContent = window.t ? window.t('autres') : 'Autres';
        area.appendChild(h);
        const p = document.createElement('p'); p.textContent = (window.t && window.t('autres_placeholder')) || 'Contenu de la catégorie Autres (temporaire)'; area.appendChild(p);
    }
    window.SP_render_autres = render;
})();