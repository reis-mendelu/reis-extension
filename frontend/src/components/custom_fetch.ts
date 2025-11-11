export async function customFetch(input: string | URL | Request, init?: RequestInit): Promise<Response> {
    console.log("[CUSTOM] Custom fetch:",input);
    console.log("[CUSTOM] Fetch data:",init??"NO DATA");
    try {
        const response = await fetch(input, init);
        // If it's an opaque response or non-OK (like CORS or network block)
        if (!response.ok || response.type === "opaque") {
            console.warn("Falling back to proxy due to CORS or failed fetch:", response.status);
            return await proxyFetch(input, init);
        }
        return response;
    } catch (e) {
        console.log("[ERROR] Got CORS blocked, next proxy.");
        try {
            console.log("[PROXY] Falling back to proxy after first try to normal endpoint");
            const proxy =  await proxyFetch(input, init);
            return proxy;
        } catch (e2) {
            console.log("[ERROR] Throwing new error,why?");
            throw new Error();
        }
    }
}

async function proxyFetch(input: string | URL | Request, init?: RequestInit): Promise<Response> {
    try {
        const backend_path = ("http://localhost:8000/api/make_call_"+(init == undefined || init.method == undefined ? "get" : init.method.toLowerCase()));
        console.log("[PROXY] Backend path:",backend_path);
        const res = await fetch(backend_path, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                url: input instanceof Request ? input.url : input,
                headers: init?.headers ?? undefined,
                body: init?.body ?? undefined,
            }),
        });
        console.log("[PROXY] Status:",res.statusText);
        return res;
    } catch (e3) {
        throw new Error("Proxy fetch failed: " + (e3 as Error).message);
    }
}
