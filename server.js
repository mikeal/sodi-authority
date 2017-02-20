const couch = require('couch')
const http = require('http')
const qs = require('querystring')
const fs = require('fs')
const path = require('path')
const url = require('url')
const response = require('response')
const request = require('request').defaults({headers: {'user-agent': 'sodi'}})
const knownKeys = require('./').knownKeys

if (!process.env.SODI_PUBLICKEY || !process.env.SODI_SECRETKEY) {
  throw new Error('Missing PUBLIC/PRIVATE key.')
}

const client_id = process.env.SODI_GITHUB_CLIENTID
const client_secret = process.env.SODI_GITHUB_CLIENTSECRET

const sodi = require('sodi')(
  { publicKey: process.env.SODI_PUBLICKEY,
    secretKey: process.env.SODI_SECRETKEY
  }
)

if (!process.env.SODI_DB) throw new Error('No Database Set.')

const db = couch(process.env.SODI_DB)

const config = {
  github: {
    login: 'https://github.com/login/oauth/authorize',
    access: 'https://github.com/login/oauth/access_token',
    user: 'https://api.github.com/user',
    client_id,
    client_secret
  }
}

const indexfile = path.join(__dirname, 'index.html')
const testfile = path.join(__dirname, 'test.html')

const baseurl = process.env.NOW ? 'https://sodi-authority.now.sh' : 'http://localhost:8080'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE',
  'Access-Control-Allow-Headers': 'X-Requested-With, X-HTTP-Method-Override, Content-Type, Accept, Authorization'
}

const app = http.createServer((req, res) => {
  let u = url.parse(req.url, {parseQueryString: true})
  if (u.pathname === '/') {
    return fs.createReadStream(indexfile).pipe(response()).pipe(res)
  }
  if (u.pathname === '/test') {
    return fs.createReadStream(testfile).pipe(response()).pipe(res)
  }
  if (u.pathname.slice(0, '/signature/'.length) === '/signature/') {
    console.log('signature')

    for (var name in cors) {
      res.setHeader(name, cors[name])
    }
    if (req.method !== 'GET') {
      res.statusCode = 200
      return res.end()
    }

    let id = u.pathname.slice('/signature/'.length)
    db.get(id, (err, doc) => {
      if (err) return response.error(err).pipe(res)
      response.json(doc).pipe(res)
    })
    return
  }

  if (u.pathname.slice(0, '/login'.length) === '/login') {
    let [service, publicKey] = u.pathname.slice('/login/'.length).split('/')

    if (service !== 'github') {
      return response.error(new Error('Unknown service.')).pipe(res)
    }

    db.post({publicKey, type: 'token'}, (err, info) => {
      if (err) return response.error(err).pipe(res)

      let opts = {
        allow_signup: true,
        client_id,
        redirect_uri: `${baseurl}/redirect/${info.id}`
      }

      res.statusCode = 302
      res.setHeader('location', `${config.github.login}?${qs.stringify(opts)}`)
      res.end()
    })
    return
  }

  if (req.url.slice(0, '/redirect'.length) === '/redirect') {
    let tokenid = req.url.slice('/redirect/'.length, req.url.indexOf('?'))

    db.get(tokenid, (err, token) => {
      if (err) return response.error(err).pipe(res)
      let publicKey = token.publicKey

      let access = {client_id, client_secret, code: u.query.code}
      request.post(config.github.access, {json: access}, (err, resp, body) => {
        if (err) return response.error(err).pipe(res)
        if (resp.statusCode !== 200) {
          let s = resp.statusCode
          return response.error(new Error('Status not 200, ' + s)).pipe(res)
        }
        let u = `${config.github.user}?access_token=${body.access_token}`
        request.get(u, {json: true}, (err, resp, body) => {
          if (err) return response.error(err).pipe(res)
          if (resp.statusCode !== 200) {
            let s = resp.statusCode
            return response.error(new Error('Status not 200, ' + s)).pipe(res)
          }
          body.type = 'github'
          let message = {user: body, publicKey, timestamp: Date.now()}
          let signature = sodi.sign(JSON.stringify(message)).toString('hex')
          let doc = {_id: publicKey, message, signature, publicKey: sodi.public}
          db.post(doc, (err, info) => {
            if (err) return response.error(err).pipe(res)
            let location = `${baseurl}?publicKey=${publicKey}&complete=true`
            res.statusCode = 302
            res.setHeader('location', location)
            res.end()
          })
        })
      })
    })
    return
  }
  response.error(404).pipe(res)
})

app.listen(8080)
