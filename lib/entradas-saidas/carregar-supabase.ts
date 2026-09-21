import { createClient } from "@supabase/supabase-js";
import { CABECALHO_REFERENCIA_MENSAL } from "@/config/data-sources";
import { parseTabela, validarCabecalhoOuFalhar } from "@/lib/data-providers/parse-tabela";
import { dataBrParaIso } from "@/lib/desempenho/datas";
import { CAMPOS_CHAVE, COLUNAS_ENTRADA_SAIDA } from "@/lib/entradas-saidas/colunas";

/**
 * Carrega um arquivo mensal (`bd<Mês>.txt`) na tabela `movimentos_entrada_saida`
 * do Supabase — pipeline separado do Desempenho Comercial (que continua no
 * Redis). Agrega por SKU × Loja × Dia (defensivo, caso haja mais de uma linha
 * pro mesmo dia) e faz upsert em lotes, idempotente (`sku, loja, data`).
 */

const TAMANHO_LOTE = 2000;

function parseNumeroBr(valor: string | undefined): number {
  if (!valor) return 0;
  const normalizado = valor.replace(/\./g, "").replace(",", ".");
  const numero = Number(normalizado);
  return Number.isFinite(numero) ? numero : 0;
}

function clienteSupabase() {
  const url = process.env.SUPABASE_URL;
  const chave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !chave) throw new Error("Supabase não configurado (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).");
  return createClient(url, chave);
}

const TODOS_CAMPOS = [...CAMPOS_CHAVE, ...COLUNAS_ENTRADA_SAIDA.map((c) => c.nomeArquivo)];

interface LinhaAgregada {
  sku: string;
  loja: string;
  data: string;
  dpto: string | null;
  valores: Record<string, number>;
}

export async function carregarArquivoMensal(
  conteudo: string,
  nomeArquivo: string,
): Promise<{ linhasLidas: number; linhasAgregadas: number; lotesEnviados: number }> {
  validarCabecalhoOuFalhar(conteudo, CABECALHO_REFERENCIA_MENSAL, nomeArquivo);
  const linhas = parseTabela(conteudo, TODOS_CAMPOS, true);

  const porChave = new Map<string, LinhaAgregada>();
  for (const l of linhas) {
    const sku = l["Código"];
    const loja = l["Unidade Código"];
    const dataIso = dataBrParaIso(l["Data"]);
    if (!sku || !loja || !dataIso) continue;

    const chave = `${sku}|${loja}|${dataIso}`;
    const existente = porChave.get(chave);
    const acumulador: LinhaAgregada = existente ?? { sku, loja, data: dataIso, dpto: l["Dpto"] || null, valores: {} };

    for (const { nomeArquivo: nome, coluna } of COLUNAS_ENTRADA_SAIDA) {
      const valor = parseNumeroBr(l[nome]);
      if (valor === 0 && acumulador.valores[coluna] === undefined) continue; // fica ausente -> NULL
      acumulador.valores[coluna] = (acumulador.valores[coluna] ?? 0) + valor;
    }
    porChave.set(chave, acumulador);
  }

  const registros = Array.from(porChave.values()).map((r) => ({
    sku: r.sku,
    loja: r.loja,
    data: r.data,
    dpto: r.dpto,
    ...r.valores,
  }));

  const cliente = clienteSupabase();
  let lotesEnviados = 0;
  for (let i = 0; i < registros.length; i += TAMANHO_LOTE) {
    const lote = registros.slice(i, i + TAMANHO_LOTE);
    const { error } = await cliente.from("movimentos_entrada_saida").upsert(lote, { onConflict: "sku,loja,data" });
    if (error) throw new Error(`Falha no upsert (lote ${lotesEnviados}): ${error.message}`);
    lotesEnviados++;
  }

  return { linhasLidas: linhas.length, linhasAgregadas: registros.length, lotesEnviados };
}
