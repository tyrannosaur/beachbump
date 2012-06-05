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
(function(exports) {
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
)(this);
