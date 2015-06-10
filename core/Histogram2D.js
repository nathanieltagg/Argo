//
// Code for the Arachne Event Display
// Author: Nathaniel Tagg ntagg@otterbein.edu
// 
// Licence: this code is free for non-commertial use. Note other licences may apply to 3rd-party code.
// Any use of this code must include attribution to Nathaniel Tagg at Otterbein University, but otherwise 
// you're free to modify and use it as you like.
//

///
/// Boilerplate:  Javascript utilities for MINERvA event display, codenamed "Arachne"
/// Nathaniel Tagg  - NTagg@otterbein.edu - June 2009
///

// Utility functions:

// Build histogram out of JSON data
function Histogram2DFrom(o)
{
  delete o._owner; // if it exists.
  for(var j in o) { if(o[j]) delete o[j]._owner; }
  return $.extend(true,new Histogram2D(1,0,1,1,0,1), o);  
};

// Create a histogram with good boundaries that will incorporate bins 'min' and 'max' into the view.

function CreateGoodHistogram2D(nbinsx, minx, maxx, nbinsy,miny,maxy)
{  
  // Primative version does something reasonable, if not perfect:
  var newmaxx = maxx;
  if(maxx<=minx) newmaxx = minx+1;// Add 1 if we're in trouble
  var newmaxy = maxy;
  if(maxy<=miny) newmaxy = miny+1;// Add 1 if we're in trouble
  var h= new Histogram2D(nbinsx,minx, newmaxx + (newmaxx-minx)/nbinsx,
                         nbinsy,miny, newmaxy + (newmaxy-miny)/nbinsy
    );

  console.log("CreateGoodHistogram2D",nbins,min,max,h);
  return h;  
};

function Histogram2D(nx, minx, maxx, ny, miny, maxy)
{
    this.n_x = nx;
    this.min_x = minx;
    this.max_x = maxx;
    this.n_y = ny;
    this.min_y = miny;
    this.max_y = maxy;
    this.data = [];
    this.Clear();
}

Histogram2D.prototype.Clear = function()
{
  for(var i=0;i<this.n_y;i++) { this.data.push(new Array(this.n_x)); }
  this.underflow_x = Array.apply(null, new Array(this.n_y)).map(Number.prototype.valueOf,0);
  this.overflow_x  = Array.apply(null, new Array(this.n_y)).map(Number.prototype.valueOf,0);
  this.underflow_y = Array.apply(null, new Array(this.n_x)).map(Number.prototype.valueOf,0);
  this.overflow_y  = Array.apply(null, new Array(this.n_x)).map(Number.prototype.valueOf,0);
  this.max_content = 0;
  this.min_content = 0;
  this.total = 0;
  this.sum_x = 0;
  this.sum_x2 = 0;
  this.sum_y = 0;
  this.sum_y2 = 0;
};

    
Histogram2D.prototype.GetX = function(bin) 
{
    return (bin/this.n_x)*(this.max_x-this.min_x) + this.min_x;
};

Histogram2D.prototype.GetY = function(bin) 
{
    return (bin/this.n_y)*(this.max_y-this.min_y) + this.min_y;
};

Histogram2D.prototype.GetMeanX = function()
{
  return this.sum_x/this.total;
};

Histogram2D.prototype.GetMeanY = function()
{
  return this.sum_y/this.total;
};

Histogram2D.prototype.GetRMSX = function()
{
  var x = this.sum_x/this.total;
  var rms2 = Math.abs(this.sum_x2/this.total -x*x); // As root TH1 does.
  return Math.sqrt(rms2);
};

Histogram2D.prototype.GetRMSY = function()
{
  var y = this.sum_y/this.total;
  var rms2 = Math.abs(this.sum_y2/this.total -y*y); // As root TH1 does.
  return Math.sqrt(rms2);
};

