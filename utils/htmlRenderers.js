export const renderAccountList = (users) => {
    let  userListHtml = `
        <button class='sidebar-account-list-item'
            type="button"
            hx-get='/GetAllEmails'
            hx-target='#email-container'
            hx-swap='innerHTML'>
            <i class='bx  bx-envelope-open'></i> 
            <span>Show All</span>
        </button>`
    userListHtml += Object.values(users).map(user => `
        <button class='sidebar-account-list-item'
                type="button"
            hx-get='/GetAllEmails/${user.email}'
            hx-target='#email-container'
            hx-swap='innerHTML'>
            <i class='bx bx-user'></i> 
            <span>${user.email}</span>
        </button>
    `).join('');

    return userListHtml;
};