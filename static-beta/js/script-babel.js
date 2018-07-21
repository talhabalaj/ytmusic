"use strict";

var controller = void 0;
var signal = void 0;
var timeoutManager = void 0;
var loader = "<svg width=\"200px\"  height=\"200px\"  xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 100 100\" preserveAspectRatio=\"xMidYMid\" class=\"lds-eclipse\" style=\"background: none;\"><path ng-attr-d=\"{{config.pathCmd}}\" ng-attr-fill=\"{{config.color}}\" stroke=\"none\" d=\"M10 50A40 40 0 0 0 90 50A40 42 0 0 1 10 50\" fill=\"rgb(202, 29, 29)\" transform=\"rotate(145.714 50 51)\"><animateTransform attributeName=\"transform\" type=\"rotate\" calcMode=\"linear\" values=\"0 50 51;360 50 51\" keyTimes=\"0;1\" dur=\"0.7s\" begin=\"0s\" repeatCount=\"indefinite\"></animateTransform></path></svg>";

var $ = function $(el) {
  return document.querySelector(el);
};
var $$ = function $$(els) {
  return document.querySelectorAll(els);
};

function humanize(n) {
  var number = parseInt(n);
  var name = "B";
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

function searchForVideo(_ref) {
  var query = _ref.query,
      _ref$maxResult = _ref.maxResult,
      maxResult = _ref$maxResult === undefined ? 10 : _ref$maxResult;

  if (controller !== undefined) {
    controller.abort();
  }
  // Feature detect
  if (AbortController) {
    controller = new AbortController();
    signal = controller.signal;
  }

  return new Promise(function (resolve, reject) {
    if (query === "") return reject(Error("EmptyQuery"));
    query = encodeURIComponent(query);
    var url = "/api/search/" + query + "/" + maxResult;
    fetch(url, { signal: signal }).then(function (data) {
      return data.json();
    }).then(function (data) {
      return resolve(data);
    }).catch(function (err) {
      return reject(err);
    });
  });
}
function displayVideos(query) {
  if ($("#results svg") === null) $("#results").innerHTML = "<div class='result-status'>" + loader + "</div>";
  searchForVideo({ query: query }).then(function (data) {
    var response = "";
    var _iteratorNormalCompletion = true;
    var _didIteratorError = false;
    var _iteratorError = undefined;

    try {
      for (var _iterator = data[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
        var result = _step.value;

        response += "\n        <div class='result-container'>\n            <div class=\"img-container\">\n              <div class=\"img-wrapper\">\n                  <img src=\"" + result.snippet.thumbnails.medium.url + "\" alt=\"" + result.id.videoId + "\">\n          </div>\n            </div> \n            <div class=\"details-container\">\n                <h2 class=\"heading-primary\" title=\"" + result.snippet.title + "\">" + (result.snippet.title.slice(0, 30).trim() + "...") + "</h2>\n                <h4 class=\"heading-secondary\">" + result.snippet.channelTitle + "</h4>\n                <p class=\"text-primary video-description\">\n                " + result.snippet.description + "\n                </p>\n                <a href=\"/download/#" + result.id.videoId + "\" class=\"text-center btn\">download</a>\n            </div>                        \n        </div> \n        ";
      }
    } catch (err) {
      _didIteratorError = true;
      _iteratorError = err;
    } finally {
      try {
        if (!_iteratorNormalCompletion && _iterator.return) {
          _iterator.return();
        }
      } finally {
        if (_didIteratorError) {
          throw _iteratorError;
        }
      }
    }

    $("#results").innerHTML = response;
  }).catch(function (err) {
    if (err.message === "EmptyQuery") $("#results").innerHTML = "<div class='result-status'>Search field is empty</div>";
    console.log(err);
  });
}

function displayVideo(data) {
  $("#video-info").innerHTML = "<div class='img-container'><div class=\"img-wrapper\">\n      <img src=\"" + data.snippet.thumbnails.medium.url + "\" alt=\"img\">\n  </div></div>\n  <div class=\"video-details\">\n      <h2 class=\"heading-primary\">" + data.snippet.title + "</h2>\n      <h3 class=\"heading-secondary\">" + data.snippet.channelTitle + "</h3>\n      <p class=\"text-primary\">\n      " + data.snippet.description + "\n      </p>\n  </div>";
}

function updateProgress(videoId) {
  getInfoAboutVideo(videoId).then(function (data) {
    timeoutManager = setTimeout(updateProgress, 1000, videoId);
    if (data.status !== "downloading" && data.status !== "getting-metadata" && data.status !== "waiting") {
      $("#download-status-bar").style.width = "100%";
      $("#download-status").innerHTML = humanize(data.totalSize) + " downloaded";
    } else {
      setStatus("ok", "Downloading...");
      var percent = parseInt(data.downloaded / data.totalSize * 100);
      $("#download-status-bar").style.width = (percent || "0") + "%";
      $("#download-status").innerHTML = humanize(data.downloaded) + "/" + humanize(data.totalSize) + "     " + (percent || "0") + "%";
    }
    if (data.status === "complete") {
      $("#encode-status-bar").style.width = "100%";
      $("#encode-status").innerHTML = "100% complete";
      downloadComplete(videoId);
    } else if (data.status === "encoding") {
      setStatus("ok", "Encoding...");
      var _percent = data.encodedPercent;

      _percent = _percent === undefined ? _percent.toFixed(2) : "0";
      $("#encode-status-bar").style.width = _percent + "%";
      $("#encode-status").innerHTML = _percent + "% complete";
    } else if (data.status === "getting-metadata" || data.status === "waiting") {
      setStatus("ok", "Waiting for download to start...");
    }
  }).catch(function (err) {
    setStatus("error", err.message + " (maybe this cannot be processed)");
  });
}
function downloadComplete(videoId) {
  clearTimeout(timeoutManager);
  setStatus("ok", "Download complete");
  $("#download-button").innerHTML += "<a href=\"/music/" + videoId + ".mp3\" class=\"btn\">download as mp3</a>";
}
function getInfoAboutVideo(videoId) {
  return new Promise(function (resolve, reject) {
    fetch("/api/info/" + videoId).then(function (data) {
      return data.json();
    }).then(function (data) {
      if (data.Error) return reject(Error(data.Error));
      return resolve(data);
    }).catch(function (err) {
      return reject(err);
    });
  });
}

function addToQueue(videoId) {
  return new Promise(function (resolve, reject) {
    fetch("/api/add/" + videoId).then(function (data) {
      return data.json();
    }).then(function (data) {
      if (data.Error) {
        return reject(Error(data.ErrorCode));
      }
      return resolve(true);
    }).catch(function (err) {
      return reject(err);
    });
  });
}

function setStatus() {
  var status = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : "ok";
  var statusMessage = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : "";

  var statusColor = "";
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
