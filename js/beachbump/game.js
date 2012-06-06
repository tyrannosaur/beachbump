/* beachbump
   =========

   Move along the beach without hitting the crabs that pop up.
   Basically a SkiFree clone (http://en.wikipedia.org/wiki/SkiFree)
   
   controls
   ========
   
   move left   - left arrow key or tilting left (on a device with an accelerometer)
   move right  - right arrow key or tilting right
   jump        - space key or touching the screen
   
*/

(function(exports) {

  /* Some helpers. */

  var test = function(m, c) {
    if (typeof m == 'string') { return m == c; }
    else { return m.test(c); }
  };

  var matches = function(m) {  
    var args = Array.prototype.slice.call(arguments, 1);

    for (var i=0; i<args.length; i++) {
      if (test(m, args[i])) { return i+1; }
    }
    return false;
  }

  var first = function(m) {
    var args = Array.prototype.slice.call(arguments, 1),
        nArgs = [];

    for (var i=0; i<args.length; i++) {        
      if (test(m, args[i])) { nArgs.splice(0,0,args[i]); }
      else { nArgs.push(args[i]); }
    }  
    return nArgs;
  }


  /*  Adds a CSS class to start an animation; removes it and calls a callbacks
      once the animation has finished.
  */
  var animator = function(el, settings) {
    var $el = $(el),
        cssClass = settings.cssClass,
        start = settings.start,
        end = settings.end;

    /* Horribly hackish */
    $el.on('animationend webkitAnimationEnd MSAnimationEnd oAnimationEnd', function(e) {
          if (e.target == $el[0] && e.originalEvent.animationName == cssClass) { 
            $el.removeClass(cssClass);
            if (typeof end == 'function') { end.call(null, e); }
          }
        })
        .on('animationstart webkitAnimationStart MSAnimationStart oAnimationStart', function(e) {
          if (e.target == $el[0] && e.originalEvent.animationName == cssClass) {
            if (typeof start == 'function') { start.call(null, e); }
          }
        });

    return function() {
      el.addClass(cssClass);  
    };
  }

  /* The game itself. */

  var $beach,
      $beachball,
      beachWidth,
      beachHeight;

  var textureWidth = 256,
      textureHeight = 256,
      textureX = 0,
      textureY = 0,
      delay,                  // update delay, in seconds
      beachDx,                // the beach's y-velocity in px/s
      beachDy;                // the beach's x-velocity in px/s

  var maxHits,                // maximum number of hit points
      currentHits,            // current number of hits points
      hitInvulnerabilityDuration,
      invulnerable = false,
      started = false;        // is the game started?

  var maps = {};
  var dunes = [];

  /* Shift the beach and dunes left or right */
  function shiftBeach(shift) {
    beachDx = shift;
    for (var i=0; i<dunes.length; i++) { dunes[i].vel(shift, dunes[i].vel().y); }
  }

  /* Convenience function to call when the beachball has been hit by something
     detrimental.
  */     
  function hitBeachball() {    
    if (!invulnerable) {
      currentHits += 1;
      if (currentHits >= maxHits) {      
        game.events.emit('lost');
      }
      else {
        game.events.emit('beachball-hit', currentHits, maxHits);
      }
    }
  }

  /*  Clamp the beachball to the sides of the screen. */
  maps.beachballMap = function(x, y) {
    if (x <= 0) { x = 0; }
    else if (x >= beachWidth-this.width()) { x = beachWidth-this.width(); }
    return {x:x, y:y};
  };

  /*  When the dune has reached the top (or bottom, if the beachDy is position)
      of the screen, reposition it on the opposite side at a random x position.
  */
  maps.duneMap  = function(x, y) {
    if (beachDy > 0 && y <= 0) {
      y = beachHeight;
      x = Math.random() * beachWidth - this.width();
    } 
    else if (beachDy < 0 && y >= beachHeight) {
      y = 0;
      x = Math.random() * beachWidth - this.width();
    }
    return {x:x, y:y};
  };

  /*  Wrap any points outside the beach back on to the beach, but
      on the opposite side.
  */
  maps.wrapMap = function(x, y) {
    return {
      x: (x >= 0) ? x % beachWidth : beachWidth - (-x % beachWidth),
      y: (y >= 0) ? y % beachHeight : beachHeight - (-y % beachHeight)
    }
  };

  var game = exports.BeachBump = {};

  /*  Send or receive events from the game */
  game.events = new scene.EventEmitter();
   
  /*  Get the main loop delay */
  game.delay = function() {
    return delay;
  }

  /*  Toggle invulernability and notify that it's been toggled.
  */
  game.invulnerable = function(val) {
    if (val != undefined) {
      invulnerable = Boolean(val);
      game.events.emit('invulnerable', val);
    }
    else {
      return invulnerable;
    }
  }

  game.start = function() {
    game.invulnerable(false);
    scene.start(delay);
    started = true;
    game.events.emit('started');
  };

  game.unpause = function() {
    scene.start(delay);
    game.events.emit('unpaused');
  }

  game.pause = function() {
    scene.stop();
    game.events.emit('paused');
  };

  game.restart = function() {
    currentHits = 0;
    game.invulnerable(true);
    scene.start(delay);
    started = false;
    game.events.emit('restarted');
  };

  game.started = function() {
    return started;
  }

  game.currentHits = function() {
    return currentHits;
  }

  game.maxHits = function() {
    return maxHits;
  }

  game.load = function(settings) {
    var parseTime = scene.parseTime;

    /* Set these global variables */        
    $beach = $('#beach');
    $beachball = $('#beachball');
    beachWidth = $beach.width();
    beachHeight = $beach.height();

    delay = parseTime(settings.gameDelay);
    beachDx = settings.beachDx;
    beachDy = settings.beachDy;

    maxHits = settings.maxHits;
    currentHits = settings.initialHits || 0;
    hitInvulnerabilityDuration = parseTime(settings.hitInvulnerabilityDuration);

    /* Set up collisions */
    makeCollisions({
      duneSkidSpeed : settings.duneSkidSpeed, 
      maxDuneSkidSpeed : settings.maxDuneSkidSpeed
    });

    /* Make the beach */
    makeBeach();

    /* Make the beachball and give it motion */
    makeBeachball()
    makeBeachballMotion({
      leftRightSpeed : settings.leftRightSpeed,
      jumpResetDelay : parseTime(settings.leftRightResetDelay),
      parallaxSpeed : settings.parallaxSpeed
    });

    makeDunes({
      totalDunes : settings.totalDunes
    });    

    /* Create a crab spawner */
    game.spawnCrab = crabSpawner({
      minDy : settings.crabMinDy,
      maxDy : settings.crabMaxDy,
      scuttleSpeed : settings.crabScuttleSpeed,
      maxCrabs : settings.maxCrabs
    });

    game.events.emit('loaded.core', settings);    
  };

  /*  Make the beachball */
  function makeBeachball() {
    var width = $beachball.width(),
        height = $beachball.height();      

    return scene('#beachball', {
      x : (beachWidth - width)/2, 
      y : (beachHeight - height)/2,            
      map : maps.beachballMap
    })
    .shape({
      type : 'circle'
    });
  }

  /*  Make some dunes.
      Dunes should be randomly placed, but at least two beachball diameters distant 
      to avoid trapping the ball.
  */
  function makeDunes(settings) {
    var n = settings.totalDunes,
        i = 0,
        radius = $beachball.width() / 2,
        minDistance = radius*4,
        placed = new QuadTree({
          x : 0,
          y : 0,
          width : beachWidth,
          height : beachHeight
        }, false, 8);

    function addDune(x, y) {
      var id = 'dune' + i,
          $img = $('#dune').clone();
                          
      $img.attr('id', id);
      $beach.append($img);

      var dune = scene('#'+id, {
        x : x - $img.width()/2,
        y : y - $img.height()/2,
        dx : beachDx,
        dy : beachDy,
        map : maps.wrapMap
      })
      .shape({
        type : 'rectangle'
      });

      dunes.push(dune);
      placed.insert(dune.shape());

      i += 1;
    }

    outer: while (i < n) {
      var x = Math.random() * beachWidth,
          y = Math.random() * beachHeight;

      var shapes = placed.retrieve({ 
        x : x,
        y : y,
        width : minDistance,
        height : minDistance
      });

      if (shapes.length == 0) {
        addDune(x, y);
        continue outer;
      }

      for (var j=0; j<shapes.length; j++) {
        var dx = shapes[j].x - x,
            dy = shapes[j].y - y;

        if (Math.pow(dx, 2) + Math.pow(dy, 2) < Math.pow(minDistance, 2)) {        
          continue outer;
        }
      }      
      addDune(x, y);
    }
  }     

  function makeBeach() {
    /*  Update the sand background on the main loop  */
    scene.schedule('before', function(delay) {
      textureX = (textureX + beachDx*delay) % textureWidth;
      textureY = (textureY + beachDy*delay) % textureHeight;

      $beach.css('background-position',
                 textureX + 'px' + ' ' + textureY + 'px');
    });
  }     

  function makeCollisions(settings) {     
    var skidSpeed = settings.duneSkidSpeed,
        maxSpeed = settings.maxDuneSpeed;        

    function duneCollide($1, $2) {
      /* Skid off the dune to the left or right, depending on which side was hit.
      */
      if ($2 == '#beachball') {
        var beachball = scene($2),  
            dune = scene($1),       
            dir = (dune.shape().x - beachball.shape().x) < 0 ? skidSpeed: -skidSpeed,
            vel = beachball.vel(),
            velX = vel.x + dir;

        velX = velX > maxSpeed ? maxSpeed : velX;
        beachball.vel(velX , vel.y);
      }
    }

    function crabCollide($1, $2) {
      var crab = scene($1);
      /*  Attach the crab to the beachball. */
      if ($2 == '#beachball' && !invulnerable && !crab.isAttached) {    
        crab.attach();
      }    
      else if (/#crab/i.test($2)) {
        crab.collideWithCrab($2);       
      }
    }
 
    scene.loadCollisions({
      x : 0,
      y : 0,
      width : beachWidth,
      height : beachHeight,
      maxDepth : 8
    });

    scene.events.on('collision', function($1, $2) {     
      if (matches(/#dune/i, $1, $2)) { 
        duneCollide.apply(this, first(/#dune/i, $1, $2)); 
      }
      if (matches(/#crab/i, $1, $2)) { 
        crabCollide.apply(this, first(/#crab/i, $1, $2)); 
      }
    });

  } 
   
  /* Move the scene object left, right or make it bounce */
  function makeBeachballMotion(settings) {                  
    var leftRightResetDelay = settings.leftRightResetDelay,
        leftRightSpeed = Math.abs(settings.leftRightSpeed) || 0,
        parallaxSpeed = settings.parallaxSpeed,
        leftRightReset,
        jump,
        jumping = false,
        beachball = scene('#beachball');

    /* Only set this if the game is running */
    function invulnerable(val) {
      if (started) {
        return game.invulnerable(val);
      }
    }

    function jumpStart() {
      jumping = true;
      invulnerable(true);
      beachball.events.emit('jump-start');
    }

    function jumpEnd() {
      jumping = false;
      invulnerable(false);
      beachball.events.emit('jump-end');
    }

    jump = animator($beachball, {
      cssClass : 'jump',
      start : jumpStart, 
      end : jumpEnd
    });

    /* Enable the motion */
    function enable(direction) {                  
      switch(direction) {
        case 'left':
          beachball.vel(-leftRightSpeed);
          shiftBeach(parallaxSpeed);
          break;
        case 'right':
          beachball.vel(leftRightSpeed);
          shiftBeach(-parallaxSpeed);          
          break;
        case 'up':
          if (!jumping) {
            jump();
          }
          break;
      }  
    };

    /* Disable the motion */
    function disable(direction) {
      switch(direction) {
        case 'left':
        case 'right':
          beachball.vel(0);
          shiftBeach(0);
          break;
      }
    }

    beachball.motion = {
      enable : enable,
      disable : disable      
    };
  }        

  /* Make some crabs. Their behaviour is to follow the player
     along the x-axis but move constantly along the y-axis
     until they disappear offscreen.
  */
  function crabSpawner(settings) {
    var scuttleSpeed = settings.scuttleSpeed,
        minDy = settings.minDy,
        maxDy = settings.maxDy,
        maxCrabs = settings.maxCrabs,
        spawnMinTime = settings.spawnMinTime || 0,
        spawnMaxTime = settings.spawnMaxTime || 5,
        numCrabs = 0,
        numAttached = 0,
        rotationDelay = 4/scuttleSpeed,
        beachball = scene('#beachball');

    var crabs = {};

    var crabTypes = [
          'crab',
          'pink-crab' 
        ];

    function getRandomCrabType() {
      return crabTypes[Math.floor(Math.random()*crabTypes.length)];
    }

    function collideWithCrab($2) {
    }

    function despawn(removeOnly) {
      var crab = this;

      function remove() {
        if (crab.attached) { 
          game.events.emit('crab-detached', numAttached -= 1);
        }
        delete crabs[crab.name];
        scene.remove(crab);
        numCrabs -= 1;
      }

      if (removeOnly) {
        return remove();
      }

      // Make it look like the crab is on the beach
      if (this.attached) {
        this.removeMotion('attach')
            .addMotion('dead', function(delay, x, y) {
              return {x:0, y:-20};
            });
      }
       
      animator($(this.name), {
        cssClass : 'crab-detached',
        end : remove
      })();
    }      

    function attach() {    
      var radius = beachball.shape().radius,
          crab = this,
          $crab = $(this.name),
          xOffset;

      this.isCollidable = false;
      this.attached = true;

      // Attach it on the left or right side of the beachball
      if ((beachball.position().x - this.position().x) > 0) {
        xOffset = -this.width();
      }
      else {
        xOffset = 2*radius;
      }

      this.style('z-index', '40')
          .removeMotion('scuttle')              
          .addMotion('attach', function(delay, x, y) {
              var bPos = beachball.position();
              return {
                x: bPos.x - x + xOffset,
                y: bPos.y - y + radius
              };                   
          });
                 
      game.events.emit('crab-attached', numAttached += 1);
      animator($crab, {
        cssClass : 'crab-attached', 
        end : function(e) {
          hitBeachball();
          crab.despawn();
        }
      })();
    }

    game.numAttached = function() {
      return numAttached;
    }

    function spawnCrab() {
      if (numCrabs < maxCrabs) {
         numCrabs += 1;

         var type = getRandomCrabType(),
             id = 'crab' + (new Date()).getTime(),
             $img = $('#' + type).clone(),
             speed = minDy + Math.random() * (maxDy - minDy),
             crab;            

         function scuttleMotion(delay, x, y) {      
            return {x:0, y:speed}
         };

         function crabMap(x, y) {
            if ((speed > 0 && y >= beachHeight) ||
                (speed < 0 && y <= 0)) {           
                  this.despawn(true);
            }
            return {
              x: (x >= 0) ? x % beachWidth : beachWidth - (-x % beachWidth),
              y: y
            };
         };

         $img.attr('id', id);
         $beach.append($img.hide());      

         // Make the crab hitbox slightly smaller than the crab
         crab = crabs['#' + id] = scene('#' + id, {
            x : Math.random() * (beachWidth - $img.width()),
            y : beachHeight,
            map : crabMap
         })
         .addMotion('scuttle', scuttleMotion)
         .shape({
            type : 'rectangle',
            width : $img.width() * 0.90,
            height : $img.height() * 0.90
         });

         crab.despawn = despawn;    
         crab.attach = attach;
         crab.collideWithCrab = collideWithCrab;
   
         $img.show();
      }
    }

    // Remove all crabs attached to the player if the game is lost or restarted
    game.events.on('lost restarted', function() {
      _.each(crabs, function(crab, id) { crab.despawn(); });
    });

    // or removed attached ones if the beachball jumps and kill the others
    beachball.events.on('jump-start', function() {
      _.each(crabs, function(crab, id) { 
        if (crab.attached) { 
          crab.despawn(); 
        }
      });
    });    

    return spawnCrab;
  }

})(this);
