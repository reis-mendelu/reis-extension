from fastapi import FastAPI
from routers import api, config, home
from fastapi.middleware.cors import CORSMiddleware
import shared

app = FastAPI()

app.include_router(api.router, prefix="/api", tags=["API"])
app.include_router(config.router, prefix="/config", tags=["CONFIG"])

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],            # or ["*"] to allow all
    allow_credentials=True,
    allow_methods=["*"],              # GET, POST, PUT, DELETE, etc.
    allow_headers=["*"],              # Allow all headers
)

def main():
    if shared.cookie == None:
        print("[WARNING] No UIS code set, either use /config/set_cookie?new_cookie=<COOKIE> to set it, or go to shared.py and set the cookie that way.")

main()

@app.get("/")
def read_root():
    return home.render_home()
