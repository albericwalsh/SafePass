(function(){
    // Auto-lock logic: fetch settings and lock the UI after inactivity
    let timeoutId = null;
    let locked = false;
    let autoLockMs = 5 * 60 * 1000; // default 5 minutes
    let masterEnabled = true;

    const resetTimer = () => {
        if (locked) return;
        if (timeoutId) clearTimeout(timeoutId);
        timeoutId = setTimeout(doLock, autoLockMs);
    };

    const doLock = () => {
        locked = true;
        // create overlay
        const overlay = document.createElement('div');
        overlay.id = 'sp-auto-lock-overlay';
        overlay.style.position = 'fixed';
        overlay.style.top = '0';
        overlay.style.left = '0';
        overlay.style.width = '100%';
        overlay.style.height = '100%';
        overlay.style.zIndex = '99999';
        overlay.style.display = 'flex';
        overlay.style.alignItems = 'center';
        overlay.style.justifyContent = 'center';
        overlay.style.background = 'var(--sp-bg-dark, rgba(0,0,0,0.85))';
        overlay.style.color = 'var(--sp-light, #fff)';

        const box = document.createElement('div');
        box.style.background = 'var(--sp-panel-bg, #0b1220)';
        box.style.padding = '24px';
        box.style.borderRadius = '12px';
        box.style.minWidth = '320px';
        box.style.maxWidth = '90%';
        box.style.boxShadow = '0 10px 30px rgba(0,0,0,0.6)';

        const title = document.createElement('div');
        title.textContent = (window.t && window.t('locked_title')) || 'Application verrouillée';
        title.style.fontSize = '18px';
        title.style.marginBottom = '12px';
        box.appendChild(title);

        if (masterEnabled) {
            const form = document.createElement('div');
            form.style.display = 'flex';
            form.style.flexDirection = 'column';

            const input = document.createElement('aws-input');
            input.setAttribute('type', 'password');
            input.setAttribute('placeholder', (window.t && window.t('master_password_placeholder')) || 'Mot de passe maître');
            input.style.marginBottom = '8px';
            form.appendChild(input);

            const error = document.createElement('div');
            error.style.color = '#ff6b6b';
            error.style.minHeight = '18px';
            error.style.marginBottom = '8px';
            form.appendChild(error);

            const btn = document.createElement('aws-button');
            btn.setAttribute('variant', 'primary');
            btn.textContent = (window.t && window.t('unlock')) || 'Déverrouiller';
            btn.addEventListener('click', async ()=>{
                error.textContent = '';
                const val = input.value || input.getAttribute('value') || '';
                try{
                    const proto = window.location.protocol; const host = window.location.hostname; const isFrontendDev = (window.location.port === '3000'); const backendBase = `${proto}//${host}:5000`;
                    const adminUrl = (path)=> isFrontendDev ? (backendBase + path) : path;
                    const r = await fetch(adminUrl('/auth/unlock'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: val }) });
                    if (r.ok){
                        const j = await r.json();
                        if (j && j.status === 'ok'){
                               if (j.token) try{ const session = { token: j.token, expires_at: j.expires_at || null }; localStorage.setItem('sp_auth_session', JSON.stringify(session)); }catch(e){}
                            unlock();
                            return;
                        }
                    }
                    error.textContent = (window.t && window.t('invalid_password')) || 'Mot de passe invalide';
                }catch(e){ error.textContent = (window.t && window.t('network_error')) || 'Erreur de communication'; }
            });
            form.appendChild(btn);
            box.appendChild(form);
        } else {
            // use global styled panel for the no-password unlock state
            const panel = document.createElement('div');
            panel.className = 'upper-center-window';

            const t1 = document.createElement('div');
            t1.style.fontWeight = '700';
            t1.style.marginBottom = '8px';
            t1.style.fontSize = '16px';
            t1.textContent = (window.t && window.t('auth_required_title')) || 'Authentification requise';
            panel.appendChild(t1);

            const msg = document.createElement('div');
            msg.style.marginBottom = '8px';
            msg.style.color = 'var(--sp-light)';
            msg.style.fontSize = '13px';
            msg.textContent = (window.t && window.t('auto_lock_info')) || 'Verrouillage automatique activé. Rechargez la page pour récupérer l\'accès.';
            panel.appendChild(msg);

            const actions = document.createElement('div');
            actions.style.display = 'flex';
            actions.style.justifyContent = 'flex-end';
            actions.style.marginTop = '12px';
            actions.style.gap = '8px';

            const reloadBtn = document.createElement('aws-button');
            reloadBtn.setAttribute('variant','primary');
            reloadBtn.textContent = (window.t && window.t('reload')) || 'Recharger';
            reloadBtn.addEventListener('click', ()=>{ try{ location.reload(); }catch(e){ window.location.reload(); } });
            actions.appendChild(reloadBtn);

            panel.appendChild(actions);
            box.appendChild(panel);
        }

        overlay.appendChild(box);
        document.body.appendChild(overlay);
        // disable pointer events on main app
        document.documentElement.style.pointerEvents = 'none';
        overlay.style.pointerEvents = 'auto';
    };

    const unlock = ()=>{
        const o = document.getElementById('sp-auto-lock-overlay');
        if (o) o.remove();
        document.documentElement.style.pointerEvents = '';
        locked = false;
        resetTimer();
    };

    const attachActivityListeners = ()=>{
        ['mousemove','mousedown','keydown','scroll','touchstart','click','focus'].forEach(ev=>{
            window.addEventListener(ev, resetTimer, {passive:true});
        });
    };

    const init = async ()=>{
        try{
            const proto = window.location.protocol; const host = window.location.hostname; const isFrontendDev = (window.location.port === '3000'); const backendBase = `${proto}//${host}:5000`;
            const adminUrl = (path)=> isFrontendDev ? (backendBase + path) : path;
            const r = await fetch(adminUrl('/settings'),{cache:'no-store'});
            if (r && r.ok){
                const j = await r.json();
                const s = (j && j.settings) ? j.settings : j;
                if (s){
                    const minutes = parseInt(s.auto_lock_minutes || s.autoLockMinutes || 5,10) || 5;
                    autoLockMs = Math.max(0, minutes) * 60 * 1000;
                    masterEnabled = !!s.master_password_enabled;
                }
            }
        }catch(e){}
        // if autoLockMs <= 0, disable
        if (autoLockMs > 0){
            attachActivityListeners();
            resetTimer();
        }
    };

    // initialize after DOM ready
    if (document.readyState === 'complete' || document.readyState === 'interactive') init(); else document.addEventListener('DOMContentLoaded', init);
})();
