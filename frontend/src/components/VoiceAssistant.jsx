import React, { useState, useEffect, useRef } from 'react'
import { 
  Mic, MicOff, Volume2, VolumeX, Send, Sparkles, X, 
  Bot, User as UserIcon, Loader2, CheckCircle2, AlertCircle,
  Languages, Radio
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
  const [voiceError, setVoiceError] = useState('')
  const [audioLevel, setAudioLevel] = useState(0)
  
  // Voice recognition language: 'ta-IN' (Tamil) or 'en-IN' (English - India)
  const [speechLang, setSpeechLang] = useState(language === 'ta' ? 'ta-IN' : 'en-IN')

  const recognitionRef = useRef(null)
  const messagesEndRef = useRef(null)
  const audioStreamRef = useRef(null)
  const analyserRef = useRef(null)
  const animationFrameRef = useRef(null)
  const silenceTimerRef = useRef(null)
  const messagesRef = useRef([])

  // Keep speechLang in sync when main app language changes
  useEffect(() => {
    setSpeechLang(language === 'ta' ? 'ta-IN' : 'en-IN')
  }, [language])

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

  // Keep messagesRef updated for async closures
  useEffect(() => {
    messagesRef.current = messages
  }, [messages])

  // Scroll to bottom on new messages
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, isOpen, interimTranscript])

  // Check speech recognition capability on mount
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) {
      setSpeechSupported(false)
    }
    return () => {
      stopListening()
    }
  }, [])

  // Audio level visualizer for microphone feedback
  const setupAudioMeter = (stream) => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext
      if (!AudioCtx) return
      const audioCtx = new AudioCtx()
      const analyser = audioCtx.createAnalyser()
      analyser.fftSize = 64
      analyser.smoothingTimeConstant = 0.5
      const source = audioCtx.createMediaStreamSource(stream)
      source.connect(analyser)

      analyserRef.current = { audioCtx, analyser }

      const dataArray = new Uint8Array(analyser.frequencyBinCount)
      const updateMeter = () => {
        if (!analyserRef.current) return
        analyser.getByteFrequencyData(dataArray)
        let sum = 0
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i]
        }
        const avg = sum / dataArray.length
        const norm = Math.min(100, Math.round((avg / 128) * 100))
        setAudioLevel(norm)
        animationFrameRef.current = requestAnimationFrame(updateMeter)
      }
      updateMeter()
    } catch (e) {
      console.warn('Audio meter initialization skipped:', e)
    }
  }

  const cleanupAudioMeter = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }
    if (audioStreamRef.current) {
      try {
        audioStreamRef.current.getTracks().forEach((track) => track.stop())
      } catch (e) {}
      audioStreamRef.current = null
    }
    if (analyserRef.current?.audioCtx) {
      try {
        analyserRef.current.audioCtx.close().catch(() => {})
      } catch (e) {}
      analyserRef.current = null
    }
    setAudioLevel(0)
  }

  // Start voice recognition with explicit microphone permission check
  const startListening = async () => {
    setVoiceError('')
    setInterimTranscript('')

    // Check secure context
    if (window.isSecureContext === false && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
      setVoiceError(
        language === 'ta'
          ? 'குரல் உள்ளீட்டிற்கு HTTPS அல்லது localhost தேவை. தயவுசெய்து http://localhost:5173 பயன்படுத்தவும்.'
          : 'Voice input requires HTTPS or localhost. Please access via http://localhost:5173.'
      )
      return
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) {
      setSpeechSupported(false)
      setVoiceError(
        language === 'ta'
          ? 'உங்கள் உலாவியில் குரல் அங்கீகாரம் ஆதரிக்கப்படவில்லை. Google Chrome அல்லது Microsoft Edge பயன்படுத்தவும்.'
          : 'Speech recognition is not supported in this browser. Please use Google Chrome or Microsoft Edge.'
      )
      return
    }

    // Cancel any active TTS speech so it doesn't feed back into mic
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel()
    }

    // 1. Request microphone permission explicitly via getUserMedia
    let stream = null
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        stream = await navigator.mediaDevices.getUserMedia({ 
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          } 
        })
        audioStreamRef.current = stream
        setupAudioMeter(stream)
      }
    } catch (err) {
      console.error('Microphone permission request error:', err)
      const isDenied = err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError'
      setVoiceError(
        isDenied
          ? (language === 'ta'
              ? 'மைக்ரோஃபோன் அனுமதி மறுக்கப்பட்டது. உலாவி முகவரிப் பட்டியில் உள்ள பூட்டு (Lock) ஐகானைக் கிளிக் செய்து மைக்கை அனுமதிக்கவும்.'
              : 'Microphone permission denied. Click the lock/tune icon in your address bar and toggle Microphone to Allow.')
          : (language === 'ta'
              ? 'மைக்ரோஃபோன் பிழை: ' + (err.message || 'மைக் இணைப்பை சரிபார்க்கவும்')
              : 'Microphone error: ' + (err.message || 'Please check mic connection'))
      )
      cleanupAudioMeter()
      return
    }

    // 2. Safely stop any existing recognition instance
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort()
      } catch (e) {}
      recognitionRef.current = null
    }

    // 3. Create fresh SpeechRecognition instance
    try {
      const recognition = new SpeechRecognition()
      recognition.continuous = true // Continuous recording prevents premature cutoff mid-sentence
      recognition.interimResults = true
      recognition.lang = speechLang // 'ta-IN' or 'en-IN'
      recognition.maxAlternatives = 1

      // Keep track of accumulated final transcript
      let accumulatedText = inputPrompt ? inputPrompt.trim() + ' ' : ''

      recognition.onstart = () => {
        setIsListening(true)
        setVoiceError('')
      }

      recognition.onresult = (event) => {
        let interim = ''
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const res = event.results[i]
          const transcriptText = res[0].transcript
          if (res.isFinal) {
            accumulatedText += transcriptText + ' '
            setInputPrompt(accumulatedText.trim())
          } else {
            interim += transcriptText
          }
        }
        setInterimTranscript(interim)

        // Live streaming of recognized words directly into the input box
        const currentTotal = (accumulatedText + interim).trim()
        if (currentTotal) {
          setInputPrompt(currentTotal)
        }

        // Reset silence timer on new speech
        if (silenceTimerRef.current) {
          clearTimeout(silenceTimerRef.current)
        }
      }

      recognition.onerror = (event) => {
        console.warn('Speech recognition event error:', event.error)
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          setVoiceError(
            language === 'ta'
              ? 'மைக்ரோஃபோன் அனுமதி தேவை. தயவுசெய்து உலாவியில் மைக்கை அனுமதிக்கவும்.'
              : 'Microphone access denied. Please allow microphone permissions in your browser.'
          )
          stopListening()
        } else if (event.error === 'audio-capture') {
          setVoiceError(
            language === 'ta'
              ? 'மைக்ரோஃபோன் கண்டறியப்படவில்லை. தயவுசெய்து மைக்கை இணைக்கவும்.'
              : 'No microphone was found. Please ensure a mic is plugged in.'
          )
          stopListening()
        } else if (event.error === 'network') {
          setVoiceError(
            language === 'ta'
              ? 'குரல் அங்கீகார நெட்வொர்க் பிழை. இணைய இணைப்பை சரிபார்க்கவும்.'
              : 'Speech recognition network error. Please check your internet connection.'
          )
          stopListening()
        } else if (event.error === 'no-speech') {
          // Normal timeout if user was silent, continue listening unless aborted
        }
      }

      recognition.onend = () => {
        // Recognition completed or stopped
        setIsListening(false)
        setInterimTranscript('')
        cleanupAudioMeter()
      }

      recognitionRef.current = recognition
      recognition.start()
    } catch (err) {
      console.error('Failed to start SpeechRecognition:', err)
      setVoiceError(
        language === 'ta'
          ? 'குரல் அங்கீகாரத்தைத் தொடங்க முடியவில்லை: ' + (err.message || 'மீண்டும் முயற்சிக்கவும்')
          : 'Could not initialize speech recognition: ' + (err.message || 'Please try again')
      )
      cleanupAudioMeter()
    }
  }

  // Stop listening cleanly
  const stopListening = () => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current)
      silenceTimerRef.current = null
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop()
      } catch (e) {}
    }
    cleanupAudioMeter()
    setIsListening(false)
    setInterimTranscript('')
  }

  // Toggle listening button
  const toggleListening = () => {
    if (isListening) {
      stopListening()
    } else {
      startListening()
    }
  }

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
    const matchingVoice = voices.find(v => v.lang && v.lang.toLowerCase().startsWith(targetLang))
    if (matchingVoice) {
      utterance.voice = matchingVoice
    }

    window.speechSynthesis.speak(utterance)
  }

  const handleSendMessage = async (textToSend) => {
    const query = (textToSend || inputPrompt).trim()
    if (!query || isLoading) return

    stopListening()
    setInputPrompt('')
    setInterimTranscript('')
    setVoiceError('')

    const userMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }

    setMessages(prev => [...prev, userMessage])
    setIsLoading(true)

    // Build history from current messages
    const currentMsgs = [...messagesRef.current, userMessage]
    const historyPayload = currentMsgs.slice(-5).map(m => ({
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
        ? ['கத்தரிக்காய் இன்றைய விலை என்ன', '500 கிலோ கத்தரிக்காய் 39 ரூபாய்க்கு சேர்க்க', 'என் ஆர்டர்களின் நிலை என்ன?']
        : ['Brinjal today market price', 'Add 500 kg brinjal with price of 39', 'What are my pending orders?']
    }
    if (r === 'buyer') {
      return language === 'ta'
        ? ['தக்காளி இன்றைய விலை என்ன?', 'என் ஆர்டர் எங்கே உள்ளது?', 'தென்காசி கிடங்கு இருப்பு']
        : ['Tomato today market rate', 'Where is my order delivery?', 'Warehouse inventory in Tenkasi']
    }
    if (r === 'transporter') {
      return language === 'ta'
        ? ['கிடைக்கும் போக்குவரத்து வேலைகள்', 'என் வாகனத்தின் சுமை நிலை', 'ரூட் தேர்வு விளக்கம்']
        : ['Show available transport jobs', 'My vehicle fill capacity', 'Explain route optimization']
    }
    return language === 'ta'
      ? ['இன்றைய சந்தை விலைகள்', 'அக்ரிடைரக்ட் எவ்வாறு செயல்படுகிறது?']
      : ["Today's market prices", 'How does AgriDirect eliminate middlemen?']
  }

  return (
    <>
      {/* Floating Microphone Launcher Button */}
      <aside 
        aria-label="AgriDirect Voice Assistant Launcher"
        className="fixed bottom-20 md:bottom-6 right-4 sm:right-6 z-40 flex items-center gap-3"
      >
        {!isOpen && (
          <div 
            onClick={() => setIsOpen(true)}
            className="hidden sm:flex items-center gap-2.5 bg-white px-4 py-2 rounded-full shadow-soft border border-emerald-300/80 cursor-pointer hover:bg-emerald-50 transition-all text-xs font-bold text-emerald-950 group"
          >
            <Sparkles className="w-4 h-4 text-emerald-600 animate-pulse" />
            <span>{language === 'ta' ? 'AI குரல் உதவியாளர்' : 'AI Voice Assistant'}</span>
          </div>
        )}

        <button
          onClick={() => setIsOpen(prev => !prev)}
          className={`relative p-4 rounded-full shadow-2xl text-white transition-all transform hover:scale-105 active:scale-95 focus:outline-none focus:ring-4 ${
            isOpen 
              ? 'bg-slate-800 hover:bg-slate-900 focus:ring-slate-300' 
              : 'bg-gradient-to-tr from-emerald-700 via-emerald-600 to-teal-500 hover:from-emerald-800 hover:to-teal-600 focus:ring-emerald-300 ring-4 ring-emerald-500/20'
          }`}
          title={language === 'ta' ? 'AI குரல் உதவியாளர்' : 'AI Voice Assistant'}
          aria-label="Toggle AI Voice Assistant"
        >
          {isOpen ? (
            <X className="w-6 h-6" />
          ) : (
            <>
              <Mic className="w-6 h-6" />
              <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500" />
              </span>
            </>
          )}
        </button>
      </aside>

      {/* Assistant Modal / Drawer */}
      {isOpen && (
        <section 
          aria-label="AI Voice Assistant Dialog"
          className="fixed bottom-20 md:bottom-24 right-3 sm:right-6 z-50 w-[94vw] sm:w-[440px] max-h-[calc(100vh-6rem)] sm:max-h-[85vh] h-[620px] bg-white rounded-3xl shadow-soft-2xl border border-slate-200/90 flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-6 duration-200"
        >
          {/* Header */}
          <header className="bg-gradient-to-r from-emerald-800 via-emerald-700 to-teal-800 text-white px-4 py-3.5 flex items-center justify-between shadow-sm">
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

                  <div className={`max-w-[84%] space-y-1.5 ${isUser ? 'items-end' : 'items-start'}`}>
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

            {/* Interim Transcript Live Preview Bubble */}
            {isListening && interimTranscript && (
              <div className="flex gap-2.5 justify-end">
                <div className="max-w-[85%] bg-emerald-100 text-emerald-900 border border-emerald-300 px-3.5 py-2 rounded-2xl rounded-br-xs italic text-xs animate-pulse">
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
            
            {/* Voice Error Notice */}
            {voiceError && (
              <div className="p-2.5 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs flex items-start gap-2 animate-in fade-in">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
                <div className="flex-1">
                  <span className="font-semibold">{voiceError}</span>
                </div>
                <button
                  onClick={() => setVoiceError('')}
                  className="text-red-500 hover:text-red-700 p-0.5"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Active Listening Soundwave Indicator */}
            {isListening && (
              <div className="p-2.5 bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-xl flex flex-col gap-2 shadow-2xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="relative flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-600" />
                    </span>
                    <span className="font-bold text-xs text-emerald-900">
                      {language === 'ta' ? 'குரலைக் கேட்கிறது... பேசுங்கள்...' : 'Listening to your voice... Speak now...'}
                    </span>
                  </div>

                  {/* Visual Soundwave Bars */}
                  <div className="flex items-end gap-1 h-4 px-2">
                    {[1, 2, 3, 4, 5].map((bar) => {
                      const dynamicHeight = Math.max(4, Math.min(16, (audioLevel / 100) * 16 * (bar % 2 === 0 ? 1.2 : 0.8)))
                      return (
                        <div
                          key={bar}
                          className="w-1 bg-emerald-600 rounded-full transition-all duration-75"
                          style={{ height: `${dynamicHeight}px` }}
                        />
                      )
                    })}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleSendMessage()}
                      disabled={!inputPrompt.trim()}
                      className="text-xs font-bold px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors disabled:opacity-50"
                    >
                      {language === 'ta' ? 'முடிந்தது / அனுப்பு' : 'Done & Send'}
                    </button>
                    <button
                      type="button"
                      onClick={stopListening}
                      className="text-xs font-bold text-red-600 hover:underline px-1"
                    >
                      {language === 'ta' ? 'நிறுத்து' : 'Stop'}
                    </button>
                  </div>
                </div>

                {/* Voice Language Selector */}
                <div className="flex items-center justify-between text-[11px] pt-1 border-t border-emerald-200/60 text-emerald-800">
                  <span className="flex items-center gap-1 font-medium">
                    <Radio className="w-3 h-3 text-emerald-600" />
                    {language === 'ta' ? 'குரல் மொழி:' : 'Voice Language:'}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        setSpeechLang('ta-IN')
                        stopListening()
                        setTimeout(startListening, 150)
                      }}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        speechLang === 'ta-IN'
                          ? 'bg-emerald-700 text-white'
                          : 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                      }`}
                    >
                      தமிழ் (Tamil)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSpeechLang('en-IN')
                        stopListening()
                        setTimeout(startListening, 150)
                      }}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        speechLang === 'en-IN'
                          ? 'bg-emerald-700 text-white'
                          : 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                      }`}
                    >
                      English (India)
                    </button>
                  </div>
                </div>
              </div>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault()
                handleSendMessage()
              }}
              className="flex items-center gap-2"
            >
              {/* Mic toggle button */}
              <button
                type="button"
                onClick={toggleListening}
                className={`p-2.5 rounded-xl border transition-all ${
                  isListening
                    ? 'bg-red-500 text-white border-red-600 shadow-md ring-2 ring-red-300'
                    : 'bg-gray-100 hover:bg-emerald-50 text-gray-700 hover:text-emerald-700 border-gray-300'
                }`}
                title={isListening ? 'Stop listening' : 'Click to Speak'}
                aria-label={isListening ? 'Stop listening' : 'Click to Speak'}
              >
                {isListening ? (
                  <MicOff className="w-5 h-5 animate-pulse" />
                ) : (
                  <Mic className="w-5 h-5" />
                )}
              </button>

              {/* Text Input Box (Real-time live streaming of transcript) */}
              <input
                type="text"
                value={inputPrompt}
                onChange={(e) => setInputPrompt(e.target.value)}
                placeholder={
                  isListening
                    ? (language === 'ta' ? 'பேசுங்கள்... உங்கள் குரல் இங்கே தோன்றும்...' : 'Listening... Speak now...')
                    : (language === 'ta'
                        ? 'கேள்வியை தட்டச்சு செய்யவும் அல்லது பேசவும்...'
                        : 'Type or click mic to ask about orders, stock, routes...')
                }
                className={`flex-1 px-3.5 py-2.5 text-xs sm:text-sm border rounded-xl focus:outline-none transition-all ${
                  isListening
                    ? 'bg-emerald-50/70 border-emerald-400 ring-2 ring-emerald-200 text-slate-900 font-medium'
                    : 'bg-gray-50 border-gray-300 focus:ring-2 focus:ring-emerald-500 focus:bg-white'
                }`}
                disabled={isLoading}
              />

              {/* Send Button */}
              <button
                type="submit"
                disabled={!inputPrompt.trim() || isLoading}
                className="p-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 text-white transition-all shadow-xs shrink-0"
                title="Send"
                aria-label="Send"
              >
                <Send className="w-5 h-5" />
              </button>
            </form>

            {/* Quick Speech Language Switcher when not listening */}
            {!isListening && (
              <div className="flex items-center justify-between text-[10px] text-gray-400 px-1">
                <div className="flex items-center gap-1.5">
                  <Languages className="w-3 h-3 text-emerald-600" />
                  <span>
                    {language === 'ta' ? 'குரல் உள்ளீடு:' : 'Voice Input:'}
                  </span>
                  <button
                    type="button"
                    onClick={() => setSpeechLang(prev => prev === 'ta-IN' ? 'en-IN' : 'ta-IN')}
                    className="font-bold text-emerald-700 hover:underline cursor-pointer"
                  >
                    {speechLang === 'ta-IN' ? 'தமிழ் (ta-IN)' : 'English (en-IN)'}
                  </button>
                </div>
                <span>100% Real DB</span>
              </div>
            )}
          </footer>
        </section>
      )}
    </>
  )
}
