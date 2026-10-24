// Configuração de cada cadastro: colunas da lista, campos do formulário e
// conversão entre o formulário e o corpo que a API espera
import { clientesApi, produtosApi, vendedoresApi } from '../../api/recursos'
import { AtivoBadge } from '../../components/Badge'
import type { Cliente, ClienteDados, Produto, ProdutoDados, Vendedor, VendedorDados } from '../../types'
import { formatarCpf, formatarMoeda, formatarPercentual, somenteDigitos } from '../../utils/formato'
import type { ConfigCadastro } from './tipos'
import { decimalParaTexto, lerDecimal, textoOuNulo } from './validacao'

export const configClientes: ConfigCadastro<Cliente, ClienteDados> = {
  titulo: 'Clientes',
  singular: 'cliente',
  novo: 'Novo cliente',
  rota: '/clientes',
  api: clientesApi,
  id: (c) => c.cliente_id,
  descricao: (c) => c.nome,
  ativo: (c) => c.ativo,
  placeholderBusca: 'Buscar por nome ou CPF',
  colunas: [
    { titulo: 'Nome', celula: (c) => c.nome },
    { titulo: 'CPF', celula: (c) => <span className="mono">{formatarCpf(c.cpf)}</span> },
    { titulo: 'E-mail', celula: (c) => c.email ?? '—', secundaria: true },
    { titulo: 'Cidade/UF', celula: (c) => (c.cidade ? `${c.cidade}${c.uf ? `/${c.uf}` : ''}` : '—') },
    { titulo: 'Situação', celula: (c) => <AtivoBadge ativo={c.ativo} /> },
  ],
  campos: [
    { nome: 'nome', rotulo: 'Nome', tipo: 'texto', obrigatorio: true, maximo: 120, largura: 'cheia' },
    { nome: 'cpf', rotulo: 'CPF', tipo: 'cpf', obrigatorio: true, placeholder: '000.000.000-00' },
    { nome: 'email', rotulo: 'E-mail', tipo: 'email', maximo: 150 },
    { nome: 'telefone', rotulo: 'Telefone', tipo: 'texto', maximo: 20, placeholder: '(62) 99999-0000' },
    { nome: 'cidade', rotulo: 'Cidade', tipo: 'texto', maximo: 80 },
    { nome: 'uf', rotulo: 'UF', tipo: 'uf' },
  ],
  valoresIniciais: (c) => ({
    nome: c?.nome ?? '',
    cpf: c ? formatarCpf(c.cpf) : '',
    email: c?.email ?? '',
    telefone: c?.telefone ?? '',
    cidade: c?.cidade ?? '',
    uf: c?.uf ?? '',
    ativo: c?.ativo ?? true,
  }),
  paraApi: (v) => ({
    nome: String(v.nome).trim(),
    cpf: somenteDigitos(String(v.cpf)),
    email: textoOuNulo(v.email),
    telefone: textoOuNulo(v.telefone),
    cidade: textoOuNulo(v.cidade),
    uf: textoOuNulo(v.uf),
    ativo: Boolean(v.ativo),
  }),
  comSituacao: ({ nome, cpf, email, telefone, cidade, uf }, ativo) => ({ nome, cpf, email, telefone, cidade, uf, ativo }),
}

