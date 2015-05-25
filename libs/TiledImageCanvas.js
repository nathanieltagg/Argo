//
// Code for the Arachne Event Display
// Author: Nathaniel Tagg ntagg@otterbein.edu
// 
// Licence: this code is free for non-commertial use. Note other licences may apply to 3rd-party code.
// Any use of this code must include attribution to Nathaniel Tagg at Otterbein University, but otherwise 
// you're free to modify and use it as you like.
//

//
// Object which holds an offscreen canvas created from a series of image URLs in a tileset.
// 
// Paramters: urlarray is a 2d array of URLs [ [url1, url2, url3], [..], [..] ]
//


function TiledImageCanvas( urlarray, callbackfunction )
{
  this.tile_urls = urlarray;
  this.callback_fn = callbackfunction;
  this.offscreenCanvas = document.createElement("canvas");
  this.loaded = false;
  this.tile_images = [];  // this.raw.images={}

  console.time("TiledImageCanvas.begin_loading");
  var self = this;
  
  var total_width = 0;
  var total_height = 0;

  for(var irow=0;irow<this.tile_urls.length;irow++) {
    var row_width = 0;
    var row_height = 0;
    var row = this.tile_urls[irow];
    var imagerow = [];      
    for(var icol=0;icol<row.length;icol++) {
      var elem = this.tile_urls[irow][icol];
      var image_url = elem.url;
      var img = new Image();
      img.src = image_url;
      imagerow.push(img);
      (function(){  // Make a closure to copy the values of irow and icol
        var jrow = irow;
        var jcol = icol;
        console.log("setting callback for",jrow,jcol);        
        img.onload= function() { self.MapData(jrow,jcol); }
      })();
      row_height = Math.max(elem.height,row_height);
      row_width  += elem.width;
    }
    total_height += row_height;
    total_width  = Math.max(row_width,total_width);
    this.tile_images.push(imagerow);
  }
  this.offscreenCanvas.width = total_width;
  this.offscreenCanvas.height = total_height;
  this.offscreenCtx = this.offscreenCanvas.getContext("2d");
};

TiledImageCanvas.prototype.MapData = function(jrow,jcol)
{
  // Callback called when an image finishes loading.
  
  console.time("MapData: one image");
  //Draw in this particular item.
  var elem = this.tile_urls[jrow][jcol];
  var img = this.tile_images[jrow][jcol];
  this.offscreenCtx.drawImage( img, elem.x, elem.y);
  console.timeEnd("MapData: one image");
  

  
  
  // See if we have them all...
  var loaded = true;
  for(var irow=0;irow<this.tile_images.length;irow++) {
    for(var icol=0;icol<this.tile_images[irow].length;icol++) {
      var elem = this.tile_urls[irow][icol];
      var img = this.tile_urls[irow][icol];
      if( !(img.complete) ) loaded = false;
    }
  }
  this.loaded = loaded;
  if(!loaded) return;

  console.log("TiledImageCanvas loaded");
  this.callback_fn.call(this);
};


