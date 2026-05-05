#!/bin/bash

cd /home/admin/fair
source ./fair/bin/activate
uvicorn fair:app \
    --host 0.0.0.0 \
    --port 8000 \
    --workers 2

