#!/bin/sh
set -eu

region="${AWS_DEFAULT_REGION:-us-east-1}"
max_receive_count="${SQS_MAX_RECEIVE_COUNT:-5}"
visibility_timeout="${SQS_VISIBILITY_TIMEOUT_SECONDS:-60}"
operation_queue="${SQS_OPERATION_QUEUE_NAME:-wager-transactions.fifo}"
dlq_queue="${SQS_DLQ_QUEUE_NAME:-wager-transactions-dlq.fifo}"
outbox_queue="${SQS_OUTBOX_QUEUE_NAME:-wagering-events.fifo}"

awslocal sqs create-queue \
  --region "$region" \
  --queue-name "$dlq_queue" \
  --attributes '{"FifoQueue":"true","ContentBasedDeduplication":"true"}'

dlq_arn="$(awslocal sqs get-queue-attributes \
  --region "$region" \
  --queue-url "http://localhost:4566/000000000000/$dlq_queue" \
  --attribute-names QueueArn \
  --query 'Attributes.QueueArn' \
  --output text)"

redrive_policy="$(DLQ_ARN="$dlq_arn" SQS_MAX_RECEIVE_COUNT="$max_receive_count" \
  python3 -c \
  'import json, os; print(json.dumps({"deadLetterTargetArn": os.environ["DLQ_ARN"], "maxReceiveCount": os.environ["SQS_MAX_RECEIVE_COUNT"]}))')"

queue_attributes="$(VISIBILITY_TIMEOUT="$visibility_timeout" REDRIVE_POLICY="$redrive_policy" \
  python3 -c \
  'import json, os; print(json.dumps({"FifoQueue": "true", "ContentBasedDeduplication": "false", "VisibilityTimeout": os.environ["VISIBILITY_TIMEOUT"], "RedrivePolicy": os.environ["REDRIVE_POLICY"]}))')"

awslocal sqs create-queue \
  --region "$region" \
  --queue-name "$operation_queue" \
  --attributes "$queue_attributes"

awslocal sqs create-queue \
  --region "$region" \
  --queue-name "$outbox_queue" \
  --attributes '{"FifoQueue":"true","ContentBasedDeduplication":"false"}'
