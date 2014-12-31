function parseQueryString (queryString) {
  var parts = queryString.split("&");
  var query = {};

  parts.forEach(function (part) {
    var tmp = part.split("=");
    var key = decodeURIComponent(tmp[0]);
    var value = decodeURIComponent(tmp[1]);

    query[key] = value;
  });

  return query;
}

window.addEventListener("load", function () {
  var queryString = window.location.hash.substring(1);
  var query = parseQueryString(queryString);

  window.opener.postMessage(query, "*");

  window.close();
});
