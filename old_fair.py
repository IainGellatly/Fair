import uvicorn
from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse, FileResponse
import logging
import threading
import time
import requests
from pywebpush import webpush, WebPushException
import json
from urllib.parse import urlparse
from py_vapid import Vapid

# ---------------- CONFIG ----------------
VAPID_PUBLIC_KEY = "BPAr2_PD2PGYvI0EsANa5gCXJ6z_hupiV6Bjdt7jxMaL_0D_QFdF-PbP3wDDNBM8PNzvbWRQegM9WH0yOyDVJ00"
VAPID_PRIVATE_KEY = """-----BEGIN PRIVATE KEY-----
MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQg6J1mHsv5+E4rogT1
qi2JH1OhO9g8ge8kNF681hqnEBahRANCAATwK9vzw9jxmLyNBLADWuYAlyes/4bq
YlegY3be48TGi/9A/0BXRfj2z98AwzQTPDzc721kUHoDPVh9Mjsg1SdN
-----END PRIVATE KEY-----
"""
VAPID_CLAIMS = {
    "sub": "mailto:iagellatly@gmail.com"
}

CLOUD_SERVICE_NAME = 'fair'
CLOUD_LOGGING_LEVEL = logging.INFO
CLOUD_LOG_FILE_NAME = 'fair.log'
SERVER_HOST = '0.0.0.0'
SERVER_PORT = 8000
LOGGING_CONFIG = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "default": {"()": "uvicorn.logging.DefaultFormatter", "fmt": "%(message)s", "use_colors": False},
    },
    "handlers": {
        "file": {"class": "logging.FileHandler", "filename": "uvicorn.log", "formatter": "default"},
    },
    "loggers": {
        "uvicorn": {"handlers": ["file"], "level": "INFO"},
    },
}

# ---------------- LOGGING ----------------
log = logging.getLogger(CLOUD_SERVICE_NAME)
logging.basicConfig(
    filename=CLOUD_LOG_FILE_NAME,
    format='%(asctime)s %(levelname)-8s %(message)s',
    level=CLOUD_LOGGING_LEVEL,
    datefmt='%Y-%m-%d %H:%M:%S'
)

async def send_push_one(alert):

    end_pt = alert.get("endpoint")
    p256dh = alert.get("p256dh")
    auth = alert.get("auth")
    msg = alert.get("message")
    subscription_info = {
        "endpoint": end_pt,
        "keys": {
            "p256dh": p256dh,
            "auth": auth
        }
    }
    parsed = urlparse(end_pt)
    aud = f"{parsed.scheme}://{parsed.netloc}"
    vapid = Vapid.from_pem(VAPID_PRIVATE_KEY.encode())

    try:

        webpush(
            subscription_info,
            data=json.dumps({
                "title": "Starting Soon",
                "body": msg
            }),
            vapid_private_key=vapid,
            vapid_claims={
                "sub": "mailto:iagellatly@gmail.com",
                "aud": aud
            },
            content_encoding="aes128gcm",
            headers={
                "TTL": "60",
                "Urgency": "normal"}
        )

    except WebPushException as err:

        log.error(f"Push failed: {err}")

        if err.response and err.response.status_code == 410:

            del_sql = f'''
                delete from subscriptions where endpoint = {end_pt};
            '''
            await run_sql(del_sql)

# ---------------- SCHEDULER ----------------
async def alert_scheduler():
    while True:

        ready_alerts = await get_ready_alerts()
        if ready_alerts:
            for alert in ready_alerts:
                sent = await send_push_to_one(alert)
                if sent:
                    await mark_alert_sent(alert)

        time.sleep(60)

# ---------------- APP ----------------
app = FastAPI()
app.mount("/static", StaticFiles(directory="static"), name="static")

@app.get("/", response_class=HTMLResponse)
def root():
    return FileResponse("templates/index.html")

# ---------------- HELPERS ----------------

pool = await asyncmy.create_pool(
        host="localhost",
        user="root",
        password="FanTab12345!",
        db="fairdb",
        minsize=1,   # Minimum connections in pool
        maxsize=10   # Maximum connections in pool
    )

async def get_data(qry):
    try:

        async with pool.acquire() as conn:

            async with conn.cursor(cursor=DictCursor) as cursor:

                await cursor.execute(qry)
                results = await cursor.fetchall()
                return results

    except Exception as err:

        log.error(f'get_data error: {err}')

async def run_sql(cmd):
    try:

        async with pool.acquire() as conn:

            await conn.execute(cmd)

    except Exception as err:

        log.error(f'run_cmd error: {err}')

