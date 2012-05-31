(function(exports) {

  var game = BeachBump;

  var load = function(settings) {
    var beachball = scene('#beachball'),      
        $hitCounter = $('#hit-counter'),
        $beachball = $('#beachball'),
        $message = $('#message'),
        $w = $(window),
        maxHits = settings.maxHits,
        gx = [],
        gy = [];

    // Add the hit counter
    function makeHitCounter() {
      var $hitIcon = $('#hit-icon'),
          $img;

      for (var i=0; i<maxHits; i++) {
        $img = $hitIcon.clone()
                       .attr('id', 'hit-icon-' + i);
        $hitCounter.append($img)
      }
    }

    var crabSpawner = function() {
      var lastTimeout = null,
          minTime = 0,
          maxTime = 6,
          minCrabs = 1,
          maxCrabs = settings.maxCrabs;

      function randomTime() {
        return 1000*(minTime + Math.random() * (maxTime-minTime));
      }

      function spawn() {
        return setTimeout(function() {
          var numCrabs = minCrabs + Math.random() * (maxCrabs - minCrabs);
          for (var i=0; i<numCrabs; i++) { game.spawnCrab(); }
          lastTimeout = spawn();
        }, randomTime());
      }

      return {
        start : function() {
          if (lastTimeout == null) {
            lastTimeout = spawn();
          }
        },
        stop : function() {
          clearInterval(lastTimeout);
          lastTimeout = null;
        }
      }
    }();

    // Start a timer to update the beachball's velocity based on the
    // current, smoothed gravity.
    function makeGravityPoller() {
      var gravityScale = 100,
          delay = 100,
          poller = function() {
            var sumx = 0,
                sumy = 0;
  
            for (var i in gx) { sumx += gx[i]; }
            for (var i in gy) { sumy += gy[i]; }

            sumx /= gx.length;
            sumy /= gy.length;

            gx = [];
            gy = [];

            if (!isNaN(sumx) && !isNaN(sumy)) {
              beachball.vel(sumx*gravityScale, beachball.vel().y);
            }
          };

      return setInterval(poller, delay);
    }

    /* The beachball has been hit */
    game.events.on('beachball-hit', function(currentHits, maxHits) {
      var icon = $hitCounter.children(':nth-child(' + (maxHits-currentHits+1) + ')')
                            .css('opacity', 0.25);

      var min = Math.min(Math.ceil(maxHits/3), 2);

      // Bounce the remaining hit points if there are less than 'min' remaining     
      if (currentHits >= maxHits-min) {
        icon.prevUntil().addClass('bounce');
        icon.nextAll().removeClass('bounce');
      }
    });
     
    /* The ball is invulnerable */
    game.events.on('invulnerable', function(val) {
      if (val) { $beachball.addClass('invulnerable'); }
      else { $beachball.removeClass('invulnerable'); }
    });

    /* We've lost */
    game.events.on('lost', function() {
      $hitCounter.children().css('opacity', 1)
                            .removeClass('bounce');      
      game.restart();  
    });

    /* The game has been started */
    game.events.on('started', function() {
      $message.html('');
      crabSpawner.start();
    });

    /* We've restarted: freeze the UI until the start key has been pressed */
    game.events.on('restarted', function() {
      crabSpawner.stop();
      $message.html('touch the screen to start');     
    });

    // Keyboard controls

    var activeKeys = {};

    function onKeyDown(keys) {      
      _.each(keys, function(val, key) {
         key = parseInt(key);
         if (game.started()) {
           switch(key) {
              case 37:
                beachball.motion.enable('left');
                break;
              case 39:
                beachball.motion.enable('right');
                break;
              case 32:
                beachball.motion.enable('up');
                break;            
           }
         }
      });
    }

    function onKeyUp(keys) {
      _.each(keys, function(val, key) {
         key = parseInt(key);         
         if (game.started()) {
            switch(key) {
              case 37:
                beachball.motion.disable('left');
                break;
              case 39:
                beachball.motion.disable('right');
                break;
              // 'c' key
              case 67:
                game.spawnCrab();
                break;
            }
         }
         // 's' key
         if (key == 83) { game.start(); }
      });
    }

    $w.on('keydown', function(e) {
                activeKeys[e.keyCode] = true;
                onKeyDown(activeKeys);
             })
             .on('keyup', function(e) {
                var keys = {};
                keys[e.keyCode] = true;
                delete activeKeys[e.keyCode];
                onKeyUp(keys);
             });
   
    // Accelerometer-based controls

    $w.on('devicemotion', function(e) {
      e = e.originalEvent;
      switch(window.orientation) {
        case 90:
          gx.push(-e.accelerationIncludingGravity.y);
          gy.push(e.accelerationIncludingGravity.x);
          break;
       case -90:
          gx.push(e.accelerationIncludingGravity.y);
          gy.push(-e.accelerationIncludingGravity.x);
          break;
       default:
          gx.push(e.accelerationIncludingGravity.x);
          gy.push(e.accelerationIncludingGravity.y);
          break;
      }
    });

    $w.on('touchend', function() {
      if (!game.started()) {
        game.start();
      }
      else {
        beachball.motion.enable('up');
      }
    });

    makeHitCounter();
    makeGravityPoller();

    game.events.emit('loaded.ui');
  };

  game.events.on('loaded.core', load); 

})(this);
