#!/bin/bash
git log --format="%H" -n 1 > LAST_GIT_COMMIT
docker build -t data-patch-service:dev ./
# docker save dashboard-backend-nodejs:dev | gzip > dashboard-backend-nodejs.dev.tgz
