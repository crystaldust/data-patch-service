const fs = require('fs')
const ObsClient = require("esdk-obs-nodejs");

const ak = process.env.OBS_AK || "xxx";
const sk = process.env.OBS_SK || "xxx";
const endpoint = process.env.OBS_ENDPOINT || 'https://obs.cn-north-4.myhuaweicloud.com';
const PREFIX = 'os-patches'
const obsClient = new ObsClient({
    access_key_id: ak,
    secret_access_key: sk,
    server: endpoint,
    max_retry_count: 3,
    timeout: 20,
    ssl_verify: false,
    long_conn_param: 0,
});

// TaskId --(map)--> localFilePath
function upload(localFilePath, bucketName) {
    return new Promise((resolve, reject) => {
        const key = `${PREFIX}/${localFilePath}`
        obsClient.putObject(
            {
                Bucket: bucketName,
                Key: key,
                Body: fs.createReadStream(localFilePath)
            },
            (err, result) => {
                if (err) {
                    return reject(err);
                }

                if (result.CommonMsg.Status < 300 && result.InterfaceResult) {
                    result.uploadUrl = `obs://${bucketName}/${key}`
                    return resolve(result);
                }
            }
        );
    })

}

exports.upload = upload