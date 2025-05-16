import express from 'express';
import path from 'path';
import axios from 'axios';
import qs from 'qs';
import dotenv from 'dotenv';
import session from 'express-session';
import SQLiteStore from 'connect-sqlite3';

dotenv.config();

const app = express();
const PORT = 5000;


const SQLiteStoreSession = SQLiteStore(session);

// Middleware
app.use(express.static('public'));
app.use(express.json());
app.use(session({
    store: new SQLiteStoreSession({
        db: 'sessions.sqlite',
        dir: './db'
    }),
    secret: process.env.SESSION_SECRET || 'secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        secure: false,
        maxAge: 1000 * 60 * 60 * 24
    }
}));

// Routes
app.get('/', (req, res) => { 

    res.sendFile(path.join(process.cwd(), 'public', 'index.html'));
});

app.get('/auth/google',(req, res) => {
    console.log('>>> Inside /auth/google');
    const redirectUrl = 'https://accounts.google.com/o/oauth2/auth?' + qs.stringify({
        client_id: process.env.GOOGLE_CLIENT_ID,
        redirect_uri: process.env.GOOGLE_REDIRECT_URI,
        response_type: 'code',
        scope: 'openid email profile https://www.googleapis.com/auth/gmail.readonly',
        access_type: 'offline', 
        prompt: 'consent'
    });

    res.redirect(redirectUrl);
});

app.get('/oauth2callback', async(req, res) => { 
    console.log('>>> Inside /oauth2callback');
    const code = req.query.code;

    try {
        console.log('>>> Before /token request');
        const response = await axios.post(
            'https://oauth2.googleapis.com/token',
            qs.stringify({
                code,
                client_id: process.env.GOOGLE_CLIENT_ID,
                client_secret: process.env.GOOGLE_CLIENT_SECRET,
                redirect_uri: process.env.GOOGLE_REDIRECT_URI,
                grant_type: 'authorization_code'
            }),
            {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            }
        );

        const { access_token, refresh_token, expires_in } = response.data;

        const userInfo = await axios.get(
            'https://www.googleapis.com/oauth2/v3/userinfo',{
            headers: {
                Authorization: `Bearer ${access_token}`
            }
        });
        req.session.user = {
            name: userInfo.data.name,
            email: userInfo.data.email,
            access_token,
            refresh_token,
            expires_in: Date.now() + expires_in * 1000
        }

        res.redirect('/');

    }
    catch(err) {
        console.log(err.response?.data || err.message);
        res.status(500).send('Authentication failed');
    }
});

app.get('/profile-data', async (req, res) => {
    console.log('>>> Inside /profile-data request');
    const user = req.session.user;
    
    if(!user) {
        return res.status(401).send('<p>User not authenticated. <a href="/auth/google">Login with Google</a></p>');
    }

    // Refresh Token Logic
    if(Date.now() > user.expires_in) {

        try {
            const tokenResponse = await axios.post(
                'https://oauth2.googleapis.com/token',
                qs.stringify({
                    client_id: process.env.GOOGLE_CLIENT_ID,
                    client_secret: process.env.GOOGLE_CLIENT_SECRET,
                    grant_type: 'refresh_token',
                    refresh_token: user.refresh_token
                }),
                {
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
                }
            );

            user.access_token = tokenResponse.data.access_token;
            user.expires_in = Date.now() + tokenResponse.data.expires_in * 1000;
            req.session.user = user;


        } catch(err) {
            console.log('Failed to refresh token:', err.response?.data || err.message);
            return res.redirect('/auth/google');
        }

    }
    res.send(`
        <h1>Login Successful</h1>
        <p>Name: ${user.name}</p>
        <p>Email: ${user.email}</p>
        <pre>${JSON.stringify(user, null, 2)}</pre>
    `);
});

app.get('/GetEmails', async (req, res) => {
    
    console.log('>>> Inside /GetEmails');
    const user = req.session.user;
    if(!user) {
        return res.status(401).send('User not authenticated');
    }

    try {
        const access_token = req.session.user.access_token;
        const emailResponse = await axios.get(
            'https://gmail.googleapis.com/gmail/v1/users/me/messages',
            {
                headers: {
                    Authorization: `Bearer ${access_token}`
                },
                params: {
                    maxResults: 20,
                    labelIds: 'INBOX',
                    q: ''
                }
            }
        );

        const emailIds = emailResponse.data.messages;
        console.log('emailIds: ' , emailIds);
        let responseHtmlString = '';
        emailIds.forEach(email => {
            responseHtmlString += `<p>${email.id}</p>`;
        });

        res.send(responseHtmlString);
    } catch(err) { 
        console.log('Erorr fetching emails: ' + err.response?.data || err.message);
        res.status(500).send('Failed to fetch emails');
    }
});


app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
})
