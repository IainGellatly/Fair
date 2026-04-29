import asyncio
import redis.asyncio as redis

REDIS_HOST = 'localhost'
REDIS_PORT = 6379
REDIS_DB = 0

r = redis.Redis(
    host=REDIS_HOST,
    port=REDIS_PORT,
    db=REDIS_DB,
    decode_responses=True)

async def main():

    await r.zadd('alerts', {'alert:1'})
    rd['endpoint:asfajslslfkas'] = alert1
    rd['endpoint:asfajslslfkas']['sent'] = 'true'
    alert_list = rd['endpoint:asfajslslfkas']
    print(alert_list)

if __name__ == "__main__":
    asyncio.run(main())