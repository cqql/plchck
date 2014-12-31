var client_id = "239b337b6bb34dc8968801e8646aaa5f";
var client_callback = "http://cqql.github.com/plchck/callback.html";

var Client = function (token) {
  this.token = token;
};

Client.prototype.request = function (method, url) {
  url = "https://api.spotify.com/v1" + url;

  return this.requestRaw(method, url);
};

Client.prototype.requestRaw = function (method, url) {
  var headers = {
    "Authorization": "Bearer " + this.token
  };

  return Q($.ajax({
    type: method,
    url: url,
    headers: headers
  }));
};

var LoginScreen = React.createClass({
  propTypes: {
    onLogin: React.PropTypes.func.isRequired
  },
  componentDidMount: function () {
    window.addEventListener("message", this.handleResult);
  },
  componentWillUnmount: function () {
    window.removeEventListener("message", this.handleResult);
  },
  render: function () {
    return <button onClick={this.login}>Log Into Spotify</button>;
  },
  login: function login () {
    var url = "https://accounts.spotify.com/authorize?" +
          "client_id=" + encodeURIComponent(client_id) + "&" +
          "response_type=token&" +
          "redirect_uri=" + encodeURIComponent(client_callback) + "&" +
          "scope=" + encodeURIComponent("playlist-read-private playlist-modify-public playlist-modify-private");

    window.open(url);
  },
  handleResult: function (event) {
    var response = event.data;

    if (response["access_token"]) {
      this.props.onLogin(response["access_token"]);
    } else {
      alert("Login failed");
    }
  }
});

var PlaylistPicker = React.createClass({
  propTypes: {
    client: React.PropTypes.object.isRequired,
    user_id: React.PropTypes.string.isRequired,
    onSelect: React.PropTypes.func.isRequired
  },
  getInitialState: function () {
    return {
      playlists: []
    };
  },
  componentDidMount: function () {
    var picker = this;
    var url = "/users/" + this.props.user_id + "/playlists";

    this.props.client.request("GET", url).then(function (result) {
      picker.setState({
        playlists: result["items"]
      });
    });
  },
  render: function () {
    var picker = this;
    var items = this.state.playlists.map(function (playlist) {
      return <li onClick={picker.onClick.bind(picker, playlist)}>
        {playlist["name"]}
      </li>;
    });

    return <div>
      <h2>Playlists</h2>
      <ul>{items}</ul>
    </div>;
  },
  onClick: function (playlist) {
    this.props.onSelect(playlist);
  }
});

var PlaylistView = React.createClass({
  propTypes: {
    client: React.PropTypes.object.isRequired,
    user_id: React.PropTypes.string.isRequired,
    playlist: React.PropTypes.object.isRequired
  },
  getInitialState: function () {
    return {
      playlist: null,
      tracks: [],
      users: []
    };
  },
  componentWillMount: function () {
    var view = this;
    var tracks = [];

    // Load all tracks in the playlist

    function loadTracks (url) {
      view.props.client.requestRaw("GET", url).then(function (response) {
        tracks = tracks.concat(response["items"]);

        if (response["next"]) {
          loadTracks(response["next"]);
        } else {
          view.setState({
            tracks: tracks
          }, view.loadUsers);
        }
      });
    }

    loadTracks(this.props.playlist["tracks"]["href"]);
  },
  render: function () {
    var byUser = _.groupBy(this.state.tracks, function (t) {
      return t["added_by"]["href"];
    });

    var stats = this.state.users.map(function (user) {
      var count = 0;

      if (byUser[user["href"]]) {
        count = byUser[user["href"]].length;
      }

      return <li>{user["display_name"]}: {count}/20</li>;
    });

    var byTrack = _.groupBy(this.state.tracks, function (t) {
      return t["track"]["href"];
    });

    var duplicates = _.filter(_.values(byTrack), function (ts) {
      return ts.length > 1;
    });

    var usersByHref = {};

    this.state.users.forEach(function (u) {
      usersByHref[u["href"]] = u;
    });

    var duplicateItems = duplicates.map(function (dups) {
      var track = dups[0]["track"];

      var addedBy = dups.map(function (t) {
        var user = usersByHref[t["added_by"]["href"]];

        if (user) {
          return user["display_name"];
        } else {
          return t["added_by"]["id"];
        }
      }).join(", ");

      var artists = track["artists"].map(function (a) { return a["name"]; }).join(", ");

      return <li>{dups.length}x {track["name"]} - {artists} ({addedBy})</li>;
    });

    return <div>
      <h2>{this.props.playlist["name"]}</h2>
      <ul>{stats}</ul>
      <ul>{duplicateItems}</ul>
      </div>;
  },
  loadUsers: function () {
    var view = this;

    var userLinks = _.uniq(this.state.tracks.map(function (track) {
      return track["added_by"]["href"];
    }));

    var users = Q.all(userLinks.map(function (link) {
      return view.props.client.requestRaw("GET", link);
    }));

    users.then(function (us) {
      view.setState({ users: us });
    });
  }
});

var App = React.createClass({
  getInitialState: function () {
    return {
      client: null,
      user: null,
      playlist: null
    };
  },
  render: function () {
    if (this.state.client === null) {
      return <LoginScreen onLogin={this.onLogin} />;
    } else if (this.state.playlist === null) {
      return <PlaylistPicker client={this.state.client} user_id={this.state.user["id"]} onSelect={this.onSelectPlaylist} />;
    } else {
      return <PlaylistView client={this.state.client} user_id={this.state.user["id"]} playlist={this.state.playlist} />;
    }
  },
  onLogin: function (token) {
    var app = this;
    var client = new Client(token);

    client.request("GET", "/me").then(function (user) {
      app.setState({
        client: client,
        user: user
      });
    });
  },
  onSelectPlaylist: function (playlist) {
    this.setState({
      playlist: playlist
    });
  }
});

$(function () {
  var element = <App />;
  var container = document.getElementById("container");

  React.render(element, container);
});
