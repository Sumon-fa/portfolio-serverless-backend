import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { Resume } from './model';

export class MissingFieldError extends Error {}

export function validateAsResumeEntry(arg: any) {
  if (!(arg as Resume).name) {
    throw new MissingFieldError('Value for name required!');
  }
  if (!(arg as Resume).introduction) {
    throw new MissingFieldError('Value for introduction required!');
  }
  if (!(arg as Resume).id) {
    throw new MissingFieldError('Value for id required!');
  }
  if (!(arg as Resume).birthday) {
    throw new MissingFieldError('Value for birthday required!');
  }
  if (!(arg as Resume).linkedin) {
    throw new MissingFieldError('Value for linkedin required!');
  }
  if (!(arg as Resume).city) {
    throw new MissingFieldError('Value for city required!');
  }
  if (!(arg as Resume).github) {
    throw new MissingFieldError('Value for github required!');
  }
  if (!(arg as Resume).bitbucket) {
    throw new MissingFieldError('Value for bitbucket required!');
  }
  if (!(arg as Resume).phone) {
    throw new MissingFieldError('Value for phone required!');
  }
  if (!(arg as Resume).image) {
    throw new MissingFieldError('Value for image required!');
  }
  if (!(arg as Resume).degree) {
    throw new MissingFieldError('Value for degree required!');
  }
  if (!(arg as Resume).conclusion) {
    throw new MissingFieldError('Value for conclusion required!');
  }
}
export function addCorsHeader(result: APIGatewayProxyResult) {
  result.headers = {
    'Content-type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': '*',
  };
}

export function isIncludedInGroup(event: APIGatewayProxyEvent) {
  const groups = event.requestContext.authorizer?.claims['cognito:groups'];
  if (groups) {
    return (groups as string).includes('admins');
  } else {
    return false;
  }
}
