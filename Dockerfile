FROM node:lts-slim
RUN npm install -g pm2
WORKDIR /app

ADD app.js ./
ADD Dockerfile ./
ADD esdump.js ./
ADD obs.js ./
ADD opensearch.js ./
ADD package.json ./
ADD postgres.js ./
ADD yarn.lock ./

ADD public/ ./public/
ADD routes/ ./routes/
ADD views/ ./views/
ADD bin/ ./bin/

ADD LAST_GIT_COMMIT ./

RUN yarn

CMD ["pm2-runtime", "start", "./bin/www"]
