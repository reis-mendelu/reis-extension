# Proxy2 Setup Guide

## Prerequisites
- Python 3.8+
- pip

## Instructions

1. Open the `proxy2` folder using PowerShell, CMD, or VS Code terminal

2. Create a virtual environment:
```bash
python -m venv venv
```

3. Activate the virtual environment:
```bash
.\venv\Scripts\Activate.ps1
```

4. Install dependencies:
```bash
python -m pip install -r requirements.txt
```

5. Run the proxy server:
```bash
python -m uvicorn main:app --reload
```

## Configuration

After running the server, you'll see a warning about the UIS cookie not being set. Set it using one of these methods:

**Option A: Via endpoint**
```bash
localhost:8000/config/set_cookie?new_cookie=<COOKIE>
```

**Option B: Direct configuration (recommended)**
Edit `shared.py` and set the `cookie` variable directly. This method is more stable as HTTP encoding can corrupt certain characters in the cookie.

## Frontend Usage

When making requests to the UIS from the frontend, use the `customFetch()` function instead of the standard `fetch()` function. It automatically handles the correct request method.