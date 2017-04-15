function getQueryVariable(t){for(var e=window.location.search.substring(1),s=e.split("&"),i=0;i<s.length;i++){var n=s[i].split("=");if(decodeURIComponent(n[0])===t)return decodeURIComponent(n[1])}}function hexToRgb(t){var e=/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(t);return e?{r:parseInt(e[1],16),g:parseInt(e[2],16),b:parseInt(e[3],16)}:null}function setAuthCookie(t,e){var s=window.location,i=new Date;i.setTime(i.getTime()+6048e5);var n="expires="+i.toUTCString(),o="session="+t+":"+e+";"+n+";path=/;";"https:"===s.protocol&&(o+="secure;"),document.cookie=o}function getAuthCookie(){for(var t=document.cookie.split(";"),e=0;e<t.length;e++){for(var s=t[e];" "==s.charAt(0);)s=s.substring(1);if(0==s.indexOf("session=")){var i=s.substring("session=".length,s.length).split(":");return{session_key:i[0],username:i[1]}}}return null}function deleteAuthCookie(){var t=new Date;t.setDate(t.getDate()-1);var e="expires="+t;document.cookie="session=;"+e+"; path=/"}window.App={elements:{board:$("#board"),palette:$(".palette"),boardMover:$(".board-mover"),boardZoomer:$(".board-zoomer"),boardContainer:$(".board-container"),cursor:$(".cursor"),timer:$(".cooldown-timer"),reticule:$(".reticule"),alert:$(".message"),coords:$(".coords"),chatContainer:$(".chat-container"),usersContainer:$(".users-container"),loginContainer:$(".login-container"),usersToggle:$(".toggle-users"),chatToggle:$(".toggle-chat"),usersToggle:$(".toggle-users"),loginToggle:$(".toggle-login"),loginButton:$(".login-button"),chatInput:$(".chat-input"),restrictedToggle:$(".restricted-toggle")},panX:0,panY:0,scale:4,cooldown:0,init:function(){this.color=-1,this.connectionLost=!1,this.mod_tools_requested=!1,this.showRestrictedAreas=!1,this.restrictedAreas=null,this.username=null,this.session_id=null,this.session_key=null,this.spectate_user=null,$(".board-container").hide(),$(".reticule").hide(),$(".ui").hide(),$(".message").hide(),$(".cursor").hide(),$(".cooldown-timer").hide(),this.elements.usersToggle.hide(),$.get("/boardinfo",this.initBoard.bind(this)),this.initBoardMovement(),this.initBoardPlacement(),this.initCursor(),this.initReticule(),this.initAlert(),this.initCoords(),this.initSidebar(),this.initMoveTicker(),this.initRestrictedAreas(),this.initContextMenu(),Notification.requestPermission()},initBoard:function(t){this.width=t.width,this.height=t.height,this.palette=t.palette,this.initPalette(),this.elements.board.attr("width",this.width).attr("height",this.height),this.updateTransform();var e=getQueryVariable("x")||this.width/2,s=getQueryVariable("y")||this.height/2;(e<0||e>=this.width)&&(e=this.width/2),(s<0||s>=this.height)&&(e=this.height/2),this.centerOn(e,s),this.scale=getQueryVariable("scale")||this.scale,this.updateTransform(),this.initSocket(),$.get("/boarddata",this.drawBoard.bind(this))},initRestrictedAreas:function(){this.elements.restrictedToggle.click(this.restrictedAreaToggle.bind(this))},restrictedAreaToggle:function(){this.loadRestrictedAreas(),this.showRestrictedAreas=!this.showRestrictedAreas,this.showRestrictedAreas?this.elements.restrictedToggle.text("Hide Restricted Areas"):this.elements.restrictedToggle.text("Show Restricted Areas")},loadRestrictedAreas:function(){null===this.restrictedAreas&&$.get("/restricted",function(t){this.restrictedAreas=[],t.forEach(function(t){t.div=$("<div>",{class:"selection"}),$(".ui").append(t.div),this.restrictedAreas.push(t)}.bind(this))}.bind(this)),this.elements.board.on("mousemove",function(t){null!==this.restrictedAreas&&this.restrictedAreas.forEach(function(t){if(this.showRestrictedAreas){var e=(t.end.x-(t.start.x-1))*App.scale,s=(t.end.y-(t.start.y-1))*App.scale,i=App.boardToScreenSpace(t.start.x,t.start.y);t.div.css("transform","translate("+i.x+"px, "+i.y+"px)"),t.div.css("width",e+"px").css("height",s+"px"),t.div.show()}else t.div.hide()}.bind(this))}.bind(this))},drawBoard:function(t){for(var e=this.elements.board[0].getContext("2d"),s=new ImageData(this.width,this.height),i=new Uint32Array(s.data.buffer),n=this.width*this.height,o=this.palette.map(function(t){var e=hexToRgb(t);return 4278190080|e.b<<16|e.g<<8|e.r}),a=0;a<n;a++)i[a]=o[t.charCodeAt(a)];e.putImageData(s,0,0)},initPalette:function(){this.palette.forEach(function(t,e){$("<div>").addClass("palette-color").css("background-color",t).click(function(){0===this.cooldown?this.switchColor(e):this.switchColor(-1)}.bind(this)).appendTo(this.elements.palette)}.bind(this))},initBoardMovement:function(){var t=function(t){this.panX+=t.dx/this.scale,this.panY+=t.dy/this.scale,this.updateTransform()}.bind(this);interact(this.elements.boardContainer[0]).draggable({inertia:!1,onmove:t}).gesturable({onmove:function(e){this.scale*=1+e.ds,this.updateTransform(),t(e)}.bind(this)}).styleCursor(!1),$(document).on("keydown",function(t){"BODY"===t.target.nodeName&&(87===t.keyCode||38===t.keyCode?this.panY=t.shiftKey?this.panY+=1:this.panY+=100/this.scale:83===t.keyCode||40===t.keyCode?this.panY=t.shiftKey?this.panY-=1:this.panY-=100/this.scale:65===t.keyCode||37===t.keyCode?this.panX=t.shiftKey?this.panX+=1:this.panX+=100/this.scale:68===t.keyCode||39===t.keyCode?this.panX=t.shiftKey?this.panX-=1:this.panX-=100/this.scale:81===t.keyCode||34===t.keyCode?(this.scale/=1.3,this.scale=Math.min(this.maxScale,Math.max(this.minScale,this.scale))):69===t.keyCode||33===t.keyCode?(this.scale*=1.3,this.scale=Math.min(this.maxScale,Math.max(this.minScale,this.scale))):27===t.keyCode&&this.switchColor(-1),this.updateTransform())}.bind(this)),this.elements.boardContainer.on("wheel",function(t){var e=this.scale;t.originalEvent.deltaY>0?this.scale/=1.3:this.scale*=1.3,this.scale=Math.min(40,Math.max(.75,this.scale));var s=t.clientX-this.elements.boardContainer.width()/2,i=t.clientY-this.elements.boardContainer.height()/2;this.panX-=s/e,this.panX+=s/this.scale,this.panY-=i/e,this.panY+=i/this.scale,this.updateTransform()}.bind(this))},initBoardPlacement:function(){var t,e,s=!1,i=function(i){t=i.clientX,e=i.clientY,s=!1},n=function(i){null!==this.spectate_user&&(this.spectate_user=null,this.alert(null));var n=Math.abs(t-i.clientX),o=Math.abs(e-i.clientY);if(n<5&&o<5&&-1!==this.color&&this.cooldown<=0&&1===i.which&&!s){s=!0;var a=this.screenToBoardSpace(i.clientX,i.clientY);this.place(a.x,a.y)}}.bind(this);this.elements.board.on("pointerdown",i).on("mousedown",i).on("pointerup",n).on("mouseup",n).contextmenu(function(t){t.preventDefault(),this.switchColor(-1)}.bind(this))},initCursor:function(){var t=function(t){this.elements.cursor.css("transform","translate("+t.clientX+"px, "+t.clientY+"px)")}.bind(this);this.elements.boardContainer.on("pointermove",t).on("mousemove",t)},initReticule:function(){var t=function(t){var e=this.screenToBoardSpace(t.clientX,t.clientY);e.x|=0,e.y|=0;var s=this.boardToScreenSpace(e.x,e.y);this.elements.reticule.css("transform","translate("+s.x+"px, "+s.y+"px)"),this.elements.reticule.css("width",this.scale-1+"px").css("height",this.scale-1+"px"),-1===this.color?this.elements.reticule.hide():this.elements.reticule.show()}.bind(this);this.elements.board.on("pointermove",t).on("mousemove",t)},initCoords:function(){this.elements.board.on("mousemove",function(t){var e=this.screenToBoardSpace(t.clientX,t.clientY);this.elements.coords.text("("+e.x+", "+e.y+")")}.bind(this))},initAlert:function(){this.elements.alert.find(".close").click(function(){this.elements.alert.fadeOut(200)}.bind(this))},forceSync:function(){jQuery.get("/boarddata",this.drawBoard.bind(this))},initSocket:function(){var t=0;this.socket=io(),this.socket.on("connect",function(){$(".board-container").show(),$(".ui").show(),$(".loading").fadeOut(500),this.elements.alert.fadeOut(200);var t=getAuthCookie();null!==t&&(this.username=t.username,this.session_key=t.session_key,this.socket.emit("reauth",{username:this.username,session_key:this.session_key})),this.connectionLost&&$.get("/boarddata",this.drawBoard.bind(this))}.bind(this)),this.socket.on("disconnect",function(){this.connectionLost=!0,this.alert("Disconnected from server... Attempting to reconnect")}.bind(this));var e=$(".move-ticker-body");this.socket.on("session",function(t){this.session_id=t.session_id,this.updateUserCount(t.users.connected),this.updateUserList(t.users)}.bind(this)),this.socket.on("place",function(t){var s=this.elements.board[0].getContext("2d");if(s.fillStyle=this.palette[t.color],s.fillRect(t.x,t.y,1,1),e.is(":visible")){var i=$("<div>",{class:"chat-line"}).appendTo(e);$("<span>",{class:"username"}).text(t.session_id).appendTo(i),$("<a>",{href:"javascript:App.centerOn("+t.x+","+t.y+")"}).text(": "+t.x+", "+t.y).appendTo(i),e.scrollTop(e.prop("scrollHeight")),e.children().length>=15&&e.children().first().remove()}null!==this.spectate_user&&this.spectate_user===t.session_id&&this.centerOn(t.x,t.y)}.bind(this)),this.socket.on("alert",function(t){this.alert(t)}.bind(this)),this.socket.on("cooldown",function(t){this.cooldown=Math.ceil(t+1),this.updateTime()}.bind(this)),this.socket.on("force-sync",function(){this.forceSync()}.bind(this)),this.socket.on("auth",function(t){t.message&&this.alert(t.message),this.onAuthentication(t,!1)}.bind(this)),this.socket.on("reauth",function(t){t.message&&this.alert(t.message),this.onAuthentication(t,!0)}.bind(this)),this.socket.on("users",function(t){this.updateUserCount(t.connected),this.updateUserList(t)}.bind(this)),this.socket.on("chat",function(e){var s=$(".chat-log"),i=$("<div>",{class:"chat-line"}).appendTo(s),n=$("<span>",{class:"username"}).text(e.chat_id),o=$("<span>",{class:"chat-message"}).text(": "+e.message);this.elements.chatContainer.is(":hidden")&&t<=125?(t++,this.elements.chatToggle.text("Chat ("+t+")")):t=0;var a,h,r=!1,l=[],h=/(@[a-z0-9]+)/gi;do{if(a=h.exec(o.html())){var c=a[0].replace("@","").toLowerCase();r||e.chat_id===this.username||c!==this.username&&"everyone"!==c&&"world"!==c||(r=!0,new Notification("Place Reloaded",{body:"Message from "+e.chat_id+": "+e.message}));var d=$("<span>",{class:"username"}).text(a[0]).prop("outerHTML");l.push({div:d,index:a.index,length:a[0].length})}}while(a);for(var u=l.length-1;u>=0;u--)o.html(o.html().substr(0,l[u].index)+l[u].div+o.html().substr(l[u].index+l[u].length,o.html().length));l=[],h=/([0-9]+)+\,(\ +)?([0-9]+)/g;do{if(a=h.exec(o.html())){var m=a[0].split(",");if(m[0]<0||m[0]>this.width||m[1]<0||m[1]>this.height)continue;var p=$("<a>",{class:"",href:"javascript:App.centerOn("+m[0]+","+m[1]+")"}).text(a[0]).prop("outerHTML");l.push({div:p,index:a.index,length:a[0].length})}}while(a);for(var u=l.length-1;u>=0;u--)o.html(o.html().substr(0,l[u].index)+l[u].div+o.html().substr(l[u].index+l[u].length,o.html().length));e.is_moderator&&n.addClass("moderator"),n.appendTo(i),o.appendTo(i),s.scrollTop(s.prop("scrollHeight")),s.children().length>=125&&s.find(".chat-line:first").remove()}.bind(this))},updateUserList:function(t){var e=$(".moderators"),s=e.closest(".user-list-section");0!==t.moderators.length?(e.empty(),s.show(),t.moderators.forEach(function(t){$("<div>",{class:"username moderator"}).text(t).appendTo(e)})):s.hide(),e=$(".registered"),s=e.closest(".user-list-section"),0!==t.registered.length?(e.empty(),s.show(),t.registered.forEach(function(t){$("<div>",{class:"username"}).text(t).appendTo(e)})):s.hide(),e=$(".anons"),s=e.closest(".user-list-section"),0!==t.anons.length?(e.empty(),s.show(),t.anons.forEach(function(t){$("<div>",{class:"username"}).text(t).appendTo(e)})):s.hide()},initContextMenu:function(){["right","left"].forEach(function(t){$.contextMenu({selector:".username",trigger:t,zIndex:1e3,autoHide:!0,items:{spectate:{name:"Spectate",callback:function(t,e){App.spectate(e.$trigger.text())}},mention:{name:"Mention",callback:function(t,e){App.mention(e.$trigger.text())}}}})})},updateUserCount:function(t){this.elements.usersToggle.fadeIn(200),this.elements.usersToggle.text("Users: "+t)},authenticateChat:function(){this.username=$("#username").val(),this.socket.emit("auth",{username:this.username,password:$("#password").val()})},onAuthentication:function(data,reauth){data.success?(this.session_key=data.session_key,this.elements.loginToggle.text("Logout"),this.elements.loginContainer.hide(),this.elements.palette.removeClass("palette-sidebar"),reauth||setAuthCookie(data.session_key,this.username),data.is_moderator&&!this.mod_tools_requested&&(this.mod_tools_requested=!0,$.get("js/mod_tools.js",function(data){eval(data)}))):(this.session_key=null,this.username=null,deleteAuthCookie(),reauth&&location.reload(),this.elements.loginToggle.text("Login"),this.elements.loginButton.prop("disabled",!1))},initSidebar:function(){this.elements.chatToggle.click(function(){this.elements.chatContainer.toggle(),this.elements.usersContainer.hide(),this.elements.loginContainer.hide(),this.elements.chatToggle.text("Chat"),this.elements.chatContainer.is(":visible")?(this.elements.palette.addClass("palette-sidebar"),this.elements.chatInput.focus()):this.elements.palette.removeClass("palette-sidebar")}.bind(this)),this.elements.usersToggle.click(function(){this.elements.chatContainer.hide(),this.elements.usersContainer.toggle(),this.elements.loginContainer.hide(),this.elements.usersContainer.is(":visible")?this.elements.palette.addClass("palette-sidebar"):this.elements.palette.removeClass("palette-sidebar")}.bind(this)),this.elements.loginToggle.click(function(){if(null!==this.session_key)return this.socket.emit("logout",{type:"logout",session_key:this.session_key}),this.session_key=null,this.username=null,deleteAuthCookie(),location.reload(),this.elements.loginToggle.text("Login"),void this.elements.loginButton.prop("disabled",!1);this.elements.chatContainer.hide(),this.elements.usersContainer.hide(),this.elements.loginContainer.toggle(),this.elements.loginContainer.is(":visible")?(this.elements.palette.addClass("palette-sidebar"),$("#username").focus()):this.elements.palette.removeClass("palette-sidebar")}.bind(this)),this.elements.loginButton.click(function(){this.elements.loginButton.prop("disabled",!0),this.authenticateChat()}.bind(this)),this.elements.chatInput.keypress(function(t){if(13==t.which){t.preventDefault();var e=this.elements.chatInput.val();if(""===e)return;this.socket.emit("chat",e),this.elements.chatInput.val("")}}.bind(this))},initMoveTicker:function(){var t=$(".user-list"),e=$(".move-ticker-header"),s=$(".move-ticker-body");e.click(function(){s.toggle(),s.scrollTop(s.prop("scrollHeight")),s.is(":visible")?t.addClass("user-list-ticker"):t.removeClass("user-list-ticker")})},updateTransform:function(){this.panX<=-this.width/2&&(this.panX=-this.width/2),this.panX>=this.width/2&&(this.panX=this.width/2),this.panY<=-this.height/2&&(this.panY=-this.height/2),this.panY>=this.height/2&&(this.panY=this.height/2),this.elements.boardMover.css("width",this.width+"px").css("height",this.height+"px").css("transform","translate("+this.panX+"px, "+this.panY+"px)"),this.elements.reticule.css("width",this.scale+"px").css("height",this.scale+"px"),this.elements.boardZoomer.css("transform","scale("+this.scale+")")},screenToBoardSpace:function(t,e){var s=this.elements.board[0].getBoundingClientRect();return{x:(t-s.left)/this.scale|0,y:(e-s.top)/this.scale|0}},boardToScreenSpace:function(t,e){var s=this.elements.board[0].getBoundingClientRect();return{x:t*this.scale+s.left,y:e*this.scale+s.top}},centerOn:function(t,e){this.panX=500-t-.5,this.panY=500-e-.5,this.elements.coords.text("("+t+", "+e+")"),this.updateTransform()},switchColor:function(t){this.color=t,-1===t?this.elements.cursor.hide():(this.elements.cursor.show(),this.elements.cursor.css("background-color",this.palette[t]))},place:function(t,e){-1!==this.color&&this.socket.emit("place",{x:t,y:e,color:this.color})},alert:function(t){var e=this.elements.alert;if(null===t)return void this.elements.alert.fadeOut(200);e.find(".text").text(t),e.fadeIn(200)},updateTime:function(){var t=this.cooldown;if(this.cooldown-=1,this.cooldown<0&&(this.cooldown=0),this.cooldown|=0,0!==this.cooldown){this.elements.timer.show();var e=Math.floor(this.cooldown%60),s=e<10?"0"+e:e,i=Math.floor(this.cooldown/60),n=i<10?"0"+i:i;this.elements.timer.text(n+":"+s),$(".palette-color").css("cursor","not-allowed")}else this.elements.timer.hide(),$(".palette-color").css("cursor","");0===this.cooldown&&0!==t||setTimeout(this.updateTime.bind(this),1e3)},spectate:function(t){t.startsWith("@")&&(t=t.substr(1)),this.alert("Spectating "+t),this.spectate_user=t},mention:function(t){this.elements.usersContainer.hide(),this.elements.chatContainer.show(),t.startsWith("@")||(t="@"+t),this.elements.chatInput.val(this.elements.chatInput.val()+t+" "),this.elements.chatInput.focus()},toURL:function(){window.open(this.elements.board[0].toDataURL(),"_blank")}},App.init();