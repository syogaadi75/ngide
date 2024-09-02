const express = require('express')
const chromium = require('@sparticuz/chromium-min')
const puppeteer = require('puppeteer-core')
const path = require('path')
const cors = require('cors')
const bodyParser = require('body-parser');

const app = express()
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const PORT = process.env.PORT || 4000
const mainUrl = 'https://rebahinxxi.wiki/'

app.use(cors())

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

app.get('/api/movies', async (req, res) => {
  const url = mainUrl

  if (!url) {
    return res.status(400).send('URL is required')
  }

  try {
    const browser = await getBrowser()
    const page = await browser.newPage()
    await page.setRequestInterception(true);
    page.on('request', request => {
      const url = request.url();
      if (['image', 'stylesheet', 'font', 'script'].some(resource => url.endsWith(resource))) {
        request.abort(); // Abaikan permintaan ini
      } else {
        request.continue();
      }
    });
    await page.goto(url, { waitUntil: 'networkidle2' })

    const latest = await page.evaluate(() => {
      const items = document.querySelectorAll('.movies-list-wrap.mlw-latestmovie .tab-content .movies-list-full .ml-item')
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
    const topView = await page.evaluate(() => {
      const items = document.querySelectorAll('.movies-list-wrap.mlw-topview .tab-content .movies-list-full .ml-item')
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

    const data = {
      latest,
      topView
    }

    await browser.close()
    res.json(data)
  } catch (error) {
    console.error(error)
    res.status(500).send('Something went wrong')
  }
})

app.get('/api/detail-movie', async (req, res) => {
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
      const thumbElement = document.querySelector('.thumb.mvic-thumb')
      const style = window.getComputedStyle(thumbElement)
      const backgroundImage = style.getPropertyValue('background-image')
      const imgSrc = backgroundImage.slice(5, -2)

      const trailer = document.querySelector('#iframe-trailer').getAttribute('src')

      const rating = {
        count: document.querySelector('span[itemprop="ratingCount"]').getAttribute('content'),
        value: document.querySelector('span[itemprop="ratingValue"]').getAttribute('content')
      }

      const sinopsisContainer = document.querySelectorAll('span[itemprop="reviewBody"] p')
      let sinopsis
      Array.from(sinopsisContainer).map((s, i) => {
        if (i === 0) {
          sinopsis = s.textContent.trim()
        }
        return s.textContent.trim()
      })

      const rightInfo = document.querySelectorAll('.mvic-desc .mvic-info .mvici-right p')
      let duration, qualities, release_date, countries
      rightInfo.forEach((el, i) => {
        if (i === 0) {
          duration = el.textContent.replace('Duration:', '').trim()
        } else if (i === 1) {
          const qualitiesContainer = el.querySelectorAll('span.quality a')
          qualities = Array.from(qualitiesContainer).map((q) => {
            return {
              name: q.textContent.trim(),
              href: q.getAttribute('href')
            }
          })
        } else if (i === 2) {
          release_date = el.textContent.replace('Release Date:', '').trim()
        } else if (i === 3) {
          const countriesContainer = el.querySelectorAll('a')
          countries = Array.from(countriesContainer).map((c) => {
            return {
              name: c.textContent.trim(),
              href: c.getAttribute('href')
            }
          })
        }
      })

      const info = document.querySelectorAll('.mvic-desc .mvic-info .mvici-left p')
      let genres = []
      let actors = []
      let directors = []

      info.forEach((i, index) => {
        if (index === 0) {
          const genresContainer = i.querySelectorAll('a')
          genres = Array.from(genresContainer).map((g) => {
            return {
              name: g.querySelector('span[itemprop="genre"]').textContent.trim(),
              href: g.getAttribute('href')
            }
          })
        } else if (index === 1) {
          const actorsContainer = i.querySelectorAll('span[itemprop="actor"] a')
          actors = Array.from(actorsContainer).map((a) => {
            return {
              name: a.querySelector('span[itemprop="name"]').textContent.trim(),
              href: a.getAttribute('href')
            }
          })
        } else if (index === 2) {
          const directorsContainer = i.querySelectorAll('span[itemprop="director"] a')
          directors = Array.from(directorsContainer).map((d) => {
            return {
              name: d.querySelector('span[itemprop="name"]').textContent.trim(),
              href: d.getAttribute('href')
            }
          })
        }
      })

      const hrefContainer = document.querySelector('#mv-info a[title]')
      const href = hrefContainer ? hrefContainer.getAttribute('href') : null

      return { title, imgSrc, trailer, href, rating, sinopsis, duration, qualities, release_date, countries, genres, actors, directors }
    })

    await browser.close()
    res.json(data)
  } catch (error) {
    console.error(error)
    res.status(500).send('Something went wrong')
  }
})

app.get('/api/watch-movie', async (req, res) => {
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

      const rating = {
        count: document.querySelector('label#movie-rating').textContent.replace('Rating', '').replace('(', '').replace(')', '').trim(),
        value: document.querySelector('#movie-mark').textContent.trim()
      }

      const sinopsisContainer = document.querySelectorAll('.desc-des-pendek[itemprop="description"] p')
      let sinopsis
      sinopsisContainer.forEach((el, i) => {
        if (i === 0) {
          sinopsis = el.textContent.trim()
        }
      })

      const actorsContainer = document.querySelectorAll('span[itemprop="actor"] a')
      let actors = Array.from(actorsContainer).map((d) => {
        return {
          name: d.querySelector('span[itemprop="name"]').textContent.trim(),
          href: d.getAttribute('href')
        }
      })

      const directorsContainer = document.querySelectorAll('span[itemprop="director"] a')
      let directors = Array.from(directorsContainer).map((d) => {
        return {
          name: d.querySelector('span[itemprop="name"]').textContent.trim(),
          href: d.getAttribute('href')
        }
      })

      return { title, mainServer: videoSrc, servers, rating, sinopsis, actors, directors }
    })

    await browser.close()
    res.json(data)
  } catch (error) {
    console.error(error)
    res.status(500).send('Something went wrong')
  }
})

