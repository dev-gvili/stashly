```tsx
import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  Suspense,
} from 'react'
import {
  createHashRouter,
  RouterProvider,
  Outlet,
  Link,
  useLocation,
  useNavigate,
} from 'react-router-dom'
import {
  Loader2,
  Zap,
  Brain,
  Terminal,
  Layout,
  Settings,
  Play,
  CheckCircle,
  AlertCircle,
  ArrowRight,
  BarChart,
  Sparkles,
  MessageSquare,
} from 'lucide-react'

// --- Gemini API Configuration ---
const apiKey = '' // Provided by environment - MUST remain empty string for auto-injection

/**
 * --------------------------------------------------------------------------------
 * WORKER CODE (INLINED)
 * --------------------------------------------------------------------------------
 */
const WORKER_CODE = `
import { pipeline, env } from 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2';

env.allowLocalModels = false;
env.useBrowserCache = true;

class PipelineSingleton {
    static task = null;
    static model = null;
    static instance = null;

    static async getInstance(progressCallback) {
        if (this.instance === null) {
            this.instance = await pipeline(this.task, this.model, {
                progress_callback: progressCallback,
                device: 'webgpu',
                dtype: 'q4',
            });
        }
        return this.instance;
    }
}

self.addEventListener('message', async (event) => {
    const { type, data } = event.data;
    if (type === 'load') {
        try {
            PipelineSingleton.task = data.task;
            PipelineSingleton.model = data.model;
            await PipelineSingleton.getInstance((progress) => {
                self.postMessage({ type: 'progress', data: progress });
            });
            self.postMessage({ type: 'ready' });
        } catch (error) {
            self.postMessage({ type: 'error', data: error.message });
        }
    } else if (type === 'inference') {
        try {
            const pipe = await PipelineSingleton.getInstance();
            const start = performance.now();
            const output = await pipe(data.text, data.options || {});
            const end = performance.now();
            self.postMessage({ 
                type: 'result', 
                data: { output, executionTime: end - start } 
            });
        } catch (error) {
            self.postMessage({ type: 'error', data: error.message });
        }
    }
});
`

/**
 * --------------------------------------------------------------------------------
 * TYPES & INTERFACES
 * --------------------------------------------------------------------------------
 */
type ModelStatus = 'idle' | 'loading' | 'ready' | 'error' | 'inferencing'

interface ProgressData {
  status: string
  name: string
  file: string
  progress: number
  loaded: number
  total: number
}

interface InferenceResult {
  output: any
  executionTime: number
}

/**
 * --------------------------------------------------------------------------------
 * GEMINI API UTILITIES
 * --------------------------------------------------------------------------------
 */
async function callGemini(
  prompt: string,
  systemPrompt: string = 'You are an AI assistant.'
) {
  // Use the specific supported model for text generation in this environment
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`

  const payload = {
    contents: [{ parts: [{ text: prompt }] }],
    systemInstruction: { parts: [{ text: systemPrompt }] },
  }

  let delay = 1000
  for (let i = 0; i < 5; i++) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(
          `HTTP error! status: ${response.status} - ${errorData.error?.message || 'Unknown error'}`
        )
      }

      const result = await response.json()
      const text = result.candidates?.[0]?.content?.parts?.[0]?.text

      if (!text) {
        throw new Error('No text content found in Gemini response.')
      }

      return text
    } catch (error) {
      if (i === 4) throw error
      // Exponential backoff
      await new Promise((resolve) => setTimeout(resolve, delay))
      delay *= 2
    }
  }
  return 'Failed to get response after retries.'
}

/**
 * --------------------------------------------------------------------------------
 * HOOK: useWorker
 * --------------------------------------------------------------------------------
 */
