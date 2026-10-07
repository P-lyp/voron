# Guia de Implantação e Instalação do Agente Local ERP (Firebird)

Este documento descreve o procedimento passo a passo para empacotar, instalar e gerenciar o **Agente Local AI DB** no servidor ou computador da loja de clientes que utilizam o ERP TGA Sistemas (ou qualquer ERP sobre banco de dados Firebird).

---

## 1. Arquitetura da Solução Local

O agente é composto por três componentes integrados que garantem estabilidade ininterrupta:

```
┌─────────────────────────────────────────────────────────────┐
│                    ARQUITETURA LOCAL DO AGENTE              │
├──────────────────────────────┬──────────────────────────────┤
│ 1. Serviço do Windows        │ • Inicia no boot do Windows  │
│    (AI-DB-Agent-Service.exe) │ • Roda sem usuário logado    │
│    [Sessão 0 - Headless]     │ • Auto-recuperação se cair   │
│                              │ • Conectado 24/7 ao Firebird │
├──────────────────────────────┼──────────────────────────────┤
│ 2. System Tray no Relógio    │ • Ícone verde/vermelho       │
│    (VoronTray.exe)           │ • Menu de contexto c/ clique │
│    [Sessão do Usuário]       │ • Iniciar / Pausar serviço   │
│                              │ • Atalho para logs e configs │
├──────────────────────────────┼──────────────────────────────┤
│ 3. Configurador Visual       │ • Seletor do arquivo .FDB    │
│    (ConfigVoron.exe)         │ • Teste de conexão ao vivo   │
│                              │ • Grava configurações no .env│
└──────────────────────────────┴──────────────────────────────┘
```

---

## 2. Requisitos no Computador do Cliente

* **Sistema Operacional:** Windows 10, Windows 11 ou Windows Server (2016/2019/2022).
* **Banco de Dados:** Firebird 2.5, 3.0 ou 5.0 com o arquivo `.FDB` ou `.TGA` acessível localmente ou via rede.
* **Rede/Internet:** Conexão de saída estável (porta 443 / WebSocket para o servidor do Copilot em nuvem).
* **Dependências do Usuário:** O cliente **não precisa** ter Node.js nem Python instalados para a execução do agente compilado.

---

## 3. Conteúdo do Pacote de Distribuição

Ao enviar o agente para o cliente, compacte em um arquivo ZIP (ex: `Agente-ERP-Firebird.zip`) ou utilize o instalador `Setup-Voron-Agente.exe` contendo a seguinte estrutura:

```text
C:\Voron-Agente\
├── VoronTray.exe                 (Aplicativo da bandeja do relógio - Voron ERP)
├── ConfigVoron.exe               (Configurador visual com teste de banco)
├── AI-DB-Agent-Service.exe       (Executável do serviço Windows - WinSW)
├── AI-DB-Agent-Service.xml       (Configuração do serviço e auto-recuperação)
├── instalar-servico.bat          (Script de instalação com 1 clique)
├── desinstalar-servico.bat       (Script de remoção limpa)
├── .env                          (Arquivo com os parâmetros de conexão)
├── dist\                         (Código compilado do agente Node.js)
│   ├── agent\src\index.js
│   ├── agent\src\executor.js
│   ├── agent\src\tunnel.js
│   ├── agent\src\db-bridge.py
│   └── shared\types.js
└── logs\                         (Pasta criada automaticamente para os logs)
```

---

## 4. Passo a Passo de Instalação na Loja do Cliente

### Passo 1: Descompactar os Arquivos
1. Crie uma pasta permanente no computador da loja, por exemplo:
   `C:\AI-DB-Agente` ou `C:\TGA\AI-DB-Agente`
2. Extraia todo o conteúdo do arquivo ZIP nessa pasta.

### Passo 2: Configurar o Banco de Dados (1 minuto)
1. Dê dois cliques em **`ConfigVoron.exe`** (ou `ConfigAgente.exe`).
2. Clique no botão **`Procurar...`** e selecione o banco de dados do ERP (ex: `D:\TGA\Dados\R3\TGA.FDB`).
3. Preencha os campos de conexão:
   * **Host / IP:** `127.0.0.1` (ou o IP do servidor local).
   * **Porta:** `3050` (padrão do Firebird).
   * **Usuário:** `SYSDBA`
   * **Senha:** `masterkey` (ou a senha cadastrada na loja).
