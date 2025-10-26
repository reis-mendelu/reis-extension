export function hideUI(){
    window.localStorage.setItem("hidden","true");
    window.location.reload();
}