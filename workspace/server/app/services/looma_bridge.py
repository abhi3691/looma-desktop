"""Only the current question crosses the desktop bridge; no history or task context."""
import os
import httpx

def current_question(messages):
    return next((str(m.get('content', ''))[:4000] for m in reversed(messages) if m.get('role') == 'user'), '')

async def desktop_request(path, payload):
    async with httpx.AsyncClient(timeout=120, trust_env=False) as client:
        response = await client.post(os.environ['LOOMA_GATEWAY_URL'] + path, headers={'Authorization': 'Bearer ' + os.environ['LOOMA_GATEWAY_TOKEN']}, json=payload)
        if not response.is_success:
            from fastapi import HTTPException
            raise HTTPException(status_code=400, detail=response.json().get('error', 'Desktop connection failed'))
        return response.json()

async def desktop_reply(messages, model=None):
    payload = {'text': current_question(messages)}
    if model:
        payload['model'] = model
    return (await desktop_request('/chat', payload))['answer']
