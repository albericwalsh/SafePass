window.SP_hydrateAnssiDetails = function hydrateAnssiDetails(params) {
    const p = params && typeof params === 'object' ? params : {};
    const escHtml = typeof p.escHtml === 'function' ? p.escHtml : (v => String(v || ''));
    const tr = typeof p.tr === 'function' ? p.tr : ((_, fallback) => fallback || '');
    const detailsEl = document.getElementById('sp-anssi-details');
    if (!detailsEl) return;

    const ANSSI_LOGO_URL = 'https://s3.eu-west-par.io.cloud.ovh.net/sf-cyber/sf-cyber/images/20230704_np_anssi_logotype_500x500.original.png?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=f56b12dc7d9741d6bb98766a26a6adca%2F20260221%2Feu-west-par%2Fs3%2Faws4_request&X-Amz-Date=20260221T154828Z&X-Amz-Expires=3600&X-Amz-SignedHeaders=host&X-Amz-Signature=3c342cbdf191227845e5c3eb1c9df6a5699fe4b7613a3b97a006886d106a5fd1';
    const ANSSI_LOGO_FALLBACK = `data:image/svg+xml;utf8,${encodeURIComponent("<svg xmlns='http://www.w3.org/2000/svg' width='96' height='96' viewBox='0 0 96 96'><rect width='96' height='96' rx='10' fill='#ffffff'/><path d='M48 10l26 11v18c0 20-12 36-26 44-14-8-26-24-26-44V21l26-11z' fill='#0055A4'/><text x='48' y='56' text-anchor='middle' font-family='Arial, sans-serif' font-size='24' font-weight='700' fill='#ffffff'>A</text></svg>")}`;

    function fetchAnssiRecommendations() {
        try {
            const isFrontendDev = (window.location.port === '3000');
            const backendBase = `${window.location.protocol}//${window.location.hostname}:5000`;
            const url = isFrontendDev ? (backendBase + '/api/anssi/recommendations') : '/api/anssi/recommendations';
            return fetch(url, { cache: 'no-store' }).then(r => r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status)));
        } catch (e) {
            return Promise.reject(e);
        }
    }

    fetchAnssiRecommendations()
        .then(data => {
            const recos = (data && Array.isArray(data.recommendations)) ? data.recommendations : [];
            const safeItems = recos.slice(0, 8).map(s => `<li>${escHtml(s)}</li>`).join('');
            const sourceUrl = (data && data.source_url) ? data.source_url : 'https://cyber.gouv.fr/';
            const fetchedAt = (data && data.fetched_at) ? data.fetched_at : '';
            const modeText = (data && data.dynamic)
                ? tr('anssi_source_live', 'Source ANSSI (live)')
                : tr('anssi_source_fallback', 'Source ANSSI (fallback local)');
            detailsEl.innerHTML = `
                <div class="sp-anssi-layout">
                    <a class="sp-anssi-logo-link" href="${escHtml(sourceUrl)}" target="_blank" rel="noopener noreferrer" title="${escHtml(tr('anssi_open_source_title', 'Ouvrir la source ANSSI'))}">
                        <img class="sp-anssi-logo" src="${ANSSI_LOGO_URL}" alt="Logo ANSSI" loading="lazy" referrerpolicy="no-referrer" onerror="this.onerror=null;this.src='${ANSSI_LOGO_FALLBACK}';" />
                    </a>
                    <div class="sp-anssi-content">
                        <h3 class="sp-anssi-title">${escHtml(tr('anssi_recommendations_title', 'Recommandations ANSSI'))}</h3>
                        <ul class="sp-anssi-list">${safeItems || `<li>${escHtml(tr('anssi_no_recommendations', 'Aucune recommandation disponible pour le moment.'))}</li>`}</ul>
                        <div class="sp-anssi-meta">
                            <a href="${escHtml(sourceUrl)}" target="_blank" rel="noopener noreferrer">${modeText}</a>
                            <span>${escHtml(fetchedAt)}</span>
                        </div>
                    </div>
                </div>
            `;
        })
        .catch(() => {
            detailsEl.innerHTML = `
                <div class="sp-anssi-layout">
                    <a class="sp-anssi-logo-link" href="https://cyber.gouv.fr/" target="_blank" rel="noopener noreferrer" title="${escHtml(tr('anssi_open_site_title', 'Ouvrir le site ANSSI'))}">
                        <img class="sp-anssi-logo" src="${ANSSI_LOGO_URL}" alt="Logo ANSSI" loading="lazy" referrerpolicy="no-referrer" onerror="this.onerror=null;this.src='${ANSSI_LOGO_FALLBACK}';" />
                    </a>
                    <div class="sp-anssi-content">
                        <h3 class="sp-anssi-title">${escHtml(tr('anssi_recommendations_title', 'Recommandations ANSSI'))}</h3>
                        <ul class="sp-anssi-list"><li>${escHtml(tr('anssi_load_error', 'Impossible de charger les recommandations ANSSI pour le moment.'))}</li></ul>
                    </div>
                </div>
            `;
        });
};
