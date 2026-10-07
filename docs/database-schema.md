# Dicionário e Estrutura de Dados do ERP (Firebird 5.0)

Este documento descreve a modelagem das tabelas principais do banco de dados local `TGA.FDB` (padrão ERP TGA Sistemas). Ele é utilizado tanto como referência técnica para os desenvolvedores quanto como base de conhecimento (System Prompt / Contexto) para o **Copilot de IA (Gemini Flash)**.

---

## 1. Módulo de Vendas e Faturamento

### 1.1. Tabela `TMOV` (Movimentações / Vendas / Pedidos)
Representa o cabeçalho de cada movimentação emitida no sistema (vendas, notas fiscais, entradas, orçamentos).

* **Chave Primária:** `IDMOV` (Integer)
* **Regras de Negócio Importantes:**
  * **Vendas Válidas:** `CODTMV = '2.2.03'` (ou movimentos de faturamento de saída configurados em `TTIPOMOV`).
  * **Exclusão de Canceladas:** `STATUS <> 'C'` e `DATACANCELAMENTOMOV IS NULL`.
* **Colunas Principais:**
  * `IDMOV` (PK): Identificador único da movimentação.
  * `CODEMPRESA`: Código da empresa (ex: `1`).
  * `CODFILIAL`: Código da filial (ex: `1`).
  * `CODTMV`: Código do Tipo de Movimento (ex: `'2.2.03'` = Venda).
  * `NUMEROMOV`: Número do documento/cupom/nota fiscal.
  * `DATAEMISSAO`: Data de emissão da venda (`DATE`, formato `YYYY-MM-DD`).
  * `VALORLIQUIDO`: Valor líquido total da venda (`NUMERIC(15,4)`).
  * `VALORBRUTO`: Valor total bruto antes dos descontos.
  * `VALORDESC`: Valor do desconto concedido.
  * `STATUS`: Status do movimento (`'F'` = Faturado, `'A'` = Aberto, `'Q'` = Quitado, `'C'` = Cancelado).
  * `CODCFO`: Código do Cliente/Fornecedor (Foreign Key com `FCFO.CODCFO`).
  * `CODVEN1`: Código do vendedor responsável.
  * `CODCPG`: Código da condição de pagamento (FK com `TCONDPGTO`).

---

### 1.2. Tabela `TMOVITENS` (Itens do Movimento / Produtos Vendidos)
Armazena cada item/produto contido em uma movimentação (`TMOV`).

* **Chaves:** `IDMOV` + `NSEQ` (Número sequencial do item)
* **Colunas Principais:**
  * `IDMOV`: Identificador da venda pai (FK `TMOV.IDMOV`).
  * `NSEQ`: Sequência do item na venda (1, 2, 3...).
  * `CODPRD`: Código do produto (FK `TPRODUTO.CODPRD`).
  * `DESCRICAO`: Descrição do produto registrada na venda.
  * `QUANTIDADE`: Quantidade vendida (`NUMERIC(15,4)`).
  * `PRECOUNITARIO`: Preço unitário praticado na venda.
  * `VALORTOTALITEM`: Valor total do item (`QUANTIDADE * PRECOUNITARIO - DESCONTO`).
  * `DATAEMISSAO`: Data da venda (espelhada para performance).

---

## 2. Módulo de Produtos e Estoque

### 2.1. Tabela `TPRODUTO` (Cadastro de Produtos)
* **Chave Primária:** `CODPRD` (Varchar)
* **Colunas Principais:**
  * `CODPRD`: Código cadastral do produto.
  * `DESCRICAO`: Descrição detalhada do produto.
  * `NOMEFANTASIA`: Nome reduzido/comercial.
  * `CODBARRAS`: Código de barras EAN/GTIN.
  * `UNIDADE`: Unidade de medida (ex: `UN`, `CX`, `KG`, `LT`).
  * `PRECO1`: Preço de venda padrão atual.
  * `ULTPRECOCOMPRA`: Último preço de custo de compra.
  * `CUSTOMEDIO`: Custo médio ponderado.

### 2.2. Tabela `TPRODSALDO` (Saldos de Estoque)
Controla o saldo físico e financeiro do produto por local de estoque e filial.

* **Chaves:** `CODPRD` + `CODEMPRESA` + `CODFILIAL` + `CODLOC`
* **Colunas Principais:**
  * `CODPRD`: Código do produto (FK `TPRODUTO.CODPRD`).
  * `CODLOC`: Código do local de estoque (ex: `'001'` = Loja/Geral).
  * `SALDOFISICO2`: Saldo físico disponível para venda.
  * `CUSTOMEDIO`: Custo médio no local.
  * `DATAMOVIMENTO`: Data da última movimentação de estoque.

---

## 3. Módulo Financeiro (Contas a Pagar e Receber)

### 3.1. Tabela `FLAN` (Lançamentos Financeiros)
Tabela central de títulos a receber de clientes e a pagar a fornecedores.

