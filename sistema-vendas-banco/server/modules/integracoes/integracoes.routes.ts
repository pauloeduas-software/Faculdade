import { Router } from 'express'
import * as z from 'zod'
import { naoEncontrado } from '../../http/errors.js'
import { paginacaoSchema, parseId } from '../../http/validacao.js'
import { diagnosticarProdutor, permissoesNoProdutor } from '../../integracao/diagnostico.js'
import { executarIntegracaoEntregas } from '../../integracao/executar.js'
import * as log from '../../integracao/log.js'
import { montarRelatorio, relatorioEmTexto } from '../../integracao/relatorio.js'
import * as repositorio from './integracoes.repository.js'

export const integracoesRouter = Router()

// Sem limit: todas as linhas (a aba "Enviar ao Grupo 4" mostra tudo o que o Grupo 4 lê)
const previewSchema = z.object({ limit: z.coerce.number().int().min(1).max(100).optional() })

// host, porta, banco e usuário de uma connection string, NUNCA a senha
function descreverConexao(url: string | undefined) {
  try {
    const u = new URL(url ?? '')
    return { host: u.hostname, porta: u.port || '5432', banco: u.pathname.replace(/^\//, '') || null, usuario: decodeURIComponent(u.username) || null }
  } catch {
    return { host: null, porta: null, banco: null, usuario: null }
  }
}

// -----------------------------------------------------------------------------
// Consumidor (Grupo 7 → nós)
// -----------------------------------------------------------------------------

// Executa a integração com o Grupo 7 e devolve o relatório. Uma execução que
// FALHOU também é uma execução registrada: o resultado está em "status".
// 409 INTEGRACAO_EM_ANDAMENTO se outra execução estiver rodando.
integracoesRouter.post('/entregas/executar', async (_req, res) => {
  const { relatorio, texto } = await executarIntegracaoEntregas()
  res.status(201).location(`/api/integracoes/${relatorio.integracao_id}`).json({ ...relatorio, texto })
})

// Conexão + verificação estrutural, sem processar nada
integracoesRouter.get('/entregas/status', async (_req, res) => {
  res.json(await diagnosticarProdutor())
})

// -----------------------------------------------------------------------------
// Conexões e usuários (Parte 2 da demonstração)
// -----------------------------------------------------------------------------
integracoesRouter.get('/config', async (_req, res) => {
  const produtor = descreverConexao(process.env.GRUPO7_DATABASE_URL)
  const nosso = descreverConexao(process.env.DATABASE_URL)

  let consumidor
  try {
    const permissoes = await permissoesNoProdutor()
    consumidor = { ...permissoes, papel: 'Nosso consumidor, lendo o banco do Grupo 7' }
  } catch (err) {
    consumidor = {
      usuario: produtor.usuario ?? '?',
      papel: 'Nosso consumidor, lendo o banco do Grupo 7',
      limite_conexoes: null,
      configuracoes: [],
      privilegios: [],
      erro: `Não foi possível consultar o banco do Grupo 7: ${err instanceof Error ? err.message : String(err)}`,
    }
  }

  res.json({
    conexoes: [
      { papel: 'Produtor: Grupo 7 – Entregas (nós lemos)', variavel: 'GRUPO7_DATABASE_URL', ...produtor },
      { papel: 'Nosso banco: Grupo 2 – Vendas (a API grava; o Grupo 4 lê)', variavel: 'DATABASE_URL', ...nosso },
    ],
    usuarios: [...(await repositorio.usuariosDoNossoBanco()), consumidor],
  })
})

// -----------------------------------------------------------------------------
// Produtor (nós → Grupo 4): o que o Grupo 4 enxerga
// -----------------------------------------------------------------------------
integracoesRouter.get('/produtor/preview', async (req, res) => {
  const { limit } = previewSchema.parse(req.query)
  res.json(await repositorio.previewViewGrupo4(limit ?? null))
})

// -----------------------------------------------------------------------------
// Histórico de execuções. Depois das rotas fixas: "/config" não é um :id
// -----------------------------------------------------------------------------
integracoesRouter.get('/', async (req, res) => {
  const paginacao = paginacaoSchema.parse(req.query)
  res.json(await log.listarExecucoes(paginacao))
})

integracoesRouter.get('/:id', async (req, res) => {
  const id = parseId(req.params.id)
  const execucao = await log.buscarExecucao(id)
  if (!execucao) throw naoEncontrado(`Execução de integração ${id} não encontrada`)
  res.json({ ...execucao, erros: await log.listarErros(id) })
})

integracoesRouter.get('/:id/relatorio', async (req, res) => {
  const id = parseId(req.params.id)
  const execucao = await log.buscarExecucao(id)
  if (!execucao) throw naoEncontrado(`Execução de integração ${id} não encontrada`)
  const relatorio = montarRelatorio(execucao, await log.listarErros(id))
  res.type('text/plain; charset=utf-8').send(relatorioEmTexto(relatorio))
})
