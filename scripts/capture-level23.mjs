import { mkdir } from 'fs/promises'
import { spawn } from 'child_process'
import { setTimeout as delay } from 'timers/promises'
import puppeteer from 'puppeteer'

const PORT = 4173
const HOST = '127.0.0.1'
const OUTPUT_DIR = '.tmp_screens/non-euclidean'
const BASE_URL = `http://${HOST}:${PORT}`

const views = [
  {
    name: 'level23-spawn',
    path: '/non-euclidean/level2-3/3/1.5/3/0/0?hud=0',
    description: 'Spawn view',
  },
  {
    name: 'level23-user-repro',
    path: '/non-euclidean/level2-3/8.354/1.5/-1.788/-0.7820/-0.0060?hud=0',
    description: 'User-reported viewpoint',
  },
  {
    name: 'level23-door3-room',
    path: '/non-euclidean/level2-3/13.5/1.5/-10/-1.5708/0?hud=0',
    description: 'Looking toward Door3 from inside the room',
  },
  {
    name: 'level23-door3-close',
    path: '/non-euclidean/level2-3/15/1.5/-10/-1.5708/0?hud=0',
    description: 'Close to Door3',
  },
  {
    name: 'level23-door4-room',
    path: '/non-euclidean/level2-3/10/1.5/-6.75/0/0?hud=0',
    description: 'Looking toward Door4 from inside the room',
  },
]

function filterViews(term) {
  if (!term) return views
  return views.filter((view) => view.name.includes(term))
}

function startDevServer() {
  const child = spawn('npm', ['run', 'dev', '--', '--host', HOST, '--port', String(PORT)], {
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  child.stdout.on('data', (chunk) => {
    process.stdout.write(String(chunk))
  })

  child.stderr.on('data', (chunk) => {
    process.stderr.write(String(chunk))
  })

  return child
}

async function waitForServer(child) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (child.exitCode !== null) {
      throw new Error(`Vite exited early with code ${child.exitCode}`)
    }

    try {
      const response = await fetch(BASE_URL)
      if (response.ok) {
        return
      }
    } catch {
      // Server is still starting.
    }

    await delay(500)
  }

  throw new Error(`Timed out waiting for ${BASE_URL}`)
}

async function captureViews(selectedViews) {
  await mkdir(OUTPUT_DIR, { recursive: true })

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox'],
  })

  try {
    for (const view of selectedViews) {
      const page = await browser.newPage()
      await page.setViewport({ width: 1473, height: 768, deviceScaleFactor: 1 })
      const url = `${BASE_URL}${view.path}`
      console.log(`\n[shot] ${view.name}`)
      console.log(`  view: ${view.description}`)
      console.log(`  url:  ${url}`)
      await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 })
      await page.waitForFunction(
        () => document.body.dataset.nonEuclideanReady === '1',
        { timeout: 15000 },
      )
      await delay(1200)
      const outputPath = `${OUTPUT_DIR}/${view.name}.png`
      await page.screenshot({ path: outputPath })
      console.log(`  file: ${outputPath}`)
      await page.close()
    }
  } finally {
    await browser.close()
  }
}

async function main() {
  const selectedViews = filterViews(process.argv[2])
  if (selectedViews.length === 0) {
    throw new Error(`No Level2(3) capture views matched "${process.argv[2]}"`)
  }

  const child = startDevServer()

  try {
    await waitForServer(child)
    await captureViews(selectedViews)
  } finally {
    child.kill('SIGTERM')
    await delay(500)
    if (child.exitCode === null) {
      child.kill('SIGKILL')
    }
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
