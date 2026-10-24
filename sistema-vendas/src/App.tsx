import { BrowserRouter, Link, Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { ToastProvider } from './components/ToastProvider'
import { configClientes, configProdutos, configVendedores } from './pages/cadastros/configuracoes'
import { FormularioCadastro } from './pages/cadastros/FormularioCadastro'
import { ListaCadastro } from './pages/cadastros/ListaCadastro'
import { ExecucaoDetalhePagina } from './pages/integracao/ExecucaoDetalhe'
import { IntegracaoPagina } from './pages/integracao/IntegracaoPagina'
import { FormularioVenda } from './pages/vendas/FormularioVenda'
import { VendasLista } from './pages/vendas/VendasLista'

function NaoEncontrada() {
  return (
    <section>
      <h1>Página não encontrada</h1>
      <p>
        <Link to="/vendas">Voltar para as vendas</Link>
      </p>
    </section>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Navigate to="/vendas" replace />} />

            {/* key: ao trocar de cadastro o React recria a tela em vez de reaproveitar o estado */}
            <Route path="clientes" element={<ListaCadastro key="clientes" config={configClientes} />} />
            <Route path="clientes/novo" element={<FormularioCadastro key="clientes-novo" config={configClientes} />} />
            <Route path="clientes/:id" element={<FormularioCadastro key="clientes-editar" config={configClientes} />} />
            <Route path="vendedores" element={<ListaCadastro key="vendedores" config={configVendedores} />} />
            <Route path="vendedores/novo" element={<FormularioCadastro key="vendedores-novo" config={configVendedores} />} />
            <Route path="vendedores/:id" element={<FormularioCadastro key="vendedores-editar" config={configVendedores} />} />
            <Route path="produtos" element={<ListaCadastro key="produtos" config={configProdutos} />} />
            <Route path="produtos/novo" element={<FormularioCadastro key="produtos-novo" config={configProdutos} />} />
            <Route path="produtos/:id" element={<FormularioCadastro key="produtos-editar" config={configProdutos} />} />

            <Route path="vendas" element={<VendasLista />} />
            <Route path="vendas/nova" element={<FormularioVenda key="vendas-nova" />} />
            <Route path="vendas/:id" element={<FormularioVenda key="vendas-editar" />} />

            <Route path="integracao" element={<IntegracaoPagina />} />
            <Route path="integracao/execucoes/:id" element={<ExecucaoDetalhePagina />} />

            <Route path="*" element={<NaoEncontrada />} />
          </Route>
        </Routes>
      </ToastProvider>
    </BrowserRouter>
  )
}
