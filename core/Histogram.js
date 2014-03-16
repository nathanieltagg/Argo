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

function Histogram(n, min, max)
{
    this.n = n;
    this.data = new Array(n);
    this.min = min;
    this.max = max;
    this.max_x = min;
    this.min_x = max;
    this.Clear();
}

Histogram.prototype.Clear = function()
{
  for (var i = 0; i < this.n+1; i++) {
      this.data[i] = 0;
  }
  this.underflow = 0;
  this.overflow = 0;
  this.max_content = 0;
  this.min_content = 0;
  this.total = 0;
  this.sum_x = 0;
} 

Histogram.prototype.ExpandFill = function(x,val) 
{
  // Fill a histogram, but always expand limits to grow, instead of overflowing.
  if(!val) val = 1;
  var bin = this.GetBin(x);
  if (bin<0) {
    console.log("expandlow");
    // Instead of underflowing, figure out how many bins we need at the beginning to accomodate this.
    var nadd = -bin;
    if(this.n+nadd > 10000) { console.error("Increasing bounds on histogram",this,"to",this.n+nadd,". This might be bad!"); }
    var newdata = new Array(nadd);
    for (var i = 0; i < nadd; i++) newdata[i] = 0;
    this.data = newdata.concat(this.data);
    var binwidth = (this.max - this.min)/this.n;
    this.min = this.min - binwidth*nadd;
    this.n += nadd;
    bin = this.GetBin(x); // should be 0 now.
  }

  if (bin >= this.n) {
    // Instead of overflowing, expand the histogram.    
    console.log("expandhigh");
    var nadd = bin + 1 - this.n;
    if(this.n+nadd > 10000) { 
      console.error("Increasing bounds on histogram",this,"to",this.n+nadd,". This might be bad!"); 
    }
    var newdata = new Array(nadd);
    for (var i = 0; i < nadd; i++) newdata[i] = 0;
    this.data = this.data.concat(newdata);
    var binwidth = (this.max - this.min)/this.n;
    this.max = this.max + binwidth*nadd;
    this.n += nadd;
    bin = this.GetBin(x); // should be n now.
  }
  
  this.total+=val;
  this.sum_x += val*x;
  if(x > this.max_x) this.max_x = x;
  if(x < this.min_x) this.min_x = x;

  this.data[bin]+=val;
  if(this.data[bin] > this.max_content) this.max_content = this.data[bin];
  if(this.data[bin] < this.min_content) this.min_content = this.data[bin];      
  
}

Histogram.prototype.Fill = function(x,val) 
{
  if(!val) val = 1;
  if (x < this.min) {
      this.underflow+=val;
      return;
  }
  if (x > this.max) {
      this.overflow+=val;
      return;
  }
  this.total+=val;
  this.sum_x += val*x;
  if(x > this.max_x) this.max_x = x;
  if(x < this.min_x) this.min_x = x;
  var bin = this.GetBin(x);

  this.data[bin]+=val;
  if(this.data[bin] > this.max_content) this.max_content = this.data[bin];
  if(this.data[bin] < this.min_content) this.min_content = this.data[bin];      
}

Histogram.prototype.GetBin = function(x) 
{
   return Math.floor((x - this.min) * this.n / (this.max - this.min));
}

Histogram.prototype.SetBinContent = function(bin,val) 
{
    this.total+=val;
    var x = this.GetX(bin);
    this.sum_x += val*x;
    if(x > this.max_x) this.max_x = x;
    if(x < this.min_x) this.min_x = x;
  
    this.data[bin]=val;
    if(this.data[bin] > this.max_content) this.max_content = this.data[bin];
    if(this.data[bin] < this.min_content) this.min_content = this.data[bin];      
}


    
Histogram.prototype.GetX = function(bin) 
{
    return (bin/this.n)*(this.max-this.min) + this.min;
}

Histogram.prototype.GetMean = function()
{
  return this.sum_x/this.total;
}


Histogram.prototype.Dump = function()
{
  var r = "";
  for(var i=0;i<this.n;i++) {
    r += i + " \t " << this.data[i] << "\n";
  }
  r += "Overflow:  " + this.overflow + "\n";
  r += "Underflow: " + this.underflow + "\n";
  return r;
}
    
Histogram.prototype.GetROI = function(frac)
{
  // Find the start and endpoints that throw away frac of the total charge
  var bin_low = 0;
  // bring bin_low up until we've got (1-frac)/2 
  var tot_low = 0;
  while(bin_low<this.n && tot_low<(frac*this.total/2.) ) {
    tot_low += this.data[bin_low];
    bin_low++;
  }

  var bin_high = this.n-1;
  // bring bin_low up until we've got (1-frac)/2 
  var tot_high = 0;
  while(bin_high>0 && tot_high<(frac*this.total/2.) ) {
    tot_high += this.data[bin_high];
    bin_high--;
  }

  return [this.GetX(bin_low),this.GetX(bin_high)];
}
