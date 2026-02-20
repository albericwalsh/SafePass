document.addEventListener('DOMContentLoaded', function () {
  const content = document.getElementById('content');
  // API base forced to backend port 5000; can be overridden by setting window.SP_API_BASE
  const API_BASE = (typeof window.SP_API_BASE === 'string' && window.SP_API_BASE) ? window.SP_API_BASE : ('http://' + (window.location.hostname || '127.0.0.1') + ':5000');
  const refreshFilesBtn = document.getElementById('refreshFiles');
  const applyFilterBtn = document.getElementById('applyFilter');
  const clearFilterBtn = document.getElementById('clearFilter');
  const fromInput = document.getElementById('from');
  const toInput = document.getElementById('to');

  const POLL_INTERVAL = 5000;
  let last_mtime = 0;
  let pollHandle = null;
  let lines = []; // merged log lines
  let seenIds = new Set();

  function parseLocalInputToTs(val) {
    if (!val) return null;
    const d = new Date(val);
    if (isNaN(d.getTime())) return null;
    return Math.floor(d.getTime()/1000);
  }

  function escHtml(s){ return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

  function highlightLogText(text){
    // escape then simple highlight of levels and timestamps
    let t = escHtml(text);
    // highlight levels
    t = t.replace(/\b(ERROR)\b/g, '<span class="lvl-ERROR">$1</span>');
    t = t.replace(/\b(WARN|WARNING)\b/g, '<span class="lvl-WARN">$1</span>');
    t = t.replace(/\b(INFO)\b/g, '<span class="lvl-INFO">$1</span>');
    t = t.replace(/\b(DEBUG)\b/g, '<span class="lvl-DEBUG">$1</span>');
    // highlight ISO timestamps
    t = t.replace(/(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})/g, '<span class="log-timestamp">$1</span>');
    // transform bracketed elements [xxx] into visual chips, but skip pure date/time brackets
    t = t.replace(/\[([^\]]+)\]/g, function(_, inner){
      const v = inner.trim();
      // ISO datetime or YYYY-MM-DD HH:MM:SS or simple date
      if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(v) || /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(v) || /^\d{4}-\d{2}-\d{2}$/.test(v)){
        // remove bracketed date from inline message (timestamp is shown separately)
        return '';
      }
      return '<span class="bracket">' + escHtml(v) + '</span>';
    });
    return t;
  }

  function makeLogNode(name, mtime, txt){
    // Deprecated per-file node; keep for backward compat but not used in merged view
    const wrapper = document.createElement('div'); wrapper.className = 'log-file';
    const header = document.createElement('div'); header.className = 'log-header';
    const title = document.createElement('div'); title.className = 'log-title'; title.textContent = name;
    const meta = document.createElement('div'); meta.className = 'log-meta'; meta.textContent = new Date(mtime*1000).toLocaleString();
    header.appendChild(title); header.appendChild(meta);
    const body = document.createElement('div'); body.className = 'log-content';
    body.innerHTML = highlightLogText(txt || '');
    wrapper.appendChild(header); wrapper.appendChild(body);
    return wrapper;
  }

  function extractTimestampFromLine(line){
    if(!line) return null;
    // ISO 8601
    let m = line.match(/(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})/);
    if(m) return Math.floor(new Date(m[1]).getTime()/1000);
    // common datetime 'YYYY-MM-DD HH:MM:SS'
    m = line.match(/(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})/);
    if(m) return Math.floor(new Date(m[1].replace(' ', 'T')).getTime()/1000);
    // 'HH:MM:SS' (no date) - skip
    return null;
  }

  function parseFileToLines(fileName, mtime, txt){
    const out = [];
    const rawLines = (txt||'').split(/\r?\n/);
    for(let i=0;i<rawLines.length;i++){
      const text = rawLines[i];
      if(!text || String(text).trim() === '') continue; // skip empty lines
      const id = fileName + ':' + i;
      if(seenIds.has(id)) continue;
      const ts = extractTimestampFromLine(text) || mtime || 0;
      let level = 'INFO';
      const up = text.toUpperCase();
      if(/\bERROR\b/.test(up)) level='ERROR'; else if(/\bWARN\b/.test(up) || /\bWARNING\b/.test(up)) level='WARN'; else if(/\bDEBUG\b/.test(up)) level='DEBUG';
      out.push({id, ts, level, text, file: fileName, mtime});
      seenIds.add(id);
    }
    return out;
  }

  function renderLines(){
    // lines already sorted descending by ts
    content.innerHTML = '';
    // group by day (YYYY-MM-DD) preserving descending order
    const groups = new Map();
    for(const ln of lines){
      const day = new Date(ln.ts*1000).toISOString().slice(0,10);
      if(!groups.has(day)) groups.set(day, []);
      groups.get(day).push(ln);
    }
    // render groups in the order of insertion (lines sorted desc => newest day first)
    for (const [day, dayLines] of groups){
      const dayHeader = document.createElement('div'); dayHeader.className = 'day-header'; dayHeader.textContent = new Date(day+'T00:00:00').toLocaleDateString();
      content.appendChild(dayHeader);
      for(const ln of dayLines){
        const d = document.createElement('div');
        d.className = 'log-line';
        // add full-line level class for background highlighting
        d.classList.add('lvl-' + ln.level + '-line');
        const ts = document.createElement('span'); ts.className='log-timestamp'; ts.textContent = new Date(ln.ts*1000).toLocaleString();
        const txt = document.createElement('span'); txt.className = 'log-content-line ' + ('lvl-' + ln.level);
        // build content DOM safely (avoid double-escaping issues)
        const frag = buildContentFragment(ln.text || '');
        txt.appendChild(frag);
        d.appendChild(ts); d.appendChild(txt);
        content.appendChild(d);
      }
    }
    if(content.firstChild) content.scrollTop = 0;
  }

  function buildContentFragment(raw){
    const frag = document.createDocumentFragment();
    if(!raw) return frag;
    // iterate over bracketed tokens and create chips; skip bracketed dates
    const bracketRe = /\[([^\]]+)\]/g;
    let lastIndex = 0;
    let m;
    while((m = bracketRe.exec(raw)) !== null){
      const before = raw.slice(lastIndex, m.index);
      if(before) appendWithLevelEmphasis(frag, before);
      const inner = m[1].trim();
      const isDate = (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(inner) || /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(inner) || /^\d{4}-\d{2}-\d{2}$/.test(inner));
      if(!isDate){
        const chip = document.createElement('span'); chip.className='bracket'; chip.textContent = inner; frag.appendChild(chip);
      }
      lastIndex = bracketRe.lastIndex;
    }
    const rest = raw.slice(lastIndex);
    if(rest) appendWithLevelEmphasis(frag, rest);
    return frag;
  }

  function appendWithLevelEmphasis(parent, text){
    // split text by level words while preserving separators
    const re = /(ERROR|WARN(?:ING)?|INFO|DEBUG)/ig;
    let last = 0; let m;
    while((m = re.exec(text)) !== null){
      const before = text.slice(last, m.index);
      if(before) parent.appendChild(document.createTextNode(before));
      const span = document.createElement('span');
      const level = m[1].toUpperCase().replace('WARNING','WARN');
      span.className = 'lvl-' + level;
      span.textContent = m[1];
      parent.appendChild(span);
      last = re.lastIndex;
    }
    const tail = text.slice(last);
    if(tail) parent.appendChild(document.createTextNode(tail));
  }

  function ensurePolling() {
    if (pollHandle) return;
    pollHandle = setInterval(async () => {
      try {
        const r = await fetch(API_BASE + '/api/logs/updates?since=' + encodeURIComponent(String(last_mtime)));
        if (!r.ok) return;
        const j = await r.json();
        // support backend wrapper { status, message, data: { files: [...] } }
        const updFiles = (j && Array.isArray(j.files)) ? j.files : (j && j.data && Array.isArray(j.data.files) ? j.data.files : []);
        if (!updFiles || updFiles.length === 0) return;
        // parse and merge lines, then sort and render
        let added = false;
        for (const f of updFiles) {
          const parsed = parseFileToLines(f.name, f.mtime, f.content);
          if (parsed.length) { lines = parsed.concat(lines); added = true; }
          if (f.mtime > last_mtime) last_mtime = f.mtime;
        }
        if (added) {
          // sort by ts desc
          lines.sort((a,b)=>b.ts - a.ts);
          renderLines();
        }
      } catch (e) {
        console.warn('poll error', e);
      }
    }, POLL_INTERVAL);
  }

  async function loadCombined() {
    try {
      // check settings -> only proceed if logging to file is enabled
      try{
        const sres = await fetch(API_BASE + '/settings');
        if (sres && sres.ok){
          const sj = await sres.json();
          const cfg = sj && sj.settings ? sj.settings : (sj || {});
          // default: enabled unless explicitly set to false
          let logEnabled = true;
          // prefer `advanced` section, then legacy `logs`, then `storage`, then top-level legacy
          if (cfg && cfg.advanced && typeof cfg.advanced.to_file !== 'undefined') logEnabled = !!cfg.advanced.to_file;
          else if (cfg && cfg.logs && typeof cfg.logs.to_file !== 'undefined') logEnabled = !!cfg.logs.to_file;
          else if (cfg && cfg.storage && typeof cfg.storage.log_to_file !== 'undefined') logEnabled = !!cfg.storage.log_to_file;
          else if (typeof cfg.log_to_file !== 'undefined') logEnabled = !!cfg.log_to_file;
          if (!logEnabled){
            if(pollHandle){ clearInterval(pollHandle); pollHandle = null; }
            content.textContent = 'La journalisation vers fichier est désactivée.';
            return;
          }
        }
      }catch(e){ /* ignore and proceed: on error keep logging enabled by default */ }
      // get file list to compute last_mtime after applying client filter
      const listResp = await fetch(API_BASE + '/api/logs');
      if (!listResp.ok) throw new Error('Cannot list logs');
      const list = await listResp.json();
      // support backend wrapper { status, message, data: { files: [...] } }
      const rawFiles = (list && Array.isArray(list)) ? list : (list && list.data && Array.isArray(list.data.files) ? list.data.files : []);
      const files = rawFiles.map(f=>({name:f.name,size:f.size,mtime:parseInt(f.mtime,10)||0}));

      const fromTs = parseLocalInputToTs(fromInput.value);
      const toTs = parseLocalInputToTs(toInput.value);

      // compute filtered set
      const filtered = files.filter(f=>{
        if (fromTs !== null && f.mtime < fromTs) return false;
        if (toTs !== null && f.mtime > toTs) return false;
        return true;
      });

      // Clear existing merged lines
      lines = [];
      seenIds.clear();

      // fetch each file and parse into lines
      filtered.sort((a,b)=>b.mtime - a.mtime);
      for (const f of filtered) {
        try {
          const r = await fetch(API_BASE + '/api/logs/' + encodeURIComponent(f.name));
          if (!r.ok) { continue; }
          const txt = await r.text();
          const parsed = parseFileToLines(f.name, f.mtime, txt);
          // merge
          if (parsed.length) lines = lines.concat(parsed);
        } catch(e) { continue; }
      }
      // sort by timestamp desc
      lines.sort((a,b)=>b.ts - a.ts);
      // update last_mtime
      if (filtered.length) last_mtime = Math.max(...filtered.map(f=>f.mtime)); else last_mtime = 0;
      renderLines();
      // ensure polling runs
      ensurePolling();
    } catch (e) {
      content.textContent = 'Erreur: ' + e.message;
    }
  }

  refreshFilesBtn.addEventListener('click', loadCombined);
  applyFilterBtn.addEventListener('click', loadCombined);
  clearFilterBtn.addEventListener('click', function(){ fromInput.value=''; toInput.value=''; loadCombined(); });

  // initial load: combined, then start polling permanently
  loadCombined();
});
