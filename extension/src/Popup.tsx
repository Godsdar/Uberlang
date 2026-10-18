import { useEffect, useMemo, useState } from 'react'
import {
  Box,
  Chip,
  CircularProgress,
  CssBaseline,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  ThemeProvider,
  Typography,
  useMediaQuery
} from '@mui/material'
import { getTheme } from '../../src/renderer/src/theme'
import EtymologyTree from '../../src/renderer/src/components/EtymologyTree'
import { analyze } from '../../src/core/analyze'
import { LANGS } from '../../src/renderer/src/data/languages'
import type { LangCode, WordAnalysis } from '@shared/types'

function detectLang (word: string): LangCode {
  return /[\u0400-\u04FF]/.test(word) ? 'ru' : 'en'
}

function langName (code: LangCode): string {
  return LANGS.find(lang => lang.code === code)?.name ?? code
}

export default function Popup () {
  const prefersDark = useMediaQuery('(prefers-color-scheme: dark)')
  const theme = useMemo(() => getTheme(prefersDark ? 'dark' : 'light'), [prefersDark])

  const initial = new URLSearchParams(window.location.search).get('q') ?? ''
  const [word, setWord] = useState(initial)
  const [from, setFrom] = useState<LangCode>(detectLang(initial))
  const [to, setTo] = useState<LangCode>(detectLang(initial) === 'ru' ? 'en' : 'ru')
  const [tokens, setTokens] = useState<WordAnalysis[]>([])
  const [selected, setSelected] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const text = word.trim()
    if (!text) {
      setTokens([])
      setError('')
      return
    }

    let cancelled = false
    setLoading(true)
    setError('')

    const timer = setTimeout(async () => {
      try {
        const result = await analyze({ text, from, to })
        if (!cancelled) {
          setTokens(result.tokens)
          setSelected(result.tokens.length > 0 ? 0 : -1)
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }, 350)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [word, from, to])

  const active = tokens[selected]

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box
        sx={{
          width: 500,
          maxHeight: 640,
          overflowY: 'auto',
          p: 2,
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
          bgcolor: 'background.default'
        }}
      >
        <Typography variant="h6">Uberlang · etymology</Typography>

        <TextField
          size="small"
          label="Word"
          value={word}
          onChange={event => setWord(event.target.value)}
          autoFocus
        />

        <Stack direction="row" spacing={1}>
          <FormControl size="small" fullWidth>
            <InputLabel id="ext-from">From</InputLabel>
            <Select
              labelId="ext-from"
              label="From"
              value={from}
              onChange={event => setFrom(event.target.value as LangCode)}
            >
              {LANGS.map(lang => <MenuItem key={lang.code} value={lang.code}>{lang.name}</MenuItem>)}
            </Select>
          </FormControl>
          <FormControl size="small" fullWidth>
            <InputLabel id="ext-to">To</InputLabel>
            <Select
              labelId="ext-to"
              label="To"
              value={to}
              onChange={event => setTo(event.target.value as LangCode)}
            >
              {LANGS.map(lang => <MenuItem key={lang.code} value={lang.code}>{lang.name}</MenuItem>)}
            </Select>
          </FormControl>
        </Stack>

        {loading && (
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
            <CircularProgress size={16} />
            <Typography variant="caption" color="text.secondary">Analyzing…</Typography>
          </Stack>
        )}

        {error && <Typography variant="caption" color="error">{error}</Typography>}

        {tokens.length > 0 && (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {tokens.map((token, index) => {
              const isSelected = selected === index
              const color = token.sharedAncestor ? 'secondary' : isSelected ? 'primary' : 'default'
              return (
                <Chip
                  key={`${token.token}-${index}`}
                  label={token.token}
                  size="small"
                  color={color}
                  variant={isSelected ? 'filled' : 'outlined'}
                  onClick={() => setSelected(index)}
                />
              )
            })}
          </Box>
        )}

        {active && (
          <Box>
            <Stack direction="row" spacing={1} sx={{ mb: 1.5, alignItems: 'center', flexWrap: 'wrap' }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>{active.token}</Typography>
              {active.pos && <Chip size="small" label={active.pos} />}
              {active.gloss && (
                <Typography variant="body2" color="text.secondary">→ {active.gloss}</Typography>
              )}
            </Stack>
            <EtymologyTree
              source={active.etymology}
              target={active.targetEtymology}
              sourceName={langName(from)}
              targetName={langName(to)}
            />
          </Box>
        )}

        <Typography variant="caption" color="text.disabled" sx={{ mt: 'auto' }}>
          Etymology &amp; translations from Wiktionary (CC BY-SA). MyMemory / DeepL / LibreTranslate as fallback.
        </Typography>
      </Box>
    </ThemeProvider>
  )
}
