import { CfnOutput, RemovalPolicy } from 'aws-cdk-lib';
import { Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import { AttributeType, Table } from 'aws-cdk-lib/aws-dynamodb';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { join } from 'path';
import {
  AuthorizationType,
  CognitoUserPoolsAuthorizer,
  Cors,
  LambdaIntegration,
  MethodOptions,
  ResourceOptions,
  RestApi,
} from 'aws-cdk-lib/aws-apigateway';
import {
  CfnIdentityPool,
  CfnIdentityPoolRoleAttachment,
  CfnUserPoolGroup,
} from 'aws-cdk-lib/aws-cognito';
import {
  Effect,
  FederatedPrincipal,
  PolicyStatement,
  Role,
} from 'aws-cdk-lib/aws-iam';
import { Bucket, HttpMethods } from 'aws-cdk-lib/aws-s3';

export class ServerStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);
    // ========================================================================================================================================
    // Cognito Userpool Authentication
    // ========================================================================================================================================

    const userPool = new cognito.UserPool(this, 'PortfolioUserPool', {
      userPoolName: 'PortfolioUserPool',
      selfSignUpEnabled: true,
      autoVerify: { email: true },
      signInAliases: {
        username: true,
        email: true,
      },
      passwordPolicy: {
        minLength: 6,
      },
    });

    new CfnOutput(this, 'UserPoolId', {
      value: userPool.userPoolId,
    });
    const userPoolClient = userPool.addClient('PortfolioUserPool-client', {
      userPoolClientName: 'PortfolioUserPool-client',
      authFlows: {
        adminUserPassword: true,
        custom: true,
        userPassword: true,
        userSrp: true,
      },
      generateSecret: false,
    });
    new CfnOutput(this, 'UserPoolClientId', {
      value: userPoolClient.userPoolClientId,
    });
    // ========================================================================================================================================
    // Creating RestApi for Resume.
    // ========================================================================================================================================

    const api = new RestApi(this, 'resumeApi');
    // ========================================================================================================================================
    // Creating Authoriser.
    // ========================================================================================================================================
    const authorizer = new CognitoUserPoolsAuthorizer(this, 'RsumeAuthorizer', {
      cognitoUserPools: [userPool],
      authorizerName: 'ResumeAuthorizer',
      identitySource: 'method.request.header.Authorization',
    });
    authorizer._attachToApi(api);
    // ========================================================================================================================================
    // Creating Group.
    // ========================================================================================================================================
    new CfnUserPoolGroup(this, 'admins', {
      groupName: 'admins',
      userPoolId: userPool.userPoolId,
    });
    // ========================================================================================================================================
    // Image upload
    // ========================================================================================================================================
    const resumePhotosBucket = new Bucket(this, 'resume-photos', {
      bucketName: 'resume-photos-' + this.urlSuffix,
      cors: [
        {
          allowedMethods: [HttpMethods.HEAD, HttpMethods.GET, HttpMethods.PUT],
          allowedOrigins: ['*'],
          allowedHeaders: ['*'],
        },
      ],
    });
    new CfnOutput(this, 'resume-photos-bucket-name', {
      value: resumePhotosBucket.bucketName,
    });

    const profilePhotosBucket = new Bucket(this, 'profile-photos', {
      bucketName: 'profile-photos-' + this.urlSuffix,
      cors: [
        {
          allowedMethods: [HttpMethods.HEAD, HttpMethods.GET, HttpMethods.PUT],
          allowedOrigins: ['*'],
          allowedHeaders: ['*'],
        },
      ],
    });
    new CfnOutput(this, 'profile-photos-bucket-name', {
      value: profilePhotosBucket.bucketName,
    });

    const projectPhotosBucket = new Bucket(this, 'project-photos', {
      bucketName: 'project-photos-' + this.urlSuffix,
      cors: [
        {
          allowedMethods: [HttpMethods.HEAD, HttpMethods.GET, HttpMethods.PUT],
          allowedOrigins: ['*'],
          allowedHeaders: ['*'],
        },
      ],
    });
    new CfnOutput(this, 'project-photos-bucket-name', {
      value: projectPhotosBucket.bucketName,
    });

    const uploadResumePhotos = new PolicyStatement({
      effect: Effect.ALLOW,
      actions: ['s3:PutObject', 's3:PutObjectAcl'],
      resources: [resumePhotosBucket.bucketArn + '/*'],
    });
    const uploadProjectPhoto = new PolicyStatement({
      effect: Effect.ALLOW,
      actions: ['s3:PutObject', 's3:PutObjectAcl'],
      resources: [projectPhotosBucket.bucketArn + '/*'],
    });
    const uploadProfilePhoto = new PolicyStatement({
      effect: Effect.ALLOW,
      actions: ['s3:PutObject', 's3:PutObjectAcl'],
      resources: [profilePhotosBucket.bucketArn + '/*'],
    });

    // ========================================================================================================================================
    // Identitypool
    // ========================================================================================================================================

    const identityPool = new CfnIdentityPool(this, 'PortfolioIdentityPool', {
      allowUnauthenticatedIdentities: true,
      cognitoIdentityProviders: [
        {
          clientId: userPoolClient.userPoolClientId,
          providerName: userPool.userPoolProviderName,
        },
      ],
    });
    new CfnOutput(this, 'IdentityPoolId', {
      value: identityPool.ref,
    });

    const authenticatedRole = new Role(
      this,
      'CognitoDefaultAuthenticatedRole',
      {
        assumedBy: new FederatedPrincipal(
          'cognito-identity.amazonaws.com',
          {
            StringEquals: {
              'cognito-identity.amazonaws.com:aud': identityPool.ref,
            },
            'ForAnyValue:StringLike': {
              'cognito-identity.amazonaws.com:amr': 'authenticated',
            },
          },
          'sts:AssumeRoleWithWebIdentity'
        ),
      }
    );
    authenticatedRole.addToPolicy(uploadProfilePhoto);

    const unAuthenticatedRole = new Role(
      this,
      'CognitoDefaultUnAuthenticatedRole',
      {
        assumedBy: new FederatedPrincipal(
          'cognito-identity.amazonaws.com',
          {
            StringEquals: {
              'cognito-identity.amazonaws.com:aud': identityPool.ref,
            },
            'ForAnyValue:StringLike': {
              'cognito-identity.amazonaws.com:amr': 'unauthenticated',
            },
          },
          'sts:AssumeRoleWithWebIdentity'
        ),
      }
    );

    const adminRole = new Role(this, 'CognitoAdminRole', {
      assumedBy: new FederatedPrincipal(
        'cognito-identity.amazonaws.com',
        {
          StringEquals: {
            'cognito-identity.amazonaws.com:aud': identityPool.ref,
          },
          'ForAnyValue:StringLike': {
            'cognito-identity.amazonaws.com:amr': 'authenticated',
          },
        },
        'sts:AssumeRoleWithWebIdentity'
      ),
    });

    adminRole.addToPolicy(uploadResumePhotos);
    adminRole.addToPolicy(uploadProjectPhoto);

    new CfnIdentityPoolRoleAttachment(this, 'RolesAttachment', {
      identityPoolId: identityPool.ref,
      roles: {
        authenticated: authenticatedRole.roleArn,
        unauthenticated: unAuthenticatedRole.roleArn,
      },
      roleMappings: {
        adminsMapping: {
          type: 'Token',
          ambiguousRoleResolution: 'AuthenticatedRole',
          identityProvider: `${userPool.userPoolProviderName}:${userPoolClient.userPoolClientId}`,
        },
      },
    });

    // ========================================================================================================================================
    // Dynamodb Table creation for Resume
    // ========================================================================================================================================

    const resumeTable = new Table(this, 'ResumeTable', {
      partitionKey: {
        name: 'id',
        type: AttributeType.STRING,
      },
      tableName: 'ResumeTable',
      removalPolicy: RemovalPolicy.DESTROY,
    });

    // ========================================================================================================================================
    // Lamda function integration with Dynamodb ResumeTable
    // ========================================================================================================================================

    const createResumeFunction = new NodejsFunction(this, 'createResume', {
      entry: join(__dirname, '..', 'services', 'resume', 'create.ts'),
      handler: 'handler',
    });
    const readResumeFunction = new NodejsFunction(this, 'readResume', {
      entry: join(__dirname, '..', 'services', 'resume', 'read.ts'),
      handler: 'handler',
    });

    resumeTable.grantWriteData(createResumeFunction);
    resumeTable.grantReadData(readResumeFunction);

    const createLambdaIntegration = new LambdaIntegration(createResumeFunction);
    const readLambdaIntegration = new LambdaIntegration(readResumeFunction);

    const optionsWithCors: ResourceOptions = {
      defaultCorsPreflightOptions: {
        allowOrigins: Cors.ALL_ORIGINS,
        allowMethods: Cors.ALL_METHODS,
      },
    };
    const optionsWithAuthorizer: MethodOptions = {
      authorizationType: AuthorizationType.COGNITO,
      authorizer: {
        authorizerId: authorizer.authorizerId,
      },
    };

    // ========================================================================================================================================
    // Resume Routes
    // ========================================================================================================================================

    const resumeResources = api.root.addResource('resume', optionsWithCors);
    resumeResources.addMethod(
      'POST',
      createLambdaIntegration,
      optionsWithAuthorizer
    );
    resumeResources.addMethod('GET', readLambdaIntegration);
  }
}
