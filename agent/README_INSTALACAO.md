# Guia Rápido de Instalação do Agente Local (Cliente)

Para o guia completo detalhado com arquitetura e troubleshooting, consulte [`docs/guia-instalacao-agente.md`](../docs/guia-instalacao-agente.md).

---

## ⚡ Instalação em 3 Passos na Máquina do Cliente

### 1. Configurar Conexão do Banco
* Execute o arquivo **`ConfigVoron.exe`** (ou `ConfigAgente.exe`).
* Clique em **`Procurar...`** e selecione o banco de dados ativo do ERP (ex: `D:\TGA\Dados\R3\TGA.FDB`).
* Ajuste o `ID da Empresa`, `Token` e credenciais do Firebird se necessário.
* Clique em **`🔍 Testar Conexão com o Banco`** e depois em **`💾 Salvar Configurações`**.

### 2. Ativar o Serviço do Windows
* Clique com o **botão direito** em **`instalar-servico.bat`**.
* Selecione **"Executar como Administrador"**.
* O serviço será registrado com inicialização automática e o ícone da bandeja (**`VoronTray.exe`**) iniciará junto ao relógio do Windows.

### 3. Verificar Status
* O ícone ao lado do relógio do Windows ficará **Verde** quando o serviço estiver ativo e sincronizado.
* Para parar, reiniciar ou ver logs, basta clicar com o botão direito no ícone da bandeja.

---

## 🗑️ Desinstalação
* Para remover o serviço do Windows e o ícone da bandeja, execute **`desinstalar-servico.bat`** como Administrador.
