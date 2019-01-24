//
// Code for the Arachne Event Display
// Author: Nathaniel Tagg ntagg@otterbein.edu
// 
// Licence: this code is free for non-commertial use. Note other licences may apply to 3rd-party code.
// Any use of this code must include attribution to Nathaniel Tagg at Otterbein University, but otherwise 
// you're free to modify and use it as you like.
//

// Namespaced tools to do some basic geometry stuff.

var GeoUtils = function() {
return {
  min : function(a,b) {
    if(a>b) return b;
    return a;
  },
  
  max : function(a,b) {
    if(a>b) return a;
    return b;
  },
  
  square : function(a) { return a*a; },
  
  line_is_close_to_point : function(x,y,px1,py1,px2,py2,d)
  {
    // Return true if (x,y) is within distance d of the the line segment from p1 to p2.
    if(x < this.min(px1,px2) - d ) return false;
    if(x > this.max(px1,px2) + d ) return false;
    if(y < this.min(py1,py2) - d ) return false;
    if(y > this.max(py1,py2) + d ) return false;
    return (this.line_to_point(x,y,px1,py1,px2,py2) <= d);
  },


  line_to_point : function(x,y,px1,py1,px2,py2) {
    // Find the distance from a point to a line segment.
    
    // Find lambda, the distance along the line segment closest to the point.
    // v = vector from p1 to p2
    var v2 = this.square(px2-px1) + this.square(py2-py1);
    var v_dot_qp = (px2-px1) * (x-px1) + (py2-py1)*(y-py1);
    var lam = v_dot_qp/v2;
    
    if(lam<=0) {
      // Closest point is p1.
      return Math.sqrt(this.square(x-px1)+this.square(y-py1));
    }
    if(lam>=1) {
      // Closest point is p2
      return Math.sqrt(this.square(x-px2)+this.square(y-py2));
    }
    
    // Closest point is along the line.
    var qp2 = this.square(px1-x) + this.square(py1-y);
    var d2 = qp2-lam*lam*v2;
    return Math.sqrt(d2);
    

  },

  is_point_in_polygon : function(p,polygon) {
    // return true if point p=[x,y] is inside convex polygon described by polygon [[x,y],[x,y],...]
    // Uses 'winding number': go around points in order, and see if the angle to the point
    // is zero or 2pi.  (In fact, use method which just checks that sign of angle is the same each time:
    //  http://demonstrations.wolfram.com/AnEfficientTestForAPointToBeInAConvexPolygon/)
    
    // utility function:
    function compare_pair(p,p1,p2){
      // ai = X(i+1)Yi - XiY(i+1)
      var ai = (p2[0]-p[0])*(p1[1]-p[1]) - (p1[0]-p[0])*(p2[1]-p[1]);
      return ai>0;
    }
    var n = polygon.length;
    var i = 0;
    var sign = compare_pair(p,polygon[n-1],polygon[0]); // Compare last point and first.
    for(i=0;i<n-1;i++) {
      // Compare each other pair of points.
      var sign2 = compare_pair(p,polygon[i],polygon[i+1]);
      if(sign2 != sign) return false; // Nope, 
    }
    // If we survived all those tests, then we're inside the polygon.
    return true;
  },

  
  draw_highlighted_line: function(ctx,x1,y1,x2,y2,width,style,highlight_style,outline_style,do_highlight,do_outline)
  {
    // if(do_highlight) console.log("drawing highlighted");
    ctx.save();
    ctx.lineWidth = width;
    if(do_highlight) ctx.strokeStyle = highlight_style;
    else             ctx.strokeStyle = style;
    // console.log(ctx.strokeStyle);

    // This trick uses the shadow of a line to draw a soft line. Unfortunately, it doesn't work inside the magnifier.
    // ctx.save();
    // ctx.lineWidth = 1;
    // ctx.shadowColor = 'rgba(255, 0, 0, 1)'; 
    // ctx.shadowBlur = width;
    // ctx.shadowOffsetX = 10000;
    // ctx.shadowOffsetY = 0; 
    // ctx.beginPath();
    // ctx.moveTo(x1-10000,y1);
    // ctx.lineTo(x2-10000,y2);
    // ctx.stroke();
    // ctx.restore();
    ctx.beginPath();
    ctx.moveTo(x1,y1);
    ctx.lineTo(x2,y2);
    ctx.stroke();

    if(do_outline) {
      var dx = x2-x1;
      var dy = y2-y1;
      var d = Math.sqrt(dx*dx+dy*dy);
      var tx, ty;
      if(d===0) {
        tx = 0;
        ty = width;
      } else {
       tx = width*dy/d;
       ty = -tx*dx/dy;
      }
      if(dy===0) ty = width;
      // console.log("do_outline",tx,ty);
      ctx.strokeStyle = outline_style;
      ctx.beginPath();
      ctx.moveTo(x1+tx,y1+ty);
      ctx.lineTo(x2+tx,y2+ty);
      ctx.moveTo(x1-tx,y1-ty);
      ctx.lineTo(x2-tx,y2-ty);
      ctx.stroke();
    }
    ctx.restore();
  },



///
/// http://en.literateprograms.org/Quickhull_(Javascript)
//
convexHull: function( points )
{
  // console.warn("convexHull",points);
  //find first baseline
  var maxX, minX;
  var maxPt, minPt;
  for (var idx in points) {
      var pt = points[idx];
      if (pt[0] > maxX || !maxX) {
          maxPt = pt;
          maxX = pt[0];
      }
      if (pt[0] < minX || !minX) {
          minPt = pt;
          minX = pt[0];
      }
  }
  var ch = [].concat(GeoUtils.buildConvexHull([minPt, maxPt], points),
                     GeoUtils.buildConvexHull([maxPt, minPt], points));
  return ch;
},

getDistant: function(cpt, bl)
{
    var Vy = bl[1][0] - bl[0][0];
    var Vx = bl[0][1] - bl[1][1];
    return (Vx * (cpt[0] - bl[0][0]) + Vy * (cpt[1] -bl[0][1]));
},

findMostDistantPointFromBaseLine: function(baseLine, points) 
{
    var maxD = 0;
    var maxPt = [];
    var newPoints = [];
    for (var idx in points) {
        var pt = points[idx];
        var d = GeoUtils.getDistant(pt, baseLine);
        
        if ( d > 0) {
            newPoints.push(pt);
        } else {
            continue;
        }
        
        if ( d > maxD ) {
            maxD = d;
            maxPt = pt;
        }
    
    } 
    return {'maxPoint':maxPt, 'newPoints':newPoints};
},

buildConvexHull: function(baseLine, points)
{
    var allBaseLines = [];    
    allBaseLines.push(baseLine);
    var convexHullBaseLines = [];
    var t = GeoUtils.findMostDistantPointFromBaseLine(baseLine, points);
    if (t.maxPoint.length) { // if there is still a point "outside" the base line
        convexHullBaseLines = 
            convexHullBaseLines.concat( 
                GeoUtils.buildConvexHull( [baseLine[0],t.maxPoint], t.newPoints) 
            );
        convexHullBaseLines = 
            convexHullBaseLines.concat( 
                GeoUtils.buildConvexHull( [t.maxPoint,baseLine[1]], t.newPoints) 
            );
        return convexHullBaseLines;
    } else {  // if there is no more point "outside" the base line, the current base line is part of the convex hull
        return [baseLine];
    }    
},


}

}();


