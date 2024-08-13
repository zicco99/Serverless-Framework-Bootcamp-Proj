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

Under-the-Hood: DynamoDB efficiently stores data by partitioning it based on the CustomerID. `Within each partition, items are sorted by the OrderID`. This sorting mechanism allows DynamoDB to quickly retrieve all orders for a specific customer and efficiently return results sorted by OrderID.

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

# Summary

DynamoDB's key structure and data modeling capabilities provide a flexible and powerful foundation for building scalable applications. By understanding the primary key concepts, secondary indexes, and practical querying techniques, you can design efficient schemas and queries that leverage DynamoDB's strengths. 

Whether you're managing user profiles, order histories, or any other type of data, DynamoDB's managed service model allows you to focus on application logic rather than infrastructure concerns, making it a robust choice for modern, high-performance applications.