let controller;
let signal;
let timeoutManager;
const loader = `<svg width="200px"  height="200px"  xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid" class="lds-eclipse" style="background: none;"><path ng-attr-d="{{config.pathCmd}}" ng-attr-fill="{{config.color}}" stroke="none" d="M10 50A40 40 0 0 0 90 50A40 42 0 0 1 10 50" fill="rgb(202, 29, 29)" transform="rotate(145.714 50 51)"><animateTransform attributeName="transform" type="rotate" calcMode="linear" values="0 50 51;360 50 51" keyTimes="0;1" dur="0.7s" begin="0s" repeatCount="indefinite"></animateTransform></path></svg>`;

const $ = el => document.querySelector(el);
const $$ = els => document.querySelectorAll(els);

function humanize(n) {
  let number = parseInt(n);
  let name = "B";
  if (number > 1024) {
    number /= 1024;
    name = "kB";
    if (number > 1024) {
      number /= 1024;
      name = "MB";
      if (number > 1024) {
        number /= 1024;
        name = "GB";
      }
    }
  }
  return number.toFixed(2) + name;
}

function searchForVideo({ query, maxResult = 10 }) {
  if (controller !== undefined) {
    controller.abort();
  }
  // Feature detect
  if (AbortController) {
    controller = new AbortController();
    signal = controller.signal;
  }

  return new Promise((resolve, reject) => {
    if (query === "") return reject(Error("EmptyQuery"));
    query = encodeURIComponent(query);
    const url = `/api/search/${query}/${maxResult}`;
    fetch(url, { signal })
      .then(data => data.json())
      .then(data => resolve(data))
      .catch(err => reject(err));
  });
}

function getVideoDetails(videoId) {
  return new Promise((resolve, reject) => {
    const url = `/api/youtube/${videoId}`;
    fetch(url, { signal })
      .then(data => data.json())
      .then(data => resolve(data))
      .catch(err => reject(err));
  });
}

function displayVideos(query) {
  if ($("#results svg") === null)
    $("#results").innerHTML = `<div class='result-status'>${loader}</div>`;
  searchForVideo({ query })
    .then(data => {
      let response = "";
      for (const result of data.items) {
        response += `
        <div class='result-container'>
            <div class="img-container">
              <div class="img-wrapper">
                  <img src="${result.snippet.thumbnails.medium.url}" alt="${
          result.id.videoId
        }">
          </div>
            </div> 
            <div class="details-container">
                <h2 class="heading-primary" title="${
                  result.snippet.title
                }">${`${result.snippet.title.slice(0, 30).trim()}...`}</h2>
                <h4 class="heading-secondary">${
                  result.snippet.channelTitle
                }</h4>
                <p class="text-primary video-description">
                ${result.snippet.description}
                </p>
                <a href="/download/#${
                  result.id.videoId
                }" class="text-center btn">download</a>
            </div>                        
        </div> 
        `;
      }
      $("#results").innerHTML = response;
    })
    .catch(err => {
      if (err.message === "EmptyQuery")
        $(
          "#results"
        ).innerHTML = `<div class='result-status'>Search field is empty</div>`;
      console.log(err);
    });
}

