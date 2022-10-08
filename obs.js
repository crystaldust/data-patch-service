const ObsClient = require("esdk-obs-nodejs");

const ak = process.env.OBS_AK || "xxx";
const sk = process.env.OBS_SK || "xxx";
const endpoint = process.env.OBS_ENDPOINT || 'https://obs.cn-north-4.myhuaweicloud.com';

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
  obsClient.putObject(
    {
      Bucket: bucketName,
      key: `os-patches/${localFilePath}`,
      Body: fs.createReadStream(localFilePath)
    },
    (err, result) => {
      if (err) {
        console.log(err);
        return;
      }

      if (result.CommonMsg.Status < 300 && result.InterfaceResult) {
        console.log("upload successful");
        return;
      }

      console.log("Code-->" + result.CommonMsg.Code);
      console.log("Message-->" + result.CommonMsg.Message);
      console.log("HostId-->" + result.CommonMsg.HostId);
      console.log("RequestId-->" + result.CommonMsg.RequestId);
    }
  );
}
exports.upload = upload