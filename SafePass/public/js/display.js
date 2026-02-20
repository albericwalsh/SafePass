// Robust favicon loader: try Google S2 -> DuckDuckGo -> local proxy -> embedded SVG
const __defaultFaviconDataURI = `data:image/svg+xml;utf8,` + encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='64' height='64' viewBox='0 0 64 64'>` +
    `<rect width='100%' height='100%' fill='%236c757d' rx='8'/>` +
    `<text x='50%' y='50%' dy='.35em' text-anchor='middle' fill='white' font-family='Arial' font-size='28'>SP</text>` +
    `</svg>`
);

async function __tryImageLoad(src, timeoutMs = 4000, useFetch = true) {
    // First attempt: try a HEAD request to read status (works when CORS allows it)
    if (useFetch) {
        try {
            const controller = new AbortController();
            const signal = controller.signal;
            const timer = setTimeout(() => controller.abort(), timeoutMs);
            try {
                // use GET so fetch follows redirects (t3.gstatic.com) and exposes final status
                const resp = await fetch(src, { method: 'GET', mode: 'cors', redirect: 'follow', signal });
                clearTimeout(timer);
                if (resp.status === 404) return false; // explicit 404 from final target
                // treat as success only for ok responses and image-like content-types
                if (resp.ok) {
                    const ct = (resp.headers.get('Content-Type') || '').toLowerCase();
                    if (ct.startsWith('image/') || ct.includes('svg') || ct.includes('icon')) return true;
                    // if content-type is not image, still consider OK but let Image() confirm later
                    return true;
                }
                return false;
            } catch (e) {
                // GET failed (likely CORS) -> fall back to image load test
                clearTimeout(timer);
            }
        } catch (e) {
            // ignore and fallback to image test
        }
    }

    // Fallback: load via Image() and detect onload/onerror (onerror will fire for 404s)
    return await new Promise(resolve => {
        try {
            const img = new Image();
            let done = false;
            const t = setTimeout(() => { if (!done) { done = true; img.onload = img.onerror = null; resolve(false); } }, timeoutMs);
            img.onload = function () {
                if (!done) {
                    done = true;
                    clearTimeout(t);
                    try {
                        // Some servers return an opaque/empty image (naturalWidth === 0) despite onload.
                        // Treat that as a failure so we can fall back to other sources.
                        if (img.naturalWidth && img.naturalWidth > 0) {
                            resolve(true);
                        } else {
                            resolve(false);
                            src = ""; // trigger onerror fallback
                        }
                    } catch (e) {
                        resolve(false);
                        src = ""; // trigger onerror fallback
                    }
                }
            };
            img.onerror = function () { if (!done) { done = true; clearTimeout(t); resolve(false); } };
            img.src = src;
        } catch (e) { 
            resolve(false);
            src = ""; // trigger onerror fallback 
        }
    });
}

async function loadFaviconForImage(hostname, imgEl) {
    if (!hostname || !imgEl) return;
    const timeoutMs = 4000; // default timeout for favicon checks
    const gSrc = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(hostname)}&sz=64`;
    // Use the embedded default SVG as a static fallback (avoids proxy/gstatic requests)
    const proxySrc = __defaultFaviconDataURI;

    try {
        // Google S2 last (Image() may trigger gstatic redirects that sometimes 404)
        if (await __tryImageLoad(gSrc, timeoutMs, false)) { imgEl.src = gSrc; console.debug('[favicon] using Google S2 for', hostname, gSrc); return; }
        // Prefer local proxy (same-origin) first to avoid unnecessary cross-origin calls
        if (await __tryImageLoad(proxySrc, timeoutMs, true)) { imgEl.src = proxySrc; console.debug('[favicon] using local proxy for', hostname, proxySrc); return; }
    } catch (e) {
        console.debug('[favicon] load error for', hostname, e);
    }
    imgEl.src = __defaultFaviconDataURI;
    console.debug('[favicon] fallback default for', hostname);
}

