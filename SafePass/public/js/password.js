function getPasswordStrength(password) {
    // Read cached policy if available, else use sensible defaults
    const policy = (window.SP_password_policy_cache) ? window.SP_password_policy_cache : (window.SP_password_policy_cache = (function(){
        try{
            const s = (window.SP_settings && typeof window.SP_settings === 'object') ? window.SP_settings : null;
            // non-blocking: if SP_settings not present, fall back to defaults
            return {
                min_length: s && s.password_min_length || 12,
                require_uppercase: s && (typeof s.require_uppercase !== 'undefined') ? !!s.require_uppercase : true,
                require_lowercase: s && (typeof s.require_lowercase !== 'undefined') ? !!s.require_lowercase : true,
                require_numbers: s && (typeof s.require_numbers !== 'undefined') ? !!s.require_numbers : true,
                require_symbols: s && (typeof s.require_symbols !== 'undefined') ? !!s.require_symbols : false,
                blacklist: s && Array.isArray(s.password_blacklist) ? s.password_blacklist : []
            };
        }catch(e){ return { min_length:12, require_uppercase:true, require_lowercase:true, require_numbers:true, require_symbols:false, blacklist:[] }; }
    })());

    if (!password || String(password).length === 0) return 'transparent';
    const p = String(password);

    // quick blacklist check (case-insensitive exact or contained entries)
    for (const banned of (policy.blacklist||[])){
        try{
            if (!banned) continue;
            const b = String(banned).toLowerCase().trim();
            const v = p.toLowerCase();
            if (v === b || v.indexOf(b) !== -1) return 'red';
        }catch(e){}
    }

    // Do not force 'red' based on missing classes/length here —
    // color is determined from the normalized percentage and configured thresholds.

    // Map percentage to color bands (use thresholds from settings when available)
    const pct = getPasswordStrengthPercent(p);
    try{
        const s = (window.SP_settings && typeof window.SP_settings === 'object') ? window.SP_settings : {};
        const r = (typeof s.strength_threshold_red !== 'undefined') ? Number(s.strength_threshold_red) : 20;
        const o = (typeof s.strength_threshold_orange !== 'undefined') ? Number(s.strength_threshold_orange) : 45;
        const y = (typeof s.strength_threshold_yellow !== 'undefined') ? Number(s.strength_threshold_yellow) : 75;
        if (pct <= r) return 'red';
        if (pct <= o) return 'orange';
        if (pct <= y) return 'yellow';
        return 'green';
    }catch(e){ if (pct <= 20) return 'red'; if (pct <= 45) return 'orange'; if (pct <= 75) return 'yellow'; return 'green'; }
}

// Return a strength percentage (0-100) using the same scoring rules.
function getPasswordStrengthPercent(password) {
    const policy = (window.SP_password_policy_cache) ? window.SP_password_policy_cache : (window.SP_password_policy_cache = (function(){
        try{
            const s = (window.SP_settings && typeof window.SP_settings === 'object') ? window.SP_settings : null;
            return {
                min_length: s && s.password_min_length || 12,
                require_uppercase: s && (typeof s.require_uppercase !== 'undefined') ? !!s.require_uppercase : true,
                require_lowercase: s && (typeof s.require_lowercase !== 'undefined') ? !!s.require_lowercase : true,
                require_numbers: s && (typeof s.require_numbers !== 'undefined') ? !!s.require_numbers : true,
                require_symbols: s && (typeof s.require_symbols !== 'undefined') ? !!s.require_symbols : false,
                blacklist: s && Array.isArray(s.password_blacklist) ? s.password_blacklist : []
            };
        }catch(e){ return { min_length:12, require_uppercase:true, require_lowercase:true, require_numbers:true, require_symbols:false, blacklist:[] }; }
    })());

    if (!password || String(password).length === 0) return 0;
    const p = String(password);

    // Immediate fail for blacklist matches (exact or contained)
    for (const banned of (policy.blacklist||[])){
        try{ if (!banned) continue; const b = String(banned).toLowerCase().trim(); const v = p.toLowerCase(); if (v === b || v.indexOf(b) !== -1) return 0; }catch(e){}
    }

    const hasUpper = /[A-Z]/.test(p);
    const hasLower = /[a-z]/.test(p);
    const hasDigit = /\d/.test(p);
    const hasSymbol = /[\W_]/.test(p);

    // Length contribution (up to 40 points)
    const minL = policy.min_length || 12;
    const lengthPts = Math.max(0, Math.min(1, p.length / minL)) * 40;

    // Character class contribution (total up to 48 points distributed across allowed classes)
    const allowedClasses = [];
    if (policy.require_lowercase) allowedClasses.push({k:'lower', present: hasLower});
    if (policy.require_uppercase) allowedClasses.push({k:'upper', present: hasUpper});
    if (policy.require_numbers) allowedClasses.push({k:'digit', present: hasDigit});
    if (policy.require_symbols) allowedClasses.push({k:'symbol', present: hasSymbol});
    // If policy doesn't require any specific class, consider all four as allowed for scoring
    if (allowedClasses.length === 0) {
        allowedClasses.push({k:'lower', present: hasLower});
        allowedClasses.push({k:'upper', present: hasUpper});
        allowedClasses.push({k:'digit', present: hasDigit});
        allowedClasses.push({k:'symbol', present: hasSymbol});
    }
    const classesTotal = 48;
    const perClass = classesTotal / allowedClasses.length;
    let classPts = 0;
    for (const c of allowedClasses) if (c.present) classPts += perClass;

    // Uniqueness contribution (up to 12 points). High uniqueRatio (>0.6) yields full points.
    const uniqueRatio = p.length ? (new Set(p).size) / p.length : 0;
    const uniqPts = Math.max(0, Math.min(1, uniqueRatio / 0.6)) * 12;

    const total = lengthPts + classPts + uniqPts; // max ~= 100
    return Math.max(0, Math.min(100, Math.round(total)));
}

