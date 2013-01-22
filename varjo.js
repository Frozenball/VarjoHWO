var net = require('net');
var console = require('console');
var sys = require('sys');
var http = require('http');
var util = require('util');
var os = require('os');
var ip = (function(){
  var interfaces = os.networkInterfaces();
  var addresses = [];
  for (k in interfaces) {
      for (k2 in interfaces[k]) {
          var address = interfaces[k][k2];
          if (address.family == 'IPv4' && !address.internal) {
              return address.address;
          }
      }
  }
})();

console.log(ip);



var players = {};
var activeGames = [];
var activeSockets = [];

//var findFreePlayers = 
var Player = function(socket, name){
  this.y = 300;
  this.name = name
  this.socket = socket
  this.direction = 0.0;
  this.game = null;
  
  this.changeDirection = function(dir) {
    if (dir < -1) dir = -1;
    if (dir > 1) dir = 1;
    this.direction = dir;
  };
  this.update = function(){
    if (this.socket === null) {
      this.y = this.game.ball.y - this.game.paddleHeight/2;  
    } else {
      this.y += this.direction*3;
    }
    if (this.y < 0) {
      this.y = 0;
    }
    //console.log(' == ',this.y,' and ',this.game.height,'-',this.game.paddleHeight);
    if (this.y > this.game.height-this.game.paddleHeight) {
      this.y = this.game.height-this.game.paddleHeight;
    }
  };
  this.isBetween = function(y) {
    var top = this.y;
    var bottom = this.y + this.game.paddleHeight;
    //console.log(top,' >= ',y,' >= ',bottom);
    if (top <= y && y <= bottom) {
      return true;
    } else {
      return false;
    }
  }
};


var Ball = function(){
  this.x = 200;
  this.y = 200;
  var randomAngle = Math.random() * 360;
  this.speedX = Math.sin(randomAngle*3.141/180)*3;
  this.speedY = Math.cos(randomAngle*3.141/180)*3;
  this.radius = 5;
};

