import React, { useState, useEffect, useRef } from 'react'
import { 
  Mic, MicOff, Volume2, VolumeX, Send, Sparkles, X, 
  Bot, User as UserIcon, Loader2, CheckCircle2 
} from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import { useLanguage } from '../context/LanguageContext.jsx'
import { interactWithVoiceAssistant } from '../services/api.js'

export default function VoiceAssistant() {
  const { role } = useAuth()
  const { language, setLanguage } = useLanguage()

  const [isOpen, setIsOpen] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [speechSupported, setSpeechSupported] = useState(true)
  const [ttsEnabled, setTtsEnabled] = useState(true)
  const [inputPrompt, setInputPrompt] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [interimTranscript, setInterimTranscript] = useState('')

  const recognitionRef = useRef(null)
  const messagesEndRef = useRef(null)

  // Message history
  const [messages, setMessages] = useState([
    {
      id: 'init-1',
      sender: 'assistant',
      text: language === 'ta'
        ? 'வணக்கம்! நான் உங்கள் அக்ரிடைரக்ட் AI உதவியாளர். உங்கள் விளைபொருட்கள், கிடங்கு இருப்பு, அல்லது போக்குவரத்து பற்றி என்னிடம் கேளுங்கள்.'
        : 'Hello! I am your AgriDirect AI assistant. Ask me about your orders, warehouse stock, or logistics tracking.',
      actions: [],
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ])

  // Scroll to bottom on new messages
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, isOpen, interimTranscript])

  // Setup Web Speech API Recognition
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) {
      setSpeechSupported(false)
      return
    }

    try {
      const recognition = new SpeechRecognition()
      recognition.continuous = false
      recognition.interimResults = true
      recognition.lang = language === 'ta' ? 'ta-IN' : 'en-IN'

      recognition.onstart = () => {
        setIsListening(true)
        setInterimTranscript('')
      }

      recognition.onresult = (event) => {
        let currentInterim = ''
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            const finalTranscript = event.results[i][0].transcript
            setInputPrompt(finalTranscript)
            handleSendMessage(finalTranscript)
          } else {
            currentInterim += event.results[i][0].transcript
          }
        }
        setInterimTranscript(currentInterim)
      }

      recognition.onerror = (event) => {
        console.warn('Speech recognition error:', event.error)
        setIsListening(false)
        setInterimTranscript('')
      }

      recognition.onend = () => {
        setIsListening(false)
        setInterimTranscript('')
      }

      recognitionRef.current = recognition
    } catch (err) {
      console.warn('Speech recognition init failure:', err)
      setSpeechSupported(false)
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort()
      }
    }
  }, [language])

  // Text to Speech
  const speakText = (text, lang) => {
    if (!ttsEnabled || !window.speechSynthesis) return
    window.speechSynthesis.cancel()

    // Strip markdown formatting symbols for cleaner voice reading
    const cleanText = text.replace(/[*#_`~>•]/g, '').trim()
    const utterance = new SpeechSynthesisUtterance(cleanText)
    utterance.lang = lang === 'ta' ? 'ta-IN' : 'en-IN'
    utterance.rate = 0.95
    utterance.pitch = 1.0

    // Choose preferred Indian voices if available
    const voices = window.speechSynthesis.getVoices()
    const targetLang = lang === 'ta' ? 'ta' : 'en'
    const matchingVoice = voices.find(v => v.lang.startsWith(targetLang))
    if (matchingVoice) {
      utterance.voice = matchingVoice
    }

    window.speechSynthesis.speak(utterance)
  }

  const toggleListening = () => {
    if (!speechSupported) {
      alert(
        language === 'ta'
          ? 'உங்கள் உலாவியில் குரல் உள்ளீடு ஆதரிக்கப்படவில்லை. தயவுசெய்து தட்டச்சு செய்யவும்.'
          : 'Speech recognition is not supported in this browser. Please type your query.'
      )
      return
    }

    if (isListening) {
      recognitionRef.current?.stop()
      setIsListening(false)
    } else {
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel()
      }
      try {
        if (recognitionRef.current) {
          recognitionRef.current.lang = language === 'ta' ? 'ta-IN' : 'en-IN'
          recognitionRef.current.start()
        }
      } catch (e) {
        console.warn('Could not start recognition:', e)
      }
    }
  }

  const handleSendMessage = async (textToSend) => {
    const query = (textToSend || inputPrompt).trim()
    if (!query || isLoading) return

    setInputPrompt('')
    setInterimTranscript('')
    if (isListening) {
      recognitionRef.current?.stop()
      setIsListening(false)
    }

    const userMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }

    setMessages(prev => [...prev, userMessage])
    setIsLoading(true)

    // Build history
    const historyPayload = messages.slice(-4).map(m => ({
      role: m.sender === 'user' ? 'user' : 'model',
      text: m.text
    }))

    try {
      const response = await interactWithVoiceAssistant({
        user_prompt: query,
        conversation_history: historyPayload,
        language: language === 'ta' ? 'ta' : 'en'
      })

      const assistantMsg = {
        id: `asst-${Date.now()}`,
        sender: 'assistant',
        text: response.data.response_text,
        actions: response.data.actions_executed || [],
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }

      setMessages(prev => [...prev, assistantMsg])
      speakText(assistantMsg.text, language)
    } catch (err) {
      console.error('Voice Assistant interaction failed:', err)
      const errorMsg = {
        id: `err-${Date.now()}`,
        sender: 'assistant',
        text: language === 'ta'
          ? 'மன்னிக்கவும், சேவையகத்துடன் இணைக்க முடியவில்லை. தயவுசெய்து மீண்டும் முயற்சிக்கவும்.'
          : 'Sorry, I encountered an issue retrieving real data. Please try again.',
        actions: [],
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
      setMessages(prev => [...prev, errorMsg])
    } finally {
      setIsLoading(false)
    }
  }

  // Quick prompt suggestion chips based on user role
  const getSuggestions = () => {
    const r = (role || '').toLowerCase()
    if (r === 'farmer') {
      return language === 'ta'
        ? ['என் ஆர்டர்களின் நிலை என்ன?', 'மத்திய கிடங்கு இருப்பு என்ன?', 'விளைபொருள் தேவை கணிப்பு']
        : ['What are my pending orders?', 'Check warehouse inventory', 'Demand forecast for produce']
    }
    if (r === 'buyer') {
      return language === 'ta'
        ? ['என் ஆர்டர் எங்கே உள்ளது?', 'கிடைக்கும் விளைபொருட்கள் எவை?', 'தென்காசி கிடங்கு இருப்பு']
        : ['Where is my order delivery?', 'Show available produce', 'Warehouse inventory in Tenkasi']
    }
    if (r === 'transporter') {
      return language === 'ta'
        ? ['கிடைக்கும் போக்குவரத்து வேலைகள்', 'என் வாகனத்தின் சுமை நிலை', 'ரூட் தேர்வு விளக்கம்']
        : ['Show available transport jobs', 'My vehicle fill capacity', 'Explain route optimization']
    }
    return language === 'ta'
      ? ['மத்திய கிடங்கு இருப்பு விவரம்', 'செயலில் உள்ள போக்குவரத்து வேலைகள்', 'ஆர்டர்கள் விவரம்']
      : ['Check central warehouse stock', 'Available transport jobs', 'Recent orders summary']
  }

  return (
    <>
      {/* Floating Microphone Launcher Button */}
      <aside 
        aria-label="AgriDirect Voice Assistant Launcher"
        className="fixed bottom-6 right-6 z-50 flex items-center gap-3"
      >
        {!isOpen && (
          <div 
            onClick={() => setIsOpen(true)}
            className="hidden sm:flex items-center gap-2 bg-white/95 backdrop-blur-md px-3.5 py-2 rounded-full shadow-lg border border-emerald-200 cursor-pointer hover:bg-emerald-50 transition-all text-xs font-semibold text-emerald-900 group"
          >
            <Sparkles className="w-3.5 h-3.5 text-emerald-600 animate-pulse" />
            <span>{language === 'ta' ? 'AI குரல் உதவியாளர்' : 'AI Voice Assistant'}</span>
            <span className="bg-emerald-100 text-emerald-800 text-[10px] px-1.5 py-0.5 rounded-full font-mono uppercase">
              Gemini
            </span>
          </div>
        )}

        <button
          onClick={() => setIsOpen(prev => !prev)}
          className={`relative p-4 rounded-full shadow-2xl text-white transition-all transform hover:scale-105 active:scale-95 focus:outline-none focus:ring-4 ${
            isOpen 
              ? 'bg-gray-800 hover:bg-gray-900 focus:ring-gray-300' 
              : 'bg-gradient-to-tr from-emerald-600 to-teal-500 hover:from-emerald-700 hover:to-teal-600 focus:ring-emerald-300'
          }`}
          title={language === 'ta' ? 'AI குரல் உதவியாளர்' : 'AI Voice Assistant'}
          aria-label="Toggle AI Voice Assistant"
        >
          {isOpen ? (
            <X className="w-6 h-6" />
          ) : (
            <>
              <Mic className="w-6 h-6" />
              <span className="absolute -top-1 -right-1 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-teal-500" />
              </span>
            </>
          )}
        </button>
      </aside>

      {/* Assistant Modal / Drawer */}
      {isOpen && (
        <section 
          aria-label="AI Voice Assistant Dialog"
          className="fixed bottom-24 right-4 sm:right-6 z-50 w-[94vw] sm:w-[420px] max-h-[85vh] h-[600px] bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-6 duration-200"
        >
          {/* Header */}
          <header className="bg-gradient-to-r from-emerald-700 to-teal-800 text-white px-4 py-3.5 flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center border border-white/20">
                <Bot className="w-5 h-5 text-emerald-200" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h3 className="font-bold text-sm tracking-wide">
                    {language === 'ta' ? 'அக்ரிடைரக்ட் AI' : 'AgriDirect AI'}
                  </h3>
                  <span className="bg-emerald-500/40 text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded text-emerald-100 border border-emerald-400/30">
                    Live
                  </span>
                </div>
                <p className="text-[11px] text-emerald-100/90 truncate max-w-[200px]">
                  {role ? `${role.toUpperCase()} • ` : ''}Tenkasi • Tirunelveli • Thoothukudi
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              {/* Language toggle */}
              <button
                onClick={() => setLanguage(language === 'ta' ? 'en' : 'ta')}
                className="px-2 py-1 bg-white/15 hover:bg-white/25 rounded text-xs font-semibold text-emerald-50 transition-colors border border-white/20"
                title="Switch Language"
              >
                {language === 'ta' ? 'EN' : 'தமிழ்'}
              </button>

              {/* TTS Audio toggle */}
              <button
                onClick={() => {
                  if (ttsEnabled && window.speechSynthesis) window.speechSynthesis.cancel()
                  setTtsEnabled(prev => !prev)
                }}
                className="p-1.5 bg-white/15 hover:bg-white/25 rounded text-emerald-100 transition-colors border border-white/20"
                title={ttsEnabled ? 'Mute Speech' : 'Enable Speech'}
                aria-label={ttsEnabled ? 'Mute Speech' : 'Enable Speech'}
              >
                {ttsEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4 text-red-300" />}
              </button>

              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 hover:bg-white/20 rounded text-emerald-100 transition-colors ml-1"
                aria-label="Close Assistant"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </header>

          {/* Conversation Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-gradient-to-b from-gray-50/70 to-white text-xs sm:text-sm">
            {messages.map((m) => {
              const isUser = m.sender === 'user'
              return (
                <div
                  key={m.id}
                  className={`flex gap-2.5 ${isUser ? 'justify-end' : 'justify-start'}`}
                >
                  {!isUser && (
                    <div className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5 border border-emerald-200">
                      <Sparkles className="w-4 h-4" />
                    </div>
                  )}

                  <div className={`max-w-[82%] space-y-1.5 ${isUser ? 'items-end' : 'items-start'}`}>
                    <div
                      className={`px-3.5 py-2.5 rounded-2xl leading-relaxed whitespace-pre-wrap ${
                        isUser
                          ? 'bg-emerald-600 text-white rounded-br-xs shadow-sm'
                          : 'bg-white text-gray-800 border border-gray-200 rounded-bl-xs shadow-sm'
                      }`}
                    >
                      {m.text}
                    </div>

                    {/* Show executed actions badge if available */}
                    {!isUser && m.actions && m.actions.length > 0 && (
                      <div className="space-y-1 pl-1">
                        {m.actions.map((act, idx) => (
                          <div
                            key={idx}
                            className="inline-flex items-center gap-1.5 text-[10px] bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-md font-mono"
                          >
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            <span>DB Verified: {act.tool || 'query'}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className={`text-[10px] text-gray-400 px-1 flex items-center gap-1.5 ${isUser ? 'justify-end' : 'justify-start'}`}>
                      <span>{m.timestamp}</span>
                      {!isUser && ttsEnabled && (
                        <button
                          onClick={() => speakText(m.text, language)}
                          className="hover:text-emerald-700 underline flex items-center gap-0.5"
                        >
                          <Volume2 className="w-3 h-3" />
                          <span>{language === 'ta' ? 'கேள்' : 'Listen'}</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {isUser && (
                    <div className="w-7 h-7 rounded-full bg-gray-200 text-gray-700 flex items-center justify-center shrink-0 mt-0.5">
                      <UserIcon className="w-4 h-4" />
                    </div>
                  )}
                </div>
              )
            })}

            {/* Interim Transcript Live Preview */}
            {isListening && interimTranscript && (
              <div className="flex gap-2.5 justify-end">
                <div className="max-w-[80%] bg-emerald-100 text-emerald-900 border border-emerald-300 px-3.5 py-2 rounded-2xl rounded-br-xs italic text-xs animate-pulse">
                  {interimTranscript}...
                </div>
              </div>
            )}

            {/* Loading Indicator */}
            {isLoading && (
              <div className="flex gap-2.5 items-center text-gray-500 text-xs py-1">
                <div className="w-7 h-7 rounded-full bg-emerald-100 flex items-center justify-center">
                  <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
                </div>
                <span className="italic">
                  {language === 'ta' ? 'உண்மையான தரவு சரிபார்க்கப்படுகிறது...' : 'Querying verified database records...'}
                </span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Quick Suggestions Chips */}
          <div className="px-3 py-2 bg-gray-50/80 border-t border-gray-100 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            <span className="text-[10px] uppercase font-bold text-gray-400 shrink-0">
              {language === 'ta' ? 'பரிந்துரைகள்:' : 'Quick:'}
            </span>
            {getSuggestions().map((sug, i) => (
              <button
                key={i}
                onClick={() => handleSendMessage(sug)}
                disabled={isLoading}
                className="whitespace-nowrap px-2.5 py-1 bg-white hover:bg-emerald-50 hover:border-emerald-300 text-gray-700 hover:text-emerald-800 border border-gray-200 rounded-full text-xs font-medium transition-all shrink-0 shadow-2xs active:scale-95"
              >
                {sug}
              </button>
            ))}
          </div>

          {/* Footer Input Bar */}
          <footer className="p-3 bg-white border-t border-gray-200 flex flex-col gap-2">
            {/* Listening status indicator */}
            {isListening && (
              <div className="flex items-center justify-between px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 animate-pulse">
                <div className="flex items-center gap-2">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-600" />
                  </span>
                  <span>{language === 'ta' ? 'கேட்கிறது... பேசுங்கள்...' : 'Listening... Speak now...'}</span>
                </div>
                <button
                  onClick={toggleListening}
                  className="text-xs font-bold text-red-600 hover:underline"
                >
                  {language === 'ta' ? 'நிறுத்து' : 'Stop'}
                </button>
              </div>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault()
                handleSendMessage()
              }}
              className="flex items-center gap-2"
            >
              <button
                type="button"
                onClick={toggleListening}
                className={`p-2.5 rounded-xl border transition-all ${
                  isListening
                    ? 'bg-red-500 text-white border-red-600 animate-bounce'
                    : 'bg-gray-100 hover:bg-emerald-50 text-gray-700 hover:text-emerald-700 border-gray-300'
                }`}
                title={isListening ? 'Stop listening' : 'Start voice input'}
                aria-label={isListening ? 'Stop listening' : 'Start voice input'}
              >
                {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
              </button>

              <input
                type="text"
                value={inputPrompt}
                onChange={(e) => setInputPrompt(e.target.value)}
                placeholder={
                  language === 'ta'
                    ? 'கேள்வியை தட்டச்சு செய்யவும் அல்லது பேசவும்...'
                    : 'Type or click mic to ask about orders, stock, routes...'
                }
                className="flex-1 px-3.5 py-2.5 text-xs sm:text-sm bg-gray-50 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
                disabled={isLoading}
              />

              <button
                type="submit"
                disabled={!inputPrompt.trim() || isLoading}
                className="p-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 text-white transition-all shadow-xs"
                title="Send"
                aria-label="Send"
              >
                <Send className="w-5 h-5" />
              </button>
            </form>

            <div className="flex items-center justify-between text-[10px] text-gray-400 px-1">
              <span>{language === 'ta' ? 'உண்மையான தரவு மட்டுமே • பிழை இல்லாத AI' : '100% Real DB Data • Zero Hallucinations'}</span>
              <span>Gemini Flash</span>
            </div>
          </footer>
        </section>
      )}
    </>
  )
}
