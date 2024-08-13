# Introduction to the Serverless Framework

The Serverless Framework is a powerful open-source tool designed to simplify the creation, deployment, and management of cloud-native applications. By abstracting away the complexities of server infrastructure management, it allows developers to focus on writing business logic rather than dealing with server management. This approach leverages **Function as a Service (FaaS)**, which treats individual functions as the primary building blocks of an application.

## What is FaaS (Function as a Service)?

**Function as a Service (FaaS)** is a cloud computing model where developers deploy and run individual functions in the cloud. Each function is a small, discrete piece of code that performs a specific task and is triggered by events like HTTP requests, database changes, or messaging queue updates.

![alt text]([https://github.com/[username]/[reponame]/blob/[branch]/theory/](https://github.com/zicco99/Serverless-Framework-Bootcamp-Proj/blob/main/theory/res/inside.png?raw=true)

### Key Features of FaaS

| Feature                  | Description                                                                                                    |
|--------------------------|----------------------------------------------------------------------------------------------------------------|
| **Event-Driven Execution** | Functions are executed in response to specific events, such as HTTP requests or database changes.           |
| **Automatic Scaling**      | Functions automatically scale based on demand, handling incoming load efficiently without manual intervention. |
| **Cost Efficiency**        | You pay only for the compute time your functions use, avoiding costs for idle server capacity.                |
| **No Server Management**   | The cloud provider manages server provisioning, patching, and maintenance, allowing you to focus on code.      |

## Example of a `serverless.yml` File

The `serverless.yml` file is the core configuration file in a Serverless Framework project. It defines your service's functions, the events that trigger them, and any additional resources needed.

```yaml
service: my-serverless-app

provider:
  name: aws
  runtime: nodejs18.x
  region: us-east-1

functions:
  helloWorld:
    handler: handler.helloWorld
    events:
      - http:
          path: hello
          method: get

resources:
  Resources:
    MyDynamoDBTable:
      Type: AWS::DynamoDB::Table
      Properties:
        TableName: MyTable
        AttributeDefinitions:
          - AttributeName: id
            AttributeType: S
        KeySchema:
          - AttributeName: id
            KeyType: HASH
        ProvisionedThroughput:
          ReadCapacityUnits: 5
          WriteCapacityUnits: 5
```

In this configuration:

    - service: Defines the name of the service.
    - provider: Specifies the cloud provider and runtime environment.
    - functions: Lists the Lambda functions, their handlers, and event triggers.
    - resources: Defines additional resources, such as a DynamoDB table, used by the service.

## Serverless Framework Plugins

The Serverless Framework can be extended through plugins that add functionality, automate tasks, and integrate with various tools. Below are some popular and useful plugins:

### 1. **serverless-offline**

- **Purpose**: The `serverless-offline` plugin allows you to run your Serverless applications locally, simulating AWS API Gateway, Lambda, and other AWS services. This is particularly useful for development and testing, as it enables you to test your functions without deploying them to the cloud.
  
- **Installation**:
  ```bash
  npm install serverless-offline --save-dev
  ```

### 2. **serverless-webpack**

- **Purpose**: The serverless-webpack plugin enables the use of Webpack to bundle your Serverless functions. Webpack is a powerful tool for optimizing and bundling JavaScript code, allowing you to reduce the size of your Lambda functions and include only the necessary dependencies.
  
- **Installation**:
  ```bash
  npm install serverless-webpack webpack webpack-cli --save-dev
  ```

- **Configuration**:
Additionally, create a webpack.config.js file to configure Webpack according to your project's needs:

```yaml
const path = require('path');

module.exports = {
  entry: './handler.js',
  target: 'node',
  mode: 'production',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'handler.js',
    libraryTarget: 'commonjs2'
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: 'babel-loader'
      }
    ]
  }
};

- **Integration**:
Add serverless-webpack to the plugins section of serverless.yml:
```yaml
plugins:
  - serverless-webpack
```





### 3. 





