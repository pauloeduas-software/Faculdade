import { cpfValido, somenteDigitos } from '../../utils/formato'
import type { DefinicaoCampo, Valores } from './tipos'

export const UFS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA',
  'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
]

// Aceita vírgula ou ponto como separador decimal ("3499,90" ou "3499.90")
export function lerDecimal(texto: string): number {
  const limpo = texto.trim().replace(',', '.')
  return limpo === '' || !/^-?\d+(\.\d+)?$/.test(limpo) ? Number.NaN : Number(limpo)
}

export function decimalParaTexto(valor: number): string {
  return valor.toFixed(2).replace('.', ',')
}

// Mesmas regras (e mensagens) dos schemas zod da API
function validarCampo(campo: DefinicaoCampo, bruto: string): string | null {
  const valor = bruto.trim()
  if (valor === '') return campo.obrigatorio ? 'Campo obrigatório' : null
  if (campo.maximo && valor.length > campo.maximo) return `Máximo de ${campo.maximo} caracteres`

  switch (campo.tipo) {
    case 'email':
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valor)) return 'E-mail inválido'
      break
    case 'cpf':
      if (somenteDigitos(valor).length !== 11) return 'CPF deve ter exatamente 11 dígitos numéricos'
      if (!cpfValido(somenteDigitos(valor))) return 'CPF inválido: dígito verificador não confere'
      break
    case 'uf':
      if (!UFS.includes(valor)) return 'UF inexistente'
      break
    case 'sku':
      if (!/^PRD-\d{4}$/.test(valor)) return 'SKU deve estar no formato PRD-0000'
      break
    case 'decimal':
      if (Number.isNaN(lerDecimal(valor))) return 'Informe um número (ex.: 1234,50)'
      if (!/^-?\d+([.,]\d{1,2})?$/.test(valor)) return 'Use no máximo 2 casas decimais'
      break
  }
  return campo.validar?.(valor) ?? null
}

export function validarFormulario(campos: DefinicaoCampo[], valores: Valores): Record<string, string> {
  const erros: Record<string, string> = {}
  for (const campo of campos) {
    const erro = validarCampo(campo, String(valores[campo.nome] ?? ''))
    if (erro) erros[campo.nome] = erro
  }
  return erros
}

// Campo opcional vazio vai como null para a API
export function textoOuNulo(valor: string | boolean | undefined): string | null {
  const texto = String(valor ?? '').trim()
  return texto === '' ? null : texto
}
