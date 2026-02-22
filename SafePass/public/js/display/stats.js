window.SP_renderStatsView = function renderStatsView() {
    const statsView = document.getElementById('stats-view');
    if (!statsView) return;

    let total = 0;
    const strengths = [];
    const anssiRates = [];
    const expiringSoonEntries = [];
    const credentialEntries = [];
    const rssContextEntries = [];

    function settingsLookLoaded() {
        try {
            const s = (window.SP_settings && typeof window.SP_settings === 'object') ? window.SP_settings : null;
            if (!s) return false;
            if (Object.keys(s).length === 0) return false;
            return true;
        } catch (e) {
            return false;
        }
    }

    function loadSettingsForStats() {
        try {
            if (window.SP_params && typeof window.SP_params.loadSettings === 'function') {
                return Promise.resolve(window.SP_params.loadSettings())
                    .then(raw => {
                        const s = (raw && raw.settings) ? raw.settings : (raw || {});
                        if (s && typeof s === 'object') window.SP_settings = s;
                        return s;
                    });
            }
        } catch (e) {}

        try {
            const isFrontendDev = (window.location.port === '3000');
            const backendBase = `${window.location.protocol}//${window.location.hostname}:5000`;
            const url = isFrontendDev ? (backendBase + '/settings') : '/settings';
            return fetch(url, { cache: 'no-store' })
                .then(r => r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status)))
                .then(raw => {
                    const s = (raw && raw.settings) ? raw.settings : (raw || {});
                    if (s && typeof s === 'object') window.SP_settings = s;
                    return s;
                });
        } catch (e) {
            return Promise.reject(e);
        }
    }

    function requestStatsRefreshWhenSettingsReady() {
        try {
            if (settingsLookLoaded()) return;
            if (window.SP_stats_settings_refresh_pending) return;
            window.SP_stats_settings_refresh_pending = true;

            loadSettingsForStats()
                .then(() => {
                    try {
                        if (typeof currentCategory !== 'undefined' && currentCategory === 'stats' && typeof displayCategory === 'function') {
                            displayCategory('stats');
                        }
                    } catch (e) {}
                })
                .catch(() => {})
                .finally(() => {
                    window.SP_stats_settings_refresh_pending = false;
                });
        } catch (e) {}
    }

    requestStatsRefreshWhenSettingsReady();

    function getBlacklistTerms() {
        try {
            const out = [];
            const pushMany = (arr) => {
                if (!Array.isArray(arr)) return;
                for (const v of arr) {
                    const s = String(v || '').trim().toLowerCase();
                    if (s) out.push(s);
                }
            };

            const settings = (window.SP_settings && typeof window.SP_settings === 'object') ? window.SP_settings : {};
            const security = (settings.security && typeof settings.security === 'object') ? settings.security : {};

            pushMany(security.password_blacklist);

            try {
                if (window.SP_params && typeof window.SP_params.getVal === 'function') {
                    const rawParam = window.SP_params.getVal('security-password_blacklist');
                    if (Array.isArray(rawParam)) {
                        pushMany(rawParam);
                    } else if (typeof rawParam === 'string' && rawParam.trim()) {
                        const txt = rawParam.trim();
                        if (txt.startsWith('[') && txt.endsWith(']')) {
                            try { pushMany(JSON.parse(txt)); } catch (e) {}
                        } else {
                            pushMany(txt.split(/[\n,;]+/g));
                        }
                    }
                }
            } catch (e) {}

            const dedup = [];
            const seen = new Set();
            for (const term of out) {
                if (seen.has(term)) continue;
                seen.add(term);
                dedup.push(term);
            }
            return dedup;
        } catch (e) {
            return [];
        }
    }

    function isPasswordBlacklisted(password, blacklistTerms) {
        const p = String(password || '').toLowerCase();
        if (!p) return false;
        const list = Array.isArray(blacklistTerms) ? blacklistTerms : [];
        for (const banned of list) {
            const b = String(banned || '').trim().toLowerCase();
            if (!b) continue;
            if (p === b || p.indexOf(b) !== -1) return true;
        }
        return false;
    }

    function calcAnssiRate(password) {
        if (!password || typeof password !== 'string') return 0;
        const p = password;
        const len = p.length;
        const hasUpper = /[A-Z]/.test(p);
        const hasLower = /[a-z]/.test(p);
        const hasDigit = /\d/.test(p);
        const hasSymbol = /[\W_]/.test(p);

        const uniqueRatio = len > 0 ? (new Set(p).size / len) : 0;
        const hasTripleRepeat = /(.)\1\1/.test(p);
        const hasSimpleSequence = /0123|1234|2345|3456|4567|5678|6789|abcd|bcde|cdef|qwer|azerty|password|motdepasse/i.test(p);

        let score = 0;

        if (len >= 16) score += 35;
        else if (len >= 12) score += 28;
        else if (len >= 10) score += 18;
        else if (len >= 8) score += 8;

        let classes = 0;
        if (hasLower) classes += 1;
        if (hasUpper) classes += 1;
        if (hasDigit) classes += 1;
        if (hasSymbol) classes += 1;
        score += Math.round((classes / 4) * 30);

        score += Math.round(Math.max(0, Math.min(1, uniqueRatio / 0.65)) * 20);

        if (hasTripleRepeat) score -= 8;
        if (hasSimpleSequence) score -= 12;

        try {
            if (isPasswordBlacklisted(p, blacklistTerms)) {
                score = Math.min(score, 15);
            }
        } catch (e) {}

        return Math.max(0, Math.min(100, score));
    }

    function getSecuritySetting(candidates, defaultValue) {
        try {
            const list = Array.isArray(candidates) ? candidates : [candidates];
            const settings = (window.SP_settings && typeof window.SP_settings === 'object') ? window.SP_settings : {};
            const security = (settings.security && typeof settings.security === 'object') ? settings.security : {};
            for (const key of list) {
                if (!key) continue;
                if (typeof settings[key] !== 'undefined') return settings[key];
                if (typeof security[key] !== 'undefined') return security[key];
                try {
                    if (window.SP_params && typeof window.SP_params.getVal === 'function') {
                        const v = window.SP_params.getVal('security-' + key);
                        if (typeof v !== 'undefined' && v !== null && v !== '') return v;
                    }
                } catch (e) {}
            }
        } catch (e) {}
        return defaultValue;
    }

    function parseAnyDate(v) {
        if (!v) return null;
        try {
            if (v instanceof Date && !Number.isNaN(v.getTime())) return v;
            const d = new Date(v);
            if (!Number.isNaN(d.getTime())) return d;
        } catch (e) {}
        return null;
    }

    const expiryDaysRaw = getSecuritySetting(['password_expiration_days', 'password_expiry_days', 'password_rotation_days', 'password_max_age_days'], 90);
    const soonDaysRaw = getSecuritySetting(['password_expiration_soon_days', 'password_expiry_soon_days', 'password_rotation_soon_days'], 30);
    const expiryDays = Math.max(1, Number.parseInt(expiryDaysRaw, 10) || 90);
    const soonDays = Math.max(1, Number.parseInt(soonDaysRaw, 10) || 30);
    const blacklistTerms = getBlacklistTerms();

    function resolveEntryExpiryDate(entry) {
        if (!entry || typeof entry !== 'object') return null;
        const explicitExpiryKeys = [
            'password_expires_at', 'password_expiry_date', 'password_expiration_date',
            'expires_at', 'expiry_date', 'expiration_date'
        ];
        for (const key of explicitExpiryKeys) {
            const d = parseAnyDate(entry[key]);
            if (d) return d;
        }

        const baseDateKeys = ['password_updated_at', 'updated_at', 'modified_at', 'timestamp', 'created_at'];
        for (const key of baseDateKeys) {
            const base = parseAnyDate(entry[key]);
            if (!base) continue;
            const d = new Date(base.getTime() + (expiryDays * 24 * 60 * 60 * 1000));
            if (!Number.isNaN(d.getTime())) return d;
        }
        return null;
    }

    try {
        if (Array.isArray(allData)) {
            allData.forEach(item => {
                if (!item || typeof item !== 'object') return;

                ['sites', 'applications', 'autres'].forEach(category => {
                    if (!Array.isArray(item[category])) return;
                    total += item[category].length;
                    item[category].forEach(entry => {
                        try {
                            if ((category === 'sites' || category === 'applications') && entry && typeof entry === 'object') {
                                rssContextEntries.push({ category, entry });
                            }
                        } catch (e) {}

                        const pwd = entry && typeof entry.password === 'string' ? entry.password : null;
                        if (!pwd) return;
                        try {
                            const username = (entry && typeof entry.username === 'string') ? entry.username.trim() : '';
                            if (username) {
                                credentialEntries.push({ username, password: pwd, category, entry });
                            }
                        } catch (e) {}
                        try {
                            if (typeof getPasswordStrengthPercent === 'function') {
                                const raw = Number(getPasswordStrengthPercent(pwd));
                                const v = isPasswordBlacklisted(pwd, blacklistTerms) ? Math.min(raw, 15) : raw;
                                if (!Number.isNaN(v)) strengths.push(v);
                            }
                        } catch (e) {}
                        try {
                            anssiRates.push(calcAnssiRate(pwd));
                        } catch (e) {}
                        try {
                            const expiryDate = resolveEntryExpiryDate(entry);
                            if (!expiryDate) return;
                            const daysLeft = Math.ceil((expiryDate.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
                            if (daysLeft >= 0 && daysLeft <= soonDays) {
                                expiringSoonEntries.push({
                                    category,
                                    entry,
                                    daysLeft
                                });
                            }
                        } catch (e) {}
                    });
                });
            });
        }
    } catch (e) {
        console.debug('stats rendering failed', e);
    }

    const minStrength = strengths.length ? Math.min(...strengths) : 0;
    const maxStrength = strengths.length ? Math.max(...strengths) : 0;
    const avgStrength = strengths.length ? Math.round(strengths.reduce((a, b) => a + b, 0) / strengths.length) : 0;
    const avgAnssiRate = anssiRates.length ? Math.round(anssiRates.reduce((a, b) => a + b, 0) / anssiRates.length) : 0;

    function getStrengthToneClass(v) {
        const n = Number(v);
        if (Number.isNaN(n)) return 'sp-strength-warn';
        if (n < 40) return 'sp-strength-danger';
        if (n < 70) return 'sp-strength-warn';
        return 'sp-strength-good';
    }

    const avgTone = getStrengthToneClass(avgStrength);
    const minTone = getStrengthToneClass(minStrength);
    const maxTone = getStrengthToneClass(maxStrength);
    const anssiTone = getStrengthToneClass(avgAnssiRate);
    const expiringTone = expiringSoonEntries.length > 0 ? 'sp-strength-warn' : 'sp-strength-good';

    function escHtml(v) {
        return String(v)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function tr(key, fallback) {
        try {
            if (window.t && typeof window.t === 'function') {
                const value = window.t(key);
                if (value && value !== key) return value;
            }
        } catch (e) {}
        return fallback;
    }

    function setPwnedStatsCard(value, toneClass, titleText) {
        try {

    function normalizeLeakKeyword(v) {
        try {
            return String(v || '').toLowerCase().trim().replace(/[^a-z0-9._-]/g, '');
        } catch (e) {
            return '';
        }
    }

    function collectLeakKeywordsFromEntry(entry, category) {
        const out = [];
        try {
            const cat = String(category || '').toLowerCase();

            if (cat === 'applications') {
                const rawName = String((entry && entry.name) || '').trim();
                const name = normalizeLeakKeyword(rawName);
                if (name && name.length >= 3) out.push(name);
                if (rawName) {
                    const parts = rawName.toLowerCase().match(/[a-z0-9]+/g) || [];
                    for (const part of parts) {
                        const token = normalizeLeakKeyword(part);
                        if (token && token.length >= 3) out.push(token);
                    }
                }
            }

            const rawUrl = String((entry && entry.url) || '').trim();
            if (cat === 'sites' && rawUrl) {
                try {
                    const withProto = rawUrl.includes('://') ? rawUrl : ('https://' + rawUrl);
                    const u = new URL(withProto);
                    const host = normalizeLeakKeyword(u.hostname || '');
                    if (host && host.length >= 3) {
                        out.push(host);
                        const parts = host.split('.').filter(Boolean);
                        if (parts.length >= 2) {
                            const rootDomain = parts.slice(-2).join('.');
                            const rootName = parts[parts.length - 2];
                            if (rootDomain.length >= 3) out.push(rootDomain);
                            if (rootName.length >= 3) out.push(rootName);
                        }
                    }
                } catch (e) {}
            }
        } catch (e) {}

        const dedup = [];
        const seen = new Set();
        for (const kw of out) {
            if (!kw || seen.has(kw)) continue;
            seen.add(kw);
            dedup.push(kw);
        }
        return dedup;
    }
            const valueEl = document.getElementById('sp-pwned-value');
            const cardEl = document.getElementById('sp-pwned-card');
            if (!valueEl || !cardEl) return;
            valueEl.textContent = String(value);
            valueEl.className = `sp-stats-value ${toneClass || ''}`.trim();
            if (titleText) cardEl.setAttribute('title', titleText);
        } catch (e) {}
    }

    async function sha1Hex(text) {
        const input = String(text || '');
        if (!window.crypto || !window.crypto.subtle || typeof TextEncoder === 'undefined') {
            throw new Error('WebCrypto indisponible');
        }
        const data = new TextEncoder().encode(input);
        const digest = await window.crypto.subtle.digest('SHA-1', data);
        const bytes = new Uint8Array(digest);
        return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
    }

    async function isPasswordPwned(password) {
        try {
            if (!password) return false;
            const cache = (window.SP_hibp_cache && typeof window.SP_hibp_cache === 'object') ? window.SP_hibp_cache : (window.SP_hibp_cache = {});
            const fullHash = await sha1Hex(password);
            if (Object.prototype.hasOwnProperty.call(cache, fullHash)) return !!cache[fullHash];

            const prefix = fullHash.slice(0, 5);
            const suffix = fullHash.slice(5);

            const rangeCache = (window.SP_hibp_range_cache && typeof window.SP_hibp_range_cache === 'object') ? window.SP_hibp_range_cache : (window.SP_hibp_range_cache = {});
            let body = rangeCache[prefix];
            if (typeof body !== 'string') {
                const resp = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
                    method: 'GET',
                    headers: { 'Add-Padding': 'true' },
                    cache: 'no-store'
                });
                if (!resp.ok) throw new Error('HIBP HTTP ' + resp.status);
                body = await resp.text();
                rangeCache[prefix] = body;
            }

            const lines = String(body || '').split('\n');
            let found = false;
            for (const raw of lines) {
                const line = String(raw || '').trim();
                if (!line) continue;
                const idx = line.indexOf(':');
                if (idx <= 0) continue;
                const listedSuffix = line.slice(0, idx).trim().toUpperCase();
                if (listedSuffix === suffix) {
                    found = true;
                    break;
                }
            }
            cache[fullHash] = found;
            return found;
        } catch (e) {
            throw e;
        }
    }

    function hydratePwnedCredentialStats() {
        async function persistCompromisedPasswordsToBlacklist(passwords) {
            try {
                const cleanPasswords = (Array.isArray(passwords) ? passwords : [])
                    .map(v => (v === null || typeof v === 'undefined') ? '' : String(v).trim())
                    .filter(v => !!v);
                if (!cleanPasswords.length) return;

                const settingsRoot = (window.SP_settings && typeof window.SP_settings === 'object') ? window.SP_settings : {};
                const securitySettings = (settingsRoot.security && typeof settingsRoot.security === 'object') ? settingsRoot.security : {};

                const currentListRaw = Array.isArray(securitySettings.password_blacklist)
                    ? securitySettings.password_blacklist
                    : [];

                const currentList = currentListRaw
                    .map(v => (v === null || typeof v === 'undefined') ? '' : String(v).trim())
                    .filter(v => !!v);

                const seen = new Set(currentList.map(v => v.toLowerCase()));
                const toAdd = [];
                for (const pw of cleanPasswords) {
                    const key = pw.toLowerCase();
                    if (seen.has(key)) continue;
                    seen.add(key);
                    toAdd.push(pw);
                }
                if (!toAdd.length) return;

                const mergedBlacklist = currentList.concat(toAdd);

                const isFrontendDev = (window.location.port === '3000');
                const backendBase = `${window.location.protocol}//${window.location.hostname}:5000`;
                const settingsUrl = isFrontendDev ? (backendBase + '/settings') : '/settings';

                const payload = {
                    security: { password_blacklist: mergedBlacklist }
                };

                const resp = await fetch(settingsUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                if (!resp.ok) throw new Error('HTTP ' + resp.status);

                try {
                    if (!window.SP_settings || typeof window.SP_settings !== 'object') window.SP_settings = {};
                    if (!window.SP_settings.security || typeof window.SP_settings.security !== 'object') window.SP_settings.security = {};
                    window.SP_settings.security.password_blacklist = mergedBlacklist.slice();
                    window.SP_password_policy_cache = null;
                } catch (e) {}
            } catch (e) {
                console.debug('Impossible de mettre à jour la blacklist automatiquement', e);
            }
        }

        const uniqueEntries = [];
        const seen = new Set();
        for (const item of credentialEntries) {
            if (!item || !item.username || !item.password) continue;
            const key = `${item.username}\u0000${item.password}`;
            if (seen.has(key)) continue;
            seen.add(key);
            uniqueEntries.push(item);
        }

        if (!uniqueEntries.length) {
            try { window.SP_pwned_entries_cache = []; } catch (e) {}
            setPwnedStatsCard(0, 'sp-strength-good', tr('pwned_none_to_check', 'Aucune paire identifiant/mot de passe à vérifier'));
            return;
        }

        setPwnedStatsCard('…', 'sp-strength-warn', tr('pwned_checking', 'Vérification HIBP en cours'));

        let compromised = 0;
        let checked = 0;
        const compromisedEntries = [];
        const tasks = uniqueEntries.map(item => isPasswordPwned(item.password)
            .then(found => {
                checked += 1;
                if (found) {
                    compromised += 1;
                    compromisedEntries.push(item);
                }
            })
            .catch(() => {}));

        Promise.all(tasks)
            .then(() => {
                if (checked === 0) {
                    try { window.SP_pwned_entries_cache = []; } catch (e) {}
                    setPwnedStatsCard(tr('not_available_short', 'N/A'), 'sp-strength-warn', tr('pwned_unavailable', 'Impossible de vérifier Have I Been Pwned pour le moment'));
                    return;
                }
                try {
                    window.SP_pwned_entries_cache = compromisedEntries.slice().sort((a, b) => {
                        const an = String((a && a.entry && a.entry.name) || '').toLowerCase();
                        const bn = String((b && b.entry && b.entry.name) || '').toLowerCase();
                        return an.localeCompare(bn);
                    });
                } catch (e) {}
                try {
                    const compromisedPasswords = compromisedEntries
                        .map(x => (x && typeof x.password === 'string') ? x.password : '')
                        .filter(v => !!v);
                    if (compromisedPasswords.length) {
                        persistCompromisedPasswordsToBlacklist(compromisedPasswords);
                    }
                } catch (e) {}
                const tone = compromised > 0 ? 'sp-strength-danger' : 'sp-strength-good';
                setPwnedStatsCard(compromised, tone, tr('pwned_found_count_title', 'Nombre de paires identifiant/mot de passe trouvées dans des bases compromises'));
            })
            .catch(() => {
                try { window.SP_pwned_entries_cache = []; } catch (e) {}
                setPwnedStatsCard(tr('not_available_short', 'N/A'), 'sp-strength-warn', tr('pwned_unavailable', 'Impossible de vérifier Have I Been Pwned pour le moment'));
            });
    }

    statsView.innerHTML = `
        <div class="sp-stats-page">
            <h2 class="sp-stats-title">${escHtml(tr('home', 'Acceuil'))}</h2>
            <div class="sp-stats-grid">
                <div class="sp-stats-card"><div class="sp-stats-label">${escHtml(tr('stats_total', 'Total'))}</div><div class="sp-stats-value">${total}</div></div>
                <div class="sp-stats-card sp-anssi-card">
                    <div class="sp-stats-label sp-anssi-label">
                        <span class="material-icons sp-anssi-icon" aria-hidden="true">verified_user</span>
                        ${escHtml(tr('stats_anssi_rate_label', 'Taux de sécurisation ANSSI (indicatif)'))}
                    </div>
                    <div class="sp-stats-value ${anssiTone}">${avgAnssiRate}%</div>
                </div>
            </div>
            <div class="sp-stats-grid sp-strength-grid">
                <div class="sp-stats-card"><div class="sp-stats-label">${escHtml(tr('stats_avg_strength', 'Force moyenne'))}</div><div class="sp-stats-value ${avgTone}">${avgStrength}%</div></div>
                <div class="sp-stats-card"><div class="sp-stats-label">${escHtml(tr('stats_min_strength', 'Force min'))}</div><div class="sp-stats-value ${minTone}">${minStrength}%</div></div>
                <div class="sp-stats-card"><div class="sp-stats-label">${escHtml(tr('stats_max_strength', 'Force max'))}</div><div class="sp-stats-value ${maxTone}">${maxStrength}%</div></div>
            </div>
            <div class="sp-stats-grid sp-strength-grid">
                <div class="sp-stats-card sp-expiring-card" id="sp-pwned-card" role="button" tabindex="0" aria-label="${escHtml(tr('stats_show_pwned_pairs_aria', 'Afficher les paires identifiant et mot de passe compromises'))}" title="${escHtml(tr('stats_pwned_pairs_title', 'Vérification des paires identifiant/mot de passe via Have I Been Pwned'))}">
                    <div class="sp-stats-label">${escHtml(tr('stats_pwned_pairs_label', 'Paires identifiant + MDP compromises (HIBP)'))}</div>
                    <div class="sp-stats-value sp-strength-warn" id="sp-pwned-value">…</div>
                </div>
            </div>
            <div class="sp-stats-grid sp-expiring-grid">
                <div class="sp-stats-card sp-expiring-card" id="sp-expiring-card" role="button" tabindex="0" aria-label="${escHtml(tr('stats_show_expiring_aria', 'Afficher les mots de passe bientôt expirés'))}">
                    <div class="sp-stats-label">${escHtml(tr('stats_expiring_passwords_label', 'Mots de passe bientôt expirés'))}</div>
                    <div class="sp-stats-value ${expiringTone}">${expiringSoonEntries.length}</div>
                </div>
            </div>
            <div class="sp-anssi-details" id="sp-anssi-details"><div class="sp-anssi-loading">${escHtml(tr('stats_loading_anssi', 'Chargement des recommandations ANSSI...'))}</div></div>
            <div class="sp-leaks-feed" id="sp-leaks-feed"><div class="sp-anssi-loading">${escHtml(tr('stats_loading_leaks', 'Chargement du flux des fuites de données...'))}</div></div>
        </div>
    `;

    try {
        window.SP_expiring_entries_cache = expiringSoonEntries.slice().sort((a, b) => a.daysLeft - b.daysLeft);
        const expiringCard = document.getElementById('sp-expiring-card');
        const pwnedCard = document.getElementById('sp-pwned-card');
        if (expiringCard) {
            const openExpiring = () => displayCategory('expiring_soon');
            expiringCard.addEventListener('click', openExpiring);
            expiringCard.addEventListener('keydown', (ev) => {
                if (ev.key === 'Enter' || ev.key === ' ') {
                    ev.preventDefault();
                    openExpiring();
                }
            });
        }
        if (pwnedCard) {
            const openPwned = () => displayCategory('pwned_pairs');
            pwnedCard.addEventListener('click', openPwned);
            pwnedCard.addEventListener('keydown', (ev) => {
                if (ev.key === 'Enter' || ev.key === ' ') {
                    ev.preventDefault();
                    openPwned();
                }
            });
        }
    } catch (e) {}

    if (typeof window.SP_hydrateAnssiDetails === 'function') {
        window.SP_hydrateAnssiDetails({ escHtml, tr });
    }
    if (typeof window.SP_hydrateLeakRssFeed === 'function') {
        const leakKeywordsSet = new Set();
        try {
            for (const ctx of rssContextEntries) {
                if (!ctx || !ctx.entry) continue;
                const kws = collectLeakKeywordsFromEntry(ctx.entry, ctx.category);
                for (const kw of kws) {
                    if (kw && kw.length >= 3) leakKeywordsSet.add(kw);
                    if (leakKeywordsSet.size >= 80) break;
                }
                if (leakKeywordsSet.size >= 80) break;
            }
        } catch (e) {}

        window.SP_hydrateLeakRssFeed({
            escHtml,
            tr,
            leakKeywordsSet,
            credentialEntries: rssContextEntries,
            displayCategory
        });
    }
    hydratePwnedCredentialStats();
};
