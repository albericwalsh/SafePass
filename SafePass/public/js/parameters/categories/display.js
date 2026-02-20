(function(){
    async function render(area){
        area.innerHTML = '';
        const title = document.createElement('h3'); title.setAttribute('data-i18n','display'); title.textContent = window.t ? window.t('display') : 'Affichage';
        area.appendChild(title);

        const wrap = document.createElement('div'); wrap.className = 'params-display params-form';

        // Theme selector only
        const themeRow = document.createElement('div'); themeRow.className = 'param-row';
        const themeLabel = document.createElement('div'); themeLabel.className = 'param-name'; themeLabel.textContent = (window.t && window.t('theme')) || 'Thème';
        const themeSelWrap = document.createElement('div'); themeSelWrap.className = 'param-value';
        // create aws-selector and aws-options directly (consistent with other param UIs)
        const themeSel = document.createElement('aws-selector'); themeSel.id = 'display_theme'; themeSel.setAttribute('mode','edit');
        const optSystem = document.createElement('aws-option'); optSystem.setAttribute('data-id','system'); optSystem.textContent = (window.t && window.t('theme_system')) || 'Système';
        const optLight = document.createElement('aws-option'); optLight.setAttribute('data-id','light'); optLight.textContent = (window.t && window.t('theme_light')) || 'Clair';
        const optDark = document.createElement('aws-option'); optDark.setAttribute('data-id','dark'); optDark.textContent = (window.t && window.t('theme_dark')) || 'Sombre';
        themeSel.appendChild(optSystem); themeSel.appendChild(optLight); themeSel.appendChild(optDark);
        themeSelWrap.appendChild(themeSel);
        themeRow.appendChild(themeLabel); themeRow.appendChild(themeSelWrap);
        wrap.appendChild(themeRow);

        // Buttons
        const buttons = document.createElement('div'); buttons.className = 'param-actions'; buttons.style.marginTop = '12px';
        const saveBtn = document.createElement('aws-button'); saveBtn.id = 'display-save'; saveBtn.setAttribute('variant','primary'); saveBtn.setAttribute('size','md'); saveBtn.setAttribute('data-i18n','save'); saveBtn.textContent = (window.t && window.t('save')) || 'Enregistrer';
        const resetBtn = document.createElement('aws-button'); resetBtn.id = 'display-reset'; resetBtn.setAttribute('variant','secondary'); resetBtn.setAttribute('size','md'); resetBtn.style.marginLeft = '8px'; resetBtn.setAttribute('data-i18n','reset'); resetBtn.textContent = (window.t && window.t('reset')) || 'Réinitialiser';
        buttons.appendChild(saveBtn); buttons.appendChild(resetBtn);
        // status span (consistent with other parameter UIs)
        const status = document.createElement('span'); status.id = 'display-status'; status.style.marginLeft = '12px'; status.style.color = 'var(--sp-panel-text)';
        const actions = document.createElement('div'); actions.className = 'form-actions'; actions.appendChild(buttons); actions.appendChild(status);
        wrap.appendChild(actions);

        area.appendChild(wrap);

        // Load current settings and populate
        try{
            const raw = await window.SP_params.loadSettings();
            const settings = (raw && raw.settings) ? raw.settings : (raw || {});
            const d = settings.display || {};
            const initialTheme = d.theme || settings.theme || 'system';
            try{ window.SP_params.initAwsWidgets(area); }catch(e){}
            window.SP_params.setVal('display_theme', initialTheme);
        }catch(e){ console.warn('Failed to load settings for display', e); }

        saveBtn.addEventListener('click', function(){
            status.textContent = (window.t && window.t('saving')) || 'Saving...';
            const updates = { display: { theme: window.SP_params.getVal('display_theme') } };
            const doSave = (window.SP_saveSettings && typeof window.SP_saveSettings === 'function') ? window.SP_saveSettings : (window.SP_params && window.SP_params.saveSettings) ? window.SP_params.saveSettings : null;
            if (doSave){ (async function(){
                try{
                    const resp = await doSave(updates);
                    const ok = resp && (resp.status === 'ok' || resp.success === true || resp === true);
                    if (ok){
                        status.textContent = (window.t && window.t('saved')) || 'Saved';
                        setTimeout(()=>{ status.textContent = ''; }, 900);
                        try{ if (window.applyAppTheme && typeof window.applyAppTheme === 'function') window.applyAppTheme(); }catch(e){}
                        return;
                    }
                    status.textContent = (window.t && window.t('error')) || 'Error';
                    setTimeout(()=>{ status.textContent = ''; }, 1600);
                }catch(e){ console.error('save display settings', e); status.textContent = (window.t && window.t('error')) || 'Error'; setTimeout(()=>{ status.textContent = ''; }, 1600); }
            })(); } else { status.textContent = (window.t && window.t('error')) || 'Error'; setTimeout(()=>{ status.textContent = ''; }, 1600); }
        });

        resetBtn.addEventListener('click', function(){
            status.textContent = '';
            window.SP_params.loadSettings().then(raw => {
                const s = (raw && raw.settings) ? raw.settings : (raw || {});
                const d = s.display || {};
                window.SP_params.setVal('display_theme', d.theme || s.theme || 'system');
            }).catch(()=>{});
        });
    }

    window.SP_render_display = render;
})();