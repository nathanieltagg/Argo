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
