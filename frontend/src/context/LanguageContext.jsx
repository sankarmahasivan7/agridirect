import React, { createContext, useContext, useState, useEffect } from 'react'
import { translations } from '../locales/translations.js'

const LanguageContext = createContext(null)

export function LanguageProvider({ children }) {
  const [language, setLanguageState] = useState(() => {
    try {
      const saved = localStorage.getItem('agridirect_lang')
      return saved === 'ta' ? 'ta' : 'en'
    } catch {
      return 'en'
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem('agridirect_lang', language)
      document.documentElement.lang = language
    } catch (e) {
      console.warn('Could not persist language to localStorage', e)
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
   * Helper to retrieve localized text with dot-notation support
   * Example: t('nav.marketplace', 'Marketplace')
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

    // Fallback to English
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
        isTamil: language === 'ta',
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
      t: (keyPath, fallback = '') => fallback || keyPath,
    }
  }
  return ctx
}

