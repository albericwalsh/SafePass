const logEl = (msg) => {
  const el = document.getElementById('logs');
  if (!el) return;
  el.textContent = `${new Date().toISOString()}  ${msg}\n` + el.textContent;
};

const widgetFallback = (key, value) => {
  // Fallback element (native) when aws-widget not available
  const wrap = document.createElement('div');
  wrap.className = 'row';
  const label = document.createElement('label');
  label.textContent = key;
  const input = document.createElement('input');
  input.name = key;
  if (typeof value === 'boolean') input.type = 'checkbox';
  else if (typeof value === 'number') input.type = 'number';
  else input.type = 'text';
  if (typeof value === 'boolean') input.checked = value;
  else input.value = value;
  input.addEventListener('change', () => logEl(`change ${key} -> ${input.type === 'checkbox' ? input.checked : input.value}`));
  wrap.appendChild(label);
  wrap.appendChild(input);
  return wrap;
};

const createWidgetFor = async (key, value) => {
  // map types to aws-widgets where possible
  try {
    if (typeof value === 'boolean') {
      if (customElements.get('aws-bool')) {
        const w = document.createElement('aws-bool');
        w.setAttribute('mode', 'edit');
        w.id = `w-${key}`;
        w.value = !!value;
        w.addEventListener('change', (e) => logEl(`aws-bool ${key} -> ${e.detail?.value}`));
        const wrap = document.createElement('div'); wrap.className = 'row';
        const label = document.createElement('label'); label.textContent = key;
        wrap.appendChild(label); wrap.appendChild(w); return wrap;
      }
      return widgetFallback(key, value);
    }

    if (typeof value === 'number') {
      if (customElements.get('aws-number')) {
        const w = document.createElement('aws-number');
        w.value = value;
        w.addEventListener('change', (e) => logEl(`aws-number ${key} -> ${e.detail?.value}`));
        const wrap = document.createElement('div'); wrap.className = 'row';
        const label = document.createElement('label'); label.textContent = key;
        wrap.appendChild(label); wrap.appendChild(w); return wrap;
      }
      return widgetFallback(key, value);
    }

    // strings
    if (typeof value === 'string') {
      if (customElements.get('aws-text') || customElements.get('aws-input')) {
        const tag = customElements.get('aws-text') ? 'aws-text' : 'aws-input';
        const w = document.createElement(tag);
        w.value = value;
        w.addEventListener('change', (e) => logEl(`${tag} ${key} -> ${e.detail?.value || w.value}`));
        const wrap = document.createElement('div'); wrap.className = 'row';
        const label = document.createElement('label'); label.textContent = key;
        wrap.appendChild(label); wrap.appendChild(w); return wrap;
      }
      return widgetFallback(key, value);
    }

    // fallback for objects/others: display JSON
    const wrap = document.createElement('div'); wrap.className = 'row';
    const label = document.createElement('label'); label.textContent = key;
    const pre = document.createElement('pre'); pre.style.margin = '0'; pre.textContent = JSON.stringify(value);
    wrap.appendChild(label); wrap.appendChild(pre); return wrap;
  } catch (err) {
    logEl(`error creating widget ${key}: ${err}`);
    return widgetFallback(key, value);
  }
};

const buildForm = async (settings) => {
  const form = document.getElementById('form');
  if (!form) return;
  form.innerHTML = '';
  const keys = Object.keys(settings);
  for (const k of keys) {
    const node = await createWidgetFor(k, settings[k]);
    form.appendChild(node);
  }
};

const loadSettings = async () => {
  try {
    const res = await fetch('/data/settings.json');
    if (!res.ok) throw new Error('fetch failed ' + res.status);
    const settings = await res.json();
    logEl('settings loaded');
    await buildForm(settings);
  } catch (err) {
    logEl('loadSettings error: ' + err);
  }
};

window.addEventListener('DOMContentLoaded', async () => {
  // wait a few known widgets, but allow fallbacks
  const known = ['aws-bool','aws-button','aws-text','aws-input','aws-number'];
  const waits = known.map(n => customElements.whenDefined(n).catch(()=>null));
  await Promise.all(waits);
  logEl('customElements readiness awaited (some may be missing)');
  await loadSettings();

  const saveBtn = document.getElementById('saveBtn');
  const reloadBtn = document.getElementById('reloadBtn');
  if (reloadBtn) reloadBtn.addEventListener('click', () => loadSettings());
  if (saveBtn) saveBtn.addEventListener('click', () => logEl('Save clicked — implement persistence as needed'));
});
