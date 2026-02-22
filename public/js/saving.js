// Clean, robust saving/loading helpers with auth prompt when needed.
/* global $ window document fetch localStorage Blob URL */

function promptForMasterPassword() {
	return new Promise((resolve) => {
		try {
			// If master password is disabled in settings, do not prompt
			try {
				if (window.SP_params && typeof window.SP_params.getVal === 'function') {
					const val = window.SP_params.getVal('security-master_password_enabled');
					if (val === false || val === 'false' || val === 0) return resolve('__MASTER_DISABLED__');
				}
			} catch (e) {}

			const modal = document.createElement('div');
			// use app styles
			modal.className = 'backdrop';
			modal.innerHTML =
				'<div class="upper-center-window" role="dialog" aria-modal="true">' +
				'<div style="font-weight:700;margin-bottom:8px;font-size:16px;">' + ((window.t && window.t('auth_required_title')) || 'Authentification requise') + '</div>' +
				'<div style="margin-bottom:8px;color:var(--sp-light);font-size:13px;">' + ((window.t && window.t('auth_required_message')) || 'Saisissez le mot de passe maître pour déverrouiller les données.') + '</div>' +
				'<aws-input id="sp-master-password-input" type="password" placeholder="' + ((window.t && window.t('master_password_placeholder')) || 'Mot de passe maître') + '" style="width:100%;"></aws-input>' +
				'<div style="display:flex;justify-content:flex-end;margin-top:12px;gap:8px;">' +
				'<aws-button id="sp-auth-cancel" variant="secondary">' + ((window.t && window.t('cancel')) || 'Annuler') + '</aws-button>' +
				'<aws-button id="sp-auth-submit" variant="primary">' + ((window.t && window.t('confirm')) || 'Valider') + '</aws-button>' +
				'</div>' +
				'<div id="sp-auth-error" style="color:var(--sp-error);margin-top:8px;display:none;font-size:0.95em;"></div>' +
				'</div>';
			document.body.appendChild(modal);
			const input = modal.querySelector('#sp-master-password-input');
			const cancel = modal.querySelector('#sp-auth-cancel');
			const submit = modal.querySelector('#sp-auth-submit');
			const err = modal.querySelector('#sp-auth-error');

			function cleanup() { try { modal.remove(); } catch (e) {} }

			cancel.addEventListener('click', () => { cleanup(); resolve(null); });

			function readInputValue(){
				try{
					if (!input) return '';
					if (input.shadowRoot) {
						const real = input.shadowRoot.querySelector('input');
						if (real) return real.value || '';
					}
					if ('value' in input && input.value !== undefined) return input.value || '';
					const attr = input.getAttribute && input.getAttribute('value');
					return attr || '';
				}catch(e){return ''}
			}

			submit.addEventListener('click', () => {
				const val = readInputValue();
				fetch('http://127.0.0.1:5000/auth/unlock', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: val }) })
					.then(res => res.json().then(j => ({ ok: res.ok, status: res.status, body: j })))
					.then(result => {
												if (result && result.body && result.body.status === 'ok') {
							if (result.body.token) {
								try { 
									const session = { token: result.body.token, expires_at: result.body.expires_at || null };
									localStorage.setItem('sp_auth_session', JSON.stringify(session));
								} catch (e) {}
								cleanup();
								resolve(result.body.token);
								return;
							}
							// backend acknowledges unlock but returned no token (master disabled)
							cleanup();
							resolve('__MASTER_DISABLED__');
							return;
						}
						// unauthorized from server -> show message
						err.style.display = 'block';
						err.textContent = (result && result.body && (result.body.error || result.body.message)) ? (result.body.error || result.body.message) : 'Mot de passe incorrect';
						// do not resolve; allow user to retry or cancel
					}).catch(() => { err.style.display = 'block'; err.textContent = (window.t && window.t('network_error')) || 'Erreur de connexion'; });
			});

			// allow Enter to submit
			setTimeout(() => { try { const el = input && input.shadowRoot && input.shadowRoot.querySelector('input'); if (el) { el.focus(); el.addEventListener('keydown', (ev)=>{ if(ev.key === 'Enter'){ ev.preventDefault(); submit.click(); } }); } } catch (e) {} }, 50);
		} catch (e) { console.error('promptForMasterPassword error', e); resolve(null); }
	});
}

