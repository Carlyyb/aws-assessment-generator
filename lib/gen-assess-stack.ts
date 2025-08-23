// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
 
import { Construct } from 'constructs';
import { CfnOutput, Stack, StackProps } from 'aws-cdk-lib';
import { AuthStack } from './auth-stack';
import { DataStack } from './data-stack';
import { FrontendStack } from './frontend-stack';
import { LoggingStack } from './logging-stack';
import * as cr from 'aws-cdk-lib/custom-resources';
import { RagPipelineStack } from './rag-pipeline/rag-pipeline-stack';

export class GenAssessStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const authStack = new AuthStack(this, 'AuthStack');

    const ragPipipelineStack = new RagPipelineStack(this, 'RagStack');
    // 添加日志系统
    const loggingStack = new LoggingStack(this, 'LoggingStack');

    const { api } = new DataStack(this, 'DataStack', {
      userPool: authStack.userPool,
      postConfirmationLambda: authStack.postConfirmationLambda,
      artifactsUploadBucket: ragPipipelineStack.artifactsUploadBucket,
      documentProcessorLambda: ragPipipelineStack.documentProcessor,
      kbTable: ragPipipelineStack.kbTable,
      logQueryFunction: loggingStack.logQueryFunction, // 传递日志查询函数
    });

    const frontendStack = new FrontendStack(this, 'FrontendStack', { ...props, graphqlUrl: api.graphqlUrl });

    ragPipipelineStack.artifactsUploadBucket.grantReadWrite(authStack.identityPool.authenticatedRole);

    const config = {
      Auth: {
        Cognito: {
          userPoolId: authStack.userPool.userPoolId,
          userPoolClientId: authStack.client.userPoolClientId,
          identityPoolId: authStack.identityPool.identityPoolId,
        },
      },
      API: {
        GraphQL: {
          endpoint: api.graphqlUrl,
          region: this.region,
          defaultAuthMode: 'userPool',
        },
      },
      Storage: {
        S3: {
          region: this.region,
          bucket: ragPipipelineStack.artifactsUploadBucket.bucketName,
        },
      },
    };

    const putConfig = new cr.AwsCustomResource(this, 'PutConfig', {
      onUpdate: {
        service: 'S3',
        action: 'putObject',
        parameters: {
          Bucket: frontendStack.bucket.bucketName,
          Key: 'config.json',
          Body: JSON.stringify(config),
          ContentType: 'application/json',
        },
        physicalResourceId: cr.PhysicalResourceId.of('config-json-' + Date.now()),
      },
      onCreate: {
        service: 'S3',
        action: 'putObject',
        parameters: {
          Bucket: frontendStack.bucket.bucketName,
          Key: 'config.json',
          Body: JSON.stringify(config),
          ContentType: 'application/json',
        },
        physicalResourceId: cr.PhysicalResourceId.of('config-json-' + Date.now()),
      },
      policy: cr.AwsCustomResourcePolicy.fromSdkCalls({
        resources: [frontendStack.bucket.bucketArn, `${frontendStack.bucket.bucketArn}/*`],
      }),
      installLatestAwsSdk: false,
    });

    putConfig.node.addDependency(frontendStack.assetDeployment);
    putConfig.node.addDependency(authStack);

    new CfnOutput(this, 'UiConfing', {
      value: JSON.stringify(config),
    });

    new CfnOutput(this, 'ApplicationUrl', {
      value: frontendStack.applicationURL,
    });

    new CfnOutput(this, 'RAGBucketSource', {
      value: ragPipipelineStack.artifactsUploadBucket.bucketName,
    });
  }
}
