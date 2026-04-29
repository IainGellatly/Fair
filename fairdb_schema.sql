drop table if exists alerts;
drop table if exists subscriptions;

create table subscriptions (
    subscription_id integer auto_increment primary key,
    endpoint        varchar(256) not null,
    p256dh          varchar(256),
    auth            varchar(256),
    created_at      datetime default current_timestamp,
    last_seen       datetime default current_timestamp
                        on update current_timestamp,
    unique key (endpoint)
);

create table alerts (
    subscription_id integer not null,
    event_id        integer not null,
    send_at         datetime,
    alert_sent      integer default 0,
    message         varchar(128),
    primary key (subscription_id, event_id),
    foreign key (subscription_id)
        references subscriptions (subscription_id)
        on delete cascade
);
create index alert_send_at on alerts(send_at);

drop table if exists tenants;
create table tenants (
	tenant_id		integer auto_increment primary key,
    name            varchar(64),
    description     varchar(128),
    location        varchar(64),
    times           varchar(64),
    icon            varchar(128),
    type            varchar(32),
    featured        integer default 0
);
create index tenants_type on tenants(type);


drop table if exists sponsors;
create table sponsors (
	sponsor_id		integer auto_increment primary key,
    name            varchar(64),
    description     varchar(128),
    icon            varchar(128),
    tier            varchar(32)
);

drop table if exists events;
create table events (
	event_id		integer auto_increment primary key,
    type            varchar(32),
    name            varchar(64),
    description     varchar(128),
    icon            varchar(128),
    location        varchar(64),
    price           varchar(64),
    start_time      datetime,
    end_time        datetime,
    duration_hrs    float,
    status          varchar(32),
    featured        integer default 0
);
create index events_type on events(type);

