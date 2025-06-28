import axios from 'axios';
import qs from 'qs';

export const googleAuth = () => {
    return 'https://accounts.google.com/o/oauth2/auth?' + qs.stringify({
        client_id: process.env.GOOGLE_CLIENT_ID,
        redirect_uri: process.env.GOOGLE_REDIRECT_URI,
        response_type: 'code',
        scope: 'openid email profile https://www.googleapis.com/auth/gmail.readonly',
        access_type: 'offline', 
        prompt: 'consent'
    });
};

export const handleGoogleCallback = async (code) => {
    console.log('>>> Before /token REQ');
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

    console.log('>>> Before /oauth2/v3/userinfo REQ');
    const userInfo = await axios.get(
        'https://www.googleapis.com/oauth2/v3/userinfo',{
        headers: {
            Authorization: `Bearer ${access_token}`
        }
    });

    return {
        name: userInfo.data.name,
        email: userInfo.data.email,
        access_token,
        refresh_token,
        expires_in: Date.now() + expires_in * 1000
    };
};