* **Chave Primária:** `IDLAN` (Integer)
* **Regras de Negócio Importantes:**
  * **Tipo de Título:** `PAGREC = 'R'` (Contas a Receber) | `PAGREC = 'P'` (Contas a Pagar).
  * **Status:**
    * `'A'` = Em Aberto (a vencer ou vencido).
    * `'B'` = Baixado / Quitado.
    * `'C'` = Cancelado.
  * **Títulos Vencidos em Aberto:** `STATUSLAN = 'A' AND DATAVENCIMENTO < CURRENT_DATE`.
* **Colunas Principais:**
  * `IDLAN`: Identificador único do lançamento financeiro.
  * `IDMOV`: Venda/Movimento que originou o lançamento (se houver).
  * `PAGREC`: `'R'` (Receber) ou `'P'` (Pagar).
  * `CODCFO`: Código do cliente ou fornecedor (FK `FCFO.CODCFO`).
  * `NUMERODOCUMENTO`: Número do documento/duplicata.
  * `PARCELA`: Número da parcela (ex: 1, 2, 3...).
  * `DATAEMISSAO`: Data de emissão do título.
  * `DATAVENCIMENTO`: Data de vencimento do título.
  * `DATABAIXA`: Data em que foi pago/recebido (se baixado).
  * `VALORORIGINAL`: Valor nominal do título (`NUMERIC(15,4)`).
  * `VALORBAIXADO`: Valor total quitado (inclui juros/descontos).
  * `STATUSLAN`: Status (`'A'` = Aberto, `'B'` = Baixado, `'C'` = Cancelado).
  * `HISTORICO`: Descrição ou observação do título.
  * `CODFORMA`: Código da forma de pagamento (ex: `PZ`, `DH`, `CC`, `CD`, `PX`).

---

## 4. Módulo de Clientes e Fornecedores

### 4.1. Tabela `FCFO` (Ficha de Clientes e Fornecedores)
* **Chave Primária:** `CODCFO` (Varchar, ex: `'C00001'`, `'F00002'`)
* **Colunas Principais:**
  * `CODCFO`: Código identificador único.
  * `NOME`: Razão Social ou Nome Completo.
  * `NOMEFANTASIA`: Nome Fantasia.
  * `CGCCFO`: CPF ou CNPJ formatado.
  * `TIPO`: Tipo de cadastro (`'C'` = Cliente, `'F'` = Fornecedor, `'A'` = Ambos).
  * `CIDADE`: Nome da cidade.
  * `CODETD`: Estado/UF (ex: `'MT'`, `'SP'`).
  * `TELEFONE`: Telefone principal.
  * `EMAIL`: E-mail de contato.
  * `LIMITECREDITO`: Limite de crédito aprovado para compras a prazo.
  * `VALOREMABERTO`: Total financeiro atualmente em aberto.
  * `ATIVO`: `'T'` (Ativo) ou `'F'` (Inativo).

---

## 5. Exemplos de Queries Otimizadas para as Ferramentas da IA

### 5.1. Resumo de Faturamento Diário / Período
```sql
SELECT 
  COUNT(v.IDMOV) AS TOTAL_VENDAS,
  COALESCE(SUM(v.VALORLIQUIDO), 0) AS FATURAMENTO_TOTAL,
  COALESCE(AVG(v.VALORLIQUIDO), 0) AS TICKET_MEDIO
FROM TMOV v
WHERE v.CODTMV = '2.2.03'
  AND v.STATUS <> 'C'
  AND v.DATACANCELAMENTOMOV IS NULL
  AND v.DATAEMISSAO BETWEEN :DATA_INICIO AND :DATA_FIM;
```

### 5.2. Ranking dos Produtos Mais Vendidos
```sql
SELECT FIRST :LIMITE
  p.CODPRD,
  p.DESCRICAO,
  SUM(i.QUANTIDADE) AS QTD_TOTAL,
  SUM(i.VALORTOTALITEM) AS VALOR_TOTAL
FROM TMOVITENS i
JOIN TMOV v ON v.IDMOV = i.IDMOV
JOIN TPRODUTO p ON p.CODPRD = i.CODPRD
WHERE v.CODTMV = '2.2.03'
  AND v.STATUS <> 'C'
  AND v.DATACANCELAMENTOMOV IS NULL
  AND v.DATAEMISSAO BETWEEN :DATA_INICIO AND :DATA_FIM
GROUP BY p.CODPRD, p.DESCRICAO
ORDER BY VALOR_TOTAL DESC;
```

### 5.3. Contas a Receber / Pagar do Dia e Atrasados
```sql
SELECT 
  PAGREC,
  STATUSLAN,
  COUNT(IDLAN) AS QTD_TITULOS,
  COALESCE(SUM(VALORORIGINAL), 0) AS TOTAL_ORIGINAL,
  COALESCE(SUM(VALORBAIXADO), 0) AS TOTAL_BAIXADO
FROM FLAN
WHERE STATUSLAN = 'A'
  AND DATAVENCIMENTO = :DATA_REFERENCIA
GROUP BY PAGREC, STATUSLAN;
```
