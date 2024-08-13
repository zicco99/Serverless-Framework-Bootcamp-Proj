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

In this table, CustomerID is the partition key and OrderID is the sort key. This setup enables you to `query all orders for a specific customer efficiently and sort them by OrderID.