import { v4 as uuid } from 'uuid';

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { DynamoDBClient, GetItemCommand, PutItemCommand, UpdateItemCommand, DeleteItemCommand, QueryCommand } from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';
import { User } from './models/user.model';
import { CreateUserDto } from './dtos/create-user.dto';
import { BotContext } from 'src/app.service';

@Injectable()
export class UsersService {
  private readonly client = new DynamoDBClient({ region: 'eu-west-1' });
  private readonly tableName = process.env.USERS_TABLE_NAME;

  async createUser(createUserDto: CreateUserDto, initialContext: BotContext): Promise<User> {
    const { userId, chatId, username, firstName, lastName, languageCode } = createUserDto;

    const newUser: User = {
      userId: userId,
      chatId: chatId,
      username,
      firstName,
      lastName,
      languageCode,
      firstInteraction: new Date().toISOString(),
      initialContext: JSON.stringify({
        "chat": initialContext.chat, 
        "message": initialContext.message, 
        "from": initialContext.from
      }
      ),
    };

    const command = new PutItemCommand({
      TableName: this.tableName,
      Item: marshall(newUser, { convertClassInstanceToMap: true }),
    });

    await this.client.send(command);
    return newUser;
  }

  async findUser(userId: number): Promise<User | null> {
    const command = new GetItemCommand({
      TableName: this.tableName,
      Key: marshall({ userId }),
    });

    const result = await this.client.send(command);

    if (!result.Item) {
      return null;
    }
    return unmarshall(result.Item) as User;
  }

}
