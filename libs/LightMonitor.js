// Subclass of Pad.
glm = null;
$(function(){
  $('div.A-LightMonitor').each(function(){
    glm = new LightMonitor(this);
  });  
  
  
  var source = new EventSource("server/lightmonitor.cgi");
  source.onmessage = function (event) {
      var msg;
      try {
          msg =$.parseJSON(event.data);
          // console.log("Doing msg",msg);
      
      } catch (err)
      {
          console.log("Caught error".err);
          console.log("Couldn't parse or trigger event:",event);
          console.log("Couldn't parse or trigger event.data:",event.data);
          return;
      }
      if(msg) $('div.A-LightMonitor').trigger("gotMsg",msg);
  };
  
  
  source.addEventListener('open', function(e) {
      console.log("opened stream")
  }, false);
  source.addEventListener('error', function(e) {
      console.log('error on stream');
    if (e.readyState == EventSource.CLOSED) {
        console.log('closed');
    }
  }, false);
  
  
  
});

LightMonitor.prototype = new Pad();           

function LightMonitor( element )
{
  // console.log('HistCanvas ctor');
  if(!element){
      // console.log("HistCanvas: NULL element supplied."); 
      return;
  }

  var settings = {
    // default settings:
    min_u: -60,
    max_u:   0,
    min_v:   0,
    max_v:  10,
    
    margin_left:20,
    margin_bottom:20,
    
    log_y : false,
    suppress_zero: false,
    draw_grid_y : true,
    draw_grid_x : false,
    draw_ticks_x : true,
    margin_left : 30,
    margin_bottom : 40,
    draw_box : false,    
    margin_right : 10,
    margin_top : 10,
    xlabel : "time",
    ylabel : "rate",
    marker: null,
  	adjuct_display: false,
  	adjunct_height: 0,
		adunct_label: null,
    default_options : {
      doFill: true,
      doLine: false,
      lineWidth: 1,
      strokeStyle: "black",
      alpha: 1.0
    }
  };
  
  Pad.call(this, element, settings); // Give settings to Pad contructor.


  // Now our own (non-customizable) setup.
  //data storage
  this.data = [];
  this.latest = 0;
  this.duration = -this.min_u;

  // State model:
  this.fIsBeingDragged = false;
  this.fMouseInContent = false;
  this.fDragMode = "none";
  this.fDragStartX = 0; // start drag X coordinate, absolute, in pixels
  this.fDragStartT = 0; // start drag X coordinate, in display units.
  this.fDragStartY = 0; // in pixels
  this.fDragStartF = 0; // in display units

  if(!this.element) { return; }
  // This should work to rebind the event handler to this particular instance of the HistCanvas.
  // This gives us a mousedown in our region, mousemove or mouseup anywhere.
  var self = this;
  $(this.element).bind('gotMsg', function(ev,msg)   { return self.DoMsg(msg); });
  $(this.element).unbind('click');
  this.Draw();
}

LightMonitor.prototype.DoMsg = function(msg)
{
  if(!msg.t) return;
  
  this.data.push(msg);
  this.latest = msg.t;  
  // Remove old ones.
  var start = this.latest - this.duration;
  var cutTo = 0;
  for(var i=0;i<this.data.length;i++) {
    if(this.data[i].t < start) {cutTo = i;}
    else {break;}
  }
  this.data.splice(0,(cutTo));

  // REset bounds.
  var max = 1; // something sensible??? FIXME
  for(var i=0;i<this.data.length;i++) {
    var v = this.data[i].hg/ this.data[i].n*10
    if(v>max) max = v;
  }
  this.max_v = max;
  
  this.Draw();
}; 


LightMonitor.prototype.Draw = function()
{
  this.Clear();
  this.DrawFrame();
  
  var pts = [];

  this.ctx.linestyle = 'black';
  this.ctx.beginPath();
  for(var i=0;i<this.data.length;i++) {
    var dt = this.data[i].t - this.latest;
    pts.push([dt,this.data[i].hg]);

    var x = this.GetX(dt);
    var y = this.GetY(this.data[i].hg/ this.data[i].n*10);
    // console.log(dt,this.data[i].hg);
    if(i==0) this.ctx.moveTo(x,y);
    else this.ctx.lineTo(x,y);
  }
  this.ctx.stroke();
  // this.ctx.lineStyle = 'black';
  // this.ctx.moveTo(this.GetX(this.min_u), this.GetY(this.min_v));
  // this.ctx.lineTo(this.GetX(this.max_u), this.GetY(this.max_v));
  // this.ctx.stroke();
}

