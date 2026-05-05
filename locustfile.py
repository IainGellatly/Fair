from locust import HttpUser, task, between
import random
from gevent import sleep


class FairUser(HttpUser):
    wait_time = between(5, 10)  # user "thinking"
    sub_id = 0

    def on_start(self):
        # simulate loading the app
        self.sub_id = random.randint(24, 28)
        self.client.get("/")
        self.client.get("/static/app.js")
        self.client.get("/static/styles.css")
        self.client.get("/static/map.webp")
        for _ in range(12):
            self.client.get("/static/icons/menu/about.webp")

    @task(12)
    def browse_today(self):
        self.client.get("/api/events/today")
        for _ in range(4):
            self.client.get("/static/icons/event/daveyallen.webp")

    @task(6)
    def browse_calendar(self):
        self.client.get("/api/events")
        for _ in range(15):
            self.client.get("/static/icons/event/daveyallen.webp")

    @task(10)
    def browse_food(self):
        self.client.get("/api/tenants/food")
        for _ in range(2):
            self.client.get("/static/icons/event/daveyallen.webp")

    @task(10)
    def browse_music(self):
        self.client.get("/api/tenants/music")
        for _ in range(2):
            self.client.get("/static/icons/event/daveyallen.webp")

    @task(10)
    def browse_grandstand(self):
        self.client.get("/api/events/grandstand")
        for _ in range(2):
            self.client.get("/static/icons/event/daveyallen.webp")

    @task(4)
    def browse_midway(self):
        self.client.get("/static/midway.html")

    @task(4)
    def browse_animals(self):
        self.client.get("/api/tenants/animal")
        for _ in range(2):
            self.client.get("/static/icons/event/daveyallen.webp")

    @task(4)
    def browse_sponsors(self):
        self.client.get("/api/sponsors")
        for _ in range(2):
            self.client.get("/static/icons/event/daveyallen.webp")

    @task(4)
    def browse_exhibits(self):
        self.client.get("/api/tenants/exhibit")
        for _ in range(2):
            self.client.get("/static/icons/event/daveyallen.webp")

    @task(3)
    def browse_business(self):
        self.client.get("/api/tenants/business")
        for _ in range(2):
            self.client.get("/static/icons/event/daveyallen.webp")

    @task(1)
    def browse_first_aid(self):
        self.client.get("/static/firstaid.html")

    @task(1)
    def browse_facilities(self):
        self.client.get("/static/facilities.html")

    @task(2)
    def browse_tickets(self):
        self.client.get("/static/tickets.html")

    @task(1)
    def browse_faqs(self):
        self.client.get("/static/faqs.html")

    @task(1)
    def browse_about(self):
        self.client.get("/static/about.html")

    @task(20)
    def browse_alerts(self):
        event_id = random.randint(1, 150)
        self.client.post(f"/api/alerts/add/{self.sub_id}/{event_id}")
        sleep(2)
        self.client.post(f"/api/alerts/remove/{self.sub_id}/{event_id}")