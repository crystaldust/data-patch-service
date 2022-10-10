const archiver = require("archiver");
const fs = require("fs");

function pack(taskID) {
    return new Promise((resolve, reject) => {
        // The tar lib has a bug that will change the file stat, bring the error of size mismatch.
        // const archive = archiver('tar', {gzip: false})
        const archivePath = `${taskID}.zip`
        const archive = archiver('zip', {level: 9})
        const output = fs.createWriteStream(archivePath)

        output.on('close', () => {
            return resolve(archivePath)
        })
        // output.on('end', ()=>{
        //     console.log('data drained')
        // })
        archive.on('error', (err) => {
            return reject(err);
        })
        archive.on('warning', function (err) {
            if (err.code === 'ENOENT') {
                console.log('tar warning!', err)
            } else {
                return reject(err)
            }
        });

        archive.pipe(output)
        archive.directory(taskID)
        archive.finalize()
    })
}

exports.pack = pack