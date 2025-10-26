# pino-cloudwatch-metrics

A Pino plugin that enables seamless integration with AWS CloudWatch Metrics using the [Embedded Metric Format (EMF)](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/CloudWatch_Embedded_Metric_Format.html). This allows you to emit CloudWatch metrics directly from your Pino logs without additional API calls.

## Features

- 🚀 **Zero overhead**: Metrics are embedded in your logs using EMF
- 📊 **Type-safe**: Full TypeScript support with comprehensive type definitions
- 🔧 **Flexible**: Support for custom namespaces, dimensions, and metric units
- 🎯 **Simple API**: Chainable, intuitive method calls
- 📦 **Lightweight**: Minimal dependencies, built on top of Pino

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