var Game = function(){
    this.uuid = 'xxxxxx'.replace(/[xy]/g, function(c) {var r = Math.random()*16|0,v=c=='x'?r:r&0x3|0x8;return v.toString(16);});
    this.width = 640;
    this.height = 480;
    this.player_left = null;
    this.player_right = null;
    this.ball = new Ball();
    this.time = Date.now()
    this.paddleWidth = 10;
    this.paddleHeight = 100;
    this.welcomeMessage = false;
    
    this.addPlayer = function(player){
      player.game = this;
      //console.log('Adding player',player);
      if (this.player_left === null) this.player_left = player;
      else if (this.player_right === null) this.player_right = player;
      if (this.player_right === null && /@/.test(this.player_left.name)) {
        botPlayer = new Player(null,'Perfect Bot');
        botPlayer.game = this;
        this.player_right = botPlayer;
      }
      //console.log('Y: ',player.y);
      //console.log('Y: ',this.player_left.y);
      //console.log('Eli siis ',this.player_left,'ja',this.player_right);
    };
    this.update = function(){
      var self = this;
      
      if (this.player_left === null || this.player_right === null) {
        //console.log('not updating..');
        return;
      }
      if (this.welcomeMessage === false) {
        [self.player_left,self.player_right].forEach(function(player){
          if (player.socket !== null && player.socket.writable === true) {
            console.log('WRITING!');
            player.socket.write(JSON.stringify({"msgType":"gameStarted","data":[self.player_left.name, self.player_right.name]})+"\n");
          }
        });
        this.welcomeMessage = true;
      }
      
      /* Update players */
      [this.player_left,this.player_right].forEach(function(player){
        player.update();
      });
      
      /* Helper function */
      var restoreXYData = [this.ball.x,this.ball.y];
      var restoreXY = function(){
        self.ball.x = restoreXYData[0];
        self.ball.y = restoreXYData[1];
      };
      
      this.ball.x += this.ball.speedX;
      this.ball.y += this.ball.speedY;
      if (/!/.test(self.player_left)) {
        this.ball.y += this.ball.speedY*Math.sin(Date.now()/1000);
      }
      if (this.ball.y < this.ball.radius) {
        this.ball.speedY *= -1;
        restoreXY();
      }
      else if (this.ball.y > this.height - this.ball.radius) {
        this.ball.speedY *= -1;
        restoreXY();
      }
      
      var randomDirection = function(speedX,speedY) {
        var dir = Math.atan2(speedY, speedX) * (180/Math.PI) % 360;
        var speed = Math.sqrt(Math.pow(speedY,2) + Math.pow(speedX,2))
        dir += Math.random()*20 - 10
        speedX = Math.cos(dir / (180/Math.PI) % 360) * (speed+0.02)
        speedY = Math.sin(dir / (180/Math.PI) % 360) * (speed+0.02)
        return [speedX,speedY]
      }
      
      var dir = Math.atan2(this.ball.speedY, this.ball.speedX) * (180/Math.PI) % 360;
      var speed = Math.sqrt(Math.pow(this.ball.speedY,2) + Math.pow(this.ball.speedX,2))
      this.ball.speedX = Math.cos(dir / (180/Math.PI) % 360) * (speed+0.02)
      this.ball.speedY = Math.sin(dir / (180/Math.PI) % 360) * (speed+0.02)
      /*
      if (this.ball.speedX > 0) this.ball.speedX += 0.02
      if (this.ball.speedX < 0) this.ball.speedX -= 0.02
      */
      
      if (this.ball.x > (this.width - this.paddleWidth) && this.player_right.isBetween(this.ball.y)) {
        this.ball.speedX *= -1;
        this.ball.x = this.width - this.paddleWidth;
        var newSpeed = randomDirection(this.ball.speedX,this.ball.speedY)
        this.ball.speedX = newSpeed[0]
        this.ball.speedY = newSpeed[1]
        console.log('****** PONG ********');
        restoreXY();
      } else if (this.ball.x < (this.paddleWidth) && this.player_left.isBetween(this.ball.y)) {
        this.ball.speedX *= -1;
        this.ball.x = this.paddleWidth;
        var newSpeed = randomDirection(this.ball.speedX,this.ball.speedY)
        this.ball.speedX = newSpeed[0]
        this.ball.speedY = newSpeed[1]
        console.log('****** PONG ********');
        restoreXY();
      } else if (this.ball.x > this.width) {
        this.ball = new Ball();
        self.welcomeMessage = false;
        console.log('****** FFUFUFF **********');
        console.log('****** FFUFUFF **********');
        console.log('****** FFUFUFF **********');
        console.log('****** FFUFUFF **********');
        console.log('****** FFUFUFF **********');
        console.log('****** FFUFUFF **********');
        console.log('****** FFUFUFF **********');
        console.log('****** FFUFUFF **********');
        console.log('****** FFUFUFF **********');
        console.log('****** FFUFUFF **********');
        console.log('****** FFUFUFF **********');
        [self.player_left,self.player_right].forEach(function(player){
          if (player.socket !== null && player.socket.writable === true) {
            console.log('WRITING!');
            player.socket.write(JSON.stringify({"msgType":"gameIsOver","data":self.player_left.name})+"\n");
          }
        });
        
      } else if (this.ball.x < 0) {
    self.welcomeMessage = false;
        console.log('****** VICTORY *********');
        console.log('****** VICTORY *********');
        console.log('****** VICTORY *********');
        console.log('****** VICTORY *********');
        console.log('****** VICTORY *********');
        console.log('****** VICTORY *********');
        console.log('****** VICTORY *********');
        console.log('****** VICTORY *********');
        console.log('****** VICTORY *********');
        console.log('****** VICTORY *********');
        console.log('****** VICTORY *********');
        console.log('****** VICTORY *********');
        console.log('****** VICTORY *********');
        console.log('****** VICTORY *********');
        console.log('****** VICTORY *********');
        this.ball = new Ball();
        self.welcomeMessage = false;
        [self.player_left,self.player_right].forEach(function(player){
          if (player.socket !== null && player.socket.writable === true) {
            console.log('WRITING!');
            player.socket.write(JSON.stringify({"msgType":"gameIsOver","data":self.player_right.name})+"\n");
          }
        });
      }
      
      
      
      
      this.time += 30 - Math.ceil(Math.random()*5);
      //console.log('Ball at ',this.ball.x,'x',this.ball.y,' and players ',this.player_left.y,',',this.player_right.y);
    };
    this.sendTCP = function(){
      console.log(this.uuid);
      var self = this;
      if (this.player_left === null || this.player_right === null) {
        //console.log('not updating2.');
        return;
      }
      this.player_left.position = 'left';
      this.player_right.position = 'right';
      [this.player_left,this.player_right].forEach(function(player){
        if (player.socket !== null) {
          
          if (player.position == 'left') {
          
          var data = { "msgType":"gameIsOn",
      "data": { "time":self.time,
                "left":{"y":self.player_left.y,"playerName":self.player_left.name},
                "right":{"y":self.player_right.y,"playerName":self.player_right.name},
                "ball":{"pos":{"x":self.ball.x-5,"y":self.ball.y-5}},
                "conf":{"maxWidth":self.width,"maxHeight":self.height,"paddleHeight":self.paddleHeight,"paddleWidth":self.paddleWidth,"ballRadius":self.ball.radius,"tickInterval":30}}};
          } else {

          var data = { "msgType":"gameIsOn",
          "reverse":true,
      "data": { "time":self.time,
                "left":{"y":self.player_right.y,"playerName":self.player_right.name},
                "right":{"y":self.player_left.y,"playerName":self.player_left.name},
                "ball":{"pos":{"x":self.width - self.ball.x,"y":self.ball.y}},
                "conf":{"maxWidth":self.width,"maxHeight":self.height,"paddleHeight":self.paddleHeight,"paddleWidth":self.paddleWidth,"ballRadius":self.ball.radius,"tickInterval":30}}};
          }
          //console.log('> updating: '+JSON.stringify(data));
          //console.log('Socket',player.socket.id,' is ',player.socket.writable);
          if (player.socket.writable === true) {
            player.socket.write(JSON.stringify(data)+"\n");
          }
        }
      });    
    };
};

