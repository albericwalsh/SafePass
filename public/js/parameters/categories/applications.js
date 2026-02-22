(function(){
    function render(area){
        area.innerHTML = '';
        const h = document.createElement('h3'); h.setAttribute('data-i18n','applications'); h.textContent = window.t ? window.t('applications') : 'Applications';
        area.appendChild(h);
        const p = document.createElement('p'); p.textContent = (window.t && window.t('applications_placeholder')) || 'Contenu de la catégorie Applications (temporaire)'; area.appendChild(p);
    }
    window.SP_render_applications = render;
})();