async function displayCategory(category) {
    currentCategory = category;
    // Wait for required aws-* web components to be defined before constructing rows
    try {
        if (typeof customElements !== 'undefined' && typeof customElements.get === 'function') {
            const required = ['aws-table', 'aws-table-row', 'aws-table-cell', 'aws-input', 'aws-icon-button'];
            const missing = required.filter(n => !customElements.get(n));
            if (missing.length) {
                console.debug('Waiting for widgets to be defined:', missing);
                await Promise.all(missing.map(n => customElements.whenDefined(n).catch(()=>{})));
            }
        }
    } catch (e) { /* ignore */ }

    let tableHeaders = $('#table-headers');
    let tableBody = $('#dynamic-list');
    tableHeaders.empty();
    tableBody.empty();

    console.log("currentCategory:", currentCategory);

    if (!Array.isArray(allData)) {
        console.error("allData is not an array:", allData);
        return;
    }

    if (allData.length) {
        // Find first entry that contains the requested category and has at least one item
        let sampleEntry = null;
        for (const obj of allData) {
            if (obj && Array.isArray(obj[category]) && obj[category].length) { sampleEntry = obj[category][0]; break; }
        }
        if (sampleEntry) {
            let headers = ['name', 'url', 'GUID', 'username', 'password'];
            // Do not add extra icon column here; aws-table handles its internal structure
            headers.forEach(key => {
                if (sampleEntry[key] !== undefined) {
                    let icon = document.createElement('i');
                    // add a class name for icon usage (font library may provide styles)
                    switch (key) {
                        case 'name': icon.className = 'fas fa-file'; break;
                        case 'url': icon.className = 'fas fa-link'; break;
                        case 'GUID': icon.className = 'fas fa-key'; break;
                        case 'username': icon.className = 'fas fa-user-circle'; break;
                        case 'password': icon.className = 'fas fa-lock'; break;
                    }
                    const cell = document.createElement('aws-table-cell');
                    cell.setAttribute('data-key', key);
                    // Use innerHTML to include icon + label
                    cell.innerHTML = (icon.className ? '<i class="' + icon.className + '"></i> ' : '') + key;
                    const theadEl = tableHeaders[0] || document.getElementById('table-headers');
                    if (theadEl && typeof theadEl.appendChild === 'function') theadEl.appendChild(cell);
                    else tableHeaders.append(cell);
                }
            });

            // Add the header for the edit column
            const editHeader = document.createElement('aws-table-cell');
            editHeader.textContent = (window.t && window.t('edit')) || 'Edit';
            const theadElEdit = tableHeaders[0] || document.getElementById('table-headers');
            if (theadElEdit && typeof theadElEdit.appendChild === 'function') theadElEdit.appendChild(editHeader);
            else tableHeaders.append(editHeader);
        }
    }


    allData.forEach(item => {
        if (item[category] && Array.isArray(item[category])) {
            item[category].forEach(entry => {
                const row = document.createElement('aws-table-row');

                // Do not add favicon/icon columns here; rely on the custom element's rendering

                ['name', 'url', 'GUID', 'username', 'password'].forEach(key => {
                    if (entry[key] !== undefined) {
                        const cell = document.createElement('aws-table-cell');
                        cell.setAttribute('data-key', key);
                        if (key === 'password') {
                            const strengthColor = typeof getPasswordStrength === 'function' ? getPasswordStrength(entry[key]) : 'transparent';
                            const strengthPercent = (typeof getPasswordStrengthPercent === 'function') ? getPasswordStrengthPercent(entry[key]) : null;
                            const percentHtml = (strengthPercent !== null && typeof strengthPercent !== 'undefined') ? ('<span class="password-strength-percent" style="margin-right:8px;color:var(--sp-panel-text);min-width:44px;display:inline-block;">' + strengthPercent + '%</span>') : '';
                            cell.innerHTML = percentHtml + `<span class="password-strength" style="background-color: ${strengthColor}; width: 10px; height: 10px; display: inline-block; border-radius: 50%; margin-right: 8px;"></span><aws-input mode="view" variant="primary" type="password" value="${escapeHtml(entry[key])}"></aws-input>`;
                        } else {
                            const type = key === 'url' ? 'url' : 'text';
                            cell.innerHTML = `<aws-input mode="view" variant="primary" type="${type}" value="${escapeHtml(entry[key])}"></aws-input>`;
                        }
                        row.appendChild(cell);
                    }
                });

                // Tools cell
                const toolsCell = document.createElement('aws-table-cell');
                toolsCell.setAttribute('data-key', 'Tools');
                const editBtn = document.createElement('aws-icon-button');
                editBtn.setAttribute('size', 'sm');
                editBtn.setAttribute('variant', 'primary');
                editBtn.innerHTML = '<span class="material-icons">edit</span>';
                editBtn.addEventListener('click', () => showEditForm(category, entry));

                const delBtn = document.createElement('aws-icon-button');
                delBtn.setAttribute('size', 'sm');
                delBtn.setAttribute('variant', 'primary');
                delBtn.innerHTML = '<span class="material-icons">delete</span>';
                delBtn.addEventListener('click', () => deleteEntry(category, entry));

                toolsCell.appendChild(editBtn);
                toolsCell.appendChild(delBtn);
                row.appendChild(toolsCell);

                // Build a search index string for quick filtering
                try {
                    const values = [];
                    ['name','url','GUID','username','password'].forEach(k => { if (entry[k] !== undefined) values.push(String(entry[k])); });
                    row.setAttribute('data-search', escapeHtml(values.join(' ').toLowerCase()));
                } catch (e) {}

                // Append row to body (use DOM API)
                const tbodyEl = tableBody[0] || document.getElementById('dynamic-list');
                if (tbodyEl && typeof tbodyEl.appendChild === 'function') tbodyEl.appendChild(row);
                else tableBody.append(row);
            });
        }
    });

    // Ensure custom elements have attached their shadow roots before finishing
    async function waitForShadowRoots(rootEl, selector, timeoutMs = 1500) {
        if (!rootEl) return;
        const start = Date.now();
        while (Date.now() - start < timeoutMs) {
            const nodes = rootEl.querySelectorAll(selector);
            if (!nodes || nodes.length === 0) return; // nothing to wait for
            let all = true;
            for (let i = 0; i < nodes.length; i++) {
                try { if (!nodes[i].shadowRoot) { all = false; break; } } catch (e) { all = false; break; }
            }
            if (all) return;
            await new Promise(r => setTimeout(r, 50));
        }
        // timed out - proceed anyway
    }

    try {
        const tbodyEl = (tableBody && tableBody[0]) ? tableBody[0] : document.getElementById('dynamic-list');
        await waitForShadowRoots(tbodyEl, 'aws-table-cell', 1500);
        // small delay to allow internal layout to stabilise
        await new Promise(r => setTimeout(r, 30));
    } catch (e) {
        console.debug('shadow root wait failed', e);
    }

    // password visibility toggles and copy icons removed from table view
}

