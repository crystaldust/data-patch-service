const fs = require('fs')

try {
	fs.existsSync('./ffff')
} catch(e) {
	console.log(e)
}
