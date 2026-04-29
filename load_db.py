
import pandas as pd
from database import get_db
conn=get_db();c=conn.cursor()

c.execute("drop table if exists subscriptions;")
c.execute("""
    CREATE table subscriptions (
        id              integer primary key autoincrement,
        endpoint        varchar(512),
        p256dh          varchar(512),
        auth            varchar(512)
    );
""")

c.execute("drop table if exists alerts;")
c.execute("""
    CREATE table alerts (
        id              integer primary key autoincrement, 
        endpoint        varchar(512), 
        event_id        integer,
        sent            integer default 0
    );
""")

c.execute("drop table if exists tenants;")
c.execute("""
    CREATE table tenants (
        name            varchar(64),
        description     varchar(128),
        location        varchar(64),
        times           varchar(64),
        icon            varchar(128),
        type            varchar(32),
        featured        integer default 0
    );
""")

c.execute("drop table if exists sponsors;")
c.execute("""
    CREATE table sponsors (
        name            varchar(64),
        description     varchar(128),
        icon            varchar(128),
        level           varchar(32)
    );
""")

c.execute("drop table if exists events;")
c.execute("""
    CREATE table events (
        id              integer primary key autoincrement,
        category        varchar(32),
        name            varchar(64),
        description     varchar(128), 
        location        varchar(64),
        price           varchar(32),
        start_time      datetime, 
        end_time        datetime,
        duration_hrs    float,
        status          varchar(32),
        day_of_week     varchar(16)
    );
""")

df = pd.read_csv('events.csv')

# 'if_exists' can be 'fail', 'replace', or 'append'
df.to_sql('events', conn, if_exists='append', index=False)

c.execute("update events set start_time = date_add(start_time, interval 105 day);")
c.execute("update events set end_time = date_add(end_time, interval 105 day);")

conn.commit();conn.close()
print("database loaded")
