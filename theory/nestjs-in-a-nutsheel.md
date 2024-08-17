# NestJS in a Nutshell

NestJS is a progressive Node.js framework for building efficient, reliable, and scalable server-side applications. It's built on top of Express (or optionally Fastify) and leverages TypeScript, which provides a robust structure for developing complex applications.

## Key Features

### 1. **Modular Architecture**
NestJS uses a modular architecture that allows you to organize your code into modules, making it easier to manage and scale your application. Each module can encapsulate its own functionality and dependencies.

### 2. **Dependency Injection**
The framework employs dependency injection to manage your application’s services and components. This makes it easier to develop and test your code by promoting loose coupling and enhancing reusability.

### 3. **Decorators**
NestJS makes extensive use of decorators (e.g., `@Controller`, `@Injectable`, `@Module`) to define and configure components. These decorators make the code more readable and expressive.

### 4. **TypeScript Support**
Built with TypeScript, NestJS provides strong typing, modern JavaScript features, and improved tooling support. TypeScript enhances code quality and developer productivity by catching errors at compile-time.

### 5. **Built-in Support for Common Patterns**
NestJS supports common design patterns and practices out-of-the-box, including:
- **MVC (Model-View-Controller)**
- **Microservices**
- **GraphQL**
- **WebSockets**
- **RESTful APIs**

### 6. **Extensible**
You can extend NestJS with custom providers, interceptors, guards, and middleware to meet your application’s specific needs. It also integrates well with other libraries and frameworks.

### 7. **Scalable and Testable**
The framework’s architecture promotes scalability and maintainability, making it suitable for both small projects and large-scale enterprise applications. Its design also encourages writing unit and integration tests.

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















