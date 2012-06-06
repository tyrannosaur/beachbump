/*  Adds collision detection to SceneObjs.
    Requires scene.js and QuadTree.js
*/

(function(exports) {

   function closest(x, min, max) {
      if (x < min) { return min; }
      if (x > max) { return max; }
      return x;
   }

   /* Whether a circle intersects a rectangle */
   function circleRect(c, r) {   
      var cx = closest(c.x, r.x - r.width/2, r.x + r.width/2),
          cy = closest(c.y, r.y - r.height/2, r.y + r.height/2),
          dx = c.x - cx,
          dy = c.y - cy;

      return Math.pow(dx, 2) + Math.pow(dy, 2) < Math.pow(c.radius, 2);
   }

   /* Whether two circles intersect. */
   function circleCirc($1, $2) {
      var dx = $1.x - $2.x,
          dy = $1.y - $2.y,
          radii = $1.radius + $2.radius;

      return Math.pow(dx, 2) + Math.pow(dy, 2) <= Math.pow(radii, 2);
   }

   /* Whether two rectangles intersect. */
   function rectRect($1, $2) {    
      return !($2.x - $2.width/2 > $1.x + $1.width/2 ||
               $2.x + $2.width/2 < $1.x - $1.width/2 ||
               $2.y - $2.height/2 > $1.y + $1.height/2 ||
               $2.y + $2.height/2 < $1.y - $1.height/2);
   }

   /* A shape */
   function Shape() {
      this._collidingWith = {};
      this.type = 'rectangle';
   }

   Shape.prototype.hitTest = function(other) {
      if (other) {
         if (this.type == 'circle' && other.type == 'circle') { return circleCirc(this, other); }            
         else if (this.type == 'circle' && other.type == 'rectangle') { return circleRect(this, other); }
         else if (this.type == 'rectangle' && other.type == 'circle') { return circleRect(other, this); }
         else if (this.type == 'rectangle' && other.type == 'rectangle') { return rectRect(this, other); }
      }      
   };

   Shape.prototype.collidingWith = function(obj, val) {
      if (val == undefined) {
         return this._collidingWith[obj.sceneObj.name] == true;
      }
      else {      
         if (val) { 
            this._collidingWith[obj.sceneObj.name] = val; 
            obj._collidingWith[this.sceneObj.name] = val;
         }
         else { 
            delete obj._collidingWith[this.sceneObj.name];
            delete this._collidingWith[obj.sceneObj.name]; 
         }
      }
   };

   function shape() {
      var pos = this.position(),
          width = parseFloat(this.style('width')),
          height = parseFloat(this.style('height')),
          settings = arguments[0] || {},
          shape = this._shape;

      if (!this._shape) {
         shape = this._shape = new Shape();
      }
     
      shape.type = settings.type || shape.type;
      width = settings.width || shape.width || width;    
      height = settings.height || shape.height || height;     
      
      // QuadTree uses a coordinate system in the center of the shape,
      // but scene.js uses 'left' and 'right' box corner coordinates.
      shape.x = pos.x + width/2;
      shape.y = pos.y + height/2;
      shape.width = width;
      shape.height = height;
      shape.sceneObj = this;

      if (shape.type == 'circle') {
         shape.radius = Math.max(height, width) / 2;
      }

      if (arguments[0]) { 
         return this; 
      }
      return shape;
   };

   /* Load collisions. There is no unloading. */
   scene.loadCollisions = function(settings) {
      var x = settings.x || 0,
          y = settings.y || 0,
          width = settings.width,
          height = settings.height,
          maxDepth = settings.maxDepth,
          maxChildren = settings.maxChildren,
          tree =  new QuadTree({
            x : x,
            y : y,
            width : width,
            height: height
          }, false, maxDepth, maxChildren);        

      scene.SceneObj.prototype.shape = shape;
      scene.SceneObj.prototype.isCollidable = true;

      scene.schedule('after', function(dt, objects) {
         tree.clear();
         tree.insert(_.map(objects, function(obj, key) {
            return obj.shape();
         }));
         _.each(objects, function(obj, key) {
            if (obj.shape && obj.isCollidable) {
               var shape = obj.shape(),
                   neighbours = tree.retrieve(shape),
                   neighbour,
                   hit; 
 
               for (var i=0; i<neighbours.length; i++) {
                  neighbour = neighbours[i];                   

                  if (neighbour == shape) { continue; }                  

                  hit = shape.hitTest(neighbour);
                  
                  if (shape.collidingWith(neighbour) && !hit) {
                     shape.collidingWith(neighbour, false);               
                  }
                  else if (!shape.collidingWith(neighbour) && hit) {
                     shape.collidingWith(neighbour, true);
                     scene.events.emit('collision', shape.sceneObj.name, neighbour.sceneObj.name);
                  }                  
               }
            }
         });         
      });      
   };
   
})(this);
