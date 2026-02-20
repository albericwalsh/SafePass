// Clean, robust saving/loading helpers with auth prompt when needed.
/* global $ window document fetch localStorage Blob URL */

function promptForMasterPassword() {
	return new Promise((resolve) => {
		try {
			const modal = document.createElement('div');
			modal.style.cssText = 'position:fixed;left:0;top:0;right:0;bottom:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.5);z-index:9999;';
			modal.innerHTML = `
				<div style="background:#fff;padding:18px;border-radius:8px;min-width:320px;max-width:420px;box-shadow:0 8px 24px rgba(0,0,0,0.2);">
					<div style="font-weight:600;margin-bottom:8px;">Authentification requise</div>
					<aws-input id="sp-master-password-input" type="password" placeholder="Mot de passe maître"></aws-input>
					<div style="display:flex;justify-content:flex-end;margin-top:12px;gap:8px;">
						<aws-button id="sp-auth-cancel" variant="secondary">Annuler</aws-button>
						<aws-button id="sp-auth-submit" variant="primary">Valider</aws-button>
					</div>
					<div id="sp-auth-error" style="color:#b00020;margin-top:8px;display:none;font-size:0.9em;"></div>
				</div>
			`;
			document.body.appendChild(modal);
			const input = modal.querySelector('#sp-master-password-input');
			const cancel = modal.querySelector('#sp-auth-cancel');
			const submit = modal.querySelector('#sp-auth-submit');
			const err = modal.querySelector('#sp-auth-error');

			function cleanup() { try { modal.remove(); } catch (e) {} }

			cancel.addEventListener('click', () => { cleanup(); resolve(null); });

			submit.addEventListener('click', () => {
				const val = (input && ('value' in input)) ? input.value : (input && input.getAttribute ? input.getAttribute('value') : '') || '';
				fetch('http://127.0.0.1:5000/auth/unlock', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: val }) })
					.then(res => res.json().then(j => ({ ok: res.ok, status: res.status, body: j })))
					.then(result => {
						if (result && result.body && result.body.status === 'ok' && result.body.token) {
							try { const session = { token: result.body.token, expires_at: result.body.expires_at || null }; localStorage.setItem('sp_auth_session', JSON.stringify(session)); } catch (e) {}
							cleanup();
							resolve(result.body.token);
						} else {
							err.style.display = 'block';
							err.textContent = (result && result.body && result.body.message) ? result.body.message : 'Mot de passe incorrect';
						}
					}).catch(() => { err.style.display = 'block'; err.textContent = 'Erreur de connexion'; });
			});

			setTimeout(() => { try { const el = input && input.shadowRoot && input.shadowRoot.querySelector('input'); if (el) el.focus(); } catch (e) {} }, 50);
		} catch (e) { console.error('promptForMasterPassword error', e); resolve(null); }
	});
}

function ensureAuthToken(promptIfMissing = true) {
	return new Promise((resolve) => {
		try {
			const existingRaw = (typeof localStorage !== 'undefined') ? localStorage.getItem('sp_auth_session') : null;
			if (existingRaw) {
				try {
					const sess = JSON.parse(existingRaw);
					if (sess && sess.token) {
						if (sess.expires_at) {
							const now = Date.now();
							const exp = Date.parse(sess.expires_at);
							if (!isNaN(exp) && exp > now) return resolve(sess.token);
							try { localStorage.removeItem('sp_auth_session'); } catch (e) {}
						} else {
							return resolve(sess.token);
						}
					}
				} catch (e) { try{ localStorage.removeItem('sp_auth_session'); }catch(_){} }
			}
			// check UI control value first
			try {
				if (window.SP_params && typeof window.SP_params.getVal === 'function') {
					const val = window.SP_params.getVal('security-master_password_enabled');
					if (val === false || val === 'false' || val === 0) return resolve(null);
				}
			} catch (e) {}
			if (!promptIfMissing) return resolve(null);
			promptForMasterPassword().then(token => resolve(token));
		} catch (e) { console.error('ensureAuthToken error', e); resolve(null); }
	});
}

