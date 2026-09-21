import React, { createContext, useContext, useState, useEffect, useRef } from 'react'
import { translations } from '../locales/translations.js'
import { TAMIL_GLOSSARY } from '../locales/tamilGlossary.js'

const LanguageContext = createContext(null)

// Build combined glossary and reverse glossary maps from TAMIL_GLOSSARY and translations
const GLOSSARY_MAP = new Map(Object.entries(TAMIL_GLOSSARY))
const REVERSE_GLOSSARY_MAP = new Map()

for (const [en, ta] of Object.entries(TAMIL_GLOSSARY)) {
  if (ta && typeof ta === 'string' && ta.trim()) {
    REVERSE_GLOSSARY_MAP.set(ta.trim(), en.trim())
  }
}

// Recursively index leaf pairs from translations.en and translations.ta
function indexTranslations(enObj, taObj) {
  if (!enObj || !taObj || typeof enObj !== 'object' || typeof taObj !== 'object') return
  for (const key of Object.keys(enObj)) {
    if (key in taObj) {
      const enVal = enObj[key]
      const taVal = taObj[key]
      if (typeof enVal === 'string' && typeof taVal === 'string') {
        const trimmedEn = enVal.trim()
        const trimmedTa = taVal.trim()
        if (trimmedEn && trimmedTa) {
          if (!GLOSSARY_MAP.has(trimmedEn)) GLOSSARY_MAP.set(trimmedEn, trimmedTa)
          if (!REVERSE_GLOSSARY_MAP.has(trimmedTa)) REVERSE_GLOSSARY_MAP.set(trimmedTa, trimmedEn)
        }
      } else if (typeof enVal === 'object' && typeof taVal === 'object') {
        indexTranslations(enVal, taVal)
      }
    }
  }
}
indexTranslations(translations.en, translations.ta)

// Pre-sort keys by length descending to ensure longer phrases match first
const SORTED_GLOSSARY_KEYS = Array.from(GLOSSARY_MAP.keys()).sort((a, b) => b.length - a.length)
const SORTED_REVERSE_KEYS = Array.from(REVERSE_GLOSSARY_MAP.keys()).sort((a, b) => b.length - a.length)

