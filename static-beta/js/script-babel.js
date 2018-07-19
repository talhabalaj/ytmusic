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

        response += "\n        <div class='result-container'>\n            <div class=\"img-container\">\n              <div class=\"img-wrapper\">\n                  <img src=\"" + result.snippet.thumbnails.medium.url + "\" alt=\"" + result.id.videoId + "\">\n          </div>\n            </div> \n            <div class=\"details-container\">\n                <h2 class=\"heading-primary\">" + result.snippet.title + "</h2>\n                <h4 class=\"heading-secondary\">" + result.snippet.channelTitle + "</h4>\n                <p class=\"margin-top-sml text-primary\">\n                " + result.snippet.description + "\n                </p>\n                <a href=\"/download/#" + result.id.videoId + "\" class=\"text-center btn\">download</a>\n            </div>                        \n        </div> \n        ";
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
  $("#video-info").innerHTML = "<div class=\"img-wrapper\">\n      <img src=\"" + data.snippet.thumbnails.medium.url + "\" alt=\"img\">\n  </div>\n  <div class=\"video-details\">\n      <h2 class=\"heading-primary\">" + data.snippet.title + "</h2>\n      <h3 class=\"heading-secondary\">" + data.snippet.channelTitle + "</h3>\n      <p class=\"text-primary\">\n      " + data.snippet.description + "\n      </p>\n  </div>";
}

function updateProgress(videoId) {
  getInfoAboutVideo(videoId).then(function (data) {
    timeoutManager = setTimeout(updateProgress, 1000, videoId);
    if (data.status === "getting-metadata") {
      setStatus("ok", "getting metadata");
    } else if (data.status === "downloading") {
      var percent = parseInt(data.downloaded / data.totalSize * 100);
      $("#download-status-bar").style.width = percent + "%";
      $("#download-status").innerHTML = data.downloaded + "/" + data.totalSize + "     " + percent + "%";
    } else if (data.status === "encoding") {
      $("#download-status-bar").style.width = "100%";
      $("#download-status").innerHTML = data.totalSize + " downloaded";
      var _percent = data.encodedPercent;

      _percent = parseInt(_percent);
      $("#encoding-status-bar").style.width = _percent + "%";
      $("#encoding-status").innerHTML = _percent + "%";
    } else if (data.status === "complete") {
      $("#download-status-bar").style.width = "100%";
      $("#download-status").innerHTML = data.totalSize + "B downloaded";
      $("#encode-status-bar").style.width = "100%";
      $("#encoding-status").innerHTML = "100% complete";
      downloadComplete(videoId);
    }
  }).catch(function (err) {
    throw err;
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
