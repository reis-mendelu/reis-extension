from typing import Any
from pydantic import BaseModel, model_validator

import shared

class GenericRequest(BaseModel):
    url:str
    params:dict[str, str] | None = None
    headers:dict[str, str] | None = None
    cookies:dict[str,str] | None = None

    @model_validator(mode='before')
    @classmethod
    def validate_request(cls, data: Any) -> Any:
        if isinstance(data, dict):
            # Modify the incoming data here
            if not 'cookies' in data or data['cookies'] is None:
                data['cookies'] = {}
            
            # Add default headers if needed
            if 'cookies' in data:
                data["cookies"]["UISAuth"] = "NONE" if shared.cookie == None else shared.cookie
        return data