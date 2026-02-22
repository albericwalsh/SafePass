// utils.js - helper utilities for SafePass content script

function isVisible(el) {
    if (!el) return false;
    const style = getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden' || el.disabled) return false;
    if (el.offsetWidth > 0 || el.offsetHeight > 0) return true;
    if (el.getClientRects && el.getClientRects().length) return true;
    return false;
}

function getAssociatedLabelText(el) {
    if (!el) return null;
    try {
        const aria = el.getAttribute && el.getAttribute('aria-labelledby');
        if (aria) {
            return aria.split(/\s+/).map(id => (document.getElementById(id) || {}).textContent || '').join(' ').trim();
        }
        if (el.id) {
            const lab = document.querySelector(`label[for="${el.id}"]`);
            if (lab) return lab.textContent.trim();
        }
        const wrap = el.closest && el.closest('label');
        if (wrap) return wrap.textContent.trim();
        let prev = el.previousElementSibling;
        if (prev && /label|span|div/i.test(prev.tagName || '')) {
            const txt = prev.textContent.trim();
            if (txt) return txt;
        }
        const ariaLabel = el.getAttribute && el.getAttribute('aria-label');
        if (ariaLabel) return ariaLabel.trim();
    } catch (e) {}
    return null;
}

function getElementDescriptor(el) {
    if (!el) return null;
    return {
        tag: el.tagName,
        type: el.type,
        id: el.id || null,
        name: el.name || null,
        label: getAssociatedLabelText(el),
        placeholder: el.placeholder || null,
        classes: el.className || null,
        outer: (el.outerHTML || '').slice(0, 200)
    };
}

function* iterateRoots(root=document) {
    yield root;
    const nodes = root.querySelectorAll('*');
    for (const node of nodes) {
        if (node.shadowRoot) yield* iterateRoots(node.shadowRoot);
    }
}

function findAllInputs() {
    const list = [];
    for (const r of iterateRoots(document)) {
        try {
            r.querySelectorAll && r.querySelectorAll('input,textarea,select').forEach(el => list.push(el));
        } catch (e) {}
    }
    return list;
}

function findPasswordElements() {
    const list = findAllInputs().filter(el => el.tagName === 'INPUT' && el.type === 'password' && isVisible(el));
    try {
        console.info('SafePass: password field detection', { url: window.location.href, count: list.length });
        list.forEach(el => console.info('SafePass: password element', getElementDescriptor(el), el));
    } catch(e) {}
    return list;
}

function scoreUsernameCandidate(el, urlLower) {
    if (!el || el.tagName !== 'INPUT') return -1;
    if (el.type !== 'text' && el.type !== 'email' && el.type !== 'search') return -1;
    if (!isVisible(el)) return -1;
    let score = 0;
    const name = (el.name||'') + ' ' + (el.id||'') + ' ' + (el.placeholder||'') + ' ' + (el.getAttribute('aria-label')||'') + ' ' + (getAssociatedLabelText(el)||'');
    if (/user|email|login|identif|mail|courriel|username/i.test(name)) score += 50;
    try {
        const labText = (getAssociatedLabelText(el) || '');
        if (labText && /user|email|login|identif|mail|courriel|username/i.test(labText)) score += 40;
    } catch (e) {}
    if (el.form) score += 10;
    try { score -= el.getBoundingClientRect().top/1000; } catch(e) {}
    if (urlLower && /@/.test(urlLower) && el.type === 'email') score += 20;
    return score;
}

function isLikelyRegistration(el) {
    if (!el) return false;
    const text = ((el.name||'') + ' ' + (el.id||'') + ' ' + (el.placeholder||'') + ' ' + (el.getAttribute('aria-label')||'') + ' ' + (el.className||'')).toLowerCase();
    if (/(confirm|confirmation|signup|register|create|new|inscription|retype|repeat|again|verify|confirm_password|password_confirm)/i.test(text)) return true;
    try {
        const labText = getAssociatedLabelText(el);
        if (labText && /(confirm|inscription|register|signup|create|confirmation)/i.test(labText)) return true;
    } catch(e) {}
    try {
        const sibTxt = (el.closest && el.closest('form') && el.closest('form').textContent) || '';
        if (/(create account|sign up|inscription|register|new account)/i.test(sibTxt)) return true;
    } catch(e) {}
    return false;
}

