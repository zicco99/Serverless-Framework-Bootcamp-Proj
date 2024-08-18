# NestJS in a Nutshell

NestJS is a progressive Node.js framework tailored for building efficient, reliable, and scalable server-side applications. It is built on top of Express (or optionally Fastify) and leverages TypeScript, offering a strong structure for developing complex applications.

NestJS employs a modular architecture, which allows you to organize your code into discrete modules. This approach makes it easier to manage and scale your application, as each module encapsulates its own functionality and dependencies.

A key feature of NestJS is its use of dependency injection to manage the application's services and components. This practice promotes loose coupling, enhances reusability, and simplifies testing. The framework also makes extensive use of decorators, such as `@Controller`, `@Injectable`, and `@Module`, to define and configure components, contributing to more readable and expressive code.

Built with TypeScript, NestJS benefits from strong typing, modern JavaScript features, and improved tooling support. This not only enhances code quality but also boosts developer productivity by catching errors at compile-time.

NestJS comes with built-in support for common design patterns and practices, including MVC (Model-View-Controller), Microservices, GraphQL, WebSockets, and RESTful APIs. The framework is highly extensible, allowing developers to customize it with their own providers, interceptors, guards, and middleware to meet specific application needs. It also integrates seamlessly with other libraries and frameworks.

The architecture of NestJS promotes scalability and maintainability, making it suitable for both small projects and large-scale enterprise applications. Additionally, its design encourages writing unit and integration tests, further supporting the development of reliable and robust applications.

---

## Basic Concepts

### 1. **Modules**
Modules are the fundamental building blocks of a NestJS application. Here are the main concepts:

- **Root Module**: Each application has at least one module—the root module—which serves as the entry point for the app.
  
- **Separation of Concerns**: Modules facilitate the separation of concerns by organizing components around closely related capabilities. This modular approach makes it easier to manage and scale the app.

- **Folder Structure**: It’s good practice to have a folder per module to maintain a clear separation of logic.

- **Singletons**: Modules in NestJS are singletons, meaning that a module is instantiated once and can be imported by multiple other modules. This allows for shared functionality and consistent behavior across different parts of the application.

#### Defining a module

A module in NestJS is defined using the `@Module` decorator. This decorator provides metadata that helps organize the application. Key properties include:

- **providers**: An array of classes (annotated with `@Injectable()`) available for dependency injection, which handle business logic and data access.

- **controllers**: An array of classes responsible for handling incoming HTTP requests and routing.

- **imports**: An array of other modules to integrate their providers and controllers into the current module.

- **exports**: An array of providers that can be used by other modules.

#### Example

```typescript
import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [], // Import other modules here
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService], // Make UsersService available to other modules
})
export class UsersModule {}
```

### 2. **Controllers**

Controllers in NestJS are responsible for `handling incoming HTTP requests and returning responses` to the client. They are central to routing and managing the application's endpoints.

- **Handle Incoming Requests and Return Responses**: Controllers receive HTTP requests from clients and return the appropriate HTTP responses. They act as the entry point for the client's interaction with the application.

- **Bound to a Specific Path**: Each controller is bound to a specific route path, which is defined using the `@Controller` decorator. This base path can be combined with route-specific handlers to define the full URL for each endpoint.

- **Contain Handlers**: Controllers contain methods, known as `handlers`, that correspond to HTTP request methods (such as GET, POST, PUT, DELETE). These handlers process requests and return responses. Each handler is decorated with an appropriate decorator like `@Get()`, `@Post()`, etc.

Here it is the flux:

