/* eslint-disable @typescript-eslint/no-explicit-any */

import { describe, it, beforeEach, vi, expect, Mocked } from 'vitest'
import { pinoCloudwatchMetrics } from '../../src/main.js'
import { MetricLogger, Unit } from '../../src/types.js'
import { Logger } from 'pino'

describe('pinoCloudwatchMetrics', () => {
  let mockLogger: Mocked<Logger>
  let logger: MetricLogger

  beforeEach(() => {
    mockLogger = {
      trace: vi.fn(),
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      fatal: vi.fn(),
    } as unknown as Mocked<Logger>

    logger = pinoCloudwatchMetrics()(mockLogger)
  })

  describe('plugin initialization', () => {
    it('should return a function that extends the logger', () => {
      const plugin = pinoCloudwatchMetrics()
      expect(typeof plugin).toBe('function')
    })

    it('should add metric method to logger', () => {
      expect(typeof logger.metric).toBe('function')
    })
  })

  describe('metric method', () => {
    it('should accept simple numeric metrics', () => {
      const metricLogger = logger.metric({
        RequestCount: 1,
        ResponseTime: 250,
      })

      expect(typeof metricLogger).toBe('object')
      expect(typeof metricLogger.dimensions).toBe('function')
      expect(typeof metricLogger.namespace).toBe('function')
    })

    it('should accept metrics with units', () => {
      const metricLogger = logger.metric({
        Latency: { value: 123, unit: Unit.Milliseconds },
        ErrorCount: { value: 5, unit: Unit.Count },
      })

      expect(typeof metricLogger).toBe('object')
    })
  })

  describe('dimensions method', () => {
    it('should allow setting dimensions', () => {
      const metricBuilder = logger
        .metric({ RequestCount: 1 })
        .dimensions({ ServiceName: 'AuthService', Region: 'us-east-1' })

      expect(typeof metricBuilder.info).toBe('function')
    })

    it('should be chainable', () => {
      const result = logger
        .metric({ RequestCount: 1 })
        .dimensions({ ServiceName: 'AuthService' })
        .dimensions({ Region: 'us-east-1' })

      expect(typeof result.info).toBe('function')
    })
  })

  describe('namespace method', () => {
    it('should allow setting custom namespace', () => {
      const metricBuilder = logger
        .metric({ RequestCount: 1 })
        .namespace('CustomApp/Metrics')

      expect(typeof metricBuilder.info).toBe('function')
    })

    it('should be chainable with dimensions', () => {
      const result = logger
        .metric({ RequestCount: 1 })
        .namespace('CustomApp/Metrics')
        .dimensions({ ServiceName: 'AuthService' })

      expect(typeof result.info).toBe('function')
    })
  })

  describe('logging with metrics', () => {
    it('should call underlying logger.info with EMF format', () => {
      logger
        .metric({ RequestCount: 1 })
        .dimensions({ ServiceName: 'AuthService' })
        .info({ requestId: 'abc123' }, 'Request processed')

      expect(mockLogger.info).toHaveBeenCalledTimes(1)

      const [logObject, message] = mockLogger.info.mock.calls[0]
      expect(message).toBe('Request processed')
      expect(logObject).toHaveProperty('_aws')
      expect(logObject).toHaveProperty('ServiceName', 'AuthService')
      expect(logObject).toHaveProperty('RequestCount', 1)
      expect(logObject).toHaveProperty('requestId', 'abc123')
    })

    it('should include CloudWatch metrics metadata in EMF format', () => {
      logger
        .metric({ Latency: { value: 250, unit: Unit.Milliseconds } })
        .dimensions({ ServiceName: 'API' })
        .info('Response sent')

      const [logObject] = mockLogger.info.mock.calls[0] as any
      expect(logObject._aws).toHaveProperty('Timestamp')
      expect(logObject._aws).toHaveProperty('CloudWatchMetrics')
      expect(logObject._aws.CloudWatchMetrics[0]).toHaveProperty(
        'Namespace',
        'Pino',
      )
      expect(logObject._aws.CloudWatchMetrics[0]).toHaveProperty('Dimensions', [
        ['ServiceName'],
      ])
      expect(logObject._aws.CloudWatchMetrics[0].Metrics[0]).toEqual({
        Name: 'Latency',
        Unit: Unit.Milliseconds,
      })
    })

    it('should work with different log levels', () => {
      const metricLogger = logger
        .metric({ ErrorCount: 1 })
        .dimensions({ ServiceName: 'API' })

      metricLogger.error('An error occurred')
      metricLogger.warn('A warning')
      metricLogger.debug('Debug info')

      expect(mockLogger.error).toHaveBeenCalledTimes(1)
      expect(mockLogger.warn).toHaveBeenCalledTimes(1)
      expect(mockLogger.debug).toHaveBeenCalledTimes(1)
    })

    it('should use default namespace when none specified', () => {
      logger.metric({ RequestCount: 1 }).info('Default namespace test')

      const [logObject] = mockLogger.info.mock.calls[0] as any
      expect(logObject._aws.CloudWatchMetrics[0]).toHaveProperty(
        'Namespace',
        'Pino',
      )
    })

    it('should use custom namespace when specified', () => {
      logger
        .metric({ RequestCount: 1 })
        .namespace('MyApp/Custom')
        .info('Custom namespace test')

      const [logObject] = mockLogger.info.mock.calls[0] as any
      expect(logObject._aws.CloudWatchMetrics[0]).toHaveProperty(
        'Namespace',
        'MyApp/Custom',
      )
    })
  })

  describe('plugin configuration', () => {
    it('should use custom default namespace', () => {
      const plugin = pinoCloudwatchMetrics({
        defaultNamespace: 'CustomApp/Metrics',
      })
      const customLogger = plugin(mockLogger)

      customLogger
        .metric({ RequestCount: 1 })
        .info('Custom default namespace test')

      const [logObject] = mockLogger.info.mock.calls[0] as any
      expect(logObject._aws.CloudWatchMetrics[0]).toHaveProperty(
        'Namespace',
        'CustomApp/Metrics',
      )
    })
  })
})
