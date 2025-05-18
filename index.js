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
app.use(express.static('static'));
app.set('view-engine', 'ejs');
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
// LOG IN WITH GOOGLE
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

// LOG IN WITH GOOGLE CALLBACK
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
        req.session.users = req.session.users || {}
        req.session.users[userInfo.data.email] = {
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

app.get('/AccountList', async (req, res) => {
    console.log('>>> Inside /AccountList request');
    req.session.users = req.session.users || {};
    const users = req.session.users;
    
    if(Object.keys(users).length === 0) {
        return res.status(401).send('<p>User not authenticated. <a href="/auth/google">Login with Google</a></p>');
    }

    const refreshedUsers = {};



    // Refresh Token Logic
    for(const [email, user] of Object.entries(users)) {
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

            } catch(err) {
                console.log('Failed to refresh token:', err.response?.data || err.message);
                return res.redirect('/auth/google');
            }
        }

        refreshedUsers[email] = user;
    }

    req.session.users = refreshedUsers;
    console.log(refreshedUsers);
   const userListHtml = Object.values(refreshedUsers).map(user => `
            <button class='sidebar-account-list-item'
                    type="button"
                hx-get='/GetAllEmails/${user.email}'
                hx-target='#sidebar-account-list'
                hx-swap='innerHTML'>
                <i class='bx bx-user'></i> 
                <span>${user.email}</span>
            </button>
        `).join('');

        console.log(userListHtml)

    res.send(`
        ${userListHtml}
    `);
});

app.get('/GetAllEmails', async (req, res) => {
    
    console.log('>>> Inside /GetAllEmails');
    req.session.users = req.session.users || {};
    const users = req.session.users;
    if(Object.keys(users).length === 0) {
        return res.status(401).send('No users authenticated');
    }

    function getHeaders(headers, name) {
        const header = headers.find(h => h.name.toLowerCase() === name.toLowerCase());
        return header ? header.value : '';
    }

    function extractEmail(headerValue) {
        const match = headerValue.match(/<(.+?)>/);
        return match ? match[1] : headerValue;
    }

    const allEmailTables = [];

    for(const [Email, Name] of Object.entries(users)) {
        try {
            const access_token = Name.access_token;
            const emailResponse = await axios.get(
                'https://gmail.googleapis.com/gmail/v1/users/me/messages',
                {
                    headers: {
                        Authorization: `Bearer ${access_token}`
                    },
                    params: {
                        maxResults: 5,
                        labelIds: ['INBOX'],
                        q: ''
                    }
                }
            );

            const messages = emailResponse.data.messages || [];
            const messageRows = [];
            console.log('emailIds: ' , messages);

            for(const msg of messages) {
                const messageResponse = await axios.get(
                    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}`,
                    {
                        headers: {
                            Authorization: `Bearer ${access_token}`
                        },
                    params: {
                        format: 'metadata', // or 'full' for full body
                        metadataHeaders: ['From', 'To', 'Subject', 'Date']                
                    }
                })

                const headers = messageResponse.data.payload.headers;
                const emailId = messageResponse.data.id
                const rawSender = getHeaders(headers, 'From');
                const rawReceiver = getHeaders(headers, 'To');

                const sender = extractEmail(rawSender);
                const receiver = extractEmail(rawReceiver);
                const subject = getHeaders(headers, 'Subject');
    
            messageRows.push(`
                    <tr>
                        <td>${emailId}</td>
                        <td>${sender}</td>
                        <td>${subject}</td>
                        <td>${receiver}</td>
                    </tr>
                `);
            };

            const table = `
                <div class="email">
                    <h2>Emails for ${Email}</h2>
                    <table border="1"> 
                        <th>Id</th>
                        <th>Senders</th>
                        <th>Subject</th>
                        <th>Receiver</th>
                        <tbody>
                            ${messageRows.join('')}
                        </tbody>
                    </table>
                </div>
                `;

                allEmailTables.push(table);
                // console.log(table)
            
        } catch(err) {
            console.log('Error fetching emails for', Email, '-', err.response?.data || err.message || err);
            continue;
        }
    }
      if (allEmailTables.length === 0) {
        return res.status(500).send('Could not fetch any emails.');
    }

    res.send(`
        <div class="email">
            <h1>All Email Tables for Logged In Users</h1>
            ${allEmailTables.join('')}
        </div>
    `);
});


app.get('/GetAllEmails/:emailId', async(req, res) => {

    const email = req.params.emailId;
    console.log(`>>> Inside /GetAllEmails/${email}`);
    req.session.users = req.session.users || {};
    const users = req.session.users;
    if(Object.keys(users).length === 0) {
        return res.status(401).send('No users authenticated');
    }

    const user = users[email];
    console.log(user);
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
})
