const express = require('express')
const chromium = require('@sparticuz/chromium-min')
const puppeteer = require('puppeteer-core')
const path = require('path')

const app = express()
const PORT = process.env.PORT || 4000

async function getBrowser() {
  return puppeteer.launch({
    args: [...chromium.args, '--hide-scrollbars', '--disable-web-security'],
    defaultViewport: chromium.defaultViewport,
    executablePath:
      process.env.NODE_ENV === 'production'
        ? await chromium.executablePath(`https://github.com/Sparticuz/chromium/releases/download/v127.0.0/chromium-v127.0.0-pack.tar`)
        : path.resolve('C:/Program Files/Google/Chrome/Application/chrome.exe'),
    headless: chromium.headless,
    ignoreHTTPSErrors: true
  })
}

app.get('/', (req, res) => {
  res.send('Hello World')
})

app.get('/movies', async (req, res) => {
  const url = req.query.url

  if (!url) {
    return res.status(400).send('URL is required')
  }

  try {
    const browser = await getBrowser()
    const page = await browser.newPage()
    await page.goto(url, { waitUntil: 'networkidle2' })

    const data = await page.evaluate(() => {
      const items = document.querySelectorAll('.movies-list-wrap .tab-content .movies-list-full .ml-item')
      return Array.from(items).map((item) => {
        const imgSrc = item.querySelector('img').src
        const aTag = item.querySelector('a[data-url]')
        const href = aTag ? aTag.href : null
        const qualitySpan = item.querySelector('span.mli-quality')
        const quality = qualitySpan ? qualitySpan.innerText : null
        const ratingSpan = item.querySelector('span.mli-rating')
        const rating = ratingSpan ? ratingSpan.textContent.trim().replace(/^\D+/g, '') : null
        const durationSpan = item.querySelector('span.mli-durasi')
        const duration = durationSpan ? durationSpan.textContent.trim().replace(/^\D+/g, '') : null
        const titleH2 = item.querySelector('span.mli-info h2')
        const title = titleH2 ? titleH2.textContent.trim() : null
        return { imgSrc, href, quality, rating, duration, title }
      })
    })

    await browser.close()
    res.json(data)
  } catch (error) {
    console.error(error)
    res.status(500).send('Something went wrong')
  }
})

app.get('/detail-movies', async (req, res) => {
  const url = req.query.url

  if (!url) {
    return res.status(400).send('URL is required')
  }

  try {
    const browser = await getBrowser()
    const page = await browser.newPage()
    await page.goto(url, { waitUntil: 'networkidle2' })

    const data = await page.evaluate(() => {
      const titleContainer = document.querySelector('h3[itemprop="name"]')
      const title = titleContainer ? titleContainer.getAttribute('content') : null
      const hrefContainer = document.querySelector('#mv-info a[title]')
      const href = hrefContainer ? hrefContainer.getAttribute('href') : null

      return { title, href }
    })

    await browser.close()
    res.json(data)
  } catch (error) {
    console.error(error)
    res.status(500).send('Something went wrong')
  }
})

app.get('/watch-movies', async (req, res) => {
  const url = req.query.url

  if (!url) {
    return res.status(400).send('URL is required')
  }

  try {
    const browser = await getBrowser()
    const page = await browser.newPage()
    await page.goto(url, { waitUntil: 'networkidle2' })

    const data = await page.evaluate(() => {
      const videoSrcContainer = document.querySelector('#iframe-embed')
      const videoSrc = videoSrcContainer ? videoSrcContainer.getAttribute('src') : null

      const titleContainer = document.querySelector('.mvic-info .mvic-tagline2 h3')
      const title = titleContainer ? titleContainer.textContent.trim() : null

      const serversContainer = document.querySelectorAll('#server-list .server-wrapper')
      const servers = Array.from(serversContainer).map((server) => {
        const iframeContainer = server.querySelector('.server')
        const iframeSrc = iframeContainer ? iframeContainer.getAttribute('data-iframe') : null

        const descriptionContainer = server.querySelector('.server-title small')
        const description = descriptionContainer ? descriptionContainer.textContent.trim() : null
        return { description, src: iframeSrc }
      })

      return { title, mainServer: videoSrc, servers }
    })

    await browser.close()
    res.json(data)
  } catch (error) {
    console.error(error)
    res.status(500).send('Something went wrong')
  }
})

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`)
})
