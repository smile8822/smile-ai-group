FROM node:22-alpine
WORKDIR /app
RUN addgroup -S capture && adduser -S capture -G capture
COPY --chown=capture:capture package.json *.mjs /app/
COPY --chown=capture:capture public/ /app/public/
RUN mkdir -p /data && chown capture:capture /data
USER capture
ENV NODE_ENV=production CAPTURE_ROOT=/data CAPTURE_HOST=0.0.0.0 CAPTURE_PORT=8787
EXPOSE 8787
CMD ["node", "server.mjs"]
