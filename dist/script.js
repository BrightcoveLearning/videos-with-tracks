var BCLS = (function (window, document) {
  var account_id,
    client_id,
    client_secret,
    // api stuff
    proxyURL =
      "https://solutions.brightcove.com/bcls/bcls-proxy/bcls-proxy-v2.php",
    baseURL = "https://cms.api.brightcove.com/v1/accounts/",
    limit = 25,
    totalVideos = 0,
    totalCalls = 0,
    callNumber = 0,
    videosCompleted = 0,
    videosArray = [],
    summaryData = {},
    csvStr,
    summaryCsvStr,
    customFields = [],
    // elements
    account_id_element = document.getElementById("account_id"),
    client_id_element = document.getElementById("client_id"),
    client_secret_element = document.getElementById("client_secret"),
    start_offset = document.getElementById("start_offset"),
    videoCount = document.getElementById("videoCount"),
    makeReport = document.getElementById("makeReport"),
    content,
    logger = document.getElementById("logger"),
    logText = document.getElementById("logText"),
    apiRequest = document.getElementById("apiRequest"),
    allButtons = document.getElementsByName("button"),
    pLogGettingVideos = document.createElement("p"),
    pLogFinish = document.createElement("p"),
    spanIntro2 = document.createElement("span"),
    spanOf2 = document.createElement("span"),
    no_text_tracks_csv = document.getElementById("no_text_tracks_csv"),
    text_track_csv = document.getElementById("text_track_csv"),
    no_text_tracks_table = document.getElementById("no_text_tracks_table"),
    text_track_table = document.getElementById("text_track_table"),
    first_offset,
    videos_with_tracks = [],
    videos_without_tracks = [],
    number_of_tracks = 0,
    languages = [],
    kinds = [];

  /**
   * tests for all the ways a variable might be undefined or not have a value
   * @param {String|Number} x the variable to test
   * @return {Boolean} true if variable is defined and has a value
   */
  function isDefined(x) {
    if (x === "" || x === null || x === undefined) {
      return false;
    }
    return true;
  }

  /*
   * tests to see if a string is json
   * @param {String} str string to test
   * @return {Boolean}
   */
  function isJson(str) {
    try {
      JSON.parse(str);
    } catch (e) {
      return false;
    }
    return true;
  }

  /**
   * get selected value for single select element
   * @param {htmlElement} e the select element
   */
  function getSelectedValue(e) {
    return e.options[e.selectedIndex].value;
  }

  /**
   * disables all buttons so user can't submit new request until current one finishes
   */
  function disableButtons() {
    var i,
      iMax = allButtons.length;
    for (i = 0; i < iMax; i++) {
      allButtons[i].setAttribute("disabled", "disabled");
    }
  }

  /**
   * re-enables all buttons
   */
  function enableButtons() {
    var i,
      iMax = allButtons.length;
    for (i = 0; i < iMax; i++) {
      allButtons[i].removeAttribute("disabled");
    }
  }

  function writeReport(videos, tableEl, csvEl) {
    var i,
      iMax,
      video,
      tr,
      td,
      frag = document.createDocumentFragment(),
      csvStr;
    if (csvEl === text_track_csv) {
      csvStr = '"ID","Name","Number of Tracks","Languages","Kinds"\r\n';
    } else {
      csvStr = '"ID","Name"\r\n';
    }
    if (videos.length > 0) {
      iMax = videos.length;
      for (i = 0; i < iMax; i += 1) {
        video = videos[i];
        // add csv row
        if (csvEl === text_track_csv) {
          csvStr +=
            '"' +
            video.id +
            '","' +
            video.name +
            '","' +
            video.number_of_tracks +
            '","' +
            video.languages +
            '","' +
            video.kinds +
            '"\r\n';
          // add table row
          tr = document.createElement("tr");
          td = document.createElement("td");
          td.textContent = video.id;
          tr.appendChild(td);
          td = document.createElement("td");
          td.textContent = video.name;
          tr.appendChild(td);
          td = document.createElement("td");
          td.textContent = video.number_of_tracks;
          tr.appendChild(td);
          td = document.createElement("td");
          td.textContent = video.languages;
          tr.appendChild(td);
          td = document.createElement("td");
          td.textContent = video.kinds;
          tr.appendChild(td);
          frag.appendChild(tr);
        } else {
          csvStr += '"' + video.id + '","' + video.name + '"\r\n';
          // add table row
          tr = document.createElement("tr");
          td = document.createElement("td");
          td.textContent = video.id;
          tr.appendChild(td);
          td = document.createElement("td");
          td.textContent = video.name;
          tr.appendChild(td);
          frag.appendChild(tr);
        }
      }
      csvEl.textContent += csvStr;
      tableEl.appendChild(frag);
    } else {
      csvEl.textContent = "No videos in this category";
    }
    return;
  }

  function processVideos(videos) {
    var i, iMax, j, jMax, obj, video, track;
    iMax = videos.length;
    for (i = 0; i < iMax; i++) {
      obj = {};
      number_of_tracks = 0;
      languages = [];
      kinds = [];
      video = videos[i];
      if (video.text_tracks && video.text_tracks.length > 0) {
        obj.id = video.id;
        obj.name = video.name;
        obj.number_of_tracks = video.text_tracks.length.toString();
        jMax = video.text_tracks.length;
        for (j = 0; j < jMax; j++) {
          track = video.text_tracks[j];
          if (track.srclang) {
            languages.push(track.srclang);
          } else if (track.label) {
            languages.push(track.label);
          } else {
            languages = "unknown";
          }
          if (track.kind) {
            kinds.push(track.kind);
          } else {
            kinds = "unknown";
          }
        }
        obj.languages = languages.join("; ");
        obj.kinds = kinds.join("; ");
        videos_with_tracks.push(obj);
      } else {
        obj.id = video.id;
        obj.name = video.name;
        videos_without_tracks.push(obj);
      }
    }
    writeReport(videos_with_tracks, text_track_table, text_track_csv);
    writeReport(
      videos_without_tracks,
      no_text_tracks_table,
      no_text_tracks_csv
    );
    logText.textContent = "Finished! See the reports below.";
    enableButtons();
  }

  /**
   * sets up the data for the API request
   * @param {String} id the id of the button that was clicked
   */
  function createRequest(id) {
    var endPoint = "",
      parsedData,
      options = {};
    options.proxyURL = proxyURL;
    options.account_id = account_id;
    if (isDefined(client_id) && isDefined(client_secret)) {
      options.client_id = client_id;
      options.client_secret = client_secret;
    }
    // disable buttons to prevent a new request before current one finishes
    disableButtons();
    switch (id) {
      case "getCount":
        endPoint = account_id + "/counts/videos?sort=created_at";
        options.url = baseURL + endPoint;
        options.requestType = "GET";
        apiRequest.textContent = options.url;
        makeRequest(options, function (response) {
          parsedData = JSON.parse(response);
          // set total videos
          video_count = parsedData.count;
          if (totalVideos === "All") {
            totalVideos = video_count;
          } else {
            totalVideos = totalVideos < video_count ? totalVideos : video_count;
          }
          totalCalls = Math.ceil(totalVideos / limit);
          logText.textContent =
            totalVideos + " videos found; getting videos...";
          createRequest("getVideos");
        });
        break;
      case "getVideos":
        var offset;
        if (isDefined(first_offset)) {
          offset = first_offset;
          first_offset = null;
        } else {
          offset = limit * callNumber;
        }
        endPoint =
          account_id +
          "/videos?sort=created_at&limit=" +
          limit +
          "&offset=" +
          offset;
        options.url = baseURL + endPoint;
        options.requestType = "GET";
        apiRequest.textContent = options.url;
        makeRequest(options, function (response) {
          parsedData = JSON.parse(response);
          videosArray = videosArray.concat(parsedData);
          callNumber++;
          if (callNumber < totalCalls) {
            logText.textContent =
              "Getting video " + (callNumber + 1) + " of " + totalVideos;
            createRequest("getVideos");
          } else {
            logText.textContent = "Videos retrieved; processing... ";
            processVideos(videosArray);
          }
        });
        break;
    }
  }

  /**
   * send API request to the proxy
   * @param  {Object} options for the request
   * @param  {String} options.url the full API request URL
   * @param  {String="GET","POST","PATCH","PUT","DELETE"} requestData [options.requestType="GET"] HTTP type for the request
   * @param  {String} options.proxyURL proxyURL to send the request to
   * @param  {String} options.client_id client id for the account (default is in the proxy)
   * @param  {String} options.client_secret client secret for the account (default is in the proxy)
   * @param  {JSON} [options.requestBody] Data to be sent in the request body in the form of a JSON string
   * @param  {Function} [callback] callback function that will process the response
   */
  function makeRequest(options, callback) {
    var httpRequest = new XMLHttpRequest(),
      response,
      requestParams,
      dataString,
      proxyURL = options.proxyURL,
      // response handler
      getResponse = function () {
        try {
          if (httpRequest.readyState === 4) {
            if (httpRequest.status >= 200 && httpRequest.status < 300) {
              response = httpRequest.responseText;
              // some API requests return '{null}' for empty responses - breaks JSON.parse
              if (response === "") {
                response = null;
              }
              // return the response
              callback(response);
            } else {
              logger.appendChild(
                document.createTextNode(
                  "There was a problem with the request. Request returned " +
                    httpRequest.status
                )
              );
            }
          }
        } catch (e) {
          logger.appendChild(document.createTextNode("Caught Exception: " + e));
        }
      };
    /**
     * set up request data
     * the proxy used here takes the following request body:
     * JSON.stringify(options)
     */
    // set response handler
    httpRequest.onreadystatechange = getResponse;
    // open the request
    httpRequest.open("POST", proxyURL);
    // open and send request
    httpRequest.send(JSON.stringify(options));
  }

  function init() {
    // event listeners
    no_text_tracks_csv.addEventListener("click", function () {
      this.select();
    });
    text_track_csv.addEventListener("click", function () {
      this.select();
    });

    // button event handlers
    makeReport.addEventListener("click", function () {
      // in case of re-run, clear the results
      no_text_tracks_csv.textContent = "";
      text_track_csv.textContent = "";
      // get the inputs
      client_id = client_id_element.value;
      client_secret = client_secret_element.value;
      account_id = isDefined(account_id_element.value)
        ? account_id_element.value
        : "1752604059001";
      totalVideos = getSelectedValue(videoCount);
      first_offset = start_offset.value;
      // only use entered account id if client id and secret are entered also
      if (
        !isDefined(client_id) ||
        !isDefined(client_secret) ||
        !isDefined(account_id)
      ) {
        logger.appendChild(
          document.createTextNode(
            "To use your own account, you must specify an account id, and client id, and a client secret - since at least one of these is missing, a sample account will be used"
          )
        );
        account_id = "1752604059001";
      }
      // get video count
      createRequest("getCount");
    });
  }

  init();
})(window, document);