import { Logger } from 'pino'

export enum Unit {
  None = 'None',
  Seconds = 'Seconds',
  Microseconds = 'Microseconds',
  Milliseconds = 'Milliseconds',
  Bytes = 'Bytes',
  Kilobytes = 'Kilobytes',
  Megabytes = 'Megabytes',
  Gigabytes = 'Gigabytes',
  Terabytes = 'Terabytes',
  Bits = 'Bits',
  Kilobits = 'Kilobits',
  Megabits = 'Megabits',
  Gigabits = 'Gigabits',
  Terabits = 'Terabits',
  Percent = 'Percent',
  Count = 'Count',
  BytesPerSecond = 'Bytes/Second',
  KilobytesPerSecond = 'Kilobytes/Second',
  MegabytesPerSecond = 'Megabytes/Second',
  GigabytesPerSecond = 'Gigabytes/Second',
  TerabytesPerSecond = 'Terabytes/Second',
  BitsPerSecond = 'Bits/Second',
  KilobitsPerSecond = 'Kilobits/Second',
  MegabitsPerSecond = 'Megabits/Second',
  GigabitsPerSecond = 'Gigabits/Second',
  TerabitsPerSecond = 'Terabits/Second',
  CountPerSecond = 'Count/Second',
}

export interface MetricDefinition {
  Name: string
  Unit: Unit
}

export interface CloudWatchMetric {
  Namespace: string
  Dimensions: string[][]
  Metrics: MetricDefinition[]
}

export interface EmbeddedMetricFormat {
  _aws: {
    Timestamp: number
    CloudWatchMetrics: CloudWatchMetric[]
  }
}

export interface MetricValue {
  value: number
  unit?: Unit
}

export type Metrics = Record<string, number | MetricValue>
export type Dimensions = Record<string, string | number>

export interface MetricLogger extends Logger {
  metric(metrics: Record<string, MetricValue | number>): MetricBuilder
}

export interface MetricBuilder extends Logger {
  dimensions(dimensions: Dimensions): this
  namespace(namespace: string): this
}
