let controller;
let signal;
let timeoutManager;
const loader = `<svg width="200px"  height="200px"  xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid" class="lds-eclipse" style="background: none;"><path ng-attr-d="{{config.pathCmd}}" ng-attr-fill="{{config.color}}" stroke="none" d="M10 50A40 40 0 0 0 90 50A40 42 0 0 1 10 50" fill="rgb(202, 29, 29)" transform="rotate(145.714 50 51)"><animateTransform attributeName="transform" type="rotate" calcMode="linear" values="0 50 51;360 50 51" keyTimes="0;1" dur="0.7s" begin="0s" repeatCount="indefinite"></animateTransform></path></svg>`;

const $ = el => document.querySelector(el);
const $$ = els => document.querySelectorAll(els);

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
function displayVideos(query) {
  if ($("#results svg") === null)
    $("#results").innerHTML = `<div class='result-status'>${loader}</div>`;
  searchForVideo({ query })
    .then(data => {
      let response = "";
      for (const result of data) {
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
                <h2 class="heading-primary">${result.snippet.title}</h2>
                <h4 class="heading-secondary">${
                  result.snippet.channelTitle
                }</h4>
                <p class="margin-top-sml text-primary">
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
  $("#video-info").innerHTML = `<div class="img-wrapper">
      <img src="${data.snippet.thumbnails.medium.url}" alt="img">
  </div>
  <div class="video-details">
      <h2 class="heading-primary">${data.snippet.title}</h2>
      <h3 class="heading-secondary">${data.snippet.channelTitle}</h3>
      <p class="text-primary">
      ${data.snippet.description}
      </p>
  </div>`;
}

function updateProgress(videoId) {
  getInfoAboutVideo(videoId)
    .then(data => {
      timeoutManager = setTimeout(updateProgress, 1000, videoId);
      if (data.status === "getting-metadata") {
        setStatus("ok", "getting metadata");
      } else if (data.status === "downloading") {
        const percent = parseInt((data.downloaded / data.totalSize) * 100);
        $("#download-status-bar").style.width = `${percent}%`;
        $("#download-status").innerHTML = `${data.downloaded}/${
          data.totalSize
        }     ${percent}%`;
      } else if (data.status === "encoding") {
        $("#download-status-bar").style.width = `100%`;
        $("#download-status").innerHTML = `${data.totalSize} downloaded`;
        let { encodedPercent: percent } = data;
        percent = parseInt(percent);
        $("#encoding-status-bar").style.width = `${percent}%`;
        $("#encoding-status").innerHTML = `${percent}%`;
      } else if (data.status === "complete") {
        $("#download-status-bar").style.width = `100%`;
        $("#download-status").innerHTML = `${data.totalSize}B downloaded`;
        $("#encode-status-bar").style.width = `100%`;
        $("#encoding-status").innerHTML = `100% complete`;
        downloadComplete(videoId);
      }
    })
    .catch(err => {
      throw err;
    });
}
function downloadComplete(videoId) {
  clearTimeout(timeoutManager);
  setStatus("ok", "Download complete");
  $(
    "#download-button"
  ).innerHTML += `<a href="/music/${videoId}.mp3" class="btn">download as mp3</a>`;
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
