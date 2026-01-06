import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { pinoCloudwatchMetrics } from '../../src/index.js'
import { Unit } from '../../src/types.js'
import pino from 'pino'
import path from 'path'
import os from 'os'
import fs from 'fs'

describe('pinoCloudwatchMetrics', () => {
  let baseLogger: pino.Logger
  let tmpfile: string

  beforeEach(() => {
    tmpfile = path.join(
      os.tmpdir(),
      `pino-cloudwatch-metrics-${Date.now()}.log`,
    )
    baseLogger = pino(
      { base: null },
      pino.destination({
        dest: tmpfile,
        sync: true,
      }),
    )
    // Mock system time for consistent snapshots
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2025-01-01T00:00:00.000Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('should log a metric with no dimensions', async () => {
    const logger = pinoCloudwatchMetrics()(baseLogger)

    logger
      .metric({
        Latency: { value: 200, unit: Unit.Milliseconds },
        RequestCount: 5,
      })
      .info('Test log with no dimensions in default namespace')

    const output = await fs.promises.readFile(tmpfile, 'utf-8')
    expect(output).toMatchSnapshot()
  })

  it('should log a metric in a custom namespace', async () => {
    const logger = pinoCloudwatchMetrics({ defaultNamespace: 'MilkService' })(
      baseLogger,
    )

    logger
      .metric({
        Latency: { value: 4, unit: Unit.Seconds },
        FileSize: { value: 42, unit: Unit.Megabytes },
      })
      .error('Test error log in custom namespace')

    const output = await fs.promises.readFile(tmpfile, 'utf-8')
    expect(output).toMatchSnapshot()
  })

  it('should log a metric with multiple dimensions in a custom namespace using .namespace()', async () => {
    const logger = pinoCloudwatchMetrics()(baseLogger)

    logger
      .metric({
        Latency: { value: 200, unit: Unit.Milliseconds },
        RequestCount: 5,
      })
      .dimensions({
        ServiceName: 'MilkService',
        Region: 'us-east-1',
        SomeIdentifier: 123,
      })
      .namespace('MilkService/Metrics')
      .info(
        { requestId: 'a9b2b1ea-0e9b-4e7e-8827-282d6d6ba659' },
        'Test log with dimensions',
      )

    const output = await fs.promises.readFile(tmpfile, 'utf-8')
    expect(output).toMatchSnapshot()
  })

  it('should increment a count metric using .increment()', async () => {
    const logger = pinoCloudwatchMetrics()(baseLogger)

    logger
      .increment('RequestCount')
      .dimensions({ ServiceName: 'AuthService' })
      .info('Processed request')

    const output = await fs.promises.readFile(tmpfile, 'utf-8')
    expect(output).toMatchSnapshot()
  })
})
