# Distributed Wagering Processor

[![Bun](https://img.shields.io/badge/Bun-runtime-black?logo=bun)](https://bun.sh/)
[![TypeScript](https://img.shields.io/badge/TypeScript-6.0-blue?logo=typescript)](https://www.typescriptlang.org/)
[![NestJS](https://img.shields.io/badge/NestJS-framework-E0234E?logo=nestjs)](https://nestjs.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-17-4169E1?logo=postgresql)](https://www.postgresql.org/)
[![AWS SQS](https://img.shields.io/badge/AWS-SQS-FF9900?logo=amazonsqs)](https://aws.amazon.com/sqs/)
[![Docker Compose](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker)](https://docs.docker.com/compose/)

Serviço de processamento de operações financeiras de apostas com NestJS, TypeScript, PostgreSQL, TypeORM e AWS SQS via LocalStack. O fluxo local demonstra o consumo de uma aposta, a atualização financeira transacional e a publicação de eventos pela Outbox.

## Requisitos

- Docker Desktop com Docker Compose
- Cliente PostgreSQL para inspecionar os dados
- PowerShell ou terminal equivalente

## Iniciar localmente

Na raiz do projeto, crie `.env` a partir do exemplo, sem sobrescrever um arquivo existente:

```powershell
if (-not (Test-Path .env)) {
  Copy-Item .env.sample .env
}
```

Suba PostgreSQL e LocalStack:

```powershell
docker compose up -d postgres localstack
docker compose ps
```

Aplique as migrations e inicie a aplicação:

```powershell
docker compose run --rm app bun run migration:run
docker compose up -d --build app
docker compose ps
```

A aplicação inicia o servidor HTTP, o consumidor SQS e o publisher da Outbox conforme as configurações do `.env`. Acompanhe a execução:

```powershell
docker compose logs -f app
```

O Compose cria as filas `wager-transactions.fifo`, `wager-transactions-dlq.fifo` e `wagering-events.fifo`.

## Conexão com o PostgreSQL

Com a configuração padrão do .env.sample:

| Campo   | Valor                |
| ------- | -------------------- |
| Host    | localhost            |
| Porta   | 5432                 |
| Banco   | distributed_wagering |
| Usuário | postgres             |
| Senha   | postgres             |

O app acessa o PostgreSQL pelo serviço `postgres` dentro da rede Docker. Não use `localhost` como `DB_HOST` dentro do container.

## Criar uma carteira

Exemplo HTTP para criar uma carteira com saldo inicial de R$ 100:

```powershell
$playerId = [guid]::NewGuid().ToString()
$requestBody = @{
  playerId = $playerId
  initialBalance = @{
    amount = "100.00"
    currency = "BRL"
  }
} | ConvertTo-Json -Depth 6

$wallet = Invoke-RestMethod `
  -Method Post `
  -Uri "http://localhost:3000/wallets" `
  -ContentType "application/json" `
  -Body $requestBody

$wallet
$walletId = $wallet.id
```

Um saldo inicial positivo registra a operação interna `OPENING`, o lançamento de crédito correspondente e eventos na Outbox.

## Enviar uma aposta à fila de entrada

O consumidor espera um envelope `WagerTransactionRequested`. No contrato atual, `idempotencyKey` é enviado em `data` e deve identificar a operação como `providerId:externalTransactionId`.

```powershell
$messageId = [guid]::NewGuid().ToString()
$externalTransactionId = "transaction-$messageId"
$envelope = @{
  messageId = $messageId
  type = "WagerTransactionRequested"
  occurredAt = [DateTime]::UtcNow.ToString("o")
  data = @{
    providerId = "provider-a"
    externalTransactionId = $externalTransactionId
    idempotencyKey = "provider-a:$externalTransactionId"
    playerId = $playerId
    walletId = $walletId
    roundId = "round-local-001"
    gameId = "fortune-chimp"
    kind = "BET"
    money = @{
      amount = "25.00"
      currency = "BRL"
    }
  }
}
$body = $envelope | ConvertTo-Json -Depth 10 -Compress

docker compose exec localstack awslocal sqs send-message `
  --queue-url "http://localhost:4566/000000000000/wager-transactions.fifo" `
  --message-group-id $walletId `
  --message-deduplication-id $messageId `
  --message-body $body
```

Ao redeliver uma mensagem, preserve `messageId`. A chave de idempotência financeira protege a operação mesmo que outra mensagem carregue outro identificador de transporte.

## Acompanhar no banco

Para a aposta de R$ 25, consulte:

```sql
SELECT
  id,
  player_id,
  currency,
  balance_amount,
  version
FROM wallets
ORDER BY created_at DESC;

SELECT
  id,
  provider_id,
  external_transaction_id,
  idempotency_key,
  kind,
  amount,
  currency,
  status,
  result_balance_amount,
  result_balance_currency,
  failure_code
FROM wager_transactions
ORDER BY created_at DESC;

SELECT
  wallet_id,
  transaction_id,
  direction,
  amount,
  currency,
  balance_before_amount,
  balance_after_amount
FROM wallet_ledger_entries
ORDER BY created_at DESC;

SELECT
  consumer_name,
  message_id,
  payload_hash,
  received_at,
  processed_at
FROM inbox_messages
ORDER BY created_at DESC;

SELECT
  id,
  aggregate_id,
  event_type,
  attempts,
  published_at,
  next_attempt_at,
  claim_token,
  claimed_until
FROM outbox_messages
ORDER BY created_at DESC;
```

No caminho de sucesso, a aposta fica `PROCESSED`, o saldo passa de `100.00` para `75.00` e o ledger registra um débito de `25.00`. A mensagem de entrada é removida depois do commit.

## Ver a publicação da Outbox

```powershell
docker compose exec localstack awslocal sqs receive-message `
  --queue-url "http://localhost:4566/000000000000/wagering-events.fifo" `
  --max-number-of-messages 10 `
  --wait-time-seconds 5
```

O publisher reivindica eventos com lease, publica no SQS e marca `published_at` após o envio. `receive-message` torna as mensagens temporariamente invisíveis; não as remove.

A entrega é *at-least-once*. Se o processo cair após o envio e antes da marcação, o evento poderá ser publicado novamente. Consumidores devem deduplicar pelo identificador do evento.

## Diagnóstico rápido

```powershell
docker compose ps -a
docker compose logs --since 10m --tail 200 app
docker compose logs --since 10m --tail 100 postgres localstack
docker compose exec localstack awslocal sqs list-queues
```

`docker compose up -d postgres localstack` inicia somente esses serviços, não inicia `app`. Use `docker compose ps -a` para conferir os containers existentes.

Se houver falha de publicação, consulte as linhas da Outbox com `published_at` nulo e verifique `attempts`, `next_attempt_at` e `claimed_until` junto com os logs do publisher.

## Validação e limites conhecidos

Foi relatada uma execução local manual ponta a ponta: criação de carteira, aposta via SQS, atualização do saldo e ledger, Inbox, Outbox e publicação dos eventos `OPENING` e `BET`. Testes automatizados não foram executados nessa validação.

O fluxo demonstrado é `BET` e abertura da carteira. Autenticação, endpoints de consulta/reconciliação e reprocessamento agendado de `PENDING_REFERENCE` não fazem parte do fluxo local demonstrado.

Para parar os serviços preservando os volumes:

```powershell
docker compose down
```

Remover volumes apaga os dados locais do PostgreSQL e do LocalStack.

## Migrations

```powershell
docker compose run --rm app bun run migration:show
docker compose run --rm app bun run migration:run
docker compose run --rm app bun run migration:revert
```

Revise o efeito de uma migration antes de aplicá-la ou revertê-la, especialmente em ambientes com dados.
