/* scene.js
   Animation via CSS.


*/
(function(exports) {

  var loopId,         // the id of the interval that updates the scene
      objects = {},   // all scene objects
      before = [],    // callbacks called before the scene updates
      after = [],     // callbacks called after after the scene updates
      delay;

  var types = {
    'top' : 'px',
    'bottom' : 'px',
    'left' : 'px',
    'right' : 'px'
  };

  function defaultMap(u, v) {
    return {x: u, y: v};
  }

  function findKey(obj) {
    if (objects.hasOwnProperty(obj)) { return obj; }
    else if (objects.hasOwnProperty(obj.name)) { return obj.name; }
    else if (objects.hasOwnProperty(obj.selector)) { return obj.selector; }
  }

  /*  Find a scene object with the given selector,
      or add a new scene objects if additional arguments are given.
  */
  var scene = exports.scene = function() {
    var selector = arguments[0],
        settings = arguments[1];
    
    if (!selector) { return undefined; }
    if (settings) {
      return objects[selector] = new SceneObj(selector,
                                              scene.select(selector), 
                                              settings);
    }
    else {
      return objects[findKey(selector)];
    }
  }
 
  var events = scene.events = new EventEmitter();

  /*  Returns a time in seconds.
      If an argument is a number, it's assumed to be in seconds.
  */
  var parseTime = scene.parseTime = function(t) {
    if (typeof t == 'number') { return t; }
    if (/ms$/i.test(t)) { return parseFloat(t)/1000; }
    return parseFloat(t);
  }

  /* Selects an element from the DOM. */
  scene.select = function(selector) {
    if (typeof selector != 'string') {
      return selector;
    }
    return document.getElementById(selector) || 
           document.querySelectorAll(selector)[0];
  };  

  /* Remove a scene object. */
  scene.remove = function(selector) {
    selector = findKey(selector);
    if (selector) {
      var node = objects[selector].node,
          parentNode = node.parentNode;          

      if (parentNode) {
        parentNode.removeChild(node);
      }
      objects[selector].events.clear();
      delete objects[selector];
    }
    return this;
  };

  /* Bind a callback to be called when the scene updates. 
          
     'before'   before the scene updates.
     'after'    after the scene updates.
  */
  scene.schedule = function(when, callback) {
    if (typeof callback === 'function') {
      switch(when) {
        case 'before':
          before.push(callback); break;       
        case 'after':
          after.push(callback); break;
      }
    }
    return this;
  };

  /* Draw all objects in the scene and increment their positions. */
  scene.start = function(d) {     
    if (loopId == undefined) {              
      var secDelay = parseTime(d),
          msDelay = secDelay * 1000;
      
      loopId = setInterval(function() {

        for (var i in before) {
          if (typeof before[i] == 'function') {
            before[i].call(null, secDelay, objects);
          }
        }

        for (var name in objects) {
          if (objects.hasOwnProperty(name)) {
            var obj = objects[name];
          
            if (obj.enabled) {
              obj.position(secDelay, 'next');
            }
          }
        }

        for (var i in after) {
          if (typeof after[i] == 'function') {
            after[i].call(null, secDelay, objects);
          }
        }

      }, msDelay);
      return true;
   }
   return false;
  };

  /* Stop drawing the scene */
  scene.stop = function() {
    if (loopId != undefined) {
      loopId = clearInterval(loopId);
    }
  };

  function EventEmitter() {
    this.callbacks = {};
  }

  // emit events
  EventEmitter.prototype.emit = function(type) {
    var cb = this.callbacks[type],
        args = Array.prototype.slice.call(arguments, 1),
        len;

    if (cb) {
      len = cb.length;
      for (var i=0; i<len; i++) {
        cb[i].apply(null, args);
      }
    }
  }
  
  // bind events
  EventEmitter.prototype.on = function(type, func) {
    var types = type.split(/\s+/);
    for (var i=0; i<types.length; i++) {
      (this.callbacks[types[i]] = this.callbacks[types[i]] || [])
      .push(func);
    }
    return this;
  }

  EventEmitter.prototype.clear = function() {
    this.callbacks = {};
    return this;
  }

  /* A Scene Object */
  function SceneObj(selector, node, settings) {    
      this.node = node;                   // DOM node

      this.enabled = true;                // if enabled, the position('next') function of
                                          // this SceneObj will be called every update of the
                                          // start loop

      this.events = new EventEmitter();   // event emitter bound to this scene object.
                                          // It will be cleared when the object is removed
  
      this._motions = [];                 // list of motion functions                                       


      // the position mapping function
      this.map = settings.map || defaultMap

      // increment the position based on the velocity
      this.addMotion('velocity', function(delay, cx, cy) {      
        return {x: this.dx*delay, y: this.dy*delay};        
      });

      this.dx = settings.dx || 0;
      this.dy = settings.dy || 0;
      this.name = settings.name || selector;

      var left = parseFloat(this.current('left')),
          top = parseFloat(this.current('top')),
          x = (settings.x == undefined) ? left : settings.x,
          y = (settings.y == undefined) ? top : settings.y;

      this.style('left', x)
          .style('top', y);
  };

  /*  Get the currently computed value of a style
      property.
  */
  SceneObj.prototype.current = function(prop) {
    return this.node.style[prop];
  };

  /*  Get or set a style property. */
  SceneObj.prototype.style = function(prop, val) {
    if (arguments.length == 1) {
      var style = this.node.style[prop],
          computed = window.getComputedStyle;
      if (style.length == 0 || /auto/i.test(style)) {
         return computed(this.node)[prop];
      }
      else {
         return style;
      }
    }
    else {
      if (types.hasOwnProperty(prop)) {
        val = val + types[prop];
      }
      this.node.style.setProperty(prop, val, '');
      return this; 
    }    
  };

  SceneObj.prototype.setVendorStyle = function(prop, val) {
    return this.style('-webkit-' + prop, val)
               .style('-moz-' + prop, val)
               .style('-ms-' + prop, val)
               .style('-o-' + prop, val);   
  };

  /*  Add a function that computes motion for each update of the start loop.
      The function must return *incremental* x and y distances to be summed.
      The form of the function is:

        function(currentX, currentY, delay) -> {x: ..., y: ...}

      'delay' is not the clock time: keep track of that separately.
  */      
  SceneObj.prototype.addMotion = function(name, motion) {
    if (typeof motion == 'function') {
      this._motions[name] = motion;
    }
    return this;    
  };

  SceneObj.prototype.removeMotion = function(name) {  
    delete this._motions[name];
    return this;
  }

  /*  Instantaneously move to the given or calculated position.
  
      // sum the current motions to get the next position
      obj.position('0.1s', 'next')

      // move *by* this amount in pixels, ignoring everything else
      obj.position(0.1, 10, 10)
  */
  SceneObj.prototype.position = function() {   
    var sx = parseFloat(arguments[1]) || 0,
        sy = parseFloat(arguments[2]) || 0,
        delay = parseTime(arguments[0]),
        cx = parseFloat(this.current('left')),
        cy = parseFloat(this.current('top'));
    
    if (arguments.length == 0) {
      return {x: cx, y: cy};
    }

    if (arguments[1] == 'next') {
      for (var name in this._motions) {
        if (this._motions.hasOwnProperty(name)) {
          var s = this._motions[name].call(this, delay, cx, cy);                 
          if (s) {
            sx += s.x;
            sy += s.y;
          }
        }
      }      
    }

    var map = this.map.call(this,
                            cx + sx, 
                            cy + sy);
                       
    return this.style('left', map.x)
               .style('top', map.y);
  }

  /*  Convenience methods to get the width and height */
  SceneObj.prototype.width = function() {
    return parseFloat(this.style('width'));
  }

  SceneObj.prototype.height = function() {
    return parseFloat(this.style('height'));
  }

  /*  Set or get the velocity.
      TODO: Remove this in favor of a pre-defined motion that increases velocity.
  */
  SceneObj.prototype.vel = function() {
    if (arguments.length == 0) {
      return {x : this.dx, y : this.dy};
    }
    else {
      var dx = parseFloat(arguments[0]) || 0,
          dy = parseFloat(arguments[1]) || 0;

      this.dx = dx;
      this.dy = dy;

      return this;
    }
  }; 

/*
  SceneObj.prototype.makeVelocityMotion = function(dx, dy) {
    var velocity = function() {};
    velocity.prototype = new Motion();
    velocity.prototype.velocity = function() {

    }
    velocity.prototype.dx = dx;
    velocity.prototype.dy = dy;
    
  }
*/
  /*  Convenience object for creating, enabling and disabling a motion. 
  */
/*
  function Motion() {
    this.lastDx = null;
    this.lastDy = null;
    this._incrementer = null; 
    this._enabled = true;
  }
  
  Motion.prototype.setIncrementer = function(func) {
    if (typeof func == 'function') {
      this._incrementer = func;
    }
    returnt this;
  }

  Motion.prototype.enabled = function(val) {
    if (val != undefined) { this._enabled = Boolean(val); }
    else { return this._enabled; }    
  };

  Motion.prototype.inc = function(sceneobj, dt, x, y) {
    if (this._enabled) {
      var ret = this._incrementer.call(sceneobj, dt, x, y, this);
      this.lastDx = ret.x;
      this.lastDy = ret.y;
      return ret;
    }
    return {x:0, y:0}
  }

  function VelocityMotion(dx, dy) {
    this.dx = dx;
    this.dy = dy;
  }

  VelocityMotion.prototype = new Motion();
  VelocityMotion.prototype.velocity = function() {
    
  }
*/
  scene.SceneObj = SceneObj;
  scene.EventEmitter = EventEmitter;  

})(this);
