import { sqs } from "@/lib/clients/sqs.client";
import { Resource } from "sst";
import { DynamoDBStreamEvent } from "aws-lambda";

export const handler = async (evt: DynamoDBStreamEvent) => {

  // Get the expired records from the event
  const expiredRecords = evt.Records.filter(record =>
    record.eventName === 'REMOVE' &&
    record.userIdentity?.type === 'Service' &&
    record.userIdentity?.principalId === 'dynamodb.amazonaws.com'
  );

  await Promise.all(expiredRecords.map((record) => {
    const oldImage = record.dynamodb?.OldImage;

    if (!oldImage) return;

    const newCtx = {
      domain: oldImage.domain.S,
      workflowId: oldImage.workflowId.S,
      executionId: oldImage.executionId.S,
      executionNodeId: oldImage.executionNodeId.S,
      eventName: oldImage.eventName.S,
      triggeredBy: oldImage.triggeredBy.S,
      triggeredByRole: oldImage.triggeredByRole.S,
      listenerId: oldImage.listenerId.S,
    };

    return sqs
      .queue(Resource.ExecutionQueue.url)
      .sendMessage({
        MessageBody: JSON.stringify(newCtx),
        MessageGroupId: newCtx.executionId,
        MessageDeduplicationId: `${newCtx.workflowId}::${newCtx.executionId}::${newCtx.executionNodeId}::${newCtx.eventName}`
      });
  }));
};
