import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// Kuratormodus (12.10.2026): Der lokale Dev-Server schreibt Anmerkungen direkt in den
// read_layer-Werkordner: ../read_layer/authors/<autor>/books/<slug>/work/kuration.jsonl
const HIER = path.dirname(fileURLToPath(import.meta.url))
const AUTHORS = path.resolve(HIER, '../read_layer/authors')
const USERS = path.resolve(HIER, '../read_layer/users')   // private Uploads (17.10.2026)

function workDir(slug) {
  if (!/^[a-z0-9-]+$/.test(slug || '')) return null
  if (fs.existsSync(AUTHORS)) {
  for (const a of fs.readdirSync(AUTHORS)) {
    const d = path.join(AUTHORS, a, 'books', slug, 'work')
    if (fs.existsSync(d)) return d
  }
  }
  if (fs.existsSync(USERS)) {
    for (const u of fs.readdirSync(USERS)) {
      const d = path.join(USERS, u, 'works', slug, 'work')
      if (fs.existsSync(d)) return d
    }
  }
  return null
}

function json(res, code, obj) {
  res.statusCode = code
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(obj))
}

function kuration() {
  return {
    name: 'taella-kuration',
    configureServer(server) {
      server.middlewares.use('/api/kuration', (req, res) => {
        const url = new URL(req.url, 'http://x')
        if (req.method === 'GET') {
          const wd = workDir(url.searchParams.get('slug'))
          if (!wd) return json(res, 404, { fehler: 'Werk nicht gefunden' })
          const f = path.join(wd, 'kuration.jsonl')
          const liste = fs.existsSync(f)
            ? fs.readFileSync(f, 'utf-8').split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l) } catch { return null } }).filter(Boolean)
            : []
          let unsicher = []
          const sp = path.join(wd, 'sprecher.json')
          if (fs.existsSync(sp)) {
            try { unsicher = Object.entries(JSON.parse(fs.readFileSync(sp, 'utf-8'))).filter(([, v]) => v && v.pruefen).map(([k]) => k) } catch {}
          }
          return json(res, 200, { liste, unsicher })
        }
        if (req.method === 'POST') {
          let body = ''
          req.on('data', (c) => { body += c })
          req.on('end', () => {
            try {
              const e = JSON.parse(body)
              const wd = workDir(e.slug)
              if (!wd || !e.tag_id) return json(res, 400, { fehler: 'slug/tag_id fehlt' })
              const eintrag = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
                                zeit: new Date().toISOString(), status: 'offen', ...e }
              fs.appendFileSync(path.join(wd, 'kuration.jsonl'), JSON.stringify(eintrag) + '\n', 'utf-8')
              json(res, 200, eintrag)
            } catch (ex) { json(res, 500, { fehler: String(ex) }) }
          })
          return
        }
        json(res, 405, { fehler: 'Methode' })
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), kuration()],
})
