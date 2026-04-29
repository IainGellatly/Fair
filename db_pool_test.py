import asyncio
import asyncmy
from fastapi import FastAPI, Depends
from contextlib import asynccontextmanager

pool = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    global pool
    pool = await asyncmy.create_pool(
        host="localhost",
        user="root",
        password="FanTab12345!",
        db="fairdb",
        minsize=1,
        maxsize=10
    )
    yield

    pool.close()
    await pool.wait_closed()


app = FastAPI(lifespan=lifespan)

async def get_db_conn():
    async with pool.acquire() as conn:
        yield conn

@app.get("/data")
async def read_data(conn = Depends(get_db_conn)):
    async with conn.cursor() as cursor:
        await cursor.execute("select name from sponsors;")
        result = await cursor.fetchall()
        return {"result": result}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="localhost", port=8000)




























import asyncio
import asyncmy
from asyncmy.cursors import DictCursor
from time import time
import uvicorn
from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse, FileResponse

async def get_data(p, sql):
    async with p.acquire() as conn:
        async with conn.cursor(cursor=DictCursor) as cursor:
            await cursor.execute(sql)
            result = await cursor.fetchall()
            print(f"Result: {result}")

async def main():
    pool = await asyncmy.create_pool(
        host="localhost",
        user="root",
        password="FanTab12345!",
        db="fairdb",
        minsize=1,  # Minimum connections in pool
        maxsize=10  # Maximum connections in pool
    )

    start_tm = time()
    stmt = 'SELECT event_id, name, date_format(start_time, "%l:%i %p") as start_time from events where date(start_time) = "2026-08-11" order by events.start_time;'
    cnt = 1
    for it in range(cnt):
        await get_data(pool, stmt)
    stop_tm = time()
    avg_ms = (stop_tm - start_tm) * 1000 / cnt
    print(f'{avg_ms:.2f}')
    pool.close()
    await pool.wait_closed()

app = FastAPI()
app.mount("/static", StaticFiles(directory="static"), name="static")

@app.get("/", response_class=HTMLResponse)
def root():
    return '{"message": "hello world"}'

if __name__ == "__main__":
    uvicorn.run('db_pool_test:app', host='localhost', port=8000 )
    asyncio.run(main())
