const ObsClient = require("esdk-obs-nodejs");

const obsClient = new ObsClient({
  access_key_id: "",
  secret_access_key: "",
  server: "https://your-endpoint",
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
      key: "TARGET_PATH",
      Body: "",
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