# ---------------- API ROUTES ----------------

@app.get('/api/tenants/{tenant_type}')
async def get_tenants(tenant_type: str):

    sql = f'''
        select 
            name, 
            description, 
            location, 
            times, 
            icon, 
            featured 
        from tenants
        where type = {tenant_type}
        order by name;
        '''
    rows = get_data(sql)
    return rows

@app.get('/api/sponsors')
async def get_sponsors():
    sql = f'''
        select 
            name, 
            description, 
            icon, 
            tier 
        from sponsors
        order name;
        '''
    rows = get_data(sql)
    return rows

@app.get('/events/{event_type}')
async def get_events(event_type: str):
    where_cl = ''
    if event_type in ('music', 'grandstand'):

        where_cl = f'where type = {event_type}'

    elif event_type == 'today':

        where_cl = 'where date(start_time) = curdate()'

    sql = f'''
            select 
                name, 
                description, 
                location, 
                icon, 
                price, 
                featured,
                date_format(start_time, "%l:%i %p") as start_time,
                date_format(end_time, "%l:%i %p") as end_time,
                date_format(start_time, "%W, %b %D") as day_date
            from events 
            {where_cl} 
            order by events.start_time;
        '''
    rows = get_data(sql)
    return rows

# ---------------- ALERTS ----------------
@app.post("/api/alerts/add/{sub_id}/{event_id}")
async def add_alert(sub_id: int, event_id: int):
    log.info(f'adding alert for event: {event_id}')
    event_sql = f"""
        select 
            name, 
            date_sub(start_time, interval 10 minute) as send_at
        from events
        where event_id = {event_id}; 
        """
    rows = await get_data(event_sql)
    send_at = rows[0].get('send_at')
    event_name = rows[0].get('name')
    alert_sql = f"""
        insert into alerts 
            (subscription_id, event_id, send_at, message)
        values 
            ({sub_id}, {event_id}, {send_at}, {event_name})
        on duplicate key update subscription_id = subscription_id;
        """
    await run_sql(alert_sql)
    return {"status": "added"}

@app.post("/api/alerts/remove/{sub_id}/{event_id}")
async def remove_alert(sub_id: int, event_id: int):
    log.info(f'removing alert for event: {event_id}')
    del_sql = f"""
        delete from alerts where
        subscription_id = {sub_id} and event_id = {event_id}
        """
    await run_sql(del_sql)
    return {"status": "removed"}

@app.post("/api/subscribe")
async def subscribe(request: Request):
    data = await request.json()
    end_pt = data.get('endpoint')
    p256dh = data.get('keys').get('p256dh')
    auth = data.get('key').get('auth')

    del_sql = f'delete from subscriptions where endpoint = "{end_pt}"'
    await run_sql(del_sql)

    ins_sql = f'''
        insert into subscriptions (endpoint, p256dh, auth) 
        values ("{end_pt}", "{p256dh}", "{auth}");
        '''
    await run_sql(ins_sql)

    id_sql = f'''
        select subscription_id
        from subscriptions 
        where endpoint = "{end_pt}";
        '''
    rows = await get_data(id_sql)
    sub_id = rows[0].get('subscription_id')

    return {"subscription_id": sub_id }

async def get_ready_alerts():

    get_sql = '''
        select 
            s.endpoint, 
            s.p256dh, 
            s.auth, 
            a.message,
            a.subscription_id,
            a.event_id
        from alerts a, subscriptions s
        where a.subscription_id = s.subscription_id
        and a.send_at <= now()
        and a.alert_sent = 0;
        '''
    rows = await get_data(get_sql)
    return rows

async def mark_alert_sent(alert):

    sub_id = alert.get('subscription_id')
    event_id = alert.get('event_id')
    sent_sql = f'''
        update alerts set alert_sent = 1 where 
        subscription_id = {sub_id} and event_id = {event_id};
        '''
    await run_sql(sent_sql)


@app.get("/sw.js")
def sw():
    return FileResponse("sw.js", media_type="application/javascript")

# ---------------- TEST PUSH ----------------
@app.get("/api/test-notify")
def test_notify():
    send_push("Fair Reminder", "Event starting soon!")
    return {"status": "sent"}

# ---------------- MAIN ----------------
if __name__ == '__main__':
    log.info('Starting Fair App')

    threading.Thread(target=alert_scheduler, daemon=True).start()

    uvicorn.run(
        'fair:app',
        host=SERVER_HOST,
        port=SERVER_PORT,
        log_config=LOGGING_CONFIG
    )