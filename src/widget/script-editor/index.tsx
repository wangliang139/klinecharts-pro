import { Component, createEffect, createSignal, onCleanup, onMount, Show } from "solid-js"
import { Modal } from '../../component'
import './index.less'

export type ScriptEditorProps = {
  open: boolean
  title?: string
  initialCode?: string
  locale?: string
  onClose?: () => void
  onSave?: (code: string) => void
  onRun?: (code: string) => void
}

const DEFAULT_CODE = `// Start typing your script here
`

const ScriptEditor: Component<ScriptEditorProps> = (props) => {
  const [code, setCode] = createSignal(props.initialCode ?? DEFAULT_CODE)
  const [fontSize, setFontSize] = createSignal(14)
  const [output, setOutput] = createSignal<string>('')
  const [diagnostics, setDiagnostics] = createSignal<string | null>(null)
  const [lineCount, setLineCount] = createSignal(1)

  createEffect(() => {
    setCode(props.initialCode ?? DEFAULT_CODE)
  })

  createEffect(() => {
    setLineCount(code().split('\n').length)
  })

  const run = () => {
    const c = code()
    // placeholder "compiler": flag lines containing "error" as failure
    if (/\berror\b/i.test(c)) {
      // find first offending line
      const idx = c.split('\n').findIndex(l => /\berror\b/i.test(l)) + 1
      setDiagnostics(`Error: found "error" at line ${idx}`)
      setOutput('')
    } else {
      setDiagnostics(null)
      setOutput('Compiled and ran successfully')
      props.onRun?.(c)
    }
  }

  const save = () => {
    props.onSave?.(code())
    setOutput('Saved')
  }

  const formatCode = () => {
    // very simple formatting: trim trailing spaces and ensure newline at EOF
    const formatted = code().split('\n').map(l => l.replace(/\s+$/, '')).join('\n').replace(/\n+$/, '\n')
    setCode(formatted)
    setOutput('Formatted')
  }

  const handleKeyDown = (e: KeyboardEvent & { ctrlKey?: boolean | undefined }) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      e.preventDefault()
      save()
      return
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault()
      run()
      return
    }
    if (e.key === 'Escape') {
      props.onClose?.()
      return
    }
  }

  onMount(() => {
    window.addEventListener('keydown', handleKeyDown as any)
  })
  onCleanup(() => {
    window.removeEventListener('keydown', handleKeyDown as any)
  })

  return (
    <Modal
      title={props.title ?? 'Script Editor'}
      onClose={() => props.onClose?.()}
      buttons={[
        { children: 'Save', onClick: save },
      ]}
    >
      <div class="cr-script-editor">
        <div class="cr-se-toolbar">
          <div class="left">
            <button class="btn" onclick={() => save()}>Save</button>
            <button class="btn primary" onclick={() => run()}>Run</button>
            <button class="btn" onclick={() => formatCode()}>Format</button>
          </div>
          <div class="right">
            <label class="label">Font</label>
            <select class="font-select" value={String(fontSize())} onChange={(e) => setFontSize(Number((e.currentTarget as HTMLSelectElement).value))}>
              <option value="12">12px</option>
              <option value="13">13px</option>
              <option value="14">14px</option>
              <option value="16">16px</option>
              <option value="18">18px</option>
            </select>
            <button class="btn" onclick={() => props.onClose?.()}>Close</button>
          </div>
        </div>

        <div class="cr-se-body">
          <div class="cr-se-editor" style={{ 'font-size': `${fontSize()}px` }}>
            <div class="gutter">
              {Array.from({ length: lineCount() }).map((_, i) => <div class="ln">{i + 1}</div>)}
            </div>
            <textarea
              class="code"
              value={code()}
              onInput={(e) => setCode((e.currentTarget as HTMLTextAreaElement).value)}
              spellcheck="false"
            />
          </div>

          <div class="cr-se-output">
            <div class="cr-se-output-header">
              <span>Output</span>
            </div>
            <div class="cr-se-output-body">
              <Show when={diagnostics()}>
                <pre class="diagnostic">{diagnostics()}</pre>
              </Show>
              <pre class="output">{output()}</pre>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  )
}

export default ScriptEditor
