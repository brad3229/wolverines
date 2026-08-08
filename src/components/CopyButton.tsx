import { useState } from 'react'

export function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    await navigator.clipboard.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="flex-shrink-0 rounded-md bg-neutral-bg px-2.5 py-1 text-[11px] font-bold tracking-wide text-neutral-ink"
    >
      {copied ? 'COPIED' : 'COPY'}
    </button>
  )
}
