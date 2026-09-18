import type { Loja, MovimentoVendas, Produto } from "@/lib/types";

/**
 * Dataset de exemplo para desenvolver e demonstrar o módulo Desempenho
 * Comercial antes de termos acesso aos arquivos reais (DESEMPENHO_COMERCIAL_DATA_DIR).
 * Estrutura segue exatamente o schema descrito no CLAUDE.md; nomes de
 * departamento/hierarquia são placeholders plausíveis, não os reais da MAX.
 */

// PRNG determinístico (mulberry32) — mesma massa de dados a cada build.
function criarRng(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rng = criarRng(20260917);
const rand = (min: number, max: number) => min + rng() * (max - min);
const randInt = (min: number, max: number) => Math.floor(rand(min, max + 1));
const escolher = <T,>(itens: readonly T[]): T => itens[randInt(0, itens.length - 1)];

export const LOJAS_MOCK: Loja[] = [
  { codUnid: "01", codUnidReduzido: "1", nomeSistema: "LJ01", nomeLoja: "MAX Centro", formato: "Varejo" },
  { codUnid: "02", codUnidReduzido: "2", nomeSistema: "LJ02", nomeLoja: "MAX Vila Mutirão", formato: "Varejo" },
  { codUnid: "03", codUnidReduzido: "3", nomeSistema: "LJ03", nomeLoja: "MAX Bairro Novo", formato: "Varejo" },
  { codUnid: "04", codUnidReduzido: "4", nomeSistema: "LJ04", nomeLoja: "MAX Jardim das Flores", formato: "Varejo" },
  { codUnid: "05", codUnidReduzido: "5", nomeSistema: "LJ05", nomeLoja: "MAX Atacado Industrial", formato: "Atacado" },
  { codUnid: "06", codUnidReduzido: "6", nomeSistema: "LJ06", nomeLoja: "MAX Atacado Rodovia", formato: "Atacado" },
  { codUnid: "07", codUnidReduzido: "7", nomeSistema: "LJ07", nomeLoja: "MAX Atacado Sul", formato: "Atacado" },
  { codUnid: "08", codUnidReduzido: "8", nomeSistema: "LJ08", nomeLoja: "MAX Atacado Norte", formato: "Atacado" },
  { codUnid: "09", codUnidReduzido: "9", nomeSistema: "LJ09", nomeLoja: "MAX Atacado Leste", formato: "Atacado" },
  { codUnid: "10", codUnidReduzido: "10", nomeSistema: "LJ10", nomeLoja: "MAX Atacado Oeste", formato: "Atacado" },
];

interface NoGrupo {
  nome: string;
  subGrupos: string[];
}
interface NoCategoria {
  nome: string;
  grupos: NoGrupo[];
}
interface NoSecao {
  nome: string;
  categorias: NoCategoria[];
}
interface NoDepartamento {
  codigo: string;
  nome: string;
  comprador: { codigo: string; nome: string };
  secoes: NoSecao[];
}

const COMPRADORES = {
  acougueria: { codigo: "COMP01", nome: "Carla Nunes" },
  hortifruti: { codigo: "COMP02", nome: "Bruno Alves" },
  padaria: { codigo: "COMP03", nome: "Fernanda Reis" },
  perecíveis: { codigo: "COMP04", nome: "Diego Souza" },
  mercearia: { codigo: "COMP05", nome: "Ana Ferreira" },
  bebidas: { codigo: "COMP06", nome: "Elaine Costa" },
  limpeza: { codigo: "COMP07", nome: "Fábio Lima" },
  perfumaria: { codigo: "COMP08", nome: "Juliana Prado" },
  naoAlimentos: { codigo: "COMP09", nome: "Marcos Teixeira" },
  sazonais: { codigo: "COMP10", nome: "Patrícia Gomes" },
  controladoria: { codigo: "COMP11", nome: "Ricardo Matos" },
} as const;

// Códigos e nomes de departamento confirmados pelo usuário (ver CLAUDE.md).
const HIERARQUIA: NoDepartamento[] = [
  {
    codigo: "001",
    nome: "Acougue",
    comprador: COMPRADORES.acougueria,
    secoes: [
      {
        nome: "Carnes Bovinas e Suínas",
        categorias: [
          {
            nome: "Cortes Nobres",
            grupos: [
              { nome: "Bovinos", subGrupos: ["Picanha e Alcatra", "Acém e Músculo"] },
              { nome: "Suínos e Aves", subGrupos: ["Frango", "Suíno"] },
            ],
          },
        ],
      },
    ],
  },
  {
    codigo: "002",
    nome: "Peixaria",
    comprador: COMPRADORES.acougueria,
    secoes: [
      {
        nome: "Pescados",
        categorias: [
          {
            nome: "Peixes e Frutos do Mar",
            grupos: [
              { nome: "Peixes", subGrupos: ["Peixe Fresco", "Peixe Congelado"] },
              { nome: "Frutos do Mar", subGrupos: ["Camarão", "Lula e Polvo"] },
            ],
          },
        ],
      },
    ],
  },
  {
    codigo: "003",
    nome: "Hortifruti",
    comprador: COMPRADORES.hortifruti,
    secoes: [
      {
        nome: "Frutas e Verduras",
        categorias: [
          {
            nome: "Frescos",
            grupos: [
              { nome: "Frutas", subGrupos: ["Banana e Maçã", "Laranja e Mamão"] },
              { nome: "Legumes e Verduras", subGrupos: ["Tomate e Cebola", "Alface e Couve"] },
            ],
          },
        ],
      },
    ],
  },
  {
    codigo: "004",
    nome: "Padaria Propria",
    comprador: COMPRADORES.padaria,
    secoes: [
      {
        nome: "Panificação",
        categorias: [
          {
            nome: "Pães e Bolos",
            grupos: [
              { nome: "Pães", subGrupos: ["Pão Francês", "Pão de Forma Artesanal"] },
              { nome: "Confeitaria", subGrupos: ["Bolos", "Doces e Salgados"] },
            ],
          },
        ],
      },
    ],
  },
  {
    codigo: "005",
    nome: "Padaria Industria",
    comprador: COMPRADORES.padaria,
    secoes: [
      {
        nome: "Panificação Industrializada",
        categorias: [
          {
            nome: "Pães e Bolos Industrializados",
            grupos: [
              { nome: "Pães Industrializados", subGrupos: ["Pão de Forma", "Pão de Hambúrguer e Hot Dog"] },
              { nome: "Bolos e Biscoitos", subGrupos: ["Bolos Industrializados", "Biscoitos e Bolachas"] },
            ],
          },
        ],
      },
    ],
  },
  {
    codigo: "006",
    nome: "Pereciveis Frios e Congelados",
    comprador: COMPRADORES.perecíveis,
    secoes: [
      {
        nome: "Frios e Congelados",
        categorias: [
          {
            nome: "Embutidos e Congelados",
            grupos: [
              { nome: "Embutidos", subGrupos: ["Presunto e Mortadela", "Salsicha e Linguiça"] },
              { nome: "Congelados", subGrupos: ["Pratos Prontos Congelados", "Legumes Congelados"] },
            ],
          },
        ],
      },
    ],
  },
  {
    codigo: "007",
    nome: "Pereciveis Lacteos",
    comprador: COMPRADORES.perecíveis,
    secoes: [
      {
        nome: "Laticínios",
        categorias: [
          {
            nome: "Leites e Derivados",
            grupos: [
              { nome: "Queijos e Iogurtes", subGrupos: ["Queijos", "Iogurtes"] },
              { nome: "Manteiga e Requeijão", subGrupos: ["Manteiga e Margarina", "Requeijão e Cream Cheese"] },
            ],
          },
        ],
      },
    ],
  },
  {
    codigo: "008",
    nome: "Mercearia Basica",
    comprador: COMPRADORES.mercearia,
    secoes: [
      {
        nome: "Mercearia Básica",
        categorias: [
          {
            nome: "Grãos e Massas",
            grupos: [
              { nome: "Grãos", subGrupos: ["Arroz", "Feijão"] },
              { nome: "Massas e Farináceos", subGrupos: ["Massas", "Farinhas"] },
            ],
          },
        ],
      },
    ],
  },
  {
    codigo: "009",
    nome: "Mercearia Leite",
    comprador: COMPRADORES.mercearia,
    secoes: [
      {
        nome: "Leites e Achocolatados",
        categorias: [
          {
            nome: "Leites",
            grupos: [
              { nome: "Leite Líquido", subGrupos: ["Leite Integral", "Leite Desnatado"] },
              { nome: "Leite em Pó e Achocolatados", subGrupos: ["Leite em Pó", "Achocolatado em Pó"] },
            ],
          },
        ],
      },
    ],
  },
  {
    codigo: "010",
    nome: "Mercearia Doce",
    comprador: COMPRADORES.mercearia,
    secoes: [
      {
        nome: "Mercearia Doce",
        categorias: [
          {
            nome: "Doces e Sobremesas",
            grupos: [
              { nome: "Achocolatados e Sobremesas", subGrupos: ["Gelatina", "Pudim"] },
              { nome: "Doces", subGrupos: ["Chocolates", "Balas e Biscoitos Doces"] },
            ],
          },
        ],
      },
    ],
  },
  {
    codigo: "011",
    nome: "Mercearia Salgada",
    comprador: COMPRADORES.mercearia,
    secoes: [
      {
        nome: "Mercearia Salgada",
        categorias: [
          {
            nome: "Enlatados e Temperos",
            grupos: [
              { nome: "Enlatados", subGrupos: ["Milho e Ervilha", "Atum e Sardinha"] },
              { nome: "Molhos e Temperos", subGrupos: ["Molhos Prontos", "Temperos e Condimentos"] },
            ],
          },
        ],
      },
    ],
  },
  {
    codigo: "012",
    nome: "Mercearia Saudavel",
    comprador: COMPRADORES.mercearia,
    secoes: [
      {
        nome: "Mercearia Saudável",
        categorias: [
          {
            nome: "Naturais e Dietéticos",
            grupos: [
              { nome: "Integrais e Naturais", subGrupos: ["Cereais Integrais", "Barras de Cereal"] },
              { nome: "Dietéticos e Light", subGrupos: ["Adoçantes", "Produtos Diet e Light"] },
            ],
          },
        ],
      },
    ],
  },
  {
    codigo: "013",
    nome: "Bebidas",
    comprador: COMPRADORES.bebidas,
    secoes: [
      {
        nome: "Bebidas Não Alcoólicas",
        categorias: [
          {
            nome: "Refrigerantes e Sucos",
            grupos: [
              { nome: "Refrigerantes", subGrupos: ["Cola", "Guaraná"] },
              { nome: "Sucos e Águas", subGrupos: ["Sucos Prontos", "Águas"] },
            ],
          },
        ],
      },
      {
        nome: "Bebidas Alcoólicas",
        categorias: [
          {
            nome: "Cervejas e Destilados",
            grupos: [
              { nome: "Cervejas", subGrupos: ["Cerveja Lata", "Cerveja Garrafa"] },
              { nome: "Destilados", subGrupos: ["Vodka e Gin", "Whisky"] },
            ],
          },
        ],
      },
    ],
  },
  {
    codigo: "014",
    nome: "Limpeza",
    comprador: COMPRADORES.limpeza,
    secoes: [
      {
        nome: "Limpeza Roupas",
        categorias: [
          {
            nome: "Lavanderia",
            grupos: [
              { nome: "Sabões e Detergentes", subGrupos: ["Sabão em Pó", "Sabão Líquido"] },
              { nome: "Amaciantes", subGrupos: ["Amaciante Concentrado", "Amaciante Tradicional"] },
            ],
          },
        ],
      },
      {
        nome: "Limpeza Geral",
        categorias: [
          {
            nome: "Multiuso",
            grupos: [
              { nome: "Desinfetantes", subGrupos: ["Desinfetante", "Água Sanitária"] },
              { nome: "Descartáveis", subGrupos: ["Papel Higiênico", "Papel Toalha"] },
            ],
          },
        ],
      },
    ],
  },
  {
    codigo: "015",
    nome: "Perfumaria",
    comprador: COMPRADORES.perfumaria,
    secoes: [
      {
        nome: "Higiene e Beleza",
        categorias: [
          {
            nome: "Cuidados Pessoais",
            grupos: [
              { nome: "Higiene Bucal e Corporal", subGrupos: ["Sabonetes", "Escovas e Cremes Dentais"] },
              { nome: "Cabelos", subGrupos: ["Shampoos e Condicionadores", "Cremes de Pentear"] },
            ],
          },
        ],
      },
    ],
  },
  {
    codigo: "016",
    nome: "Bazar",
    comprador: COMPRADORES.naoAlimentos,
    secoes: [
      {
        nome: "Utilidades Domésticas",
        categorias: [
          {
            nome: "Cozinha e Casa",
            grupos: [
              { nome: "Utensílios de Cozinha", subGrupos: ["Panelas", "Talheres"] },
              { nome: "Organização", subGrupos: ["Plásticos e Potes", "Caixas Organizadoras"] },
            ],
          },
        ],
      },
    ],
  },
  {
    codigo: "017",
    nome: "Eletro",
    comprador: COMPRADORES.naoAlimentos,
    secoes: [
      {
        nome: "Eletroportáteis",
        categorias: [
          {
            nome: "Pequenos Eletros",
            grupos: [
              { nome: "Linha Cozinha", subGrupos: ["Liquidificadores", "Air Fryers"] },
              { nome: "Linha Conforto", subGrupos: ["Ventiladores", "Aquecedores"] },
            ],
          },
        ],
      },
    ],
  },
  {
    codigo: "018",
    nome: "Sazonais",
    comprador: COMPRADORES.sazonais,
    secoes: [
      {
        nome: "Datas Comemorativas",
        categorias: [
          {
            nome: "Sazonais",
            grupos: [
              { nome: "Natal e Ano Novo", subGrupos: ["Panetones", "Enfeites Natalinos"] },
              { nome: "Páscoa e Festas Juninas", subGrupos: ["Ovos de Páscoa", "Produtos Juninos"] },
            ],
          },
        ],
      },
    ],
  },
  {
    codigo: "099",
    nome: "Apropriacoes",
    comprador: COMPRADORES.controladoria,
    secoes: [
      {
        nome: "Apropriações Diversas",
        categorias: [
          {
            nome: "Apropriações",
            grupos: [
              { nome: "Apropriações Internas", subGrupos: ["Apropriação de Perdas", "Apropriação de Consumo Interno"] },
              { nome: "Ajustes", subGrupos: ["Ajuste de Estoque", "Outras Apropriações"] },
            ],
          },
        ],
      },
    ],
  },
];

const MARCAS = ["Predileta", "Bom Sabor", "Casa Nova", "Vale Verde", "Point", "Sabor Real", "TopLar", "Divina"];

function gerarCodigoBarras(seq: number): string {
  return `789${String(seq).padStart(10, "0")}`;
}

interface ProdutoGerado {
  produto: Produto;
  descricaoBase: string;
}

function gerarProdutos(): ProdutoGerado[] {
  const produtos: ProdutoGerado[] = [];
  let seq = 1;
  let grupoSeq = 1;

  for (const dpto of HIERARQUIA) {
    for (const secao of dpto.secoes) {
      for (const categoria of secao.categorias) {
        for (const grupo of categoria.grupos) {
          const codigoGrupo = String(grupoSeq++).padStart(4, "0");
          for (const subGrupo of grupo.subGrupos) {
            const hierarquiaGrupos = [dpto.nome, secao.nome, categoria.nome, grupo.nome, subGrupo].join(", ");
            const qtdVariações = randInt(2, 4);
            for (let i = 0; i < qtdVariações; i++) {
              const codigo = String(100000 + seq).padStart(6, "0");
              produtos.push({
                produto: {
                  codigo,
                  dpto: dpto.codigo,
                  grupo: codigoGrupo,
                  nomeGrupo: grupo.nome,
                  hierarquiaGrupos,
                  comprador: dpto.comprador.codigo,
                  nomeComprador: dpto.comprador.nome,
                  cadastroIncompleto: false,
                },
                descricaoBase: subGrupo,
              });
              seq++;
            }
          }
        }
      }
    }
  }

  // Casos de cadastro incompleto — devem ser excluídos dos números quando têm movimentação.
  for (let i = 0; i < 4; i++) {
    const codigo = String(900000 + i).padStart(6, "0");
    produtos.push({
      produto: {
        codigo,
        dpto: "999",
        grupo: "9999",
        nomeGrupo: "Verificar Dpto",
        hierarquiaGrupos: "Verificar Dpto",
        comprador: "COMP00",
        nomeComprador: "Não atribuído",
        cadastroIncompleto: true,
      },
      descricaoBase: "Produto sem hierarquia definida",
    });
  }

  return produtos;
}

const PRODUTOS_GERADOS = gerarProdutos();
export const PRODUTOS_MOCK: Produto[] = PRODUTOS_GERADOS.map((p) => p.produto);

function gerarMovimentosPeriodo(fatorTendencia: (seedProduto: number) => number): MovimentoVendas[] {
  const movimentos: MovimentoVendas[] = [];

  PRODUTOS_GERADOS.forEach((pg, produtoIdx) => {
    const marca = escolher(MARCAS);
    const precoBase = rand(4, 90);
    const tendencia = fatorTendencia(produtoIdx);

    // Nem todo produto vende em todas as lojas — sorteia um subconjunto.
    const qtdLojas = pg.produto.cadastroIncompleto ? randInt(1, 2) : randInt(5, 10);
    const lojasEscolhidas = [...LOJAS_MOCK].sort(() => rng() - 0.5).slice(0, qtdLojas);

    for (const loja of lojasEscolhidas) {
      const fatorFormato = loja.formato === "Atacado" ? rand(2, 5) : rand(0.6, 1.6);
      const qtdeVendasTotal = Math.round(rand(5, 60) * fatorFormato * tendencia);
      if (qtdeVendasTotal <= 0) continue;

      const valorTotal = Math.round(qtdeVendasTotal * precoBase * 100) / 100;
      const margem = rand(0.14, 0.32);
      const lucrosTotal = Math.round(valorTotal * margem * 100) / 100;

      const percOferta = rand(0, 0.3);
      const qtdeVendasOferta = Math.round(qtdeVendasTotal * percOferta);
      const vendasOferta = Math.round(valorTotal * percOferta * 100) / 100;
      const lucrosOferta = Math.round(lucrosTotal * percOferta * 0.6 * 100) / 100; // oferta reduz margem

      movimentos.push({
        codigo: pg.produto.codigo,
        descricao: pg.descricaoBase,
        complemento: marca,
        marca,
        codigoBarras: gerarCodigoBarras(produtoIdx),
        unidadeCodigo: loja.codUnid,
        unidadeNome: loja.nomeLoja,
        qtdeVendasTotal,
        valorTotal,
        lucrosTotal,
        qtdeVendasOferta,
        vendasOferta,
        lucrosOferta,
        qtdeVendasRegular: qtdeVendasTotal - qtdeVendasOferta,
        vendasRegular: valorTotal - vendasOferta,
        lucrosRegular: lucrosTotal - lucrosOferta,
      });
    }
  });

  return movimentos;
}

// Cada produto tem uma tendência própria (queda, estável ou alta) entre os períodos.
function tendenciaPorProduto(seedProduto: number): number {
  const r = criarRng(seedProduto * 7919 + 20260917)();
  if (r < 0.25) return rand(0.55, 0.85); // queda
  if (r < 0.75) return rand(0.9, 1.1); // estável
  return rand(1.15, 1.6); // alta
}

export const MOVIMENTOS_ATUAL_MOCK: MovimentoVendas[] = gerarMovimentosPeriodo(() => 1);
export const MOVIMENTOS_COMPARACAO_MOCK: MovimentoVendas[] = gerarMovimentosPeriodo(
  (idx) => 1 / tendenciaPorProduto(idx),
);