export const configVendedores: ConfigCadastro<Vendedor, VendedorDados> = {
  titulo: 'Vendedores',
  singular: 'vendedor',
  novo: 'Novo vendedor',
  rota: '/vendedores',
  api: vendedoresApi,
  id: (v) => v.vendedor_id,
  descricao: (v) => v.nome,
  ativo: (v) => v.ativo,
  placeholderBusca: 'Buscar por nome',
  colunas: [
    { titulo: 'Nome', celula: (v) => v.nome },
    { titulo: 'E-mail', celula: (v) => v.email, secundaria: true },
    { titulo: 'Comissão', celula: (v) => formatarPercentual(v.comissao_percentual), alinhamento: 'direita' },
    { titulo: 'Situação', celula: (v) => <AtivoBadge ativo={v.ativo} /> },
  ],
  campos: [
    { nome: 'nome', rotulo: 'Nome', tipo: 'texto', obrigatorio: true, maximo: 120, largura: 'cheia' },
    { nome: 'email', rotulo: 'E-mail', tipo: 'email', obrigatorio: true, maximo: 150 },
    {
      nome: 'comissao_percentual',
      rotulo: 'Comissão (%)',
      tipo: 'decimal',
      obrigatorio: true,
      placeholder: '5,00',
      validar: (valor) => {
        const n = lerDecimal(valor)
        if (n < 0) return 'Comissão mínima é 0'
        if (n > 100) return 'Comissão máxima é 100'
        return null
      },
    },
  ],
  valoresIniciais: (v) => ({
    nome: v?.nome ?? '',
    email: v?.email ?? '',
    comissao_percentual: v ? decimalParaTexto(v.comissao_percentual) : '',
    ativo: v?.ativo ?? true,
  }),
  paraApi: (v) => ({
    nome: String(v.nome).trim(),
    email: String(v.email).trim(),
    comissao_percentual: lerDecimal(String(v.comissao_percentual)),
    ativo: Boolean(v.ativo),
  }),
  comSituacao: ({ nome, email, comissao_percentual }, ativo) => ({ nome, email, comissao_percentual, ativo }),
}

export const configProdutos: ConfigCadastro<Produto, ProdutoDados> = {
  titulo: 'Produtos',
  singular: 'produto',
  novo: 'Novo produto',
  rota: '/produtos',
  api: produtosApi,
  id: (p) => p.produto_id,
  descricao: (p) => `${p.codigo_sku} – ${p.nome}`,
  ativo: (p) => p.ativo,
  placeholderBusca: 'Buscar por nome ou SKU',
  colunas: [
    { titulo: 'SKU', celula: (p) => <span className="mono">{p.codigo_sku}</span>, largura: '8rem' },
    { titulo: 'Nome', celula: (p) => p.nome },
    { titulo: 'Preço', celula: (p) => formatarMoeda(p.preco_unitario), alinhamento: 'direita' },
    { titulo: 'Situação', celula: (p) => <AtivoBadge ativo={p.ativo} /> },
  ],
  campos: [
    {
      nome: 'codigo_sku',
      rotulo: 'SKU',
      tipo: 'sku',
      obrigatorio: true,
      placeholder: 'PRD-0000',
      dica: 'Chave do produto no Sistema de Estoque (Grupo 4): não muda depois que o produto é vendido.',
    },
    {
      nome: 'preco_unitario',
      rotulo: 'Preço unitário (R$)',
      tipo: 'decimal',
      obrigatorio: true,
      placeholder: '0,00',
      validar: (valor) => {
        const n = lerDecimal(valor)
        if (n <= 0) return 'Preço deve ser maior que zero'
        if (n > 9_999_999_999.99) return 'Preço acima do máximo permitido'
        return null
      },
    },
    { nome: 'nome', rotulo: 'Nome', tipo: 'texto', obrigatorio: true, maximo: 120, largura: 'cheia' },
    { nome: 'descricao', rotulo: 'Descrição', tipo: 'textarea', largura: 'cheia' },
  ],
  valoresIniciais: (p) => ({
    codigo_sku: p?.codigo_sku ?? '',
    nome: p?.nome ?? '',
    descricao: p?.descricao ?? '',
    preco_unitario: p ? decimalParaTexto(p.preco_unitario) : '',
    ativo: p?.ativo ?? true,
  }),
  paraApi: (v) => ({
    codigo_sku: String(v.codigo_sku).trim().toUpperCase(),
    nome: String(v.nome).trim(),
    descricao: textoOuNulo(v.descricao),
    preco_unitario: lerDecimal(String(v.preco_unitario)),
    ativo: Boolean(v.ativo),
  }),
  comSituacao: ({ codigo_sku, nome, descricao, preco_unitario }, ativo) => ({ codigo_sku, nome, descricao, preco_unitario, ativo }),
}
