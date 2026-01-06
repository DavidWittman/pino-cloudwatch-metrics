/* eslint-disable @typescript-eslint/no-explicit-any */

import { describe, it, beforeEach, vi, expect, Mocked } from 'vitest'
import { pinoCloudwatchMetrics } from '../../src/index.js'
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

    it('should stringify dimension values for EMF format', () => {
      logger
        .metric({ RequestCount: 1 })
        .dimensions({
          ServiceName: 'AuthService',
          Port: 8080,
          UserId: 12345,
        })
        .info('Testing dimension stringification')

      expect(mockLogger.info).toHaveBeenCalledTimes(1)

      const [logObject] = mockLogger.info.mock.calls[0] as any
      // All dimension values should be strings
      expect(logObject.ServiceName).toBe('AuthService')
      expect(logObject.Port).toBe('8080')
      expect(logObject.UserId).toBe('12345')
      // Verify numeric dimensions are converted to strings
      expect(typeof logObject.Port).toBe('string')
      expect(typeof logObject.UserId).toBe('string')
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

  describe('increment method', () => {
    it('should exist on the logger', () => {
      expect(typeof logger.increment).toBe('function')
    })

    it('should accept a single metric name', () => {
      const metricBuilder = logger.increment('RequestCount')

      expect(typeof metricBuilder).toBe('object')
      expect(typeof metricBuilder.dimensions).toBe('function')
      expect(typeof metricBuilder.namespace).toBe('function')
      expect(typeof metricBuilder.info).toBe('function')
    })

    it('should create a metric with value 1 and unit Count', () => {
      logger.increment('ErrorCount').info('An error occurred')

      expect(mockLogger.info).toHaveBeenCalledTimes(1)

      const [logObject] = mockLogger.info.mock.calls[0] as any
      expect(logObject.ErrorCount).toBe(1)
      expect(logObject._aws.CloudWatchMetrics[0].Metrics[0]).toEqual({
        Name: 'ErrorCount',
        Unit: Unit.Count,
      })
    })

    it('should be chainable with dimensions', () => {
      const result = logger
        .increment('RequestCount')
        .dimensions({ ServiceName: 'AuthService', Region: 'us-east-1' })

      expect(typeof result.info).toBe('function')
    })

    it('should be chainable with namespace', () => {
      const result = logger
        .increment('RequestCount')
        .namespace('CustomApp/Metrics')

      expect(typeof result.info).toBe('function')
    })

    it('should work with all chaining methods', () => {
      logger
        .increment('LoginAttempts')
        .namespace('MyApp/Auth')
        .dimensions({ ServiceName: 'AuthService', Environment: 'production' })
        .info({ userId: '12345' }, 'User login attempt')

      expect(mockLogger.info).toHaveBeenCalledTimes(1)

      const [logObject, message] = mockLogger.info.mock.calls[0] as any
      expect(message).toBe('User login attempt')
      expect(logObject.LoginAttempts).toBe(1)
      expect(logObject.userId).toBe('12345')
      expect(logObject.ServiceName).toBe('AuthService')
      expect(logObject.Environment).toBe('production')
      expect(logObject._aws.CloudWatchMetrics[0].Namespace).toBe('MyApp/Auth')
      expect(logObject._aws.CloudWatchMetrics[0].Metrics[0]).toEqual({
        Name: 'LoginAttempts',
        Unit: Unit.Count,
      })
    })

    it('should work with different log levels', () => {
      const metricLogger = logger.increment('ProcessedItems')

      metricLogger.info('Item processed')
      metricLogger.debug('Debug: item processed')
      metricLogger.warn('Warning: slow processing')

      expect(mockLogger.info).toHaveBeenCalledTimes(1)
      expect(mockLogger.debug).toHaveBeenCalledTimes(1)
      expect(mockLogger.warn).toHaveBeenCalledTimes(1)

      // All should have the same metric structure
      const [infoLog] = mockLogger.info.mock.calls[0] as any
      const [debugLog] = mockLogger.debug.mock.calls[0] as any
      const [warnLog] = mockLogger.warn.mock.calls[0] as any

      expect(infoLog.ProcessedItems).toBe(1)
      expect(debugLog.ProcessedItems).toBe(1)
      expect(warnLog.ProcessedItems).toBe(1)
    })

    it('should use default namespace when none specified', () => {
      logger.increment('CacheHits').info('Cache hit')

      const [logObject] = mockLogger.info.mock.calls[0] as any
      expect(logObject._aws.CloudWatchMetrics[0].Namespace).toBe('Pino')
    })

    it('should respect custom default namespace from config', () => {
      const plugin = pinoCloudwatchMetrics({
        defaultNamespace: 'MyCustomApp',
      })
      const customLogger = plugin(mockLogger)

      customLogger.increment('CustomMetric').info('Test')

      const [logObject] = mockLogger.info.mock.calls[0] as any
      expect(logObject._aws.CloudWatchMetrics[0].Namespace).toBe('MyCustomApp')
    })

    it('should allow multiple increment calls for different metrics', () => {
      logger.increment('SuccessCount').info('Success')
      logger.increment('FailureCount').warn('Failure')

      expect(mockLogger.info).toHaveBeenCalledTimes(1)
      expect(mockLogger.warn).toHaveBeenCalledTimes(1)

      const [successLog] = mockLogger.info.mock.calls[0] as any
      const [failureLog] = mockLogger.warn.mock.calls[0] as any

      expect(successLog.SuccessCount).toBe(1)
      expect(failureLog.FailureCount).toBe(1)
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
