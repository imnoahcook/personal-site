import { setTimeout } from 'node:timers/promises'
import puppeteer from 'puppeteer'

const positions = [
  {
    name: 'outside_front',
    x: 2,
    y: 1.6,
    z: 16,
    ry: 3.14,
    desc: 'Looking at diner from outside',
  },
  {
    name: 'inside_diner',
    x: 0,
    y: 1.6,
    z: 0,
    ry: 0,
    desc: 'Inside diner looking at back wall',
  },
  {
    name: 'shed_outside',
    x: 12,
    y: 1.6,
    z: -4,
    ry: 1.57,
    desc: 'Looking into shed door',
  },
  {
    name: 'shed_inside',
    x: 16,
    y: 1.6,
    z: -4,
    ry: -1.57,
    desc: 'Inside shed looking at door',
  },
  {
    name: 'second_floor',
    x: 0,
    y: 6.7,
    z: 0,
    ry: 1.57,
    desc: 'Second floor looking at windows',
  },
  {
    name: 'staircase',
    x: -6.75,
    y: 3,
    z: -3,
    ry: 3.14,
    desc: 'On the staircase going up',
  },
]

const pos = process.argv[2]
  ? positions.filter((p) => p.name.includes(process.argv[2]))
  : positions

async function run() {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox'],
  })

  for (const p of pos) {
    const url = `http://localhost:5173/inspection?x=${p.x}&y=${p.y}&z=${p.z}&ry=${p.ry}`
    console.log(`📸 ${p.name}: ${p.desc}`)
    const page = await browser.newPage()
    await page.setViewport({ width: 1280, height: 720 })
    await page.goto(url, { waitUntil: 'networkidle0', timeout: 15000 })
    // Click to activate pointer lock, then wait for render
    await page.mouse.click(640, 360)
    await setTimeout(2000)
    await page.screenshot({ path: `/tmp/${p.name}.png` })
    console.log(`  → /tmp/${p.name}.png`)
    await page.close()
  }

  await browser.close()
}

run().catch(console.error)
