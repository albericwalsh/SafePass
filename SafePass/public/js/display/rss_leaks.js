window.SP_hydrateLeakRssFeed = function hydrateLeakRssFeed(params) {
    const p = params && typeof params === 'object' ? params : {};
    const escHtml = typeof p.escHtml === 'function' ? p.escHtml : (v => String(v || ''));
    const tr = typeof p.tr === 'function' ? p.tr : ((_, fallback) => fallback || '');
    const leakKeywordsSet = p.leakKeywordsSet instanceof Set ? p.leakKeywordsSet : new Set();
    const credentialEntries = Array.isArray(p.credentialEntries) ? p.credentialEntries : [];
    const openCategory = typeof p.displayCategory === 'function' ? p.displayCategory : (typeof window.displayCategory === 'function' ? window.displayCategory : null);
    const feedEl = document.getElementById('sp-leaks-feed');
    if (!feedEl) return;
    const isFrontendDev = (window.location.port === '3000');
    const backendBase = `${window.location.protocol}//${window.location.hostname}:5000`;

    function fetchLeakRssMatches(keywords) {
        try {
            const list = Array.isArray(keywords) ? keywords : [];
            const url = isFrontendDev ? (backendBase + '/api/leaks/rss-matches') : '/api/leaks/rss-matches';
            return fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                cache: 'no-store',
                body: JSON.stringify({ keywords: list, max_items: 8 })
            }).then(r => r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status)));
        } catch (e) {
            return Promise.reject(e);
        }
    }

    function buildImageFallbackCandidates(item) {
        const candidates = [];
        const pushCandidate = (v) => {
            const s = String(v || '').trim();
            if (!s) return;
            candidates.push(s);
        };

        const buildTitleIllustrationDataUri = (title, source) => {
            const rawTitle = String(title || '').trim() || 'Data breach';
            const rawSource = String(source || '').trim() || 'RSS';
            const words = rawTitle.match(/[A-Za-z0-9]+/g) || [];
            const first = (words[0] || 'Leak').slice(0, 14);
            const second = (words[1] || rawSource).slice(0, 14);
            const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='1280' height='720' viewBox='0 0 1280 720'>` +
                `<defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0%' stop-color='#1c1f2a'/><stop offset='100%' stop-color='#2f3a55'/></linearGradient></defs>` +
                `<rect width='1280' height='720' fill='url(#g)'/>` +
                `<circle cx='180' cy='120' r='110' fill='rgba(255,255,255,0.06)'/>` +
                `<circle cx='1120' cy='620' r='140' fill='rgba(255,255,255,0.06)'/>` +
                `<text x='80' y='350' fill='#ffffff' font-family='Arial, sans-serif' font-size='72' font-weight='700'>${first}</text>` +
                `<text x='80' y='430' fill='#d6dbe8' font-family='Arial, sans-serif' font-size='56' font-weight='600'>${second}</text>` +
                `<text x='80' y='520' fill='#9fb0d1' font-family='Arial, sans-serif' font-size='34'>${rawSource}</text>` +
                `</svg>`;
            return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
        };

        const buildIconIllustrationDataUri = () => {
            const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='1280' height='720' viewBox='0 0 1280 720'>` +
                `<defs><linearGradient id='g2' x1='0' y1='0' x2='1' y2='1'><stop offset='0%' stop-color='#1d2433'/><stop offset='100%' stop-color='#2f3f67'/></linearGradient></defs>` +
                `<rect width='1280' height='720' fill='url(#g2)'/>` +
                `<g fill='none' stroke='#dbe6ff' stroke-width='26' stroke-linecap='round' stroke-linejoin='round'>` +
                `<path d='M640 170l220 90v150c0 170-105 250-220 300-115-50-220-130-220-300V260l220-90z'/>` +
                `<path d='M640 350v120'/>` +
                `<circle cx='640' cy='300' r='10' fill='#dbe6ff' stroke='none'/>` +
                `</g>` +
                `<text x='640' y='610' text-anchor='middle' fill='#dbe6ff' font-family='Arial, sans-serif' font-size='42' font-weight='600'>Data Breach Alert</text>` +
                `</svg>`;
            return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
        };

        const scoreImageCandidate = (urlValue) => {
            const s = String(urlValue || '').trim();
            if (!s) return -999;
            const low = s.toLowerCase();
            let score = 0;

            if (/\.(jpg|jpeg|png|webp)(\?|$)/.test(low)) score += 30;
            if (/\.(svg|gif)(\?|$)/.test(low)) score -= 8;

            if (/\/wp-content\//.test(low)) score += 8;
            if (/\/uploads\//.test(low)) score += 6;
            if (/\/media\//.test(low)) score += 4;

            if (/favicon|icon|logo|sprite|avatar/.test(low)) score -= 60;
            if (/google\.com\/s2\/favicons/.test(low)) score -= 80;

            if (/width=\d{3,}|w=\d{3,}/.test(low)) score += 6;
            if (/height=\d{3,}|h=\d{3,}/.test(low)) score += 4;

            return score;
        };

        const rawFromFeed = [];
        if (Array.isArray(item && item.image_candidates)) {
            rawFromFeed.push(...item.image_candidates);
        }
        if (item && item.image_url) {
            rawFromFeed.push(item.image_url);
        }

        const dedupFeed = [];
        const seenFeed = new Set();
        for (const candidate of rawFromFeed) {
            const s = String(candidate || '').trim();
            if (!s) continue;
            const key = s.toLowerCase();
            if (seenFeed.has(key)) continue;
            seenFeed.add(key);
            dedupFeed.push(s);
        }

        dedupFeed
            .sort((a, b) => scoreImageCandidate(b) - scoreImageCandidate(a))
            .forEach(pushCandidate);

        const titleIllustration = buildTitleIllustrationDataUri(item && item.title, item && item.source);
        pushCandidate(titleIllustration);
        pushCandidate(buildIconIllustrationDataUri());

        const dedup = [];
        const seen = new Set();
        for (const url of candidates) {
            const key = url.toLowerCase();
            if (seen.has(key)) continue;
            seen.add(key);
            dedup.push(url);
            if (dedup.length >= 8) break;
        }
        return dedup;
    }

    window.SP_leaksNewsImageFallback = function(imgEl) {
        try {
            if (!imgEl) return;
            const raw = String(imgEl.getAttribute('data-fallbacks') || '');
            const list = raw ? raw.split('||').filter(Boolean) : [];
            let idx = parseInt(String(imgEl.getAttribute('data-fallback-idx') || '0'), 10);
            if (Number.isNaN(idx)) idx = 0;
            idx += 1;
            if (idx < list.length) {
                imgEl.setAttribute('data-fallback-idx', String(idx));
                imgEl.src = list[idx];
                return;
            }

            const holder = imgEl.closest('.sp-news-card-illustration');
            if (holder) {
                holder.classList.add('sp-news-illustration-fallback');
                holder.innerHTML = '<span class="material-icons" aria-hidden="true">newspaper</span>';
            } else {
                imgEl.style.display = 'none';
            }
        } catch (e) {}
    };

    function normalizeKeywordForMatch(v) {
        return String(v || '').toLowerCase().trim().replace(/[^a-z0-9._-]/g, '');
    }

    function collectKeywordsFromGlobalData() {
        const out = new Set();
        try {
            const localAllData = (typeof allData !== 'undefined') ? allData : null;
            const data = Array.isArray(window.allData) ? window.allData : (Array.isArray(localAllData) ? localAllData : []);
            for (const block of data) {
                if (!block || typeof block !== 'object') continue;
                for (const category of ['sites', 'applications']) {
                    const entries = Array.isArray(block[category]) ? block[category] : [];
                    for (const entry of entries) {
                        if (!entry || typeof entry !== 'object') continue;

                        if (category === 'applications') {
                            const rawName = String(entry.name || '').trim();
                            if (rawName) {
                                const compactName = normalizeKeywordForMatch(rawName);
                                if (compactName && compactName.length >= 3) out.add(compactName);
                                const nameParts = rawName.toLowerCase().match(/[a-z0-9]+/g) || [];
                                for (const part of nameParts) {
                                    const token = normalizeKeywordForMatch(part);
                                    if (token && token.length >= 3) out.add(token);
                                    if (out.size >= 80) break;
                                }
                            }
                        }

                        const urlValue = String(entry.url || '').trim();
                        if (category === 'sites' && urlValue) {
                            try {
                                const withProto = urlValue.includes('://') ? urlValue : ('https://' + urlValue);
                                const u = new URL(withProto);
                                const host = normalizeKeywordForMatch(u.hostname || '');
                                if (host && host.length >= 3) {
                                    out.add(host);
                                    const parts = host.split('.').filter(Boolean);
                                    if (parts.length >= 2) {
                                        const rootDomain = normalizeKeywordForMatch(parts.slice(-2).join('.'));
                                        const rootName = normalizeKeywordForMatch(parts[parts.length - 2]);
                                        if (rootDomain && rootDomain.length >= 3) out.add(rootDomain);
                                        if (rootName && rootName.length >= 3) out.add(rootName);
                                    }
                                }
                            } catch (e) {}
                        }

                        if (out.size >= 80) return out;
                    }
                }
            }
        } catch (e) {}
        return out;
    }

    function extractEntryKeywords(entry, category) {
        const out = [];
        try {
            const cat = String(category || '').toLowerCase();

            if (cat === 'applications') {
                const rawName = String((entry && entry.name) || '').trim();
                const name = normalizeKeywordForMatch(rawName);
                if (name) out.push(name);
                if (rawName) {
                    const parts = rawName.toLowerCase().match(/[a-z0-9]+/g) || [];
                    for (const part of parts) {
                        const token = normalizeKeywordForMatch(part);
                        if (token && token.length >= 3) out.push(token);
                    }
                }
            }

            const urlValue = String((entry && entry.url) || '').trim();
            if (cat === 'sites' && urlValue) {
                try {
                    const withProto = urlValue.includes('://') ? urlValue : ('https://' + urlValue);
                    const u = new URL(withProto);
                    const host = normalizeKeywordForMatch(u.hostname || '');
                    if (host) {
                        out.push(host);
                        const parts = host.split('.').filter(Boolean);
                        if (parts.length >= 2) {
                            out.push(parts.slice(-2).join('.'));
                            out.push(parts[parts.length - 2]);
                        }
                    }
                } catch (e) {}
            }
        } catch (e) {}
        const dedup = [];
        const seen = new Set();
        for (const k of out) {
            if (!k || seen.has(k)) continue;
            seen.add(k);
            dedup.push(k);
        }
        return dedup;
    }

    function getRelatedEntriesForLeak(item) {
        const matchedKeywords = (Array.isArray(item && item.matched_keywords) ? item.matched_keywords : [])
            .map(normalizeKeywordForMatch)
            .filter(Boolean);
        if (!matchedKeywords.length) return [];

        const related = [];
        const seenEntries = new Set();
        for (const cred of credentialEntries) {
            if (!cred || !cred.entry) continue;
            const ref = `${cred.category || ''}::${cred.entry.name || ''}::${cred.entry.username || ''}::${cred.entry.password || ''}`;
            if (seenEntries.has(ref)) continue;
            const entryKeys = extractEntryKeywords(cred.entry, cred.category);
            if (!entryKeys.length) continue;

            let hit = false;
            for (const mk of matchedKeywords) {
                for (const ek of entryKeys) {
                    if (ek === mk || ek.includes(mk) || mk.includes(ek)) {
                        hit = true;
                        break;
                    }
                }
                if (hit) break;
            }

            if (hit) {
                seenEntries.add(ref);
                related.push(cred);
            }
        }
        return related;
    }

    let keywords = Array.from(leakKeywordsSet).filter(v => !!v).slice(0, 60);
    if (!keywords.length) {
        try {
            keywords = Array.from(collectKeywordsFromGlobalData()).slice(0, 60);
        } catch (e) {
            keywords = [];
        }
    }
    if (!keywords.length) {
        feedEl.innerHTML = `
            <h3 class="sp-anssi-title">${escHtml(tr('leaks_title', 'Dernières fuites de données (RSS)'))}</h3>
            <div class="sp-anssi-loading">${escHtml(tr('leaks_no_keywords', "Aucun nom d'application ou domaine disponible pour filtrer les fuites."))}</div>
        `;
        return;
    }

    fetchLeakRssMatches(keywords)
        .then(data => {
            const items = (data && Array.isArray(data.items)) ? data.items : [];
            const relatedByCard = [];
            const cardsHtml = items.slice(0, 8).map(it => {
                const title = escHtml(it.title || tr('leak_detected_title', 'Leak détectée'));
                const link = escHtml(it.link || '#');
                const source = escHtml(it.source || tr('leaks_source_default', 'RSS'));
                const published = escHtml(it.published || '');
                const matched = Array.isArray(it.matched_keywords) ? it.matched_keywords.map(k => escHtml(k)).join(', ') : '';
                const imageCandidates = buildImageFallbackCandidates(it);
                const firstImage = escHtml(imageCandidates[0] || '');
                const fallbackData = escHtml(imageCandidates.join('||'));
                const relatedEntries = getRelatedEntriesForLeak(it);
                const relatedIndex = relatedByCard.push(relatedEntries) - 1;
                const relatedCount = relatedEntries.length;
                const illustrationHtml = firstImage
                    ? `<img class="sp-news-card-image" src="${firstImage}" data-fallbacks="${fallbackData}" data-fallback-idx="0" alt="${escHtml(tr('leaks_illustration_alt', 'Illustration leak'))}" loading="lazy" referrerpolicy="no-referrer" onerror="window.SP_leaksNewsImageFallback(this)" />`
                    : `<span class="material-icons" aria-hidden="true">newspaper</span>`;
                return `
                    <article class="sp-news-card">
                        <div class="sp-news-card-illustration">${illustrationHtml}</div>
                        <div class="sp-news-card-body">
                            <h4 class="sp-news-card-title"><a class="sp-news-card-title-link" href="${link}" target="_blank" rel="noopener noreferrer">${title}</a></h4>
                            <div class="sp-leaks-meta">${source}${published ? ' · ' + published : ''}${matched ? ' · ' + escHtml(tr('leaks_match_prefix', 'match')) + ': ' + matched : ''}</div>
                            <div class="sp-news-card-actions">
                                <button type="button" class="sp-pwned-open-btn sp-news-related-btn" data-related-index="${relatedIndex}" ${relatedCount ? '' : 'disabled'}>
                                    ${escHtml(tr('leaks_possible_compromised_button', 'Mots de passe possiblement compromis'))} : ${relatedCount}
                                </button>
                            </div>
                        </div>
                    </article>
                `;
            }).join('');

            feedEl.innerHTML = `
                <h3 class="sp-anssi-title">${escHtml(tr('leaks_title', 'Dernières fuites de données (RSS)'))}</h3>
                <div class="sp-news-cards-grid">${cardsHtml || `<div class="sp-anssi-loading">${escHtml(tr('leaks_no_recent', 'Aucune fuite récente trouvée pour vos applications/domaines.'))}</div>`}</div>
            `;

            try { window.SP_rss_related_entries_by_card = relatedByCard; } catch (e) {}

            try {
                const buttons = feedEl.querySelectorAll('.sp-news-related-btn');
                buttons.forEach(btn => {
                    btn.addEventListener('click', () => {
                        const idx = parseInt(String(btn.getAttribute('data-related-index') || '-1'), 10);
                        const groups = Array.isArray(window.SP_rss_related_entries_by_card) ? window.SP_rss_related_entries_by_card : [];
                        const selected = (idx >= 0 && idx < groups.length && Array.isArray(groups[idx])) ? groups[idx] : [];
                        window.SP_rss_related_entries_cache = selected;
                        if (typeof openCategory === 'function') openCategory('rss_related_passwords');
                    });
                });
            } catch (e) {}
        })
        .catch(() => {
            feedEl.innerHTML = `
                <h3 class="sp-anssi-title">${escHtml(tr('leaks_title', 'Dernières fuites de données (RSS)'))}</h3>
                <div class="sp-anssi-loading">${escHtml(tr('leaks_load_error', 'Impossible de charger le flux de fuites pour le moment.'))}</div>
            `;
        });
};
