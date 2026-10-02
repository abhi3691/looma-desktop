"""Packaged, loopback-only Looma workspace server."""
import json
import os
import socket
from pathlib import Path
import uvicorn
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from fastapi import Body
from app.services.looma_bridge import desktop_request
from datetime import datetime, timezone
import uuid

class CompanionExchange(BaseModel):
    question: str = Field(min_length=1, max_length=4000)
    answer: str = Field(max_length=100000)
from app.main import app
from app.services.storage_service import storage_service

@app.post('/api/v1/desktop/companion')
async def companion(value: dict = Body(...)):
    return await desktop_request('/companion', value)

@app.post('/api/v1/desktop/open-auth')
async def open_authorization(value: dict = Body(...)):
    return await desktop_request('/open-auth', value)

@app.get('/api/v1/desktop/providers')
async def providers():
    return await desktop_request('/providers', {'action': 'list'})

@app.post('/api/v1/desktop/providers')
async def manage_provider(value: dict = Body(...)):
    return await desktop_request('/providers', value)

@app.post('/api/v1/desktop/mcp')
async def manage_mcp(value: dict = Body(...)):
    return await desktop_request('/mcp', value)

@app.post('/api/v1/desktop/exchange')
async def record_exchange(exchange: CompanionExchange):
    for sender, text in [('user', exchange.question), ('bot', exchange.answer)]:
        storage_service.add_message(dict(id='msg-'+uuid.uuid4().hex, thread_id='bot-looma', bot_id='bot-looma', sender=sender, text=text, created_at=datetime.now(timezone.utc).isoformat(), model='gemini-3.1-flash-live-preview', item_type='user_text' if sender == 'user' else 'assistant_text'))
    return {'ok': True}

if __name__ == '__main__':
    root = Path(os.environ['LOOMA_STATIC_DIR']).resolve()
    if not (root / 'index.html').is_file():
        raise RuntimeError('Looma web assets are missing')
    current = storage_service.get_settings()
    current.update(default_model='gemini-3.1-flash-live-preview', model_ids=['gemini-3.1-flash-live-preview'])
    storage_service.save_settings(current)
    if not any(bot.get("id") == "bot-looma" for bot in storage_service.get_bots()):
        from datetime import datetime, timezone
        storage_service.save_bots(storage_service.get_bots() + [dict(id='bot-looma', name='Looma', role='Your desktop companion', description='Questions, work and a little company.', avatar='puppy', model='gemini-3.1-flash-live-preview', accent_color='#a5784f', system_prompt='You are Looma.', tools=[], pinned=True, unread_count=0, created_at=datetime.now(timezone.utc).isoformat())])
    app.mount('/', StaticFiles(directory=root, html=True), name='looma-client')
    sock = socket.socket()
    sock.bind(('127.0.0.1', 0))
    sock.listen(128)
    print(json.dumps({'loomaPort': sock.getsockname()[1]}), flush=True)
    uvicorn.Server(uvicorn.Config(app, log_level='warning')).run(sockets=[sock])