function ensureAuthToken(promptIfMissing = true) {
	return new Promise((resolve) => {
		try {
			const readMasterEnabled = function(settingsPayload){
				try {
					const root = (settingsPayload && settingsPayload.settings) ? settingsPayload.settings : (settingsPayload || {});
					const sec = (root && root.security && typeof root.security === 'object') ? root.security : {};
					if (typeof sec.master_password_enabled !== 'undefined') return !!sec.master_password_enabled;
					if (typeof root.master_password_enabled !== 'undefined') return !!root.master_password_enabled;
				} catch (e) {}
				return null;
			};

			const existingRaw = (typeof localStorage !== 'undefined') ? localStorage.getItem('sp_auth_session') : null;
			if (existingRaw) {
				try {
					const sess = JSON.parse(existingRaw);
					if (sess && sess.token) {
						if (sess.expires_at) {
							const now = Date.now();
							const exp = Date.parse(sess.expires_at);
							if (!isNaN(exp) && exp > now) return resolve(sess.token);
							// expired
							try { localStorage.removeItem('sp_auth_session'); } catch (e) {}
						} else {
							// no expiry provided, accept token
							return resolve(sess.token);
						}
					}
				} catch (e) { try{ localStorage.removeItem('sp_auth_session'); }catch(_){} }
			}
			// check UI control value first
			try {
				if (window.SP_params && typeof window.SP_params.getVal === 'function') {
					const val = window.SP_params.getVal('security-master_password_enabled');
					if (val === false || val === 'false' || val === 0) return resolve('__MASTER_DISABLED__');
				} else {
					// fallback: fetch settings endpoint to determine master flag
					if (typeof fetch === 'function') {
						fetch('/settings', { cache: 'no-store' }).then(function(r){
							return r.ok ? r.json() : null;
						}).then(function(j){
							try {
								const enabled = readMasterEnabled(j);
									if (enabled === false) return resolve('__MASTER_DISABLED__');
								  if (!promptIfMissing) return resolve(null);
								  promptForMasterPassword().then(token => resolve(token));
							} catch (e) {
								// if parsing fails, fallback to prompting
								if (!promptIfMissing) return resolve(null);
								promptForMasterPassword().then(token => resolve(token));
							}
						}).catch(function(){
							// on error, fallback to prompting
							if (!promptIfMissing) return resolve(null);
							promptForMasterPassword().then(token => resolve(token));
						});
						return;
					}
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
			if (token === null) { showAlertMessage('Authentification annulée', '--sp-warning'); return; }
			const headerToken = (token === '__MASTER_DISABLED__') ? null : token;
			$.ajax({
				url: 'http://127.0.0.1:5000/saveData',
				type: 'POST',
				data: JSON.stringify(allData),
				contentType: 'application/json; charset=utf-8',
				dataType: 'json',
				beforeSend: function(xhr) { if (headerToken) xhr.setRequestHeader('X-Auth-Token', headerToken); },
				success: function() { console.log('Sauvegarde OK'); loadAllData(); },
				error: function(err) { console.error('Échec de la sauvegarde des données: ', err); }
			});
		});
	} catch (e) { console.error('Error saving data', e); }
}

function loadAllData() {
	try {
		if (window.SP_loadAllData_inflight) return;
		const runGetData = function(){
			window.SP_loadAllData_inflight = true;
			ensureAuthToken().then(function(token) {
			if (token === null) { showAlertMessage('Authentification annulée', '--sp-warning'); return; }
			const headerToken = (token === '__MASTER_DISABLED__') ? null : token;
			$.ajax({
				url: 'http://127.0.0.1:5000/getData',
				type: 'GET',
				dataType: 'json',
				beforeSend: function(xhr) { if (headerToken) xhr.setRequestHeader('X-Auth-Token', headerToken); },
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
					finally { window.SP_loadAllData_inflight = false; }
				},
				error: function(error) {
					if (error && error.status === 401) {
						try { localStorage.removeItem('sp_auth_session'); } catch (e) {}
						if (window.SP_loadAllData_retrying_auth) {
							window.SP_loadAllData_inflight = false;
							return;
						}
						window.SP_loadAllData_retrying_auth = true;
						ensureAuthToken(true).then(function(newToken){
							window.SP_loadAllData_retrying_auth = false;
							window.SP_loadAllData_inflight = false;
							if (newToken) loadAllData(); else showAlertMessage('Authentification requise', '--sp-error');
						});
						return;
					}
					console.error('Erreur lors du chargement des données:', error);
					let STATUS = error && error.status ? error.status : 'Erreur inconnue';
					if (error && error.status === 0) STATUS = 'Erreur de connexion';
					showAlertMessage('Erreur lors du chargement des données: ' + STATUS, '--sp-error');
					window.SP_loadAllData_inflight = false;
				}
			});
			}).catch(function(){ window.SP_loadAllData_inflight = false; });
		};

		if (window.SP_storageReadyPromise && typeof window.SP_storageReadyPromise.then === 'function') {
			window.SP_storageReadyPromise
				.then(function(isReady){
					if (!isReady) return;
					runGetData();
				})
				.catch(function(){
					// fallback: do nothing to avoid hammering getData when startup state is unknown
				});
			return;
		}

		runGetData();
	} catch (e) { console.error('Erreur lors du chargement des données', e); }
}

function decryptData(Data) {
	try {
		ensureAuthToken().then(function(token) {
			if (token === null) { showAlertMessage('Authentification annulée', '--sp-warning'); return null; }
			const headerToken = (token === '__MASTER_DISABLED__') ? null : token;
			$.ajax({
				url: 'http://127.0.0.1:5000/decryptData',
				type: 'GET',
				data: { data: Data },
				dataType: 'json',
				beforeSend: function(xhr) { if (headerToken) xhr.setRequestHeader('X-Auth-Token', headerToken); },
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
			if (token === null) { showAlertMessage('Authentification annulée', '--sp-warning'); return null; }
			const headerToken = (token === '__MASTER_DISABLED__') ? null : token;
			$.ajax({
				url: 'http://127.0.0.1:5000/cryptData',
				type: 'GET',
				data: { data: Data },
				beforeSend: function(xhr) { if (headerToken) xhr.setRequestHeader('X-Auth-Token', headerToken); },
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

