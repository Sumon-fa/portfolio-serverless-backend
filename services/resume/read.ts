//lambda function to get exercises
import { DynamoDB } from 'aws-sdk';
import {
  APIGatewayProxyEvent,
  APIGatewayProxyEventQueryStringParameters,
  APIGatewayProxyResult,
  Context,
} from 'aws-lambda';
import { config } from '../../test/auth/config';
import { addCorsHeader } from '../../utils/inputValidator';
const TABLE_NAME = config.TABLE_NAME;
const PRIMARY_KEY = config.PRIMARY_KEY;
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
    if (event.queryStringParameters) {
      if (PRIMARY_KEY! in event.queryStringParameters) {
        result.body = await queryWithPrimaryPartition(
          event.queryStringParameters
        );
      }
    } else {
      result.body = await scanTable();
    }
  } catch (error: any) {
    result.body = error.message;
    result.statusCode = 404;
  }
  return result;
}

async function queryWithPrimaryPartition(
  queryParams: APIGatewayProxyEventQueryStringParameters
) {
  const keyValue = queryParams[PRIMARY_KEY!];
  const queryResponse = await dbClient
    .query({
      TableName: TABLE_NAME!,
      KeyConditionExpression: '#zz = :zzzz',
      ExpressionAttributeNames: {
        '#zz': PRIMARY_KEY!,
      },
      ExpressionAttributeValues: {
        ':zzzz': keyValue,
      },
    })
    .promise();
  if (queryResponse.Items!.length < 1) {
    throw new Error('Information not found');
  } else {
    return JSON.stringify(queryResponse.Items);
  }
}

async function scanTable() {
  const queryResponse = await dbClient
    .scan({
      TableName: TABLE_NAME!,
    })
    .promise();
  if (queryResponse.Items!.length < 1) {
    throw new Error('Information not found');
  } else {
    return JSON.stringify(queryResponse.Items);
  }
}

export { handler };
