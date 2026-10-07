import sys
import os
import json
import time
import re
from datetime import datetime, date, timedelta
import calendar
from decimal import Decimal
import unicodedata
from firebird.driver import connect

# Reconfigura fluxos de E/S padrão para UTF-8 de forma segura no Windows
if hasattr(sys.stdin, 'reconfigure'):
    try:
        sys.stdin.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

if hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

if hasattr(sys.stderr, 'reconfigure'):
    try:
        sys.stderr.reconfigure(encoding='utf-8')
    except Exception:
        pass

from dotenv import load_dotenv

# Carrega configurações do .env do diretório do agente
_env_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), '.env')
load_dotenv(_env_path)

HOST = os.environ.get("FIREBIRD_HOST", "127.0.0.1")
DB_PATH = os.environ.get("FIREBIRD_DATABASE", r"D:\TGA\Dados\R3\TGA.FDB").replace("\\", "/")
USER = os.environ.get("FIREBIRD_USER", "SYSDBA")
PASSWORD = os.environ.get("FIREBIRD_PASSWORD", "masterkey")
CHARSET = os.environ.get("FIREBIRD_CHARSET", "WIN1252")

DSN = f"{HOST}:{DB_PATH}"

def sanitize_fb_str(val, max_len=None, to_upper=True):
    """
    Sanitiza strings para o banco Firebird / ERP (codificacao WIN1252):
    - Remove caracteres surrogates orfaos e nulos
    - Normaliza caracteres Unicode compostos (NFKC)
    - Converte com seguranca para WIN1252, descartando simbolos/emojis incompativeis
    - Opcionalmente converte para maiusculo e limita comprimento
    """
    if val is None:
        return ""
    s = str(val).strip()
    if not s:
        return ""
    # Remove surrogates órfãos
    s = s.encode('utf-8', errors='ignore').decode('utf-8', errors='ignore')
    # Normalização de acentos (evita formas decompostas como e + ´)
    s = unicodedata.normalize('NFKC', s)
    # Garante compatibilidade estrita com a tabela WIN1252 (ignorando emojis e símbolos não mapeáveis)
    s = s.encode('cp1252', errors='ignore').decode('cp1252')
    if to_upper:
        s = s.upper()
    if max_len is not None:
        s = s[:max_len]
    return s

def sanitize_params(p):
    """Sanitiza recursivamente parâmetros para queries do Firebird."""
    if p is None:
        return None
    if isinstance(p, (list, tuple)):
        return [sanitize_params(x) for x in p]
    if isinstance(p, dict):
        return {k: sanitize_params(v) for k, v in p.items()}
    if isinstance(p, str):
        return sanitize_fb_str(p, to_upper=False)
    return p

class CustomEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, (datetime, date)):
            return obj.isoformat()
        if isinstance(obj, Decimal):
            return float(obj)
        return super().default(obj)

def execute_query(sql, params=None):
    start_time = time.time()
    try:
        clean_params = sanitize_params(params) if params is not None else None
        with connect(DSN, user=USER, password=PASSWORD, charset=CHARSET) as con:
            cur = con.cursor()
            if clean_params:
                cur.execute(sql, clean_params)
            else:
                cur.execute(sql)
            
            if not cur.description:
                return {
                    "success": True,
                    "data": [],
                    "executionTimeMs": int((time.time() - start_time) * 1000)
                }

            cols = [desc[0] for desc in cur.description]
            rows = cur.fetchall()
            
            result = []
            for row in rows:
                item = {}
                for col_name, val in zip(cols, row):
                    item[col_name] = val
                result.append(item)
                
            return {
                "success": True,
                "data": result,
                "executionTimeMs": int((time.time() - start_time) * 1000)
            }
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "executionTimeMs": int((time.time() - start_time) * 1000)
        }

def resolve_period_dates(params, is_financeiro=False):
    data_inicio = params.get("dataInicio")
    data_fim = params.get("dataFim")
    period = str(params.get("period", "")).lower().strip()

    if data_inicio and data_fim:
        return data_inicio, data_fim

    if period:
        if period in ("total", "geral", "todos", "all"):
            return None, None

        today = date.today()
        if period in ("dia", "hoje", "today"):
            return today.isoformat(), today.isoformat()
        elif period in ("ontem", "yesterday"):
            yesterday = today - timedelta(days=1)
            return yesterday.isoformat(), yesterday.isoformat()
        elif period in ("semana", "7d", "ultimos_7_dias", "ultimos_7"):
            if is_financeiro:
                weekday = today.weekday()
                start_week = today - timedelta(days=weekday)
                end_week = start_week + timedelta(days=6)
                return start_week.isoformat(), end_week.isoformat()
            else:
                start_date = today - timedelta(days=7)
                return start_date.isoformat(), today.isoformat()
        elif period in ("semana_passada", "semana_anterior", "last_week"):
            weekday = today.weekday()
            start_of_this_week = today - timedelta(days=weekday)
            end_of_last_week = start_of_this_week - timedelta(days=1)
            start_of_last_week = end_of_last_week - timedelta(days=6)
            return start_of_last_week.isoformat(), end_of_last_week.isoformat()
        elif period in ("mes", "este_mes", "mtd"):
            start_date = today.replace(day=1)
            if is_financeiro:
                last_day = calendar.monthrange(today.year, today.month)[1]
                end_date = today.replace(day=last_day)
                return start_date.isoformat(), end_date.isoformat()
            else:
                return start_date.isoformat(), today.isoformat()
        elif period in ("mes_anterior", "last_month"):
            # Mês anterior fechado completo
            first_this_month = today.replace(day=1)
            last_prev_month = first_this_month - timedelta(days=1)
            first_prev_month = last_prev_month.replace(day=1)
            return first_prev_month.isoformat(), last_prev_month.isoformat()
        elif period in ("30d", "ultimos_30", "ultimos_30_dias"):
            start_date = today - timedelta(days=30)
            return start_date.isoformat(), today.isoformat()
        elif period in ("ano", "este_ano", "ytd"):
            start_date = today.replace(month=1, day=1)
            if is_financeiro:
                end_date = today.replace(month=12, day=31)
                return start_date.isoformat(), end_date.isoformat()
            else:
                return start_date.isoformat(), today.isoformat()

    return data_inicio, data_fim

