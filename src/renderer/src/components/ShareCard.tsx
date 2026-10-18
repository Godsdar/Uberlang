import { useEffect, useRef, useState } from 'react'
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Typography, useTheme } from '@mui/material'
import DownloadIcon from '@mui/icons-material/Download'
import LinkIcon from '@mui/icons-material/Link'
import CheckIcon from '@mui/icons-material/Check'
import type { Theme } from '@mui/material/styles'

const SIZE = 1080

interface Props {
  open: boolean
  onClose: () => void
  word: string
  gloss?: string
  fromName: string
  toName: string
  ancestor?: { word: string, langName: string }
}

function drawCard (
  canvas: HTMLCanvasElement,
  theme: Theme,
  props: Props
): void {
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const { palette } = theme
  const paper = palette.background.paper
  const ink = palette.text.primary
  const accent = palette.secondary.main
  const muted = palette.text.secondary

  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = paper
  ctx.fillRect(0, 0, SIZE, SIZE)

  ctx.fillStyle = accent
  ctx.fillRect(0, 0, SIZE, 18)

  ctx.fillStyle = ink
  ctx.font = '700 44px -apple-system, Segoe UI, Roboto, sans-serif'
  ctx.fillText('Uberlang', 80, 130)
  ctx.fillStyle = muted
  ctx.font = '400 30px -apple-system, Segoe UI, Roboto, sans-serif'
  ctx.fillText('etymology · shared roots', 80, 175)

  ctx.textAlign = 'center'
  const cx = SIZE / 2

  ctx.fillStyle = muted
  ctx.font = '500 34px -apple-system, Segoe UI, Roboto, sans-serif'
  ctx.fillText(`${props.fromName}  ↔  ${props.toName}`, cx, 330)

  ctx.fillStyle = ink
  ctx.font = '700 120px -apple-system, Segoe UI, Roboto, sans-serif'
  ctx.fillText(props.word, cx, 480)

  if (props.gloss) {
    ctx.fillStyle = muted
    ctx.font = '400 44px -apple-system, Segoe UI, Roboto, sans-serif'
    ctx.fillText(props.gloss, cx, 545)
  }

  if (props.ancestor) {
    const boxW = 760
    const boxH = 200
    const boxX = cx - boxW / 2
    const boxY = 640
    ctx.strokeStyle = accent
    ctx.lineWidth = 4
    ctx.beginPath()
    if (typeof ctx.roundRect === 'function') ctx.roundRect(boxX, boxY, boxW, boxH, 28)
    else ctx.rect(boxX, boxY, boxW, boxH)
    ctx.stroke()

    ctx.fillStyle = accent
    ctx.font = '500 30px -apple-system, Segoe UI, Roboto, sans-serif'
    ctx.fillText('SHARED ANCESTOR', cx, boxY + 62)

    ctx.fillStyle = muted
    ctx.font = '400 36px -apple-system, Segoe UI, Roboto, sans-serif'
    ctx.fillText(props.ancestor.langName, cx, boxY + 112)

    ctx.fillStyle = accent
    ctx.font = 'italic 700 60px -apple-system, Segoe UI, Roboto, sans-serif'
    ctx.fillText(props.ancestor.word, cx, boxY + 172)
  } else {
    ctx.fillStyle = muted
    ctx.font = '400 40px -apple-system, Segoe UI, Roboto, sans-serif'
    ctx.fillText('No shared etymon found', cx, 740)
  }

  ctx.fillStyle = muted
  ctx.font = '400 28px -apple-system, Segoe UI, Roboto, sans-serif'
  ctx.fillText('Data: Wiktionary (CC BY-SA)', cx, SIZE - 70)
}

export default function ShareCard (props: Props) {
  const theme = useTheme()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (props.open && canvasRef.current) drawCard(canvasRef.current, theme, props)
  }, [props.open, props.word, props.gloss, props.ancestor?.word, theme])

  const attachCanvas = (node: HTMLCanvasElement | null): void => {
    canvasRef.current = node
    if (node) drawCard(node, theme, props)
  }

  function download (): void {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.toBlob(blob => {
      if (!blob) return
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `uberlang-${props.word.toLowerCase()}.png`
      link.click()
      URL.revokeObjectURL(url)
    }, 'image/png')
  }

  async function copyLink (): Promise<void> {
    const params = new URLSearchParams({ q: props.word })
    const url = `${location.origin}${location.pathname}?${params.toString()}`
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* clipboard unavailable */
    }
  }

  return (
    <Dialog open={props.open} onClose={props.onClose} maxWidth="xs" fullWidth keepMounted>
      <DialogTitle>Share this discovery</DialogTitle>
      <DialogContent>
        <Box
          component="canvas"
          ref={attachCanvas}
          width={SIZE}
          height={SIZE}
          sx={{ width: '100%', borderRadius: 2, display: 'block', bgcolor: 'background.paper' }}
        />
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
          Post the image anywhere, or copy a link back to Uberlang.
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={copyLink} startIcon={copied ? <CheckIcon /> : <LinkIcon />}>
          {copied ? 'Copied' : 'Copy link'}
        </Button>
        <Button onClick={download} variant="contained" startIcon={<DownloadIcon />}>
          Download
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export { drawCard }
export type ShareCardProps = Props
export const SHARE_SIZE = SIZE
