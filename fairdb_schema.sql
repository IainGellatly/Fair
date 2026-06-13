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
    description     varchar(256),
    location        varchar(64),
    times           varchar(64),
    icon            varchar(128),
    type            varchar(32),
    outdoor         integer default 0,
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

drop table if exists tasting;
create table tasting (
    taste_id        integer auto_increment primary key,
    name            varchar(64),
    description     varchar(128),
    products        varchar(128),
    about           varchar(256),
    website         varchar(128),
    icon            varchar(128),
    featured        integer
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

drop table if exists vote_totals;
create table vote_totals (
    category    varchar(20),
    tenant_id   integer,
    tenant_name varchar(100),
    vote_count  integer default 0,
    primary key (category, tenant_id)
);

drop table if exists votes;
create table votes (
    vote_id    integer auto_increment primary key,
    device_id  varchar(64),
    vote_date  date not null default (current_date),
    category   varchar(20),
    tenant_id  integer,
    created_at datetime default current_timestamp,
    unique key (device_id, vote_date, category)
);

drop table if exists analytics_events;
create table analytics_events (
    id           bigint auto_increment primary key,
    event_type   varchar(32),
    event_value  varchar(64),
    device_id    varchar(64),
    created_at   datetime default current_timestamp
);

drop table if exists submitted_surveys;
create table submitted_surveys (
    survey_id      int auto_increment primary key,
    device_id      varchar(64) unique,
    submitted_at   datetime,
    comment        text
);

drop table if exists survey_answers;
create table survey_answers (
    id           int auto_increment primary key,
    survey_id    int,
    question_id  int,
    answer_id    int,
    index (survey_id)
);

drop table if exists app_config;
create table app_config (
  config_key     varchar(50) primary key,
  config_value   varchar(50)
);

insert into app_config (config_key, config_value)
values ('static_version', '1');

drop table if exists resource;
create table resource (
  resource_id    int auto_increment primary key,
  resource       varchar(32),
  version        int not null default 0,
  updated        datetime default current_timestamp
                   on update current_timestamp
);

insert into resource (resource) values
("event"), ("tenant"), ("sponsor"),("parade"),("tasting"),
("about"), ("ticket"), ("facility"),("first_aid"),("faq"),
("exhibit"),("midway"),("parking");