export const getHeaders = (headers, name) => {
    const header = headers.find(h => h.name.toLowerCase() === name.toLowerCase());
    return header ? header.value : '';
};

export const extractEmail = (headerValue) => {
    const match = headerValue.match(/<(.+?)>/);
    return match ? match[1] : headerValue;
};

export const getEmailDate = (date) => {
    const today = new Date();
    const isToday = (
        date.getFullYear() === today.getFullYear() &&
        date.getMonth() === today.getMonth() &&
        date.getDate() === today.getDate()
    );
    
    if(!isToday) {
        return `${date.toLocaleString('en-US', { month: 'short'})} ${date.getDate()}`; 
    } else {
        return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
    }
};