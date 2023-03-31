import express from 'express';
import prom from "prom-client";
import responseTime from "response-time"
// const register = new prom.Registry();
const router = express.Router();

export const httpRequestDurationMicroseconds = new prom.Histogram({
  name: "http_request_duration_seconds",
  help: "REST API response time in seconds",
  labelNames: ["method", "route", "status_code",],
  buckets: [0.10, 5, 15, 50, 100, 200, 300, 400, 500]
});

export const databaseResponseTimeHistogram = new prom.Histogram({
  name: "db_response_time_duration_seconds",
  help: "Database response time in seconds",
  labelNames: ["operation", "success"],
  buckets: [0.10, 5, 15, 50, 100, 200, 300, 400, 500]
});

function startMetricsServer(app) {

  const collectDefaultMetrics = prom.collectDefaultMetrics;

  collectDefaultMetrics({
    app: 'pos-landing-backend',
    prefix: 'pos_',
    timeout: 10000,
    gcDurationBuckets: [0.001, 0.01, 0.1, 1, 2, 5],
    // register
  });

  app.get("/metrics", async (req, res) => {
    res.set("Content-Type", prom.register.contentType);

    return res.send(await prom.register.metrics());
  });

  app.use(
    responseTime((req, res, time) => {
        httpRequestDurationMicroseconds.observe(
          {
            method: req.method,
            route: req.originalUrl,
            status_code: res.statusCode,
          },
          time * 1000
        );
    })
  );

}
startMetricsServer(router);

export const startMetrics = (req, res, next) => {
  res.locals.startEpoch = Date.now()
  next()
}

export const endMetrics = (req, res, next) => {
  const responseTimeInMs = Date.now() - res.locals.startEpoch
  httpRequestDurationMicroseconds
    .labels(req.method, req.route.path, res.statusCode)
    .observe(responseTimeInMs)

  next();
}

export const checkoutsTotal = new prom.Counter({
  name: 'checkouts_total',
  help: 'Total number of checkouts',
  labelNames: ['payment_method']
})

export const metrics = router;