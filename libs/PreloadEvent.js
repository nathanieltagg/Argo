///
///
/// Code to load an event from the server while still displaying an old one.
///
///

// test: 
// Preload({entry:1,filename:"/Users/tagg/lar/PhysicsRun-2016_2_21_6_53_39-0005092-00011_20160222T003710_bnb_20160222T051451_merged_20160505T011555_reco1_20160505T105350_reco2.root"},"server/serve_event.cgi")

gPreload_jqXHR = null;    
gPreload_Serving = null;   // Data element from server, including wrapper with possible error messages.
gPreload_Record = null;    // This is the core data element
gPreload_URL = null;
gPreload_images = null;


function Preload(par, myurl)
{
  
  if(gPreload_Record) PreloadFinish();
  gPreload_jqXHR = null;    
  gPreload_Serving = null;   // Data element from server, including wrapper with possible error messages.
  gPreload_Record = null;    // This is the core data element
  gPreload_URL = null;
  gPreload_images = null;

    gPreload_TimeStats_StartQuery = performance.now();
    console.log("Preload",par,myurl);
    
    var opts = "";
    if (!$(".show-wireimg").is(":checked")) {
      opts += "_NORAW__NOCAL_";
    }
    var tilesize = 2400;
    if(kMaxTileSize < tilesize) tilesize = kMaxTileSize;
    opts+= "_tilesize" + tilesize + "_";

    // Default: do file-and-entry read from parameters. Should check for other options first.
    data = $.extend({},par)
    if(data.filename) data.filename = encodeURIComponent(par.filename);
    if(!data.options) data.options = opts;    
    var param = $.param(data);
    
    console.log("Preload "+myurl+"?"+param);
    gPreload_URL = myurl+"?"+param+"\">"+myurl+"?"+param;
    
    // JQuery call for compatibility.
    $.ajax({
            type: "GET",
            url: myurl,
            data: param,
            contentType: "application/json; charset=utf-8",
            dataType: "json",
            async: true,
            dataFilter: Preload_QueryFilter,
            error:    Preload_QueryError,
            success:  Preload_QuerySuccess,
            xhrFields: {
              onprogress : function(evt){
                console.log("progress",parseInt(evt.loaded/evt.total*100)+'%');
               }
              
            }
          });
    
    return false;
}

function Preload_QueryFilter(data, type)
{
  // This function is called before processing, I think: it might be used to do timing.
  gPreload_ServerResponseTime = (new Date()).getTime();
  return data;
}

function Preload_QueryError(jqxhr, textStatus, errorThrown )
{ 
  gPreload_jqXHR = jqxhr;
  gPreload_Serving = null;
  gPreload_Record = null;
  
  console.log("Preload_QueryError! Result:",gjqXHR);
  $('#status').attr('class', 'status-error');
}

function Preload_QuerySuccess(data,textStatus,jqxhr)
{
  gPreload_TimeStats_QuerySuccess = performance.now();
  
  console.log("Preload_QuerySuccess");
  
  gPreload_jqXHR = jqxhr;
  gPreload_Serving = null;
  gPreload_Record = null;
  
  gPreload_Serving = data;

  if(gServing.error) { 
    console.error("Error from serve-event: ",gServing.error);
    return;
  }
  
  
  if(gPreload_Serving.record) {
    gPreload_Record = gPreload_Serving.record;
    gPreload_images = {num_images_needed:0, images_got:0, images:[]};
    // Start preloading images into cache.
    for(typ of ["raw","cal"]) {
      for(product in gPreload_Record[typ]) {
        if(gPreload_Record[typ][product]) {
          var tile_urls = gRecord[typ][product].wireimg_encoded_tiles;
          
          for(var irow=0;irow< tile_urls.length;irow++) {
            var row = tile_urls[irow];
            for(var icol=0;icol<row.length;icol++) {
              gPreload_images.num_images_needed++
      
              var elem = tile_urls[irow][icol];
              var image_url = elem.url;
              var img = new Image();
              gPreload_images.images.push(img);
              
              (function(){  // Make a closure to copy the values of irow and icol
                var jrow = irow;
                var jcol = icol;
                // console.log("setting callback for",jrow,jcol);
                img.onload= function() { Preload_ImageLoaded(jrow,jcol); }
        
              })();
              img.load(image_url);
            }
          }
        }    
      }    
    }
      
  }
  if(gPreload_images.num_images_needed == 0) Preload_Finish();
}

function Preload_ImageLoaded(row,col)
{
  if(gPreload_images.images) {
    var done = true;
    for(var i=0; i< gPreload_images.images.length; i++) {
      if(!gPreload_images.images[i].complete) done = false;
    }
    if(done) Preload_Finish(); 
  }
}

function Preload_Finish()
{
  if(!gPreload_Record) return;
  gjqXHR   = gPreload_jqXHR;       
  gServing = gPreload_Serving;    // Data element from server, including wrapper with possible error messages.
  gRecord  = gPreload_Record;      // This is the core data element

  // Disallow multiple calls.
  gPreload_jqXHR = null;    
  gPreload_Serving = null;   // Data element from server, including wrapper with possible error messages.
  gPreload_Record = null;    // This is the core data element

  StartEvent();
  gFinishedDrawTime = (new Date()).getTime();
  DoPerformanceStats();
  
}