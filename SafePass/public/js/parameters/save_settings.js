(function(){
    // Reusable settings save utility. Accepts partial updates object and returns a Promise resolving the server response JSON.
    window.SP_saveSettings = function(updates){
        return fetch('/settings').then(r=>r.json()).then(j=>{
            const current = (j && j.settings) ? j.settings : (j || {});
            Object.assign(current, updates || {});
            return fetch('/settings', { method:'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(current) });
        }).then(r=>r.json());
    };

    // Save settings for a specific category and migrate top-level keys into the category object.
    window.SP_saveCategorySettings = async function(category, values){
        try{
            const r = await fetch('/settings', { cache: 'no-store' }).catch(()=>null);
            const j = r && r.ok ? await r.json().catch(()=>null) : null;
            const current = (j && j.settings) ? j.settings : (j || {});
            // ensure category object
            if (!current[category] || typeof current[category] !== 'object') current[category] = {};
            // copy values into category
            Object.keys(values || {}).forEach(k => { current[category][k] = values[k];
                // remove top-level duplicate to enforce category-based structure
                try{ if (k in current) delete current[k]; }catch(e){}
            });
            // Persist full settings object
            const post = await fetch('/settings', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(current) });
            return post && post.ok ? await post.json().catch(()=>({})) : {};
        }catch(e){ console.error('SP_saveCategorySettings error', e); return null; }
    };
})();
