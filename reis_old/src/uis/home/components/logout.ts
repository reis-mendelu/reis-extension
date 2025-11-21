export async function performLogOut(){
    try {
        await fetch("https://is.mendelu.cz/auth/system/logout.pl", {
        "headers": {
            "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
            "accept-language": "cs,en;q=0.9,en-GB;q=0.8,en-US;q=0.7",
            "cache-control": "max-age=0",
            "content-type": "application/x-www-form-urlencoded",
            "sec-ch-ua": "\"Microsoft Edge\";v=\"141\", \"Not?A_Brand\";v=\"8\", \"Chromium\";v=\"141\"",
            "sec-ch-ua-mobile": "?1",
            "sec-ch-ua-platform": "\"Android\"",
            "sec-fetch-dest": "document",
            "sec-fetch-mode": "navigate",
            "sec-fetch-site": "same-origin",
            "sec-fetch-user": "?1",
            "upgrade-insecure-requests": "1"
        },
        "referrer": "https://is.mendelu.cz/auth/system/logout.pl?lang=cz",
        "body": "lang=cz&odhlaseni=Odhl%C3%A1sit+se",
        "method": "POST",
        "mode": "cors",
        "credentials": "include"
        });
        window.location.reload();   
    } catch (error) {
        console.error(error);
    }
};