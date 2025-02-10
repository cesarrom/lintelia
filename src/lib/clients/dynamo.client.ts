import { DynamoDBClient, PutItemCommand, PutItemCommandInput, QueryCommand, QueryCommandInput, ScanCommand, ScanCommandInput } from "@aws-sdk/client-dynamodb";

class TableDynamoClient {
  constructor(private client: DynamoDBClient, private tableName: string) { }

  async query(params: Omit<QueryCommandInput, "TableName">) {
    const command = new QueryCommand({
      ...params,
      TableName: this.tableName,
    });
    const response = await this.client.send(command);
    return response;
  }

  async scan(params: Omit<ScanCommandInput, "TableName">) {
    const command = new ScanCommand({
      ...params,
      TableName: this.tableName,
    });
    const response = await this.client.send(command);
    return response;
  }

  async putItem(params: Omit<PutItemCommandInput, "TableName">) {
    const command = new PutItemCommand({
      ...params,
      TableName: this.tableName,
    });
    const response = await this.client.send(command);
    return response;
  }
}

export class DynamoClient {
  constructor(private client: DynamoDBClient) { }

  table(tableName: string) {
    return new TableDynamoClient(this.client, tableName);
  }
}

export const dynamo = new DynamoClient(new DynamoDBClient());