function generatePassword() {
    // Build policy from cached settings or defaults
    const policy = (window.SP_password_policy_cache) ? window.SP_password_policy_cache : (window.SP_password_policy_cache = (function(){
        try{ const s = (window.SP_settings && typeof window.SP_settings === 'object') ? window.SP_settings : null; return {
            min_length: s && s.password_min_length || 12,
            require_uppercase: s && (typeof s.require_uppercase !== 'undefined') ? !!s.require_uppercase : true,
            require_lowercase: s && (typeof s.require_lowercase !== 'undefined') ? !!s.require_lowercase : true,
            require_numbers: s && (typeof s.require_numbers !== 'undefined') ? !!s.require_numbers : true,
            require_symbols: s && (typeof s.require_symbols !== 'undefined') ? !!s.require_symbols : false,
            blacklist: s && Array.isArray(s.password_blacklist) ? s.password_blacklist : []
        }; }catch(e){ return { min_length:12, require_uppercase:true, require_lowercase:true, require_numbers:true, require_symbols:false, blacklist:[] }; }
    })());

    const lowers = 'abcdefghijklmnopqrstuvwxyz';
    const uppers = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const digits = '0123456789';
    const symbols = '!@#$%^&*()_+~`|}{[]:;?><,./-=';

    const minLen = Math.max(1, policy.min_length || 12);
    const targetLen = minLen;

    const rngChar = (set) => set.charAt(Math.floor(Math.random()*set.length));

    const maxAttempts = 12;
    for (let attempt=0; attempt<maxAttempts; attempt++){
        const parts = [];
        // ensure required classes (these also indicate which classes are allowed)
        if (policy.require_lowercase) parts.push(rngChar(lowers));
        if (policy.require_uppercase) parts.push(rngChar(uppers));
        if (policy.require_numbers) parts.push(rngChar(digits));
        if (policy.require_symbols) parts.push(rngChar(symbols));

        // build allowed pool from policy flags: only include classes explicitly requested
        let pool = '';
        if (policy.require_lowercase) pool += lowers;
        if (policy.require_uppercase) pool += uppers;
        if (policy.require_numbers) pool += digits;
        if (policy.require_symbols) pool += symbols;
        // fallback: if no class selected, allow lowercase+uppercase
        if (!pool) pool = lowers + uppers;

        while (parts.length < targetLen) parts.push(rngChar(pool));

        // shuffle
        for (let i = parts.length -1; i>0; i--){ const j = Math.floor(Math.random()*(i+1)); const tmp = parts[i]; parts[i]=parts[j]; parts[j]=tmp; }
        const pw = parts.join('');

        // blacklist check
        let bad = false;
        for (const b of (policy.blacklist||[])){
            try{ if (!b) continue; const bb = String(b).toLowerCase().trim(); const v = pw.toLowerCase(); if (v === bb || v.indexOf(bb)!==-1){ bad=true; break; } }catch(e){}
        }
        if (bad) continue;

        // compute score similar to getPasswordStrength scoring
        const hasUpper = /[A-Z]/.test(pw);
        const hasLower = /[a-z]/.test(pw);
        const hasDigit = /\d/.test(pw);
        const hasSymbol = /[\W_]/.test(pw);
        let score = 0;
        if (pw.length >= policy.min_length) score += 2;
        if (pw.length >= policy.min_length + 6) score += 1;
        if (pw.length >= policy.min_length + 12) score += 1;
        if (hasUpper) score += 1;
        if (hasLower) score += 1;
        if (hasDigit) score += 1;
        if (hasSymbol) score += 1;
        const uniqueRatio = (new Set(pw).size) / pw.length;
        if (uniqueRatio > 0.6) score += 1;
        const maxScore = 9;
        const strengthPercent = Math.min(100, Math.round((score / maxScore) * 100));

        return { password: pw, strengthPercent };
    }

    // fallback: generate a simple random password
    let fallback = '';
    const charset = lowers + uppers + digits + symbols;
    for (let i=0;i<Math.max(12, minLen);i++) fallback += charset.charAt(Math.floor(Math.random()*charset.length));
    return { password: fallback, strengthPercent: 20 };
}

// Try to populate `window.SP_settings` (and thus policy cache) once at load time.
(function initPolicyFromServer(){
    try{
        const isFrontendDev = (window.location.port === '3000');
        const backendBase = `${window.location.protocol}//${window.location.hostname}:5000`;
        const url = isFrontendDev ? (backendBase + '/settings') : '/settings';
        fetch(url, {cache:'no-store'}).then(r=>{ if (!r.ok) return null; return r.json(); }).then(j=>{
            if (!j) return;
            const s = j.settings || j || {};
            window.SP_settings = s;
            // refresh cached policy if present
            if (window.SP_password_policy_cache){
                window.SP_password_policy_cache = null;
                // next getPasswordStrength call will rebuild cache from window.SP_settings
            }
        }).catch(()=>{});
    }catch(e){}
})();