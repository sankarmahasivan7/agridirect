import React, { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { useLanguage } from '../context/LanguageContext.jsx'
import { useToast } from './Toast.jsx'
import { Loader2 } from 'lucide-react'

const DEFAULT_CLIENT_ID = '299054272422-m7pnn3m1i8cturugc4ko14q632af55qr.apps.googleusercontent.com'

export default function GoogleSignInButton({ role = 'buyer', label }) {
  const { loginWithGoogle } = useAuth()
  const navigate = useNavigate()
  const { addToast } = useToast()
  const { t } = useLanguage()
  const [loading, setLoading] = useState(false)
  const [rendered, setRendered] = useState(false)
  const googleBtnRef = useRef(null)

  const btnLabel = label || t('auth.continueWithGoogle', 'Continue with Google')

  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || DEFAULT_CLIENT_ID

  const handleGoogleSuccess = async (response) => {
    setLoading(true)
    try {
      const data = await loginWithGoogle({
        credential: response.credential,
        role: role
      })
      addToast(t('auth.googleSuccess', 'Successfully signed in with Google!'), 'success')
      if (data.role === 'farmer') navigate('/farmer/dashboard')
      else if (data.role === 'buyer') navigate('/buyer/marketplace')
      else if (data.role === 'transporter') navigate('/transporter/dashboard')
      else if (data.role === 'admin') navigate('/admin/dashboard')
      else navigate('/')
    } catch (err) {
      console.error('Google login error:', err)
      addToast(err.response?.data?.detail || 'Google sign-in failed.', 'error')
    } finally {
      setLoading(false)
    }
  }

  const triggerGoogleFallback = () => {
    if (window.google?.accounts?.id) {
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: handleGoogleSuccess,
        auto_select: false,
      })
      window.google.accounts.id.prompt()
    } else {
      addToast(t('auth.googleInitializing', 'Google Sign-In is initializing. Please wait a moment.'), 'info')
    }
  }

  useEffect(() => {
    let attempts = 0
    const interval = setInterval(() => {
      attempts++
      if (window.google?.accounts?.id && googleBtnRef.current && clientId) {
        try {
          window.google.accounts.id.initialize({
            client_id: clientId,
            callback: handleGoogleSuccess,
            auto_select: false,
          })
          window.google.accounts.id.renderButton(googleBtnRef.current, {
            theme: 'outline',
            size: 'large',
            width: '100%',
            text: 'continue_with',
            shape: 'rectangular',
            logo_alignment: 'left',
          })
          setRendered(true)
          clearInterval(interval)
        } catch (e) {
          console.warn('Google renderButton notice:', e)
        }
      }
      if (attempts > 15) clearInterval(interval)
    }, 400)

    return () => clearInterval(interval)
  }, [clientId, role])

  return (
    <div className="w-full flex flex-col items-center justify-center">
      {loading ? (
        <div className="w-full py-2.5 flex items-center justify-center gap-2 border border-slate-200 rounded-xl bg-slate-50 text-xs text-slate-600 font-medium">
          <Loader2 className="w-4 h-4 animate-spin text-slate-500" />
          <span>{t('auth.signingInWithGoogle', 'Signing in with Google...')}</span>
        </div>
      ) : (
        <>
          <div
            ref={googleBtnRef}
            className={`w-full flex justify-center [&>div]:!w-full [&_iframe]:!w-full ${rendered ? 'block' : 'hidden'}`}
          />
          {!rendered && (
            <button
              type="button"
              onClick={triggerGoogleFallback}
              className="w-full flex items-center justify-center gap-3 py-2.5 px-4 bg-white hover:bg-slate-50 border border-slate-300 hover:border-slate-400 rounded-xl text-slate-700 font-semibold text-sm transition-all shadow-2xs hover:shadow-xs active:scale-98 cursor-pointer"
            >
              <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>{btnLabel}</span>
            </button>
          )}
        </>
      )}
    </div>
  )
}

