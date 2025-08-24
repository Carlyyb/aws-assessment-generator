// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { logger } from './pt';

export interface RetryConfig {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  exponentialBackoff: boolean;
  retryableErrors: string[];
}

export class RetryHandler {
  private config: RetryConfig;

  constructor(config: Partial<RetryConfig> = {}) {
    this.config = {
      maxAttempts: config.maxAttempts || 3,
      baseDelayMs: config.baseDelayMs || 1000,
      maxDelayMs: config.maxDelayMs || 30000,
      exponentialBackoff: config.exponentialBackoff !== false,
      retryableErrors: config.retryableErrors || [
        'ThrottlingException',
        'InternalServerError',
        'ServiceUnavailable',
        'TooManyRequestsException',
        'ValidationException'
      ]
    };
  }

  async executeWithRetry<T>(
    operation: () => Promise<T>,
    operationName: string,
    context?: any
  ): Promise<T> {
    let lastError: Error;
    
    for (let attempt = 1; attempt <= this.config.maxAttempts; attempt++) {
      try {
        logger.info(`Executing operation attempt ${attempt}`, { 
          operationName, 
          attempt, 
          context 
        });

        const result = await operation();
        
        if (attempt > 1) {
          logger.info(`Operation succeeded after retry`, { 
            operationName, 
            attempt, 
            context 
          });
        }
        
        return result;

      } catch (error) {
        lastError = error as Error;
        
        logger.warn(`Operation failed on attempt ${attempt}`, {
          operationName,
          attempt,
          error: lastError.message,
          context
        });

        // 检查是否是可重试的错误
        if (!this.isRetryableError(lastError)) {
          logger.error(`Non-retryable error encountered`, {
            operationName,
            error: lastError.message,
            errorName: lastError.name,
            context
          });
          throw lastError;
        }

        // 如果是最后一次尝试，抛出错误
        if (attempt === this.config.maxAttempts) {
          logger.error(`Operation failed after ${this.config.maxAttempts} attempts`, {
            operationName,
            error: lastError.message,
            context
          });
          throw lastError;
        }

        // 计算延迟时间并等待
        const delay = this.calculateDelay(attempt);
        logger.info(`Waiting ${delay}ms before retry`, { 
          operationName, 
          attempt, 
          nextAttempt: attempt + 1 
        });
        
        await this.sleep(delay);
      }
    }

    throw lastError!;
  }

  private isRetryableError(error: Error): boolean {
    // 检查错误名称
    if (this.config.retryableErrors.includes(error.name)) {
      return true;
    }

    // 检查错误消息中的关键字
    const errorMessage = error.message.toLowerCase();
    const retryableKeywords = [
      'throttl',
      'rate limit',
      'too many requests',
      'service unavailable',
      'internal server error',
      'timeout',
      'connection reset',
      'network'
    ];

    return retryableKeywords.some(keyword => errorMessage.includes(keyword));
  }

  private calculateDelay(attempt: number): number {
    if (!this.config.exponentialBackoff) {
      return this.config.baseDelayMs;
    }

    // 指数退避算法，添加一些随机性（抖动）
    const exponentialDelay = this.config.baseDelayMs * Math.pow(2, attempt - 1);
    const jitteredDelay = exponentialDelay * (0.5 + Math.random() * 0.5);
    
    return Math.min(jitteredDelay, this.config.maxDelayMs);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// 创建一个默认的重试处理器实例
export const defaultRetryHandler = new RetryHandler();
