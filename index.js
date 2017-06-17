/* globals localStorage */
const sodi = require('sodi')
const request = require('request').defaults({json: true})

const baseurl = 'https://sodi-authority.now.sh'

module.exports = (keypair, cb) => {
  if (!cb) {
    cb = keypair
    keypair = sodi.generate()
  }
  let publicKey = keypair.publicKey.toString('hex')

  let u = `${baseurl}/signature/${publicKey}?wait=true`

  request(u, (e, resp, body) => {
    if (e) return cb(e)
    if (resp.statusCode !== 200) {
      return cb(new Error(`Status is not 200, ${resp.statusCode}`))
    }
    cb(null, {keypair, signature: body})
  })

  return `${baseurl}/login/github/${publicKey}`
}

const knownKeys = [
  { key: '3ca770842f19f491de60b6ec4d7ce1b55942c1f7ac95084fa712cb99b4c46e4e',
    expiration: 1517475661000
  }
]

module.exports.knownKeys = knownKeys
module.exports.component = require('./component')
module.exports.persist = (key, obj) => {
  let token = {
    keypair: {
      publicKey: obj.keypair.publicKey.toString('hex'),
      secretKey: obj.keypair.secretKey.toString('hex')
    },
    signature: obj.signature
  }
  localStorage[key] = JSON.stringify(token)
}
module.exports.load = key => {
  let token = JSON.parse(localStorage[key])
  token.keypair.publicKey = Buffer.from(token.keypair.publicKey, 'hex')
  token.keypair.secretKey = Buffer.from(token.keypair.secretKey, 'hex')
  return token
}

function validAuthority (signature) {
  for (var i = 0; i < module.exports.knownKeys.length; i++) {
    let key = module.exports.knownKeys.knownKeys[i]
    if (signature.publicKey === key.key) {
      if (key.expiration > Date.now()) {
        return true
      }
    }
  }
  return false
}
module.exports.validAuthority = validAuthority
