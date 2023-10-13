"use strict";

const P2 = (x, y) => ({x,y});
const EDGES = 6;
const RADIUS = 80;
const TAU = 2 * Math.PI;
const EDGE_LEN = Math.sin(Math.PI / EDGES) * RADIUS * 2;
const GRID_Y_SPACE = Math.cos(Math.PI / EDGES) * RADIUS * 2;
const GRID_X_SPACE = RADIUS * 2 - EDGE_LEN * 0.5;
const GRID_Y_OFFSET = GRID_Y_SPACE * 0.5;
const COLS = "=#3c2f18,#01335f,#3f0e77,#204a73,#511d94,#fe1f00,#0060fd,#fe7603,#f0ca1d,#b085e8,#e9cafa".split(",");
const rndItem = arr => arr[Math.random() * arr.length | 0];
var gridPosX = 0, gridPosY = 0;
function setGlobals() {
  // window.ext is set by cocoonjs
  window.isMobile = !!window.ext

  window.devPixelRatio = (window.devicePixelRatio > 2 ? 2 : window.devicePixelRatio) || 1
  window.$canv = document.getElementById('mainCanv')
  $canv.width = window.innerWidth * devPixelRatio
  $canv.height = window.innerHeight * devPixelRatio
  window.ctx = $canv.getContext('2d')
  
  ctx.lineJoin = 'round'
  window.debug = false // true

  // this probably shouldnt be a global...
  window.usingSmallLogo = false

  
  // color pallet
  window.pallet = [ [239, 150, 153], [252, 248, 72], [255, 0, 153], [107, 203, 231], [169, 4, 69], [137, 248, 50] ]

  window.lastColor = new Color()
  window.GAME = {
    MENU: {
      opacity: 1
    },
    state: 'menu',
    firstLoop : true,
    bufferLoop: true
  }
  window.ASSETS = {loaded: false}

  if(debug){
    window.stats = new Stats()
    document.body.appendChild(stats.domElement)
  }
  // game loop
  window.MS_PER_UPDATE = 32
  window.previousTime = 0.0
  window.lag = 0.0
  window.quality = 10
}

setGlobals()
loadAssets(fadeInMenu)

function init() {
  GAME.state = 'playing'
  GAME.player = new Fish(false)
  GAME.fishes = [GAME.player]
  GAME.spawner = new Spawner($canv.width, $canv.height, GAME.player, GAME.fishes)
  GAME.levelParticles = []
  GAME.levelBar = new LevelBar($canv.width)
  GAME.levelBalls = new LevelBalls($canv.width, $canv.height)
  GAME.levelBallParticles = []
  GAME.endGameParticles = []
  GAME.firstLoop = true
  //previousTime = Date.now() - previousTime
  requestAnimFrame(draw)
}

function lowerQuality() {
  if(!isMobile) return
  if(quality >= 7) {
    quality -= 1
    resizeWindow()
  }
}

