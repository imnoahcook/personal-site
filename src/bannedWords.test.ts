import { describe, it, expect } from 'vitest'
import { containsBannedWord } from './bannedWords'

describe('containsBannedWord', () => {
  // Should ban
  it('catches standalone slurs', () => {
    expect(containsBannedWord('you are a nigger')).toBe(true)
    expect(containsBannedWord('faggot')).toBe(true)
    expect(containsBannedWord('retard')).toBe(true)
  })

  it('catches standalone profanity', () => {
    expect(containsBannedWord('fuck you')).toBe(true)
    expect(containsBannedWord('what the shit')).toBe(true)
    expect(containsBannedWord('you bitch')).toBe(true)
    expect(containsBannedWord('ass')).toBe(true)
    expect(containsBannedWord('what a dick')).toBe(true)
  })

  it('catches leet-speak variants', () => {
    expect(containsBannedWord('n1gger')).toBe(true)
    expect(containsBannedWord('sh1t')).toBe(true)
    expect(containsBannedWord('b1tch')).toBe(true)
    expect(containsBannedWord('f4ggot')).toBe(true)
  })

  it('catches misc banned terms', () => {
    expect(containsBannedWord('kys')).toBe(true)
    expect(containsBannedWord('nazi')).toBe(true)
    expect(containsBannedWord('hitler did nothing wrong')).toBe(true)
  })

  it('is case insensitive', () => {
    expect(containsBannedWord('FUCK')).toBe(true)
    expect(containsBannedWord('Shit')).toBe(true)
    expect(containsBannedWord('NAZI')).toBe(true)
  })

  // Should NOT ban — these were false positives with substring matching
  it('does not ban "class" or "classic"', () => {
    expect(containsBannedWord('classic website')).toBe(false)
    expect(containsBannedWord('first class')).toBe(false)
    expect(containsBannedWord('classy design')).toBe(false)
  })

  it('does not ban words containing "ass" as substring', () => {
    expect(containsBannedWord('massive')).toBe(false)
    expect(containsBannedWord('password')).toBe(false)
    expect(containsBannedWord('glass')).toBe(false)
    expect(containsBannedWord('grass')).toBe(false)
    expect(containsBannedWord('bass guitar')).toBe(false)
    expect(containsBannedWord('ambassador')).toBe(false)
    expect(containsBannedWord('assassin')).toBe(false)
  })

  it('does not ban words containing "nig" as substring', () => {
    expect(containsBannedWord('night')).toBe(false)
    expect(containsBannedWord('knight')).toBe(false)
    expect(containsBannedWord('enigma')).toBe(false)
  })

  it('does not ban words containing "hoe" as substring', () => {
    expect(containsBannedWord('shoe')).toBe(false)
    expect(containsBannedWord('phoenix')).toBe(false)
    expect(containsBannedWord('whoever')).toBe(false)
  })

  it('does not ban words containing "dick" as substring', () => {
    expect(containsBannedWord('dictionary')).toBe(false)
  })

  it('does not ban words containing "cock" as substring', () => {
    expect(containsBannedWord('peacock')).toBe(false)
    expect(containsBannedWord('cocktail')).toBe(false)
  })

  it('does not ban words containing "coon" as substring', () => {
    expect(containsBannedWord('raccoon')).toBe(false)
    expect(containsBannedWord('tycoon')).toBe(false)
  })

  it('does not ban words containing "spic" as substring', () => {
    expect(containsBannedWord('spice')).toBe(false)
    expect(containsBannedWord('suspicious')).toBe(false)
  })

  it('does not ban words containing "fag" as substring', () => {
    expect(containsBannedWord('flag')).toBe(false)
  })

  it('does not ban normal messages', () => {
    expect(containsBannedWord('awesome site dude!')).toBe(false)
    expect(containsBannedWord('love the stars background')).toBe(false)
    expect(containsBannedWord('how do i make my site look like this')).toBe(false)
    expect(containsBannedWord('this is really cool')).toBe(false)
    expect(containsBannedWord('hello world')).toBe(false)
    expect(containsBannedWord('i love coding')).toBe(false)
    expect(containsBannedWord('great job on the design')).toBe(false)
  })
})