function saveAllData() {
	try {
		console.log('Data saved:', allData);
		ensureAuthToken().then(function(token) {
			$.ajax({
				url: 'http://127.0.0.1:5000/saveData',
				type: 'POST',
				data: JSON.stringify(allData),
				contentType: 'application/json; charset=utf-8',
				dataType: 'json',
				beforeSend: function(xhr) { if (token) xhr.setRequestHeader('X-Auth-Token', token); },
				success: function() { console.log('Sauvegarde OK'); loadAllData(); },
				error: function(err) { console.error('Échec de la sauvegarde des données: ', err); }
			});
		});
	} catch (e) { console.error('Error saving data', e); }
}

function loadAllData() {
	try {
		ensureAuthToken().then(function(token) {
			$.ajax({
				url: 'http://127.0.0.1:5000/getData',
				type: 'GET',
				dataType: 'json',
				beforeSend: function(xhr) { if (token) xhr.setRequestHeader('X-Auth-Token', token); },
				success: function(response) {
					try {
						if (response && response.status === 'success') {
							if (Array.isArray(response.data)) allData = response.data;
							else if (response.data && typeof response.data === 'object') allData = [response.data];
							else allData = [{ sites: [], applications: [], autres: [] }];
						} else {
							allData = [{ sites: [], applications: [], autres: [] }];
						}
						displayCategory(currentCategory);
					} catch (e) { console.error('loadAllData success handler error', e); }
				},
				error: function(error) {
					if (error && error.status === 401) {
						ensureAuthToken(true).then(function(newToken){ if (newToken) loadAllData(); else showAlertMessage('Authentification requise', '--sp-error'); });
						return;
					}
					console.error('Erreur lors du chargement des données:', error);
					let STATUS = error && error.status ? error.status : 'Erreur inconnue';
					if (error && error.status === 0) STATUS = 'Erreur de connexion';
					showAlertMessage('Erreur lors du chargement des données: ' + STATUS, '--sp-error');
				}
			});
		});
	} catch (e) { console.error('Erreur lors du chargement des données', e); }
}

function decryptData(Data) {
	try {
		ensureAuthToken().then(function(token) {
			$.ajax({
				url: 'http://127.0.0.1:5000/decryptData',
				type: 'GET',
				data: { data: Data },
				dataType: 'json',
				beforeSend: function(xhr) { if (token) xhr.setRequestHeader('X-Auth-Token', token); },
				success: function(data) {
					try {
						const isValidStructure = validateDataStructure(data);
						if (!isValidStructure) throw new Error('La structure des données ne correspond pas au format attendu.');
						addToData(data);
						saveAllData();
						displayCategory(currentCategory);
					} catch (e) { console.error('decryptData success handler error', e); }
				},
				error: function(error) { console.error('Erreur lors du chargement des données:', error); }
			});
		});
	} catch (e) { console.error('Erreur lors du chargement des données', e); showAlertMessage('Erreur lors du chargement des données: ' + e, '--sp-error'); return null; }
}

function cryptData(Data) {
	try {
		Data = JSON.stringify(Data);
		ensureAuthToken().then(function(token) {
			$.ajax({
				url: 'http://127.0.0.1:5000/cryptData',
				type: 'GET',
				data: { data: Data },
				beforeSend: function(xhr) { if (token) xhr.setRequestHeader('X-Auth-Token', token); },
				success: function(data) {
					try {
						const dataStr = data;
						const blob = new Blob([dataStr], { type: 'application/sfpss' });
						const url = URL.createObjectURL(blob);
						const a = document.createElement('a'); a.href = url; a.download = 'data_export.sfpss'; document.body.appendChild(a); a.click(); URL.revokeObjectURL(url); a.remove();
					} catch (e) { console.error('cryptData success handler error', e); }
				},
				error: function(error) { console.error('Erreur lors du chargement des données:', error); }
			});
		});
	} catch (e) { console.error('Erreur lors du chargement des données', e); showAlertMessage('Erreur lors du chargement des données: ' + e, '--sp-error'); return null; }
}

