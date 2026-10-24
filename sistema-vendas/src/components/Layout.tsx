import { NavLink, Outlet } from 'react-router-dom'

// Menu em grupos, como o índice de um livro de registro: cadastros, movimento e integração
const MENU = [
  { rota: '/clientes', texto: 'Clientes', grupo: 'cadastros' },
  { rota: '/vendedores', texto: 'Vendedores', grupo: 'cadastros' },
  { rota: '/produtos', texto: 'Produtos', grupo: 'cadastros' },
  { rota: '/vendas', texto: 'Vendas', grupo: 'movimento' },
  { rota: '/integracao', texto: 'Integração', grupo: 'integracao' },
]

export function Layout() {
  return (
    <div className="layout">
      {/* Cabeçalho no topo (mantém a classe menu-lateral): no projetor de 1024 px a tabela ganha a largura toda */}
      <header className="menu-lateral cabecalho-sistema">
        <div className="marca">
          <span className="marca-logo" aria-hidden="true">
            G2
          </span>
          <div>
            <strong>Sistema de Vendas</strong>
            <small>Grupo 2</small>
          </div>
        </div>
        <nav aria-label="Menu principal">
          {MENU.map((item, i) => (
            <NavLink
              key={item.rota}
              to={item.rota}
              className={({ isActive }) =>
                ['menu-item', isActive && 'ativo', i > 0 && MENU[i - 1].grupo !== item.grupo && 'inicio-grupo'].filter(Boolean).join(' ')
              }
            >
              {item.texto}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="conteudo">
        <Outlet />
      </main>
    </div>
  )
}
