import asyncio
import time
from fastapi import FastAPI
import asyncmy
from contextlib import asynccontextmanager
from asyncmy.cursors import DictCursor
import uvicorn

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

    asyncio.create_task(worker_loop())

    yield

    pool.close()
    await pool.wait_closed()

app = FastAPI(lifespan=lifespan)

# -----------------------------
# Test Query Function
# -----------------------------

async def get_data(qry):
    async with pool.acquire() as conn:
        async with conn.cursor(cursor=DictCursor) as cursor:
            await cursor.execute(qry)
            results = await cursor.fetchall()
            return results

async def run_test_query():
    start_time = time.perf_counter()
    for it in range(100):
        sql = f"select * from tenants where tenant_id = {it};"
        rows = await get_data(sql)
    elapsed = time.perf_counter() - start_time
    return elapsed * 1000

# -----------------------------
# Worker Loop (background task)
# -----------------------------
async def worker_loop():
    while True:
        result = await run_test_query()
        print(f"[WORKER] {result:.3f}")

        await asyncio.sleep(5)

# -----------------------------
# API Endpoint (manual trigger)
# -----------------------------
@app.get("/test")
async def test_endpoint():
    result = await run_test_query()
    return result

if __name__ == "__main__":
    uvicorn.run(app, host="localhost", port=8000)
