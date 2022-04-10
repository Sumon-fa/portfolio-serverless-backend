import { DynamoDB } from 'aws-sdk';
import {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  Context,
} from 'aws-lambda';

import { v4 } from 'uuid';
import {
  isIncludedInGroup,
  MissingFieldError,
  validateAsResumeEntry,
  addCorsHeader,
} from '../../utils/inputValidator';
import { config } from '../../test/auth/config';

const TABLE_NAME = config.TABLE_NAME;
const dbClient = new DynamoDB.DocumentClient();

async function handler(
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> {
  const result: APIGatewayProxyResult = {
    statusCode: 200,
    body: 'Hello from DYnamoDb',
  };
  addCorsHeader(result);
  try {
    if (isIncludedInGroup(event)) {
      const item =
        typeof event.body == 'object' ? event.body : JSON.parse(event.body);
      item.id = v4();

      validateAsResumeEntry(item);

      await dbClient
        .put({
          TableName: TABLE_NAME!,
          Item: item,
        })
        .promise();
      result.body = JSON.stringify(`Created item with id: ${item.id}`);
    } else {
      throw new Error('Not Authorized');
    }
  } catch (error: any) {
    result.body = error.message;
    if (error instanceof MissingFieldError) {
      result.statusCode = 403;
    } else if (error instanceof Error) {
      result.statusCode = 401;
    } else {
      result.statusCode = 500;
    }
  }

  return result;
}

export { handler };
