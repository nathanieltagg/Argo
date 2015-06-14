//
// Code for the Arachne Event Display
// Author: Nathaniel Tagg ntagg@otterbein.edu
// 
// Licence: this code is free for non-commertial use. Note other licences may apply to 3rd-party code.
// Any use of this code must include attribution to Nathaniel Tagg at Otterbein University, but otherwise 
// you're free to modify and use it as you like.
//

// First up: bind new records to make tiled images

// $(function(){
//   gStateMachine.Bind('recordChange',MakeTiledImages);
// });

function MakeTiledImages()
{
  
  // Create the tiled images.
  
  // FIXME: assumes only 1 type of raw or cal wires in any given loaded event.
  
  for(rawtype in gRecord.raw) {
    // Create a tiled image to hold this raw data.
    if(gRecord.raw[rawtype]) {
    tile_urls= gRecord.raw[rawtype].wireimg_encoded_tiles;
      if(tile_urls) {
        gRecord._raw = {};
        gRecord._raw.tiled_canvas= new TiledImageCanvas( 
                                        tile_urls,
                                        function(){gStateMachine.Trigger("TiledImageLoaded_raw");},
                                        "_raw"
                                        );
      }
    }    
  }
  
  for(rawtype in gRecord.cal) {
    // Create a tiled image to hold this raw data.
    if(gRecord.cal[rawtype]) {    
      tile_urls= gRecord.cal[rawtype].wireimg_encoded_tiles;
      if(tile_urls) {
        gRecord._cal = {};
        gRecord._cal.tiled_canvas= new TiledImageCanvas( 
                                        tile_urls,
                                        function(){gStateMachine.Trigger("TiledImageLoaded_cal");},
                                        "_cal"
                                        );
      }
    }    
  }
  
};


//
// Object which holds an offscreen canvas created from a series of image URLs in a tileset.
// 
// Paramters: urlarray is a 2d array of URLs [ [url1, url2, url3], [..], [..] ]
//


function TiledImageCanvas( urlarray, callbackfunction, iname )
{
  this.tile_urls = urlarray;
  this.callback_fn = callbackfunction;
  this.canvas = document.createElement("canvas");
  this.loaded = false;
  this.tile_images = [];  // this.raw.images={}
  this.name = iname;

  console.time("TiledImageCanvas.begin_loading");
  var self = this;
  
  var total_width = 0;
  var total_height = 0;
  this.num_images_loaded = 0;
  this.num_images_needed = 0;

  for(var irow=0;irow<this.tile_urls.length;irow++) {
    var row_width = 0;
    var row_height = 0;
    var row = this.tile_urls[irow];
    var imagerow = [];      
    for(var icol=0;icol<row.length;icol++) {
      this.num_images_needed++
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
  this.canvas.width = total_width;
  this.canvas.height = total_height;
  this.ctx = this.canvas.getContext("2d",{alpha:false, willReadFrequently:true});
  this.ctx.imageSmoothingEnabled= false
};

TiledImageCanvas.prototype.MapData = function(jrow,jcol)
{
  // Callback called when an image finishes loading.
  
  console.time("MapData: one image");
  //Draw in this particular item.
  var elem = this.tile_urls[jrow][jcol];
  var img = this.tile_images[jrow][jcol];
  this.ctx.drawImage( img, elem.x, elem.y);
  console.timeEnd("MapData: one image");
  this.num_images_loaded++;
  
  if(this.num_images_loaded < this.num_images_needed) return;
  
  // See if we have them all...
  var loaded = true;
  for(var irow=0;irow<this.tile_images.length;irow++) {
    for(var icol=0;icol<this.tile_images[irow].length;icol++) {
      var elem = this.tile_urls[irow][icol];
      var img = this.tile_images[irow][icol];
      if( !(img.complete) ) loaded = false;
    }
  }
  this.loaded = loaded;
  if(!loaded) return;

  console.log("TiledImageCanvas loaded",this.name);

  // gle = new GLEngine ;
  // ps = new PsTest();
  // gle.draw_falsecolor_from_canvas(gRecord._raw_tiled_canvas.canvas, ps, gle.gl.getParameter(gle.gl.MAX_TEXTURE_SIZE)/2);
  
  this.callback_fn.call(this);
};


