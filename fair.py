import asyncio
import asyncmy
from fastapi import FastAPI, Request, Response
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse, FileResponse
from contextlib import asynccontextmanager
from asyncmy.cursors import DictCursor
import uvicorn
import logging
from pywebpush import webpush, WebPushException
import json
import orjson
from urllib.parse import urlparse
from py_vapid import Vapid
from datetime import date


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
APP_SERVER_HOST = '0.0.0.0'
APP_SERVER_PORT = 8000
APP_SERVER_WORKERS = 1
DB_POOL_PER_WORKER = 10
DB_HOST = 'localhost'
DB_NAME = 'fairdb'
DB_USER = 'admin'
DB_PASSWORD = 'FanTab12345!'
VOTING_MODE = "daily"   # "single" or "daily"
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

pool: asyncmy.pool.Pool | None = None
analytics_buffer = []

@asynccontextmanager
async def lifespan(app: FastAPI):

    log.info('starting app server')

    global pool
    pool = await asyncmy.create_pool(
        host=DB_HOST,
        user=DB_USER,
        password=DB_PASSWORD,
        db=DB_NAME,
        minsize=1,
        maxsize=DB_POOL_PER_WORKER,
        autocommit=True
    )

    asyncio.create_task(analytics_worker())

    yield

    pool.close()
    await pool.wait_closed()

# -------------- WEB APP -------------------
app = FastAPI(lifespan=lifespan)
# app.mount("/static", StaticFiles(directory="static"), name="static")

@app.get("/", response_class=HTMLResponse)
def root():
    return FileResponse("templates/index.html")

# -------------- JSON HELPER ---------------
def json_response(data):
    return Response(
        content=orjson.dumps(data),
        media_type="application/json"
    )

# ------------ SQL HELPERS -----------------
async def get_data(qry):
    try:

        async with pool.acquire() as conn:
            async with conn.cursor(cursor=DictCursor) as cursor:
                await cursor.execute(qry)
                results = await cursor.fetchall()

                return results

    except Exception as err:

        log.error(f'get_data error:{err} qry:{qry}')

async def run_cmd(cmd):
    try:

        async with pool.acquire() as conn:
            async with conn.cursor() as cursor:
                await cursor.execute(cmd)
            await conn.commit()

    except Exception as err:

        log.error(f'run_cmd error:{err} cmd:{cmd}')


# --------- PUSH NOTIFICATION ----------------
async def send_push_one(alert):

    sub_id = alert.get('subscription_id')
    event_id = alert.get('event_id')
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

    log.info(f'send push notify sub_id:{sub_id}, event_id:{event_id}')

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
                "Urgency": "high"}
        )

    except WebPushException as err:

        log.error(f"push notify failed: {err}")

        if err.response.status_code == 410:

            log.info(f'delete old subscription for sub_id:{sub_id}')

            del_sql = f'''
                delete from subscriptions where subscription_id = {sub_id};
            '''
            await run_cmd(del_sql)

# ------------- ALERT FUNCTIONS -----------
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
    await run_cmd(sent_sql)

# ---------------- SCHEDULER ----------------
async def alert_scheduler():
    while True:

        log.info('checking alerts')

        ready_alerts = await get_ready_alerts()
        if ready_alerts:
            for alert in ready_alerts:
                await send_push_one(alert)
                await mark_alert_sent(alert)

        await asyncio.sleep(60)

# ------------- SERVER ENDPOINTS ------------
@app.get("/api/sponsors")
async def get_sponsors():

    qry = "select * from sponsors order by name;"
    result = await get_data(qry)

    return json_response(result)

@app.get('/api/tenants/{ten_type}')
async def get_tenants(ten_type: str):

    sql = f'select * from tenants where type = "{ten_type}" order by name;'
    rows = await get_data(sql)

    return json_response(rows)

@app.get('/api/events')
@app.get('/api/events/{event_type}')
async def get_events(event_type: str | None = None):

    where_cl = ''
    if event_type == 'today':

        where_cl = 'where date(start_time) = curdate()'

    elif event_type is not None:

        where_cl = f'where type = "{event_type}"'

    sql = f'''
            select
                event_id, 
                name, 
                description, 
                location, 
                icon, 
                price,
                status, 
                featured,
                date_format(start_time, "%l:%i %p") as start_time,
                date_format(end_time, "%l:%i %p") as end_time,
                date_format(start_time, "%W, %b %D") as day_date,
                start_time as start_datetime,
                end_time as end_datetime
            from events 
            {where_cl} 
            order by events.start_time;
        '''
    rows = await get_data(sql)

    return json_response(rows)

