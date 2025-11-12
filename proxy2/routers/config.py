from fastapi import APIRouter, Request
import shared

router = APIRouter()

@router.get("/set_cookie")
def set_global_cookie(request:Request,new_cookie:str):
    shared.cookie = new_cookie
    return {"status":0,"message":"Cookie updated succesfully"}
