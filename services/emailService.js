import axios from 'axios';
import qs from 'qs';
import { getHeaders, extractEmail, getEmailDate } from '../utils/emailHelpers.js';

export const refreshTokens = async (users) => {
    const refreshedUsers = {};

    for(const [email, user] of Object.entries(users)) {
        user.expires_in = Number(user.expires_in);
        if(Date.now() > (user.expires_in)) {
            console.log('>>> Before Refresh /token REQ');
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
        }

        refreshedUsers[email] = user;
    }

    return refreshedUsers;
};

export const fetchAllEmails = async (users) => {
    const allEmailTables = [];

    for(const [Email, Name] of Object.entries(users)) {
        try {
            const access_token = Name.access_token;
            console.log('>>> Before /gmail/v1/users/me/messages REQ');
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
                            format: 'metadata',
                            metadataHeaders: ['From', 'To', 'Subject', 'Date']                
                        }
                    }
                )

                const headers = messageResponse.data.payload.headers;
                const emailId = messageResponse.data.id
                const rawSender = getHeaders(headers, 'From');
                const rawReceiver = getHeaders(headers, 'To');

                const sender = extractEmail(rawSender);
                const receiver = extractEmail(rawReceiver);
                const subject = getHeaders(headers, 'Subject');
                const dateStr = getEmailDate(new Date(getHeaders(headers, 'Date')));

                messageRows.push(`
                    <tr>
                        <td>${receiver}</td>
                        <td>${emailId}</td>
                        <td>${sender}</td>
                        <td>${subject}</td>
                        <td>${dateStr}</td>
                    </tr>
                `);
            };

            const table = `
                <div class="email">
                    <h2>Emails for ${Email}</h2>
                    <table border="1"> 
                        <th>Receiver</th>
                        <th>Id</th>
                        <th>Senders</th>
                        <th>Subject</th>
                        <th>Date</th>
                        <tbody>
                            ${messageRows.join('')}
                        </tbody>
                    </table>
                </div>
            `;

            allEmailTables.push(table);
            
        } catch(err) {
            console.log('Error fetching emails for', Email, '-', err.response?.data || err.message || err);
            continue;
        }
    }

    if (allEmailTables.length === 0) {
        throw new Error('Could not fetch any emails.');
    }

    return `
        <div class="email">
            <h1>All Email Tables for Logged In Users</h1>
            ${allEmailTables.join('')}
        </div>
    `;
};