function useAIWorker() {
  const [worker, setWorker] = useState<Worker | null>(null)
  const [status, setStatus] = useState<ModelStatus>('idle')
  const [progress, setProgress] = useState<ProgressData | null>(null)
  const [result, setResult] = useState<InferenceResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const blob = new Blob([WORKER_CODE], { type: 'application/javascript' })
    const workerUrl = URL.createObjectURL(blob)
    const newWorker = new Worker(workerUrl, { type: 'module' })

    newWorker.onmessage = (e) => {
      const { type, data } = e.data
      switch (type) {
        case 'progress':
          setProgress(data)
          setStatus('loading')
          break
        case 'ready':
          setStatus('ready')
          setProgress(null)
          break
        case 'result':
          setResult(data)
          setStatus('ready')
          break
        case 'error':
          setError(data)
          setStatus('error')
          break
      }
    }
    setWorker(newWorker)
    return () => {
      newWorker.terminate()
      URL.revokeObjectURL(workerUrl)
    }
  }, [])

  const loadModel = useCallback(
    (task: string, model: string) => {
      if (!worker) return
      setStatus('loading')
      setError(null)
      worker.postMessage({ type: 'load', data: { task, model } })
    },
    [worker]
  )

  const runInference = useCallback(
    (text: string, options?: any) => {
      if (!worker) return
      setStatus('inferencing')
      worker.postMessage({ type: 'inference', data: { text, options } })
    },
    [worker]
  )

  return { status, progress, result, error, loadModel, runInference }
}

/**
 * --------------------------------------------------------------------------------
 * COMPONENTS
 * --------------------------------------------------------------------------------
 */

const Card = ({
  children,
  className = '',
}: {
  children: React.ReactNode
  className?: string
}) => (
  <div
    className={`bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm ${className}`}
  >
    {children}
  </div>
)

const Button = ({
  children,
  onClick,
  disabled,
  variant = 'primary',
  className = '',
}: {
  children: React.ReactNode
  onClick?: () => void
  disabled?: boolean
  variant?: 'primary' | 'secondary' | 'outline' | 'gemini'
  className?: string
}) => {
  const baseStyles =
    'inline-flex items-center justify-center px-4 py-2 rounded-lg font-medium transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed text-sm'

  const variants = {
    primary: 'bg-blue-600 hover:bg-blue-700 text-white focus:ring-blue-500',
    secondary:
      'bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-900 dark:text-slate-100 focus:ring-slate-500',
    outline:
      'border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800',
    gemini:
      'bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white focus:ring-purple-500 shadow-sm hover:shadow-md',
  }

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${baseStyles} ${variants[variant]} ${className}`}
    >
      {children}
    </button>
  )
}

const StatusBadge = ({ status }: { status: ModelStatus }) => {
  const styles = {
    idle: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
    loading:
      'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    ready:
      'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    inferencing:
      'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
    error: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  }
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${styles[status]}`}
    >
      {status === 'loading' || status === 'inferencing' ? (
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 bg-current"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-current"></span>
        </span>
      ) : (
        <span className="relative inline-flex rounded-full h-2 w-2 bg-current"></span>
      )}
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  )
}

const RootLayout = () => {
  const location = useLocation()
  const navItems = [
    { path: '/', label: 'Overview', icon: Layout },
    { path: '/generation', label: 'Text Gen', icon: Brain },
    { path: '/analysis', label: 'Sentiment', icon: BarChart },
  ]
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col md:flex-row font-sans">
      <aside className="w-full md:w-64 bg-white dark:bg-slate-900 border-b md:border-b-0 md:border-r border-slate-200 dark:border-slate-800 p-4 flex flex-col">
        <div className="flex items-center gap-2 px-2 py-4 mb-6">
          <div className="bg-blue-600 p-2 rounded-lg shadow-lg shadow-blue-500/20">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-lg leading-tight">NeuroPipe</h1>
            <p className="text-xs text-slate-500 font-mono">
              v0.8.1 • Cloud ✨ Hybrid
            </p>
          </div>
        </div>
        <nav className="space-y-1 flex-1">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path
            const Icon = item.icon
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all ${isActive ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
              >
                <Icon className="w-4 h-4" /> {item.label}
              </Link>
            )
          })}
        </nav>
      </aside>
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto p-6 md:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  )
}

