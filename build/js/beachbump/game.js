/* beachbump
   =========

   Move along the beach without hitting the crabs that pop up.
   Basically a SkiFree clone (http://en.wikipedia.org/wiki/SkiFree)
   
   controls
   ========
   
   move left   - 'A' key or tilting left (on a device with an accelerometer)
   move right  - 'D' key or tilting right
   jump        - space key or shaking the device up and down
   
*/

(function(exports) {
  /*  Calculate 1-dimensional trajectories.
      
      calc      Return distance travelled and the current velocity after
                incrementing the time.
      reset     Resets the time.
      on        Listens for events emitted. Events are:

                  'max-velocity'      : maximum velocity reached
                  'max-time'          : maximum time reached
                  'returned-to-start' : the starting coordinate has been reached

                All of the above are emitted at the exact time or closest possible
                time less than the exact time.
  */
  function trajectory(settings) {
    var t = 0,
        x = settings.x || 0,
        v = settings.v || 0,
        a = settings.a || 0,            
        returnToStart = settings.returnToStart || false,
        maxT = settings.maxT || NaN,
        maxV = settings.maxV || NaN,
        evtEmitter = new scene.EventEmitter();

    var disc = v*v-4*x*a,
        returnTime = NaN;

    function calc(t) {
      return {x: x+v*t+a*t*t, v: v+(a*t)/2};
    }

    if (disc > 0 && a != 0) {
        returnTime = (-v + Math.sqrt(disc))/(2*a) ||
                     (-v - Math.sqrt(disc))/(2*a);
    }                          

    return {
      calc : function(dt) {
        var nextT = t+dt,
            next = calc(nextT),
            shouldCalc = true;

        if (next.v > maxV) {
          evtEmitter.emit('max-velocity');
          shouldCalc &= false;
        }
        if (nextT > maxT) {
          evtEmitter.emit('max-time');
          shouldCalc &= false;
        }
        if (Math.abs(nextT) > Math.abs(returnTime)) {
          evtEmitter.emit('returned-to-start', calc(returnTime), returnTime-t);
          if (returnToStart) { return calc(returnTime); }
        }              
        
        if (shouldCalc) { t += dt; }
        return calc(t);
      },
      reset : function() { t=0; },
      on : function() { return evtEmitter.on.apply(evtEmitter, arguments); }
    };
  };
  
  /* The game */

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
      currentHits;            // current number of hits points
      invulnerable = false;
      
  var started = false;        // is the game started?

  var game = exports.BeachBump = {};

  /*  Send or receive events from the game */
  game.events = new scene.EventEmitter();

  /*  Get the main loop delay */
  game.delay = function() {
    return delay;
  }

  /*  Toggle invulernability (strict boolean) and notify that it's
      been toggled.
  */
  game.invulnerable = function() {
    if (arguments[0] != undefined) {
      invulnerable = arguments[0];
      game.events.emit('invulnerable', arguments[0]);
    }
    else {
      return invulnerable;
    }
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
        var invTime = 1;
        game.events.emit('beachball-hit', currentHits, maxHits);
        game.invulnerable(true);
        setTimeout(function() {
          game.invulnerable(false);
        }, 1000*invTime);
      }
    }
  }

  /*  Wrap any points outside the beach back on to the beach, but
      on the opposite side.
  */
  function beachMap(u, v) {
    return {
      x: (u >= 0) ? u % beachWidth : beachWidth - (-u % beachWidth),
      y: (v >= 0) ? v % beachHeight : beachHeight - (-v % beachHeight)
    };
  }
       
  /*  Make the beachball */
  function makeBeachball() {
    var width = $beachball.width(),
        height = $beachball.height();      

    return scene('#beachball', {
      x : (beachWidth - width)/2, 
      y : (beachHeight - height)/2,            
      map : beachMap
    })
    .shape({
      type : 'circle'
    });
  }

  /*  Make some dunes */
  function makeDunes(n) {
    for (var i=0; i<n; i++) {
      var id = 'dune' + i,
          $img = $('#dune').clone();
                          
      $img.attr('id', id);
      $beach.append($img);

      // Make the collision width a bit smaller so the ball doesn't easily
      // hit the sides
      scene('#'+id, {
        x : Math.random() * beachWidth,
        y : Math.random() * beachHeight,
        dx : beachDx,
        dy : beachDy,
        map : beachMap
      })
      .shape({
        type : 'rectangle',
        width : $img.width()/2
      });
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

  function makeCollisions(skidSpeed, maxSpeed) {      
    var $beach = $('#beach');

    scene.loadCollisions({
      x : 0,
      y : 0,
      width : $beach.width(),
      height : $beach.height(),
      maxDepth : 8
    });

    scene.events.on('collision', function($1, $2) {     
      var hitObj;

      // Crab on crab action: break up the crabs
      if (/#crab/i.test($1) && /#crab/i.test($2)) {
        var vel = 20 + Math.random() * 40;
        scene($1).vel(vel, 0);
        scene($2).vel(-vel, 0);
      }

      if ($1 == '#beachball') { hitObj = $2; }
      else if ( $2 == '#beachball') { hitObj = $1; }

      if (hitObj && !invulnerable) {
         if (/#dune/i.test(hitObj)) {
            // Skid off the dune to the left or right, depending on which side was hit
            var beachball = scene('#beachball'),            
                dir = (scene(hitObj).shape().x - beachball.shape().x) < 0 ? skidSpeed: -skidSpeed,
                vel = beachball.vel(),
                velX = vel.x + dir;

            velX = velX > maxSpeed ? maxSpeed : velX;

            beachball.vel(velX , vel.y);
         }
         if (/#crab/i.test(hitObj)) {            
            scene(hitObj).despawnCrab();
            hitBeachball();
         }
      }
    });
  } 
   
  /* Make some crabs. Their behaviour is to follow the player
     along the x-axis but move constantly along the y-axis
     until they disappear offscreen.
  */
  function crabSpawner(settings) {
    var scuttleSpeed = settings.scuttleSpeed,
        dy = settings.dy,
        maxCrabs = settings.maxCrabs,
        spawnMinTime = settings.spawnMinTime || 0,
        spawnMaxTime = settings.spawnMaxTime || 5,
        numCrabs = 0,
        rotationDelay = 4/scuttleSpeed;    

    var crabTypes = [
          'crab',
          'pink-crab' 
        ];

    function despawnCrab() {
      scene.remove(this.name);
      numCrabs -=1;
    }      

    function scuttleMotion(delay, x, y) {      
      var p = scene('#beachball').position(),
          dir = 0,
          speed = dy,
          range = 10;
      
      if (p.x-x < -range) { dir = -1; }
      else if (p.x-x > range) { dir = 1; }

      if (p.y > y) { speed *= 2; }

      return {x: dir*scuttleSpeed, y: speed}
    };

    function crabMap(x, y) {
      if ((dy > 0 && y >= beachHeight) ||
          (dy < 0 && y <= 0)) {           
            this.despawnCrab();
      }
      return {
        x: (x >= 0) ? x % beachWidth : beachWidth - (-x % beachWidth),
        y: y
      };
    };

    function getRandomCrabType() {
      return crabTypes[Math.floor(Math.random()*crabTypes.length)];
    }

    function spawnCrab() {
      if (numCrabs < maxCrabs) {
         numCrabs += 1;

         var type = getRandomCrabType(),
             id = 'crab' + (new Date()).getTime(),
             $img = $('#' + type).clone(),
             crab;

         $img.attr('id', id)             
             .css('-moz-animation-duration', rotationDelay + 's')
             .css('-webkit-animation-duration', rotationDelay + 's')
             .css('-ms-animation-duration', rotationDelay + 's')
             .css('-o-animation-duration', rotationDelay + 's')
             .css('animation-duration', rotationDelay + 's');

         $beach.append($img.hide());      

         // Make the crab hitbox slightly smaller than the crab
         crab = scene('#' + id, {
            x : (Math.random() < 0.5) ? $img.width() : (beachWidth - $img.width()),
            y : beachHeight,
            map : crabMap
         })
         .addMotion('scuttle', scuttleMotion)
         .shape({
            type : 'rectangle',
            width : $img.width() * 0.90,
            height : $img.height() * 0.90
         });

         crab.despawnCrab = despawnCrab;        
   
         $img.show();
      }
    }

    return spawnCrab;
  }

  /* Move the scene object left, right or make it bounce */
  function motion(sceneObj, settings) {                  
    var jumpResetDelay = settings.jumpResetDelay,
        leftRightSpeed = Math.abs(settings.leftRightSpeed) || 0,
        jumpAccel = settings.jumpAccel || 0,
        jumpVel = settings.jumpVel || 0,
        jumping = false,
        lastJumpY = 0,
        jumpTraj = trajectory({
          a : jumpAccel,
          v : jumpVel,
          returnToStart : true
        });

    var reset = _.debounce(function() {
      sceneObj.vel(0, 0);
    }, 1000*jumpResetDelay);
              
    jumpTraj.on('returned-to-start', function(calc, dt) {
      jumping = false;
      invulnerable(false);
      jumpTraj.reset();           
    });         

    sceneObj.addMotion('jump', function(delay, x, y) {
      if (jumping) {            
        var thisJumpY = jumpTraj.calc(delay).x,
            ret = {
              x : 0,
              y : thisJumpY - lastJumpY
            };
        lastJumpY = thisJumpY;
        return ret;
      }
    });
   
    function invulnerable(val) {
      if (started) {
        return game.invulnerable(val);
      }
    }

    /* Enable the motion */
    function enable(direction) {            
      switch(direction) {
        case 'left':
          sceneObj.vel(-leftRightSpeed);
          break;
        case 'right':
          sceneObj.vel(leftRightSpeed);
          break;
        case 'up':
          if (!jumping) {
            jumping = true;
            invulnerable(true);
          }
          break;
      }  
    };

    /* Disable the motion */
    function disable(direction) {
      switch(direction) {
        case 'left':
        case 'right':
          reset();
          break;
      }
    }

    return {
      enable : enable,
      disable : disable      
    };
  }        

  game.load = function(settings) {
    var totalDunes = settings.totalDunes,
        crabScuttleSpeed = settings.crabScuttleSpeed,
        crabDy = settings.crabDy,
        maxCrabs = settings.maxCrabs,
        jumpAcceleration = settings.jumpAcceleration,
        jumpVelocity = settings.jumpVelocity,
        jumpResetDelay = settings.jumpResetDelay
        leftRightSpeed = settings.leftRightSpeed,
        skidSpeed = settings.skidSpeed,
        maxSkidSpeed = settings.maxSkidSpeed;
        
    $beach = $('#beach');
    $beachball = $('#beachball');
    beachWidth = $beach.width();
    beachHeight = $beach.height();
    maxHits = settings.maxHits;
    currentHits = settings.initialHits || 0;

    delay = settings.gameDelay;
    beachDx = settings.beachDx;
    beachDy = settings.beachDy;

    makeCollisions(skidSpeed, maxSkidSpeed);

    game.spawnCrab = crabSpawner({
      dy : crabDy,
      scuttleSpeed : crabScuttleSpeed,
      maxCrabs : maxCrabs
    });

    makeBeach();
    makeDunes(totalDunes);
    
    var beachball = makeBeachball();
    beachball.motion = motion(beachball, {
      jumpAccel : jumpAcceleration,
      jumpVel : jumpVelocity,
      leftRightSpeed : leftRightSpeed,
      jumpResetDelay : jumpResetDelay
    });

    game.events.emit('loaded.core', settings);    
  };

  game.start = function() {
    game.invulnerable(false);
    scene.start(delay);
    started = true;
    game.events.emit('started');
  };

  game.unpause = function() {
    scene.start(delay);
  }

  game.pause = function() {
    scene.stop();
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

})(this);
