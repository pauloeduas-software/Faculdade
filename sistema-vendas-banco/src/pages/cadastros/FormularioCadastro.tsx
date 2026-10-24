import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ErroApi, mensagemDeErro } from '../../api/cliente'
import { Campo } from '../../components/Campo'
import { Alerta, Carregando, ErroCarregamento } from '../../components/Estados'
import { useCarregar } from '../../hooks/useCarregar'
import { useToast } from '../../hooks/useToast'
import { formatarCpf, formatarDataHora } from '../../utils/formato'
import type { ConfigCadastro, DefinicaoCampo, Valores } from './tipos'
import { UFS, validarFormulario } from './validacao'

// Carrega o registro (na edição) e só então monta o formulário com os valores dele
export function FormularioCadastro<T, D>({ config }: { config: ConfigCadastro<T, D> }) {
  const { id } = useParams()
  const registro = useCarregar(() => (id !== undefined ? config.api.buscar(Number(id)) : Promise.resolve(null)), [id])

  if (id === undefined) return <Formulario config={config} />
  if (registro.erro) return <ErroCarregamento erro={registro.erro} aoTentarDeNovo={registro.recarregar} />
  if (!registro.dados || registro.carregando) return <Carregando />
  return <Formulario key={id} config={config} id={Number(id)} registro={registro.dados} />
}

function Formulario<T, D>({ config, id, registro }: { config: ConfigCadastro<T, D>; id?: number; registro?: T }) {
  const editando = id !== undefined
  const navegar = useNavigate()
  const toast = useToast()
  const [valores, setValores] = useState<Valores>(() => config.valoresIniciais(registro))
  const [erros, setErros] = useState<Record<string, string>>({})
  const [erroGeral, setErroGeral] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)

  function alterar(nome: string, valor: string | boolean) {
    setValores((atuais) => ({ ...atuais, [nome]: valor }))
    setErros((atuais) => {
      const resto = { ...atuais }
      delete resto[nome]
      return resto
    })
  }

  async function salvar(evento: FormEvent) {
    evento.preventDefault()
    setErroGeral(null)

    const errosLocais = validarFormulario(config.campos, valores)
    setErros(errosLocais)
    if (Object.keys(errosLocais).length > 0) return

    setSalvando(true)
    try {
      const dados = config.paraApi(valores)
      const salvo = id !== undefined ? await config.api.atualizar(id, dados) : await config.api.criar(dados)
      toast.sucesso(`${config.descricao(salvo)} ${editando ? 'atualizado' : 'cadastrado'}.`)
      navegar(config.rota)
    } catch (erro) {
      // Erros de campo da API (DADOS_INVALIDOS, REGISTRO_DUPLICADO, regra do SKU...)
      // vão para baixo do campo certo; o resto aparece no topo do formulário
      if (erro instanceof ErroApi && Object.keys(erro.errosDeCampo).length > 0) {
        const porCampo = { ...erro.errosDeCampo }
        if (erro.dica) for (const campo of Object.keys(porCampo)) porCampo[campo] += ` ${erro.dica}`
        setErros(porCampo)
        setErroGeral(erro.codigo === 'DADOS_INVALIDOS' ? 'Corrija os campos destacados.' : erro.message)
      } else {
        setErroGeral(mensagemDeErro(erro))
      }
    } finally {
      setSalvando(false)
    }
  }

  return (
    <section>
      <header className="cabecalho-pagina">
        <h1>{editando ? `Editar ${config.singular}` : config.novo}</h1>
        <Link className="botao" to={config.rota}>
          Voltar
        </Link>
      </header>

      <form className="cartao formulario" onSubmit={salvar} noValidate>
        {erroGeral && <Alerta tipo="erro">{erroGeral}</Alerta>}

        <div className="grade-campos">
          {config.campos.map((campo) => (
            <div key={campo.nome} className={campo.largura === 'cheia' ? 'largura-cheia' : undefined}>
              <Campo rotulo={campo.rotulo} nome={campo.nome} erro={erros[campo.nome]} dica={campo.dica} obrigatorio={campo.obrigatorio}>
                <Controle campo={campo} valor={String(valores[campo.nome] ?? '')} erro={erros[campo.nome]} aoMudar={(v) => alterar(campo.nome, v)} />
              </Campo>
            </div>
          ))}
        </div>

        {/* Sem caixa "Ativo": cadastro novo nasce ativo e Desativar/Ativar fica na lista.
            Na edição, valores.ativo vem do registro e é reenviado como está */}
        {registro && (
          <p className="texto-fraco">
            Cadastrado em {formatarDataHora((registro as { criado_em?: string }).criado_em)} · atualizado em{' '}
            {formatarDataHora((registro as { atualizado_em?: string }).atualizado_em)}
          </p>
        )}

        <div className="acoes-formulario">
          <Link className="botao" to={config.rota}>
            Cancelar
          </Link>
          <button type="submit" className="botao botao-primario" disabled={salvando}>
            {salvando ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </form>
    </section>
  )
}

function Controle({ campo, valor, erro, aoMudar }: { campo: DefinicaoCampo; valor: string; erro?: string; aoMudar: (valor: string) => void }) {
  const comuns = {
    id: campo.nome,
    name: campo.nome,
    'aria-invalid': erro ? true : undefined,
    'aria-describedby': erro ? `${campo.nome}-erro` : undefined,
  }

  switch (campo.tipo) {
    case 'textarea':
      return <textarea {...comuns} rows={3} value={valor} onChange={(e) => aoMudar(e.target.value)} />
    case 'uf':
      return (
        <select {...comuns} value={valor} onChange={(e) => aoMudar(e.target.value)}>
          <option value="">—</option>
          {UFS.map((uf) => (
            <option key={uf} value={uf}>
              {uf}
            </option>
          ))}
        </select>
      )
    case 'cpf':
      return <input {...comuns} inputMode="numeric" placeholder={campo.placeholder} value={valor} onChange={(e) => aoMudar(formatarCpf(e.target.value))} />
    case 'sku':
      return <input {...comuns} className="mono" placeholder={campo.placeholder} value={valor} onChange={(e) => aoMudar(e.target.value.toUpperCase())} />
    default:
      return (
        <input
          {...comuns}
          type={campo.tipo === 'email' ? 'email' : 'text'}
          inputMode={campo.tipo === 'decimal' ? 'decimal' : undefined}
          maxLength={campo.maximo ? campo.maximo + 20 : undefined}
          placeholder={campo.placeholder}
          value={valor}
          onChange={(e) => aoMudar(e.target.value)}
        />
      )
  }
}
