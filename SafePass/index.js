const express = require('express');
const app = express();
const port = 3000;

// parse JSON bodies
app.use(express.json());

// simple proxy for backend settings endpoints
const BACKEND = process.env.SAFEPASS_BACKEND || 'http://127.0.0.1:5000';

app.get('/settings', async (req, res) => {
    try {
        const r = await fetch(`${BACKEND}/settings`);
        const text = await r.text();
        res.status(r.status);
        const ct = r.headers.get('content-type'); if (ct) res.set('content-type', ct);
        return res.send(text);
    } catch (e) { return res.status(502).send('backend unavailable'); }
});

app.post('/settings', async (req, res) => {
    try {
        const r = await fetch(`${BACKEND}/settings`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(req.body) });
        const text = await r.text();
        res.status(r.status);
        const ct = r.headers.get('content-type'); if (ct) res.set('content-type', ct);
        return res.send(text);
    } catch (e) { return res.status(502).send('backend unavailable'); }
});

app.use(express.static('public'));

app.listen(port, () => {
    console.log(`Serveur démarré sur http://localhost:${port}`);
});
