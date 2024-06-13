const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();

app.use('/api', createProxyMiddleware({
    target: 'http://127.0.0.1:5000',
    changeOrigin: true,
    pathRewrite: {
        '^/api': ''
    },
    onProxyRes: function (proxyRes, req, res) {
        proxyRes.headers['Access-Control-Allow-Origin'] = '*';
    }
}));

app.listen(3000, () => {
    console.log('Proxy server is running on http://localhost:3000');
});