function getUsernameCandidates(passwordEl) {
    const urlLower = window.location.href.toLowerCase();
    let candidates = [];
    try {
        const form = passwordEl && (passwordEl.form || (passwordEl.closest && passwordEl.closest('form')));
        if (form) {
            candidates = Array.from(form.querySelectorAll('input[type="text"],input[type="email"],input:not([type])')).filter(isVisible);
        }
    } catch(e) { candidates = []; }
    if (!candidates || candidates.length === 0) {
        candidates = findAllInputs().filter(el => (el.tagName==='INPUT') && (el.type==='text' || el.type==='email' || el.type==='search' || !el.type) && isVisible(el));
    }
    candidates.sort((a,b)=>{
        const baseA = scoreUsernameCandidate(a,urlLower);
        const baseB = scoreUsernameCandidate(b,urlLower);
        const regA = isLikelyRegistration(a) ? -1000 : 0;
        const regB = isLikelyRegistration(b) ? -1000 : 0;
        let proxA = 0, proxB = 0;
        try {
            if (passwordEl) {
                const passTop = passwordEl.getBoundingClientRect().top;
                const aTop = a.getBoundingClientRect().top;
                const bTop = b.getBoundingClientRect().top;
                const distA = Math.abs(passTop - aTop);
                const distB = Math.abs(passTop - bTop);
                proxA = (aTop < passTop ? 200 : 0) - distA/5;
                proxB = (bTop < passTop ? 200 : 0) - distB/5;
            }
        } catch(e) {}
        return (baseB + regB + proxB) - (baseA + regA + proxA);
    });
    try { console.info('SafePass: username candidates', candidates.map(getElementDescriptor)); } catch(e) {}
    return candidates;
}

function findBestUsername(passwordEl) {
    const urlLower = window.location.href.toLowerCase();
    let candidates = [];
    const form = passwordEl && (passwordEl.form || (passwordEl.closest && passwordEl.closest('form')));
    if (form) {
        candidates = Array.from(form.querySelectorAll('input[type="text"],input[type="email"],input:not([type])')).filter(isVisible);
        if (candidates.length) {
            candidates.sort((a,b)=>{
                const baseA = scoreUsernameCandidate(a,urlLower);
                const baseB = scoreUsernameCandidate(b,urlLower);
                const regA = isLikelyRegistration(a) ? -1000 : 0;
                const regB = isLikelyRegistration(b) ? -1000 : 0;
                let proxA = 0, proxB = 0;
                try {
                    if (passwordEl) {
                        const passTop = passwordEl.getBoundingClientRect().top;
                        const aTop = a.getBoundingClientRect().top;
                        const bTop = b.getBoundingClientRect().top;
                        const distA = Math.abs(passTop - aTop);
                        const distB = Math.abs(passTop - bTop);
                        proxA = (aTop < passTop ? 200 : 0) - distA/5;
                        proxB = (bTop < passTop ? 200 : 0) - distB/5;
                    }
                } catch(e) {}
                return (baseB + regB + proxB) - (baseA + regA + proxA);
            });
            console.info('SafePass: chosen username (form)', getElementDescriptor(candidates[0]));
            return candidates[0];
        }
    }
    candidates = findAllInputs().filter(el => (el.tagName==='INPUT') && (el.type==='text' || el.type==='email' || el.type==='search' || !el.type) && isVisible(el));
    if (candidates.length === 0) return null;
    candidates.sort((a,b)=>{
        const baseA = scoreUsernameCandidate(a,urlLower);
        const baseB = scoreUsernameCandidate(b,urlLower);
        const regA = isLikelyRegistration(a) ? -1000 : 0;
        const regB = isLikelyRegistration(b) ? -1000 : 0;
        let proxA = 0, proxB = 0;
        try {
            if (passwordEl) {
                const passTop = passwordEl.getBoundingClientRect().top;
                const aTop = a.getBoundingClientRect().top;
                const bTop = b.getBoundingClientRect().top;
                const distA = Math.abs(passTop - aTop);
                const distB = Math.abs(passTop - bTop);
                proxA = (aTop < passTop ? 200 : 0) - distA/5;
                proxB = (bTop < passTop ? 200 : 0) - distB/5;
            }
        } catch(e) {}
        return (baseB + regB + proxB) - (baseA + regA + proxA);
    });
    console.info('SafePass: chosen username (global)', getElementDescriptor(candidates[0]));
    return candidates[0];
}

function setNativeValue(el, value) {
    try {
        const proto = Object.getPrototypeOf(el);
        const descriptor = Object.getOwnPropertyDescriptor(proto, 'value');
        if (descriptor && descriptor.set) {
            descriptor.set.call(el, value);
        } else {
            el.value = value;
        }
    } catch (e) {
        el.value = value;
    }
    try {
        try { el.setAttribute('value', value); } catch(e) {}
        let inputEv;
        try {
            inputEv = typeof InputEvent === 'function' ? new InputEvent('input', { bubbles: true, cancelable: true, data: value }) : new Event('input', { bubbles: true });
        } catch (e) {
            inputEv = new Event('input', { bubbles: true });
        }
        el.dispatchEvent(inputEv);
        el.dispatchEvent(new Event('change', { bubbles: true }));
        try { el.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true })); } catch(e) {}
        try { el.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true })); } catch(e) {}
        try { el.dispatchEvent(new KeyboardEvent('keypress', { bubbles: true })); } catch(e) {}
        try { el.dispatchEvent(new Event('blur', { bubbles: true })); } catch(e) {}
    } catch (e) {
        const ev = new Event('input', { bubbles: true });
        el.dispatchEvent(ev);
        el.dispatchEvent(new Event('change', { bubbles: true }));
    }
}