app.post('/api/search-movies', async (req, res) => {
  const movie = req.body.movie
  const theLast = req.body.last
  const theFirst = req.body.first
  const page = req.body.page
  
  let url = `${mainUrl}/?s=${movie.replaceAll(' ', '+')}`

  if(theLast) {
    url = theLast
  }

  if(theFirst) {
    url = theFirst
  }

  if(page) {
    url = `${mainUrl}/page/${page}/?s=${movie.replaceAll(' ', '+')}`
  }

  if (!url) {
    return res.status(400).send('URL is required')
  }

  try {
    const browser = await getBrowser()
    const page = await browser.newPage()
    await page.goto(url, { waitUntil: 'networkidle2' })

    const data = await page.evaluate(() => {  
      const moviesContainer = document.querySelectorAll('#featured .ml-item')
      const movies = Array.from(moviesContainer).map((movie) => {
        const imgSrc = movie.querySelector('img').src
        const aTag = movie.querySelector('a[data-url]')
        const href = aTag ? aTag.href : null
        const qualitySpan = movie.querySelector('span.mli-quality')
        const quality = qualitySpan ? qualitySpan.innerText : null
        const ratingSpan = movie.querySelector('span.mli-rating')
        const rating = ratingSpan ? ratingSpan.textContent.trim().replace(/^\D+/g, '') : null
        const durationSpan = movie.querySelector('span.mli-durasi')
        const duration = durationSpan ? durationSpan.textContent.trim().replace(/^\D+/g, '') : null
        const titleH2 = movie.querySelector('span.mli-info h2')
        const title = titleH2 ? titleH2.textContent.trim() : null
        let episode = {
          isEpisode: false,
          episode: 0,
          status: ''
        }
        const isEpisode = movie.querySelector('.mli-eps')
        if(isEpisode) {
          const epsText = isEpisode.querySelector('span').textContent
          const eps = epsText.split(' ')[0]
          const st = epsText.split(' ')[1]
          episode = {
            isEpisode: true,
            episode: eps,
            status: st == 'ON' ? 'On Going' : 'Completed' 
          }
        }
        return { imgSrc, href, quality, rating, duration, title, episode }
      })

      const paginationContainer = document.querySelectorAll('#pagination ul.pagination li')
      let currnetPage = parseInt(document.querySelector('#pagination li.active a').textContent);
      let count = 1;
      let isNext = false;
      let isPrev = false;
      let first = {
        status: false,
        href: null
      };
      let last = {
        status: false,
        href: null
      };
      let startPage = 0;
      let startIndex = 0
      paginationContainer.forEach((el, i) => {
        const firstContent = el.querySelector('a')
        if(firstContent.textContent.includes('First')) {
          startIndex++
          first = {
            status: true,
            href: firstContent.href
          }
        }
        const prev = el.querySelector('a').textContent.includes('Prev')
        if(prev) {
          startIndex++
          isPrev = true
        }

        const aTag = el.querySelector('a.page')
        if(aTag) {
          if(i === startIndex) {
            if(currnetPage === 1) {
              startPage = 1;
            } else {
              startPage = parseInt(aTag.textContent);
            }
          } 
          count++
        } 
        const next = el.querySelector('a').textContent.includes('Next')
        if(next) {
          isNext = true
        }
        const lastContent = el.querySelector('a')
        if(lastContent.textContent.includes('Last')) {
          last = {
            status: true,
            href: lastContent.href
          }
        } 
      });

      const pagination = {
        currnetPage, startPage, count, isNext, isPrev, first, last
      }

      return { pagination, movies }
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
