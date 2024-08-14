import middy from '@middy/core';
import httpJsonBodyParser from '@middy/http-json-body-parser';
import httpEventNormalizer from '@middy/http-event-normalizer';
import httpErrorHandler from '@middy/http-error-handler';

/**
 * Wraps a Lambda handler with common Middy middleware.
 * @param {Function} handler - The Lambda function handler.
 * @returns {Function} - The Middy-wrapped handler.
 */
export default (handler) =>
  middy(handler)
    .use(httpJsonBodyParser())
    .use(httpEventNormalizer())
    .use(httpErrorHandler());