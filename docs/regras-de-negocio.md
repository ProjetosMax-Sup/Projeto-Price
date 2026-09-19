# Regras de negócio — Desempenho Comercial

## Qualidade de cadastro

Produtos com hierarquia mercadológica incompleta (ex: caem em "Verificar Dpto") que
tenham **movimentação** (venda > 0) **não deveriam aparecer** nos relatórios — é
rotina da equipe do usuário tratar/corrigir esses produtos regularmente.

Se algum produto nessa situação aparecer com movimentação:
- **avisar o usuário**
- exibir contagem num **badge discreto na interface** (não um banner chamativo);
  clicar no badge baixa um `.txt` com os códigos (SKU) desses produtos, pra
  facilitar levar a lista pra quem corrige o cadastro
- excluir esses produtos dos números consolidados até serem corrigidos

⚠️ A contagem é de **produtos (SKU) únicos**, não de linhas — o mesmo produto
tem uma linha por loja/dia em `bdDesempenhoComercialAtual.txt`, então contar
linhas infla o número (`lib/data-providers/normalizar-desempenho.ts`,
`normalizarPeriodo`, usa um `Set` de códigos).

## Compradores padronizados por Departamento

✅ Confirmado com o usuário: a coluna `Compr`/`Nome Comprador` de `bdCadastro`
não é confiável — o comprador exibido no app vem de uma tabela fixa por Dpto
(`lib/desempenho/compradores.ts`), não do arquivo. Dois departamentos (Açougue
e Hortifruti) têm comprador diferente por Formato de loja (Varejo × Atacado);
os demais têm um único comprador nos dois formatos.

```
001 - Acougue         - Johathan (Varejo) / Jairo (Atacado)
002 - Peixaria         - Johathan
003 - Hortifruti       - Marrone (Varejo) / Jairo (Atacado)
004 - Padaria Propria  - Nil
005 - Padaria Industria- Nil
006 - Pereciveis Frios e Congelados - Johathan
007 - Pereciveis Lacteos - Bruna
008 - Mercearia Basica - Divino
009 - Mercearia Leite  - Manoel
010 - Mercearia Doce   - Bruna
011 - Mercearia Salgada- Ricardo
012 - Mercearia Saudavel - Bruna
013 - Bebidas          - Sandro
014 - Limpeza          - Manoel
015 - Perfumaria       - Manoel
016 - Bazar            - Edvaldo
017 - Eletro           - Edvaldo
018 - Sazonais         - Bruna
099 - Apropriacoes     - S/ Comprador
```

## Códigos de Departamento (Dpto) confirmados

```
001 - Acougue
002 - Peixaria
003 - Hortifruti
004 - Padaria Propria
005 - Padaria Industria
006 - Pereciveis Frios e Congelados
007 - Pereciveis Lacteos
008 - Mercearia Basica
009 - Mercearia Leite
010 - Mercearia Doce
011 - Mercearia Salgada
012 - Mercearia Saudavel
013 - Bebidas
014 - Limpeza
015 - Perfumaria
016 - Bazar
017 - Eletro
018 - Sazonais
099 - Apropriacoes
```

## Em aberto / a validar com o usuário

- Metas/objetivos ficaram fora de escopo por enquanto (mencionado explicitamente
  pelo usuário ao revisar referências de outra rede)
