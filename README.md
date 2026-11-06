<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

  <p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>
    <p align="center">
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="NPM Downloads" /></a>
<a href="https://circleci.com/gh/nestjs/nest" target="_blank"><img src="https://img.shields.io/circleci/build/github/nestjs/nest/master" alt="CircleCI" /></a>
<a href="https://discord.gg/G7Qnnhy" target="_blank"><img src="https://img.shields.io/badge/discord-online-brightgreen.svg" alt="Discord"/></a>
<a href="https://opencollective.com/nest#backer" target="_blank"><img src="https://opencollective.com/nest/backers/badge.svg" alt="Backers on Open Collective" /></a>
<a href="https://opencollective.com/nest#sponsor" target="_blank"><img src="https://opencollective.com/nest/sponsors/badge.svg" alt="Sponsors on Open Collective" /></a>
  <a href="https://paypal.me/kamilmysliwiec" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-ff3f59.svg" alt="Donate us"/></a>
    <a href="https://opencollective.com/nest#sponsor"  target="_blank"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us"></a>
  <a href="https://twitter.com/nestframework" target="_blank"><img src="https://img.shields.io/twitter/follow/nestframework.svg?style=social&label=Follow" alt="Follow us on Twitter"></a>
</p>
  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

## Distributed Wagering Processor

Implementação NestJS/TypeORM do desafio Jungle Gaming. As operações financeiras
usam PostgreSQL; mensagens de entrada e eventos da Outbox usam filas SQS FIFO.

### Subir localmente

```bash
cp .env.sample .env
docker compose up -d postgres localstack
docker compose run --rm app bun run migration:run
docker compose up -d app
```

O Compose cria `wager-transactions.fifo`, sua DLQ
`wager-transactions-dlq.fifo` (redrive padrão após 5 entregas) e
`wagering-events.fifo`. Para migrar novamente, execute
`docker compose exec app bun run migration:run`.

### Criar wallet e apostar por HTTP

```bash
curl -sS http://localhost:3000/wallets \
  -H 'content-type: application/json' \
  -d '{
    "playerId": "0192f28f-5dc0-7d58-bdb2-814ad6a0f4a1",
    "initialBalance": { "amount": "100.00", "currency": "BRL" }
  }'
```

Use o `id` retornado como `walletId`:

```bash
curl -i http://localhost:3000/wagering/transactions \
  -H 'content-type: application/json' \
  -H 'Idempotency-Key: provider-a:transaction-123' \
  -d '{
    "providerId": "provider-a",
    "externalTransactionId": "transaction-123",
    "playerId": "0192f28f-5dc0-7d58-bdb2-814ad6a0f4a1",
    "walletId": "<wallet-id-retornado>",
    "roundId": "round-987",
    "gameId": "fortune-chimp",
    "kind": "BET",
    "money": { "amount": "25.00", "currency": "BRL" }
  }'
```

Uma resposta processada contém `transactionId`, `status`, o saldo original
resultante e `idempotentReplay`. Reenvie o mesmo body e header para receber o
resultado salvo. Altere um campo de negócio mantendo o header para observar
`409 IDEMPOTENCY_CONFLICT`; use uma aposta acima do saldo para obter `422` com
`failureCode` (BN-001). Valor monetário é string decimal positiva, até duas
casas; representações como `"25"`, `"25.0"` e `"25.00"` têm hash canônico igual.

### Enviar uma aposta por SQS

Envie um envelope à fila de entrada. `messageId` é a identidade estável da
mensagem no Inbox; o nome do consumer é definido pela aplicação e não deve ser
incluído no envelope. Reutilize o mesmo `messageId` ao redeliver a mensagem.

```bash
docker compose exec localstack awslocal sqs send-message \
  --queue-url http://localhost:4566/000000000000/wager-transactions.fifo \
  --message-group-id "<wallet-id>" \
  --message-deduplication-id "message-bet-001" \
  --message-body '{
    "messageId":"message-bet-001",
    "type":"WagerTransactionRequested",
    "occurredAt":"2026-11-06T12:00:00.000Z",
    "data":{
      "providerId":"provider-a",
      "externalTransactionId":"transaction-sqs-001",
      "idempotencyKey":"provider-a:transaction-sqs-001",
      "playerId":"0192f28f-5dc0-7d58-bdb2-814ad6a0f4a1",
      "walletId":"<wallet-id-retornado>",
      "roundId":"round-988",
      "gameId":"fortune-chimp",
      "kind":"BET",
      "money":{"amount":"10.00","currency":"BRL"}
    }
  }'
```

Para exercitar redelivery lógica, envie novamente o mesmo envelope e mantenha
`messageId`; use outro `--message-deduplication-id` para que o FIFO local aceite
a segunda entrega. A Inbox reconhece a repetição. Também é
possível consultar `wagering-events.fifo` para ver eventos publicados depois
do commit financeiro.

### Garantias implementadas e limites

- `ProcessOperationUseCase` abre uma transação SQL, consulta Inbox primeiro,
  aplica idempotência, despacha o kind e grava Inbox antes do commit. O endpoint
  HTTP não fornece metadados Inbox.
- `BET` usa lock pessimista na wallet, `Money`/`Decimal`, ledger DEBIT e eventos
  Outbox na mesma unidade de trabalho. Rejeição por saldo insuficiente tem
  código BN-001 e não cria ledger.
- Códigos de rejeição estáveis: BN-001 (saldo insuficiente), BN-002 (contexto ou
  moeda inválidos), BN-003 (REFUND não permitido) e BN-004 (saldo insuficiente
  ao reverter).
- O consumidor só exclui a mensagem depois do retorno do use case; erros deixam
  a mensagem para retry/redrive.
