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
      currentHits,            // current number of hits points
      hitInvulnerabilityDuration,
      invulnerable = false,
      started = false;        // is the game started?

  var maps = {};

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

  /*  Adds a CSS class to start an animation; removes it and calls a callbacks
      once the animation has finished.
  */
  var animator = function(el, cssClass, onStart, onEnd) {
    var $el = $(el);
    $el.on('animationend webkitAnimationEnd MSAnimationEnd oAnimationEnd', function(e) {
          $el.removeClass(cssClass);
          onEnd.call(null, e);
        })
        .on('animationstart webkitAnimationStart MSAnimationStart oAnimationStart', onStart);
    return function() {
      el.addClass(cssClass);  
    };
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

  /*  Make some dunes */
  function makeDunes(settings) {
    var n = settings.totalDunes;

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
        map : maps.wrapMap
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

  function makeCollisions(settings) {     
    var skidSpeed = settings.skidSpeed,
        maxSpeed = settings.maxSpeed;
 
    scene.loadCollisions({
      x : 0,
      y : 0,
      width : $beach.width(),
      height : $beach.height(),
      maxDepth : 8
    });

    scene.events.on('collision', function($1, $2) {     
      var hitObj;

      /*
      // Crab on crab action: break up the crabs
      if (/#crab/i.test($1) && /#crab/i.test($2)) {
        var vel = 20 + Math.random() * 40;
        scene($1).vel(vel, 0);
        scene($2).vel(-vel, 0);
      }
      */

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
      numCrabs -= 1;
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
    var leftRightResetDelay = settings.leftRightResetDelay,
        leftRightSpeed = Math.abs(settings.leftRightSpeed) || 0,
        leftRightReset,
        jump,
        jumping = false;

    /* Only set this if the game is running */
    function invulnerable(val) {
      if (started) {
        return game.invulnerable(val);
      }
    }

    function jumpStart() {
      jumping = true;
      invulnerable(true);
    }

    function jumpEnd() {
      jumping = false;
      invulnerable(false);
    }

    jump = animator($beachball, 'jump', jumpStart, jumpEnd);

    reset = _.debounce(function() {
      sceneObj.vel(0, 0);
    }, 1000*leftRightResetDelay);              

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
          reset();
          break;
      }
    }

    return {
      enable : enable,
      disable : disable      
    };
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

    /* Make the beach and the dunes */
    makeBeach();
    makeDunes({
      totalDunes : settings.totalDunes
    });
    
    /* Make the beachball and give it motion */
    var beachball = makeBeachball();
    beachball.motion = motion(beachball, {
      leftRightSpeed : settings.leftRightSpeed,
      jumpResetDelay : parseTime(settings.leftRightResetDelay)
    });

    /* Create a crab spawner */
    game.spawnCrab = crabSpawner({
      dy : settings.crabDy,
      scuttleSpeed : settings.crabScuttleSpeed,
      maxCrabs : settings.maxCrabs
    });

    game.events.emit('loaded.core', settings);    
  };

})(this);
