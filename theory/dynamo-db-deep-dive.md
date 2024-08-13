# DynamoDB Deep Dive

Amazon DynamoDB is a fully managed NoSQL database service designed for high performance, scalability, and reliability. One of its core strengths is its ability to handle vast amounts of data while maintaining low-latency responses. This chapter will delve into the fundamental aspects of DynamoDB, focusing on its key structure, data modeling, and practical examples to illustrate how to effectively utilize this powerful service.

## 1. Key Concepts in DynamoDB

DynamoDB is built around the concept of tables, items, and attributes. Understanding how these elements interact and how keys are used to organize and retrieve data is crucial for designing an efficient DynamoDB schema.

### 1.1 Tables

A table in DynamoDB is similar to a table in a relational database but is much more flexible. Each table has a name and a primary key that uniquely identifies each item in the table.

### 1.2 Items

An item is a single record in a DynamoDB table. It is composed of attributes, which are the data fields associated with that item.

**Example:** In a `Users` table, an item might represent a user profile with attributes such as `UserID`, `Name`, `Email`, and `SignUpDate`. They can even differ being noSQL.

```json
{
  "UserID": "12345",
  "Name": "John Doe",
  "Email": "john.doe@example.com",
  "SignUpDate": "2024-08-13"
}
```


### 1.2 Attributes

Attributes are the data fields in an item. They are similar to columns in a relational database table but are more flexible, allowing for a dynamic schema.


----- 

## Primary Keys

The primary key uniquely identifies each item in a DynamoDB table. DynamoDB offers two types of primary keys: simple primary keys and composite primary keys.


### Simple Primary Key

A simple primary key consists of a single attribute known as the partition key. DynamoDB uses the partition key to determine the partition in which the item will be stored.

**Example:** Example: In a `Users` table, if you use `UserID` as the partition key, each UserID `must be unique`.

```json
{
  "UserID": "12345",
  "Name": "John Doe",
  "Email": "john.doe@example.com",
  "SignUpDate": "2024-08-13"
}
```

In this case, UserID is the partition key. **DynamoDB hashes the UserID value to distribute data across partitions, ensuring efficient access and load balancing.**

## Composite Primary Key

A composite primary key consists of two attributes: the partition key and the sort key. The combination of these two attributes must be unique for each item.

**Example**: In a Orders table, you might use CustomerID as the partition key and OrderID as the sort key. This allows you to `store multiple orders for each customer`, with each order uniquely identified by the combination of `CustomerID` and `OrderID`.

```json
{
  "CustomerID": "C001",
  "OrderID": "O123",
  "OrderDate": "2024-08-13",
  "Amount": 250.00
}
```

Under-the-Hood: DynamoDB efficiently stores data by partitioning it based on the CustomerID. `Within each partition, items are sorted by the OrderID`. This sorting mechanism allows DynamoDB to quickly retrieve all orders for a specific customer and efficiently return results sorted by OrderID. **[THIS STUFF IS USEFUL WHEN WE GONNA FILTER]**

## Secondary Indexes

DynamoDB provides secondary indexes to support queries that use attributes other than the primary key. Secondary indexes come in two types: global secondary indexes (GSI) and local secondary indexes (LSI).


### Global Secondary Index (GSI)

A GSI allows you to query on attributes other than the primary key. It can have a different partition key and sort key from the table's primary key.

**Example:** If you want to query users by their Email address, `you can create a GSI with Email` as the partition key.

```json
{
  "TableName": "Users",
  "IndexName": "EmailIndex",
  "KeySchema": [
    { "AttributeName": "Email", "KeyType": "HASH" }
  ],
  "Projection": {
    "ProjectionType": "ALL"
  }
}
```

`With this index you can efficiently query users by their Email address`, even though Email is not the primary key.

### Local Secondary Index (LSI)

An LSI allows you to query on attributes that are not part of the primary key but must share the same partition key as the base table. It provides an alternative sort key for the data.

Example: If you want to query orders by `OrderDate` for a specific customer, `you can create an LSI with OrderDate as the sort key`.

