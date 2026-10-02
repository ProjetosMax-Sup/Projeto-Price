# Exemplos do PDF por Comprador

Fotografia dos 18 arquivos gerados em **02/10/2026**, sobre o período
**01-Set à 30-Set de 2026**, com as metas e o cadastro de Departamentos que
estavam valendo naquele dia. Regerados no mesmo dia depois que Exposição e
Histórico saíram do relatório (ver CLAUDE.md > "PDF por Comprador") — os
números de GAP/Venda/Compra abaixo não mudaram, só o layout ficou mais enxuto.

São um arquivo por **Comprador × Formato** — quem não atua num formato não tem
arquivo dele (Jairo só Atacado, Marrone só Varejo), por isso 18 e não 20.

## Para que servem aqui

Não é saída de produção: o relatório sai pelo botão "PDF por Comprador" na tela
do Compra e Venda, sempre com dado fresco. Estes ficam versionados por dois
motivos:

1. **Referência visual** do que foi validado — moldura, cores por seção,
   subtotal na primeira linha, ordem das seções. Quem mexer em
   `lib/compra-venda/pdf-comprador.ts` consegue comparar antes e depois.
2. **Oráculo de números.** Os valores daqui foram conferidos contra os arquivos
   do ERP durante a construção (ver CLAUDE.md > "PDF por Comprador" e "Venda
   Média Diária, Estoque e DDE"). Se uma mudança no motor alterar um número
   destes, é sinal de regressão — ou de uma correção que precisa ser explicada.

⚠️ **Eles envelhecem.** Qualquer mudança de meta em `/parametros`, de cadastro
de Comprador, ou nos próprios arquivos do ERP faz a geração nova divergir destes
— e isso não é defeito. Antes de tratar uma diferença como regressão, confira se
não foi um desses três que mudou.

## Alguns números deste recorte, para conferência rápida

| | Varejo | Atacado |
|---|---|---|
| Venda | R$ 12,30 M | R$ 22,90 M |
| GAP total (departamentos acima da meta) | R$ 614 mil | R$ 707 mil |

Casos que valem reabrir quando o motor mudar, porque cada um existe por causa de
uma trava específica:

- **Café Moinho Fino 500g (206331), Varejo** — comprou 172 unidades a MENOS do
  que vendeu e mesmo assim estourou R$ 63 mil. É o caso de "não é pedido, é
  preço", e tem transferência sugerida de Vila Mutirão (42d) para Rio Verde e
  Independência (10d).
- **Osso Kg (259064) e Muchiba Kg (500577), Açougue** — R$ 340 mil de GAP
  fantasma, barrados pela trava de preço incoerente. Têm que continuar no anexo
  "Revisar cadastro ou rateio", nunca na lista de ação.
- **Óleo Soja Vila Velha 900ml (343684), Varejo/Divino** — DDE 44 com asterisco:
  o ERP não tem VMD pro item e a cobertura saiu da venda do próprio período.
- **TV Samsung 43" (666670), Varejo/Edvaldo** — cadastrada em 16/02/26, comprou
  R$ 3.060 e não vendeu nada. É o contraexemplo dos pneus cadastrados em
  10/09/26: mesma linha, histórias opostas.
