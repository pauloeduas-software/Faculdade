import { readFileSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'

const dir = new URL('../db/', import.meta.url)

export type Db = DatabaseSync

export function abrirBanco(caminho: string): Db {
  const db = new DatabaseSync(caminho)
  db.exec('PRAGMA foreign_keys = ON')
  db.exec(readFileSync(new URL('schema.sql', dir), 'utf-8'))
  return db
}

export function emTransacao<T>(db: Db, fn: () => T): T {
  db.exec('BEGIN')
  try {
    const r = fn()
    db.exec('COMMIT')
    return r
  } catch (e) {
    db.exec('ROLLBACK')
    throw e
  }
}
