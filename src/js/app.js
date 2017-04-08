function getQueryVariable(variable) {
  var query = window.location.search.substring(1);
  var vars = query.split('&');
  for (var i = 0; i < vars.length; i++) {
    var pair = vars[i].split('=');
    if (decodeURIComponent(pair[0]) === variable) {
      return decodeURIComponent(pair[1]);
    }
  }
}

function hexToRgb(hex) {
  var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
}

window.App = {
  elements: {
    board: $("#board"),
    palette: $(".palette"),
    boardMover: $(".board-mover"),
    boardZoomer: $(".board-zoomer"),
    boardContainer: $(".board-container"),
    cursor: $(".cursor"),
    timer: $(".cooldown-timer"),
    reticule: $(".reticule"),
    alert: $(".message"),
    coords: $(".coords"),

    chatContainer: $('.chat-container'),
    usersContainer: $('.users-container'),
    loginContainer: $('.login-container'),
    usersToggle: $('.toggle-users'),

    chatToggle: $('.toggle-chat'),
    usersToggle: $('.toggle-users'),
    loginToggle: $('.toggle-login'),

    loginButton: $('.login-button'),
    chatInput: $('.chat-input'),
  },
  panX: 0,
  panY: 0,
  scale: 4,
  cooldown: 0,
  init: function () {
    this.color = -1;
    this.connectionLost = false;
    this.username = null;
    this.session_id = null;
    this.session_key = null;
    this.spectate_user = null;

    $(".board-container").hide();
    $(".reticule").hide();
    $(".ui").hide();
    $('.message').hide();
    $(".cursor").hide();
    $(".cooldown-timer").hide();
    this.elements.usersToggle.hide();

    $.get("/boardinfo", this.initBoard.bind(this));

    this.initBoardMovement();
    this.initBoardPlacement();
    this.initCursor();
    this.initReticule();
    this.initAlert();
    this.initCoords();
    this.initSidebar();
    this.initMoveTicker();
    //Notification.requestPermission();
  },
  initBoard: function (data) {
    this.width = data.width;
    this.height = data.height;
    this.palette = data.palette;

    this.initPalette();

    this.elements.board.attr("width", this.width).attr("height", this.height);

    this.updateTransform();

    var cx = getQueryVariable("x") || this.width / 2;
    var cy = getQueryVariable("y") || this.height / 2;
    this.centerOn(cx, cy);

    this.scale = getQueryVariable("scale") || this.scale;
    this.updateTransform();

    this.initSocket();
    jQuery.get("/boarddata", this.drawBoard.bind(this));
  },
  drawBoard: function (data) {
    var ctx = this.elements.board[0].getContext("2d");

    var imageData = new ImageData(this.width, this.height);
    var buffer = new Uint32Array(imageData.data.buffer);
    var imageDataLen = this.width * this.height;

    var rgbPalette = this.palette.map(function (c) {
      var rgb = hexToRgb(c);
      return 0xff000000 | rgb.b << 16 | rgb.g << 8 | rgb.r;
    });

    for (var i = 0; i < imageDataLen; i++) {
      buffer[i] = rgbPalette[data.charCodeAt(i)];
    }

    ctx.putImageData(imageData, 0, 0);
  },
  initPalette: function () {
    this.palette.forEach(function (color, idx) {
      $("<div>")
        .addClass("palette-color")
        .css("background-color", color)
        .click(function () {
          if (this.cooldown === 0) {
            this.switchColor(idx);
          } else {
            this.switchColor(-1);
          }
        }.bind(this))
        .appendTo(this.elements.palette);
    }.bind(this));
  },
  initBoardMovement: function () {
    var dragX = 0;
    var dragY = 0;
    var down = false;

    $(document).on('keydown', function (evt) {
      if (evt.target.nodeName === 'BODY') {
        if (evt.keyCode === 87 || evt.keyCode === 38) {
          // Up movement, up arrow or w
          this.panY += 100 / this.scale;
        } else if (evt.keyCode === 83 || evt.keyCode === 40) {
          // Down movement, down arrow or s
          this.panY -= 100 / this.scale;
        } else if (evt.keyCode === 65 || evt.keyCode === 37) {
          // Left movement, left arrow or a
          this.panX += 100 / this.scale;
        } else if (evt.keyCode === 68 || evt.keyCode === 39) {
          // Right movement, right arrow or d
          this.panX -= 100 / this.scale;
        } else if (evt.keyCode === 81 || evt.keyCode === 34) {
          // Zoom out, q key or page down
          this.scale /= 1.3;
          this.scale = Math.min(40, Math.max(0.7, this.scale));
        } else if (evt.keyCode === 69 || evt.keyCode === 33) {
          // Zoom in, e key or page up
          this.scale *= 1.3;
          this.scale = Math.min(40, Math.max(0.7, this.scale));
        }

        this.updateTransform();
      }
    }.bind(this));

    this.elements.boardContainer.on("mousedown", function (evt) {
      this.spectate_user = null;
      this.alert(null);
      dragX = evt.screenX;
      dragY = evt.screenY;
      down = true;
    }.bind(this)).on("mousemove", function (evt) {
      if (!down) return;
      var dx = evt.screenX - dragX,
        dy = evt.screenY - dragY;
      this.panX += dx / this.scale;
      this.panY += dy / this.scale;
      dragX = evt.screenX;
      dragY = evt.screenY;

      this.updateTransform()
    }.bind(this)).on("mouseup", function (evt) {
      down = false;
    }.bind(this)).on("mouseout", function (evt) {
      down = false;
    }.bind(this)).on("wheel", function (evt) {
      var oldScale = this.scale;

      if (evt.originalEvent.deltaY > 0) {
        this.scale /= 1.3
      } else {
        this.scale *= 1.3;
      }

      this.scale = Math.min(40, Math.max(0.7, this.scale));

      var dx = evt.clientX - this.elements.boardContainer.width() / 2;
      var dy = evt.clientY - this.elements.boardContainer.height() / 2;

      this.panX -= dx / oldScale;
      this.panX += dx / this.scale;

      this.panY -= dy / oldScale;
      this.panY += dy / this.scale;

      this.updateTransform();
    }.bind(this));
  },
  initBoardPlacement: function () {
    var downX, downY;

    this.elements.board.on("mousedown", function (evt) {
      downX = evt.clientX;
      downY = evt.clientY;
    }).on("click", function (evt) {
      if (downX === evt.clientX && downY === evt.clientY && this.color !== -1 && this.cooldown === 0) {
        var pos = this.screenToBoardSpace(evt.clientX, evt.clientY);
        this.place(pos.x, pos.y);
      }
    }.bind(this)).contextmenu(function (evt) {
      evt.preventDefault();
      this.switchColor(-1);
    }.bind(this));
  },
  initCursor: function () {
    $(document.body).on("mousemove", function (evt) {
      this.elements.cursor.css("transform", "translate(" + evt.clientX + "px, " + evt.clientY + "px)");
    }.bind(this));
  },
  initReticule: function () {
    this.elements.board.on("mousemove", function (evt) {
      var boardPos = this.screenToBoardSpace(evt.clientX, evt.clientY);
      boardPos.x |= 0;
      boardPos.y |= 0;

      var screenPos = this.boardToScreenSpace(boardPos.x, boardPos.y);
      this.elements.reticule.css("transform", "translate(" + screenPos.x + "px, " + screenPos.y + "px)");
      this.elements.reticule.css("width", this.scale + "px").css("height", this.scale + "px");

      if (this.color === -1) {
        this.elements.reticule.hide();
      } else {
        this.elements.reticule.show();
      }
    }.bind(this));
  },
  initCoords: function () {
    this.elements.board.on("mousemove", function (evt) {
      var boardPos = this.screenToBoardSpace(evt.clientX, evt.clientY);

      this.elements.coords.text("(" + boardPos.x + ", " + boardPos.y + ")");
    }.bind(this));
  },
  initAlert: function () {
    this.elements.alert.find(".close").click(function () {
      this.elements.alert.fadeOut(200);
    }.bind(this));
  },
  forceSync: function () {
    jQuery.get("/boarddata", this.drawBoard.bind(this));
  },
  initSocket: function () {
    var l = window.location;
    var url = ((l.protocol === "https:") ? "wss://" : "ws://") + l.host + "/ws";
    var ws = new WebSocket(url);
    this.socket = ws;

    ws.onopen = function () {
      $(".board-container").show();
      $(".ui").show();
      $(".loading").fadeOut(500);

      this.elements.alert.fadeOut(200);
      if (this.connectionLost) {
        jQuery.get("/boarddata", this.drawBoard.bind(this));
        if (this.session_key != null) {
          ws.send(JSON.stringify({
            type: 'reauth',
            username: this.username,
            session_key: this.session_key
          }));
        }
      }
    }.bind(this);

    ws.onmessage = function (msg) {
      var data = JSON.parse(msg.data);
      if (data.type === 'session') {
        this.session_id = data.session_id;
        this.updateUserCount(data.users.length);
        var userList = $('.user-list');
        userList.empty();
        data.users.forEach(function (user) {
          $('<li>', { class: 'username' }).text(user).appendTo(userList);
        });
      } else if (data.type === "pixel") {
        var ctx = this.elements.board[0].getContext("2d");
        ctx.fillStyle = this.palette[data.color];
        ctx.fillRect(data.x, data.y, 1, 1);

        var moveTickerBody = $('.move-ticker-body');
        if (moveTickerBody.is(':visible')) {
          var div = $('<div>', { 'class': 'chat-line' }).appendTo(moveTickerBody);
          $('<span>', { "class": 'username' }).text(data.session_id).appendTo(div);
          $('<span>').text(': ').appendTo(div);
          $('<a>', { href: 'javascript:App.centerOn(' + data.x + ',' + data.y + ')' }).text(data.x + ', ' + data.y).appendTo(div);
          moveTickerBody.scrollTop(moveTickerBody.prop('scrollHeight'));
          if (moveTickerBody.children().length >= 25) {
            moveTickerBody.find('.chat-line:first').remove();
          }
        }

        if (this.spectate_user !== null && this.spectate_user === data.session_id) {
          this.centerOn(data.x, data.y);
        }
      } else if (data.type === "alert") {
        this.alert(data.message);
      } else if (data.type === "cooldown") {
        this.cooldown = Math.ceil(data.wait) + 1;
        this.updateTime();
      } else if (data.type === 'chat') {
        var d = $('.chat-log');
        var div = $('<div>', { 'class': 'chat-line' }).appendTo(d);
        $('<span>', { "class": 'username' }).text(data.chat_id).appendTo(div);
        var message = $('<span>', { "class": 'chat-message' }).text(': ' + data.message);

        var re = /([0-9]+)+\,(\ +)?([0-9]+)/g;
        var m;

        do {
          m = re.exec(data.message);
          if (m) {
            var coords = m[0].split(',');
            if(coords[0] < 0 || coords[0] > this.width || coords[1] < 0 || coords[1] > this.height) continue;
            var coordDiv = $('<a>', { class: '', href: 'javascript:App.centerOn(' + coords[0] + ',' + coords[1] + ')' }).text(m[0]).prop('outerHTML');
            message.html(message.html().replace(m[0], coordDiv));
          }
        } while (m);

        message.appendTo(div);
        d.scrollTop(d.prop('scrollHeight'));
        if (d.children().length >= 125) {
          d.find('.chat-line:first').remove();
        }
      } else if (data.type === 'force-sync') {
        this.forceSync();
      } else if (data.type === 'authenticate') {
        if (data.message) this.alert(data.message);
        this.onAuthentication(data)
      } else if (data.type === 'reauth') {
        if (!data.success) {
          this.session_key = null;
          this.elements.loginToggle.text('Login');
          this.elements.loginButton.prop('disabled', false);
        } else {
          this.elements.loginToggle.text('Logout');
          this.elements.loginButton.prop('disabled', true);
        }
      } else if (data.type === 'users') {
        this.updateUserCount(data.users.length);
        var userList = $('.user-list');
        userList.empty();
        data.users.forEach(function (user) {
          $('<li>', { class: 'username' }).text(user).appendTo(userList);
        });
      }
    }.bind(this);

    ws.onclose = function () {
      this.connectionLost = true;
      ws.close();
      this.alert('Disconnected from server... Attempting to reconnect');
      setTimeout(this.initSocket.bind(this), 1000);
    }.bind(this);
  },
  updateUserCount: function (count) {
    this.elements.usersToggle.fadeIn(200);
    this.elements.usersToggle.text('Users: ' + count);
  },
  authenticateChat: function () {
    this.username = $('#username').val();
    var password = $('#password').val();

    this.socket.send(JSON.stringify({
      type: 'auth',
      session_id: this.session_id,
      username: this.username,
      password: password
    }));
  },
  onAuthentication: function (data) {
    if (data.success) {
      this.session_key = data.session_key;
      this.elements.loginToggle.text('Logout');
      this.elements.loginContainer.hide();
      this.elements.chatContainer.show();
      if (data.is_moderator) {
        $.get('js/mod_tools.js', function (data) { eval(data) });
      }
      this.elements.palette.addClass('palette-sidebar');
    } else {
      this.elements.loginButton.prop('disabled', false);
    }
  },
  initSidebar: function () {

    this.elements.chatToggle.click(function () {
      this.elements.chatContainer.toggle();
      this.elements.usersContainer.hide();
      this.elements.loginContainer.hide();

      if (this.elements.chatContainer.is(':visible')) {
        this.elements.palette.addClass('palette-sidebar');
      } else {
        this.elements.palette.removeClass('palette-sidebar');
      }
    }.bind(this));

    this.elements.usersToggle.click(function () {
      this.elements.chatContainer.hide();
      this.elements.usersContainer.toggle();
      this.elements.loginContainer.hide();

      if (this.elements.usersContainer.is(':visible')) {
        this.elements.palette.addClass('palette-sidebar');
      } else {
        this.elements.palette.removeClass('palette-sidebar');
      }
    }.bind(this));

    this.elements.loginToggle.click(function () {
      if (this.session_key != null) {
        this.elements.loginToggle.text('Login');
        this.socket.send(JSON.stringify({
          type: 'logout',
          session_id: this.session_id,
          session_key: this.session_key
        }));
        this.session_key = null;
        this.elements.loginButton.prop('disabled', false);
        return;
      }
      this.elements.chatContainer.hide();
      this.elements.usersContainer.hide();
      this.elements.loginContainer.toggle();

      if (this.elements.loginContainer.is(':visible')) {
        this.elements.palette.addClass('palette-sidebar');

      } else {
        this.elements.palette.removeClass('palette-sidebar');
      }

    }.bind(this));

    this.elements.loginButton.click(function () {
      this.elements.loginButton.prop('disabled', true);
      this.authenticateChat();
    }.bind(this));

    this.elements.chatInput.keypress(function (e) {
      if (e.which == 13) {
        e.preventDefault();

        var data = this.elements.chatInput.val();
        if (data === '') return;

        this.socket.send(JSON.stringify({
          session_id: this.session_id,
          type: 'chat',
          message: data
        }));

        this.elements.chatInput.val('');
      }
    }.bind(this));
  },
  initMoveTicker: function () {
    var userListContainer = $('.user-list');
    var moveTickerHeader = $('.move-ticker-header');
    var moveTickerBody = $('.move-ticker-body');

    moveTickerHeader.click(function () {
      moveTickerBody.toggle();
      moveTickerBody.scrollTop(moveTickerBody.prop('scrollHeight'));

      if (moveTickerBody.is(':visible')) {
        userListContainer.addClass('user-list-ticker');
      } else {
        userListContainer.removeClass('user-list-ticker');
      }
    });
  },
  updateTransform: function () {
    this.elements.boardMover
      .css("width", this.width + "px")
      .css("height", this.height + "px")
      .css("transform", "translate(" + this.panX + "px, " + this.panY + "px)");
    this.elements.boardZoomer.css("transform", "scale(" + this.scale + ")");
  },
  screenToBoardSpace: function (screenX, screenY) {
    var boardBox = this.elements.board[0].getBoundingClientRect();
    var boardX = (((screenX - boardBox.left) / this.scale) | 0),
      boardY = (((screenY - boardBox.top) / this.scale) | 0);
    return { x: boardX, y: boardY };
  },
  boardToScreenSpace: function (boardX, boardY) {
    var boardBox = this.elements.board[0].getBoundingClientRect();
    var x = boardX * this.scale + boardBox.left,
      y = boardY * this.scale + boardBox.top;
    return { x: x, y: y };
  },
  centerOn: function (x, y) {
    this.panX = (500 - x) - 0.5;
    this.panY = (500 - y) - 0.5;
    this.updateTransform();
  },
  switchColor: function (newColor) {
    this.color = newColor;

    if (newColor === -1) {
      this.elements.cursor.hide();
    } else {
      this.elements.cursor.show();
      this.elements.cursor.css("background-color", this.palette[newColor]);
    }
  },
  place: function (x, y) {
    this.socket.send(JSON.stringify({
      type: 'place',
      session_id: this.session_id,
      x: x,
      y: y,
      color: this.color
    }));

    //this.switchColor(-1);
  },
  alert: function (message) {
    var alert = this.elements.alert;
    if (message === null) {
      this.elements.alert.fadeOut(200);
      return;
    }

    alert.find(".text").text(message);
    alert.fadeIn(200);
  },
  updateTime: function () {
    var last = this.cooldown;

    this.cooldown -= 1;
    if (this.cooldown < 0) this.cooldown = 0;
    this.cooldown |= 0;

    if (this.cooldown !== 0) {
      this.elements.timer.show();
      var secs = Math.floor(this.cooldown % 60);
      var secsStr = secs < 10 ? "0" + secs : secs;
      var minutes = Math.floor(this.cooldown / 60);
      var minuteStr = minutes < 10 ? "0" + minutes : minutes;
      this.elements.timer.text(minuteStr + ":" + secsStr);

      $(".palette-color").css("cursor", "not-allowed")
    } else {
      this.elements.timer.hide();
      $(".palette-color").css("cursor", "")
    }

    if (this.cooldown === 0 && last !== 0) {
      /*new Notification("Place Thing", {
        body: "Your next pixel is available!"
      });*/

    } else {
      setTimeout(this.updateTime.bind(this), 1000);
    }
  },
  spectate: function (username) {
    this.alert('Spectating ' + username);
    this.spectate_user = username;
  },
};

$.contextMenu({
  selector: '.username',
  trigger: 'right',
  zIndex: 1000,
  items: {
    spectate: {
      name: 'Spectate',
      callback: function (itemKey, opt) {
        App.spectate(opt.$trigger.text());
      }
    }
  }
});

App.init();