function SplineInterpolator(in_x,in_y) 
{
    var n = in_x.length;
    this.xa = [];
    this.ya = [];
    this.u = [];
    this.y2 = [];

    for (var i = 0; i < n; i++) {
        this.xa.push(in_x[i]);
        this.ya.push(in_y[i]);
    }

    this.u[0] = 0;
    this.y2[0] = 0;

    for (var i = 1; i < n - 1; ++i) {
        // This is the decomposition loop of the tridiagonal algorithm. 
        // y2 and u are used for temporary storage of the decomposed factors.
        var wx = this.xa[i + 1] - this.xa[i - 1];
        var sig = (this.xa[i] - this.xa[i - 1]) / wx;
        var p = sig * this.y2[i - 1] + 2.0;

        this.y2[i] = (sig - 1.0) / p;

        var ddydx = 
            (this.ya[i + 1] - this.ya[i]) / (this.xa[i + 1] - this.xa[i]) - 
            (this.ya[i] - this.ya[i - 1]) / (this.xa[i] - this.xa[i - 1]);

        this.u[i] = (6.0 * ddydx / wx - sig * this.u[i - 1]) / p;
    }

    this.y2[n - 1] = 0;

    // This is the backsubstitution loop of the tridiagonal algorithm
    for (var i = n - 2; i >= 0; --i) {
        this.y2[i] = this.y2[i] * this.y2[i + 1] + this.u[i];
    }     
}
SplineInterpolator.prototype.interpolate = function(x) {
    var n = this.ya.length;
    var klo = 0;
    var khi = n - 1;

    // We will find the right place in the table by means of
    // bisection. This is optimal if sequential calls to this
    // routine are at random values of x. If sequential calls
    // are in order, and closely spaced, one would do better
    // to store previous values of klo and khi.
    while (khi - klo > 1) {
        var k = (khi + klo) >> 1;

        if (this.xa[k] > x) {
            khi = k; 
        } else {
            klo = k;
        }
    }

    var h = this.xa[khi] - this.xa[klo];
    var a = (this.xa[khi] - x) / h;
    var b = (x - this.xa[klo]) / h;

    // Cubic spline polynomial is now evaluated.
    return a * this.ya[klo] + b * this.ya[khi] + 
        ((a * a * a - a) * this.y2[klo] + (b * b * b - b) * this.y2[khi]) * (h * h) / 6.0;
};
