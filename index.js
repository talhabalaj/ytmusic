const yt = require("youtube-dl");
const path = require("path");
const wget = require("node-wget-promise");
const ffmpeg = require("fluent-ffmpeg");
const fs = require("fs");
const http = require("http");
const { lookup } = require("mime-types");

const PORT = process.env.PORT || 3000;

// GLOBALS
let q = [];
const MUSIC_LIBRARY_DIR = path.join(__dirname, "music");

function errorDetails(err) {
  if (err.code === 1) {
    return "Error: Format not available or possible internet error";
  }
  return err;
}

function downloadVideo(video) {
  const { videoId, videoUrl, videoFormat, downloadDirectory } = video;

  console.log(`Parsing ${videoUrl}`);
  console.log(`Using the format: ${videoFormat} in ${downloadDirectory}`);

  return new Promise((resolve, reject) => {
    yt.getInfo(videoUrl, [`--format=${videoFormat}`], (err, info) => {
      if (err) {
        return reject(err);
      }
      const { url, id, _filename: filename, title, size } = info;

      const videoHandler = q.find(v => v.videoId === videoId);
      videoHandler.videoTitle = title;
      const filePath = path.join(
        downloadDirectory,
        id + path.extname(filename)
      );

      download(
        url,
        filePath,
        () => {
          video.status = "downloading";
          console.log("Download has been started");
        },
        progress => {
          videoHandler.downloaded = progress.downloadedSize;
          videoHandler.totalSize = progress.fileSize;
          console.log(
            "Downloading: ",
            videoId,
            progress.downloadedSize,
            "/",
            progress.fileSize,
            progress.percentage * 100,
            "%"
          );
        }
      )
        .then(() => {
          video.status = "encoding";
          delete videoHandler.downloaded;
          encodeAudio(filePath, progress => {
            console.log("Encoding:", progress.percent, "%");
            videoHandler.encodedTargetSize = progress.targetSize * 1024;
            videoHandler.encodedPercent = progress.percent;
          }).then(newFileName => {
            videoHandler.encodedSize = videoHandler.encodedTargetSize;
            delete videoHandler.encodedTargetSize;
            delete videoHandler.encodedPercent;
            resolve(newFileName);
          });
        })
        .catch(err => {
          reject(err);
        });

      function download(videoUrl, filePath, startHandler, progressHandler) {
        return wget(videoUrl, {
          onStart: startHandler,
          onProgress: progressHandler,
          output: filePath
        });
      }

      function encodeAudio(filePath, progressHandler) {
        return new Promise((resolve, reject) => {
          const newFileName = path.join(downloadDirectory, `${id}.mp3`);
          ffmpeg(filePath)
            .output(newFileName)
            .on("progress", progressHandler)
            .on("end", () => {
              fs.unlink(filePath);
              resolve(newFileName);
            })
            .on("error", err => {
              reject(err);
            })
            .run();
        });
      }
    });
  });
}
const updateQueue = index => {
  const video = q[index];
  if (video.status === "waiting") {
    video.status = "getting-metadata";
    downloadVideo(video)
      .then(fileName => {
        const videoInfoFile = fs.readFileSync("videoInfo.json");
        const json = JSON.parse(videoInfoFile);
        video.status = "complete";
        video.downloadDirectory = `/download/${video.videoId}`;
        json.push(video);
        fs.writeFileSync("videoInfo.json", JSON.stringify(json));
        q = [...q.slice(0, index), ...q.slice(index + 1)];
        console.log(fileName, " has been downloaded and encoded.");
      })
      .catch(err => {
        q = [...q.slice(0, index), ...q.slice(index + 1)];
        console.log(errorDetails(err));
      });
  }
};

http
  .createServer((req, res) => {
    if (req.url.match(/add\/[A-Z-a-z-0-9^\s]{11}/g)) {
      const videoId = req.url.split("/")[2];
      if (q.find(v => v.videoId === videoId)) {
        res.end(
          JSON.stringify({
            Error: `${videoId} already exists in queue`
          })
        );
      } else if (
        fs.existsSync(path.join(MUSIC_LIBRARY_DIR, `${videoId}.mp3`))
      ) {
        res.end(
          JSON.stringify({
            Error: `Already downloaded ${videoId}`
          })
        );
      } else {
        const iLength = q.length;
        q.push({
          videoId,
          videoUrl: `https://www.youtube.com/watch?v=${videoId}`,
          videoFormat: 251,
          status: "waiting",
          totalSize: 0,
          downloaded: 0,
          downloadDirectory: MUSIC_LIBRARY_DIR
        });
        console.log(q);
        updateQueue(iLength);
        res.end(
          JSON.stringify({
            Success: `${videoId} added to queue`
          })
        );
      }
    } else if (req.url.match(/info\/[A-Z-a-z-0-9^\s]{11}/g)) {
      const videoId = req.url.split("/")[2];
      const info = q.find(e => e.videoId === videoId);
      if (info) {
        info.downloadDirectory = `/download/${videoId}`;
        res.end(JSON.stringify(info));
      } else if (
        fs.existsSync(path.join(MUSIC_LIBRARY_DIR, `${videoId}.mp3`))
      ) {
        const videoInfoRepo = JSON.parse(fs.readFileSync("videoInfo.json"));
        const videoInfo = videoInfoRepo.find(v => v.videoId === videoId);
        res.end(JSON.stringify(videoInfo));
      } else {
        res.end(
          JSON.stringify({
            Error: `${videoId} does not exist in queue`
          })
        );
      }
    } else {
      if (req.url === "/") req.url = "index.html";
      const filePath = path.join(__dirname, "static", req.url.toString());
      const mime = lookup(filePath);
      if (!fs.existsSync(filePath)) {
        res.writeHead(404);
        console.log("Error 404", filePath, mime);
        res.end(
          JSON.stringify({
            Error: "404 not found"
          })
        );
      } else {
        res.writeHead(200, {
          "Content-Type": mime
        });
        console.log("Serving", filePath, mime);
        res.end(fs.readFileSync(filePath));
      }
    }
  })
  .listen(PORT);
console.log("Listening on localhost:", PORT);
