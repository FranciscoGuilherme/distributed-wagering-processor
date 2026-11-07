# Arquitetura

## Visão geral

O serviço processa operações de apostas com precisão monetária, idempotência persistente e controle de concorrência. As alterações financeiras e seus eventos são gravados no PostgreSQL; workers SQS fazem o transporte assíncrono.

## Camadas

```text
Infraestrutura  →  Aplicação  →  Domínio
       └── implementa as portas definidas para dentro
```

- **Domínio:** entidades, agregados, objetos de valor, regras financeiras e contratos de repositório. Não depende de NestJS ou TypeORM.
- **Aplicação:** casos de uso e portas, incluindo UnitOfWork e TransactionScope. Orquestra o processamento usando contratos do domínio.
- **Infraestrutura:** controllers HTTP, workers SQS, modelos e repositórios TypeORM, mappers, migrations e adaptadores.
- **Composição:** AppModule conecta os casos de uso aos adaptadores por meio de providers e tokens do NestJS.

O EntityManager é restrito à infraestrutura. TypeOrmUnitOfWork abre a transação, cria repositórios vinculados a ela e fornece o TransactionScope aos casos de uso.

## Processamento e idempotência

HTTP e SQS validam seus respectivos contratos e encaminham a operação para ProcessOperationUseCase. No envelope SQS, `data` instancia o DTO específico de fila, que aceita e valida `idempotencyKey` junto aos campos da operação; o DTO HTTP não declara essa propriedade.

A idempotência da operação financeira usa a `idempotencyKey` recebida no header HTTP ou em `data` no envelope SQS, além de `payloadHash`. O hash representa apenas o conteúdo de negócio, sem a chave ou metadados de transporte. A mesma chave e o mesmo conteúdo são tratados como replay; a mesma chave com conteúdo diferente é conflito.

Para SQS, Inbox registra consumerName e messageId. Ela detecta redelivery da mesma mensagem; não substitui a idempotência financeira, que também protege operações recebidas por outro messageId ou por HTTP.

O processamento usa uma unidade de trabalho: consulta a Inbox quando aplicável, verifica a idempotência, cria a WagerTransaction e encaminha para o caso de uso do kind. Wallet, transação, ledger, Inbox e Outbox são gravados na mesma transação quando participam da operação. O consumer apaga a mensagem de entrada somente após o commit.

## Saldo e concorrência

Valores monetários são recebidos como strings, calculados com Decimal e armazenados como numeric(18,2). A Wallet aplica as regras de saldo e moeda; o ledger registra cada alteração efetiva com direção e saldos anterior e posterior.

Nas operações que alteram saldo, a aplicação bloqueia a linha da wallet com lock pessimista durante a transação. Isso serializa operações concorrentes sobre a mesma carteira, sem bloquear carteiras distintas.

Constraints e índices PostgreSQL reforçam invariantes como saldo não negativo, wallet única por jogador e moeda, chave de idempotência única, ledger consistente e deduplicação da Inbox.

## Inbox, Outbox e SQS

A Inbox é confirmada junto com o processamento financeiro. Se a aplicação cair antes do commit, tudo é revertido e a mensagem pode ser tentada novamente. Se cair após o commit e antes do ack, a redelivery encontra a Inbox e não repete o efeito.

A Outbox é gravada na mesma transação das alterações financeiras. O publisher reivindica eventos pendentes com FOR UPDATE SKIP LOCKED e um lease, publica-os no SQS e marca cada evento como publicado. Falhas agendam retry.

PostgreSQL e SQS não participam de uma transação distribuída. Uma falha após o envio e antes da marcação pode gerar publicação duplicada; por isso, a entrega é at-least-once e consumidores devem deduplicar pelo eventId.

Os eventos usados pelo fluxo incluem WagerTransactionProcessed, WagerTransactionRejected, WalletBalanceChanged e WagerTransactionPendingReference. Uma operação pode gerar mais de um evento: por exemplo, uma operação processada que altera o saldo gera eventos sobre a transação e sobre a mudança da wallet.

## Decisões e limites

- TypeORM é um detalhe de persistência; modelos ORM e EntityManager não fazem parte do domínio ou dos casos de uso.
- Inbox protege contra mensagens SQS repetidas; idempotencyKey protege contra a aplicação financeira duplicada.
- O publisher envia eventos sequencialmente dentro de cada lote; o claim com lease permite concorrência entre instâncias e recuperação após falhas.
- A execução local ponta a ponta relatada validou abertura da wallet e BET, incluindo consumo SQS, saldo, ledger, Inbox, Outbox e publicação dos eventos.
- Testes automatizados e os demais kinds não foram comprovados por essa execução.
- Autenticação, consultas e reconciliação, e reprocessamento agendado de PENDING_REFERENCE não fazem parte do fluxo demonstrado.
