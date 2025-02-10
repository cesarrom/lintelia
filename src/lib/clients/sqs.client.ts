import { SQSClient, SendMessageCommand, SendMessageCommandInput } from "@aws-sdk/client-sqs";

class SpecificQueueClient {
  constructor(private client: SQSClient, private queueUrl: string) {}

  async sendMessage(params: Omit<SendMessageCommandInput, "QueueUrl">) {
    const command = new SendMessageCommand({
      ...params,
      QueueUrl: this.queueUrl,
    });
    const response = await this.client.send(command);
    return response;
  }
}

export class QueueClient {
  constructor(private client: SQSClient) {}

  queue(queueUrl: string) {
    return new SpecificQueueClient(this.client, queueUrl);
  }
}

export const sqs = new QueueClient(new SQSClient());