import Firebird from 'node-firebird';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

const options: Firebird.Options = {
  host: process.env.FIREBIRD_HOST || '127.0.0.1',
  port: Number(process.env.FIREBIRD_PORT) || 3050,
  database: process.env.FIREBIRD_DATABASE || path.resolve(process.cwd(), '../TGA.FDB'),
  user: process.env.FIREBIRD_USER || 'SYSDBA',
  password: process.env.FIREBIRD_PASSWORD || 'masterkey',
  lowercase_keys: false,
  role: undefined,
  pageSize: 4096,
};

console.log('[Firebird] Tentando conectar ao Firebird 5.0...');
console.log(`[Config] Host: ${options.host}:${options.port}`);
console.log(`[Config] Banco: ${options.database}`);
console.log(`[Config] Usuário: ${options.user}`);

Firebird.attach(options, (err, db) => {
  if (err) {
    console.error('[Firebird] Erro ao conectar ao Firebird:', err.message || err);
    process.exit(1);
  }

  console.log('[Firebird] Conexão estabelecida com sucesso com o Firebird!');

  const query = `
    SELECT TRIM(RDB$RELATION_NAME) AS TABLE_NAME
    FROM RDB$RELATIONS
    WHERE RDB$SYSTEM_FLAG = 0
      AND RDB$VIEW_BLR IS NULL
    ORDER BY RDB$RELATION_NAME;
  `;

  db.query(query, (queryErr, result) => {
    if (queryErr) {
      console.error('[Firebird] Erro ao consultar tabelas:', queryErr.message || queryErr);
      db.detach();
      process.exit(1);
    }

    const tables = result.map((row: any) => row.TABLE_NAME);
    console.log(`\n[Firebird] Encontradas ${tables.length} tabelas no banco de dados:`);
    console.log(JSON.stringify(tables, null, 2));

    db.detach(() => {
      console.log('\n[Firebird] Conexão finalizada com segurança.');
    });
  });
});
