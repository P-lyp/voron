import express from 'express';
import http from 'http';
import { WebSocketServer } from 'ws';
import cors from 'cors';
import dotenv from 'dotenv';
import { AgentManager } from './gateway/agentManager.js';
import { dashboardRouter } from './routes/dashboard.js';
import { chatRouter } from './routes/chat.js';
import { adminRouter } from './routes/admin.js';
import { authRouter } from './routes/auth.js';
import { itemsRouter } from './routes/items.js';
import publicCustomerRouter from './routes/publicCustomer.js';
import customersRouter from './routes/customers.js';
import { notificationRouter } from './routes/notifications.js';
import { NotificationScheduler } from './services/notificationScheduler.js';
import { agentUpdatesRouter } from './routes/agentUpdates.js';

dotenv.config();

const app = express();
const port = Number(process.env.PORT) || 3001;

// Oculta cabeçalhos que revelam a stack interna do backend
app.disable('x-powered-by');

// Configuração segura de CORS (apenas origens autorizadas e domínios de deploy)
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim())
  : [
      'http://localhost:5173',
      'http://localhost:3000',
      'http://localhost:3001',
      'http://127.0.0.1:5173',
      'http://127.0.0.1:3000',
    ];

app.use(
  cors({
    origin: (origin, callback) => {
      // Permite requisições de clientes sem origin (ex: mobile apps nativos, curl, túneis locais)
      if (!origin) return callback(null, true);
      if (
        allowedOrigins.includes(origin) ||
        origin.endsWith('.vercel.app') ||
        origin.endsWith('.railway.app') ||
        process.env.NODE_ENV !== 'production'
      ) {
        return callback(null, true);
      }
      return callback(new Error(`Origem CORS [${origin}] bloqueada por política de segurança.`));
    },
    credentials: true,
  })
);

app.use(express.json({ limit: '1mb' }));


// Rotas REST da aplicação móvel, públicas e painel admin
app.use('/api/public/customers', publicCustomerRouter);
app.use('/api/customers', customersRouter);
app.use('/api/auth', authRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/items', itemsRouter);
app.use('/api/chat', chatRouter);
app.use('/api/admin', adminRouter);
app.use('/api/notifications', notificationRouter);
app.use('/api/agent/update', agentUpdatesRouter);

// Rota de status geral da API
app.get('/api/status', (req, res) => {
  const companyId = (req.query.companyId as string) || 'empresa-piloto-001';
  const manager = AgentManager.getInstance();
  const isOnline = manager.isAgentOnline(companyId);

  res.json({
    status: 'ok',
    version: '1.0.0',
    companyId,
    serverLocalOnline: isOnline,
    timestamp: new Date().toISOString(),
  });
});

const server = http.createServer(app);

// Servidor WebSocket no endpoint /agent-tunnel
const wss = new WebSocketServer({ server, path: '/agent-tunnel' });
const agentManager = AgentManager.getInstance();

wss.on('connection', (ws, req) => {
  agentManager.handleConnection(ws, req);
});

server.listen(port, () => {
  console.log('==================================================');
  console.log(`[SERVER] Backend Voron operacional na porta ${port}`);
  console.log(`[GATEWAY] WebSocket do Voron - Agente Local: ws://localhost:${port}/agent-tunnel`);
  console.log(`[DASHBOARD] Endpoint: http://localhost:${port}/api/dashboard/overview`);
  console.log(`[ITEMS] Endpoint: http://localhost:${port}/api/items`);
  console.log(`[CHAT] Endpoint: http://localhost:${port}/api/chat/message`);
  console.log('==================================================');

  // Inicia o agendador de notificações proativas do Voron
  NotificationScheduler.getInstance().start();
});