![alt text](https://github.com/zicco99/Serverless-Framework-Bootcamp-Proj/blob/main/theory/res/request-flux?raw=true)

#### Example

```typescript
import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  async findAll() {
    return this.usersService.findAll();
  }

  @Post()
  async create(@Body() createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }
}

```

### 3. **Providers**

Providers in NestJS are a core concept for dependency injection and are used to encapsulate and manage the application's business logic and data access.

- **Injectable Services**: Providers can be injected into constructors if they are decorated with `@Injectable()`. This allows NestJS to manage and inject these services wherever needed, promoting modularity and reusability.

- **Types of Providers**:
  - **Classes**: Typically services or repositories that are used to handle business logic or data access.
  - **Values**: Plain values that can be used throughout the application.
  - **Factories**: Functions that return values or instances. They can be synchronous or asynchronous, providing more flexibility in how values are created.

- **Module Provision**: Providers must be listed in the `providers` array of a module to be available within that module. This ensures that the provider is properly instantiated and managed by NestJS's dependency injection system.

- **Exporting Providers**: Providers can be exported from a module using the `exports` array. This makes them available to other modules that import the module containing the provider. This feature is useful for sharing functionality across different parts of the application.

#### Example

```typescript
import { Module, Injectable } from '@nestjs/common';

@Injectable()
export class UsersService {
  findAll() {
    // logic to retrieve all users
  }
}

@Module({
  providers: [UsersService], // Register the provider in the module
  exports: [UsersService],    // Export the provider for use in other modules
})

export class UsersModule {}
```


### 4. **Services**

Services are a specific type of provider in NestJS and play a crucial role in handling business logic and application functionality.

- **Defined as Providers**: Services are essentially providers decorated with `@Injectable()`. They are registered in the `providers` array of a module and can be injected into other components. However, not all providers are services; providers can also be values or factories.

- **Common Concept**: Services are a well-known concept in software development and are not exclusive to NestJS. They help in organizing and encapsulating business logic, making code more modular and maintainable.

- **Singleton Nature**: When a service is wrapped with `@Injectable()`, it is typically instantiated as a singleton. This means that a single instance of the service is shared across the entire application, acting as a single source of truth. This behavior ensures that the same instance is used throughout, providing consistency and reducing memory usage.

- **Business Logic**: Services are the main source of business logic in an application. They can be called by controllers to perform operations such as validating data, creating or updating items, and other tasks. Controllers use services to handle the core logic of the application, while they focus on handling HTTP requests and responses.

### Example

```typescript
import { Injectable } from '@nestjs/common';

@Injectable()
export class UsersService {
  findAll() {
    // Logic to retrieve all users
  }

  create(createUserDto: CreateUserDto) {
    // Logic to create a new user
  }

  findOne(id: string) {
    // Logic to find a user by ID
  }
}

```

In the end, the flow will take this shape:

![alt text](https://github.com/zicco99/Serverless-Framework-Bootcamp-Proj/blob/main/theory/res/request-flow.png?raw=true)

---------

Once we have defined the building blocks of NestJS, such as Modules, Controllers, and Providers, it's important to understand how **L2_Features** fit into the framework. 

# NestJS Pipes

Pipes are a fundamental feature in NestJS that operate on the arguments of route handlers just before they are processed by the handler. They are used for two main purposes: data transformation and data validation.

When a pipe is applied, it can either transform the incoming data or validate it. The transformed or validated data is then passed to the route handler. If a pipe detects that the data is invalid, it can throw an exception. NestJS will handle this exception and convert it into an appropriate error response. Additionally, pipes can be asynchronous, allowing them to perform operations that involve promises or other asynchronous tasks.

NestJS ships with several built-in pipes in the `@nestjs/common` module, including:

- **ValidationPipe**: Validates an entire object against a class schema, including Data Transfer Objects (DTOs). If any property within the object is malformed, the validation fails.

- **ParseIntPipe**: Converts a string argument into a number, validating that the string can be parsed as an integer.

## Creating Custom Pipes

To create a custom pipe, you need to:

1. **Define a Class**: Your custom pipe should be a class decorated with `@Injectable`, making it a provider that can be injected into other parts of your application.

2. **Implement the PipeTransform Interface**: Your custom pipe class must implement the `PipeTransform` generic interface. This requires defining the `transform()` method, which takes the value to be processed and metadata as parameters. Inside this method, you can implement your own logic for transforming or validating the data.

Here is a basic example of a custom pipe:

```typescript
import { Injectable, PipeTransform, ArgumentMetadata } from '@nestjs/common';

@Injectable()
export class CustomPipe implements PipeTransform {
  transform(value: any, metadata: ArgumentMetadata) {
    return value;
  }
}

```

## Handler-level Pipe

Pipes can also be applied at the handler level using the @UsePipes decorator. This decorator is used to specify which pipes should be applied to a specific route handler or controller. By using `@UsePipes`, you can control the scope of the pipe's effect, applying it only to particular handlers as needed.


```typescript
import { Controller, Get, UsePipes } from '@nestjs/common';
import { CustomPipe } from './custom.pipe';

@Controller('example')
export class ExampleController {
  @Get()
  @UsePipes(CustomPipe)
  getExample() {
    //Stuff here after validation
  }
}

```

## Parameter-level Pipe

In addition to applying pipes at the handler or controller level, NestJS allows you to apply pipes at the parameter level. This is useful when you need specific data transformation or validation for individual parameters in a route handler.

To apply a pipe at the parameter level, use the `@UsePipes` decorator directly on the parameter within the route handler. This approach gives you granular control over which parameters are processed by which pipes.

```typescript
import { Controller, Get, Query, UsePipes } from '@nestjs/common';
import { ParseIntPipe } from '@nestjs/common';

@Controller('items')
export class ItemsController {
  @Get()
  getItems(@Query('page', ParseIntPipe) page: number) {
    return `Requested page number: ${page}`;
  }
}

```

## Global pipe

In NestJS, you can define global pipes to apply data transformation and validation across the entire application. This approach ensures consistency and reduces the need to apply pipes manually to individual routes or handlers.

```typescript
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Apply ValidationPipe globally
  app.useGlobalPipes(new ValidationPipe());

  await app.listen(3000);
}
bootstrap();

```

In the end, the flow using pipes will take this shape:

![alt text](https://github.com/zicco99/Serverless-Framework-Bootcamp-Proj/blob/main/theory/res/pipe-flow.png?raw=true)













