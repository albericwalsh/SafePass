(function(){
    // Reusable settings save utility. Accepts partial updates object and returns a Promise resolving the server response JSON.
    // Post only the delta (`updates`) to `/settings`. Backend will merge into existing settings.
    window.SP_saveSettings = function(updates){
        try{
            return fetch('/settings', { method:'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(updates) }).then(r=>r.json());
        }catch(e){
            return Promise.resolve(null);
        }
    };

    // Save settings for a specific category and migrate top-level keys into the category object.
    window.SP_saveCategorySettings = async function(category, values){
        try{
            const r = await fetch('/settings', { cache: 'no-store' }).catch(()=>null);
            const j = r && r.ok ? await r.json().catch(()=>null) : null;
            const current = (j && j.settings) ? j.settings : (j || {});
            // ensure category object
            if (!current[category] || typeof current[category] !== 'object') current[category] = {};
            // Post only the category object as a delta; backend will merge into persisted settings.
            const payload = {};
            payload[category] = values || {};
            const post = await fetch('/settings', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(payload) });
            return post && post.ok ? await post.json().catch(()=>({})) : {};
        }catch(e){ console.error('SP_saveCategorySettings error', e); return null; }
    };
})();
