// Simple i18n loader for SafePass
const LOCALES = {};
let CURRENT = 'fr';

const loadLocaleFile = async (lang) => {
    if (LOCALES[lang]) return LOCALES[lang];
    try {
        const res = await fetch(`/locales/${lang}.json`, {cache: 'no-store'});
        if (!res.ok) throw new Error('not found');
        const j = await res.json();
        LOCALES[lang] = j;
        return j;
    } catch (e) {
        return null;
    }
};

const getSettingsLang = async () => {
    try {
        const proto = window.location.protocol;
        const host = window.location.hostname;
        const isFrontendDev = (window.location.port === '3000');
        const backendBase = `${proto}//${host}:5000`;

        const safeParse = async (res) => {
            if (!res || !res.ok) return null;
            const ct = (res.headers.get('content-type')||'').toLowerCase();
            if (ct.indexOf('application/json') !== -1) return await res.json();
            try { const txt = await res.text(); return JSON.parse(txt); } catch(e){ return null; }
        };

        const pickLang = (payload) => {
            try {
                const base = (payload && payload.settings) ? payload.settings : payload;
                if (!base || typeof base !== 'object') return null;
                const general = (base.general && typeof base.general === 'object') ? base.general : null;
                const fromGeneral = general && typeof general.language === 'string' ? general.language : null;
                if (fromGeneral && fromGeneral.trim()) return fromGeneral.trim();
                const fromTop = typeof base.language === 'string' ? base.language : null;
                if (fromTop && fromTop.trim()) return fromTop.trim();
            } catch(e){}
            return null;
        };

        if (isFrontendDev) {
            try {
                const r = await fetch(backendBase + '/settings', {cache: 'no-store'});
                const p = await safeParse(r);
                const lang = pickLang(p);
                if (lang) return lang;
            } catch(e){}
        }
        try {
            const r = await fetch('/settings', {cache: 'no-store'});
            const p = await safeParse(r);
            const lang = pickLang(p);
            if (lang) return lang;
        } catch(e){}
        try {
            const r = await fetch(backendBase + '/settings', {cache: 'no-store'});
            const p = await safeParse(r);
            const lang = pickLang(p);
            if (lang) return lang;
        } catch(e){}
    } catch(e){}
    return null;
};

export async function initI18n(){
    // determine language from settings, navigator, or default
    let lang = await getSettingsLang();
    if (!lang) {
        lang = (navigator.language||'fr').split('-')[0] || 'fr';
    }
    if (!lang) lang = 'fr';
    CURRENT = lang;
    const loc = await loadLocaleFile(lang) || await loadLocaleFile('fr') || {};
    window.t = (key)=> {
        try { return (loc && loc[key]) ? loc[key] : key; } catch(e){ return key; }
    };
    window.setLocale = async (l) => { CURRENT = l; const newLoc = await loadLocaleFile(l) || {}; window.t = (k)=> newLoc[k]||k; translateDOM(); };
    window.getLocale = ()=>CURRENT;
    translateDOM();
    return CURRENT;
}

export function translateDOM(root=document){
    try{
        const els = (root||document).querySelectorAll('[data-i18n]');
        els.forEach(el=>{
            const key = el.getAttribute('data-i18n');
            if (!key) return;
            const target = el.getAttribute('data-i18n-target') || 'text';
            const val = (window.t && window.t(key)) || key;
            if (target === 'html') el.innerHTML = val;
            else if (target === 'placeholder') el.setAttribute('placeholder', val);
            else el.textContent = val;
        });
    }catch(e){ console.error('translateDOM error', e); }
}

// expose small API
window.i18n = { initI18n, translateDOM };

export { loadLocaleFile };
