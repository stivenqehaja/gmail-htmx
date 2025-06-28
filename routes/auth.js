import express from 'express';
import path from 'path';
import qs from 'qs';
import { googleAuth, handleGoogleCallback } from '../services/authService.js';

const router = express.Router();

// Home route
router.get('/', (req, res) => { 
    console.log('>>> Inside GET '/'');
    res.sendFile(path.join(process.cwd(), 'public', 'index.html'));
});

// LOG IN WITH GOOGLE
router.get('/auth/google', (req, res) => {
    console.log('>>> Inside GET /auth/google');
    const redirectUrl = googleAuth();
    res.redirect(redirectUrl);
});

// LOG IN WITH GOOGLE CALLBACK
router.get('/oauth2callback', async(req, res) => { 
    console.log('>>> Inside GET /oauth2callback');
    const code = req.query.code;

    try {
        const userInfo = await handleGoogleCallback(code);
        console.log('USERINFO: ' + JSON.stringify(userInfo));
        req.session.users = req.session.users || {}
        req.session.users[userInfo.email] = userInfo;

        res.redirect('/');

    } catch(err) {
        console.log(err.response?.data || err.message);
        res.status(500).send('Authentication failed');
    }
});

export default router;