def resolve_codigos_tmv(params):
    # Se passado diretamente a lista de códigos
    cods = params.get("codigosMovimento")
    if isinstance(cods, list) and len(cods) > 0:
        return [str(c).strip() for c in cods if str(c).strip()]
    if isinstance(cods, str) and cods.strip():
        return [c.strip() for c in cods.split(",") if c.strip()]
        
    tipo_operacao = str(params.get("tipoOperacao", "venda")).lower().strip()
    if tipo_operacao in ("orcamento", "orcamentos", "cotacao"):
        orc_cods = params.get("codigosOrcamento")
        if isinstance(orc_cods, list) and len(orc_cods) > 0:
            return [str(c).strip() for c in orc_cods if str(c).strip()]
        return ["2.2.01"]
        
    venda_cods = params.get("codigosVenda")
    if isinstance(venda_cods, list) and len(venda_cods) > 0:
        return [str(c).strip() for c in venda_cods if str(c).strip()]
        
    return ["2.2.03"]

def handle_tool(tool_name, params):
    if tool_name == "consultar_resumo_vendas":
        data_inicio, data_fim = resolve_period_dates(params)
        codigos_tmv = resolve_codigos_tmv(params)
        vendedor_id = params.get("vendedorId")
        tipo_operacao = str(params.get("tipoOperacao", "venda")).lower().strip()
        status_pedido = params.get("statusPedido")
        
        where_tmv = f"AND v.CODTMV IN ({', '.join(['?'] * len(codigos_tmv))})"
        sql_params = list(codigos_tmv)
        
        if vendedor_id:
            where_tmv += " AND v.CODVEN1 = ?"
            sql_params.append(str(vendedor_id))
        
        where_date = ""
        if data_inicio and data_fim:
            where_date = "AND v.DATAEMISSAO BETWEEN ? AND ?"
            sql_params.extend([data_inicio, data_fim])
        elif data_inicio:
            where_date = "AND v.DATAEMISSAO = ?"
            sql_params.append(data_inicio)
            
        if tipo_operacao in ("orcamento", "orcamentos", "cotacao"):
            where_status = ""
            if status_pedido:
                st = str(status_pedido).upper().strip()
                if st in ("A", "FATURADO", "FATURADOS", "CONCLUIDO"):
                    where_status = "AND v.STATUSPEDIDO = 'A'"
                elif st in ("D", "ABERTO", "ABERTOS", "PENDENTE"):
                    where_status = "AND (v.STATUSPEDIDO IS NULL OR v.STATUSPEDIDO = 'D')"
                elif st in ("P", "PARCIAL", "PARCIAIS"):
                    where_status = "AND v.STATUSPEDIDO = 'P'"
                elif st in ("TODOS", "ALL"):
                    where_status = ""
                elif st in ("ATIVO", "ATIVOS", "PIPELINE"):
                    where_status = "AND (v.STATUSPEDIDO IS NULL OR v.STATUSPEDIDO IN ('D', 'P'))"
                else:
                    where_status = f"AND v.STATUSPEDIDO = '{st}'"

            if where_status:
                sql = f"""
                    SELECT 
                        COUNT(v.IDMOV) AS TOTAL_VENDAS,
                        COALESCE(SUM(v.VALORLIQUIDO), 0) AS FATURAMENTO_TOTAL,
                        COALESCE(AVG(v.VALORLIQUIDO), 0) AS TICKET_MEDIO,
                        COUNT(CASE WHEN v.STATUSPEDIDO = 'A' THEN 1 ELSE NULL END) AS TOTAL_FATURADOS,
                        COALESCE(SUM(CASE WHEN v.STATUSPEDIDO = 'A' THEN v.VALORLIQUIDO ELSE 0 END), 0) AS VALOR_FATURADOS,
                        COUNT(CASE WHEN v.STATUSPEDIDO = 'P' THEN 1 ELSE NULL END) AS TOTAL_PARCIAIS,
                        COUNT(v.IDMOV) AS TOTAL_EMITIDOS,
                        COALESCE(SUM(v.VALORLIQUIDO), 0) AS VALOR_EMITIDO
                    FROM TMOV v
                    WHERE v.STATUS <> 'C'
                      AND v.DATACANCELAMENTOMOV IS NULL
                      {where_status}
                      {where_tmv}
                      {where_date}
                """
            else:
                # Por padrão para orçamentos: TOTAL_VENDAS e FATURAMENTO_TOTAL refletem o pipeline em aberto (D e P)
                sql = f"""
                    SELECT 
                        COUNT(CASE WHEN (v.STATUSPEDIDO IS NULL OR v.STATUSPEDIDO IN ('D', 'P')) THEN 1 ELSE NULL END) AS TOTAL_VENDAS,
                        COALESCE(SUM(CASE WHEN (v.STATUSPEDIDO IS NULL OR v.STATUSPEDIDO IN ('D', 'P')) THEN v.VALORLIQUIDO ELSE 0 END), 0) AS FATURAMENTO_TOTAL,
                        COALESCE(AVG(CASE WHEN (v.STATUSPEDIDO IS NULL OR v.STATUSPEDIDO IN ('D', 'P')) THEN v.VALORLIQUIDO ELSE NULL END), 0) AS TICKET_MEDIO,
                        COUNT(CASE WHEN v.STATUSPEDIDO = 'A' THEN 1 ELSE NULL END) AS TOTAL_FATURADOS,
                        COALESCE(SUM(CASE WHEN v.STATUSPEDIDO = 'A' THEN v.VALORLIQUIDO ELSE 0 END), 0) AS VALOR_FATURADOS,
                        COUNT(CASE WHEN v.STATUSPEDIDO = 'P' THEN 1 ELSE NULL END) AS TOTAL_PARCIAIS,
                        COUNT(v.IDMOV) AS TOTAL_EMITIDOS,
                        COALESCE(SUM(v.VALORLIQUIDO), 0) AS VALOR_EMITIDO
                    FROM TMOV v
                    WHERE v.STATUS <> 'C'
                      AND v.DATACANCELAMENTOMOV IS NULL
                      {where_tmv}
                      {where_date}
                """
        else:
            sql = f"""
                SELECT 
                    COUNT(v.IDMOV) AS TOTAL_VENDAS,
                    COALESCE(SUM(v.VALORLIQUIDO), 0) AS FATURAMENTO_TOTAL,
                    COALESCE(AVG(v.VALORLIQUIDO), 0) AS TICKET_MEDIO
                FROM TMOV v
                WHERE v.STATUS <> 'C'
                  AND v.DATACANCELAMENTOMOV IS NULL
                  {where_tmv}
                  {where_date}
            """
        rows = execute_query(sql, sql_params if sql_params else None)
        return rows

    elif tool_name == "consultar_ranking_produtos":
        limite = int(params.get("limite", 5))
        data_inicio, data_fim = resolve_period_dates(params)
        codigos_tmv = resolve_codigos_tmv(params)
        vendedor_id = params.get("vendedorId")
        
        where_tmv = f"AND v.CODTMV IN ({', '.join(['?'] * len(codigos_tmv))})"
        sql_params = list(codigos_tmv)
        
        if vendedor_id:
            where_tmv += " AND v.CODVEN1 = ?"
            sql_params.append(str(vendedor_id))
        
        where_date = ""
        if data_inicio and data_fim:
            where_date = "AND v.DATAEMISSAO BETWEEN ? AND ?"
            sql_params.extend([data_inicio, data_fim])
        elif data_inicio:
            where_date = "AND v.DATAEMISSAO >= ?"
            sql_params.append(data_inicio)
        elif data_fim:
            where_date = "AND v.DATAEMISSAO <= ?"
            sql_params.append(data_fim)

        # Relacionamento estrito: TMOVITENS i vinculado à TMOV v através do campo IDMOV
        sql = f"""
            SELECT FIRST {limite}
                i.CODPRD,
                COALESCE(p.DESCRICAO, p.NOMEFANTASIA, i.DESCRICAO, 'Produto ' || i.CODPRD) AS DESCRICAO,
                COALESCE(i.CODUND, p.UNIDADE, 'UN') AS UNIDADE,
                SUM(i.QUANTIDADE) AS QTD_TOTAL,
                SUM(i.VALORTOTALITEM) AS VALOR_TOTAL
            FROM TMOVITENS i
            JOIN TMOV v ON v.IDMOV = i.IDMOV
            LEFT JOIN TPRODUTO p ON p.CODPRD = i.CODPRD
            WHERE v.STATUS <> 'C'
              AND v.DATACANCELAMENTOMOV IS NULL
              {where_tmv}
              {where_date}
            GROUP BY i.CODPRD, p.DESCRICAO, p.NOMEFANTASIA, i.DESCRICAO, i.CODUND, p.UNIDADE
            ORDER BY VALOR_TOTAL DESC
        """
        rows = execute_query(sql, sql_params if sql_params else None)
        return rows

    elif tool_name == "consultar_ranking_clientes":
        limite = int(params.get("limite", 5))
        data_inicio = params.get("dataInicio")
        data_fim = params.get("dataFim")
        codigos_tmv = resolve_codigos_tmv(params)
        vendedor_id = params.get("vendedorId")

        where_tmv = f"AND v.CODTMV IN ({', '.join(['?'] * len(codigos_tmv))})"
        sql_params = list(codigos_tmv)
        
        if vendedor_id:
            where_tmv += " AND v.CODVEN1 = ?"
            sql_params.append(str(vendedor_id))

        where_date = ""
        if data_inicio and data_fim:
            where_date = "AND v.DATAEMISSAO BETWEEN ? AND ?"
            sql_params.extend([data_inicio, data_fim])

        sql = f"""
            SELECT FIRST {limite}
                c.CODCFO,
                COALESCE(c.NOMEFANTASIA, c.NOME, 'Cliente sem nome') AS NOME_CLIENTE,
                c.CIDADE,
                COUNT(v.IDMOV) AS TOTAL_COMPRAS,
                SUM(v.VALORLIQUIDO) AS VALOR_TOTAL
            FROM TMOV v
            JOIN FCFO c ON c.CODCFO = v.CODCFO
            WHERE v.STATUS <> 'C'
              AND v.DATACANCELAMENTOMOV IS NULL
              {where_tmv}
              {where_date}
            GROUP BY c.CODCFO, c.NOMEFANTASIA, c.NOME, c.CIDADE
            ORDER BY VALOR_TOTAL DESC
        """
        return execute_query(sql, sql_params if sql_params else None)

    elif tool_name == "consultar_pedidos_orcamentos":
        limite = int(params.get("limite", 500))
        if limite > 2000:
            limite = 2000
        elif limite < 1:
            limite = 500
        data_inicio, data_fim = resolve_period_dates(params)
        codigos_tmv = resolve_codigos_tmv(params)
        vendedor_id = params.get("vendedorId")
        status_pedido = params.get("statusPedido")
        busca = str(params.get("busca", "")).strip()

        where_tmv = f"AND v.CODTMV IN ({', '.join(['?'] * len(codigos_tmv))})"
        sql_params = list(codigos_tmv)

        if vendedor_id:
            where_tmv += " AND v.CODVEN1 = ?"
            sql_params.append(str(vendedor_id))

        where_date = ""
        if data_inicio and data_fim:
            where_date = "AND v.DATAEMISSAO BETWEEN ? AND ?"
            sql_params.extend([data_inicio, data_fim])
        elif data_inicio:
            where_date = "AND v.DATAEMISSAO = ?"
            sql_params.append(data_inicio)

        where_status = ""
        if status_pedido:
            st = str(status_pedido).upper().strip()
            if st in ("A", "FATURADO", "FATURADOS", "CONCLUIDO"):
                where_status = "AND v.STATUSPEDIDO = 'A'"
            elif st in ("D", "ABERTO", "ABERTOS", "PENDENTE"):
                where_status = "AND (v.STATUSPEDIDO IS NULL OR v.STATUSPEDIDO = 'D')"
            elif st in ("P", "PARCIAL", "PARCIAIS"):
                where_status = "AND v.STATUSPEDIDO = 'P'"
            elif st in ("TODOS", "ALL"):
                where_status = ""
            elif st in ("ATIVO", "ATIVOS", "PIPELINE"):
                where_status = "AND (v.STATUSPEDIDO IS NULL OR v.STATUSPEDIDO IN ('D', 'P'))"
            else:
                where_status = f"AND v.STATUSPEDIDO = '{st}'"

        where_busca = ""
        if busca:
            where_busca = "AND (v.NUMEROMOV STARTING WITH ? OR UPPER(c.NOMEFANTASIA) LIKE UPPER(?) OR UPPER(c.NOME) LIKE UPPER(?))"
            like_busca = f"%{busca}%"
            sql_params.extend([busca, like_busca, like_busca])

        sql = f"""
            SELECT FIRST {limite}
                v.IDMOV,
                v.NUMEROMOV,
                v.CODTMV,
                tm.NOME AS TIPO_MOVIMENTO,
                v.DATAEMISSAO,
                v.VALORLIQUIDO,
                v.STATUSPEDIDO,
                CASE 
                    WHEN v.STATUSPEDIDO = 'A' THEN 'Faturado'
                    WHEN v.STATUSPEDIDO = 'P' THEN 'Parcial'
                    WHEN v.STATUSPEDIDO = 'D' THEN 'Em Aberto'
                    ELSE 'Sem Status'
                END AS DESCRICAO_STATUS_PEDIDO,
                v.STATUS,
                COALESCE(c.NOMEFANTASIA, c.NOME, 'Cliente sem nome') AS NOME_CLIENTE,
                c.CODCFO,
                v.CODVEN1 AS VENDEDOR
            FROM TMOV v
            LEFT JOIN TTIPOMOV tm ON tm.CODTIPOMOV = v.CODTMV
            LEFT JOIN FCFO c ON c.CODCFO = v.CODCFO
            WHERE v.STATUS <> 'C'
              AND v.DATACANCELAMENTOMOV IS NULL
              {where_tmv}
              {where_date}
              {where_status}
              {where_busca}
            ORDER BY v.DATAEMISSAO DESC, v.IDMOV DESC
        """
        return execute_query(sql, sql_params if sql_params else None)

    elif tool_name == "consultar_fluxo_financeiro":
        data_inicio, data_fim = resolve_period_dates(params, is_financeiro=True)
        if not data_inicio and not data_fim:
            data_inicio = params.get("dataVencimentoDe")
            data_fim = params.get("dataVencimentoAte")
        tipo = str(params.get("tipo", "")).strip().upper()
        apenas_pendentes = params.get("apenasPendentes", True)
        excluir_previsao = params.get("excluirPrevisao", True)
        tipos_doc = params.get("tiposDocumento")
        status = params.get("status")
        consolidado = params.get("consolidado", False)

        conditions = []
        sql_params = []

        # Regra de negócio: STATUSLAN = 'A' para títulos em aberto/pendentes
        if status:
            conditions.append("f.STATUSLAN = ?")
            sql_params.append(status)
        elif apenas_pendentes:
            conditions.append("f.STATUSLAN = 'A'")

        # Regra de negócio: TIPODOC <> 'PRE' (campo CODTDO no Firebird)
        if excluir_previsao:
            conditions.append("(f.CODTDO <> 'PRE' OR f.CODTDO IS NULL)")

        # Tipos de documento permitidos (ex: DP, BO, CH)
        if isinstance(tipos_doc, list) and len(tipos_doc) > 0:
            placeholders = ", ".join(["?"] * len(tipos_doc))
            conditions.append(f"f.CODTDO IN ({placeholders})")
            sql_params.extend([str(td).strip().upper() for td in tipos_doc])

        # Regra de negócio: TIPO = 'P' (Pagar) e 'R' (Receber)
        if tipo in ("P", "PAGAR"):
            conditions.append("f.PAGREC = 'P'")
        elif tipo in ("R", "RECEBER"):
            conditions.append("f.PAGREC = 'R'")

        # Filtro dinâmico por data de vencimento (DATAVENCIMENTO)
        if data_inicio and data_fim:
            conditions.append("f.DATAVENCIMENTO BETWEEN ? AND ?")
            sql_params.extend([data_inicio, data_fim])
        elif data_inicio:
            conditions.append("f.DATAVENCIMENTO >= ?")
            sql_params.append(data_inicio)
        elif data_fim:
            conditions.append("f.DATAVENCIMENTO <= ?")
            sql_params.append(data_fim)

        where_clause = "WHERE " + " AND ".join(conditions) if conditions else ""

        if consolidado:
            sql = f"""
                SELECT
                    f.PAGREC AS TIPO,
                    COUNT(f.IDLAN) AS TOTAL_TITULOS,
                    COALESCE(SUM(COALESCE(f.VALORORIGINAL - COALESCE(f.VALORBAIXADO, 0), f.VALORORIGINAL)), 0) AS VALORABERTO,
                    COALESCE(SUM(COALESCE(f.VALORORIGINAL - COALESCE(f.VALORBAIXADO, 0), f.VALORORIGINAL)), 0) AS TOTAL_ABERTO,
                    COALESCE(SUM(f.VALORORIGINAL), 0) AS VALORORIGINAL,
                    COALESCE(SUM(f.VALORORIGINAL), 0) AS TOTAL_ORIGINAL
                FROM FLAN f
                {where_clause}
                GROUP BY f.PAGREC
            """
            return execute_query(sql, sql_params if sql_params else None)
        else:
            limite = int(params.get("limite", 500))
            if limite > 2000:
                limite = 2000
            elif limite < 1:
                limite = 500
            sql = f"""
                SELECT FIRST {limite}
                    f.IDLAN,
                    f.PAGREC AS TIPO,
                    COALESCE(c.NOMEFANTASIA, c.NOME, f.HISTORICO, 'Diversos') AS NOMECFO,
                    f.DATAVENCIMENTO,
                    f.VALORORIGINAL,
                    f.VALORORIGINAL AS TOTAL_ORIGINAL,
                    COALESCE(f.VALORORIGINAL - COALESCE(f.VALORBAIXADO, 0), f.VALORORIGINAL) AS VALORABERTO,
                    COALESCE(f.VALORORIGINAL - COALESCE(f.VALORBAIXADO, 0), f.VALORORIGINAL) AS TOTAL_ABERTO,
                    f.STATUSLAN
                FROM FLAN f
                LEFT JOIN FCFO c ON c.CODCFO = f.CODCFO
                {where_clause}
                ORDER BY f.DATAVENCIMENTO ASC, f.VALORORIGINAL DESC
            """
            return execute_query(sql, sql_params if sql_params else None)

    elif tool_name == "consultar_tipos_movimento_erp":
        # No Firebird do ERP TGA a tabela TTIPOMOV possui CODTIPOMOV, NOME e INATIVO
        sql = """
            SELECT 
                tm.CODTIPOMOV AS CODTMV, 
                COALESCE(tm.NOME, 'Sem Descricao') AS DESCRICAO
            FROM TTIPOMOV tm
            WHERE (tm.CODTIPOMOV STARTING WITH '2.1' OR tm.CODTIPOMOV STARTING WITH '2.2')
              AND (tm.INATIVO IS NULL OR tm.INATIVO <> 'T')
            ORDER BY tm.CODTIPOMOV ASC
        """
        return execute_query(sql)

    elif tool_name == "consultar_vendedores_erp":
        # Tabela TVENDEDOR no ERP TGA usa CODVEN, NOME e INATIVO
        try:
            sql = """
                SELECT 
                    v.CODVEN, 
                    COALESCE(v.NOME, 'Vendedor ' || v.CODVEN) AS NOME 
                FROM TVENDEDOR v 
                WHERE (v.INATIVO IS NULL OR v.INATIVO <> 'T')
                ORDER BY v.NOME ASC
            """
            res = execute_query(sql)
            if res.get("success") and len(res.get("data", [])) > 0:
                return res
        except Exception:
            pass
        # Fallback para distintos vendedores registrados em TMOV
        sql = """
            SELECT DISTINCT 
                v.CODVEN1 AS CODVEN, 
                'Vendedor ' || v.CODVEN1 AS NOME 
            FROM TMOV v 
            WHERE v.CODVEN1 IS NOT NULL AND v.CODVEN1 <> ''
            ORDER BY v.CODVEN1 ASC
        """
        return execute_query(sql)

    elif tool_name == "consultar_itens":
        termo = str(params.get("busca", "")).strip()
        filtro_estoque = str(params.get("filtroEstoque", "todos")).strip().lower()
        tabela_saldo = str(params.get("tabelaSaldo", "saldo1")).strip().lower()
        limite = int(params.get("limite", 40))
        if limite > 100:
            limite = 100
        elif limite < 1:
            limite = 40

        # Proteção contra sobrecarga do servidor: não busca todos os itens se não houver termo pesquisado
        if not termo:
            return {
                "success": True,
                "data": [],
                "executionTimeMs": 0
            }

        conditions = ["(p.INATIVO IS NULL OR p.INATIVO <> 'T')"]
        sql_params = []

        saldo_subquery = "(SELECT SUM(s.SALDOFISICO2) FROM TPRODSALDO s WHERE s.CODPRD = p.CODPRD)" if tabela_saldo == "saldo2" else "(SELECT SUM(s.SALDOFISICO1) FROM TPRODSALDO s WHERE s.CODPRD = p.CODPRD)"

        if filtro_estoque == "com_estoque":
            conditions.append(f"COALESCE({saldo_subquery}, 0) > 0")
        elif filtro_estoque in ("sem_estoque", "zerado", "negativo"):
            conditions.append(f"COALESCE({saldo_subquery}, 0) <= 0")

        or_clauses = [
            "p.CODPRD STARTING WITH ?",
            "p.CODBARRAS = ?",
            "UPPER(p.NOMEFANTASIA) LIKE UPPER(?)",
            "p.DESCRICAO CONTAINING ?"
        ]
        like_term = f"%{termo}%"
        sql_params.extend([termo, termo, like_term, termo])

        if termo.isdigit():
            or_clauses.append("p.CODIGOREDUZIDO = ?")
            sql_params.append(int(termo))

        conditions.append(f"({' OR '.join(or_clauses)})")

        where_clause = "WHERE " + " AND ".join(conditions)
        sql = f"""
            SELECT FIRST {limite}
                p.CODPRD AS CODIGO,
                COALESCE(p.NOMEFANTASIA, p.DESCRICAO, 'Produto ' || p.CODPRD) AS NOME,
                COALESCE(p.UNIDADE, 'UN') AS UNIDADE,
                COALESCE(p.PRECO1, 0) AS PRECO1,
                COALESCE(p.PRECO2, 0) AS PRECO2,
                COALESCE((SELECT SUM(s.SALDOFISICO1) FROM TPRODSALDO s WHERE s.CODPRD = p.CODPRD), 0) AS SALDO_FISICO,
                COALESCE((SELECT SUM(s.SALDOFISICO2) FROM TPRODSALDO s WHERE s.CODPRD = p.CODPRD), 0) AS SALDO_FISCAL,
                p.CODBARRAS AS CODIGO_BARRAS
            FROM TPRODUTO p
            {where_clause}
            ORDER BY COALESCE(p.NOMEFANTASIA, p.DESCRICAO) ASC
        """
        return execute_query(sql, sql_params if sql_params else None)

    elif tool_name == "consultar_clientes_erp":
        busca = str(params.get("busca", "")).strip()
        limite = int(params.get("limite", 30))
        if limite > 100:
            limite = 100
        elif limite < 1:
            limite = 30

        conditions = ["(c.TIPO IN ('C', 'A') OR c.CODCFO STARTING WITH 'C')"]
        sql_params = []

        if busca:
            clean_busca = busca.strip()
            digits = re.sub(r'\D', '', clean_busca)

            or_clauses = [
                "c.CODCFO STARTING WITH ?",
                "c.NOME CONTAINING ?",
                "c.NOMEFANTASIA CONTAINING ?",
                "c.CIDADE CONTAINING ?"
            ]
            sql_params.extend([clean_busca, clean_busca, clean_busca, clean_busca])

            if len(digits) >= 3:
                or_clauses.append("REPLACE(REPLACE(REPLACE(c.CGCCFO, '.', ''), '-', ''), '/', '') STARTING WITH ?")
                sql_params.append(digits)
                or_clauses.append("c.CGCCFO STARTING WITH ?")
                sql_params.append(clean_busca)
            elif len(clean_busca) >= 3:
                or_clauses.append("c.CGCCFO CONTAINING ?")
                sql_params.append(clean_busca)

            conditions.append(f"({' OR '.join(or_clauses)})")

            escaped_busca = clean_busca.replace("'", "''")
            order_by = f"""
                CASE 
                    WHEN c.CODCFO = '{escaped_busca}' THEN 1
                    WHEN c.CODCFO STARTING WITH '{escaped_busca}' THEN 2
                    WHEN UPPER(c.NOMEFANTASIA) STARTING WITH UPPER('{escaped_busca}') THEN 3
                    WHEN UPPER(c.NOME) STARTING WITH UPPER('{escaped_busca}') THEN 4
                    ELSE 5
                END, c.NOME ASC
            """
        else:
            order_by = "c.DATAHORAATUALIZACAO DESC NULLS LAST, c.NOME ASC"

        where_clause = "WHERE " + " AND ".join(conditions)

        sql = f"""
            SELECT FIRST {limite}
                c.CODCFO,
                COALESCE(c.NOME, 'Cliente sem Nome') AS NOME,
                COALESCE(c.NOMEFANTASIA, c.NOME) AS NOMEFANTASIA,
                c.CGCCFO,
                c.TELEFONE,
                c.CIDADE,
                c.CODETD AS UF,
                c.ATIVO
            FROM FCFO c
            {where_clause}
            ORDER BY {order_by}
        """
        return execute_query(sql, sql_params if sql_params else None)

    elif tool_name == "cadastrar_cliente_erp":
        start_time = time.time()
        tipo_pessoa = sanitize_fb_str(params.get("tipoPessoa", "F"), 1) or "F"
        nome = sanitize_fb_str(params.get("nome", ""), 60)
        nome_fantasia = sanitize_fb_str(params.get("nomeFantasia", "") or nome, 60)
        cpf_cnpj = sanitize_fb_str(params.get("cpfCnpj") or params.get("cpf_cnpj") or params.get("cpf") or params.get("cnpj") or "", 20)
        # RG não é necessário (campo no Firebird seria CI_NUMERO, omitido/NULL).
        # Inscrição Estadual (IE) é opcional para CNPJ (campo INSCRESTADUAL no Firebird).
        # Campo indicador na tabela FCFO: INDICADORIE ('C' = Contribuinte, 'N' = Não Contribuinte, 'I' = Contribuinte Isento)
        raw_ie = sanitize_fb_str(params.get("inscricaoEstadual") or params.get("rgIe") or "", 20)
        explicit_ind = sanitize_fb_str(params.get("indicadorIe") or "", 1)

        if tipo_pessoa == "J" and raw_ie and raw_ie != "ISENTO":
            inscricao_estadual = raw_ie[:20]
            indicador_ie = explicit_ind if explicit_ind in ["C", "N", "I"] else "C"
        else:
            # Se não for informado IE para CNPJ (ou for PF), deixa como ' ' mesmo
            inscricao_estadual = " "
            indicador_ie = explicit_ind if explicit_ind in ["C", "N", "I"] else "N"
            
        raw_email = str(params.get("email", "") or "").strip()
        email = sanitize_fb_str(raw_email, 120, to_upper=False).lower() if raw_email else None
        telefone = sanitize_fb_str(params.get("telefone", ""), 15)
        cep = sanitize_fb_str(params.get("cep", ""), 9)
        logradouro = sanitize_fb_str(params.get("logradouro", ""), 80)
        numero = sanitize_fb_str(params.get("numero", ""), 8)
        raw_comp = params.get("complemento")
        complemento = sanitize_fb_str(raw_comp, 80) if raw_comp else None
        bairro = sanitize_fb_str(params.get("bairro", ""), 40)
        cidade = sanitize_fb_str(params.get("cidade", ""), 32)
        uf = sanitize_fb_str(params.get("uf", ""), 2)
        cod_empresa = int(params.get("codEmpresa", 1))
        cod_filial = int(params.get("codFilial", 1))

        if not nome:
            return {"success": False, "error": "Nome/Razão Social é obrigatório."}
        if not cpf_cnpj:
            return {"success": False, "error": "CPF/CNPJ é obrigatório."}

        raw_doc = re.sub(r'\D', '', cpf_cnpj)
        # Formata documento com máscara padrão se vier limpo
        if len(raw_doc) == 11:
            doc_formatado = f"{raw_doc[:3]}.{raw_doc[3:6]}.{raw_doc[6:9]}-{raw_doc[9:]}"
        elif len(raw_doc) == 14:
            doc_formatado = f"{raw_doc[:2]}.{raw_doc[2:5]}.{raw_doc[5:8]}/{raw_doc[8:12]}-{raw_doc[12:]}"
        else:
            doc_formatado = cpf_cnpj

        try:
            with connect(DSN, user=USER, password=PASSWORD, charset=CHARSET) as con:
                cur = con.cursor()
                
                # 1. Checagem anti-duplicidade em CGCCFO (Opção 1)
                check_sql = """
                    SELECT FIRST 1 CODCFO, NOME, CGCCFO, TELEFONE, EMAIL
                    FROM FCFO
                    WHERE CGCCFO = ? OR CGCCFO = ?
                """
                cur.execute(check_sql, (cpf_cnpj, doc_formatado))
                existing = cur.fetchone()
                if not existing and raw_doc:
                    cur.execute("""
                        SELECT FIRST 1 CODCFO, NOME, CGCCFO, TELEFONE, EMAIL
                        FROM FCFO
                        WHERE REPLACE(REPLACE(REPLACE(CGCCFO, '.', ''), '-', ''), '/', '') = ?
                    """, (raw_doc,))
                    existing = cur.fetchone()

                if existing:
                    cod_exist = existing[0].strip() if existing[0] else ""
                    nome_exist = existing[1].strip() if existing[1] else ""
                    msg = f"Este CPF/CNPJ já possui cadastro ativo no ERP (Código: {cod_exist} - {nome_exist})."
                    return {
                        "success": False,
                        "code": "DOCUMENT_ALREADY_EXISTS",
                        "error": msg,
                        "message": msg,
                        "existingClient": {
                            "codcfo": cod_exist,
                            "nome": nome_exist,
                            "documento": existing[2].strip() if existing[2] else ""
                        }
                    }

                # 2. Geração de próximo CODCFO sequencial sincronizado com GAUTOINC (ERP TGA)
                cur.execute(
                    "SELECT VALOR FROM GAUTOINC WHERE CODEMPRESA = ? AND TABELA = 'FCFO' AND CAMPO = 'C'",
                    (cod_empresa,)
                )
                row_auto = cur.fetchone()
                val_auto = int(row_auto[0]) if row_auto and row_auto[0] is not None else 0

                cur.execute(
                    "SELECT FIRST 1 CODCFO FROM FCFO WHERE CODEMPRESA = ? AND CODCFO STARTING WITH 'C' ORDER BY CODCFO DESC",
                    (cod_empresa,)
                )
                row_fcfo = cur.fetchone()
                last_code = row_fcfo[0].strip() if row_fcfo and row_fcfo[0] else 'C00000'
                last_num = int(re.sub(r'\D', '', last_code)) if re.sub(r'\D', '', last_code) else 0

                next_num = max(val_auto + 1, last_num + 1)
                new_cod = f"C{next_num:05d}"

                # 3. Resolução de IDCIDADE (Código IBGE) se não informado
                id_cidade = params.get("idCidade")
                if id_cidade:
                    try:
                        id_cidade = int(id_cidade)
                    except:
                        id_cidade = None
                if not id_cidade and cidade and uf:
                    try:
                        cur.execute("SELECT FIRST 1 IDCIDADE FROM FCFO WHERE UPPER(CIDADE) = UPPER(?) AND CODETD = ? AND IDCIDADE IS NOT NULL", (cidade, uf))
                        row_cid = cur.fetchone()
                        if row_cid and row_cid[0]:
                            id_cidade = int(row_cid[0])
                    except:
                        pass

                # 4. Inserção na tabela FCFO conforme padrão oficial
                insert_sql = """
                    INSERT INTO FCFO (
                        CODEMPRESA,
                        CODFILIAL,
                        CODCFO,
                        NOMEFANTASIA,
                        NOME,
                        CGCCFO,
                        PESSOAFISJUR,
                        TIPO,
                        CODTIPOCFO,
                        ATIVO,
                        DATACRIACAO,
                        DATAHORAATUALIZACAO,
                        USUARIOINCLUSAO,
                        RUA,
                        NUMERO,
                        COMPLEMENTO,
                        BAIRRO,
                        CIDADE,
                        CODETD,
                        CEP,
                        IDCIDADE,
                        TELEFONE,
                        EMAIL,
                        INSCRESTADUAL,
                        INDICADORIE,
                        CODPAIS,
                        CODETDPGTO,
                        CODETDENTREGA,
                        SOVENDAAVISTA,
                        TIPODIAVENCIMENTO,
                        NAOENVIARCARTACOBR,
                        NAOCONSIDERADESCLAN,
                        DIADOFATURAMENTO
                    ) VALUES (
                        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
                        ?, ?, ?, ?, ?, ?, ?, ?
                    )
                """

                insert_params = (
                    cod_empresa,
                    cod_filial,
                    new_cod,
                    nome_fantasia[:60],
                    nome[:60],
                    doc_formatado[:20],
                    tipo_pessoa[:1],
                    'A',
                    '01',
                    'T',
                    date.today(),
                    datetime.now(),
                    'MARCELIA',
                    logradouro[:80],
                    numero[:8],
                    complemento[:80] if complemento else None,
                    bairro[:40],
                    cidade[:32],
                    uf[:2],
                    cep[:9],
                    id_cidade,
                    telefone[:15],
                    email[:120] if email else None,
                    inscricao_estadual,
                    indicador_ie,
                    '1058',
                    uf[:2],
                    uf[:2],
                    'F',
                    'N',
                    'F',
                    'F',
                    0
                )

                cur.execute(insert_sql, insert_params)

                # 5. Atualização atômica do sequenciador GAUTOINC (evita colisão de chave primária no ERP)
                try:
                    cur.execute(
                        "UPDATE GAUTOINC SET VALOR = ? WHERE CODEMPRESA = ? AND TABELA = 'FCFO' AND CAMPO = 'C'",
                        (next_num, cod_empresa)
                    )
                except Exception as auto_err:
                    print(f"[WARN] Falha ao atualizar GAUTOINC: {auto_err}", file=sys.stderr)

                # 6. Gravação de log de auditoria em GAUDITORIA (Conformidade oficial do ERP TGA)
                try:
                    audit_sql = """
                        INSERT INTO GAUDITORIA (
                            USUARIO, COMPUTADOR, DATAHORA, OPERACAO, TABELA, 
                            TEXTO, CAMPOSALTERADOS, USUARIOWINDOWS, CAMPOCHAVE, CODEMPRESA
                        ) VALUES (
                            ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
                        )
                    """
                    cur.execute(audit_sql, (
                        'MARCELIA',
                        'APP_INTEGRADOR',
                        datetime.now(),
                        'INCLUSAO',
                        'FCFO',
                        f'EMPRESA={cod_empresa},CODIGO={new_cod},NOMEFANTASIA={nome_fantasia[:60]}',
                        None,
                        'App',
                        -1,
                        cod_empresa
                    ))
                except Exception as audit_err:
                    print(f"[WARN] Falha ao registrar GAUDITORIA: {audit_err}", file=sys.stderr)

                con.commit()

                return {
                    "success": True,
                    "codcfo": new_cod,
                    "nome": nome,
                    "documento": doc_formatado,
                    "executionTimeMs": int((time.time() - start_time) * 1000),
                    "message": f"Cliente {new_cod} cadastrado com sucesso no ERP com usuária MARCELIA."
                }

        except Exception as e:
            return {
                "success": False,
                "error": f"Erro ao cadastrar cliente no Firebird: {str(e)}",
                "executionTimeMs": int((time.time() - start_time) * 1000)
            }

    elif tool_name == "executar_consulta_leitura_segura":
        raw_sql = params.get("sql", "").strip()

        # 1. Impede múltiplos comandos separados por ponto e vírgula
        clean_check = raw_sql.rstrip(';').strip()
        if ';' in clean_check:
            return {"success": False, "error": "Múltiplos comandos SQL não são permitidos por segurança."}

        upper_sql = clean_check.upper()

        # 2. Validação estrita anti-mutação e DDL
        forbidden_keywords = [
            "INSERT", "UPDATE", "DELETE", "DROP", "ALTER", "CREATE", 
            "EXECUTE", "GRANT", "REVOKE", "INTO", "MERGE"
        ]
        for word in forbidden_keywords:
            if re.search(r'\b' + re.escape(word) + r'\b', upper_sql):
                return {"success": False, "error": f"Comando '{word}' não permitido em modo de consulta segura."}

        # 3. Bloqueio absoluto de tabelas de senhas, usuários do sistema e metadados de credenciais
        sensitive_patterns = [
            r'\bSENHA\b', r'\bSENHAS\b', r'\bPASSWORD\b', r'\bUSUARIO\b', r'\bUSUARIOS\b',
            r'\bGUSUARIO\b', r'\bGUSUARIOS\b', r'\bPERMISSAO\b', r'\bPERMISSOES\b',
            r'\bRDB\$USER\w*\b', r'\bSEC\$USER\w*\b', r'\bRDB\$ROLE\w*\b', r'\bRDB\$SECURITY\w*\b'
        ]
        for pattern in sensitive_patterns:
            if re.search(pattern, upper_sql):
                return {"success": False, "error": "Acesso a tabelas de credenciais, senhas e usuários é estritamente proibido."}

        # 4. Deve ser estritamente uma consulta SELECT
        if not re.match(r'^\s*SELECT\b', upper_sql):
            return {"success": False, "error": "Apenas comandos de leitura SELECT são permitidos."}

        return execute_query(raw_sql)

    else:
        return {"success": False, "error": f"Ferramenta desconhecida: {tool_name}"}


if __name__ == "__main__":
    if len(sys.argv) > 1:
        payload_str = sys.argv[1]
    else:
        # Lê os bytes brutos do stdin e decodifica explicitamente em UTF-8
        if hasattr(sys.stdin, 'buffer'):
            try:
                payload_str = sys.stdin.buffer.read().decode('utf-8', errors='replace')
            except Exception:
                payload_str = sys.stdin.read()
        else:
            payload_str = sys.stdin.read()
        
    try:
        req = json.loads(payload_str)
        action = req.get("toolName")
        params = req.get("params", {})
        result = handle_tool(action, params)
        print(json.dumps(result, cls=CustomEncoder, ensure_ascii=False))
    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}, ensure_ascii=False))
