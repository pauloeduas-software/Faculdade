// Monta o padrão '%texto%' usado com ILIKE. Os curingas % e _ digitados pelo
// usuário são escapados para serem tratados como texto literal.
export function padraoBusca(texto: string): string {
  return `%${texto.replace(/[\\%_]/g, '\\$&')}%`
}
