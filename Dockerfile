FROM node:12.16.2-alpine AS Builder

WORKDIR /usr/src/app

COPY scripts/healthcheck.js healthcheck.js
COPY dist/ ./
COPY package*.json ./

ENV PORT=5000
ENV NODE_ENV=production
ENV PUBLIC_KEY=/certs/public.cert
ENV PRIVATE_KEY=/certs/private.key

RUN npm ci

FROM Builder AS SecureRunner

COPY ./certs /certs

# set permission on application runtime
# the node user is the only user who can
# exectute the runtime, all other access is denied
RUN chown node healthcheck.js
RUN chmod 500 healthcheck.js

RUN chown node app.bundle.js
RUN chmod 500 app.bundle.js

RUN chown -R node /certs
RUN chmod -R 500 /certs

FROM SecureRunner AS ProcessManager

RUN npm install pm2 -g --quiet

USER node

EXPOSE 5000

FROM ProcessManager AS Runner

HEALTHCHECK --interval=12s --timeout=12s --start-period=30s \
 CMD node healthcheck.js

CMD [ "pm2-runtime", "-i", "max", "app.bundle.js", "start" ]
