let controller;
let signal;
const loader = `<svg width="200px"  height="200px"  xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid" class="lds-eclipse" style="background: none;"><path ng-attr-d="{{config.pathCmd}}" ng-attr-fill="{{config.color}}" stroke="none" d="M10 50A40 40 0 0 0 90 50A40 42 0 0 1 10 50" fill="rgb(202, 29, 29)" transform="rotate(145.714 50 51)"><animateTransform attributeName="transform" type="rotate" calcMode="linear" values="0 50 51;360 50 51" keyTimes="0;1" dur="0.7s" begin="0s" repeatCount="indefinite"></animateTransform></path></svg>`;

function $(el) {
  return document.querySelector(el);
}

function $$(els) {
  return document.querySelectorAll(els);
}

function searchForVideo({ query, maxResult = 10 }) {
  if (controller !== undefined) {
    controller.abort();
  }
  // Feature detect
  if ("AbortController" in window) {
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
        <div class="result-container">
          <div class="img-container">
            <div class="img-wrapper">
              <img src="${result.snippet.thumbnails.medium.url}" alt="${
          result.snippet.title
        }">
            </div>
          </div>
          <div class="details-container">
            <h2>${result.snippet.title}</h2>
            <p>${result.snippet.description}</p>
            <a href="/download/#${result.id.videoId}" class="btn">Download</a>
          </div>
        </div>`;
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
