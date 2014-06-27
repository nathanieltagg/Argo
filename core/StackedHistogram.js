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

// A histogram class that allows for multiple stacks.

// This was a prototype idea that hasn't been actually fleshed out yet.

function StackedHistogram(n, min, max)
{
    this.n = n;
    this.min = min;
    this.max = max;
    this.underflow = 0;
    this.overflow = 0;
    this.max_content = 0;
    this.min_content = 0;
    this.total = new Array(n);
    for(var i=0;i<n;i++) this.total[i]=0;
    this.histograms = {};
}

StackedHistogram.prototype.AddHist = function(label)
{
  this.histograms[label] = new Array(n);
  this.ClearHist(label);
  return this.histograms[label];
};

StackedHistogram.prototype.ClearHist = function(label)
{
  var h = this.histograms[label];
  for(var i=0;i<this.n;i++) h[i]=0;
};

StackedHistogram.prototype.Fill = function(x,val,label) 
{
  // Check for under- or over-flow. 
  if (x < this.min) {
      this.underflow+=val;
      return;
  }
  if (x > this.max) {
      this.overflow+=val;
      return;
  }

  if(typeof(val)=="undefined") val = 1;

  var bin = Math.floor((x - this.min) * this.n / (this.max - this.min));
  this.total[bin]+=val;

  if(typeof(label)!="undefined") {
    var h = this.histograms[label];
    if(!h) { h = this.AddHist(label);} // Create if not yet defined.
    h[bin]         +=val;
  }
  
  var bintot = this.total[bin];
  if(bintot > this.max_content) this.max_content = bintot;
  if(bintot < this.min_content) this.min_content = bintot;      
};
  
    
StackedHistogram.prototype.GetX = function(bin) 
{
  return (bin/this.n)*(this.max-this.min) + this.min;
};
    
