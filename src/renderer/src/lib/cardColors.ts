import type { CSSProperties } from 'react'

export const CARD_COLORS = [
  { id: 'default', label: 'Default', bg: '#16181d', border: '#444953', text: '#f2f3f5', muted: '#b3b8c2', legacy: '' },
  { id: 'white', label: 'White', bg: '#f5f5f2', border: '#afb4bd', text: '#20242b', muted: '#535b66', legacy: '#ffffff' },
  { id: 'blue', label: 'Blue', bg: '#1e3047', border: '#54769f', text: '#edf5ff', muted: '#b7cbe3', legacy: 'rgba(30, 58, 138, 0.45)' },
  { id: 'green', label: 'Green', bg: '#203b32', border: '#568b73', text: '#effbf3', muted: '#b7d6c3', legacy: 'rgba(6, 78, 59, 0.45)' },
  { id: 'yellow', label: 'Amber', bg: '#423621', border: '#9b8149', text: '#fff6df', muted: '#dfcca3', legacy: 'rgba(120, 53, 15, 0.45)' },
  { id: 'red', label: 'Red', bg: '#45282a', border: '#a36769', text: '#fff0ef', muted: '#e5b9b7', legacy: 'rgba(136, 19, 55, 0.45)' },
  { id: 'purple', label: 'Purple', bg: '#352b48', border: '#82709f', text: '#f6efff', muted: '#d0bfE5', legacy: 'rgba(88, 28, 135, 0.45)' },
  { id: 'pink', label: 'Rose', bg: '#442d3b', border: '#a16e8e', text: '#fff0f8', muted: '#e6bfd6', legacy: 'rgba(131, 24, 67, 0.45)' }
]

export function getCardColor(value?: string) {
  return CARD_COLORS.find(c => c.bg === value || c.legacy === (value ?? '')) ?? CARD_COLORS[0]
}
export function cardColorStyle(value?: string): CSSProperties {
  const c = getCardColor(value)
  return {
    '--card-bg': c.bg, '--card-border': c.border, '--card-text': c.text,
    '--card-muted': c.muted, '--card-selection': c.id === 'white' ? '#454b54' : '#e3e5e8'
  } as CSSProperties
}