export function LanguageProvider({ children }) {
  const [language, setLanguageState] = useState(() => {
    try {
      const saved = localStorage.getItem('agridirect_lang')
      return saved === 'ta' ? 'ta' : 'en'
    } catch {
      return 'en'
    }
  })

  const isTamil = language === 'ta'

  // Persist language setting
  useEffect(() => {
    try {
      localStorage.setItem('agridirect_lang', language)
      document.documentElement.lang = language
    } catch (e) {
      console.warn('Could not persist language to localStorage', e)
    }
  }, [language])

  // Real-time DOM Text Translator for 100% Tamil coverage & instant two-way English restoration
  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return

    const IGNORED_TAGS = new Set(['SCRIPT', 'STYLE', 'INPUT', 'TEXTAREA', 'CODE', 'PRE', 'NOSCRIPT'])

    // Function to translate a single text node
    const translateTextNode = (node) => {
      if (!node || node.nodeType !== Node.TEXT_NODE) return
      const parent = node.parentElement
      if (!parent || IGNORED_TAGS.has(parent.tagName) || parent.isContentEditable) return

      const raw = node.nodeValue
      if (!raw || !raw.trim()) return

      if (language === 'ta') {
        // Only save original text if it does NOT contain Tamil Unicode characters
        if (node._origText === undefined && !/[\u0B80-\u0BFF]/.test(raw)) {
          node._origText = raw
        }

        const source = node._origText || raw
        let translated = source

        // Check exact match first
        const trimmed = source.trim()
        if (GLOSSARY_MAP.has(trimmed)) {
          const rep = GLOSSARY_MAP.get(trimmed)
          translated = source.replace(trimmed, rep)
        } else {
          // Replace phrases from longest to shortest
          // If the sentence contains multiple words, only match multi-word phrases to avoid "Tanglish" partial replacements
          const isMultiWord = trimmed.includes(' ')
          for (const phrase of SORTED_GLOSSARY_KEYS) {
            if (phrase.includes(' ') || !isMultiWord || phrase.length >= 10) {
              if (translated.includes(phrase)) {
                translated = translated.split(phrase).join(GLOSSARY_MAP.get(phrase))
              }
            } else {
              const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
              const reg = new RegExp(`(?<=\\s|^|[/(,.:;\\-])(${escaped})(?=\\s|$|[/),.:;\\-])`, 'g')
              if (reg.test(translated)) {
                translated = translated.replace(reg, GLOSSARY_MAP.get(phrase))
              }
            }
          }
        }

        if (translated !== raw) {
          node.nodeValue = translated
        }
      } else {
        // Switching back to English:
        // 1. Restore from clean _origText if present and valid English
        if (node._origText !== undefined && !/[\u0B80-\u0BFF]/.test(node._origText)) {
          if (node.nodeValue !== node._origText) {
            node.nodeValue = node._origText
          }
          delete node._origText
        } else if (/[\u0B80-\u0BFF]/.test(node.nodeValue)) {
          // 2. Reverse translate Tamil text back to English using reverse glossary
          const trimmed = node.nodeValue.trim()
          if (REVERSE_GLOSSARY_MAP.has(trimmed)) {
            node.nodeValue = node.nodeValue.replace(trimmed, REVERSE_GLOSSARY_MAP.get(trimmed))
          } else {
            let restored = node.nodeValue
            for (const taPhrase of SORTED_REVERSE_KEYS) {
              if (restored.includes(taPhrase)) {
                restored = restored.split(taPhrase).join(REVERSE_GLOSSARY_MAP.get(taPhrase))
              }
            }
            if (restored !== node.nodeValue) {
              node.nodeValue = restored
            }
          }
          delete node._origText
        }
      }
    }

    // Walk all child text nodes of an element
    const walkAndTranslate = (root) => {
      if (!root) return
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null, false)
      let current = walker.nextNode()
      while (current) {
        translateTextNode(current)
        current = walker.nextNode()
      }
    }

    // Initial pass on entire body
    walkAndTranslate(document.body)

    // MutationObserver to automatically translate newly added/rendered nodes (tabs, routes, modals)
    let timeoutId = null
    const observer = new MutationObserver((mutations) => {
      if (timeoutId) clearTimeout(timeoutId)
      timeoutId = setTimeout(() => {
        for (const m of mutations) {
          if (m.type === 'childList') {
            for (const n of m.addedNodes) {
              if (n.nodeType === Node.TEXT_NODE) {
                translateTextNode(n)
              } else if (n.nodeType === Node.ELEMENT_NODE && !IGNORED_TAGS.has(n.tagName)) {
                walkAndTranslate(n)
              }
            }
          } else if (m.type === 'characterData') {
            translateTextNode(m.target)
          }
        }
      }, 30)
    })

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    })

    return () => {
      observer.disconnect()
      if (timeoutId) clearTimeout(timeoutId)
    }
  }, [language])

  const setLanguage = (lang) => {
    if (lang === 'ta' || lang === 'en') {
      setLanguageState(lang)
    }
  }

  const toggleLanguage = () => {
    setLanguageState((prev) => (prev === 'en' ? 'ta' : 'en'))
  }

  /**
   * Helper to retrieve localized text with dot-notation support and fallback glossary lookup
   */
  const t = (keyPath, fallback = '') => {
    if (!keyPath) return fallback

    const keys = keyPath.split('.')
    
    // First attempt in active language
    let current = translations[language]
    for (const k of keys) {
      if (current && typeof current === 'object' && k in current) {
        current = current[k]
      } else {
        current = null
        break
      }
    }

    if (current && typeof current === 'string') {
      return current
    }

    // If active language is Tamil and not found in translations.ta, check glossary!
    if (language === 'ta') {
      const candidate = fallback || keyPath
      if (candidate && GLOSSARY_MAP.has(candidate.trim())) {
        return GLOSSARY_MAP.get(candidate.trim())
      }
    }

    // Fallback to English in translations
    if (language !== 'en') {
      let enCurrent = translations.en
      for (const k of keys) {
        if (enCurrent && typeof enCurrent === 'object' && k in enCurrent) {
          enCurrent = enCurrent[k]
        } else {
          enCurrent = null
          break
        }
      }
      if (enCurrent && typeof enCurrent === 'string') {
        return enCurrent
      }
    }

    return fallback || keyPath
  }

  return (
    <LanguageContext.Provider
      value={{
        language,
        setLanguage,
        toggleLanguage,
        isTamil,
        isTa: isTamil,
        t,
      }}
    >
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  const ctx = useContext(LanguageContext)
  if (!ctx) {
    return {
      language: 'en',
      setLanguage: () => {},
      toggleLanguage: () => {},
      isTamil: false,
      isTa: false,
      t: (keyPath, fallback = '') => fallback || keyPath,
    }
  }
  return ctx
}
