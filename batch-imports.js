const esdump = require('./esdump')
const fs = require('fs')

const dataDirPath = './FROM_lance-dev_TO_HWCLOUD_2022-10-10T031451.501Z'
const fileNames = fs.readdirSync(dataDirPath)

const promises = fileNames.map(fileName => {
    const parts = fileName.split('.')
    const index = parts[parts.length - 2]
    return esdump.fileToOpensearch(`${dataDirPath}/${fileName}`, index, false, 5000)
})

console.log(promises.length)

Promise.allSettled(promises).then(results => {
    console.log(results.length, 'import finished')
}).catch(err => {
    console.log('failed:', err)
})