function displayVideo(data) {
  $(
    "#video-info"
  ).innerHTML = `<div class='img-container'><div class="img-wrapper">
      <img src="${data.snippet.thumbnails.maxres.url}" alt="img">
  </div></div>
  <div class="video-details">
      <h2 class="heading-primary">${data.snippet.title}</h2>
      <h3 class="heading-secondary">${data.snippet.channelTitle}</h3>
      <p class="text-primary">
      ${data.snippet.description.slice(0, 500).trim()}...
      <div id='videoDownloadLink'>
      <svg width="50px"  height="50px"  xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid" class="lds-eclipse" style="background: none;"><path ng-attr-d="{{config.pathCmd}}" ng-attr-fill="{{config.color}}" stroke="none" d="M10 50A40 40 0 0 0 90 50A40 42 0 0 1 10 50" fill="rgb(202, 29, 29)" transform="rotate(145.714 50 51)"><animateTransform attributeName="transform" type="rotate" calcMode="linear" values="0 50 51;360 50 51" keyTimes="0;1" dur="0.7s" begin="0s" repeatCount="indefinite"></animateTransform></path></svg></div>
      </p>
  </div>`;
  getVideoLink(data.id, data.snippet.title);
}
function getVideoLink(videoId, videoTitle) {
  fetch(`/api/videoDownload/${videoId}`)
    .then(data => data.json())
    .then(data => {
      $("#videoDownloadLink").innerHTML = `
      <a href='${
        data.downloadUrl
      }' class='btn' download='${videoTitle}'>download the video</a>
      `;
    })
    .catch(err => {
      throw err;
    });
}
function updateProgress(videoId) {
  getInfoAboutVideo(videoId)
    .then(data => {
      timeoutManager = setTimeout(updateProgress, 1000, videoId);
      if (
        data.status !== "downloading" &&
        data.status !== "getting-metadata" &&
        data.status !== "waiting"
      ) {
        $("#download-status-bar").style.width = `100%`;
        $("#download-status").innerHTML = `${humanize(
          data.totalSize
        )} downloaded`;
      } else {
        setStatus("ok", "Downloading...");
        const percent = parseInt((data.downloaded / data.totalSize) * 100);
        $("#download-status-bar").style.width = `${percent || `0`}%`;
        $("#download-status").innerHTML = `${humanize(
          data.downloaded
        )}/${humanize(data.totalSize)}     ${percent || `0`}%`;
      }
      if (data.status === "complete") {
        $("#encode-status-bar").style.width = `100%`;
        $("#encode-status").innerHTML = `100% complete`;
        clearTimeout(timeoutManager);
        setStatus("ok", "Download complete");
        $("#download-button").innerHTML += `
        <audio src='/music/${videoId}.mp3' id='player' class='margin-top-med' controls>not supported boi? you have a life?</audio>
        <a href="/music/${videoId}.mp3" download='${
          data.videoTitle
        }.mp3' class="btn">download as mp3</a>
        `;
        visualizerInit();
      } else if (data.status === "encoding") {
        setStatus("ok", "Encoding...");
        let { encodedPercent: percent } = data;
        percent = percent !== undefined ? percent.toFixed(2) : "0";
        $("#encode-status-bar").style.width = `${percent}%`;
        $("#encode-status").innerHTML = `${percent}% complete`;
      } else if (
        data.status === "getting-metadata" ||
        data.status === "waiting"
      ) {
        setStatus("ok", "Waiting for download to start...");
      }
    })
    .catch(err => {
      setStatus("error", `${err.message}`);
    });
}
function visualizerInit() {
  const audio = $("#player");
  const context = new (window.AudioContext || window.webkitAudioContext)();
  const src = context.createMediaElementSource(audio);
  const analyser = context.createAnalyser();
  src.connect(analyser);
  analyser.connect(context.destination);
  analyser.fftSize = 256;
  const bufferLength = analyser.frequencyBinCount;
  const dataArray = new Uint8Array(bufferLength);
  audio.onplay = function() {
    (function colorUpdate() {
      analyser.getByteFrequencyData(dataArray);
      const r = dataArray[0];
      const g = dataArray[64];
      const b = dataArray[127];
      const color = `rgb(${r}, ${g}, ${b})`;
      document.documentElement.style.setProperty("--color-primary", color);
      setTimeout(colorUpdate, 1);
    })();
  };
}
function getInfoAboutVideo(videoId) {
  return new Promise((resolve, reject) => {
    fetch(`/api/info/${videoId}`)
      .then(data => data.json())
      .then(data => {
        if (data.Error) return reject(Error(data.Error));
        return resolve(data);
      })
      .catch(err => reject(err));
  });
}

function addToQueue(videoId) {
  return new Promise((resolve, reject) => {
    fetch(`/api/add/${videoId}`)
      .then(data => data.json())
      .then(data => {
        if (data.Error) {
          return reject(Error(data.ErrorCode));
        }
        return resolve(true);
      })
      .catch(err => reject(err));
  });
}

function setStatus(status = "ok", statusMessage = "") {
  let statusColor = "";
  if (status === "warn") {
    statusColor = "#fe0";
  } else if (status === "error") {
    statusColor = "#d00";
  } else {
    statusColor = "#070";
  }
  $("#status").style.color = statusColor;
  $("#status").textContent = statusMessage;
}