const PipelineRunner = ({ config }: { config: any }) => {
  const { status, progress, result, error, loadModel, runInference } =
    useAIWorker()
  const [input, setInput] = useState(config.example)
  const [geminiLoading, setGeminiLoading] = useState(false)
  const [geminiResult, setGeminiResult] = useState<string | null>(null)
  const [apiError, setApiError] = useState<string | null>(null)

  const isModelLoaded = status === 'ready' || status === 'inferencing'

  const handleLoad = () => loadModel(config.task, config.model)
  const handleRun = () => {
    setGeminiResult(null)
    setApiError(null)
    runInference(input)
  }

  const handleOptimizePrompt = async () => {
    setGeminiLoading(true)
    setApiError(null)
    try {
      const optimized = await callGemini(
        `Rewrite this prompt to be more descriptive and effective for a small encoder-decoder model (LaMini-T5). Make it clear and instructional: "${input}"`,
        'You are a prompt engineering expert.'
      )
      setInput(optimized.trim())
    } catch (err: any) {
      setApiError(err.message || 'Failed to call Gemini API')
    } finally {
      setGeminiLoading(false)
    }
  }

  const handleExplainResult = async () => {
    if (!result) return
    setGeminiLoading(true)
    setApiError(null)
    try {
      const explanation = await callGemini(
        `Explain the following AI model output in a friendly way for a non-technical user. Output: ${JSON.stringify(result.output)}`,
        'You are a helpful data science educator.'
      )
      setGeminiResult(explanation)
    } catch (err: any) {
      setApiError(err.message || 'Failed to call Gemini API')
    } finally {
      setGeminiLoading(false)
    }
  }

  return (
    <div className="space-y-6 max-w-3xl animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold">{config.title}</h2>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            {config.description}
          </p>
        </div>
        <StatusBadge status={status} />
      </div>

      {!isModelLoaded && status !== 'loading' && (
        <Card className="p-8 text-center border-dashed border-2 bg-slate-50 dark:bg-slate-800/50">
          <Brain className="w-12 h-12 text-slate-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium mb-2">Model Required</h3>
          <p className="text-sm text-slate-500 mb-6">
            This pipeline uses {config.model} (WebGPU).
          </p>
          <Button onClick={handleLoad}>Load Model to WebGPU</Button>
        </Card>
      )}

      {status === 'loading' && progress && (
        <Card className="p-6">
          <div className="flex items-center justify-between mb-2 text-sm">
            <span>{progress.file}</span>
            <span>{Math.round(progress.progress)}%</span>
          </div>
          <div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-600 transition-all duration-300"
              style={{ width: `${progress.progress}%` }}
            />
          </div>
        </Card>
      )}

      {isModelLoaded && (
        <div className="grid gap-6">
          <Card className="overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-700">
              <span className="text-xs font-semibold text-slate-500">
                INPUT DATA
              </span>
              <Button
                variant="outline"
                onClick={handleOptimizePrompt}
                disabled={geminiLoading}
                className="h-7 text-[10px] gap-1 px-2 border-purple-200 text-purple-600 dark:text-purple-400"
              >
                {geminiLoading ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Sparkles className="w-3 h-3" />
                )}
                ✨ Optimize Prompt
              </Button>
            </div>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="w-full h-32 p-4 bg-transparent border-none resize-none focus:ring-0 text-slate-700 dark:text-slate-200"
              placeholder={config.placeholder}
            />
            <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-700 flex justify-end">
              <Button
                onClick={handleRun}
                disabled={status === 'inferencing' || !input.trim()}
              >
                {status === 'inferencing' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  'Run Local Inference'
                )}
              </Button>
            </div>
          </Card>

          {apiError && (
            <div className="p-3 bg-red-50 dark:bg-red-900/10 text-red-600 dark:text-red-400 rounded-lg text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              <span>{apiError}</span>
            </div>
          )}

          {result && (
            <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-500 uppercase">
                  Local Output
                </h3>
                <span className="text-[10px] font-mono text-slate-400">
                  {result.executionTime.toFixed(2)}ms
                </span>
              </div>
              <Card className="p-4 bg-slate-900 text-slate-300 font-mono text-sm overflow-x-auto whitespace-pre-wrap">
                {typeof result.output === 'string'
                  ? result.output
                  : JSON.stringify(result.output, null, 2)}
              </Card>

              <div className="flex justify-center">
                <Button
                  variant="gemini"
                  onClick={handleExplainResult}
                  disabled={geminiLoading}
                  className="gap-2"
                >
                  {geminiLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Sparkles className="w-4 h-4" />
                  )}
                  ✨ Analyze with Gemini LLM
                </Button>
              </div>

              {geminiResult && (
                <div className="animate-in zoom-in-95 duration-300">
                  <div className="flex items-center gap-2 mb-2">
                    <MessageSquare className="w-4 h-4 text-purple-500" />
                    <h3 className="text-sm font-semibold text-purple-600 dark:text-purple-400">
                      AI INSIGHTS
                    </h3>
                  </div>
                  <Card className="p-5 border-purple-200 dark:border-purple-900/50 bg-purple-50/50 dark:bg-purple-900/10 italic text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                    {geminiResult}
                  </Card>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

const DashboardHome = () => {
  const navigate = useNavigate()
  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-bold tracking-tight mb-2">
            AI Hybrid Pipeline
          </h2>
          <p className="text-slate-500 text-lg">
            Local WebGPU speed meets ✨ Gemini Cloud intelligence.
          </p>
        </div>
      </div>
      <div className="grid md:grid-cols-2 gap-6">
        <Card
          onClick={() => navigate('/generation')}
          className="p-6 cursor-pointer border-l-4 border-l-blue-500 hover:scale-[1.01] transition-transform"
        >
          <Brain className="w-10 h-10 text-blue-500 mb-4" />
          <h3 className="font-bold text-lg">Text Generation</h3>
          <p className="text-sm text-slate-500">
            Run T5 models locally and use Gemini to rewrite or explain
            responses.
          </p>
        </Card>
        <Card
          onClick={() => navigate('/analysis')}
          className="p-6 cursor-pointer border-l-4 border-l-purple-500 hover:scale-[1.01] transition-transform"
        >
          <BarChart className="w-10 h-10 text-purple-500 mb-4" />
          <h3 className="font-bold text-lg">Sentiment Analysis</h3>
          <p className="text-sm text-slate-500">
            Classify text locally and let Gemini provide deep emotional context.
          </p>
        </Card>
      </div>
    </div>
  )
}

const router = createHashRouter([
  {
    path: '/',
    element: <RootLayout />,
    children: [
      { index: true, element: <DashboardHome /> },
      {
        path: 'generation',
        element: (
          <PipelineRunner
            config={{
              task: 'text2text-generation',
              model: 'Xenova/LaMini-Flan-T5-77M',
              title: 'Text Generation',
              description: 'Sequence-to-Sequence hybrid model.',
              example: 'Summarize the benefits of edge computing.',
              placeholder: 'Prompt...',
            }}
          />
        ),
      },
      {
        path: 'analysis',
        element: (
          <PipelineRunner
            config={{
              task: 'text-classification',
              model: 'Xenova/distilbert-base-uncased-finetuned-sst-2-english',
              title: 'Sentiment Analysis',
              description: 'Classify tone with DistilBERT.',
              example: 'I love how WebGPU makes the web feel native.',
              placeholder: 'Analyze...',
            }}
          />
        ),
      },
    ],
  },
])

export default function App() {
  return <RouterProvider router={router} />
}
```
