import { v4 as uuid } from 'uuid';

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { DynamoDBClient, GetItemCommand, PutItemCommand, UpdateItemCommand, DeleteItemCommand, QueryCommand } from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';
import { User } from './models/user.model';
import { CreateUserDto } from './dtos/create-user.dto';

@Injectable()
export class UsersService {
  private readonly client = new DynamoDBClient({ region: 'eu-west-1' });
  private readonly tableName = process.env.USERS_TABLE_NAME;

  async createUser(createUserDto: CreateUserDto): Promise<User> {
    const { userId, chatId, username, firstName, lastName, languageCode, firstInteraction, initialContext } = createUserDto;

    const intUserId = parseInt(userId);
    const intChatId = parseInt(chatId);

    if (isNaN(intUserId) || isNaN(intChatId)) {
      throw new BadRequestException('Invalid user ID or chat ID');
    }

    const newUser: User = {
      userId: intUserId,
      chatId: intChatId,
      username,
      firstName,
      lastName,
      languageCode,
      firstInteraction,
      initialContext,
    };

    const command = new PutItemCommand({
      TableName: this.tableName,
      Item: marshall(newUser, { convertClassInstanceToMap: true }),
    });

    await this.client.send(command);
    return newUser;
  }
}
