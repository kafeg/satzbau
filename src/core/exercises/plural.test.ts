import { expect, test } from 'vitest'
import { noun } from '../test-words.ts'
import { canUmlaut, parse, plural, right, typesFor } from './plural.ts'

const t = (lemma: string, form: string) => {
  const p = parse(lemma, form)
  return p && `${p.uml ? '¨' : ''}${p.end || '0'}`
}

test('пять типов окончаний и умлаут', () => {
  expect(t('Tisch', 'Tische')).toBe('e')
  expect(t('Zahn', 'Zähne')).toBe('¨e')
  expect(t('Kind', 'Kinder')).toBe('er')
  expect(t('Haus', 'Häuser')).toBe('¨er')
  expect(t('Fahrrad', 'Fahrräder')).toBe('¨er')
  expect(t('Lampe', 'Lampen')).toBe('en')
  expect(t('Frau', 'Frauen')).toBe('en')
  expect(t('Lehrerin', 'Lehrerinnen')).toBe('en')
  expect(t('Auto', 'Autos')).toBe('s')
  expect(t('Lehrer', 'Lehrer')).toBe('0')
  expect(t('Apfel', 'Äpfel')).toBe('¨0')
  expect(t('Bus', 'Busse')).toBe('e')
  expect(t('Ergebnis', 'Ergebnisse')).toBe('e')
})

test('формы вне пяти типов не разбираются, и слово не спрашивается', () => {
  expect(t('Museum', 'Museen')).toBeNull()
  expect(t('Firma', 'Firmen')).toBeNull()
  expect(t('Werkstatt', 'Werkstätten')).toBeNull()
  expect(plural.fits(noun('Museum', ['n'], { plural: ['Museen'] }))).toBe(false)
  expect(plural.fits(noun('Tisch', ['m'], { plural: ['Tische'] }))).toBe(true)
  expect(plural.fits(noun('Geld', ['n']))).toBe(false)
})

test('засчитывается тип любой формы из списка', () => {
  const konto = noun('Konto', ['n'], { plural: ['Kontos', 'Konten'] })
  expect(right(konto, { uml: false, end: 's' })).toBe(true)
  expect(right(konto, { uml: false, end: 'en' })).toBe(false) // Konten — не по типу -(e)n от Konto
  const zahn = noun('Zahn', ['m'], { plural: ['Zähne'] })
  expect(right(zahn, { uml: true, end: 'e' })).toBe(true)
  expect(right(zahn, { uml: false, end: 'e' })).toBe(false)
})

test('умлаут возможен только при a, o, u в основе', () => {
  expect(canUmlaut('Tisch')).toBe(false)
  expect(canUmlaut('Haus')).toBe(true)
  expect(canUmlaut('Ärztin')).toBe(false)
})

test('варианты: восемь типов, умлаутные — только если в слове есть a, o, u', () => {
  expect(typesFor('Zug')).toHaveLength(8)
  expect(typesFor('Kind')).toHaveLength(5)
  expect(typesFor('Kind').some((t) => t.uml)).toBe(false)
})
