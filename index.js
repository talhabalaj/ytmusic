const yt = require("youtube-dl");
const path = require("path");
const wget = require("node-wget-promise");
const ffmpeg = require("fluent-ffmpeg");
const fs = require("fs");
const http = require("http");
const { lookup } = require("mime-types");
const fetch = require("node-fetch");
const { parse: UrlParse } = require("url");

const PORT = process.env.PORT || 3000;
class Queue extends Array {
  addToQueue(element) {
    this.push(element);
  }
  removeFromQueue(index) {
    this.filter(r => this.findIndex(a => a == r) != index);
  }
}

// GLOBALS
let q = new Queue([]);
const YOUTUBE_API_KEY = "AIzaSyDoVH4SgC4MgqCdclmNM2v27sjUZDgHnAE";
const YOUTUBE_END_POINT = "https://www.googleapis.com/youtube/v3/";
const MUSIC_LIBRARY_DIR = path.join(__dirname, "music");

function searchForVideo(query, maxResult) {
  return new Promise((resolve, reject) => {
    const finalUrl = `${YOUTUBE_END_POINT}search?part=snippet&q=${query}&key=${YOUTUBE_API_KEY}&type=video&maxResults=${maxResult}`;
    console.log("Requesting", finalUrl);
    fetch(finalUrl)
      .then(data => data.json())
      .then(data => resolve(data.items))
      .catch(err => reject(err));
  });
}

function errorDetails(err) {
  if (err.code === 1) {
    return "Error: Format not available or possibly internet error";
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
function serveStatic(filePath, res) {
  if (!fs.existsSync(filePath)) {
    res.writeHead(404);
    console.log("Error 404", filePath);
    res.end(
      JSON.stringify({
        Error: "404 not found",
        ErrorCode: 404
      })
    );
  } else {
    if (fs.lstatSync(filePath).isDirectory()) {
      filePath = path.join(filePath, "index.html");
    }
    const mime = lookup(filePath);
    res.writeHead(200, {
      "Content-Type": mime
    });
    console.log("Serving", filePath, mime);
    res.end(fs.readFileSync(filePath));
  }
}
http
  .createServer((req, res) => {
    if (req.url.match(/api\/add\/[A-Z-a-z-0-9_^\s]{11}/g)) {
      const videoId = req.url.split("/")[3];
      if (q.find(v => v.videoId === videoId)) {
        res.end(
          JSON.stringify({
            Error: `${videoId} already exists in queue`,
            ErrorCode: 1
          })
        );
      } else if (
        fs.existsSync(path.join(MUSIC_LIBRARY_DIR, `${videoId}.mp3`))
      ) {
        res.end(
          JSON.stringify({
            Error: `Already downloaded ${videoId}`,
            ErrorCode: 2
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
    } else if (req.url.match(/api\/cancel\/[A-Z-a-z-0-9_^\s]{11}/g)) {
      const videoId = req.url.split("/")[3];
      if (q.find(v => v.videoId === videoId)) {
        q.removeFromQueue(q.findIndex(v => v.videoId === videoId);
        res.end(
          JSON.stringify({
            Success: `${videoId} removed queue`

          })
        );
    } else if (req.url.match(/api\/info\/[A-Z-a-z-0-9_^\s]{11}/g)) {
      const videoId = req.url.split("/")[3];
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
            Error: `${videoId} does not exist in queue`,
            ErrorCode: 3
          })
        );
      }
    } else if (req.url.match(/api\/search\/[^]+\/[0-9]{1,2}/g)) {
      const query = req.url.split("/")[3];
      const maxResult = req.url.split("/")[4];
      searchForVideo(query, maxResult)
        .then(d => {
          res.end(JSON.stringify(d));
        })
        .catch(err => {
          res.end(
            JSON.stringify({
              Error: `Can't Connect to Youtube: ${err}`,
              ErrorCode: 4
            })
          );
        });
    } else if (req.url.match(/music\/[A-Z-a-z-0-9_^\s]{11}\.mp3/g)) {
      const parsedURL = UrlParse(req.url.toString());
      const filePath = path.join(__dirname, parsedURL.pathname);
      serveStatic(filePath, res);
    } else {
      const parsedURL = UrlParse(req.url.toString());
      const filePath = path.join(__dirname, "static", parsedURL.pathname);
      serveStatic(filePath, res);
    }
  })
  .listen(PORT);
console.log("Listening on localhost:", PORT);
