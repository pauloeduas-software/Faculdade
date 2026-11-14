import { useState } from 'react'
import { chamar, moeda, type Resultado, type Venda } from '../api'
import { Aviso } from './Aviso'

const vazio = { nome: '', documento: '', endereco: '', cidade: '', uf: '', cep: '' }
const itemVazio = { produto_id: '', nome_produto: '', quantidade: '1', preco_unitario: '' }
type ItemForm = typeof itemVazio

// Produtos dos exemplos. Na integracao real, os codigos sao os do cadastro do G4.
const PRODUTOS: Record<string, [string, string]> = {
  101: ['Teclado Mecanico', '250.90'],
  102: ['Monitor 24', '899.00'],
  103: ['Mouse Optico', '89.90'],
}

// Vendas de exemplo para não precisar digitar tudo a cada teste
const EXEMPLOS = [
  { nome: 'Ana Clara Ribeiro', documento: '52998224725', endereco: 'Rua Augusta, 1520, ap. 34', cidade: 'São Paulo', uf: 'SP', cep: '01304001', itens: [['101', '1'], ['103', '2']] },
  { nome: 'Carlos Eduardo Lima', documento: '11144477735', endereco: 'Av. Afonso Pena, 3200', cidade: 'Belo Horizonte', uf: 'MG', cep: '30130008', itens: [['102', '1']] },
  { nome: 'Fernanda Alves', documento: '39053344705', endereco: 'Rua XV de Novembro, 870', cidade: 'Curitiba', uf: 'PR', cep: '80020310', itens: [['103', '3']] },
  { nome: 'Mercado Bom Preço Ltda', documento: '11222333000181', endereco: 'Av. Boa Viagem, 4100', cidade: 'Recife', uf: 'PE', cep: '51021000', itens: [['101', '4'], ['103', '4']] },
  { nome: 'Rafael Costa Martins', documento: '15350946056', endereco: 'Rua dos Andradas, 1001', cidade: 'Porto Alegre', uf: 'RS', cep: '90020007', itens: [['102', '2'], ['101', '1']] },
  { nome: 'Juliana Nascimento', documento: '86288366757', endereco: 'Av. Beira Mar, 2500', cidade: 'Fortaleza', uf: 'CE', cep: '60165121', itens: [['103', '1']] },
]

// Aceita "89,90" e "89.90"; o resto a API valida.
const numero = (v: string) => Number(v.replace(',', '.'))

export function NovaVenda({ aoCriar }: { aoCriar: () => void }) {
  const [f, setF] = useState(vazio)
  const [itens, setItens] = useState<ItemForm[]>([itemVazio])
  const [chave, setChave] = useState(() => crypto.randomUUID())
  const [resp, setResp] = useState<Resultado<Venda> | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [proximo, setProximo] = useState(0)

  function preencherExemplo() {
    const { itens: its, ...dados } = EXEMPLOS[proximo]
    setF(dados)
    setItens(its.map(([produto_id, quantidade]) => {
      const [nome_produto, preco_unitario] = PRODUTOS[produto_id]
      return { produto_id, nome_produto, quantidade, preco_unitario }
    }))
    setProximo((proximo + 1) % EXEMPLOS.length)
  }

  const campo = (k: keyof typeof vazio, rotulo: string, extra = '') => (
    <label className={extra}>{rotulo}
      <input value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} required />
    </label>
  )

  const campoItem = (i: number, k: keyof ItemForm, rotulo: string, extra: { type?: string; className?: string } = {}) => (
    <label className={extra.className}>{rotulo}
      <input type={extra.type} inputMode={k === 'preco_unitario' ? 'decimal' : undefined} value={itens[i][k]}
        onChange={(e) => setItens(itens.map((x, j) => j === i ? { ...x, [k]: e.target.value } : x))} required />
    </label>
  )

  async function enviar(e: React.FormEvent) {
    e.preventDefault()
    setEnviando(true)
    const r = await chamar<Venda>('POST', '/vendas', {
      cliente: { nome: f.nome, documento: f.documento },
      entrega: { endereco: f.endereco, cidade: f.cidade, uf: f.uf, cep: f.cep },
      itens: itens.map((i) => ({
        produto_id: Number(i.produto_id), nome_produto: i.nome_produto, quantidade: Number(i.quantidade), preco_unitario: numero(i.preco_unitario),
      })),
    }, { 'Idempotency-Key': chave })
    setResp(r)
    setEnviando(false)
    if (r.ok) { setF(vazio); setItens([itemVazio]); setChave(crypto.randomUUID()); aoCriar() }
  }

  return (
    <section>
      <form onSubmit={(e) => void enviar(e)}>
        <fieldset><legend>Cliente</legend>
          {campo('nome', 'Nome')}{campo('documento', 'CPF/CNPJ')}
        </fieldset>
        <fieldset><legend>Entrega</legend>
          {campo('endereco', 'Endereço', 'larga')}{campo('cidade', 'Cidade')}{campo('uf', 'UF')}{campo('cep', 'CEP')}
        </fieldset>
        <fieldset><legend>Itens</legend>
          {itens.map((_, i) => (
            <div className="item" key={i}>
              {campoItem(i, 'produto_id', 'Produto (código no G4)', { type: 'number' })}
              {campoItem(i, 'nome_produto', 'Nome', { className: 'larga' })}
              {campoItem(i, 'quantidade', 'Quantidade', { type: 'number' })}
              {campoItem(i, 'preco_unitario', 'Preço unitário (R$)')}
              {itens.length > 1 && <button type="button" onClick={() => setItens(itens.filter((_, j) => j !== i))}>Remover</button>}
            </div>
          ))}
          <button type="button" onClick={() => setItens([...itens, itemVazio])}>+ Item</button>
        </fieldset>
        <p className="dica">O código do produto é o do cadastro do Estoque (G4), que consulta as vendas para dar baixa. Idempotency-Key desta venda: <code>{chave.slice(0, 8)}…</code></p>
        <div className="botoes">
          <button className="primario" disabled={enviando}>{enviando ? 'Registrando…' : 'Registrar venda'}</button>
          <button type="button" onClick={preencherExemplo}>Preencher com exemplo</button>
        </div>
      </form>
      <Aviso r={resp} />
      {resp?.ok && resp.dados && <div className="ok">Venda #{resp.dados.id} {resp.dados.status} — total {moeda(resp.dados.valor_total)}</div>}
    </section>
  )
}
