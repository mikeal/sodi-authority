let authority = require('./')

let url = authority((err, info) => {
  console.log(err, info)
})
console.log(url)