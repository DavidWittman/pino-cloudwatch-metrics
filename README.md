# pino-cloudwatch-metrics

A Pino plugin that enables seamless integration with AWS CloudWatch Metrics using the [Embedded Metric Format (EMF)](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/CloudWatch_Embedded_Metric_Format.html). This allows you to emit CloudWatch metrics directly from your Pino logs without additional API calls.

## Features

- 🚀 **Zero overhead**: Metrics are embedded in your logs using EMF
- 📊 **Type-safe**: Full TypeScript support with comprehensive type definitions
- 🔧 **Flexible**: Support for custom namespaces, dimensions, and metric units
- 🎯 **Simple API**: Chainable, intuitive method calls
- 📦 **Lightweight**: Minimal dependencies, built on top of Pino
- 🔄 **Dimension rollups**: Aggregate metrics across multiple dimension sets in a single log line

## Installation

```bash
npm install pino-cloudwatch-metrics
```

## Usage

### Basic Setup

```typescript
import pino from 'pino'
import { pinoCloudwatchMetrics, Unit } from 'pino-cloudwatch-metrics'

const logger = pinoCloudwatchMetrics()(pino())
```

### Simple Metric Logging

```typescript
// Log a metric to the default metric namespace
logger.metric({
  Latency: { value: 200, unit: Unit.Milliseconds },
  RequestCount: 5,
})
.info('Processed request')
```

### Incrementing Count Metrics

For the common use case of incrementing a count metric, use the `.increment()` method as a shorthand:

```typescript
// Instead of writing this:
logger.metric({ 
  RequestCount: { value: 1, unit: Unit.Count } 
}).info('Request processed')

// You can simply write:
logger.increment('RequestCount').info('Request processed')
```

The `.increment()` method automatically creates a metric with a value of 1 and unit of `Count`. It supports the same chaining as `.metric()`:

```typescript
logger
  .increment('LoginAttempts')
  .dimensions({ ServiceName: 'AuthService', Environment: 'production' })
  .namespace('MyApp/Auth')
  .info('User login attempt')
```

### Custom Namespace

```typescript
// Configure default namespace
const logger = pinoCloudwatchMetrics({ 
  defaultNamespace: 'MyApplication' 
})(pino())

logger.metric({
  Latency: { value: 200, unit: Unit.Milliseconds }
})
.info('Request processed')

// Or override namespace per metric
logger.metric({
  Latency: { value: 200, unit: Unit.Milliseconds }
})
.namespace('MyApplication/Metrics')
.info('API request processed')
```

### Adding Dimensions

Dimensions allow you to filter and aggregate metrics in CloudWatch:

```typescript
logger.metric({
  Latency: { value: 200, unit: Unit.Milliseconds },
  RequestCount: 1,
})
.dimensions({
  ServiceName: 'AuthService',
  Region: 'us-east-1',
  Environment: 'production'
})
.info({ requestId: 'abc123' }, 'User authenticated')
```

### Rolling Up Dimensions

CloudWatch supports publishing the same metric under multiple dimension sets from a single log entry. This is useful when you want to query metrics both at a granular level (e.g. per-service per-region) and at a rolled-up level (e.g. per-service, or globally) without emitting multiple log lines.

Use `.rollup()` to specify additional, less-granular dimension sets. The dimensions set via `.dimensions()` is always the most specific set; each set passed to `.rollup()` is appended as an additional aggregation level:

```typescript
logger
  .metric({ RequestCount: 1, Latency: { value: 200, unit: Unit.Milliseconds } })
  .dimensions({ ServiceName: 'AuthService', Region: 'us-east-1' })
  .rollup(
    ['ServiceName'], // aggregate across all regions for this service
    [],              // aggregate globally across all dimensions
  )
  .info('Request processed')
```

This produces a single log line with three dimension sets, causing CloudWatch to publish three separate metric time series:

| Dimension set | What it aggregates |
|---|---|
| `["ServiceName", "Region"]` | Per-service, per-region (most granular) |
| `["ServiceName"]` | Per-service across all regions |
| `[]` | Global across all services and regions |

`.rollup()` is chainable and can be called multiple times — dimension sets accumulate across calls:

```typescript
logger
  .increment('Errors')
  .dimensions({ ServiceName: 'AuthService', Region: 'us-east-1' })
  .rollup(['ServiceName'])
  .rollup([])
  .warn('Something went wrong')
```

## How It Works

This plugin uses the [AWS CloudWatch Embedded Metric Format (EMF)](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/CloudWatch_Embedded_Metric_Format.html) to embed metrics directly in your log output. When these logs are sent to CloudWatch Logs (via CloudWatch Agent, Lambda, or other means), the metrics are automatically extracted and made available in CloudWatch Metrics.

### Example Output

```json
{
  "level": 30,
  "time": 1735689600000,
  "msg": "User authenticated",
  "requestId": "abc123",
  "_aws": {
    "Timestamp": 1735689600000,
    "CloudWatchMetrics": [
      {
        "Namespace": "AuthService",
        "Dimensions": [["ServiceName", "Region"]],
        "Metrics": [
          { "Name": "Latency", "Unit": "Milliseconds" },
          { "Name": "RequestCount", "Unit": "None" }
        ]
      }
    ]
  },
  "ServiceName": "AuthService",
  "Region": "us-east-1",
  "Latency": 200,
  "RequestCount": 1
}
```

## Requirements

- Node.js >= 20
- Pino >= 10

## Development

### Integration Tests

The integration tests use [snapshot testing](https://vitest.dev/guide/snapshot) to verify behavior. If something about the output format changes and you need to update the snapshots, run the following command:

```
npm run test:integration -- --update
```