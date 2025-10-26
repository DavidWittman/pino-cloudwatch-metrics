import { Logger } from 'pino'
import {
  Unit,
  Metrics,
  Dimensions,
  MetricValue,
  EmbeddedMetricFormat,
  MetricLogger,
  MetricBuilder,
} from './types.js'

/**
 * 
 * logger
    .metric({ Latency: { value: 123, unit: "Milliseconds" } })
    .dimensions({ ServiceName: "AuthService", Region: "us-east-1" })
    .info({ requestId: "abc123" }, "Processed login");
 */

function buildEMF({
  metrics,
  dimensions,
  namespace,
}: {
  metrics: Metrics
  dimensions: Dimensions
  namespace: string
}): EmbeddedMetricFormat {
  const metricDefs = Object.entries(metrics).map(([name, v]) => ({
    Name: name,
    Unit: typeof v === 'object' && v.unit ? v.unit : Unit.None,
  }))

  const metricValues = Object.fromEntries(
    Object.entries(metrics).map(([name, v]) => [
      name,
      typeof v === 'object' ? (v as MetricValue).value : v,
    ]),
  )

  return {
    _aws: {
      Timestamp: Date.now(),
      CloudWatchMetrics: [
        {
          Namespace: namespace,
          Dimensions: [Object.keys(dimensions)],
          Metrics: metricDefs,
        },
      ],
    },
    ...dimensions,
    ...metricValues,
  }
}

// TODO: add default dimensions
export function pinoCloudwatchMetrics({ defaultNamespace = 'Pino' } = {}) {
  return (logger: Logger): MetricLogger => {
    // Create an extended logger prototype
    const extended = Object.create(logger)

    // TODO: add .increment function for count metrics

    extended.metric = function (metrics: Metrics): MetricLogger {
      const ctx = {
        metrics,
        dimensions: {},
        namespace: defaultNamespace,
      }

      const proxy = Object.create(logger)

      proxy.dimensions = (dims: Dimensions): MetricBuilder => {
        ctx.dimensions = { ...ctx.dimensions, ...dims }
        return proxy
      }

      proxy.namespace = (ns: string): MetricBuilder => {
        ctx.namespace = ns
        return proxy
      }

      // Patch logging methods
      // TODO: what about custom logging levels?
      ;['trace', 'debug', 'info', 'warn', 'error', 'fatal'].forEach((level) => {
        proxy[level] = (
          objOrMsg?: object | string,
          maybeMsg?: string,
          ...args: unknown[]
        ): void => {
          const emf = buildEMF(ctx)

          let obj = {}
          let msg = maybeMsg

          if (typeof objOrMsg === 'object' && objOrMsg !== null) {
            obj = objOrMsg
          } else if (typeof objOrMsg === 'string') {
            msg = objOrMsg
          }

          const merged = { ...emf, ...obj }
          return logger[level](merged, msg, ...args)
        }
      })

      return proxy
    }

    return extended
  }
}
