from models.generic_request import GenericRequest

class PostRequest(GenericRequest):
    body:str|None = None