import json
from typing import Any
from fastapi import APIRouter, Request
import requests

from helper_utils.debug_print import debug_print
from models.get_request import GetRequest
from models.post_request import PostRequest


router = APIRouter()

@router.post("/make_call_get")
def make_call_get(request:Request,get_data:GetRequest):
    debug_print("[DEBUG] Cookies:",get_data.cookies)
    try:
        response = requests.get(
            get_data.url,
            params=get_data.params,  # Used for URL query parameters
            headers=get_data.headers, # Used for request headers
            cookies=get_data.cookies,
            timeout=10 # Best practice: set a timeout
        )
        debug_print("[STATUS] Call status:",response.status_code)
        #response.raise_for_status()
        try:
            response_json = response.json()
        except ValueError:
            response_json = None
        #return {"status":0,"text":response.text,"json":response_json}
        if response_json == None:
            return response.text
        else:
            return response_json
    except requests.exceptions.RequestException as error_message:
        print("[ERROR] Call error:",error_message)
        return {"status":1,"error":str(error_message)}

@router.post("/make_call_post")
def make_call_post(request:Request,post_data:PostRequest):
    debug_print("--------")
    try:
        # 1. Get the Content-Type header
        # Ensure the header key check is case-insensitive, as HTTP headers can be
        content_type = post_data.headers.get('content-type', '').lower()
        
        body_to_send = None
        
        if 'application/json' in content_type:
            ## Case A: Body is JSON
            try:
                # We already attempted to parse this earlier (if it was valid JSON)
                # but we can re-parse the raw body if needed, or assume body_object 
                # holds the parsed object from the initial successful attempt.
                # Assuming post_data.body is the raw JSON string if the parsing failed:
                if post_data.body:
                    body_to_send = json.loads(post_data.body)
                    # Use the 'json' parameter for requests.post()
                debug_print("[BODY TYPE] JSON object found.")
                
            except json.JSONDecodeError as json_error:
                # If Content-Type is JSON but parsing fails, you might want to log/error
                debug_print(f"[ERROR] JSON Decode failed for type {content_type}: {str(json_error)}")
                # Forcing a failure/bad request is a reasonable path here.
                return {"status": 1, "error": f"Invalid JSON body: {str(json_error)}"}
                
        elif 'application/x-www-form-urlencoded' in content_type:
            ## Case B: Body is URL-Encoded String
            # Use the raw string body directly for the 'data' parameter
            body_to_send = post_data.body
            debug_print("[BODY TYPE] URL-encoded string found.")
            
        else:
            # Case C: Other Content-Types (e.g., text/plain, multipart, etc.)
            # Default to sending the raw body via 'data' (common for unhandled types)
            body_to_send = post_data.body
            debug_print(f"[BODY TYPE] Other/Unknown type ({content_type}) - sending as raw data.")


        debug_print("[COOKIES] Cookies:", str(post_data.cookies))
        debug_print("[BODY] Data to send:", str(body_to_send))
        debug_print("[HEADERS] Headers:", str(post_data.headers))
        
        
        # Dynamic request execution
        if 'application/json' in content_type and isinstance(body_to_send, (dict, list)):
            # Send as JSON (requests will set content-type if not already set, 
            # but here we rely on the header being set in post_data.headers)
            response = requests.post(
                post_data.url,
                params=post_data.params,
                headers=post_data.headers,
                json=body_to_send, # Use 'json' for a Python object
                cookies=post_data.cookies,
                timeout=10
            )
        else:
            # Send as raw data/form-urlencoded string
            response = requests.post(
                post_data.url,
                params=post_data.params,
                headers=post_data.headers,
                data=body_to_send, # Use 'data' for a raw string (form-urlencoded)
                cookies=post_data.cookies,
                timeout=10
            )
        debug_print("[STATUS] Call status:",response.status_code)
        response.raise_for_status()
        try:
            response_json = response.json()
        except ValueError:
            response_json = None
        #return {"status":0,"text":response.text,"json":response_json}
        if response_json == None:
            return response.text
        else:
            return response_json
    except requests.exceptions.RequestException as e:
        print("[ERROR] Call error:",e)
        return {"status":1,"error":str(e)}
    except Exception as other_error:
        print("[ERROR] Other error:",other_error)
        return {"status":1,"error":str(other_error)}