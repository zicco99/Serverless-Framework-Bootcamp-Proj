import sinon from 'sinon';
import {APIGatewayEvent, SQSEvent} from 'aws-lambda';
import { Context } from 'aws-lambda/handler';

import { handler } from '../index';


describe('App', () => {
  describe('handler', () => {
    it('should export a function', () => {
      return typeof handler === 'function';
    });
  });

  describe('execution', () => {
    const sandBox = sinon.createSandbox();
    const event: APIGatewayEvent = {
      body: '',
      headers: {},
      httpMethod: '',
      isBase64Encoded: false,
      multiValueHeaders: {},
      multiValueQueryStringParameters: {},
      path: '',
      pathParameters: {},
      queryStringParameters: {},
      requestContext: {} as any,
      resource: '',
      stageVariables: {}
    };
    const context: Context = {
      awsRequestId: 'awsRequestId',
      callbackWaitsForEmptyEventLoop: false,
      functionName: 'functionName',
      functionVersion: 'functionVersion',
      invokedFunctionArn: 'invokedFunctionArn',
      logGroupName: 'logGroupName',
      logStreamName: 'logStreamName',
      memoryLimitInMB: 'memoryLimitInMB',
      getRemainingTimeInMillis(): number {
        return 0;
      },
      succeed(): void {
        return;
      },
      done: sandBox.stub(),
      fail: sandBox.stub(),
    };

    afterEach(() => {
      sandBox.reset();
      sandBox.restore();
    });

    it('should process message successfully', async () => {
      await handler(event, context);
    });
  });
});
