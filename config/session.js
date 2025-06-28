export const sessionConfig = (SQLiteStoreSession) => ({
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
});