var server = net.createServer(function(socket){

  // Every time someone connects, tell them hello and then close the connection.
  socket.addListener("connect", function () {
    console.log("Connection from " + socket.remoteAddress);
    //socket.end("Hello World\n");
  });
  
  socket.addListener("end", function(){
      activeGames.forEach(function(game){
        
      });
  });

  socket.addListener("data", function (json) {
    try {
      var data = JSON.parse(json);
    }
    catch(err) {
      socket.write(JSON.stringify({
        msgType:"fuckYou",
        data:"Input not valid JSON"
      })+"\n");
      return;
    }
    if (data['msgType'] == 'join') {
      players[socket.id] = {'name':data['data'],'is_free':true};
      //console.log("Bot "+data['data']+" connected.");
      var foundGame = false;
      activeGames.forEach(function(game){
        if (game.player_left === null || game.player_right === null) {
          game.addPlayer(new Player(socket, data['data']));
      socket.write(JSON.stringify({
        msgType:"joined",
        data:"http://82.130.30.45/pingpong/?uuid="+game.uuid
      })+"\n");
      console.log("http://82.130.30.45/pingpong/?uuid="+game.uuid);
          foundGame = true;
        }
      });
      if (foundGame === false) {
        var game = new Game();
        game.addPlayer(new Player(socket, data['data']));
        activeGames.push(game);
      socket.write(JSON.stringify({
        msgType:"joined",
        data:"http://82.130.30.45/pingpong/?uuid="+game.uuid
      })+"\n");
      console.log("http://82.130.30.45/pingpong/?uuid="+game.uuid);
      }
    }
    
    // Suunnan muutos
    if (data['msgType'] == 'changeDir') {
      activeGames.forEach(function(game){
        if (game.player_left !== null && game.player_left.socket == socket) {
          game.player_left.changeDirection(data['data']);
        } else if (game.player_right !== null && game.player_right.socket == socket) {
          game.player_right.changeDirection(data['data']);
        }
      });
    }
    
    console.log("< "+json);
    //socket.write(json);
  });


});

setInterval(function(){
  activeGames.forEach(function(game){
    game.update();
    game.sendTCP();
  });
},30);


// Fire up the server bound to port 7000 on localhost
server.listen(7000);

/* JSON SERVO */
var json_server = http.createServer(function(request, response) {
  var uuid = request.url.slice(1);
  response.writeHead(200, {"Content-Type": "text/html"});
  
  var data = {'helloWorld':true};
  activeGames.forEach(function(game){
    if (game.uuid == uuid) {
      data['ball_x'] = game.ball.x;
      data['ball_y'] = game.ball.y;
      data['player_left'] = game.player_left.y;
      data['name_left'] = game.player_left.name;
      if (game.player_right === null) {
        data['name_right'] = 'Odotetaan pelaajaa';
        data['player_right'] = 100;
      } else {
        data['player_right'] = game.player_right.y;
        data['name_right'] = game.player_right.name;
      }
      data['paddleWidth'] = game.paddleWidth;
      data['paddleHeight'] = game.paddleHeight;
      data['width'] = game.width;
      data['height'] = game.height;
      return;
    }
  });
  
  response.write(JSON.stringify(data));
  response.end();  
}).listen(7001);


// Put a friendly message on the terminal
console.log("TCP server listening on port 7000 at localhost.");