@app.post("/api/get_sub_id")
async def get_subscription_id(request: Request):

    data = await request.json()
    end_pt = data.get("endpoint")

    id_sql = f'''
        select subscription_id 
        from subscriptions 
        where endpoint = "{end_pt}";
    '''
    rows = await get_data(id_sql)

    return rows[0].get('subscription_id') if rows else 0

@app.post("/api/subscribe")
async def subscribe(request: Request):
    data = await request.json()
    end_pt = data.get('endpoint')
    p256dh = data.get('keys').get('p256dh')
    auth = data.get('keys').get('auth')

    ins_sql = f'''
        insert into subscriptions 
            (endpoint, p256dh, auth)
        values 
            ("{end_pt}", "{p256dh}", "{auth}") AS new
        on duplicate key update
            p256dh = new.p256dh,
            auth = new.auth;
        '''
    await run_cmd(ins_sql)

#    log.info(f'insert endpt ins_sql = {ins_sql}')

    id_sql = f'''
        select subscription_id 
        from subscriptions 
        where endpoint = "{end_pt}";
    '''
    rows = await get_data(id_sql)
#    log.info(f'select id_sql = {id_sql}')
#    log.info(f'select id rows = {rows}')
    sub_id = rows[0].get('subscription_id') if rows else 0

    log.info(f'add subscription sub_id:{sub_id}')

    return sub_id


@app.get("/api/alerts/{sub_id}")
async def get_alerts(sub_id: int):

    get_sql = f"""
        select event_id
        from alerts
        where subscription_id = {sub_id}
        and alert_sent = 0;
        """
    rows = await get_data(get_sql)

    return [r["event_id"] for r in rows]


@app.post("/api/alerts/add/{sub_id}/{event_id}")
async def add_alert(sub_id: int, event_id: int):

    log.info(f'add alert sub_id:{sub_id}, event_id:{event_id}')

    alert_sql = f"""
    insert into alerts (subscription_id, event_id, send_at, message)
    select
        {sub_id},
        e.event_id,
        date_sub(e.start_time, interval 10 minute),
        concat(e.name, ' starts soon')
    from events e
    where e.event_id = {event_id}
    on duplicate key update subscription_id = subscription_id;
    """
    await run_cmd(alert_sql)

    return {"status": "added"}

@app.post("/api/alerts/remove/{sub_id}/{event_id}")
async def remove_alert(sub_id: int, event_id: int):

    log.info(f'remove alert sub_id:{sub_id}, event_id:{event_id}')

    del_sql = f"""
        delete from alerts where
        subscription_id = {sub_id} and event_id = {event_id}
        """
    await run_cmd(del_sql)

    return {"status": "removed"}

# -------------- JAVASCRIPT APP -------------
@app.get("/sw.js")
async def sw():
    return FileResponse("sw.js", media_type="application/javascript")

# ---------------- TEST PUSH ----------------
@app.get("/api/test-notify")
async def test_notify():

    log.info('sending test push notification')

    sub_sql = 'select * from subscriptions;'
    subs = await get_data(sub_sql)
    for sub in subs:
        sub['message'] = 'test push notification'
        await send_push_one(sub)

    return {"status": "sent"}

