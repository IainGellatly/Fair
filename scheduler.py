import asyncio
import asyncmy
import logging
import json
import orjson
from asyncmy.cursors import DictCursor
from urllib.parse import urlparse
from pywebpush import webpush, WebPushException
from py_vapid import Vapid
import signal
import sys

# ---------------- CONFIG ----------------
DB_CONFIG = {
    "host": "localhost",
    "user": "admin",
    "password": "FanTab12345!",
    "db": "fairdb",
}

SLEEP_SECONDS = 60   # change to 300–900 later if desired
CONCURRENCY = 10

LOG_FILE = "scheduler.log"

VAPID_PRIVATE_KEY = """-----BEGIN PRIVATE KEY-----
MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQg6J1mHsv5+E4rogT1
qi2JH1OhO9g8ge8kNF681hqnEBahRANCAATwK9vzw9jxmLyNBLADWuYAlyes/4bq
YlegY3be48TGi/9A/0BXRfj2z98AwzQTPDzc721kUHoDPVh9Mjsg1SdN
-----END PRIVATE KEY-----
"""

# ---------------- LOGGING ----------------
logging.basicConfig(
    filename=LOG_FILE,
    format='%(asctime)s %(levelname)-8s %(message)s',
    level=logging.INFO,
    datefmt='%Y-%m-%d %H:%M:%S'
)
log = logging.getLogger("scheduler")

# ---------------- GLOBALS ----------------
pool: asyncmy.pool.Pool | None = None

# ---------------- DB HELPERS ----------------
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

# ---------------- PUSH ----------------
async def send_push_group(alert_group):

    first = alert_group[0]

    sub_id = first.get('subscription_id')
    end_pt = first.get("endpoint")

    parsed = urlparse(end_pt)
    aud = f"{parsed.scheme}://{parsed.netloc}"
    vapid = Vapid.from_pem(VAPID_PRIVATE_KEY.encode())

    # -------- BUILD MESSAGE --------
    if len(alert_group) == 1:
        body = first.get("message")
    else:
        names = [a["event_name"] for a in alert_group]
        body = "Starting soon:\n" + "\n".join(f"• {n}" for n in names)

    log.info(f'send push sub_id:{sub_id}, events:{len(alert_group)}')

    try:
        webpush(
            {
                "endpoint": end_pt,
                "keys": {
                    "p256dh": first.get("p256dh"),
                    "auth": first.get("auth")
                }
            },
            data=json.dumps({
                "title": "Starting Soon",
                "body": body,
                "url": "/?page=today"   # 👈 deep link
            }),
            vapid_private_key=vapid,
            vapid_claims={
                "sub": "mailto:iagellatly@gmail.com",
                "aud": aud
            },
            content_encoding="aes128gcm",
            headers={"TTL": "60", "Urgency": "high"}
        )

    except WebPushException as err:
        log.error(f"push failed: {err}")

        if err.response and err.response.status_code == 429:
            return alert_group, False

        if err.response and err.response.status_code == 410:
            await run_cmd(
                f'delete from subscriptions where subscription_id = {sub_id}'
            )

        raise

    # ---------------- ALERTS ----------------
async def get_ready_alerts():
    sql = """
        select 
            s.endpoint, s.p256dh, s.auth,
            a.message, a.subscription_id, a.event_id,
            e.name as event_name,
            a.send_at
        from alerts a
        join subscriptions s on a.subscription_id = s.subscription_id
        join events e on a.event_id = e.event_id
        where a.send_at <= now()
        and a.alert_sent = 0;
    """
    return await get_data(sql)

async def mark_alerts_sent_bulk(successful_groups):

    if not successful_groups:
        return

    values = []

    for group in successful_groups:
        for a in group:
            values.append(f"({a['subscription_id']}, {a['event_id']})")

    sql = f"""
        update alerts
        set alert_sent = 1
        where (subscription_id, event_id) in ({",".join(values)});
    """

    await run_cmd(sql)

def group_alerts(alerts):
    grouped = {}

    for a in alerts:
        # group by subscription + minute bucket
        key = (
            a["subscription_id"],
            a["send_at"].strftime("%Y-%m-%d %H:%M")
        )

        grouped.setdefault(key, []).append(a)

    return grouped

async def process_alerts(alerts):

    grouped = group_alerts(alerts)

    sem = asyncio.Semaphore(CONCURRENCY)

    async def send_group(alert_group):
        async with sem:
            try:
                await send_push_group(alert_group)
                return alert_group, True
            except Exception as e:
                log.error(f"send failed sub_id:{alert_group[0]['subscription_id']} err:{e}")
                return alert_group, False

    results = await asyncio.gather(
        *[send_group(group) for group in grouped.values()],
        return_exceptions=False
    )

    return results

# ---------------- MAIN LOOP ----------------
async def scheduler_loop():
    log.info("scheduler started")

    while not shutdown_event.is_set():
        try:

            log.info("checking for alerts")
            alerts = await get_ready_alerts()

            if alerts:
                log.info(f"processing {len(alerts)} alerts")

                results = await process_alerts(alerts)

                successful = [a for (a, ok) in results if ok]

                await mark_alerts_sent_bulk(successful)

                log.info(f"sent {len(successful)}/{len(alerts)} alerts")

        except Exception as e:
            log.exception(f"scheduler error: {e}")

        try:
            await asyncio.wait_for(
                shutdown_event.wait(),
                timeout=SLEEP_SECONDS
            )
        except asyncio.TimeoutError:
            pass

    log.info("scheduler shutting down")

# ---------------- STARTUP / SHUTDOWN ----------------
async def main():
    global pool

    pool = await asyncmy.create_pool(
        **DB_CONFIG,
        minsize=1,
        maxsize=2,
        autocommit=True
    )

    await scheduler_loop()

    pool.close()
    await pool.wait_closed()

def handle_signal():
    log.info("shutdown signal received")
    shutdown_event.set()

if __name__ == "__main__":

    shutdown_event = asyncio.Event()
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)

    for sig in (signal.SIGINT, signal.SIGTERM):
        loop.add_signal_handler(sig, handle_signal)

    try:
        loop.run_until_complete(main())
    finally:
        loop.close()
        sys.exit(0)