```json
{
  "TableName": "Orders",
  "IndexName": "OrderDateIndex",
  "KeySchema": [
    { "AttributeName": "CustomerID", "KeyType": "HASH" },
    { "AttributeName": "OrderDate", "KeyType": "RANGE" }
  ],
  "Projection": {
    "ProjectionType": "ALL"
  }
}
```

This setup allows you to retrieve all orders for a specific CustomerID and sort them by OrderDate.

# AWS cli query cheatsheet

Simple Query

```bash

aws dynamodb get-item \
    --table-name Users \
    --key '{"UserID": {"S": "12345"}}'
```
Composite Query

To retrieve all orders for a customer and sort them by OrderID:

```bash
aws dynamodb query \
    --table-name Orders \
    --key-condition-expression "CustomerID = :customerId" \
    --expression-attribute-values '{":customerId": {"S": "C001"}}'
```

This command retrieves all orders for CustomerID C001, sorted by OrderID.

Query with Global Secondary Index

To find a user by Email using the GSI:

```bash
aws dynamodb query \
    --table-name Users \
    --index-name EmailIndex \
    --key-condition-expression "Email = :email" \
    --expression-attribute-values '{":email": {"S": "john.doe@example.com"}}'
```

This command retrieves the user with the specified Email from the EmailIndex GSI.


-------

# [Read Consistency]

Read consistency in AWS DynamoDB refers to how up-to-date the data is when it’s read from the database. DynamoDB offers two types of read consistency: eventual consistency and strong consistency. Here's a breakdown of each:

## Eventual Consistency
  When you perform a read operation with eventual consistency, DynamoDB might return a result that is slightly out-of-date. This is because `data changes are propagated to all storage nodes asynchronously`.

  Eventual consistency typically provides better performance and lower latency because it uses less overhead. It's ideal `for scenarios where having the most up-to-date data is not crucial`.

  This type of consistency is the default for read operations and is often used in scenarios `where high throughput and low latency are more important than immediate consistency`, such as in caching or reporting systems.

## Strong Consistency

  With strong consistency, DynamoDB ensures that when you read data, you always get the most recent update. This means that `the read operation waits until the data has been fully propagated and is consistent across all storage nodes`.

  Strong consistency can lead to slightly higher latency and reduced throughput compared to eventual consistency, as it involves more coordination to ensure all copies of the data are up-to-date.

  Strong consistency is useful in situations where it's crucial to get the latest state of the data immediately, such as in `financial transactions or real-time analytics where data accuracy is critical`.

## Configuring Consistency in DynamoDB

  ### Eventual Consistency: 
  
  This is the `[default read consistency option]`, you can perform a read operation without specifying any consistency settings, and it will be eventually consistent.

  ### Strong Consistency:
  To request strongly consistent reads, you need to explicitly specify this when performing a read operation. For example, `in the AWS SDK for JavaScript, you would use { ConsistentRead: true }` in the parameters for get or query operations.

# [R/W Capacity Modes]

Amazon DynamoDB provides two capacity modes for handling read and write operations:

## Provisioned Capacity Mode

- **Description**: In Provisioned Capacity Mode, you specify the number of read and write capacity units (RCUs and WCUs) for your table.
  
- **Read Capacity Units (RCUs)**:
  - One RCU allows you to perform one strongly consistent read per second, or two eventually consistent reads per second, for items up to 4 KB in size.

- **Write Capacity Units (WCUs)**:
  - One WCU allows you to perform one write per second for items up to 1 KB in size.

- **Use Case**: This mode is suitable for applications with predictable workloads. It allows you to control costs by specifying the exact number of read and write operations you expect.

## On-Demand Capacity Mode

- **Description**: In On-Demand Capacity Mode, DynamoDB automatically scales to accommodate the request traffic. You do not need to specify RCUs or WCUs.

- **How it Works**: DynamoDB handles scaling automatically based on your application's traffic. You pay only for the actual read and write requests your application makes.

- **Use Case**: This mode is ideal for applications with unpredictable or variable workloads. It simplifies capacity planning and eliminates the need for manual scaling adjustments.

## Choosing the Right Mode

- **Provisioned Capacity**: Best for applications with stable and predictable workloads.
- **On-Demand Capacity**: Best for applications with unpredictable workloads or varying traffic patterns.