- O publisher reivindica eventos com `FOR UPDATE SKIP LOCKED` e lease confirmado
  antes da chamada SQS. Publica JSON `{eventId,eventType,aggregateId,occurredAt,
version,data}`, marca `publishedAt` após o envio e agenda retry exponencial.
  Uma queda entre envio e marcação pode causar duplicata (at-least-once).
- `OPENING` e o crédito de abertura são gravados junto com a wallet quando o
  saldo inicial é maior que zero; saldo zero cria a wallet sem movimento.
- Autenticação, endpoints de consulta/reconciliação e reprocessamento agendado
  de `PENDING_REFERENCE` não fazem parte deste fluxo demonstrável.

O hash SHA-256 usa as propriedades de negócio em ordem lexical fixa no
`ProcessOperationUseCase`; `Idempotency-Key` e metadados de transporte não
entram no hash. Consulte [.env.sample](./.env.sample) para os parâmetros locais.

## Project setup

```bash
bun install
```

## Project setup

```bash
$ bun install
```

## Compile and run the project

```bash
# development
$ bun run start

# watch mode
$ bun run start:dev

# production mode
$ bun run start:prod
```

## Run tests

```bash
# unit tests
$ bun run test

# e2e tests
$ bun run test:e2e

# test coverage
$ bun run test:cov
```

## Database migrations

The application does not run migrations automatically. Apply the schema explicitly
against the intended local database:

```bash
# Inspect migration status
bun run migration:show

# Apply pending migrations
bun run migration:run

# Revert the most recently applied migration
bun run migration:revert
```

Create an empty migration or generate one from model metadata (generation compares
against the configured database):

```bash
bun run migration:create src/infra/database/migrations/DescribeChange
bun run migration:generate src/infra/database/migrations/DescribeChange
```

The CLI uses `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASS`, and `DB_NAME`, with the
same local defaults as `.env.sample`. Review generated migrations before applying
them. The initial schema migration creates the wagering tables; reverting it
drops those tables, so only revert when that data is disposable.

## Deployment

When you're ready to deploy your NestJS application to production, there are some key steps you can take to ensure it runs as efficiently as possible. Check out the [deployment documentation](https://docs.nestjs.com/deployment) for more information.

If you are looking for a cloud-based platform to deploy your NestJS application, check out [Mau](https://mau.nestjs.com), our official platform for deploying NestJS applications on AWS. Mau makes deployment straightforward and fast, requiring just a few simple steps:

```bash
$ bun install -g @nestjs/mau
$ mau deploy
```

With Mau, you can deploy your application in just a few clicks, allowing you to focus on building features rather than managing infrastructure.

## Observability

In production applications, observability is essential for understanding how your system behaves, detecting issues early, and maintaining reliable performance.

[NestJS Observe](https://observe.nestjs.com) automatically instruments your NestJS application, giving you deep visibility into your system with minimal setup:

- **Distributed tracing:** Follow requests across services and understand how they flow through your system.
- **Waterfall analysis:** Visualize request execution and identify slow operations, bottlenecks, and unexpected delays.
- **Performance analysis:** Analyze application performance in real time and quickly pinpoint areas that need optimization.
- **Metrics:** Track key application and infrastructure metrics to understand system health and performance trends.
- **Logging:** Centralize and correlate logs with traces and other telemetry to make debugging easier.
- **Error tracking:** Detect errors quickly and investigate their root causes with the surrounding context.
- **SLA monitoring:** Track service-level objectives and identify when your application is approaching or exceeding defined thresholds.
- **Alarms and alerts:** Set up alerts for critical errors, performance degradation, SLA violations, and other anomalies so your team can react quickly.

To add it to this project, run this and approve the code it prints at [observe.nestjs.com/link](https://observe.nestjs.com/link) - signing up for free if you have no account:

```bash
$ npx @nestjs/observe link
```

It installs `@nestjs/observe`, wires it into `AppModule` and `main.ts`, and writes the app key and secret into `.env`, which every `nest start` script (`start`, `start:dev`, `start:debug`) then loads. In production, set `OBSERVE_APP_KEY` and `OBSERVE_APP_SECRET` in the environment instead.

Or do it by hand:

```bash
$ bun install @nestjs/observe
```

Then follow the [setup guide](https://docs.nestjs.com/observability/sdk) - it takes a single import and an app key.

The free plan needs no payment details and covers 300,000 events a month. You can also browse the [live demo](https://www.observe-demo.nestjs.com/dashboard) first - the whole dashboard over a busy service's data, with nothing to install.

## Resources

Check out a few resources that may come in handy when working with NestJS:

- Visit the [NestJS Documentation](https://docs.nestjs.com) to learn more about the framework.
- For questions and support, please visit our [Discord channel](https://discord.gg/G7Qnnhy).
- To dive deeper and get more hands-on experience, check out our official video [courses](https://courses.nestjs.com/).
- Deploy your application to AWS with the help of [NestJS Mau](https://mau.nestjs.com) in just a few clicks.
- Auto-instrument your application with [NestJS Observe](https://observe.nestjs.com). Distributed tracing, metrics, and logging made easy. Error tracking and performance monitoring for your NestJS applications.
- Visualize your application graph and interact with the NestJS application in real-time using [NestJS Devtools](https://devtools.nestjs.com).
- Need help with your project (part-time to full-time)? Check out our official [enterprise support](https://enterprise.nestjs.com).
- To stay in the loop and get updates, follow us on [X](https://x.com/nestframework) and [LinkedIn](https://linkedin.com/company/nestjs).
- Looking for a job, or have a job to offer? Check out our official [Jobs board](https://jobs.nestjs.com).

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://twitter.com/kammysliwiec)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).
