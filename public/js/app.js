function getQueryVariable(t){for(var e=window.location.search.substring(1),i=e.split("&"),s=0;s<i.length;s++){var n=i[s].split("=");if(decodeURIComponent(n[0])===t)return decodeURIComponent(n[1])}}function hexToRgb(t){var e=/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(t);return e?{r:parseInt(e[1],16),g:parseInt(e[2],16),b:parseInt(e[3],16)}:null}window.App={elements:{board:$("#board"),palette:$(".palette"),boardMover:$(".board-mover"),boardZoomer:$(".board-zoomer"),boardContainer:$(".board-container"),cursor:$(".cursor"),timer:$(".cooldown-timer"),reticule:$(".reticule"),alert:$(".message"),coords:$(".coords"),users:$(".online")},panX:0,panY:0,scale:4,cooldown:0,init:function(){this.color=-1,this.connectionLost=!1,$(".board-container").hide(),$(".reticule").hide(),$(".ui").hide(),$(".message").hide(),$(".cursor").hide(),$(".cooldown-timer").hide(),$(".online").hide(),$.get("/boardinfo",this.initBoard.bind(this)),this.initBoardMovement(),this.initBoardPlacement(),this.initCursor(),this.initReticule(),this.initAlert(),this.initCoords(),Notification.requestPermission()},initBoard:function(t){this.width=t.width,this.height=t.height,this.palette=t.palette,this.initPalette(),this.elements.board.attr("width",this.width).attr("height",this.height),this.updateTransform();var e=getQueryVariable("x")||this.width/2,i=getQueryVariable("y")||this.height/2;this.centerOn(e,i),this.scale=getQueryVariable("scale")||this.scale,this.updateTransform(),this.initSocket(),setInterval(this.updateTime.bind(this),1e3),jQuery.get("/boarddata",this.drawBoard.bind(this))},drawBoard:function(t){for(var e=this.elements.board[0].getContext("2d"),i=new ImageData(this.width,this.height),s=new Uint32Array(i.data.buffer),n=this.palette.map(function(t){var e=hexToRgb(t);return 4278190080|e.b<<16|e.g<<8|e.r}),o=0;o<this.width*this.height;o++)s[o]=n[t.charCodeAt(o)];e.putImageData(i,0,0)},initPalette:function(){this.palette.forEach(function(t,e){$("<div>").addClass("palette-color").css("background-color",t).click(function(){0===this.cooldown?this.switchColor(e):this.switchColor(-1)}.bind(this)).appendTo(this.elements.palette)}.bind(this))},initBoardMovement:function(){var t=0,e=0,i=!1;this.elements.boardContainer.on("mousedown",function(s){t=s.screenX,e=s.screenY,i=!0}.bind(this)).on("mousemove",function(s){if(i){var n=s.screenX-t,o=s.screenY-e;this.panX+=n/this.scale,this.panY+=o/this.scale,t=s.screenX,e=s.screenY,this.updateTransform()}}.bind(this)).on("mouseup",function(t){i=!1}.bind(this)).on("mouseout",function(t){i=!1}.bind(this)).on("wheel",function(t){var e=this.scale;t.originalEvent.deltaY>0?this.scale/=2:this.scale*=2,this.scale=Math.min(40,Math.max(2,this.scale));var i=t.clientX-this.elements.boardContainer.width()/2,s=t.clientY-this.elements.boardContainer.height()/2;this.panX-=i/e,this.panX+=i/this.scale,this.panY-=s/e,this.panY+=s/this.scale,this.updateTransform()}.bind(this))},initBoardPlacement:function(){var t,e;this.elements.board.on("mousedown",function(i){t=i.clientX,e=i.clientY}).on("click",function(i){if(t===i.clientX&&e===i.clientY&&-1!==this.color&&0===this.cooldown){var s=this.screenToBoardSpace(i.clientX,i.clientY);this.place(s.x,s.y)}}.bind(this)).contextmenu(function(t){t.preventDefault(),this.switchColor(-1)}.bind(this))},initCursor:function(){$(document.body).on("mousemove",function(t){this.elements.cursor.css("transform","translate("+t.clientX+"px, "+t.clientY+"px)")}.bind(this))},initReticule:function(){this.elements.board.on("mousemove",function(t){var e=this.screenToBoardSpace(t.clientX,t.clientY);e.x|=0,e.y|=0;var i=this.boardToScreenSpace(e.x,e.y);this.elements.reticule.css("transform","translate("+i.x+"px, "+i.y+"px)"),this.elements.reticule.css("width",this.scale+"px").css("height",this.scale+"px"),-1===this.color?this.elements.reticule.hide():this.elements.reticule.show()}.bind(this))},initCoords:function(){this.elements.board.on("mousemove",function(t){var e=this.screenToBoardSpace(t.clientX,t.clientY);this.elements.coords.text("("+e.x+", "+e.y+")")}.bind(this))},initAlert:function(){this.elements.alert.find(".close").click(function(){this.elements.alert.fadeOut(200)}.bind(this))},initSocket:function(){var t=window.location,e=("https:"===t.protocol?"wss://":"ws://")+t.host+t.pathname+"ws",i=new WebSocket(e);this.socket=i,i.onopen=function(){$(".board-container").show(),$(".ui").show(),$(".loading").fadeOut(500),this.initUsers(),this.elements.alert.fadeOut(200),this.connectionLost&&jQuery.get("/boarddata",this.drawBoard.bind(this))}.bind(this),i.onmessage=function(t){var e=JSON.parse(t.data);if("pixel"===e.type){var i=this.elements.board[0].getContext("2d");i.fillStyle=this.palette[e.color],i.fillRect(e.x,e.y,1,1)}else"alert"===e.type?this.alert(e.message):"cooldown"===e.type&&(this.cooldown=Math.ceil(e.wait)+1,this.updateTime())}.bind(this),i.onclose=function(){this.connectionLost=!0,i.close(),this.alert("Disconnected from server... Attempting to reconnect"),setTimeout(this.initSocket.bind(this),1e3)}.bind(this)},initUsers:function(){var t=function(){$.get("/users",function(e){this.elements.users.fadeIn(200),this.elements.users.text(e+" online"),setTimeout(t.bind(this),15e3)}.bind(this))}.bind(this);clearTimeout(t),t()},updateTransform:function(){this.elements.boardMover.css("width",this.width+"px").css("height",this.height+"px").css("transform","translate("+this.panX+"px, "+this.panY+"px)"),this.elements.boardZoomer.css("transform","scale("+this.scale+")")},screenToBoardSpace:function(t,e){var i=this.elements.board[0].getBoundingClientRect();return{x:(t-i.left)/this.scale|0,y:(e-i.top)/this.scale|0}},boardToScreenSpace:function(t,e){var i=this.elements.board[0].getBoundingClientRect();return{x:t*this.scale+i.left,y:e*this.scale+i.top}},centerOn:function(t,e){this.panX=t-this.width/2-.5,this.panY=e-this.height/2-.5,this.updateTransform()},switchColor:function(t){this.color=t,-1===t?this.elements.cursor.hide():(this.elements.cursor.show(),this.elements.cursor.css("background-color",this.palette[t]))},place:function(t,e){this.socket.send(JSON.stringify({type:"place",x:t,y:e,color:this.color})),this.switchColor(-1)},alert:function(t){var e=this.elements.alert;e.find(".text").text(t),e.fadeIn(200)},updateTime:function(){var t=this.cooldown;if(this.cooldown-=1,this.cooldown<0&&(this.cooldown=0),this.cooldown|=0,0!==this.cooldown){this.elements.timer.show();var e=Math.floor(this.cooldown%60),i=e<10?"0"+e:e,s=Math.floor(this.cooldown/60),n=s<10?"0"+s:s;this.elements.timer.text(n+":"+i),$(".palette-color").css("cursor","not-allowed")}else this.elements.timer.hide(),$(".palette-color").css("cursor","");0===this.cooldown&&0!==t&&new Notification("Place Thing",{body:"Your next pixel is available!"})}},App.init();