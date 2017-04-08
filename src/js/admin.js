window.AdminTools = {
  elements: {
    toolsContainer: $('.tools-container'),
    backupsContainer: $('.backups-container'),

    toolsToggle: $('.toggle-tools'),
    backupsToggle: $('.toggle-backups'),
    selection: $('.selection'),
  },
  init: function () {
    this.backupList = null;
    this.startSelection = null;
    this.endSelection = null;

    /*var updateTransform = App.updateTransform;
    App.updateTransform = function () {
      updateTransform.bind(App)();
    };*/

    this.elements.toolsToggle.click(function () {
      this.elements.toolsContainer.toggle();

      if (this.elements.toolsContainer.is(':visible')) {
        this.elements.backupsContainer.hide();
      }
    }.bind(this));

    this.elements.backupsToggle.click(function () {
      this.elements.backupsContainer.toggle();

      if (this.elements.backupsContainer.is(':visible')) {
        this.elements.toolsContainer.hide();
        if (this.backupList === null) {
          this.loadBackups();
        }
      }
    }.bind(this));

    this.initSelectionTool();
    this.initTools();
    this.elements.toolsContainer.show();
  },
  initSelectionTool: function () {
    App.elements.board.on("mousemove", function (evt) {
      if (this.startSelection !== null && this.endSelection !== null) {
        var scaleX = (this.endSelection.x - (this.startSelection.x - 1)) * App.scale;
        var scaleY = (this.endSelection.y - (this.startSelection.y - 1)) * App.scale;

        var screenPos = App.boardToScreenSpace(this.startSelection.x, this.startSelection.y);
        this.elements.selection.css("transform", "translate(" + screenPos.x + "px, " + screenPos.y + "px)");
        this.elements.selection.css("width", scaleX + "px").css("height", scaleY + "px");
        this.elements.selection.show();
      } else {
        this.elements.selection.hide();
      }
    }.bind(this));
  },
  initTools: function () {
    var clearSquare = $('<div>', { text: 'Clear Square' });
    clearSquare.click(this.toolClearSquare.bind(this));

    this.elements.toolsContainer.append(clearSquare);
  },
  toolClearSquare: function () {
    var bubbleContainer = $('.bubble-container').empty();
    var startPos = $('<div>', { class: 'bubble', text: 'Start Position', style: 'cursor: pointer;' });
    var endPos = $('<div>', { class: 'bubble', text: 'End Position', style: 'cursor: pointer;' });
    var clearSelection = $('<div>', { class: 'bubble', text: 'Clear Selection', style: 'cursor: pointer;' }).hide();
    var deleteSelection = $('<div>', { class: 'bubble', text: 'Delete Selection', style: 'cursor: pointer;' }).hide();
    bubbleContainer.append(startPos);
    bubbleContainer.append(endPos);
    bubbleContainer.append(clearSelection);
    bubbleContainer.append(deleteSelection);

    var showHideClearDelete = function (show) {
      if (show) {
        clearSelection.show();
        deleteSelection.show();
      } else {
        clearSelection.hide();
        deleteSelection.hide();
      }
    };

    startPos.click(function () {
      this.startSelection = null;
      startPos.text('Start Position');
      showHideClearDelete(false);
    }.bind(this));

    endPos.click(function () {
      this.endSelection = null;
      endPos.text('End Position');
      showHideClearDelete(false);
    }.bind(this));

    clearSelection.click(function () {
      startPos.click();
      endPos.click();
    });

    deleteSelection.click(function () {
      $.post({
        url: '/admin/delete',
        data: {
          startx: this.startSelection.x,
          starty: this.startSelection.y,
          endx: this.endSelection.x,
          endy: this.endSelection.y,
        }
      });
      clearSelection.click();
    }.bind(this));

    var downX, downY;

    //App.elements.boardContainer.unbind('mousedown');
    App.elements.boardContainer.on('mousedown', function (evt) {
      downX = evt.clientX;
      downY = evt.clientY;
    }).on('click', function (evt) {
      if (downX === evt.clientX && downY === evt.clientY) {
        if (this.startSelection === null) {
          this.startSelection = App.screenToBoardSpace(evt.clientX, evt.clientY);
          startPos.text('Start: (' + this.startSelection.x + ', ' + this.startSelection.y + ')');
        } else if (this.endSelection === null) {
          this.endSelection = App.screenToBoardSpace(evt.clientX, evt.clientY);
          endPos.text('End: (' + this.endSelection.x + ', ' + this.endSelection.y + ')');
        }

        showHideClearDelete((this.startSelection !== null && this.endSelection !== null));
      }
    }.bind(this));
  },
  loadBackups: function () {
    $.get('/admin/backups', function (data) {
      data.forEach(function (backup) {
        console.log(backup);
        $('<div>').text(backup).appendTo(this.elements.backupsContainer);
      }.bind(this));
      this.backupList = data;

    }.bind(this));
  }
};

$.get('/js/app.js', function (data) {
  $.get('/js/mod_tools.js', function (data) {
    AdminTools.init();
  });
});