// Ensure function is available in global scope for other scripts
try {
    if (typeof window !== 'undefined') window.displayCategory = displayCategory;
} catch (e) {}

// Sticky, centered search-bar with smooth animated transition between positions
(function initStickySearch() {
    try {
        const searchEl = document.querySelector('.search-bar');
        if (!searchEl) return;

        let placeholder = null;
        let isSticky = false;
        let initialTop = null;
        let expandedInnerHost = null;
        let ticking = false;

        function recalc() {
            const rect = searchEl.getBoundingClientRect();
            initialTop = window.scrollY + rect.top;
        }

        function setFixedAt(rect) {
            searchEl.style.position = 'fixed';
            searchEl.style.left = rect.left + 'px';
            searchEl.style.top = rect.top + 'px';
            searchEl.style.width = rect.width + 'px';
            searchEl.style.transform = '';
            searchEl.style.transition = 'left 300ms ease, top 300ms ease, width 300ms ease, opacity 200ms ease';
        }

        // Helpers to expand/revert inner widget (.widget-search) inside aws-search shadowRoot
        function expandInnerWidget(inner) {
            try {
                if (!inner) return null;
                const sr = inner.shadowRoot;
                const widget = sr ? sr.querySelector('.widget-search') : inner.querySelector('.widget-search');
                if (!widget) return null;
                // store original inline styles
                widget.dataset._origStyle = widget.getAttribute('style') || '';
                widget.style.width = '100%';
                widget.style.maxWidth = 'none';
                widget.style.margin = '0';
                widget.style.transition = (widget.style.transition ? widget.style.transition + ', ' : '') + 'width 300ms ease';
                return widget;
            } catch (e) { return null; }
        }

        function restoreInnerWidget(inner) {
            try {
                if (!inner) return;
                const sr = inner.shadowRoot;
                const widget = sr ? sr.querySelector('.widget-search') : inner.querySelector('.widget-search');
                if (!widget) return;
                const orig = widget.dataset._origStyle || '';
                widget.setAttribute('style', orig);
                delete widget.dataset._origStyle;
            } catch (e) {}
        }

        function animateToCenter() {
            const rect = searchEl.getBoundingClientRect();
            const headerHeight = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--header-height')) || 56;
            // compute target width (respect previous CSS max-width behavior)
            const maxW = 920;
            const targetWidth = Math.min(maxW, Math.round(window.innerWidth * 0.6));
            const targetLeft = Math.round((window.innerWidth - targetWidth) / 2);
            const targetTop = headerHeight + 12;

            // trigger animation by setting left/top/width to target values
            // ensure reflow
            searchEl.getBoundingClientRect();
            // animate the host position/size
            searchEl.style.left = targetLeft + 'px';
            searchEl.style.top = targetTop + 'px';
            searchEl.style.width = targetWidth + 'px';

            // animate inner search widget transform at the same time to avoid jump
            const inner = searchEl.querySelector('aws-search, .aws-search');
            if (inner) {
                inner.style.transition = 'transform 300ms cubic-bezier(.2,.8,.2,1)';
                inner.style.transform = 'translateX(-8px)';
            }

            function onEnd(e) {
                // wait for width/left/top to finish
                if (e && !/(left|top|width)/.test(e.propertyName)) return;
                searchEl.removeEventListener('transitionend', onEnd);
                // keep inline layout values stable (do not clear) and add visual-only sticky class
                searchEl.classList.add('sticky');
                // ensure inner transform remains (in case computed styles differ)
                if (inner) {
                    // keep inline transform so there's no sudden change
                    inner.style.transform = 'translateX(-8px)';
                    try { expandedInnerHost = inner; expandInnerWidget(inner); } catch (e) {}
                }
            }

            searchEl.addEventListener('transitionend', onEnd);
        }

        function makeSticky() {
            if (isSticky) return;
            const rect = searchEl.getBoundingClientRect();
            placeholder = document.createElement('div');
            placeholder.style.height = rect.height + 'px';
            placeholder.className = 'search-bar-placeholder';
            searchEl.parentNode.insertBefore(placeholder, searchEl);
            // lock element at its current position then animate to center
            setFixedAt(rect);
            // double rAF to ensure style applied before animating
            requestAnimationFrame(() => requestAnimationFrame(() => {
                animateToCenter();
                // also animate header content to center
                try { animateHeaderToCenter(); } catch (e) {}
            }));
            isSticky = true;
        }

        function animateFromCenterToOriginal() {
            if (!placeholder) return finishRemove();
            const placeholderRect = placeholder.getBoundingClientRect();
            // make sure element is fixed at its current visual position
            const rect = searchEl.getBoundingClientRect();
            // temporarily set it to fixed coordinates
            searchEl.classList.remove('sticky');
            searchEl.style.position = 'fixed';
            // ensure current inline left/top/width are applied
            searchEl.style.left = rect.left + 'px';
            searchEl.style.top = rect.top + 'px';
            searchEl.style.width = rect.width + 'px';
            // animate inner widget back to neutral (no translate) to avoid jump
            const inner = searchEl.querySelector('aws-search, .aws-search');
            if (inner) {
                inner.style.transition = 'transform 300ms cubic-bezier(.2,.8,.2,1)';
                inner.style.transform = '';
            }
            // force reflow
            searchEl.getBoundingClientRect();
            // animate left/top/width back to placeholder values
            searchEl.style.transition = 'left 300ms ease, top 300ms ease, width 300ms ease, opacity 200ms ease';
            searchEl.style.left = placeholderRect.left + 'px';
            searchEl.style.top = placeholderRect.top + 'px';
            searchEl.style.width = placeholderRect.width + 'px';

            function onEnd(e) {
                if (e && !/(left|top|width)/.test(e.propertyName)) return;
                searchEl.removeEventListener('transitionend', onEnd);
                finishRemove();
            }
            searchEl.addEventListener('transitionend', onEnd);

            function finishRemove() {
                // cleanup and restore in-flow positioning
                searchEl.style.position = '';
                searchEl.style.left = '';
                searchEl.style.top = '';
                searchEl.style.width = '';
                searchEl.style.transform = '';
                searchEl.style.transition = '';
                if (placeholder && placeholder.parentNode) placeholder.parentNode.removeChild(placeholder);
                // restore inner widget if we expanded it
                try { if (expandedInnerHost) { restoreInnerWidget(expandedInnerHost); expandedInnerHost = null; } } catch (e) {}
                placeholder = null;
                isSticky = false;
            }
        }

        function removeSticky() {
            if (!isSticky) return;
            // reverse header centering first
            try { revertHeaderCenter(); } catch (e) {}
            animateFromCenterToOriginal();
        }

        // Header centering helpers
        const headerContent = document.querySelector('.header-content');
        let headerOriginalTransform = '';
        function animateHeaderToCenter() {
            if (!headerContent) return;
            headerOriginalTransform = headerContent.style.transform || '';
            const hcRect = headerContent.getBoundingClientRect();
            const hcCenter = hcRect.left + hcRect.width / 2;
            const targetCenter = window.innerWidth / 2;
            const delta = Math.round(targetCenter - hcCenter);
            // apply transform to shift to center
            headerContent.style.transition = 'transform 300ms cubic-bezier(.2,.8,.2,1)';
            headerContent.style.transform = `translateX(${delta}px)`;
        }

        function revertHeaderCenter() {
            if (!headerContent) return;
            headerContent.style.transform = headerOriginalTransform || '';
        }

        function checkSticky() {
            const headerHeight = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--header-height')) || 56;
            if (initialTop === null) recalc();
            if (window.scrollY > (initialTop - headerHeight - 8)) {
                makeSticky();
            } else {
                removeSticky();
            }
        }

        function onScroll() {
            if (!ticking) {
                window.requestAnimationFrame(() => { checkSticky(); ticking = false; });
                ticking = true;
            }
        }

        // init
        if (document.readyState === 'complete' || document.readyState === 'interactive') {
            recalc();
            checkSticky();
        } else {
            document.addEventListener('DOMContentLoaded', () => { recalc(); checkSticky(); });
        }

        window.addEventListener('scroll', onScroll, { passive: true });
        window.addEventListener('resize', () => { recalc(); checkSticky(); });
        // Expose a test runner to automate scroll + transition checks
        window.runSearchTransitionTests = async function runSearchTransitionTests() {
            try {
                const logs = [];
                const log = (msg) => { console.log('[search-test]', msg); logs.push(msg); appendLog(msg); };
                function appendLog(msg) {
                    try {
                        let panel = document.getElementById('search-test-panel');
                        if (!panel) {
                            panel = document.createElement('div');
                            panel.id = 'search-test-panel';
                            panel.style.position = 'fixed';
                            panel.style.right = '8px';
                            panel.style.top = '8px';
                            panel.style.maxWidth = '360px';
                            panel.style.zIndex = 99999;
                            panel.style.background = 'rgba(0,0,0,0.65)';
                            panel.style.color = 'white';
                            panel.style.fontSize = '12px';
                            panel.style.padding = '8px';
                            panel.style.borderRadius = '6px';
                            panel.style.maxHeight = '60vh';
                            panel.style.overflow = 'auto';
                            document.body.appendChild(panel);
                        }
                        const el = document.createElement('div');
                        el.textContent = msg;
                        panel.appendChild(el);
                    } catch (e) { /* ignore */ }
                }

                const header = document.querySelector('header.navbar');
                const hc = document.querySelector('.header-content');
                const searchHost = document.querySelector('.search-bar');
                if (!searchHost) { log('search-bar not found'); return; }

                const measure = (label) => {
                    const r = searchHost.getBoundingClientRect();
                    const hr = header ? header.getBoundingClientRect() : null;
                    const hcr = hc ? hc.getBoundingClientRect() : null;
                    log(`${label} => search: left=${Math.round(r.left)} top=${Math.round(r.top)} w=${Math.round(r.width)} h=${Math.round(r.height)}`);
                    if (hr) log(`${label} => header: left=${Math.round(hr.left)} top=${Math.round(hr.top)} w=${Math.round(hr.width)} h=${Math.round(hr.height)}`);
                    if (hcr) log(`${label} => header-content: left=${Math.round(hcr.left)} top=${Math.round(hcr.top)} w=${Math.round(hcr.width)} h=${Math.round(hcr.height)}`);
                };

                function waitTransition(el, propRegex, timeout = 1000) {
                    return new Promise((resolve) => {
                        let done = false;
                        function onEnd(e) {
                            if (propRegex && !propRegex.test(e.propertyName)) return;
                            if (done) return;
                            done = true;
                            el.removeEventListener('transitionend', onEnd);
                            resolve(true);
                        }
                        el.addEventListener('transitionend', onEnd);
                        setTimeout(() => { if (!done) { done = true; try { el.removeEventListener('transitionend', onEnd); } catch (e) {} resolve(false); } }, timeout);
                    });
                }

                // ensure initial
                window.scrollTo({ top: 0, behavior: 'auto' });
                await new Promise(r => setTimeout(r, 120));
                recalc();
                measure('initial');

                // scroll to trigger sticky
                const headerHeight = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--header-height')) || 56;
                // compute target slightly past the threshold so condition becomes true
                const target = Math.max(0, (initialTop || 0) - headerHeight - 2);
                log('scroll to trigger sticky at ' + target + ' (initialTop=' + initialTop + ')');
                window.scrollTo({ top: Math.max(0, target + 4), behavior: 'smooth' });
                // wait a bit for scrolling
                await new Promise(r => setTimeout(r, 450));
                // wait for the host transition (left/top/width)
                await waitTransition(searchHost, /(left|top|width)/, 800);
                await new Promise(r => setTimeout(r, 80));
                measure('after-sticky');

                // also expand inner widget if present (check that it expanded)
                const inner = searchHost.querySelector('aws-search, .aws-search');
                if (inner) {
                    const widget = inner.shadowRoot ? inner.shadowRoot.querySelector('.widget-search') : inner.querySelector('.widget-search');
                    if (widget) log('inner widget style after sticky: ' + (widget.getAttribute('style') || '').slice(0,200));
                }

                // scroll back up
                log('scroll back to top');
                window.scrollTo({ top: 0, behavior: 'smooth' });
                await new Promise(r => setTimeout(r, 450));
                await waitTransition(searchHost, /(left|top|width)/, 800);
                await new Promise(r => setTimeout(r, 80));
                measure('after-unsticky');

                log('test complete');

                // Try to POST logs to a local endpoint for automated collection
                try {
                    await fetch('/search-test-log', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ time: new Date().toISOString(), logs })
                    });
                    log('logs posted to /search-test-log');
                } catch (e) {
                    log('post to /search-test-log failed: ' + (e && e.message));
                    // create downloadable log file as fallback
                    try {
                        const blob = new Blob([logs.join('\n')], { type: 'text/plain' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = 'search-test-log-' + Date.now() + '.txt';
                        a.textContent = 'Download search-test log';
                        a.style.display = 'inline-block';
                        a.style.marginTop = '8px';
                        a.style.color = '#fff';
                        a.style.textDecoration = 'underline';
                        const panel = document.getElementById('search-test-panel');
                        if (panel) panel.appendChild(a);
                        log('download link created');
                    } catch (ee) { log('failed to create download link: ' + ee.message); }
                }
            } catch (e) { console.error('runSearchTransitionTests error', e); }
        };
    } catch (e) {
        console.debug('initStickySearch failed', e);
    }
})();