# ---------------- VOTE --------------------
@app.post("/api/vote")
async def submit_vote(request: Request):

    data = await request.json()

    device_id = data.get("device_id")
    votes = data.get("votes")   # { food: 12, exhibit: 5, business: 9 }

    if not device_id or not votes:
        return {"status": "error"}

    async with pool.acquire() as conn:
        async with conn.cursor() as cursor:

            try:
                await conn.begin()

                today = date.today()

                if VOTING_MODE == "single":
                    check_sql = f'''
                        select 1 from votes 
                        where device_id = "{device_id}" 
                        limit 1;
                    '''
                else:
                    check_sql = f'''
                        select 1 from votes 
                        where device_id = "{device_id}" 
                        and vote_date = curdate()
                        limit 1;
                    '''

                existing = await get_data(check_sql)

                if existing:
                    return {"status": "already_voted"}

                for category, tenant_id in votes.items():

                    if not tenant_id:
                        continue

                    # insert vote (prevents duplicates)
                    await cursor.execute(f"""
                        insert into votes (device_id, category, tenant_id, vote_date)
                        values ("{device_id}", "{category}", {tenant_id}, curdate())
                    """)

                    # increment totals
                    await cursor.execute(f"""
                        insert into vote_totals (category, tenant_id, tenant_name, vote_count)
                        select 
                            t.type,
                            t.tenant_id,
                            t.name,
                            1
                        from tenants t
                        where t.tenant_id = {tenant_id}
                        on duplicate key update vote_count = vote_count + 1;
                    """)

                await conn.commit()

                return {"status": "ok"}

            except Exception as err:
                await conn.rollback()
                log.error(f"vote error: {err}")
                return {"status": "error"}

@app.get("/api/vote/results")
async def get_vote_results():

    sql = """
        select category, tenant_id, tenant_name, vote_count
        from vote_totals
        order by category, vote_count desc;
    """

    rows = await get_data(sql)

    result = {
        "food": [],
        "exhibit": [],
        "business": []
    }

    for r in rows:
        cat = r["category"]

        if len(result[cat]) < 3:
            result[cat].append(r)

    return json_response(result)

@app.get("/api/vote/status/{device_id}")
async def vote_status(device_id: str):

    today = date.today()

    if VOTING_MODE == "single":
        sql = f"""
            select category
            from votes
            where device_id = "{device_id}";
        """
    else:
        sql = f"""
            select category
            from votes
            where device_id = "{device_id}"
            and vote_date = curdate();
        """

    rows = await get_data(sql)

    voted = [r["category"] for r in rows]

    return voted

# ----------------- SURVEY -------------------
@app.get("/api/survey/status/{device_id}")
async def survey_status(device_id: str):

    sql = f'''
        select 1 from submitted_surveys
        where device_id = "{device_id}"
        limit 1;
    '''
    rows = await get_data(sql)

    return {"submitted": len(rows) > 0}

@app.post("/api/survey/submit")
async def submit_survey(request: Request):

    data = await request.json()

    device_id = data.get("device_id")
    answers = data.get("answers", [])
    comment = data.get("comment", "")

    if not device_id:
        return {"status": "error"}

    async with pool.acquire() as conn:
        async with conn.cursor() as cursor:

            try:
                await conn.begin()

                # 🔒 enforce one per device
                check_sql = f'''
                    select survey_id from submitted_surveys
                    where device_id = "{device_id}"
                    limit 1;
                '''
                existing = await get_data(check_sql)

                if existing:
                    return {"status": "already_submitted"}

                # insert survey
                await cursor.execute(f"""
                    insert into submitted_surveys (device_id, submitted_at, comment)
                    values ("{device_id}", now(), %s)
                """, (comment,))

                survey_id = cursor.lastrowid

                # insert answers
                for a in answers:
                    q = a.get("question_id")
                    ans = a.get("answer_id")

                    await cursor.execute(f"""
                        insert into survey_answers (survey_id, question_id, answer_id)
                        values ({survey_id}, {q}, {ans})
                    """)

                await conn.commit()

                return {"status": "ok"}

            except Exception as err:
                await conn.rollback()
                log.error(f"survey error: {err}")
                return {"status": "error"}

# ---------------- ANALYTICS -----------------
async def analytics_worker():
    while True:
        if analytics_buffer:
            batch = analytics_buffer.copy()
            analytics_buffer.clear()

            values = ",".join([
                f'("{e["event"]}", "{e["value"]}", "{e["device_id"]}")'
                for e in batch
            ])

            sql = f"""
                insert into analytics_events (event_type, event_value, device_id)
                values {values}
            """

            await run_cmd(sql)

        await asyncio.sleep(3)

@app.post("/api/analytics")
async def log_event(request: Request):

    try:
        data = await request.json()
        analytics_buffer.append(data)
        return {"status": "ok"}

    except Exception as err:
        log.error(f"analytics error: {err}")
        return {"status": "error"}