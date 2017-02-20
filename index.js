const sodi = require('sodi')
const request = require('request').defaults({json: true})
const bel = require('bel')

module.exports = (keypair, cb) => {
  if (!cb) {
    cb = keypair
    keypair = sodi.generate()
  }
  let publicKey = keypair.publicKey.toString('hex')
  let iframe = bel`
    <iframe
      src="https://sodi-authority.now.sh?publicKey=${publicKey}"
      style="margin: 0;padding: 0;border: none;"
      width="300px"
      height="300px"
    >
    </iframe>
  `
  let receiveMessage = ev => {
    if (ev.data && ev.data.app && ev.data.app === 'sodi-authority') {
      window.removeEventListener('message', receiveMessage)
      request(ev.data.signature, (err, resp, signature) => {
        if (err) return cb(err)
        if (resp.statusCode !== 200) {
          return cb(new Error('Status not 200, ' + resp.statusCode))
        }
        cb(null, {keypair, signature})
      })
    }
  }
  window.addEventListener('message', receiveMessage, false)
  return iframe
}

const knownKeys = [
  { key: '3ca770842f19f491de60b6ec4d7ce1b55942c1f7ac95084fa712cb99b4c46e4e',
    expiration: 1517475661000
  }
]

module.exports.knownKeys = knownKeys
