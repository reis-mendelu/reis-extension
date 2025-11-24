import { ID_URL } from "./user_id_fetcher";

export async function testConnection(){
    const f = await fetch(ID_URL,{
        method:"GET",
        credentials:"include",
        headers:{
            
        }
    });
    console.log(await f.text());
}