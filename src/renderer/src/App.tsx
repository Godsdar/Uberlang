import { useMemo, useState } from 'react'
import {
  AppBar,
  Avatar,
  Badge,
  Box,
  CssBaseline,
  IconButton,
  Tab,
  Tabs,
  ThemeProvider,
  Toolbar,
  Tooltip,
  Typography,
  useMediaQuery
} from '@mui/material'
import Brightness4Icon from '@mui/icons-material/Brightness4'
import Brightness7Icon from '@mui/icons-material/Brightness7'
import type { PaletteMode } from '@mui/material'
import { getTheme } from './theme'
import Translator from './components/Translator'
import LanguageTree from './components/LanguageTree'
import MyRoots from './components/MyRoots'
import { loadRoots, makeRootId, persistRoots } from './lib/roots'
import type { SavedRoot } from './lib/roots'
import type { LangCode } from '@shared/types'

type View = 'translator' | 'tree' | 'roots'

export default function App () {
  const prefersDark = useMediaQuery('(prefers-color-scheme: dark)')
  const [mode, setMode] = useState<PaletteMode>(prefersDark ? 'dark' : 'light')
  const theme = useMemo(() => getTheme(mode), [mode])

  const [view, setView] = useState<View>('translator')
  const [from, setFrom] = useState<LangCode>('en')
  const [to, setTo] = useState<LangCode>('ru')
  const [roots, setRoots] = useState<SavedRoot[]>(() => loadRoots())

  function pickFromTree (code: LangCode): void {
    setTo(code)
    setFrom(code === 'ru' ? 'en' : 'ru')
    setView('translator')
  }

  function addRoot (root: Omit<SavedRoot, 'id' | 'createdAt'>): void {
    const id = makeRootId(root.word, root.from, root.to, root.ancestorWord)
    setRoots(prev => {
      if (prev.some(item => item.id === id)) return prev
      const next = [{ ...root, id, createdAt: Date.now() }, ...prev]
      persistRoots(next)
      return next
    })
  }

  function removeRoot (id: string): void {
    setRoots(prev => {
      const next = prev.filter(item => item.id !== id)
      persistRoots(next)
      return next
    })
  }

  const savedIds = useMemo(() => new Set(roots.map(root => root.id)), [roots])

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
        <AppBar
          position="static"
          color="default"
          elevation={0}
          sx={{ borderBottom: 1, borderColor: 'divider', bgcolor: 'background.paper' }}
        >
          <Toolbar sx={{ gap: 2 }}>
            <Avatar sx={{ bgcolor: 'primary.main', color: 'primary.contrastText' }}>L</Avatar>
            <Box sx={{ flexGrow: 1 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 600, lineHeight: 1.2 }}>
                Uberlang
              </Typography>
              <Typography variant="caption" color="text.secondary">
                every word has a family
              </Typography>
            </Box>

            <Tabs
              value={view}
              onChange={(_event, value: View) => setView(value)}
              textColor="primary"
              indicatorColor="primary"
            >
              <Tab value="translator" label="Translator" />
              <Tab value="tree" label="Language tree" />
              <Tab
                value="roots"
                label={
                  <Badge color="secondary" badgeContent={roots.length} max={999} sx={{ pr: 1 }}>
                    <Box component="span">My roots</Box>
                  </Badge>
                }
              />
            </Tabs>

            <Tooltip title={mode === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}>
              <IconButton
                color="inherit"
                onClick={() => setMode(mode === 'dark' ? 'light' : 'dark')}
              >
                {mode === 'dark' ? <Brightness7Icon /> : <Brightness4Icon />}
              </IconButton>
            </Tooltip>
          </Toolbar>
        </AppBar>

        <Box sx={{ flex: 1, minHeight: 0, p: 3, display: 'flex' }}>
          {view === 'translator' && (
            <Translator
              from={from}
              to={to}
              onFromChange={setFrom}
              onToChange={setTo}
              onSaveRoot={addRoot}
              savedIds={savedIds}
            />
          )}
          {view === 'tree' && <LanguageTree onPick={pickFromTree} />}
          {view === 'roots' && <MyRoots roots={roots} onRemove={removeRoot} />}
        </Box>
      </Box>
    </ThemeProvider>
  )
}
