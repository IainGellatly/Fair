from locust import HttpUser, task, between, constant
import random
from gevent import sleep


class FairUser(HttpUser):
    wait_time = constant(0.1)

#    def on_start(self):

    @task
    def check_resource(self):
        self.client.get("/api/resource")
        self.client.get("/")
        self.client.get("/static/app.js")
        self.client.get("/static/cache.js")
        self.client.get("/static/styles.css")
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
        self.client.get("/static/media/media.zip")