4. Informe os dados da empresa:
   * **ID da Empresa:** Código único atribuído à loja (ex: `empresa-piloto-001`).
   * **Token do Agente:** Token de autenticação fornecido pelo sistema.
   * **Gateway Nuvem:** URL WebSocket do backend (ex: `wss://seu-servidor.com/agent-tunnel`).
5. Clique em **`🔍 Testar Conexão com o Banco`**:
   * O utilitário testará a conexão na hora e informará o total de vendas ativas e a data da última emissão.
6. Clique em **`💾 Salvar Configurações`** e feche a janela.

### Passo 3: Ativar o Serviço e a Bandeja
1. Clique com o **botão direito** no arquivo **`instalar-servico.bat`**.
2. Selecione a opção **"Executar como Administrador"**.
3. O script executará automaticamente:
   * O registro do serviço nativo do Windows: `AI DB - Agente Local Firebird`.
   * A configuração de inicialização **Automática** com o Windows.
   * A inicialização imediata do serviço em segundo plano.
   * A adição do **`VoronTray.exe`** para abrir sozinho ao ligar o computador.
   * A exibição imediata do ícone verde na bandeja do Windows ao lado do relógio.

---

## 5. Operação e Monitoramento no Dia a Dia

### Feedback do Ícone na Bandeja (System Tray)
* 🟢 **Ícone Verde:** O serviço está rodando em segundo plano e sincronizando normalmente.
* 🔴 **Ícone Vermelho:** O serviço foi parado ou está desconectado.

### Menu de Ações Rápidas (Clique com o Botão Direito no Ícone):
* **Configurações:** Abre o `ConfigVoron.exe` para alterar caminhos ou senhas.
* **Testar Conexão Firebird:** Dispara um teste rápido e exibe uma notificação do Windows informando se o banco está respondendo.
* **Ver Logs do Agente:** Abre o arquivo de log no Bloco de Notas para verificar requisições e erros.
* **Reiniciar Serviço:** Reinicia o processo caso o banco tenha sido restaurado ou modificado.
* **Pausar / Iniciar Serviço:** Interrompe ou retoma a comunicação temporariamente.

---

## 6. Procedimento de Desinstalação

Caso seja necessário remover o agente do computador do cliente:
1. Clique com o botão direito em **`desinstalar-servico.bat`**.
2. Selecione **"Executar como Administrador"**.
3. O script para o serviço, remove o registro do Windows, desativa a inicialização do `VoronTray.exe` e fecha a aplicação da bandeja.
4. Em seguida, basta excluir a pasta `C:\Voron-Agente`.

---

## 7. Solução de Problemas Frequentes (Troubleshooting)

| Sintoma | Causa Mais Comum | Ação Recomendada |
| :--- | :--- | :--- |
| **Erro "Falha na execução do processo (código: 1)" no instalador** | O script não foi executado como Administrador. | Clique com o botão direito em `instalar-servico.bat` e escolha **Executar como Administrador**. |
| **Status "Desconectado" no app mobile** | A máquina do cliente está sem internet ou o serviço está parado. | Verifique se o ícone do `VoronTray` está verde no relógio do Windows do cliente. Se estiver vermelho, clique com o botão direito e selecione **Iniciar Serviço**. |
| **Vendas recentes não constam no app** | O caminho do banco está apontando para uma cópia/backup antigo. | Abra o `ConfigVoron.exe`, aponte para o arquivo `.FDB` ativo do ERP (verifique a data de modificação no Windows Explorer) e clique em **Salvar Configurações**. |
| **Erro de conexão com o Firebird no teste** | O serviço do Firebird está parado ou a porta 3050 está bloqueada. | Abra o `services.msc` no Windows e garanta que o serviço `Firebird Server` esteja no status **Em Execução**. |

---

## 8. Recomendação para Distribuição em Larga Escala

Para distribuir o agente comercialmente para dezenas ou centenas de clientes de forma profissional:
* Recomenda-se compilar a pasta em um arquivo instalador único (ex: `Instalador_Agente_Setup.exe`) utilizando o **Inno Setup** (gratuito e amplamente utilizado na indústria brasileira de software).
* O assistente cuidará da extração para `C:\Program Files\AI DB Agente` e disparará o `instalar-servico.bat` de forma totalmente silenciosa para o cliente.