// Simple HTML-escape helper to avoid breaking attributes
function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str).replace(/[&<>"]/g, function (s) {
        switch (s) {
            case '&': return '&amp;';
            case '<': return '&lt;';
            case '>': return '&gt;';
            case '"': return '&quot;';
            default: return s;
        }
    });
}

// Handle chained favicon fallbacks: first altSrc, then fallbackSrc, then hide
try {
    if (typeof window !== 'undefined') {
        // default inline SVG favicon (used as final fallback)
        const _defaultFavicon = `data:image/svg+xml;utf8,` + encodeURIComponent(
            `<svg xmlns='http://www.w3.org/2000/svg' width='64' height='64' viewBox='0 0 64 64'>` +
            `<rect width='100%' height='100%' fill='%236c757d' rx='8'/>` +
            `<text x='50%' y='50%' dy='.35em' text-anchor='middle' fill='white' font-family='Arial' font-size='28'>SP</text>` +
            `</svg>`
        );

        window.handleFaviconError = function (img, altSrc, fallbackSrc) {
            try {
                const state = img.dataset._fav_retry || '';
                if (state === '') {
                    img.dataset._fav_retry = 'alt';
                    img.src = altSrc;
                    return;
                }
                if (state === 'alt') {
                    img.dataset._fav_retry = 'proxy';
                    img.src = fallbackSrc;
                    return;
                }
                // final fallback: use embedded default svg
                img.dataset._fav_retry = 'done';
                img.onerror = null;
                img.src = _defaultFavicon;
                return;
            } catch (e) {
                try { img.onerror = null; img.src = _defaultFavicon; } catch (ee) {}
            }
        };
    }
} catch (e) {}