// main game loop
function draw(time) {
  var i, l, j, dist, nextStage, fish, fish2

  lag += time - previousTime
  previousTime = time

  if(GAME.state === 'playing'){
    requestAnimFrame(function(t){
      draw(t)
    })
  } else {
    return fadeInMenu()
  }

  var player = GAME.player
  var fishes = GAME.fishes
  var spawner = GAME.spawner
  var levelParticles = GAME.levelParticles
  var levelBar = GAME.levelBar
  var levelBalls = GAME.levelBalls
  var levelBallParticles = GAME.levelBallParticles
  var endGameParticles = GAME.endGameParticles

  if(debug) stats.begin()
  var MAX_CYCLES = 17
  while(lag >= MS_PER_UPDATE && MAX_CYCLES) {
    physics()
    lag -= MS_PER_UPDATE
    MAX_CYCLES--
  }

  if(MAX_CYCLES === 0 && GAME.firstLoop) {
    GAME.firstLoop = false
  } else if( MAX_CYCLES === 0 && GAME.bufferLoop) {
    GAME.bufferLoop = false
  } else if (MAX_CYCLES === 0) {
     // adaptive quality
    lowerQuality()
    GAME.firstLoop = true
    GAME.bufferLoop = true
  }

  // if 5 frames behind, jump
  if(lag/MS_PER_UPDATE > 75) {
    lag = 0.0
  }

  paint()
  if(debug) stats.end()

  function physics() {
    levelBarPhysics()
    levelBallPhysics()
    endGameParticlePhysics()
    // enemy spawner
    spawner.update()
    // enemy spawner debug
    fishPhysics()
    playerScore()
  }
 
  
  function drawGrid(x, y, w, h, points, ctx) {
    const p = P2();
    var gy, gx;
    for (gy = y; gy < y + h; gy++) {
        for (gx = x; gx < x + w; gx++) {
            ctx.fillStyle = "#0000";
            drawPoly(gridToPixel(gx, gy, p), points, ctx);
        }
    }
  }
  function gridToPixel(gx, gy, p = {}) {
      p.x = gx * GRID_X_SPACE;
      p.y = gy * GRID_Y_SPACE + (gx % 2 ? GRID_Y_OFFSET : 0);       
      return p;
  }
  function drawPoly(p, points, ctx) { // p.x, p.y is center
      ctx.setTransform(1, 0, 0, 1, p.x - player.x, p.y - player.y);
      var i = 0;
      ctx.beginPath();
      while (i < points.length) {
          const p2 = points[i++];
          ctx.lineTo(p2.x, p2.y);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
  }
  function createPoly(sides, points = []) {
      const step = TAU / sides;
      var ang = 0, i = sides;
      while (i--) {
          points.push(P2(RADIUS * Math.cos(ang), RADIUS * Math.sin(ang)));
          ang += step;
      }
      return points;
  }
  function paint() {
    // clear and draw background
    ctx.fillStyle = '#111'
    ctx.fillRect(0, 0, $canv.width, $canv.height);
    var tempCtx = ctx;
    gridPosX = player.x;
    gridPosY = player.y;
    drawGrid(-20, -10, 200,100, createPoly(EDGES), ctx);
    ctx = tempCtx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    

    // static position objects
    levelBar.draw(ctx)
    paintLevelParticles()
    paintLevelBallParticles()
    levelBalls.draw(ctx)

    // dynamic position objects
    ctx.save()
    ctx.translate(-player.x + $canv.width/2, -player.y + $canv.height/2)
    paintEndGameParticles()
    paintFish()
    
    if(debug) spawner.debug()
    ctx.restore()

    drawSoundControl()
  }

  function levelBarPhysics() {
    // levelBar level up
    nextStage = levelBar.physics()
    if(nextStage) {
      GAME.levelBallParticles = levelBallParticles.concat(levelBar.toParticles(levelBalls))
      levelBalls.nextColors = levelBar.colors.slice(0, 2)

      // reset levelBar
      GAME.levelBar = new LevelBar($canv.width)
    }

    // levelBar Particles physics
    i = levelParticles.length
    while(i-- > 0) {
      dist = levelParticles[i].physics()
      if (dist < 10) {
        levelParticles.splice(i, 1)
        if(!levelBar.updating) {
          levelBar.updating = true
          levelBar.addColor()
        }
        if(levelParticles.length === 0) {
          levelBar.updating = false
        }
      }
    }
  }

  function levelBallPhysics() {
    // levelBalls level up
    nextStage = levelBalls.physics()
    if(nextStage) {
      GAME.endGameParticles = levelBalls.toParticles(player)

      // un-static position
      for(i=0;i<GAME.endGameParticles.length;i++) {
        GAME.endGameParticles[i].x += player.x - $canv.width/2
        GAME.endGameParticles[i].y += player.y - $canv.height/2
      }

      GAME.levelBalls = new LevelBalls($canv.width, $canv.height)
    }

    i = levelBallParticles.length
    while(i-- > 0) {
      dist = levelBallParticles[i].physics()
      if (dist < 10) {
        levelBallParticles.splice(i, 1)
        if(!levelBalls.updating) {
          levelBalls.updating = true
          levelBalls.addBall()
        }
        if(levelBallParticles.length === 0) {
          levelBalls.updating = false
          levelBalls.shift()
        }
      }
    }
  }

  function endGameParticlePhysics() {
    for(i = -1, l = endGameParticles.length; ++i < l;) {
      endGameParticles[i].physics()
    }
  }

  function fishPhysics() {
    // physics and drawing
    i = fishes.length
    while(i-- > 0) {
      // cleanup dead fish - in here for performance
      if(fishes[i].dead) {
        if(fishes[i] === player) {
          setTimeout(function(){
            GAME.state = 'menu'
          }, 3000)
        }
        fishes.splice(i, 1)
        continue
      }


      fish = fishes[i]
      if(Math.abs(fish.x - player.x) < $canv.width && Math.abs(fish.y - player.y) < $canv.height) {

        fish.physics(player)

        // collision - in here for performance
        j=i
        while (j-- > 0) {
          fish2 = fishes[j]
          if(Math.abs(fish2.x - player.x) < $canv.width && Math.abs(fish2.y - player.y) < $canv.height) {
            if(fish.collide(fish2)) {
              if(fish.size >= fish2.size){
                fish2.killedBy(fish)
                const bodyOutline = fish.bodyOutline;
              } else {
                fish.killedBy(fish2)
                const bodyOutline = fish2.bodyOutline;
                
              }
            }
          }
        }
      }

      // if far enough away from player, remove
      if(distance(fish, player) > Math.max($canv.width, $canv.height) * 1.5) {
        fish.dead = true
      }

    }
  }

  function playerScore() {
    i=player.colors.length
    if (i <= 1) return
    // while(i-->0) {
    //   if (player.colors[i].loaded < 1) {
    //     return
    //   }
    // }
    
    // player score
    // steal colors from player
    player.drawColors()
    var newParticles = player.toParticles(levelBar)

    // staticly position
    for(i=0;i<newParticles.length;i++) {
      newParticles[i].x += -player.x + $canv.width/2
      newParticles[i].y += -player.y + $canv.height/2
    }

    GAME.levelParticles = levelParticles.concat(newParticles)
    player.colors.splice(0, 1)

  }

  function paintLevelParticles() {
    for(i = -1, l = levelParticles.length; ++i < l;) {
      levelParticles[i].draw(ctx) // iterate levelParticles
    }
  }

  function paintLevelBallParticles() {
    for(i = -1, l = levelBallParticles.length; ++i < l;) {
      levelBallParticles[i].draw(ctx)
    }
  }

  function paintEndGameParticles() {
    for(i = -1, l = endGameParticles.length; ++i < l;) {
        endGameParticles[i].draw(ctx)
    }
  }

  function paintFish() {
    // draw fish
    for(i = -1, l = fishes.length; ++i < l;) {
      fish = fishes[i]
      if(Math.abs(fish.x - player.x) < $canv.width/2 + 100 && Math.abs(fish.y - player.y) < $canv.height/2 + 100) {
        fish.draw(ctx)
      }
    }
  }

}

function loadAssets(cb) {
  var imgs = [
    { name: 'bg', src: 'assets/bg.jpg' },
    { name: 'logo', src: 'assets/logo.png' },
    { name: 'logoSmall', src: 'assets/logo-small.png' },
    { name: 'soundOn', src: 'assets/sound-on.png' },
    { name: 'soundOff', src: 'assets/sound-off.png' },
    {name: 'enter', src: 'assets/enter.png'}
  ]

  function process() {
    var next = imgs.pop()
    if(next) {
      var img = new Image()
      img.onload = function() {
        ASSETS[next.name] = this
        process()
      }
      img.src = next.src
    } else {
      ASSETS.loaded = true
      cb()
    }
  }

  process()
}

// level debug
function levelUp(){
  var levelBar = GAME.levelBar
  for(var i=0;i<9;i++)
    levelBar.addColor()

  levelBar.colors.forEach(function(col){
    col.loaded = 1
  })
  levelBar.x = levelBar.targetX
  levelBar.addColor()
}
function levelUp2(){
  var levelBalls = GAME.levelBalls
  for(var i=0;i<8;i++){
    levelBalls.addBall()
    levelBalls.shift()
  }
  levelBalls.balls.forEach(function(b){b.size = b.targetSize})
  levelBalls.addBall()
}
//setTimeout(levelUp, 3000)
//setTimeout(function(){GAME.levelBar.addColor()}, 10000)
//setTimeout(levelUp2, 3000)
