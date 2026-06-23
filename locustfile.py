from locust import HttpUser, task, between, constant
import random
from gevent import sleep


class FairUser(HttpUser):
    wait_time = constant(2)

    def on_start(self):
      # simulate initial load and data
        self.client.get("/")
        self.client.get("/static/app.js")
        self.client.get("/static/cache.js")
        self.client.get("/static/styles.css")
        self.client.get("/static/maps/fair_map.webp")
        self.client.get("/static/maps/floral_plan.webp")
        self.client.get("/static/maps/commercial_1_plan.webp")
        self.client.get("/static/maps/commercial_2_plan.webp")
        self.client.get("/sw.js")
        self.client.get("/api/resource")

        self.client.get("/api/sponsors")
        self.client.get("/api/tenants/food")
        self.client.get("/api/tenants/vendor")
        self.client.get("/api/tenants/community")
        self.client.get("/api/tenants/animal")
        self.client.get("/api/events")
        for _ in range(11):
            self.client.get("/static/pages/tickets.html")
        for _ in range(25):
            self.client.get("/static/icons/menu/about.webp")
         for _ in range(150):
             self.client.get("/static/icons/vendor/midway.webp")

    @task
    def check_resource(self):
        self.client.get("/api/resource")
