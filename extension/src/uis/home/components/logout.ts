export async function performLogOut(){
    try {
        await fetch("https://is.mendelu.cz/system/login.pl?odhlasen=1");
        window.location.reload();   
    } catch (error) {
        console.error(error);
    }
};