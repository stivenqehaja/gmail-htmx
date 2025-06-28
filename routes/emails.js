import express from 'express';
import { refreshTokens, fetchAllEmails } from '../services/emailService.js';
import { renderAccountList } from '../utils/htmlRenderers.js';

const router = express.Router();

router.get('/AccountList', async (req, res) => {
    console.log('>>> Inside GET /AccountList');
    req.session.users = req.session.users || {};
    const users = req.session.users;
    
    if(Object.keys(users).length === 0) {
        console.log('No users found');
        return;
    }

    try {
        const refreshedUsers = await refreshTokens(users);
        req.session.users = refreshedUsers;
        console.log(`Refresh Users${refreshedUsers}`);
        
        const userListHtml = renderAccountList(refreshedUsers);
        res.send(userListHtml);
    } catch(err) {
        console.log('Failed to refresh tokens:', err);
        return res.redirect('/auth/google');
    }
});

router.get('/GetAllEmails', async (req, res) => {
    console.log('>>> Inside GET /GetAllEmails');
    req.session.users = req.session.users || {};
    const users = req.session.users;
    
    if(Object.keys(users).length === 0) {
        console.log('No users found to fetch emails!');
        return res.send(`<h2>No Users found, please Add an Account</h2>`);
    }

    try {
        const emailTablesHtml = await fetchAllEmails(users);
        res.send(emailTablesHtml);
    } catch(err) {
        console.log('Error fetching emails:', err);
        return res.status(500).send('Could not fetch any emails.');
    }
});

router.get('/GetAllEmails/:emailId', async(req, res) => {
    const email = req.params.emailId;
    console.log(`>>> Inside GET /GetAllEmails/${email}`);
    req.session.users = req.session.users || {};
    const users = req.session.users;
    
    if(Object.keys(users).length === 0) {
        return res.status(401).send('No users authenticated');
    }

    const user = users[email];
    console.log(user);
});

export default router;